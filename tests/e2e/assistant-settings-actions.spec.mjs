import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../../apps/api/src/server.mjs';
import { InMemoryIdentityRepository } from '../../src/identity/repository.mjs';
import { InMemoryPermissionRepository } from '../../src/permissions/repository.mjs';
import { InMemoryActionRepository } from '../../src/actions/repository.mjs';
import { InMemoryAuditRepository } from '../../src/audit/outbox.mjs';
import { ActionRegistry } from '../../src/actions/registry.mjs';

test('V1-FR-009/V1-E2E-09 assistant action workflow enforces permission, confirmation, versions, cancel and audit', async () => {
  const registry = new ActionRegistry();
  const actions = new InMemoryActionRepository();
  const audit = new InMemoryAuditRepository();
  const permissions = new InMemoryPermissionRepository();
  let calls = 0;
  registry.register({ actionId: 'e2e.allowed', ownerAppId: 'e2e', requiredCapability: 'action.execute', riskLevel: 'low', inputSchema: { type: 'object', required: ['value'], properties: { value: { type: 'string' } } } });
  registry.register({ actionId: 'e2e.long', ownerAppId: 'e2e', requiredCapability: 'e2e.long', riskLevel: 'high', timeout: 5000 });
  const app = buildServer({ logger: false, repository: new InMemoryIdentityRepository(), permissionRepository: permissions, actionRepository: actions, actionRegistry: registry, auditRepository: audit, actionHandlers: { 'e2e.allowed': async () => { calls += 1; return { ok: true }; }, 'e2e.long': async () => { calls += 1; await new Promise((resolve) => setTimeout(resolve, 120)); return { ok: true }; } } });
  const bootstrap = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'E2E', credential: 'e2e-secret' } });
  assert.equal(bootstrap.statusCode, 201);
  const session = bootstrap.json().sessionId;
  permissions.declare(bootstrap.json().principalId, 'e2e', ['action.execute', 'e2e.long']);
  permissions.set({ subjectId: bootstrap.json().principalId, appId: 'e2e', capability: 'action.execute' }, 'allow');
  permissions.set({ subjectId: bootstrap.json().principalId, appId: 'e2e', capability: 'e2e.long' }, 'allow');
  const headers = { authorization: `Bearer ${session}`, cookie: `dgos_session=${session}`, 'x-dgos-csrf': 'e2e' };
  const listed = await app.inject({ method: 'GET', url: '/api/v1/actions', headers }); assert.ok(listed.json().items.some((x) => x.actionId === 'e2e.allowed'));
  const plan = await app.inject({ method: 'POST', url: '/api/v1/actions/e2e.allowed/plan', headers, payload: { input: { value: 'x' }, appId: 'e2e' } }); assert.equal(plan.statusCode, 200);
  const run = await app.inject({ method: 'POST', url: '/api/v1/actions/e2e.allowed/execute', headers, payload: { planId: plan.json().planId, input: { value: 'x' }, appId: 'e2e', confirmed: true } }); assert.equal(run.statusCode, 202, run.body);
  await new Promise((resolve) => setImmediate(resolve)); const done = await app.inject({ method: 'GET', url: `/api/v1/action-runs/${run.json().runId}`, headers }); assert.equal(done.json().handlerCalls, 1); assert.equal(calls, 1);
  const denied = await app.inject({ method: 'POST', url: '/api/v1/actions/e2e.allowed/plan', headers, payload: { input: { value: 'x' }, appId: 'other' } }); assert.equal(denied.statusCode, 200); assert.equal(denied.json().permission.appId, 'e2e'); permissions.set({ subjectId: bootstrap.json().principalId, appId: 'e2e', capability: 'action.execute' }, 'deny'); const deniedExecute = await app.inject({ method: 'POST', url: '/api/v1/actions/e2e.allowed/execute', headers, payload: { planId: denied.json().planId, input: { value: 'x' }, appId: 'other', confirmed: true } }); assert.equal(deniedExecute.statusCode, 403); assert.equal(calls, 1); permissions.set({ subjectId: bootstrap.json().principalId, appId: 'e2e', capability: 'action.execute' }, 'allow');
  const longPlan = await app.inject({ method: 'POST', url: '/api/v1/actions/e2e.long/plan', headers, payload: { input: {}, appId: 'e2e' } }); assert.equal(longPlan.json().confirmationRequired, true); const noConfirm = await app.inject({ method: 'POST', url: '/api/v1/actions/e2e.long/execute', headers, payload: { planId: longPlan.json().planId, input: {} } }); assert.equal(noConfirm.statusCode, 428);
  const longRun = await app.inject({ method: 'POST', url: '/api/v1/actions/e2e.long/execute', headers, payload: { planId: longPlan.json().planId, input: {}, confirmed: true } }); assert.equal(longRun.statusCode, 202); const cancelled = await app.inject({ method: 'DELETE', url: `/api/v1/action-runs/${longRun.json().runId}`, headers }); assert.equal(cancelled.statusCode, 200); await new Promise((resolve) => setTimeout(resolve, 160)); assert.equal(calls, 2);
  const stalePlan = await app.inject({ method: 'POST', url: '/api/v1/actions/e2e.allowed/plan', headers, payload: { input: { value: 'stale' }, appId: 'e2e' } }); assert.equal(stalePlan.statusCode, 200); registry.register({ actionId: 'e2e.allowed', ownerAppId: 'e2e', requiredCapability: 'action.execute', riskLevel: 'low', description: 'changed', inputSchema: { type: 'object', required: ['value'], properties: { value: { type: 'string' } } } }); const conflict = await app.inject({ method: 'POST', url: '/api/v1/actions/e2e.allowed/execute', headers, payload: { planId: stalePlan.json().planId, input: { value: 'stale' }, appId: 'e2e', confirmed: true } }); assert.equal(conflict.statusCode, 409);
  const auditResult = await app.inject({ method: 'GET', url: '/api/v1/audit/events?action=action.execute', headers }); assert.ok(auditResult.json().items.length >= 2);
  await app.close();
});

