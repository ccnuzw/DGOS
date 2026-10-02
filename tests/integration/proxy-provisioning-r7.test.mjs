import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import Fastify from '../../apps/api/node_modules/fastify/fastify.js';
import { discoverMigrations, buildMigrationSql } from '../../scripts/migrate.mjs';
import { InMemorySecretService } from '../../src/security/secret-service.mjs';
import { PostgresProxyProvisioning, proxyProvisioningHmacRef } from '../../src/security/proxy-provisioning.mjs';
import { registerProxyProvisioningRoutes } from '../../apps/api/src/proxy-provisioning-routes.mjs';

const database = process.env.DGOS_DATABASE_URL;
const isolated = (() => { try { return /^(?:dgos_v1_network_[0-9a-f]+|dgos_v1_verify_[0-9a-f]{32})$/.test(new URL(database).pathname.slice(1)); } catch { return false; } })();
const fixture = (requestId = randomUUID()) => ({ requestId, displayName: 'Office proxy', endpoint: 'http://127.0.0.1:15181/', username: 'operator', password: 'sensitive-pass' });

test('proxy provisioning commits once, replays across instances, and compensates failures', { skip: !isolated && 'isolated network database required', timeout: 30_000 }, async () => {
  const admin = new pg.Pool({ connectionString: database });
  const name = `dgos_v1_network_${randomBytes(6).toString('hex')}`;
  await admin.query(`CREATE DATABASE ${name}`);
  const childUrl = new URL(database); childUrl.pathname = `/${name}`;
  const poolA = new pg.Pool({ connectionString: childUrl.toString() });
  const poolB = new pg.Pool({ connectionString: childUrl.toString() });
  poolA.on('error', () => {}); poolB.on('error', () => {});
  try {
    const migrations = (await discoverMigrations()).filter(({ version }) => Number(version.slice(0, 4)) <= 48 || version.startsWith('0051-'));
    await poolA.query(buildMigrationSql(migrations));
    const backend = new InMemorySecretService();
    let writes = 0; let revokes = 0; let failRevoke = false;
    const secret = { resolve: (...args) => backend.resolve(...args), inspect: (...args) => backend.inspect(...args), async put(input) { writes++; return backend.put(input); }, async revoke(...args) { revokes++; if (failRevoke) throw Error('offline'); return backend.revoke(...args); } };
    const options = { secretService: secret, allowLocalFixture: true };
    const a = new PostgresProxyProvisioning({ pool: poolA, ...options });
    const b = new PostgresProxyProvisioning({ pool: poolB, ...options });
    await Promise.all([a.initializeKey(), b.initializeKey()]);
    assert.equal((await backend.inspect(proxyProvisioningHmacRef(1))).version, 1);
    writes = 0;
    const actor = randomUUID(); const input = fixture();
    const [first, second] = await Promise.all([a.provision(actor, input), b.provision(actor, input).catch((cause) => cause)]);
    const committed = first instanceof Error ? second : first;
    const racing = first instanceof Error ? first : second;
    assert.equal(committed.status, 'stored');
    assert.equal(committed.credentialStatus, 'configured');
    if (racing instanceof Error) assert.equal(racing.message, 'request_conflict');
    else assert.deepEqual(racing, committed);
    assert.equal(writes, 1);
    assert.deepEqual(await b.provision(actor, input), committed);
    assert.equal(writes, 1);
    await assert.rejects(a.provision(actor, { ...input, password: 'other-pass' }), /version_conflict/);
    await a.assertCommittedRef(committed.manualProxyRef);
    const handle = await backend.resolve({ secretRef: committed.manualProxyRef, purpose: 'network-proxy', subjectId: 'system' });
    assert.deepEqual(JSON.parse(await handle.read()), { url: input.endpoint, authorization: 'Basic ' + Buffer.from(`${input.username}:${input.password}`).toString('base64') });
    const dbDump = JSON.stringify((await poolA.query('SELECT * FROM network_proxy_provisioning')).rows);
    assert.equal(dbDump.includes(input.endpoint), false);
    assert.equal(dbDump.includes(input.password), false);
    assert.equal((await poolA.query("SELECT count(*)::int n FROM audit_events WHERE action='system.network.proxy.provision'")).rows[0].n, 1);
    assert.equal((await poolA.query("SELECT count(*)::int n FROM audit_outbox o JOIN audit_events a USING(event_id) WHERE a.action='system.network.proxy.provision'")).rows[0].n, 1);
    const settings = await poolA.query('SELECT count(*)::int n FROM system_settings');
    assert.equal(settings.rows[0].n, 0);

    await poolA.query("CREATE FUNCTION reject_proxy_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='system.network.proxy.provision' THEN RAISE EXCEPTION 'audit_offline'; END IF; RETURN NEW; END $$");
    await poolA.query('CREATE TRIGGER reject_proxy_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_proxy_audit()');
    const rejected = fixture();
    await assert.rejects(a.provision(actor, rejected), /credential_unavailable/);
    const failedRow = (await poolA.query('SELECT * FROM network_proxy_provisioning WHERE request_id=$1', [rejected.requestId])).rows[0];
    assert.equal(failedRow.state, 'compensated');
    assert.equal((await backend.inspect(failedRow.secret_ref)).credentialState, 'unavailable');
    await assert.rejects(a.assertCommittedRef(failedRow.secret_ref), /credential_unavailable/);
    assert.ok(revokes >= 1);
    await poolA.query('DROP TRIGGER reject_proxy_audit ON audit_events');
    await poolA.query('DROP FUNCTION reject_proxy_audit()');

    failRevoke = true;
    const uncertain = fixture();
    const refusing = { ...secret, async put(value) { writes++; await backend.put(value); throw Error('write outcome unknown'); }, async revoke(...args) { revokes++; if (failRevoke) throw Error('offline'); return backend.revoke(...args); } };
    const c = new PostgresProxyProvisioning({ pool: poolA, secretService: refusing, allowLocalFixture: true });
    await assert.rejects(c.provision(actor, uncertain), /credential_unavailable/);
    const pending = (await poolA.query('SELECT * FROM network_proxy_provisioning WHERE request_id=$1', [uncertain.requestId])).rows[0];
    assert.equal(pending.state, 'compensating');
    await assert.rejects(b.assertCommittedRef(pending.secret_ref), /credential_unavailable/);
    failRevoke = false;
    await b.recover();
    assert.equal((await poolA.query('SELECT state FROM network_proxy_provisioning WHERE request_id=$1', [uncertain.requestId])).rows[0].state, 'compensated');
    assert.equal((await backend.inspect(pending.secret_ref)).credentialState, 'unavailable');
    assert.deepEqual(await b.provision(actor, input), committed);
    assert.equal((await backend.inspect(committed.manualProxyRef)).credentialState, 'available');
    const preparedRef = `proxy_${randomBytes(32).toString('base64url')}`;
    const preparedId = randomUUID();
    await poolA.query(`INSERT INTO network_proxy_provisioning(actor_id,request_id,secret_ref,fingerprint,hmac_version,display_name,credential_status,state,lease_until)
      VALUES($1,$2,$3,$4,1,'Pending','not_required','prepared',now()-interval '1 second')`, [actor, preparedId, preparedRef, 'a'.repeat(64)]);
    await backend.put({ secretRef: preparedRef, purpose: 'network-proxy', subjectId: 'system', value: JSON.stringify({ url: input.endpoint }), ttlMs: 86400000 });
    await assert.rejects(b.assertCommittedRef(preparedRef), /credential_unavailable/);
    await b.recover();
    assert.equal((await backend.inspect(preparedRef)).credentialState, 'unavailable');
    assert.equal((await poolA.query('SELECT state FROM network_proxy_provisioning WHERE request_id=$1', [preparedId])).rows[0].state, 'compensated');
    const invalidInputs = [
      { password: undefined },
      { endpoint: 'http://127.0.0.1:15181/path' },
      { endpoint: 'http://127.0.0.1:15181/?token=1' },
      { endpoint: 'http://user:pass@127.0.0.1:15181/' },
      { endpoint: 'http://127.0.0.1:15181/%2e' },
      { displayName: 'https://proxy.example' },
      { username: 'bad:name' },
      { unknown: true },
    ];
    for (const change of invalidInputs) await assert.rejects(a.provision(actor, { ...fixture(), ...change }), (cause) => cause.statusCode === 422, JSON.stringify(change));
    const production = new PostgresProxyProvisioning({ pool: poolB, secretService: secret, lookup: async () => [{ address: '127.0.0.1' }] });
    await assert.rejects(production.provision(actor, fixture()), (cause) => cause.statusCode === 422);
  } finally {
    await Promise.all([poolA.end(), poolB.end()]);
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  }
});

