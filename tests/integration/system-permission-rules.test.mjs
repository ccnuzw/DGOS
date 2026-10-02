import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from '../../apps/api/node_modules/fastify/fastify.js';
import pg from '../../apps/api/node_modules/pg/esm/index.mjs';
import { registerSystemRoutes } from '../../apps/api/src/system-routes.mjs';
import { InMemoryPermissionRepository } from '../../src/permissions/repository.mjs';
import { PostgresPermissionRepository } from '../../src/permissions/postgres-repository.mjs';
import { InMemorySystemRepository, PostgresSystemRepository } from '../../src/system/repository.mjs';
import { SystemService } from '../../src/system/service.mjs';
import { createSystemPermissionRules } from '../../src/system/permission-rules.mjs';
import { InMemoryAuditRepository } from '../../src/audit/outbox.mjs';
import { InMemoryIdentityRepository } from '../../src/identity/repository.mjs';
import { DiskPackageStore } from '../../src/apps/package-service.mjs';
import { buildServer } from '../../apps/api/src/server.mjs';
import { requireFreshAdminSession } from '../../apps/api/src/governance-auth.mjs';
import { createTrustedBuiltinPermissionBroker } from '../../src/permissions/broker.mjs';

const rule = (subjectId, decision = 'ask') => ({ appId: 'dgos.system', subjectType: 'user', subjectId, capability: 'system.settings.read', scope: { value: '*' }, decision });
const makeApp = ({ system, permissionRules, subjectId, scopes = ['system.settings.read','system.settings.write','permission.manage'], freshUntil = () => Date.now() + 60_000 }) => {
  const app = Fastify();
  const sessionId = randomUUID();
  const identity = { getSession: async (id) => id === sessionId ? { sessionId, principalId: subjectId, state: 'active', authFreshUntil: new Date(freshUntil()).toISOString() } : null };
  const check = async (_request, scope) => { if (!scopes.includes(scope)) throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 }); return { subjectId, sessionId, authMethod: 'session' }; };
  registerSystemRoutes(app, { system, permissionRules, readAuth: check, writeAuth: check, requireFreshSession: (request, auth) => requireFreshAdminSession(request, auth, { identity }) });
  return app;
};
const patch = (app, body) => app.inject({ method: 'PATCH', url: '/api/v1/system/settings', payload: body });
const gridPatch = (baseVersion) => ({ requestId: randomUUID(), baseVersion, domain: 'grid', patch: { spacing: 28 } });

test('memory permission settings use authoritative rules and extra manage scope', async () => {
  const subjectId = randomUUID(); const permissions = new InMemoryPermissionRepository(); const settings = new InMemorySystemRepository(); const audit = new InMemoryAuditRepository();
  const system = new SystemService({ repository: settings, audit });
  const permissionRules = createSystemPermissionRules({ permissionRepository: permissions, systemRepository: settings, audit });
  const app = makeApp({ system, permissionRules, subjectId });
  try {
    const before = (await app.inject({ method: 'GET', url: '/api/v1/system/settings' })).json(); assert.deepEqual(before.appPermissions, []);
    const input = { requestId: randomUUID(), baseVersion: '1', domain: 'appPermissions', patch: { rules: [rule(subjectId)] } };
    const written = await patch(app, input); assert.equal(written.statusCode, 200, written.body); assert.equal(written.json().settingsVersion, '2'); assert.deepEqual(written.json().appPermissions, [rule(subjectId)]);
    assert.deepEqual((await patch(app, input)).json(), written.json()); assert.equal(audit.events.size, 2); assert.equal(audit.outbox.size, 2);
    assert.equal((await patch(app, { ...input, requestId: randomUUID(), baseVersion: '1' })).statusCode, 409);
    assert.equal((await patch(app, { ...input, requestId: randomUUID(), baseVersion: '2', patch: { rules: [rule(randomUUID())] } })).statusCode, 403);
    assert.equal((await patch(app, { ...input, requestId: randomUUID(), baseVersion: '2', patch: { rules: [{ ...rule(subjectId), capability: 'unregistered' }] } })).statusCode, 403);
    assert.equal((await permissions.get({ subjectId, appId: 'dgos.system', capability: 'system.settings.read' })).decision, 'ask');
    const noManage = makeApp({ system, permissionRules, subjectId, scopes: ['system.settings.read','system.settings.write'] });
    assert.equal((await patch(noManage, { ...input, requestId: randomUUID(), baseVersion: '2', patch: { rules: [rule(subjectId, 'deny')] } })).statusCode, 403);
    await noManage.close();
  } finally { await app.close(); }
});

