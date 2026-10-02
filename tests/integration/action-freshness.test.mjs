import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { buildServer } from '../../apps/api/src/server.mjs';
import { InMemoryIdentityRepository } from '../../src/identity/repository.mjs';
import { InMemoryAuditRepository } from '../../src/audit/outbox.mjs';
import { DiskPackageStore } from '../../src/apps/package-service.mjs';
import { stableActionDigest } from '../../src/actions/service.mjs';
import { discoverMigrations, buildMigrationSql } from '../../scripts/migrate.mjs';

const plan = (app, actionId, headers, input) => app.inject({ method: 'POST', url: `/api/v1/actions/${actionId}/plan`, headers, payload: { input } });
const execute = (app, actionId, headers, planId, input, extra = {}) => app.inject({ method: 'POST', url: `/api/v1/actions/${actionId}/execute`, headers: { ...headers, ...(extra.requestId ? { 'x-request-id': extra.requestId } : {}) }, payload: { planId, input, confirmed: extra.confirmed ?? true } });
const rule = (subjectId, decision = 'deny') => ({ appId: 'dgos.system', subjectType: 'user', subjectId, capability: 'system.navigate', scope: { value: '*' }, decision });
const settle = async (app, runId, headers) => {
  for (let i = 0; i < 30; i += 1) {
    const response = await app.inject({ method: 'GET', url: `/api/v1/action-runs/${runId}`, headers });
    if (['succeeded', 'failed', 'cancelled'].includes(response.json().state)) return response.json();
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('action_run_did_not_settle');
};
const bootstrap = async (app) => {
  const response = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'Action freshness', credential: 'action-freshness-secret' } });
  assert.equal(response.statusCode, 201, response.body);
  const { sessionId, principalId } = response.json();
  return { sessionId, principalId, headers: { authorization: `Bearer ${sessionId}`, cookie: `dgos_session=${sessionId}`, 'x-dgos-csrf': 'test' } };
};
const allow = (app, subjectId, capability) => app.permissions.decide({ subjectId, appId: 'dgos.system', capability, decision: 'allow', requestId: randomUUID() });

