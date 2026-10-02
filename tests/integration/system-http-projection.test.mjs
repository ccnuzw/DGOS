import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Fastify from '../../apps/api/node_modules/fastify/fastify.js';
import { registerSystemRoutes } from '../../apps/api/src/system-routes.mjs';
import { SystemService } from '../../src/system/service.mjs';
import { InMemorySystemRepository } from '../../src/system/repository.mjs';
import { PostgresSystemRepository } from '../../src/system/repository.mjs';
import { requireFreshAdminSession } from '../../apps/api/src/governance-auth.mjs';

const freshFixture = (subjectId) => {
  const sessionId = randomUUID();
  const session = { sessionId, principalId: subjectId, state: 'active', authFreshUntil: new Date(Date.now() + 60_000).toISOString() };
  const identity = { getSession: async (id) => id === sessionId ? session : null };
  return { auth: { subjectId, sessionId, authMethod: 'session' }, requireFreshSession: (request, auth) => requireFreshAdminSession(request, auth, { identity }) };
};

test('public System projection initializes, patches one domain, replays, and streams context', async () => {
  const repository = new InMemorySystemRepository(); const audits = [];
  const system = new SystemService({ repository, audit: { record: async (event) => audits.push(event) } });
  const app = Fastify(); const actorId = randomUUID(); const scopes = [];
  const fresh = freshFixture(actorId);
  registerSystemRoutes(app, { system, readAuth: async (_request, scope) => { scopes.push(scope); return fresh.auth; }, writeAuth: async () => fresh.auth, requireFreshSession: fresh.requireFreshSession });
  try {
    const get = async () => app.inject({ method: 'GET', url: '/api/v1/system/settings' });
    const patch = async (payload) => app.inject({ method: 'PATCH', url: '/api/v1/system/settings', payload });
    const initial = (await get()).json();
    assert.equal(initial.appearance.displayScale, 1); assert.equal(initial.locale.projectContentLanguage, 'en-US');
    assert.equal(initial.grid.spacing, 24); assert.equal(initial.network.effectiveRoute, 'unavailable'); assert.equal(initial.network.restartRequired, true); assert.equal(initial.settings, undefined);
    const request = { requestId: randomUUID(), baseVersion: initial.settingsVersion, domain: 'locale', patch: { uiLocale: 'zh-CN' } };
    const changed = await patch(request); assert.equal(changed.statusCode, 200, changed.body);
    assert.equal(changed.json().locale.uiLocale, 'zh-CN'); assert.equal(changed.json().locale.effectiveLocale, 'zh-CN'); assert.equal(changed.json().locale.projectContentLanguage, 'en-US');
    assert.deepEqual((await patch(request)).json(), changed.json()); assert.equal(audits.length, 1);
    assert.equal((await patch({ ...request, patch: { uiLocale: 'en-US' } })).statusCode, 409);
    const stale = await patch({ requestId: randomUUID(), baseVersion: '1', domain: 'grid', patch: { opacity: 0.5 } }); assert.equal(stale.statusCode, 409);
    const invalid = await patch({ requestId: randomUUID(), baseVersion: '2', domain: 'appearance', patch: { displayScale: 3 } }); assert.equal(invalid.statusCode, 422);
    const permission = await patch({ requestId: randomUUID(), baseVersion: '2', domain: 'appPermissions', patch: { rules: [] } }); assert.equal(permission.statusCode, 503);
    const old = await patch({ requestId: randomUUID(), baseVersion: '2', patch: { domain: 'locale', value: { language: 'zh-CN' } } }); assert.equal(old.statusCode, 422);
    const network = await patch({ requestId: randomUUID(), baseVersion: '2', domain: 'network', patch: { proxyMode: 'manual', manualProxyRef: 'secret-ref' } });
    assert.equal(network.statusCode, 200, network.body); assert.equal(network.json().network.effectiveRoute, 'unavailable'); assert.equal(network.json().network.restartRequired, true);
    const context = (await app.inject({ method: 'GET', url: '/api/v1/system/context' })).json();
    assert.equal(context.appId, 'dgos.system'); assert.equal(context.lifecycleState, 'headless'); assert.deepEqual(context.windowState, { kind: 'none' }); assert.equal(context.locale.projectContentLanguage, 'en-US'); assert.equal(context.networkSummary.effectiveRoute, 'unavailable'); assert.equal(context.settings, undefined);
    const events = await app.inject({ method: 'GET', url: '/api/v1/system/context/events', headers: { 'last-event-id': '1' } });
    assert.match(events.headers['content-type'], /text\/event-stream/); assert.match(events.body, /id: 2/); assert.match(events.body, /id: 3/);
    assert.doesNotMatch(events.body, /secret-ref/);
    assert.ok(scopes.includes('dgos.system.context.read'));
    assert.ok(scopes.includes('dgos.system.context.events'));
  } finally { await app.close(); }
});