test('memory permission receipts stay public and replay after earlier System writes', async () => {
  const subjectId = randomUUID(); const permissions = new InMemoryPermissionRepository(); const settings = new InMemorySystemRepository(); const audit = new InMemoryAuditRepository();
  const system = new SystemService({ repository: settings, audit });
  const permissionRules = createSystemPermissionRules({ permissionRepository: permissions, systemRepository: settings, audit });
  const app = makeApp({ system, permissionRules, subjectId });
  try {
    const grid = await patch(app, gridPatch('1')); assert.equal(grid.statusCode, 200, grid.body);
    const firstInput = { requestId: randomUUID(), baseVersion: '2', domain: 'appPermissions', patch: { rules: [rule(subjectId)] } };
    const first = await patch(app, firstInput); assert.equal(first.statusCode, 200, first.body);
    assert.equal(first.json().settingsVersion, '3');
    assert.equal(Object.hasOwn(first.json(), '_requestReceipts'), false);
    assert.equal(Object.hasOwn(settings.settings.settings._requestReceipts[`${subjectId}:${firstInput.requestId}`].result.settings, '_requestReceipts'), false);
    const secondInput = { ...firstInput, requestId: randomUUID(), baseVersion: '3', patch: { rules: [rule(subjectId, 'deny')] } };
    const second = await patch(app, secondInput); assert.equal(second.statusCode, 200, second.body);
    assert.equal(second.json().settingsVersion, '4');
    assert.deepEqual((await patch(app, firstInput)).json(), first.json());
    assert.deepEqual((await patch(app, secondInput)).json(), second.json());
    assert.equal(audit.events.size, 5); assert.equal(audit.outbox.size, 5);
    const failedInput = { ...firstInput, requestId: randomUUID(), baseVersion: '4', patch: { rules: [rule(subjectId, 'ask')] } };
    const originalRecord = audit.record;
    audit.record = async () => { throw new Error('audit_unavailable'); };
    try { assert.equal((await patch(app, failedInput)).statusCode, 500); }
    finally { audit.record = originalRecord; }
    assert.equal((await system.snapshot()).settingsVersion, '4');
    assert.equal((await permissions.get({ subjectId, appId: 'dgos.system', capability: 'system.settings.read' })).decision, 'deny');
    assert.equal(settings.events.length, 3);
    assert.equal(audit.events.size, 5); assert.equal(audit.outbox.size, 5);
    assert.equal(Object.hasOwn(settings.settings.settings._requestReceipts, `${subjectId}:${failedInput.requestId}`), false);
  } finally { await app.close(); }
});