test('HTTP elevated actions require a fresh server session and keep failed plans inert', async (t) => {
  const prior = process.env.DGOS_DATABASE_URL; delete process.env.DGOS_DATABASE_URL;
  const dir = await mkdtemp(join(tmpdir(), 'dgos-action-fresh-'));
  const identity = new InMemoryIdentityRepository(); const audit = new InMemoryAuditRepository();
  let app;
  try { app = buildServer({ logger: false, repository: identity, auditRepository: audit, packageOptions: { store: new DiskPackageStore(dir), trustRoots: new Map() } }); }
  finally { if (prior === undefined) delete process.env.DGOS_DATABASE_URL; else process.env.DGOS_DATABASE_URL = prior; }
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const owner = await bootstrap(app);
  await allow(app, owner.principalId, 'system.settings.write');
  const key = await app.inject({ method: 'POST', url: '/api/v1/secret/api-keys', headers: owner.headers, payload: { name: 'action-test', scopes: ['action.plan', 'action.execute', 'action.read'] } });
  assert.equal(key.statusCode, 201, key.body);
  const keyHeaders = { authorization: `ApiKey ${key.json().secret}` };
  const before = (await app.inject({ method: 'GET', url: '/api/v1/system/settings', headers: owner.headers })).json();
  const actionId = 'system.settings.privacy.patch';
  const input = { baseVersion: before.settingsVersion, value: { telemetry: true } };
  const proposed = await plan(app, actionId, owner.headers, input);
  assert.equal(proposed.statusCode, 200, proposed.body);
  assert.equal(proposed.json().riskLevel, 'high');
  assert.equal((await execute(app, actionId, owner.headers, proposed.json().planId, input, { confirmed: false })).statusCode, 428);
  const forged = await execute(app, actionId, keyHeaders, proposed.json().planId, input, { authFreshUntil: new Date(Date.now() + 60000).toISOString() });
  assert.equal(forged.statusCode, 403);
  identity.sessions.get(owner.sessionId).authFreshUntil = new Date(Date.now() - 1000).toISOString();
  const stale = await execute(app, actionId, owner.headers, proposed.json().planId, input, { sessionId: owner.sessionId, fresh: true });
  assert.equal(stale.statusCode, 403, stale.body);
  assert.equal(stale.json().errorKey, 'step_up_required');
  assert.equal((await app.inject({ method: 'GET', url: '/api/v1/system/settings', headers: owner.headers })).json().privacy.telemetry, false);
  assert.equal((await app.actions.repository.getPlan(proposed.json().planId)).state, 'planned');
  assert.equal(await app.actions.repository.findRunByRequest(owner.principalId, stale.headers['x-request-id']), undefined);
  identity.sessions.get(owner.sessionId).authFreshUntil = new Date(Date.now() + 60000).toISOString();
  const fresh = await execute(app, actionId, owner.headers, proposed.json().planId, input);
  assert.equal(fresh.statusCode, 202, fresh.body);
  assert.equal((await settle(app, fresh.json().runId, owner.headers)).state, 'succeeded');
  assert.equal((await app.inject({ method: 'GET', url: '/api/v1/system/settings', headers: owner.headers })).json().privacy.telemetry, true);
  assert.equal((await execute(app, actionId, owner.headers, proposed.json().planId, { ...input, value: { telemetry: false } })).statusCode, 428);
  const genericId = 'system.settings.patch';
  const genericInput = { baseVersion: '2', patch: { domain: 'privacy', value: { telemetry: false } } };
  const genericPlan = await plan(app, genericId, owner.headers, genericInput);
  assert.equal(genericPlan.statusCode, 200, genericPlan.body);
  assert.equal(genericPlan.json().riskLevel, 'high');
  identity.sessions.get(owner.sessionId).authFreshUntil = new Date(Date.now() - 1000).toISOString();
  assert.equal((await execute(app, genericId, owner.headers, genericPlan.json().planId, genericInput)).statusCode, 403);
  assert.equal((await app.inject({ method: 'GET', url: '/api/v1/system/settings', headers: owner.headers })).json().privacy.telemetry, true);
  identity.sessions.get(owner.sessionId).authFreshUntil = new Date(Date.now() + 60000).toISOString();
  app.actions.repository.plans.get(genericPlan.json().planId).expiresAt = new Date(Date.now() - 1000).toISOString();
  assert.equal((await execute(app, genericId, owner.headers, genericPlan.json().planId, genericInput)).statusCode, 410);
  const direct = { requestId: randomUUID(), baseVersion: '2', domain: 'privacy', patch: { telemetry: false } };
  identity.sessions.get(owner.sessionId).authFreshUntil = new Date(Date.now() - 1000).toISOString();
  const directStale = await app.inject({ method: 'PATCH', url: '/api/v1/system/settings', headers: owner.headers, payload: direct });
  assert.equal(directStale.statusCode, 403);
  assert.equal(directStale.json().errorKey, 'step_up_required');
  identity.sessions.get(owner.sessionId).authFreshUntil = new Date(Date.now() + 60000).toISOString();
  const directFresh = await app.inject({ method: 'PATCH', url: '/api/v1/system/settings', headers: owner.headers, payload: direct });
  assert.equal(directFresh.statusCode, 200, directFresh.body);
  assert.equal(directFresh.json().privacy.telemetry, false);
});

