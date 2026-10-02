import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ActionRegistry } from '../../src/actions/registry.mjs';
import { ActionService } from '../../src/actions/service.mjs';
import { InMemoryActionRepository, PostgresActionRepository } from '../../src/actions/repository.mjs';
import { ActionWorker } from '../../src/actions/worker.mjs';
import { registerSystemActions, resolveActionCandidates, resolveNaturalLanguageCandidates } from '../../src/actions/system-actions.mjs';

const permissions = { check: async () => ({ decision: 'allow', policyVersion: '1' }) };
const define = (service, handler) => service.register({ actionId: 'test.write', ownerAppId: 'test', requiredCapability: 'test.write', riskLevel: 'high', sideEffects: ['test'], inputSchema: { type: 'object', required: ['value'], properties: { value: { type: 'string' } } }, timeout: 1000 }, handler);
const isolatedDatabase = (url = process.env.DGOS_DATABASE_URL) => {
  try { return /^(?:dgos_v1_actions|dgos_v1_integrated|dgos_v1_verify_[a-f0-9]{32})$/.test(new URL(url).pathname.slice(1)); }
  catch { return false; }
};

test('PostgreSQL integration whitelist accepts isolated runs and rejects dgos', () => {
  assert.equal(isolatedDatabase('postgresql://localhost/dgos_v1_actions'), true);
  assert.equal(isolatedDatabase('postgresql://localhost/dgos_v1_integrated'), true);
  assert.equal(isolatedDatabase(`postgresql://localhost/dgos_v1_verify_${'a'.repeat(32)}`), true);
  assert.equal(isolatedDatabase('postgresql://localhost/dgos'), false);
  assert.equal(isolatedDatabase('postgresql://localhost/dgos_v1_verify_bad'), false);
});

test('queued input survives worker replacement and duplicate request does not repeat handler', async () => {
  const repository = new InMemoryActionRepository(); const registry = new ActionRegistry(); let calls = 0;
  const api = new ActionService({ repository, registry, permissions, autoDispatch: false });
  define(api, async (input) => { calls += 1; assert.equal(input.value, 'safe'); return { ok: true }; });
  const plan = await api.plan({ actionId: 'test.write', subjectId: 'u', input: { value: 'safe' } });
  const queued = await api.execute({ actionId: 'test.write', planId: plan.planId, subjectId: 'u', input: { value: 'safe' }, confirmed: true, requestId: 'req' });
  assert.equal(queued.input, undefined); assert.equal(calls, 0);
  const workerService = new ActionService({ repository, registry, permissions, autoDispatch: false });
  define(workerService, async (input) => { calls += 1; assert.equal(input.value, 'safe'); return { ok: true }; });
  const worker = new ActionWorker({ service: workerService });
  await worker.tick();
  assert.equal((await api.get(queued.runId, 'u')).state, 'succeeded');
  const duplicate = await api.execute({ actionId: 'test.write', planId: plan.planId, subjectId: 'u', input: { value: 'safe' }, confirmed: true, requestId: 'req' });
  assert.equal(duplicate.runId, queued.runId); assert.equal(calls, 1);
});

test('one plan cannot queue two requests concurrently', async () => {
  const repository = new InMemoryActionRepository(); const registry = new ActionRegistry();
  const service = new ActionService({ repository, registry, permissions, autoDispatch: false });
  define(service, async () => ({ ok: true }));
  const plan = await service.plan({ actionId: 'test.write', subjectId: 'u', input: { value: 'x' } });
  const attempts = await Promise.allSettled(['first', 'second'].map((requestId) => service.execute({ actionId: 'test.write', planId: plan.planId, subjectId: 'u', input: { value: 'x' }, confirmed: true, requestId })));
  assert.equal(attempts.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal((await repository.listRuns()).length, 1);
});

test('in-memory audit failure leaves no claimable run', async () => {
  const repository = new InMemoryActionRepository(); const registry = new ActionRegistry(); let calls = 0;
  const audit = { record: async (event) => { if (event.action === 'action.execute') throw new Error('audit_unavailable'); } };
  const service = new ActionService({ repository, registry, permissions, audit, autoDispatch: false });
  define(service, async () => { calls += 1; });
  const plan = await service.plan({ actionId: 'test.write', subjectId: 'u', input: { value: 'x' } });
  await assert.rejects(service.execute({ actionId: 'test.write', planId: plan.planId, subjectId: 'u', input: { value: 'x' }, confirmed: true, requestId: 'audit-fail' }), /audit_unavailable/);
  assert.equal((await repository.getPlan(plan.planId)).state, 'planned');
  assert.equal(await service.processOne(), undefined); assert.equal(calls, 0);
});

test('expired action is rejected before handler entry', async () => {
  const repository = new InMemoryActionRepository(); const registry = new ActionRegistry(); let calls = 0;
  const service = new ActionService({ repository, registry, permissions, autoDispatch: false });
  define(service, async () => { calls += 1; });
  const plan = await service.plan({ actionId: 'test.write', subjectId: 'u', input: { value: 'x' } });
  const run = await service.execute({ actionId: 'test.write', planId: plan.planId, subjectId: 'u', input: { value: 'x' }, confirmed: true, requestId: 'expired-1' });
  repository.runs.get(run.runId).timeoutAt = new Date(Date.now() - 1).toISOString();
  await service.processOne();
  assert.equal(calls, 0); assert.equal((await service.get(run.runId, 'u')).errorSummary, 'action_timeout');
});

test('cancel propagates signal and only confirmed AbortError becomes cancelled', async () => {
  const repository = new InMemoryActionRepository(); const registry = new ActionRegistry();
  const service = new ActionService({ repository, registry, permissions, autoDispatch: false, leaseMs: 90 });
  define(service, (_input, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })), { once: true })));
  const plan = await service.plan({ actionId: 'test.write', subjectId: 'u', input: { value: 'x' } });
  const run = await service.execute({ actionId: 'test.write', planId: plan.planId, subjectId: 'u', input: { value: 'x' }, confirmed: true, requestId: 'cancel-1' });
  const processing = service.processOne();
  await new Promise((resolve) => setTimeout(resolve, 5));
  const pending = await service.cancel(run.runId, 'u', 'cancel-request');
  assert.equal(pending.state, 'cancel_requested');
  await processing;
  assert.equal((await service.get(run.runId, 'u')).state, 'cancelled');
});