test('System legacy JSON projection omits unregistered fields and proxy credentials', async () => {
  const repository = new InMemorySystemRepository();
  repository.settings = { settingsVersion: '7', contextVersion: '9', settings: { appearance: { mode: 'dark', secretToken: 'hidden' }, locale: { language: 'zh-CN', privatePath: '/home/private' }, network: { proxyMode: 'manual', proxyUrl: 'http://user:pass@proxy.test', token: 'hidden' }, grid: { enabled: true, privatePath: '/home/private' } } };
  const system = new SystemService({ repository, audit: { record: async () => {} } }); const app = Fastify();
  registerSystemRoutes(app, { system, readAuth: async () => ({ subjectId: 'owner' }), writeAuth: async () => ({ subjectId: 'owner' }) });
  try {
    const settings = await app.inject({ method: 'GET', url: '/api/v1/system/settings' });
    assert.equal(settings.statusCode, 200); assert.equal(settings.json().appearance.appearanceMode, 'dark'); assert.equal(settings.json().network.effectiveRoute, 'unavailable'); assert.equal(settings.json().network.restartRequired, true);
    assert.doesNotMatch(settings.body, /hidden|privatePath|user:pass|proxyUrl/);
    const context = await app.inject({ method: 'GET', url: '/api/v1/system/context' }); assert.doesNotMatch(context.body, /hidden|privatePath|user:pass|proxyUrl/);
  } finally { await app.close(); }
});

test('System HTTP context permission failure returns no snapshot or events', async () => {
  const system = new SystemService({ repository: new InMemorySystemRepository(), audit: { record: async () => {} } });
  const app = Fastify();
  registerSystemRoutes(app, { system, readAuth: async (_request, scope) => { if (scope.startsWith('dgos.system.context.')) throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 }); return { subjectId: 'owner' }; }, writeAuth: async () => ({ subjectId: 'owner' }) });
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/system/context' })).statusCode, 403);
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/system/context/events' })).statusCode, 403);
  } finally { await app.close(); }
});

test('public System projection rejects a failed audit without changing settings', async () => {
  const system = new SystemService({ repository: new InMemorySystemRepository(), audit: { record: async () => { throw new Error('audit_unavailable'); } } });
  const app = Fastify(); registerSystemRoutes(app, { system, readAuth: async () => ({ subjectId: 'owner' }), writeAuth: async () => ({ subjectId: 'owner' }) });
  try {
    const before = (await app.inject({ method: 'GET', url: '/api/v1/system/settings' })).json();
    const failed = await app.inject({ method: 'PATCH', url: '/api/v1/system/settings', payload: { requestId: randomUUID(), baseVersion: '1', domain: 'grid', patch: { opacity: 0.5 } } });
    assert.equal(failed.statusCode, 500);
    const after = (await app.inject({ method: 'GET', url: '/api/v1/system/settings' })).json(); assert.deepEqual(after, before);
  } finally { await app.close(); }
});

