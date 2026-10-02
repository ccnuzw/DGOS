import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DiskPackageStore, PackageService, verifyPackage, canonicalJson, bridgeJson } from '../../src/apps/package-service.mjs';
import { InMemoryPackageRepository } from '../../src/apps/package-repository.mjs';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const canonical = (value) => value === null || typeof value !== 'object' ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
const manifest = (version = '1.0.0', extra = {}) => ({ format: 'dgos-app/v1', appId: 'com.example.package', version, build: version === '1.0.0' ? 1 : 2, releaseChannel: 'stable', minRuntimeVersion: '1.0.0', dataVersion: 1, name: { 'zh-CN': '示例', 'en-US': 'Example' }, description: { 'zh-CN': '测试', 'en-US': 'Test' }, category: 'productivity', icon: 'icon.svg', defaultWindow: { width: 800, height: 600 }, entrypoints: { web: 'index.html' }, permissions: [], capabilityAllowlist: [], trustLevel: 'standard', uninstallPolicy: 'user-removable', backgroundPolicy: 'release', ...extra });
const fixture = (app, privateKey, files = { 'index.html': '<html><body>ok</body></html>' }) => { files = { 'icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>', ...files }; const resourceDigests = Object.fromEntries(Object.entries(files).map(([name, value]) => [name, hash(Buffer.from(value))])); return { requestId: randomUUID(), manifest: app, files: Object.fromEntries(Object.entries(files).map(([name, value]) => [name, Buffer.from(value).toString('base64')])), resourceDigests, keyId: 'developer-1', signature: sign(null, Buffer.from(canonical({ manifest: app, resourceDigests })), privateKey).toString('base64') }; };

test('verified package lifecycle preserves prior pointer and user data', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-packages-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const trustRoots = new Map([['developer-1', { publicKey, source: 'developer' }]]);
  const repository = new InMemoryPackageRepository(); const store = new DiskPackageStore(dir);
  const changes = []; const service = new PackageService({ repository, store, trustRoots, onActionsChanged: async (change) => changes.push(change) });
  const subjectId = randomUUID(); const first = fixture(manifest(), privateKey);
  const submitted = await service.submit(first); assert.equal(submitted.catalogState, 'pending_review');
  await assert.rejects(service.install({ subjectId, appId: first.manifest.appId, version: '1.0.0', build: '1' }), { message: 'app_not_available' });
  await service.review({ appId: first.manifest.appId, version: '1.0.0', build: 1, releaseChannel: 'stable', baseVersion: 1, decision: 'approved' });
  await service.install({ subjectId, appId: first.manifest.appId, version: '1.0.0', build: 1, releaseChannel: 'stable' });
  assert.equal((await service.health({ subjectId, appId: first.manifest.appId })).integrityHealthy, true);
  const second = fixture(manifest('1.0.1'), privateKey); await service.submit(second); await service.review({ appId: second.manifest.appId, version: '1.0.1', build: 2, releaseChannel: 'stable', baseVersion: 1, decision: 'approved' });
  const secondRecord = await repository.getPackage(second.manifest.appId, '1.0.1', 2, 'stable');
  await writeFile(join(store.pathFor(second.manifest, secondRecord.digest), 'index.html'), 'tampered');
  await assert.rejects(service.install({ subjectId, appId: second.manifest.appId, version: '1.0.1', build: 2, releaseChannel: 'stable', baseVersion: 1 }), { message: 'integrity_error' });
  assert.equal((await store.current(subjectId, first.manifest.appId)).digest, submitted.digest);
  assert.equal(repository.operations.at(-1).state, 'rolled_back');
  await service.uninstall({ subjectId, appId: first.manifest.appId, baseVersion: 1 });
  assert.equal((await repository.getDeployment(subjectId, first.manifest.appId)).dataRetained, true);
  assert.equal(await store.current(subjectId, first.manifest.appId), null);
  assert.deepEqual(changes.map((x) => x.enabled), [true, false]);
});