test('memory System regrant is explicit while stale approval and invalid management leave deny intact', async () => {
  const subjectId = randomUUID(); const permissions = new InMemoryPermissionRepository(); const settings = new InMemorySystemRepository(); const audit = new InMemoryAuditRepository();
  const system = new SystemService({ repository: settings, audit });
  const permissionRules = createSystemPermissionRules({ permissionRepository: permissions, systemRepository: settings, audit });
  const broker = createTrustedBuiltinPermissionBroker({ repository: permissions, audit });
  let freshUntil = Date.now() + 60_000;
  const app = makeApp({ system, permissionRules, subjectId, freshUntil: () => freshUntil });
  const target = { subjectId, appId: 'dgos.extensions', capability: 'skill.read', scope: '*' };
  const update = (decision, baseVersion, requestId = randomUUID()) => ({ requestId, baseVersion, domain: 'appPermissions', patch: { rules: [{ ...rule(subjectId, decision), appId: target.appId, capability: target.capability }] } });
  const writes = () => [...audit.events.values()].filter((event) => ['permission.change', 'system.settings.patch'].includes(event.action)).length;
  try {
    assert.equal((await patch(app, update('ask', '1'))).statusCode, 200);
    const pendingId = randomUUID();
    await broker.request({ ...target, requestId: pendingId });
    assert.equal((await patch(app, update('deny', '2'))).statusCode, 200);
    assert.equal((await broker.check(target)).decision, 'deny');
    await assert.rejects(broker.approveRequest({ requestId: pendingId }), (error) => error.statusCode === 403);
    assert.equal(permissions.getRequest(pendingId).state, 'pending');
    assert.equal(writes(), 4);
    const unchanged = async () => {
      assert.equal((await broker.check(target)).decision, 'deny');
      assert.equal((await system.snapshot()).settingsVersion, '3');
      assert.equal(writes(), 4);
    };
    const regrant = update('allow', '3');
    freshUntil = Date.now() - 1000;
    assert.equal((await patch(app, regrant)).statusCode, 403); await unchanged();
    freshUntil = Date.now() + 60_000;
    const noWrite = makeApp({ system, permissionRules, subjectId, scopes: ['system.settings.read', 'permission.manage'] });
    assert.equal((await patch(noWrite, regrant)).statusCode, 403); await noWrite.close(); await unchanged();
    const noManage = makeApp({ system, permissionRules, subjectId, scopes: ['system.settings.read', 'system.settings.write'] });
    assert.equal((await patch(noManage, regrant)).statusCode, 403); await noManage.close(); await unchanged();
    assert.equal((await patch(app, update('allow', '2'))).statusCode, 409); await unchanged();
    assert.equal((await patch(app, { ...regrant, requestId: randomUUID(), patch: { rules: [{ ...regrant.patch.rules[0], subjectId: randomUUID() }] } })).statusCode, 403); await unchanged();
    assert.equal((await patch(app, { ...regrant, requestId: randomUUID(), patch: { rules: [{ ...regrant.patch.rules[0], capability: 'undeclared' }] } })).statusCode, 403); await unchanged();
    const originalRecord = audit.record;
    audit.record = async () => { throw new Error('audit_unavailable'); };
    try { assert.equal((await patch(app, regrant)).statusCode, 500); }
    finally { audit.record = originalRecord; }
    await unchanged();
    const first = await patch(app, regrant); assert.equal(first.statusCode, 200, first.body);
    assert.equal(first.json().settingsVersion, '4');
    assert.equal((await broker.check(target)).decision, 'allow');
    assert.deepEqual((await patch(app, regrant)).json(), first.json());
    assert.equal(permissions.get(target).decision, 'allow');
    assert.equal(permissions.get(target).policyVersion, '4');
    assert.equal(writes(), 6);
    assert.equal(audit.outbox.size, audit.events.size);
    assert.equal(settings.events.length, 3);
  } finally { await app.close(); }
});