test('proxy route requires session, CSRF-scoped write and fresh admin before provisioning', async () => {
  const app = Fastify({ logger: false });
  let writes = 0;
  const backend = new InMemorySecretService();
  const pool = { connect() { throw Error('should not write'); } };
  const registered = registerProxyProvisioningRoutes(app, { pool, secretService: backend, trustedTransport: async () => true, writeAuth: async (request, scope) => {
    assert.equal(scope, 'system.settings.write');
    if (request.headers['x-dgos-csrf'] !== 'ok') throw Object.assign(Error('csrf_failed'), { statusCode: 403 });
    if (request.headers.authorization === 'ApiKey test') return { authMethod: 'api_key', subjectId: randomUUID() };
    if (request.headers.authorization !== 'Session test') throw Object.assign(Error('authentication_required'), { statusCode: 401 });
    return { authMethod: 'session', subjectId: randomUUID() };
  }, requireFreshSession: async (request) => { if (request.headers['x-fresh'] !== 'yes') throw Object.assign(Error('step_up_required'), { statusCode: 403 }); writes++; } });
  await assert.rejects(registered.ready, /should not write/);
  try {
    const send = (headers) => app.inject({ method: 'POST', url: '/api/v1/system/network/proxy-configurations', payload: fixture(), headers });
    assert.equal((await send({})).statusCode, 403);
    assert.equal((await send({})).headers['cache-control'], 'no-store');
    assert.equal((await send({ 'x-dgos-csrf': 'ok' })).statusCode, 401);
    assert.equal((await send({ 'x-dgos-csrf': 'ok', authorization: 'ApiKey test' })).statusCode, 403);
    assert.equal((await send({ 'x-dgos-csrf': 'ok', authorization: 'Session test' })).statusCode, 403);
    assert.equal(writes, 0);
  } finally { await app.close(); }
});

test('proxy route rejects untrusted transport before authentication or Secret access', async () => {
  const app = Fastify({ logger: false });
  let called = false;
  const registration = registerProxyProvisioningRoutes(app, { pool: { connect() { throw Error('offline'); } }, secretService: new InMemorySecretService(), trustedTransport: async () => false, writeAuth: async () => { called = true; }, requireFreshSession: async () => {} });
  await assert.rejects(registration.ready, /offline/);
  try {
    const response = await app.inject({ method: 'POST', url: '/api/v1/system/network/proxy-configurations', payload: fixture(), headers: { 'x-native-transport': 'trusted', 'x-dgos-csrf': 'ok' } });
    assert.equal(response.statusCode, 403);
    assert.equal(called, false);
  } finally { await app.close(); }
});