test('System appPermissions delegates authenticated rules to a transaction adapter', async () => {
  const actorId = randomUUID(); const repository = new InMemorySystemRepository();
  const system = new SystemService({ repository, audit: { record: async () => {} } });
  const calls = [];
  const permissionRules = {
    list: async ({ subjectId }) => { calls.push(['list', subjectId]); return []; },
    patch: async (input) => { calls.push(['patch', input]); return { snapshot: await input.system.snapshot(), rules: input.rules }; },
  };
  const fresh = freshFixture(actorId);
  const app = Fastify(); registerSystemRoutes(app, { system, permissionRules, readAuth: async () => fresh.auth, writeAuth: async () => fresh.auth, requireFreshSession: fresh.requireFreshSession });
  try {
    const initial = (await app.inject({ method: 'GET', url: '/api/v1/system/settings' })).json(); assert.deepEqual(initial.appPermissions, []);
    const rule = { appId: 'com.example.app', subjectType: 'user', subjectId: actorId, capability: 'files.read', scope: {}, decision: 'deny' };
    const payload = { requestId: randomUUID(), baseVersion: '1', domain: 'appPermissions', patch: { rules: [rule] } };
    const written = await app.inject({ method: 'PATCH', url: '/api/v1/system/settings', payload });
    assert.equal(written.statusCode, 200, written.body); assert.deepEqual(written.json().appPermissions, [rule]);
    assert.equal(calls.at(-1)[1].subjectId, actorId); assert.equal(calls.at(-1)[1].actorId, actorId);
    assert.equal(calls.at(-1)[1].requestId, payload.requestId); assert.equal(calls.at(-1)[1].baseVersion, '1');
    assert.equal((await app.inject({ method: 'PATCH', url: '/api/v1/system/settings', payload: { ...payload, requestId: randomUUID(), patch: { rules: [{ ...rule, subjectId: randomUUID() }] } } })).statusCode, 403);
    assert.equal(calls.filter(([kind]) => kind === 'patch').length, 1);
  } finally { await app.close(); }
});

test('PostgreSQL System HTTP replay across service instances persists one audited change', async (t) => {
  let databaseName;
  try { databaseName = new URL(process.env.DGOS_DATABASE_URL).pathname.slice(1); } catch { /* no dedicated database */ }
  if (!/^(?:dgos_v1_governance|dgos_v1_verify_[0-9a-f]{32})$/.test(databaseName ?? '')) return t.skip('dedicated governance or Verify database required');
  const pg = (await import('../../apps/api/node_modules/pg/lib/index.js')).default;
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL });
  const scopeId = randomUUID(); const actorId = randomUUID(); const requestId = randomUUID();
  const makeApp = () => {
    const system = new SystemService({ repository: new PostgresSystemRepository(pool), scopeId });
    const app = Fastify(); registerSystemRoutes(app, { system, readAuth: async () => ({ subjectId: actorId }), writeAuth: async () => ({ subjectId: actorId }) }); return app;
  };
  const first = makeApp(); const second = makeApp();
  try {
    const payload = { requestId, baseVersion: '1', domain: 'grid', patch: { spacing: 32 } };
    const initial = await first.inject({ method: 'GET', url: '/api/v1/system/settings' }); assert.equal(initial.statusCode, 200);
    const changed = await first.inject({ method: 'PATCH', url: '/api/v1/system/settings', payload }); assert.equal(changed.statusCode, 200, changed.body);
    const replay = await second.inject({ method: 'PATCH', url: '/api/v1/system/settings', payload }); assert.equal(replay.statusCode, 200, replay.body); assert.deepEqual(replay.json(), changed.json());
    const persisted = await pool.query('SELECT settings_version,context_version,settings FROM system_settings WHERE scope_id=$1', [scopeId]); assert.equal(Number(persisted.rows[0].settings_version), 2); assert.equal(Number(persisted.rows[0].context_version), 2); assert.equal(persisted.rows[0].settings.grid.spacing, 32);
    const audit = await pool.query("SELECT count(*)::int AS n FROM audit_events WHERE actor_id=$1 AND action='system.settings.patch'", [actorId]); assert.equal(audit.rows[0].n, 1);
    const outbox = await pool.query("SELECT count(*)::int AS n FROM audit_outbox o JOIN audit_events a USING(event_id) WHERE a.actor_id=$1 AND a.action='system.settings.patch'", [actorId]); assert.equal(outbox.rows[0].n, 1);
  } finally {
    await first.close(); await second.close();
    await pool.query('DELETE FROM audit_outbox WHERE event_id IN (SELECT event_id FROM audit_events WHERE actor_id=$1)', [actorId]);
    await pool.query('DELETE FROM audit_events WHERE actor_id=$1', [actorId]);
    await pool.query('DELETE FROM system_setting_events WHERE scope_id=$1', [scopeId]);
    await pool.query('DELETE FROM system_settings WHERE scope_id=$1', [scopeId]);
    await pool.end();
  }
});