const allowedParent = (connectionString) => {
  try { return /^(?:dgos_v1_actions|dgos_v1_verify_[0-9a-f]{32})$/.test(new URL(connectionString).pathname.slice(1)); }
  catch { return false; }
};
test('Action freshness PostgreSQL parent guard accepts only dedicated Actions or exact Verify databases', () => {
  assert.equal(allowedParent('postgresql://localhost/dgos_v1_actions'), true);
  assert.equal(allowedParent(`postgresql://localhost/dgos_v1_verify_${'a'.repeat(32)}`), true);
  for (const name of ['dgos', 'dgos_v1_integrated', 'dgos_v1_verify_bad', `dgos_v1_verify_${'A'.repeat(32)}`, `dgos_v1_verify_${'a'.repeat(32)}_extra`]) {
    assert.equal(allowedParent(`postgresql://localhost/${name}`), false, name);
  }
  assert.equal(allowedParent('not-a-url'), false);
});
test('PostgreSQL HTTP Action permission writes use one Broker transaction and worker recheck', { skip: !process.env.DGOS_DATABASE_URL }, async (t) => {
  if (!allowedParent(process.env.DGOS_DATABASE_URL)) throw new Error('action_freshness_requires_dedicated_actions_or_verify_database');
  const parentUrl = process.env.DGOS_DATABASE_URL; const name = `dgos_v1_action_fresh_${randomUUID().replaceAll('-', '')}`;
  const childUrl = new URL(parentUrl); childUrl.pathname = `/${name}`;
  const admin = new pg.Pool({ connectionString: parentUrl });
  const dir = await mkdtemp(join(tmpdir(), 'dgos-action-fresh-pg-'));
  let created = false; let app;
  t.after(async () => { await app?.close(); process.env.DGOS_DATABASE_URL = parentUrl; if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`); await admin.end(); await rm(dir, { recursive: true, force: true }); });
  await admin.query(`CREATE DATABASE "${name}"`); created = true;
  const setup = new pg.Pool({ connectionString: childUrl.toString() });
  try { await setup.query(buildMigrationSql(await discoverMigrations())); }
  finally { await setup.end(); }
  process.env.DGOS_DATABASE_URL = childUrl.toString();
  app = buildServer({ logger: false, packageOptions: { store: new DiskPackageStore(dir), trustRoots: new Map() } });
  const owner = await bootstrap(app);
  await allow(app, owner.principalId, 'system.settings.write');
  await allow(app, owner.principalId, 'permission.manage');
  const before = (await app.inject({ method: 'GET', url: '/api/v1/system/settings', headers: owner.headers })).json();
  const input = { baseVersion: before.settingsVersion, value: [rule(owner.principalId)] };
  const actionId = 'system.settings.appPermissions.patch';
  const proposed = await plan(app, actionId, owner.headers, input);
  assert.equal(proposed.statusCode, 200, proposed.body);
  assert.equal(proposed.json().riskLevel, 'high');
  const submitted = await execute(app, actionId, owner.headers, proposed.json().planId, input);
  assert.equal(submitted.statusCode, 202, submitted.body);
  const run = await app.actions.processOne(submitted.json().runId);
  assert.equal(run.state, 'succeeded', JSON.stringify(run));
  const decision = await app.permissions.repository.get({ subjectId: owner.principalId, appId: 'dgos.system', capability: 'system.navigate' });
  assert.equal(decision.decision, 'deny');
  const settings = (await app.inject({ method: 'GET', url: '/api/v1/system/settings', headers: owner.headers })).json();
  assert.equal(settings.settingsVersion, '2');
  assert.equal(settings.appPermissions.find((item) => item.capability === 'system.navigate').decision, 'deny');
  const crossPathReplay = await app.inject({ method: 'PATCH', url: '/api/v1/system/settings', headers: owner.headers, payload: { requestId: submitted.json().requestId, baseVersion: '1', domain: 'appPermissions', patch: { rules: [{ decision: 'deny', capability: 'system.navigate', appId: 'dgos.system', scope: { value: '*' }, subjectType: 'user', subjectId: owner.principalId }] } } });
  assert.equal(crossPathReplay.statusCode, 200, crossPathReplay.body);
  assert.equal(crossPathReplay.json().settingsVersion, '2');
  const db = new pg.Pool({ connectionString: childUrl.toString() });
  try {
    const audit = await db.query("SELECT action,count(*)::int AS n FROM audit_events WHERE request_id=$1 AND action IN ('permission.change','system.settings.patch') GROUP BY action", [submitted.json().requestId]);
    assert.deepEqual(Object.fromEntries(audit.rows.map((row) => [row.action, row.n])), { 'permission.change': 1, 'system.settings.patch': 1 });
    const stored = await db.query('SELECT settings FROM system_settings WHERE scope_id=$1', [app.system.scopeId]);
    const receipt = stored.rows[0].settings._requestReceipts[`${owner.principalId}:${submitted.json().requestId}`];
    const expected = stableActionDigest({ domain: 'appPermissions', patch: { rules: input.value }, baseVersion: input.baseVersion });
    assert.equal(receipt.digest, expected);
    const reordered = { baseVersion: input.baseVersion, value: [{ decision: 'deny', scope: { value: '*' }, capability: 'system.navigate', subjectId: owner.principalId, subjectType: 'user', appId: 'dgos.system' }] };
    const replay = await app.actions.handlers.get(actionId)(reordered, { subjectId: owner.principalId, requestId: submitted.json().requestId });
    assert.equal(replay.snapshot.settingsVersion, '2');
    const afterReplay = await db.query("SELECT count(*)::int AS n FROM audit_events WHERE request_id=$1 AND action IN ('permission.change','system.settings.patch')", [submitted.json().requestId]);
    assert.equal(afterReplay.rows[0].n, 2);
  } finally { await db.end(); }
  const readPlan = await plan(app, 'system.navigate.app.catalog', owner.headers, {});
  assert.equal(readPlan.statusCode, 403);
  const nextInput = { baseVersion: '2', patch: { domain: 'privacy', value: { telemetry: true } } };
  const nextPlan = await plan(app, 'system.settings.patch', owner.headers, nextInput);
  assert.equal(nextPlan.statusCode, 200, nextPlan.body);
  const queued = await execute(app, 'system.settings.patch', owner.headers, nextPlan.json().planId, nextInput);
  assert.equal(queued.statusCode, 202, queued.body);
  await app.permissions.decide({ subjectId: owner.principalId, appId: 'dgos.system', capability: 'system.settings.write', decision: 'deny', requestId: randomUUID() });
  const blocked = await app.actions.processOne(queued.json().runId);
  assert.equal(blocked.state, 'failed');
  assert.equal(blocked.errorSummary, 'permission_denied');
  const afterBlocked = (await app.inject({ method: 'GET', url: '/api/v1/system/settings', headers: owner.headers })).json();
  assert.equal(afterBlocked.settingsVersion, '2');
  assert.equal(afterBlocked.privacy.telemetry, false);
  await app.permissions.decide({ subjectId: owner.principalId, appId: 'dgos.system', capability: 'system.settings.write', decision: 'allow', requestId: randomUUID() });
  const floatInput = { baseVersion: '2', value: { opacity: 0.42, enabled: false } };
  const floatPlan = await plan(app, 'system.settings.grid.patch', owner.headers, floatInput);
  assert.equal(floatPlan.statusCode, 200, floatPlan.body);
  const rearranged = { value: { enabled: false, opacity: 0.42 }, baseVersion: '2' };
  const replayRequestId = randomUUID();
  const floatRun = await execute(app, 'system.settings.grid.patch', owner.headers, floatPlan.json().planId, rearranged, { requestId: replayRequestId });
  assert.equal(floatRun.statusCode, 202, floatRun.body);
  assert.equal((await app.actions.processOne(floatRun.json().runId)).state, 'succeeded');
  const duplicate = await execute(app, 'system.settings.grid.patch', owner.headers, floatPlan.json().planId, floatInput, { requestId: replayRequestId });
  assert.equal(duplicate.statusCode, 202, duplicate.body);
  assert.equal(duplicate.json().runId, floatRun.json().runId);
});
