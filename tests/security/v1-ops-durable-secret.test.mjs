import test from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createFileRootKeyHandle, DurableSecretService } from '../../src/security/durable-secret-service.mjs';
import { createProductionSecretAuditAccess, createProductionSecretService, validateProductionConfig } from '../../src/security/runtime-config.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dgos-v1-ops-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const keys = path.join(root, 'keys');
  const data = path.join(root, 'ciphertext');
  await mkdir(keys, { mode: 0o700 });
  await writeFile(path.join(keys, 'v1.key'), randomBytes(32).toString('base64url'), { mode: 0o600 });
  await writeFile(path.join(keys, 'current'), 'v1', { mode: 0o600 });
  const create = () => new DurableSecretService({ directory: data, rootKeyHandle: createFileRootKeyHandle({ keyDirectory: keys }) }).ready();
  return { root, keys, data, create };
}

test('durable ciphertext survives restart and never stores plaintext', async (t) => {
  const { data, keys, create } = await fixture(t);
  const service = await create();
  const input = { secretRef: 'provider:1', value: 'highly-secret-provider-token', purpose: 'provider', subjectId: 'owner-1', ttlMs: 60_000 };
  assert.deepEqual(await service.put(input), { secretRef: input.secretRef, version: 1, credentialState: 'available' });
  assert.equal(await (await (await create()).resolve({ secretRef: input.secretRef, purpose: input.purpose, subjectId: input.subjectId })).read(), input.value);
  const disk = (await Promise.all((await readdir(data)).map((name) => readFile(path.join(data, name), 'utf8')))).join('');
  assert.doesNotMatch(disk, /highly-secret-provider-token/);
  assert.doesNotMatch(disk, new RegExp((await readFile(path.join(keys, 'v1.key'), 'utf8')).trim()));
  assert.equal((await readdir(keys)).includes('v1.key'), true);
});

test('read checks authoritative version, revoke and scope every time', async (t) => {
  const { create } = await fixture(t);
  const first = await create();
  const second = await create();
  const scope = { secretRef: 's1', purpose: 'provider', subjectId: 'owner' };
  await first.put({ ...scope, value: 'first', ttlMs: 60_000 });
  const old = await first.resolve({ ...scope, requestId: 'request-1' });
  await assert.rejects(() => first.resolve({ ...scope, subjectId: 'other' }), /credential_scope_denied/);
  await assert.rejects(() => old.read('request-2'), /credential_scope_denied/);
  assert.equal(await old.read(), 'first');
  await second.put({ ...scope, value: 'second', ttlMs: 60_000, expectedVersion: 1 });
  await assert.rejects(() => old.read(), /credential_unavailable/);
  const latest = await first.resolve(scope);
  assert.equal(await latest.read(), 'second');
  await second.revoke('s1');
  await assert.rejects(() => latest.read(), /credential_unavailable/);
  assert.deepEqual(await first.inspect('s1'), { credentialState: 'unavailable', version: 3, digest: (await first.inspect('s1')).digest });
});

test('authenticated control metadata cannot be flipped to revive or rescope a record', async (t) => {
  const fields = [
    ['revoked', false], ['expiresAt', Date.now() + 86_400_000], ['purpose', 'admin-login'],
    ['subjectId', 'other'], ['version', 1], ['keyId', 'other'], ['digest', '0'.repeat(64)],
  ];
  for (const [field, replacement] of fields) {
    const { data, create } = await fixture(t);
    const service = await create();
    const scope = { secretRef: `control-${field}`, purpose: 'provider', subjectId: 'owner' };
    await service.put({ ...scope, value: 'hidden', ttlMs: 60_000 });
    await service.revoke(scope.secretRef);
    const file = path.join(data, (await readdir(data))[0]);
    const record = JSON.parse(await readFile(file, 'utf8'));
    record[field] = replacement;
    await writeFile(file, JSON.stringify(record));
    await assert.rejects(() => service.resolve({ ...scope, purpose: record.purpose, subjectId: record.subjectId }), /credential_unavailable/);
    await assert.rejects(() => service.inspect(scope.secretRef), /credential_unavailable/);
  }
});