test('expired claimed run becomes outcome_unknown and is never redispatched', async () => {
  const repository = new InMemoryActionRepository(); const registry = new ActionRegistry(); let calls = 0;
  const service = new ActionService({ repository, registry, permissions, autoDispatch: false, leaseMs: 10 });
  define(service, async () => { calls += 1; });
  const plan = await service.plan({ actionId: 'test.write', subjectId: 'u', input: { value: 'x' } });
  const run = await service.execute({ actionId: 'test.write', planId: plan.planId, subjectId: 'u', input: { value: 'x' }, confirmed: true, requestId: 'unknown-1' });
  await repository.claimRun(run.runId, 'dead', 1);
  await new Promise((resolve) => setTimeout(resolve, 5));
  await service.reclaim(); await service.processOne();
  const recovered = await service.get(run.runId, 'u');
  assert.equal(recovered.state, 'failed'); assert.equal(recovered.errorSummary, 'outcome_unknown'); assert.equal(calls, 0);
});

test('uncooperative handler keeps cancel pending until its outcome is known', async () => {
  const repository = new InMemoryActionRepository(); const registry = new ActionRegistry();
  const service = new ActionService({ repository, registry, permissions, autoDispatch: false, leaseMs: 30 });
  let release;
  define(service, () => new Promise((resolve) => { release = resolve; }));
  const plan = await service.plan({ actionId: 'test.write', subjectId: 'u', input: { value: 'x' } });
  const run = await service.execute({ actionId: 'test.write', planId: plan.planId, subjectId: 'u', input: { value: 'x' }, confirmed: true, requestId: 'cancel-unknown' });
  const processing = service.processOne();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal((await service.cancel(run.runId, 'u', 'cancel-request')).state, 'cancel_requested');
  release({ ok: true }); await processing;
  const final = await service.get(run.runId, 'u');
  assert.equal(final.state, 'failed'); assert.equal(final.errorSummary, 'cancel_outcome_unknown');
});

