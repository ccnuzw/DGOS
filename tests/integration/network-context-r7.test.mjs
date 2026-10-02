import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { discoverMigrations, buildMigrationSql } from '../../scripts/migrate.mjs';
import { PostgresSystemRepository, InMemorySystemRepository } from '../../src/system/repository.mjs';
import { SystemService } from '../../src/system/service.mjs';

const database = process.env.DGOS_DATABASE_URL;
const isolated = (() => { try { return /^(?:dgos_v1_network_[0-9a-f]+|dgos_v1_verify_[0-9a-f]{32})$/.test(new URL(database).pathname.slice(1)); } catch { return false; } })();
const baseSettings = { network: { proxyMode: 'off', effectiveRoute: 'unavailable', restartRequired: true, affectedServices: [] } };
const acknowledgement = (instanceId, role) => ({ instanceId, role, settingsVersion: '1', effectiveRoute: 'direct', routeFingerprint: 'a'.repeat(64), leaseMs: 30_000 });

test('passive expiry and recovery emit one context event and audit under concurrent API reads', { skip: !isolated && 'isolated network database required', timeout: 30_000 }, async () => {
  const admin = new pg.Pool({ connectionString: database });
  const name = `dgos_v1_network_${randomBytes(6).toString('hex')}`;
  await admin.query(`CREATE DATABASE ${name}`);
  const childUrl = new URL(database); childUrl.pathname = `/${name}`;
  const poolA = new pg.Pool({ connectionString: childUrl.toString() });
  const poolB = new pg.Pool({ connectionString: childUrl.toString() });
  try {
    const migrations = (await discoverMigrations()).filter(({ version }) => Number(version.slice(0, 4)) <= 48);
    await poolA.query(buildMigrationSql(migrations));
    const scopeId = randomUUID();
    const apiId = randomUUID(); const workerId = randomUUID();
    const a = new PostgresSystemRepository(poolA);
    const b = new PostgresSystemRepository(poolB);
    const serviceA = new SystemService({ repository: a, scopeId });
    const serviceB = new SystemService({ repository: b, scopeId });
    await Promise.all([serviceA.ready, serviceB.ready]);
    await a.recordNetworkActivation(scopeId, acknowledgement(apiId, 'api'));
    await b.recordNetworkActivation(scopeId, acknowledgement(workerId, 'worker'));
    const active = await serviceA.context();
    assert.equal(active.settings.network.effectiveRoute, 'direct');
    const eventCount = async () => (await poolA.query("SELECT count(*)::int AS n FROM system_setting_events WHERE scope_id=$1 AND domain='network'", [scopeId])).rows[0].n;
    const auditCount = async () => (await poolA.query("SELECT count(*)::int AS n FROM audit_events WHERE action='system.network.route.transition' AND summary->>'effectiveRoute' IS NOT NULL")).rows[0].n;
    const outboxCount = async () => (await poolA.query("SELECT count(*)::int AS n FROM audit_outbox o JOIN audit_events a USING(event_id) WHERE a.action='system.network.route.transition'")).rows[0].n;
    assert.equal(await eventCount(), 1);
    assert.equal(await auditCount(), 1);

    await b.recordNetworkActivation(scopeId, acknowledgement(workerId, 'worker'));
    assert.equal((await serviceA.context()).contextVersion, active.contextVersion);
    assert.equal(await eventCount(), 1);

    await poolA.query('UPDATE network_route_instances SET lease_until=now()-interval \'1 second\' WHERE scope_id=$1', [scopeId]);
    const [expired, replay] = await Promise.all([serviceA.context(), b.eventsAfter(scopeId, active.contextVersion)]);
    assert.equal(expired.settings.network.effectiveRoute, 'unavailable');
    assert.equal(expired.settings.network.restartRequired, true);
    assert.equal(replay.length, 1);
    assert.equal(replay[0].contextVersion, expired.contextVersion);
    assert.equal(replay[0].restartRequired, true);
    assert.equal(await eventCount(), 2);
    assert.equal(await auditCount(), 2);
    assert.equal(await outboxCount(), 2);
    assert.deepEqual(await a.eventsAfter(scopeId, expired.contextVersion), []);
    assert.equal((await serviceB.context()).contextVersion, expired.contextVersion);

    await Promise.all([a.recordNetworkActivation(scopeId, acknowledgement(apiId, 'api')), b.recordNetworkActivation(scopeId, acknowledgement(workerId, 'worker'))]);
    const restored = await serviceB.context();
    assert.equal(restored.settings.network.effectiveRoute, 'direct');
    assert.equal(restored.settings.network.restartRequired, false);
    assert.equal((await a.eventsAfter(scopeId, expired.contextVersion)).length, 1);
    assert.equal(await eventCount(), 3);
    assert.equal(await auditCount(), 3);
    await a.recordNetworkActivation(scopeId, acknowledgement(apiId, 'api'));
    assert.equal((await serviceA.context()).contextVersion, restored.contextVersion);
    assert.equal(await eventCount(), 3);
    await poolA.query('UPDATE network_route_instances SET lease_until=now()-interval \'1 second\' WHERE scope_id=$1', [scopeId]);
    a.recordAudit = async () => { throw new Error('audit_unavailable'); };
    await assert.rejects(a.eventsAfter(scopeId, restored.contextVersion), /audit_unavailable/);
    assert.equal(await eventCount(), 3);
    assert.equal(await outboxCount(), 3);
    assert.equal(String((await poolA.query('SELECT context_version FROM system_settings WHERE scope_id=$1', [scopeId])).rows[0].context_version), restored.contextVersion);
    a.recordAudit = PostgresSystemRepository.prototype.recordAudit;
    assert.equal((await a.eventsAfter(scopeId, restored.contextVersion)).length, 1);
    assert.equal(await eventCount(), 4);
    assert.equal(await outboxCount(), 4);
  } finally {
    await Promise.all([poolA.end(), poolB.end()]);
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  }
});

test('in-memory repository reconciles expiry and recovery without duplicate events', async () => {
  const repository = new InMemorySystemRepository();
  await repository.ensure('unused', baseSettings);
  const apiId = randomUUID(); const workerId = randomUUID();
  await repository.recordNetworkActivation('unused', acknowledgement(apiId, 'api'));
  await repository.recordNetworkActivation('unused', acknowledgement(workerId, 'worker'));
  const active = await repository.load();
  assert.equal(active.settings.network.effectiveRoute, 'direct');
  repository.networkInstances.get(workerId).leaseUntil = 0;
  const expired = await repository.load();
  assert.equal(expired.settings.network.effectiveRoute, 'unavailable');
  assert.equal((await repository.eventsAfter('unused', active.contextVersion)).length, 1);
  await repository.load();
  assert.equal((await repository.eventsAfter('unused', active.contextVersion)).length, 1);
  await repository.recordNetworkActivation('unused', acknowledgement(workerId, 'worker'));
  assert.equal((await repository.load()).settings.network.effectiveRoute, 'direct');
  assert.equal((await repository.eventsAfter('unused', active.contextVersion)).length, 2);
});