test('legacy ciphertext requires explicit reviewed offline migration', async (t) => {
  const { data, keys, create } = await fixture(t);
  const service = await create();
  const secretRef = 'legacy';
  const key = Buffer.from(await readFile(path.join(keys, 'v1.key'), 'utf8'), 'base64url');
  const nonce = randomBytes(12);
  const metadata = { secretRef, purpose: 'provider', subjectId: 'owner', version: 1, expiresAt: Date.now() + 60_000 };
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(JSON.stringify(metadata)));
  const ciphertext = Buffer.concat([cipher.update('older-secret'), cipher.final()]);
  const digest = createHash('sha256').update(secretRef).digest('hex');
  await writeFile(path.join(data, `${digest}.json`), JSON.stringify({ format: 1, ...metadata, revoked: false, keyId: 'v1', digest: createHash('sha256').update('older-secret').digest('hex'), nonce: nonce.toString('base64url'), ciphertext: ciphertext.toString('base64url'), tag: cipher.getAuthTag().toString('base64url') }), { mode: 0o600 });
  await assert.rejects(() => service.resolve(metadata), /credential_unavailable/);
  await assert.rejects(() => service.verifyCiphertext(), /credential_unavailable/);
  await assert.rejects(() => service.migrateLegacy({ trustLegacyControlState: true }), /legacy_state_review_required/);
  assert.deepEqual(await service.migrateLegacy({ trustLegacyControlState: true, reviewedRecordDigests: [digest] }), { migrated: 1 });
  const migrated = JSON.parse(await readFile(path.join(data, `${digest}.json`), 'utf8'));
  assert.equal(migrated.format, 2);
  assert.equal(migrated.version, 2);
  assert.equal(await (await service.resolve(metadata)).read(), 'older-secret');
});

test('verification tolerates an active writer lock and rejects orphan lock or temp', async (t) => {
  const { data, create } = await fixture(t);
  const service = await create();
  await service.put({ secretRef: 'concurrent', purpose: 'provider', subjectId: 'owner', value: 'secret', ttlMs: 60_000 });
  const base = (await readdir(data))[0];
  const lock = path.join(data, `${base}.lock`);
  await mkdir(lock, { mode: 0o700 });
  const pending = service.verifyCiphertext();
  await new Promise((resolve) => setTimeout(resolve, 30));
  await rm(lock, { recursive: true });
  assert.deepEqual(await pending, { verified: 1 });
  await mkdir(lock, { mode: 0o700 });
  await assert.rejects(() => service.verifyCiphertext(), /credential_unavailable/);
  await rm(lock, { recursive: true });
  const temp = path.join(data, `${base}.${randomBytes(12).toString('hex')}.tmp`);
  await writeFile(temp, 'partial');
  await assert.rejects(() => service.verifyCiphertext(), /credential_unavailable/);
});