test('PostgreSQL permission receipts survive history and preserve atomic replay', async (t) => {
  let name; try { name = new URL(process.env.DGOS_DATABASE_URL).pathname.slice(1); } catch { /* absent */ }
  if (!/^(?:dgos_v1_governance|dgos_v1_verify_[0-9a-f]{32})$/.test(name ?? '')) return t.skip('dedicated governance or Verify database required');
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL });
  const subjectId = randomUUID(); const scopeId = randomUUID(); const audit = { record: async () => {} };
  const permissions = new PostgresPermissionRepository(pool); const settings = new PostgresSystemRepository(pool);
  const system = new SystemService({ repository: settings, audit, scopeId });
  const permissionRules = createSystemPermissionRules({ permissionRepository: permissions, systemRepository: settings, audit });
  const app = makeApp({ system, permissionRules, subjectId });
  try {
    const grid = await patch(app, gridPatch('1')); assert.equal(grid.statusCode, 200, grid.body);
    const firstInput = { requestId: randomUUID(), baseVersion: '2', domain: 'appPermissions', patch: { rules: [rule(subjectId)] } };
    const first = await patch(app, firstInput); assert.equal(first.statusCode, 200, first.body);
    const secondInput = { ...firstInput, requestId: randomUUID(), baseVersion: '3', patch: { rules: [rule(subjectId, 'deny')] } };
    const second = await patch(app, secondInput); assert.equal(second.statusCode, 200, second.body);
    const stored = (await pool.query('SELECT settings_version,context_version,settings FROM system_settings WHERE scope_id=$1', [scopeId])).rows[0];
    assert.equal(stored.settings_version, '4'); assert.equal(stored.context_version, '4');
    for (const input of [firstInput, secondInput]) assert.equal(Object.hasOwn(stored.settings._requestReceipts[`${subjectId}:${input.requestId}`].result.settings, '_requestReceipts'), false);
    assert.deepEqual((await patch(app, firstInput)).json(), first.json());
    assert.deepEqual((await patch(app, secondInput)).json(), second.json());
    assert.equal((await permissions.listForSubject(subjectId))[0].decision, 'deny');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM system_setting_events WHERE scope_id=$1', [scopeId])).rows[0].n, 3);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM audit_events WHERE actor_id=$1', [subjectId])).rows[0].n, 5);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM audit_outbox o JOIN audit_events a USING(event_id) WHERE a.actor_id=$1', [subjectId])).rows[0].n, 5);
    const failedInput = { ...firstInput, requestId: randomUUID(), baseVersion: '4', patch: { rules: [rule(subjectId, 'ask')] } };
    const originalRecordAudit = permissions.recordAudit;
    permissions.recordAudit = async () => { throw new Error('audit_unavailable'); };
    try { assert.equal((await patch(app, failedInput)).statusCode, 500); }
    finally { permissions.recordAudit = originalRecordAudit; }
    const afterFailure = (await pool.query('SELECT settings_version,context_version,settings FROM system_settings WHERE scope_id=$1', [scopeId])).rows[0];
    assert.equal(afterFailure.settings_version, '4'); assert.equal(afterFailure.context_version, '4');
    assert.equal(Object.hasOwn(afterFailure.settings._requestReceipts, `${subjectId}:${failedInput.requestId}`), false);
    assert.equal((await permissions.listForSubject(subjectId))[0].decision, 'deny');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM system_setting_events WHERE scope_id=$1', [scopeId])).rows[0].n, 3);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM audit_events WHERE actor_id=$1', [subjectId])).rows[0].n, 5);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM audit_outbox o JOIN audit_events a USING(event_id) WHERE a.actor_id=$1', [subjectId])).rows[0].n, 5);
  } finally {
    await app.close();
    await pool.query('DELETE FROM audit_outbox WHERE event_id IN (SELECT event_id FROM audit_events WHERE actor_id=$1)', [subjectId]);
    await pool.query('DELETE FROM audit_events WHERE actor_id=$1', [subjectId]);
    await pool.query('DELETE FROM permission_decisions WHERE subject_id=$1', [subjectId]);
    await pool.query('DELETE FROM system_setting_events WHERE scope_id=$1', [scopeId]);
    await pool.query('DELETE FROM system_settings WHERE scope_id=$1', [scopeId]);
    await pool.end();
  }
});