test('bad signatures, untrusted source and path traversal are rejected before staging', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519'); const roots = new Map([['developer-1', { publicKey, source: 'developer' }]]);
  const good = fixture(manifest(), privateKey); assert.match(verifyPackage(good, roots).digest, /^sha256:/);
  assert.throws(() => verifyPackage({ ...good, signature: Buffer.alloc(64).toString('base64') }, roots), { message: 'integrity_error' });
  assert.throws(() => verifyPackage(good, new Map()), { message: 'untrusted_package' });
  assert.throws(() => verifyPackage(fixture(manifest(), privateKey, { '../secret': 'x', 'index.html': '<html></html>' }), roots), { message: 'invalid_package_path' });
  assert.throws(() => verifyPackage(fixture(manifest('1.0.0', { entrypoints: { web: '../escape.html' } }), privateKey), roots), { message: 'manifest_invalid' });
});

test('canonical signature bytes sort numeric-looking keys and submit request is idempotent', async (t) => {
  assert.equal(canonicalJson({ '10': 1, '2': 2, a: 3 }), '{"10":1,"2":2,"a":3}');
  const dir = await mkdtemp(join(tmpdir(), 'dgos-packages-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const service = new PackageService({ repository: new InMemoryPackageRepository(), store: new DiskPackageStore(dir), trustRoots: new Map([['developer-1', { publicKey, source: 'developer' }]]) });
  const input = fixture(manifest(), privateKey); const first = await service.submit(input);
  assert.equal((await service.submit(input)).packageId, first.packageId);
  const changed = fixture(manifest('1.0.1'), privateKey); changed.requestId = input.requestId;
  await assert.rejects(service.submit(changed), { message: 'version_conflict' });
});

test('bridge JSON preserves finite floats and omits optional object fields without changing package signatures', () => {
  assert.deepEqual(JSON.parse(bridgeJson({ optional: undefined, defaults: { temperature: 0.7 }, count: 1 })), { count: 1, defaults: { temperature: 0.7 } });
  assert.throws(() => canonicalJson({ defaults: { temperature: 0.7 } }), { message: 'invalid_package_json' });
  assert.throws(() => bridgeJson({ temperature: Number.NaN }), { message: 'invalid_bridge_json' });
  assert.throws(() => bridgeJson({ temperature: Infinity }), { message: 'invalid_bridge_json' });
  assert.throws(() => bridgeJson({ value: () => 1 }), { message: 'invalid_bridge_json' });
  assert.throws(() => bridgeJson([undefined]), { message: 'invalid_bridge_json' });
  const cycle = {}; cycle.self = cycle;
  assert.throws(() => bridgeJson(cycle), { message: 'invalid_bridge_json' });
  assert.throws(() => bridgeJson({ result: 'x'.repeat(120) }, { maxBytes: 64 }), { message: 'bridge_json_too_large' });
});

test('protected official package rejects uninstall without removing pointer', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-packages-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const { privateKey, publicKey } = generateKeyPairSync('ed25519'); const repository = new InMemoryPackageRepository();
  const service = new PackageService({ repository, store: new DiskPackageStore(dir), trustRoots: new Map([['developer-1', { publicKey, source: 'official' }]]) });
  const app = manifest('1.0.0', { trustLevel: 'system', uninstallPolicy: 'protected-preinstall' }); const subjectId = randomUUID();
  service.trustRoots.get('developer-1').allowedTrustLevels = ['system']; service.trustRoots.get('developer-1').allowProtectedPreinstall = true;
  await service.submit(fixture(app, privateKey)); await service.install({ subjectId, appId: app.appId, version: app.version, build: app.build, releaseChannel: 'stable' });
  await assert.rejects(service.uninstall({ subjectId, appId: app.appId, baseVersion: 1 }), { message: 'app_uninstall_forbidden' });
  assert.equal((await service.health({ subjectId, appId: app.appId })).integrityHealthy, true);
});

test('update switches real bytes and registration failure remains recoverable', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-packages-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const { privateKey, publicKey } = generateKeyPairSync('ed25519'); const repository = new InMemoryPackageRepository(); const store = new DiskPackageStore(dir);
  let failRegistration = false;
  const service = new PackageService({ repository, store, trustRoots: new Map([['developer-1', { publicKey, source: 'official' }]]), onActionsChanged: async ({ manifest: app }) => { if (failRegistration && app.version === '1.0.2') throw new Error('registration_failed'); } });
  const subjectId = randomUUID(); const app1 = manifest(); const app2 = manifest('1.0.1'); const app3 = manifest('1.0.2', { build: 3 });
  for (const app of [app1, app2, app3]) await service.submit(fixture(app, privateKey, { 'index.html': `<html>${app.version}</html>` }));
  const one = await service.install({ subjectId, appId: app1.appId, version: app1.version, build: app1.build, releaseChannel: 'stable' });
  const two = await service.install({ subjectId, appId: app2.appId, version: app2.version, build: app2.build, releaseChannel: 'stable', baseVersion: 1 });
  assert.equal(two.versionNumber, 2); assert.notEqual(one.digest, two.digest);
  assert.equal((await store.resource(subjectId, app1.appId, 'index.html')).toString(), '<html>1.0.1</html>');
  failRegistration = true;
  const three = await service.install({ subjectId, appId: app3.appId, version: app3.version, build: app3.build, releaseChannel: 'stable', baseVersion: 2 });
  assert.equal((await store.current(subjectId, app1.appId)).digest, three.digest);
  assert.equal((await repository.getDeployment(subjectId, app1.appId)).actionsSynced, false);
  failRegistration = false; await service.recover({ subjectId, appId: app1.appId });
  assert.equal((await repository.getDeployment(subjectId, app1.appId)).actionsSynced, true);
});