test('production audit records anonymous digests and failure blocks read', async (t) => {
  const { data, keys } = await fixture(t);
  const events = [];
  const transactions = [];
  let failOutbox = false;
  const pool = {
    async query() { throw new Error('unexpected_pool_query'); },
    async connect() {
      let pending = null;
      return {
        async query(sql, values) {
          if (sql === 'BEGIN') { assert.equal(pending, null); pending = []; return; }
          if (sql === 'COMMIT') { assert.ok(pending); events.push(...pending); transactions.push('committed'); pending = null; return; }
          if (sql === 'ROLLBACK') { assert.ok(pending); transactions.push('rolled_back'); pending = null; return; }
          assert.ok(pending, 'audit writes require an open transaction');
          if (failOutbox && sql.includes('audit_outbox')) throw new Error('database_offline');
          pending.push({ sql, values });
        },
        release() { assert.equal(pending, null); },
      };
    },
  };
  const service = await new DurableSecretService({ directory: data, rootKeyHandle: createFileRootKeyHandle({ keyDirectory: keys }), auditAccess: createProductionSecretAuditAccess(pool) }).ready();
  const scope = { secretRef: 'private:123', purpose: 'provider', subjectId: 'owner-secret', requestId: 'request-1' };
  await service.put({ ...scope, value: 'secret', ttlMs: 60_000 });
  const handle = await service.resolve(scope);
  assert.equal(await handle.read(), 'secret');
  assert.equal(events.length, 6);
  assert.deepEqual(transactions, ['committed', 'committed', 'committed']);
  assert.equal(events.filter((item) => item.sql.includes('audit_events')).length, 3);
  assert.equal(events.filter((item) => item.sql.includes('audit_outbox')).length, 3);
  assert.doesNotMatch(JSON.stringify(events), /private:123|owner-secret|"secret"/);
  assert.match(JSON.stringify(events), /secret\.read\.requested/);
  for (const event of events.filter((item) => item.sql.includes('audit_events'))) {
    assert.match(event.values[1], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(event.values[6], null);
  }
  failOutbox = true;
  await assert.rejects(() => handle.read(), /credential_unavailable/);
  assert.equal(events.length, 6);
  assert.equal(transactions.at(-1), 'rolled_back');
});

test('TTL, missing key and storage failure fail closed', async (t) => {
  const { data, keys } = await fixture(t);
  let now = 1000;
  const service = await new DurableSecretService({ directory: data, rootKeyHandle: createFileRootKeyHandle({ keyDirectory: keys }), clock: () => now, handleTtlMs: 5 }).ready();
  const scope = { secretRef: 's2', purpose: 'login', subjectId: 'admin' };
  await service.put({ ...scope, value: 'credential', ttlMs: 100 });
  const handle = await service.resolve(scope);
  now += 5;
  await assert.rejects(() => handle.read(), /credential_unavailable/);
  const fresh = await service.resolve(scope);
  await rename(path.join(keys, 'v1.key'), path.join(keys, 'held.key'));
  await assert.rejects(() => fresh.read(), /credential_unavailable/);
  await assert.rejects(() => service.put({ ...scope, value: 'new' }), /credential_unavailable/);
  await rename(path.join(keys, 'held.key'), path.join(keys, 'v1.key'));
  now += 100;
  await assert.rejects(() => service.resolve(scope), /credential_unavailable/);
  assert.equal((await service.inspect('s2')).credentialState, 'unavailable');
  await assert.rejects(() => service.put({ ...scope, value: 'new', expectedVersion: 0 }), /version_conflict/);
});

test('parallel instances increment versions and stale CAS cannot overwrite', async (t) => {
  const { create } = await fixture(t);
  const [first, second] = await Promise.all([create(), create()]);
  const scope = { secretRef: 'race', purpose: 'provider', subjectId: 'owner', ttlMs: 60_000 };
  const outcomes = await Promise.allSettled([first.put({ ...scope, value: 'one', expectedVersion: 0 }), second.put({ ...scope, value: 'two', expectedVersion: 0 })]);
  assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter((item) => item.status === 'rejected' && item.reason.message === 'version_conflict').length, 1);
  assert.equal((await first.inspect('race')).version, 1);
});

test('tampered ciphertext and unavailable durable directory fail closed', async (t) => {
  const { data, create } = await fixture(t);
  const service = await create();
  const scope = { secretRef: 'tamper', purpose: 'provider', subjectId: 'owner' };
  await service.put({ ...scope, value: 'sensitive', ttlMs: 60_000 });
  const handle = await service.resolve(scope);
  const file = path.join(data, (await readdir(data))[0]);
  const record = JSON.parse(await readFile(file, 'utf8'));
  record.ciphertext = randomBytes(9).toString('base64url');
  await writeFile(file, JSON.stringify(record));
  await assert.rejects(() => handle.read(), /credential_unavailable/);
  await assert.rejects(() => service.inspect(scope.secretRef), /credential_unavailable/);
  await assert.rejects(() => service.put({ ...scope, value: 'next' }), /credential_unavailable/);
  await assert.rejects(() => service.verifyCiphertext(), /credential_unavailable/);
  await rename(data, `${data}.offline`);
  await assert.rejects(() => service.resolve(scope), /credential_unavailable/);
  await assert.rejects(() => service.put({ ...scope, value: 'next' }), /credential_unavailable/);
});