test('PostgreSQL System regrant preserves stale approval denial and atomic audit', async (t) => {
  let name; try { name = new URL(process.env.DGOS_DATABASE_URL).pathname.slice(1); } catch { /* absent */ }
  if (!/^(?:dgos_v1_governance|dgos_v1_verify_[0-9a-f]{32})$/.test(name ?? '')) return t.skip('dedicated governance or Verify database required');
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL });
  const subjectId = randomUUID(); const scopeId = randomUUID(); const audit = { record: async () => {} };
  const permissions = new PostgresPermissionRepository(pool); const settings = new PostgresSystemRepository(pool);
  const system = new SystemService({ repository: settings, audit, scopeId });
  const permissionRules = createSystemPermissionRules({ permissionRepository: permissions, systemRepository: settings, audit });
  const broker = createTrustedBuiltinPermissionBroker({ repository: permissions });
  let freshUntil = Date.now() + 60_000;
  const app = makeApp({ system, permissionRules, subjectId, freshUntil: () => freshUntil });
  const target = { subjectId, appId: 'dgos.extensions', capability: 'skill.read', scope: '*' };
  const update = (decision, baseVersion, requestId = randomUUID()) => ({ requestId, baseVersion, domain: 'appPermissions', patch: { rules: [{ ...rule(subjectId, decision), appId: target.appId, capability: target.capability }] } });
  const state = async () => {
    const row = (await pool.query('SELECT settings_version,context_version FROM system_settings WHERE scope_id=$1', [scopeId])).rows[0];
    const decision = await permissions.get(target);
    const audits = (await pool.query("SELECT action,count(*)::int AS n FROM audit_events WHERE actor_id=$1 AND action IN ('permission.change','system.settings.patch') GROUP BY action", [subjectId])).rows;
    const outbox = (await pool.query('SELECT count(*)::int AS n FROM audit_outbox o JOIN audit_events a USING(event_id) WHERE a.actor_id=$1', [subjectId])).rows[0].n;
    const events = (await pool.query('SELECT count(*)::int AS n FROM system_setting_events WHERE scope_id=$1', [scopeId])).rows[0].n;
    return { settingsVersion: row.settings_version, contextVersion: row.context_version, decision: decision?.decision, policyVersion: decision?.policyVersion, audits: Object.fromEntries(audits.map((item) => [item.action, item.n])), outbox, events };
  };
  try {
    await system.ready;
    assert.equal((await patch(app, update('ask', '1'))).statusCode, 200);
    const pendingId = randomUUID(); await broker.request({ ...target, requestId: pendingId });
    assert.equal((await patch(app, update('deny', '2'))).statusCode, 200);
    assert.equal((await broker.check(target)).decision, 'deny');
    await assert.rejects(broker.approveRequest({ requestId: pendingId }), (error) => error.statusCode === 403);
    assert.equal((await permissions.getRequest(pendingId)).state, 'pending');
    const deniedState = await state();
    assert.deepEqual(deniedState, { settingsVersion: '3', contextVersion: '3', decision: 'deny', policyVersion: '2', audits: { 'permission.change': 2, 'system.settings.patch': 2 }, outbox: 4, events: 2 });
    const regrant = update('allow', '3');
    freshUntil = Date.now() - 1000;
    assert.equal((await patch(app, regrant)).statusCode, 403);
    freshUntil = Date.now() + 60_000;
    const noWrite = makeApp({ system, permissionRules, subjectId, scopes: ['system.settings.read', 'permission.manage'] });
    assert.equal((await patch(noWrite, regrant)).statusCode, 403); await noWrite.close();
    const noManage = makeApp({ system, permissionRules, subjectId, scopes: ['system.settings.read', 'system.settings.write'] });
    assert.equal((await patch(noManage, regrant)).statusCode, 403); await noManage.close();
    assert.equal((await patch(app, update('allow', '2'))).statusCode, 409);
    assert.equal((await patch(app, { ...regrant, requestId: randomUUID(), patch: { rules: [{ ...regrant.patch.rules[0], subjectId: randomUUID() }] } })).statusCode, 403);
    assert.equal((await patch(app, { ...regrant, requestId: randomUUID(), patch: { rules: [{ ...regrant.patch.rules[0], capability: 'undeclared' }] } })).statusCode, 403);
    assert.deepEqual(await state(), deniedState);
    const originalAudit = permissions.recordAudit;
    permissions.recordAudit = async () => { throw new Error('audit_unavailable'); };
    try { assert.equal((await patch(app, regrant)).statusCode, 500); }
    finally { permissions.recordAudit = originalAudit; }
    assert.deepEqual(await state(), deniedState);
    const granted = await patch(app, regrant); assert.equal(granted.statusCode, 200, granted.body);
    assert.equal(granted.json().settingsVersion, '4');
    assert.equal((await broker.check(target)).decision, 'allow');
    assert.deepEqual((await patch(app, regrant)).json(), granted.json());
    assert.deepEqual(await state(), { settingsVersion: '4', contextVersion: '4', decision: 'allow', policyVersion: '3', audits: { 'permission.change': 3, 'system.settings.patch': 3 }, outbox: 6, events: 3 });
  } finally {
    await app.close();
    await pool.query('DELETE FROM permission_requests WHERE subject_id=$1', [subjectId]);
    await pool.query('DELETE FROM audit_outbox WHERE event_id IN (SELECT event_id FROM audit_events WHERE actor_id=$1)', [subjectId]);
    await pool.query('DELETE FROM audit_events WHERE actor_id=$1', [subjectId]);
    await pool.query('DELETE FROM permission_decisions WHERE subject_id=$1', [subjectId]);
    await pool.query('DELETE FROM system_setting_events WHERE scope_id=$1', [scopeId]);
    await pool.query('DELETE FROM system_settings WHERE scope_id=$1', [scopeId]);
    await pool.end();
  }
});