test('launch and resources require active deployment and verified bytes', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-packages-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const repository = new InMemoryPackageRepository(); const store = new DiskPackageStore(dir);
  const service = new PackageService({ repository, store, trustRoots: new Map([['developer-1', { publicKey, source: 'official' }]]) });
  const app = manifest(); const subjectId = randomUUID(); const other = randomUUID();
  await service.submit(fixture(app, privateKey));
  await assert.rejects(service.resource({ subjectId: other, appId: app.appId, path: 'index.html' }), { message: 'app_not_installed' });
  const installed = await service.install({ subjectId, appId: app.appId, version: app.version, build: app.build, releaseChannel: app.releaseChannel });
  const launch = await service.launch({ subjectId, sessionId: 'session-1', appId: app.appId });
  assert.match(launch.entrypoint, /\/resources\/index\.html\?launchTicket=/);
  assert.match((await service.resource({ subjectId, appId: app.appId, path: 'index.html' })).toString(), /<html>/);
  await assert.rejects(service.resource({ subjectId, appId: app.appId, path: '../private' }), { message: 'invalid_package_path' });
  await service.uninstall({ subjectId, appId: app.appId, baseVersion: installed.versionNumber });
  await assert.rejects(service.resource({ subjectId, appId: app.appId, path: 'index.html' }), { message: 'app_not_installed' });
});

test('bundled first-party install needs an operator official root', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-packages-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const service = new PackageService({ repository: new InMemoryPackageRepository(), store: new DiskPackageStore(dir), trustRoots: new Map([['developer-1', { publicKey, source: 'developer' }]]) });
  await assert.rejects(service.installBundled({ envelope: fixture(manifest(), privateKey), subjectId: randomUUID() }), { message: 'untrusted_package' });
});

test('declared JSON data migration upgrades and rolls back on failed commit', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-migration-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const { privateKey, publicKey } = generateKeyPairSync('ed25519'); const repository = new InMemoryPackageRepository(); const store = new DiskPackageStore(dir);
  const service = new PackageService({ repository, store, trustRoots: new Map([['developer-1', { publicKey, source: 'official' }]]) });
  const subjectId = randomUUID(); const oldApp = manifest();
  const nextApp = manifest('1.0.1', { dataVersion: 2, dataMigration: { from: [1], entry: 'migrations/2.json' } });
  await service.submit(fixture(oldApp, privateKey));
  const old = await service.install({ subjectId, appId: oldApp.appId, version: oldApp.version, build: oldApp.build, releaseChannel: 'stable' });
  await store.writeData(subjectId, oldApp.appId, { prompt: 'retain me' });
  await service.submit(fixture(nextApp, privateKey, { 'index.html': '<html>new</html>', 'migrations/2.json': JSON.stringify({ moves: [{ from: 'prompt', to: 'last_prompt' }] }) }));
  const next = await service.install({ subjectId, appId: oldApp.appId, version: nextApp.version, build: nextApp.build, releaseChannel: 'stable', baseVersion: old.versionNumber });
  assert.deepEqual(await store.readData(subjectId, oldApp.appId), { last_prompt: 'retain me' });
  assert.equal(repository.migrations.size, 1);
  assert.equal([...repository.migrations.values()][0].state, 'committed');
  const failedApp = manifest('1.0.2', { build: 3, dataVersion: 3, dataMigration: { from: [2], entry: 'migrations/3.json' } });
  await service.submit(fixture(failedApp, privateKey, { 'index.html': '<html>bad</html>', 'migrations/3.json': JSON.stringify({ moves: [{ from: 'last_prompt', to: 'history' }] }) }));
  const save = repository.saveDeployment.bind(repository);
  repository.saveDeployment = async () => { throw new Error('db_commit_failed'); };
  await assert.rejects(service.install({ subjectId, appId: oldApp.appId, version: failedApp.version, build: failedApp.build, releaseChannel: 'stable', baseVersion: next.versionNumber }), { message: 'db_commit_failed' });
  repository.saveDeployment = save;
  assert.deepEqual(await store.readData(subjectId, oldApp.appId), { last_prompt: 'retain me' });
  assert.equal((await store.current(subjectId, oldApp.appId)).digest, next.digest);
  assert.equal([...repository.migrations.values()].at(-1).state, 'rolled_back');
});

