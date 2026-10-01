import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../apps/api/src/server.mjs';

test('quota API enforces scopes and provides preflight, reserve, settle, query and policy contract', async () => {
  const app = buildServer({ logger: false });
  const bootstrap = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'Quota Admin', credential: 'quota-secret' } });
  const sessionId = bootstrap.json().sessionId;
  const policy = await app.inject({ method: 'PUT', url: '/api/v1/quota/policies', headers: { authorization: `Bearer ${sessionId}` }, payload: { scopeType: 'subject', scopeId: bootstrap.json().principalId, metric: 'requests', windowSeconds: 3600, hardLimit: 3, softLimit: 2 } });
  assert.equal(policy.statusCode, 200);
  const base = { subjectId: bootstrap.json().principalId, scopeType: 'subject', scopeId: bootstrap.json().principalId, metric: 'requests', taskId: randomUUID(), attemptId: randomUUID(), amount: 1 };
  const preflight = await app.inject({ method: 'POST', url: '/api/v1/quota/preflight', headers: { authorization: `Bearer ${sessionId}` }, payload: base }); assert.equal(preflight.statusCode, 200); assert.equal(preflight.json().decision, 'allow');
  const reserved = await app.inject({ method: 'POST', url: '/api/v1/quota/reservations', headers: { authorization: `Bearer ${sessionId}` }, payload: base }); assert.equal(reserved.statusCode, 201);
  const settled = await app.inject({ method: 'POST', url: `/api/v1/quota/reservations/${reserved.json().reservationId}/settle`, headers: { authorization: `Bearer ${sessionId}` }, payload: { amount: 1, usageStatus: 'final' } }); assert.equal(settled.statusCode, 200); assert.ok(settled.json().usage.usageEventId);
  const usage = await app.inject({ method: 'GET', url: `/api/v1/usage?from=2020-01-01T00:00:00.000Z&to=2999-01-01T00:00:00.000Z`, headers: { authorization: `Bearer ${sessionId}` } }); assert.equal(usage.statusCode, 200); assert.equal(usage.json().items.length, 1);
  const denied = await app.inject({ method: 'POST', url: '/api/v1/quota/preflight', payload: base }); assert.equal(denied.statusCode, 401);
  await app.close();
});