test('PostgreSQL permission settings batch and System versions commit atomically', async (t) => {
  let name; try { name = new URL(process.env.DGOS_DATABASE_URL).pathname.slice(1); } catch { /* absent */ }
  if (!/^(?:dgos_v1_governance|dgos_v1_verify_[0-9a-f]{32})$/.test(name ?? '')) return t.skip('dedicated governance or Verify database required');
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL });
  const subjectId = randomUUID(); const scopeId = randomUUID(); const audit = { record: async () => {} };
  const permissions = new PostgresPermissionRepository(pool); const settings = new PostgresSystemRepository(pool);
  const system = new SystemService({ repository: settings, audit, scopeId });
  const permissionRules = createSystemPermissionRules({ permissionRepository: permissions, systemRepository: settings, audit });
  const app = makeApp({ system, permissionRules, subjectId });
  try {
    const input = { requestId: randomUUID(), baseVersion: '1', domain: 'appPermissions', patch: { rules: [rule(subjectId), { ...rule(subjectId), capability: 'system.settings.write', decision: 'deny' }] } };
    const first = await patch(app, input); assert.equal(first.statusCode, 200, first.body); assert.equal(first.json().appPermissions.length, 2);
    assert.deepEqual((await patch(app, input)).json(), first.json());
    const row = await pool.query('SELECT settings_version,context_version FROM system_settings WHERE scope_id=$1', [scopeId]); assert.equal(Number(row.rows[0].settings_version), 2); assert.equal(Number(row.rows[0].context_version), 2);
    const rules = await permissions.listForSubject(subjectId); assert.equal(rules.length, 2);
    const auditRows = await pool.query("SELECT action,count(*)::int AS n FROM audit_events WHERE actor_id=$1 AND action IN ('permission.change','system.settings.patch') GROUP BY action", [subjectId]); assert.deepEqual(Object.fromEntries(auditRows.rows.map((item) => [item.action,item.n])), { 'permission.change': 2, 'system.settings.patch': 1 });
    const outbox = await pool.query("SELECT count(*)::int AS n FROM audit_outbox o JOIN audit_events a USING(event_id) WHERE a.actor_id=$1 AND a.action IN ('permission.change','system.settings.patch')", [subjectId]); assert.equal(outbox.rows[0].n, 3);
    await permissions.transaction((client) => permissions.writeDecision(client, { subjectId, appId: 'dgos.system', capability: 'system.navigate', scope: '*', decision: 'ask', requestId: randomUUID() }, { trustedBuiltins: true }));
    const stableReplay = await patch(app, input); assert.equal(stableReplay.statusCode, 200, stableReplay.body); assert.deepEqual(stableReplay.json(), first.json());
    const regrantInput = { ...input, requestId: randomUUID(), baseVersion: '2', patch: { rules: [{ ...rule(subjectId), capability: 'system.settings.write', decision: 'allow' }] } };
    const regranted = await patch(app, regrantInput); assert.equal(regranted.statusCode, 200, regranted.body);
    assert.equal((await permissions.listForSubject(subjectId)).find((item) => item.capability === 'system.settings.write').decision, 'allow');
    assert.equal((await pool.query('SELECT settings_version FROM system_settings WHERE scope_id=$1', [scopeId])).rows[0].settings_version, '3');
    assert.deepEqual((await patch(app, regrantInput)).json(), regranted.json());
    const originalAudit = permissions.recordAudit;
    let attempted = 0;
    permissions.recordAudit = async (...args) => { attempted += 1; if (attempted === 2) throw new Error('audit_unavailable'); return originalAudit.apply(permissions, args); };
    const failedRequestId = randomUUID();
    const failed = await patch(app, { ...input, requestId: failedRequestId, baseVersion: '3', patch: { rules: [{ ...rule(subjectId), capability: 'system.navigate', decision: 'deny' }, { ...rule(subjectId), capability: 'system.settings.read', decision: 'deny' }] } }); assert.equal(failed.statusCode, 500);
    permissions.recordAudit = originalAudit;
    assert.equal((await permissions.listForSubject(subjectId)).length, 3);
    assert.equal((await pool.query('SELECT settings_version FROM system_settings WHERE scope_id=$1', [scopeId])).rows[0].settings_version, '3');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM system_setting_events WHERE scope_id=$1', [scopeId])).rows[0].n, 2);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM audit_events WHERE request_id=$1', [failedRequestId])).rows[0].n, 0);
    const concurrentVersion = '3';
    const outcomes = await Promise.all([
      patch(app, { requestId: randomUUID(), baseVersion: concurrentVersion, domain: 'grid', patch: { spacing: 28 } }),
      patch(app, { ...input, requestId: randomUUID(), baseVersion: concurrentVersion, patch: { rules: [{ ...rule(subjectId), capability: 'system.navigate', decision: 'ask' }] } }),
    ]);
    assert.deepEqual(outcomes.map((item) => item.statusCode).sort(), [200, 409]);
    assert.equal((await pool.query('SELECT settings_version FROM system_settings WHERE scope_id=$1', [scopeId])).rows[0].settings_version, '4');
  } finally {
    await app.close();
    await pool.query('DELETE FROM audit_outbox WHERE event_id IN (SELECT event_id FROM audit_events WHERE actor_id=$1)', [subjectId]);
    await pool.query('DELETE FROM audit_events WHERE actor_id=$1', [subjectId]);
    await pool.query('DELETE FROM permission_decisions WHERE subject_id=$1', [subjectId]);
    await pool.query('DELETE FROM system_setting_events WHERE scope_id=$1', [scopeId]);
    await pool.query('DELETE FROM system_settings WHERE scope_id=$1', [scopeId]);
    await pool.end();
  }
});