test('bridge binds launch instance and current package capability', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-bridge-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const { privateKey, publicKey } = generateKeyPairSync('ed25519'); const repository = new InMemoryPackageRepository();
  const calls = [];
  const service = new PackageService({ repository, store: new DiskPackageStore(dir), trustRoots: new Map([['developer-1', { publicKey, source: 'official' }]]), bridgeAuthorize: async ({ subjectId, capability }) => subjectId === owner && capability === 'dgos.aiTask.submit', bridgeHandlers: { 'dgos.aiTask.submit': async (request) => { calls.push(request); return { taskId: 'fixture-task' }; } } });
  const app = manifest('1.0.0', { permissions: ['dgos.aiTask.submit'], capabilityAllowlist: ['dgos.aiTask.submit'] }); const owner = randomUUID();
  await service.submit(fixture(app, privateKey)); await service.install({ subjectId: owner, appId: app.appId, version: app.version, build: app.build, releaseChannel: 'stable' });
  const launch = await service.launch({ subjectId: owner, sessionId: 'session-1', appId: app.appId });
  const requestId = randomUUID();
  const call = { subjectId: owner, sessionId: 'session-1', appId: app.appId, instanceId: launch.instanceId, requestId, capability: 'dgos.aiTask.submit', input: { prompt: 'hi' } };
  assert.deepEqual(await service.bridge(call), { taskId: 'fixture-task' });
  assert.deepEqual(await service.bridge(call), { taskId: 'fixture-task' });
  assert.equal(calls.length, 1);
  await assert.rejects(service.bridge({ ...call, input: { prompt: 'changed' } }), { message: 'version_conflict' });
  assert.equal(calls.length, 1);
  await assert.rejects(service.bridge({ ...call, subjectId: randomUUID() }), { message: 'permission_denied' });
  await assert.rejects(service.bridge({ ...call, sessionId: 'session-2' }), { message: 'permission_denied' });
  await assert.rejects(service.bridge({ ...call, capability: 'dgos.system.settings.write' }), { message: 'permission_denied' });
});

test('deployment projection is subject scoped and supplies update baseVersion', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-install-list-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const service = new PackageService({ repository: new InMemoryPackageRepository(), store: new DiskPackageStore(dir), trustRoots: new Map([['developer-1', { publicKey, source: 'official' }]]) });
  const app = manifest(); const owner = randomUUID(); const other = randomUUID();
  await service.submit(fixture(app, privateKey));
  const installed = await service.install({ subjectId: owner, appId: app.appId, version: app.version, build: app.build, releaseChannel: app.releaseChannel });
  await assert.rejects(service.getAppDeployment(other, app.appId), { message: 'app_not_installed', statusCode: 404 });
  const item = await service.getAppDeployment(owner, app.appId);
  assert.equal(item.versionNumber, installed.versionNumber);
  assert.equal(item.state, 'active');
  assert.equal(item.appId, app.appId);
  assert.equal(Object.hasOwn(item, 'subjectId'), false);
  assert.deepEqual(item.activeRelease, { version: app.version, build: app.build, releaseChannel: app.releaseChannel, digest: installed.digest, dataVersion: app.dataVersion });
  await service.uninstall({ subjectId: owner, appId: app.appId, baseVersion: item.versionNumber });
  const removed = await service.getAppDeployment(owner, app.appId);
  assert.equal(removed.state, 'uninstalled');
  assert.equal(removed.activeRelease, null);
  assert.equal(removed.versionNumber, 2);
});