test('resolver returns registered candidates without executing them', async () => {
  const registry = new ActionRegistry(); const service = new ActionService({ registry, permissions }); let writes = 0;
  registerSystemActions(service, { system: { patch: async () => { writes += 1; }, snapshot: async () => ({}) } });
  const match = resolveActionCandidates('please open settings', { registry, aliases: { 'system.navigate.system.settings': ['open settings'] } });
  assert.equal(match.executable, false); assert.equal(match.candidates[0].actionId, 'system.navigate.system.settings'); assert.equal(writes, 0);
  const providerMatch = await resolveNaturalLanguageCandidates('change settings', { registry, permissions, subjectId: 'u', provider: { resolve: async () => [{ actionId: 'system.settings.appearance.patch', actionVersion: '1', input: { baseVersion: '1', value: { mode: 'dark' } } }, { actionId: 'unknown', actionVersion: '1' }] } });
  assert.equal(providerMatch.executable, false); assert.equal(providerMatch.candidates.length, 1); assert.equal(writes, 0);
  const denied = { check: async ({ capability }) => ({ decision: capability === 'system.settings.write' ? 'deny' : 'allow' }) };
  const filtered = await resolveNaturalLanguageCandidates('change settings', { registry, permissions: denied, subjectId: 'u', provider: { resolve: async ({ actions }) => { assert.ok(actions.every((item) => !item.actionId.endsWith('.patch'))); return [{ actionId: 'system.settings.appearance.patch', actionVersion: '1', input: { baseVersion: '1', value: { mode: 'dark' } } }]; } } });
  assert.equal(filtered.candidates.length, 0); assert.equal(writes, 0);
  const plan = await service.plan({ actionId: 'system.navigate.system.settings', subjectId: 'u', input: {} });
  const run = await service.execute({ actionId: plan.actionId, planId: plan.planId, subjectId: 'u', input: {}, requestId: 'nav-1' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual((await service.get(run.runId, 'u')).resultSummary, { ok: true, navigation: { target: 'system.settings' } });
});

test('PostgreSQL queued run survives new repository and uses 0016 input column', async (t) => {
  if (!isolatedDatabase()) return t.skip('isolated V1 test database required');
  const pg = (await import('../../apps/api/node_modules/pg/lib/index.js')).default;
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL });
  const registry = new ActionRegistry(); const subjectId = randomUUID(); const requestId = randomUUID(); let calls = 0;
  try {
    const api = new ActionService({ repository: new PostgresActionRepository(pool), registry, permissions, autoDispatch: false });
    define(api, async () => { calls += 1; });
    const plan = await api.plan({ actionId: 'test.write', subjectId, input: { value: 'persisted' }, requestId: randomUUID() });
    const persistedPlan = await new PostgresActionRepository(pool).getPlan(plan.planId);
    assert.equal(plan.permission.decision, 'allow'); assert.deepEqual(persistedPlan.permission, plan.permission);
    assert.equal(persistedPlan.registryVersion, plan.registryVersion);
    const run = await api.execute({ actionId: 'test.write', planId: plan.planId, subjectId, input: { value: 'persisted' }, confirmed: true, requestId });
    const worker = new ActionService({ repository: new PostgresActionRepository(pool), registry, permissions, autoDispatch: false });
    define(worker, async (input) => { assert.equal(input.value, 'persisted'); calls += 1; });
    await worker.processOne();
    assert.equal((await api.get(run.runId, subjectId)).state, 'succeeded'); assert.equal(calls, 1);
    assert.equal((await pool.query('SELECT input_payload FROM action_runs WHERE run_id=$1', [run.runId])).rows[0].input_payload.value, 'persisted');
  } finally {
    await pool.query('DELETE FROM action_runs WHERE subject_id=$1', [subjectId]);
    await pool.query('DELETE FROM action_plans WHERE subject_id=$1', [subjectId]);
    await pool.end();
  }
});

test('PostgreSQL audit failure rolls back run and plan atomically', async (t) => {
  if (!isolatedDatabase()) return t.skip('isolated V1 test database required');
  const pg = (await import('../../apps/api/node_modules/pg/lib/index.js')).default;
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL });
  const repository = new PostgresActionRepository(pool); const registry = new ActionRegistry(); const subjectId = randomUUID(); let calls = 0;
  const audit = { record: async () => {} };
  try {
    const service = new ActionService({ repository, registry, permissions, audit, autoDispatch: false });
    define(service, async () => { calls += 1; });
    const plan = await service.plan({ actionId: 'test.write', subjectId, input: { value: 'x' }, requestId: randomUUID() });
    repository.recordExecutionAudit = async () => { throw new Error('audit_unavailable'); };
    await assert.rejects(service.execute({ actionId: 'test.write', planId: plan.planId, subjectId, input: { value: 'x' }, confirmed: true, requestId: randomUUID() }), /audit_unavailable/);
    assert.equal((await repository.getPlan(plan.planId)).state, 'planned');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM action_runs WHERE plan_id=$1', [plan.planId])).rows[0].n, 0);
    assert.equal(await service.processOne(), undefined); assert.equal(calls, 0);
  } finally { await pool.query('DELETE FROM action_plans WHERE subject_id=$1', [subjectId]); await pool.end(); }
});

test('PostgreSQL plan lock allows one concurrent request to queue', async (t) => {
  if (!isolatedDatabase()) return t.skip('isolated V1 test database required');
  const pg = (await import('../../apps/api/node_modules/pg/lib/index.js')).default;
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL });
  const repository = new PostgresActionRepository(pool); const registry = new ActionRegistry(); const subjectId = randomUUID();
  try {
    const service = new ActionService({ repository, registry, permissions, autoDispatch: false });
    define(service, async () => ({ ok: true }));
    const plan = await service.plan({ actionId: 'test.write', subjectId, input: { value: 'x' }, requestId: randomUUID() });
    const attempts = await Promise.allSettled([randomUUID(), randomUUID()].map((requestId) => service.execute({ actionId: 'test.write', planId: plan.planId, subjectId, input: { value: 'x' }, confirmed: true, requestId })));
    assert.equal(attempts.filter((item) => item.status === 'fulfilled').length, 1);
    const count = await pool.query('SELECT count(*)::int AS n FROM action_runs WHERE plan_id=$1', [plan.planId]);
    assert.equal(count.rows[0].n, 1);
  } finally {
    await pool.query('DELETE FROM action_runs WHERE subject_id=$1', [subjectId]);
    await pool.query('DELETE FROM action_plans WHERE subject_id=$1', [subjectId]);
    await pool.end();
  }
});