test('PostgreSQL permission settings accept a declared installed package at version 10', async (t) => {
  let name; try { name = new URL(process.env.DGOS_DATABASE_URL).pathname.slice(1); } catch { /* absent */ }
  if (!/^(?:dgos_v1_governance|dgos_v1_verify_[0-9a-f]{32})$/.test(name ?? '')) return t.skip('dedicated governance or Verify database required');
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL });
  const subjectId = randomUUID(); const scopeId = randomUUID(); const packageId = randomUUID();
  const manifest = JSON.parse(await readFile(new URL('../../apps/ai-workbench-package/manifest.json', import.meta.url), 'utf8'));
  const digest = `sha256:${'a'.repeat(64)}`;
  const audit = { record: async () => {} };
  const permissions = new PostgresPermissionRepository(pool); const settings = new PostgresSystemRepository(pool);
  const system = new SystemService({ repository: settings, audit, scopeId });
  const permissionRules = createSystemPermissionRules({ permissionRepository: permissions, systemRepository: settings, audit });
  const app = makeApp({ system, permissionRules, subjectId });
  try {
    await system.ready;
    await pool.query('UPDATE system_settings SET settings_version=10 WHERE scope_id=$1', [scopeId]);
    await pool.query("INSERT INTO app_package_releases(package_id,app_id,version,build,release_channel,manifest,package_digest,source,key_id,request_id,effective_trust_level,uninstall_policy,catalog_state) VALUES($1,$2,'1.0.0',1,'stable',$3,$4,'official','r9-fixture',$5,'standard','user-removable','official')", [packageId, manifest.appId, manifest, digest, randomUUID()]);
    await pool.query("INSERT INTO app_package_deployments(subject_id,app_id,package_id,version,build,release_channel,package_digest,state) VALUES($1,$2,$3,'1.0.0',1,'stable',$4,'active')", [subjectId, manifest.appId, packageId, digest]);
    const requestId = randomUUID();
    const input = { requestId, baseVersion: '10', domain: 'appPermissions', patch: { rules: [{ appId: 'dgos.ai-workbench', subjectType: 'user', subjectId, capability: 'dgos.model.list', scope: { value: '*' }, decision: 'allow' }] } };
    const written = await patch(app, input);
    assert.equal(written.statusCode, 200, written.body);
    assert.equal(written.json().settingsVersion, '11');
    assert.deepEqual(written.json().appPermissions, input.patch.rules);
  } finally {
    await app.close();
    await pool.query('DELETE FROM audit_outbox WHERE event_id IN (SELECT event_id FROM audit_events WHERE actor_id=$1)', [subjectId]);
    await pool.query('DELETE FROM audit_events WHERE actor_id=$1', [subjectId]);
    await pool.query('DELETE FROM permission_decisions WHERE subject_id=$1', [subjectId]);
    await pool.query('DELETE FROM system_setting_events WHERE scope_id=$1', [scopeId]);
    await pool.query('DELETE FROM system_settings WHERE scope_id=$1', [scopeId]);
    await pool.query('DELETE FROM app_package_deployments WHERE subject_id=$1 AND app_id=$2', [subjectId, manifest.appId]);
    await pool.query('DELETE FROM app_package_releases WHERE package_id=$1', [packageId]);
    await pool.end();
  }
});

