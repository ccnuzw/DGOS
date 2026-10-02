import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { SystemService } from '../../src/system/service.mjs';
import { PostgresSystemRepository } from '../../src/system/repository.mjs';
import { createNetworkRouteFactory } from '../../src/security/network-route.mjs';
import { InMemorySecretService } from '../../src/security/secret-service.mjs';

const database = process.env.DGOS_DATABASE_URL;
const isolated = (() => { try { return /^(?:dgos_v1_network_[0-9a-f]+|dgos_v1_verify_[0-9a-f]{32})$/.test(new URL(database).pathname.slice(1)); } catch { return false; } })();

test('network activation requires all live API and Worker acknowledgements for one target', { skip: !isolated && 'isolated network database required' }, async () => {
  const pool = new pg.Pool({ connectionString: database });
  const scopeId = randomUUID();
  const repository = new PostgresSystemRepository(pool);
  const first = new SystemService({ repository, scopeId });
  const second = new SystemService({ repository: new PostgresSystemRepository(pool), scopeId });
  const secret = new InMemorySecretService();
  const egress = { async validateTarget(url) { return new URL(url); }, async request() { return { ok: true }; }, async resolveTarget(url) { return { url: new URL(url), addresses: ['127.0.0.1'] }; } };
  const route = () => createNetworkRouteFactory({ egress, secretService: secret });
  const api = route(); const workerOld = route(); const workerNew = route();
  const apiId = randomUUID(); const oldId = randomUUID(); const newId = randomUUID();
  try {
    await Promise.all([first.ready, second.ready]);
    assert.equal((await first.snapshot()).settings.network.restartRequired, true);
    await first.activateNetworkRoute(api, { role: 'api', instanceId: apiId });
    assert.equal((await second.snapshot()).settings.network.effectiveRoute, 'unavailable');
    await second.activateNetworkRoute(workerOld, { role: 'worker', instanceId: oldId });
    assert.equal((await first.snapshot()).settings.network.effectiveRoute, 'direct');
    assert.equal((await first.snapshot()).settings.network.restartRequired, false);
    const activatedContext = (await first.context()).contextVersion;
    assert.ok((await repository.eventsAfter(scopeId, '1')).some((event) => event.domain === 'network' && event.restartRequired === false));
    await second.renewNetworkRoute(workerOld, { role: 'worker', instanceId: oldId });
    assert.equal((await first.context()).contextVersion, activatedContext);

    const changed = await first.patch({ baseVersion: '1', patch: { domain: 'network', value: { proxyMode: 'off' } }, requestId: randomUUID() });
    assert.equal(changed.settings.network.restartRequired, true);
    assert.equal((await second.snapshot()).settings.network.effectiveRoute, 'unavailable');
    await first.activateNetworkRoute(api, { role: 'api', instanceId: apiId });
    await second.activateNetworkRoute(workerNew, { role: 'worker', instanceId: newId });
    assert.equal((await first.snapshot()).settings.network.restartRequired, true);
    await repository.releaseNetworkActivation(scopeId, oldId);
    const settled = await second.snapshot();
    assert.equal(settled.settings.network.effectiveRoute, 'direct');
    assert.equal(settled.settings.network.restartRequired, false);

    const next = await second.patch({ baseVersion: '2', patch: { domain: 'network', value: { proxyMode: 'system' } }, requestId: randomUUID() });
    assert.equal(next.settings.network.restartRequired, true);
    await repository.recordNetworkActivation(scopeId, { instanceId: oldId, role: 'worker', settingsVersion: '2', effectiveRoute: 'direct', routeFingerprint: api.active().routeFingerprint });
    assert.equal((await first.snapshot()).settings.network.restartRequired, true);
    await first.activateNetworkRoute(api, { role: 'api', instanceId: apiId });
    await second.activateNetworkRoute(workerNew, { role: 'worker', instanceId: newId });
    assert.equal((await first.snapshot()).settings.network.restartRequired, true);
    await repository.releaseNetworkActivation(scopeId, oldId);
    assert.equal((await first.snapshot()).settings.network.restartRequired, false);
    await repository.recordNetworkActivation(scopeId, { instanceId: oldId, role: 'worker', settingsVersion: '3', effectiveRoute: 'direct', routeFingerprint: '0'.repeat(64) });
    assert.equal((await first.snapshot()).settings.network.restartRequired, true);
  } finally {
    await pool.query('DELETE FROM network_route_instances WHERE scope_id=$1', [scopeId]);
    await pool.query('DELETE FROM network_route_targets WHERE scope_id=$1', [scopeId]);
    await pool.query('DELETE FROM system_setting_events WHERE scope_id=$1', [scopeId]);
    await pool.query('DELETE FROM system_settings WHERE scope_id=$1', [scopeId]);
    await pool.end();
  }
});