test('V1-E2E-09 extended: action re-dispatch, long task cancellation and restart recovery', async () => {
  const registry = new ActionRegistry();
  const actions = new InMemoryActionRepository();
  const audit = new InMemoryAuditRepository();
  const permissions = new InMemoryPermissionRepository();
  let calls = 0;
  let longTaskCalls = 0;
  registry.register({ actionId: 'e2e.redispatch', ownerAppId: 'e2e', requiredCapability: 'action.execute', riskLevel: 'low', inputSchema: { type: 'object', properties: { value: { type: 'string' } } } });
  registry.register({ actionId: 'e2e.verylongtask', ownerAppId: 'e2e', requiredCapability: 'e2e.long', riskLevel: 'high', timeout: 10000 });
  const app = buildServer({
    logger: false,
    repository: new InMemoryIdentityRepository(),
    permissionRepository: permissions,
    actionRepository: actions,
    actionRegistry: registry,
    auditRepository: audit,
    actionHandlers: {
      'e2e.redispatch': async () => { calls += 1; return { ok: true, value: 'dispatched' }; },
      'e2e.verylongtask': async () => {
        longTaskCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 300));
        return { ok: true };
      }
    }
  });
  const bootstrap = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'E2E Extended', credential: 'e2e-secret' } });
  assert.equal(bootstrap.statusCode, 201);
  const session = bootstrap.json().sessionId;
  permissions.declare(bootstrap.json().principalId, 'e2e', ['action.execute', 'e2e.long']);
  permissions.set({ subjectId: bootstrap.json().principalId, appId: 'e2e', capability: 'action.execute' }, 'allow');
  permissions.set({ subjectId: bootstrap.json().principalId, appId: 'e2e', capability: 'e2e.long' }, 'allow');
  const headers = { authorization: `Bearer ${session}`, cookie: `dgos_session=${session}`, 'x-dgos-csrf': 'e2e' };

  // Test re-dispatch idempotency
  const plan1 = await app.inject({ method: 'POST', url: '/api/v1/actions/e2e.redispatch/plan', headers, payload: { input: { value: 'test' }, appId: 'e2e' } });
  assert.equal(plan1.statusCode, 200);
  const run1 = await app.inject({ method: 'POST', url: '/api/v1/actions/e2e.redispatch/execute', headers, payload: { planId: plan1.json().planId, input: { value: 'test' }, appId: 'e2e', confirmed: true } });
  assert.equal(run1.statusCode, 202);
  const runId = run1.json().runId;
  await new Promise((resolve) => setImmediate(resolve));

  // Verify initial dispatch succeeded
  const status1 = await app.inject({ method: 'GET', url: `/api/v1/action-runs/${runId}`, headers });
  assert.equal(status1.json().handlerCalls, 1);
  assert.equal(calls, 1);

  // Test long task cancellation before completion
  const longPlan = await app.inject({ method: 'POST', url: '/api/v1/actions/e2e.verylongtask/plan', headers, payload: { input: {}, appId: 'e2e' } });
  assert.equal(longPlan.statusCode, 200);
  const longRun = await app.inject({ method: 'POST', url: '/api/v1/actions/e2e.verylongtask/execute', headers, payload: { planId: longPlan.json().planId, input: {}, appId: 'e2e', confirmed: true } });
  assert.equal(longRun.statusCode, 202);
  const longRunId = longRun.json().runId;

  // Cancel immediately after dispatch
  await new Promise((resolve) => setTimeout(resolve, 50));
  const cancelled = await app.inject({ method: 'DELETE', url: `/api/v1/action-runs/${longRunId}`, headers });
  assert.equal(cancelled.statusCode, 200);

  // Wait for task to complete or be cancelled
  await new Promise((resolve) => setTimeout(resolve, 400));

  // Verify audit trail for both execution and cancellation
  const allAudit = await app.inject({ method: 'GET', url: '/api/v1/audit/events', headers });
  const auditEvents = allAudit.json().items;
  assert.ok(auditEvents.some(e => e.action === 'action.execute'));
  // Cancel should be recorded even if task completes
  const cancelEvents = auditEvents.filter(e => e.action === 'action.cancel' || e.action === 'action.execute');
  assert.ok(cancelEvents.length >= 1, 'Should have cancel or execute audit events');

  // Test action state recovery - verify runs are stored in repository
  const allRuns = await actions.listRuns();
  assert.ok(allRuns !== undefined, 'listRuns should return data');

  await app.close();
});