test('main API accepts the installed workbench permission form against PostgreSQL', async (t) => {
  let name; try { name = new URL(process.env.DGOS_DATABASE_URL).pathname.slice(1); } catch { /* absent */ }
  if (!/^(?:dgos_v1_governance|dgos_v1_verify_[0-9a-f]{32})$/.test(name ?? '')) return t.skip('dedicated governance or Verify database required');
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL });
  const root = await mkdtemp(join(tmpdir(), 'dgos-r9-package-'));
  const scopeId = '00000000-0000-0000-0000-000000000001'; const packageId = randomUUID();
  const browserSubjectId = 'c2fee94e-bd71-46b8-b1fa-79f75b736773';
  const browserHttpRequestId = '437e9a43-c3fb-48ac-aa65-58770cdcd202';
  const manifest = JSON.parse(await readFile(new URL('../../apps/ai-workbench-package/manifest.json', import.meta.url), 'utf8'));
  const digest = `sha256:${'b'.repeat(64)}`;
  const identity = new InMemoryIdentityRepository();
  const app = buildServer({ logger: false, closeDatabasePools: true, repository: identity, packageOptions: { store: new DiskPackageStore(root), trustRoots: new Map() } });
  let subjectId;
  try {
    const boot = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'R9', credential: 'r9-fixture' } });
    assert.equal(boot.statusCode, 201, boot.body);
    subjectId = browserSubjectId;
    const principal = identity.principals.get(boot.json().principalId);
    identity.principals.delete(boot.json().principalId);
    principal.principalId = subjectId;
    identity.principals.set(subjectId, principal);
    identity.sessions.get(boot.json().sessionId).principalId = subjectId;
    const headers = { authorization: `Bearer ${boot.json().sessionId}`, 'x-dgos-csrf': 'r9' };
    await pool.query('UPDATE system_settings SET settings_version=10 WHERE scope_id=$1', [scopeId]);
    await pool.query("INSERT INTO app_package_releases(package_id,app_id,version,build,release_channel,manifest,package_digest,source,key_id,request_id,effective_trust_level,uninstall_policy,catalog_state) VALUES($1,$2,'1.0.0',1,'stable',$3,$4,'official','r9-api-fixture',$5,'standard','user-removable','official')", [packageId, manifest.appId, manifest, digest, randomUUID()]);
    await pool.query("INSERT INTO app_package_deployments(subject_id,app_id,package_id,version,build,release_channel,package_digest,state) VALUES($1,$2,$3,'1.0.0',1,'stable',$4,'active')", [subjectId, manifest.appId, packageId, digest]);
    for (const capability of manifest.permissions) await pool.query("INSERT INTO permission_decisions(subject_id,app_id,capability,scope,decision,policy_version) VALUES($1,$2,$3,'*','allow',1)", [subjectId, manifest.appId, capability]);
    const input = { requestId: randomUUID(), baseVersion: '10', domain: 'appPermissions', patch: { rules: [{ appId: manifest.appId, subjectType: 'user', subjectId, capability: 'dgos.model.list', scope: { value: '*' }, decision: 'allow' }] } };
    const written = await app.inject({ method: 'PATCH', url: '/api/v1/system/settings', headers: { ...headers, 'x-request-id': browserHttpRequestId }, payload: input });
    assert.equal(written.statusCode, 200, written.body);
    assert.equal(written.json().appPermissions.length, manifest.permissions.length);
    assert.deepEqual(written.json().appPermissions.find((item) => item.capability === 'dgos.model.list'), input.patch.rules[0]);
    assert.equal(written.json().settingsVersion, '11');
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM permission_decisions WHERE subject_id=$1 AND decision='allow'", [subjectId])).rows[0].n, manifest.permissions.length);
    assert.deepEqual((await app.inject({ method: 'PATCH', url: '/api/v1/system/settings', headers, payload: input })).json(), written.json());
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM audit_events WHERE actor_id=$1 AND action IN ($2,$3)', [subjectId, 'permission.change', 'system.settings.patch'])).rows[0].n, 2);
  } finally {
    await app.close();
    if (subjectId) {
      await pool.query('DELETE FROM audit_outbox WHERE event_id IN (SELECT event_id FROM audit_events WHERE actor_id=$1)', [subjectId]);
      await pool.query('DELETE FROM audit_events WHERE actor_id=$1', [subjectId]);
      await pool.query('DELETE FROM permission_decisions WHERE subject_id=$1', [subjectId]);
      await pool.query('DELETE FROM app_package_deployments WHERE subject_id=$1 AND app_id=$2', [subjectId, manifest.appId]);
    }
    await pool.query('DELETE FROM system_setting_events WHERE scope_id=$1', [scopeId]);
    await pool.query('DELETE FROM system_settings WHERE scope_id=$1', [scopeId]);
    await pool.query('DELETE FROM app_package_releases WHERE package_id=$1', [packageId]);
    await pool.end(); await rm(root, { recursive: true, force: true });
  }
});