test('backup, restore and rewrap use independent key directory', async (t) => {
  const { root, keys, data, create } = await fixture(t);
  const service = await create();
  const scope = { secretRef: 'recovery', purpose: 'provider', subjectId: 'owner' };
  await service.put({ ...scope, value: 'recoverable-secret', ttlMs: 60_000 });
  const backup = path.join(root, 'backup');
  const restored = path.join(root, 'restored');
  const run = (name, args) => execFileSync(process.execPath, [path.join('scripts', name), ...args], { cwd: path.resolve(new URL('../..', import.meta.url).pathname), encoding: 'utf8' });
  assert.match(run('v1-ops-backup.mjs', [data, backup]), /"records":1/);
  assert.deepEqual((await readdir(backup)).sort(), [(await readdir(data))[0], 'manifest.json'].sort());
  assert.match(run('v1-ops-restore.mjs', [backup, restored, keys]), /restored_read_only_validation_required/);
  const recovered = await new DurableSecretService({ directory: restored, rootKeyHandle: createFileRootKeyHandle({ keyDirectory: keys }) }).ready();
  assert.equal(await (await recovered.resolve(scope)).read(), 'recoverable-secret');
  assert.match(run('v1-ops-rotate.mjs', [restored, keys, 'v2']), /"rewrapped":1/);
  assert.equal(await (await recovered.resolve(scope)).read(), 'recoverable-secret');
  await rm(path.join(keys, 'v2.key'));
  await assert.rejects(async () => (await recovered.resolve(scope)).read(), /credential_unavailable/);
});

test('restore rejects modified ciphertext backup', async (t) => {
  const { root, keys, data, create } = await fixture(t);
  const service = await create();
  await service.put({ secretRef: 'backup-tamper', purpose: 'provider', subjectId: 'owner', value: 'secret', ttlMs: 60_000 });
  const backup = path.join(root, 'backup');
  const run = (name, args) => execFileSync(process.execPath, [path.join('scripts', name), ...args], { cwd: path.resolve(new URL('../..', import.meta.url).pathname), encoding: 'utf8', stdio: 'pipe' });
  run('v1-ops-backup.mjs', [data, backup]);
  const file = path.join(backup, (await readdir(data))[0]);
  await writeFile(file, 'modified');
  assert.throws(() => run('v1-ops-restore.mjs', [backup, path.join(root, 'restore'), keys]));
});

test('production config rejects fixtures and defaults; controlled handle can initialize', async (t) => {
  const { root, keys, data } = await fixture(t);
  const packageRoot = path.join(root, 'packages');
  const packageTrustRootsFile = path.join(root, 'operator-roots.json');
  const extensionConfigFile = path.join(root, 'extension-runtime.json');
  await mkdir(packageRoot, { mode: 0o700 });
  await writeFile(packageTrustRootsFile, JSON.stringify([{ keyId: 'operator', publicKey: 'fixture-public-key', source: 'admin' }]), { mode: 0o600 });
  await writeFile(extensionConfigFile, JSON.stringify({ version: 1, sources: [{ source: 'fixture' }] }), { mode: 0o600 });
  const env = { NODE_ENV: 'production', DGOS_SECRET_BACKEND: 'encrypted-file', DGOS_DATABASE_URL: 'postgres://app:strong-value@postgres:5432/prod', REDIS_URL: 'redis://redis:6379', DGOS_SECRET_DIRECTORY: data, DGOS_ROOT_KEY_DIRECTORY: keys, DGOS_PACKAGE_ROOT: packageRoot, DGOS_PACKAGE_TRUST_ROOTS_FILE: packageTrustRootsFile, DGOS_EXTENSION_CONFIG_FILE: extensionConfigFile, DGOS_PUBLIC_ORIGIN: 'https://prod.invalid' };
  assert.equal(validateProductionConfig(env).publicOrigin, 'https://prod.invalid');
  await createProductionSecretService({ env });
  for (const patch of [{ NODE_ENV: 'development' }, { DGOS_SECRET_BACKEND: 'development-memory' }, { DGOS_DATABASE_URL: 'postgres://dgos:dgos@localhost:5432/dgos' }, { DGOS_PUBLIC_ORIGIN: 'http://prod.invalid' }, { DGOS_ALLOW_INSECURE_FIXTURE: '1' }, { DGOS_PACKAGE_ROOT: '' }, { DGOS_PACKAGE_TRUST_ROOTS_FILE: '' }, { DGOS_EXTENSION_CONFIG_FILE: '' }]) {
    assert.throws(() => validateProductionConfig({ ...env, ...patch }), /production_configuration_invalid/);
  }
  await writeFile(packageTrustRootsFile, '[]');
  await assert.rejects(() => createProductionSecretService({ env }), /production_configuration_invalid/);
});