test('migration rejects repeated, chained and self moves before writing data', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-moves-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const repository = new InMemoryPackageRepository(); const store = new DiskPackageStore(dir);
  const service = new PackageService({ repository, store, trustRoots: new Map([['developer-1', { publicKey, source: 'official' }]]) });
  const subjectId = randomUUID(); const first = manifest();
  await service.submit(fixture(first, privateKey));
  const installed = await service.install({ subjectId, appId: first.appId, version: first.version, build: first.build, releaseChannel: 'stable' });
  await store.writeData(subjectId, first.appId, { a: 1, b: 2 });
  for (const [index, moves] of [
    [{ from: 'a', to: 'c' }, { from: 'a', to: 'd' }],
    [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }],
    [{ from: 'a', to: 'a' }],
    [{ from: 'a', to: 'c' }, { from: 'b', to: 'c' }],
  ].entries()) {
    const app = manifest(`1.0.${index + 1}`, { build: index + 2, dataVersion: 2, dataMigration: { from: [1], entry: 'migrations/2.json' } });
    await service.submit(fixture(app, privateKey, { 'index.html': '<html>new</html>', 'migrations/2.json': JSON.stringify({ moves }) }));
    await assert.rejects(service.install({ subjectId, appId: app.appId, version: app.version, build: app.build, releaseChannel: 'stable', baseVersion: installed.versionNumber }), { message: 'data_migration_invalid' });
    assert.deepEqual(await store.readData(subjectId, app.appId), { a: 1, b: 2 });
    assert.equal((await store.current(subjectId, app.appId)).digest, installed.digest);
  }
  assert.equal(repository.migrations.size, 0);
});

test('recovery does not commit migration for a different package with matching dataVersion', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-migration-digest-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const repository = new InMemoryPackageRepository(); const store = new DiskPackageStore(dir);
  const service = new PackageService({ repository, store, trustRoots: new Map([['developer-1', { publicKey, source: 'official' }]]) });
  const subjectId = randomUUID(); const old = manifest();
  const other = manifest('1.0.1', { dataVersion: 2 });
  const target = manifest('1.0.2', { build: 3, dataVersion: 2 });
  const oldRelease = await service.submit(fixture(old, privateKey));
  const otherRelease = await service.submit(fixture(other, privateKey));
  const targetRelease = await service.submit(fixture(target, privateKey));
  await service.install({ subjectId, appId: old.appId, version: old.version, build: old.build, releaseChannel: 'stable' });
  const current = await repository.getDeployment(subjectId, old.appId);
  await repository.saveDeployment({ subjectId, appId: old.appId, release: otherRelease, expectedVersion: current.versionNumber, previousDigest: oldRelease.digest, state: 'active' });
  await store.switch(subjectId, old.appId, { manifest: other, digest: otherRelease.digest });
  const before = { prompt: 'keep' }; const after = { last_prompt: 'keep' };
  await store.writeData(subjectId, old.appId, after);
  const migrationId = randomUUID(); const backup = `${store.dataFor(subjectId, old.appId)}.backup-${migrationId}`;
  await writeFile(backup, canonicalJson(before), { mode: 0o600 });
  await repository.recordMigration({ migrationId, subjectId, appId: old.appId, fromVersion: 1, toVersion: 2, sourcePackageDigest: oldRelease.digest, targetPackageDigest: targetRelease.digest, beforeDigest: hash(canonicalJson(before)), afterDigest: hash(canonicalJson(after)) });
  await service.recover({ subjectId, appId: old.appId });
  assert.equal(repository.migrations.get(migrationId).state, 'rolled_back');
  assert.deepEqual(await store.readData(subjectId, old.appId), before);
  assert.equal((await store.current(subjectId, old.appId)).digest, otherRelease.digest);
});
