import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../apps/api/src/server.mjs';
import { InMemoryIdentityRepository } from '../../src/identity/repository.mjs';
import { InMemoryAuditRepository } from '../../src/audit/outbox.mjs';

test('quota API enforces scopes and provides preflight, reserve, settle, query and policy contract', async () => {
  const app = buildServer({ logger: false, repository: new InMemoryIdentityRepository(), auditRepository: new InMemoryAuditRepository() });
  const bootstrap = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'Quota Admin', credential: 'quota-secret' } });
  const sessionId = bootstrap.json().sessionId;
  const policy = await app.inject({ method: 'PUT', url: '/api/v1/quota/policies', headers: { authorization: `Bearer ${sessionId}` }, payload: { requestId: randomUUID(), baseVersion: '0', scope: { type: 'subject', id: bootstrap.json().principalId }, metric: 'requests', window: 'hour', limit: 3, softLimit: 2, effectiveAt: new Date().toISOString() } });
  assert.equal(policy.statusCode, 200);
  const base = { requestId: randomUUID(), target: { subjectId: bootstrap.json().principalId, scopeType: 'subject', scopeId: bootstrap.json().principalId }, metric: 'requests', taskId: randomUUID(), attemptId: randomUUID(), amount: 1 };
  const preflight = await app.inject({ method: 'POST', url: '/api/v1/quota/preflight', headers: { authorization: `Bearer ${sessionId}` }, payload: base }); assert.equal(preflight.statusCode, 200); assert.equal(preflight.json().decision, 'allow');
  const reserved = await app.inject({ method: 'POST', url: '/api/v1/quota/reservations', headers: { authorization: `Bearer ${sessionId}` }, payload: base }); assert.equal(reserved.statusCode, 201, reserved.body);
  const settled = await app.inject({ method: 'POST', url: `/api/v1/quota/reservations/${reserved.json().reservationId}/settle`, headers: { authorization: `Bearer ${sessionId}` }, payload: { requestId: randomUUID(), taskId: base.taskId, attemptId: base.attemptId, terminalState: 'completed', usage: { totalTokens: 1, status: 'final' } } }); assert.equal(settled.statusCode, 200); assert.ok(settled.json().usageEventId);
  const usage = await app.inject({ method: 'GET', url: `/api/v1/usage?from=2020-01-01T00:00:00.000Z&to=2999-01-01T00:00:00.000Z`, headers: { authorization: `Bearer ${sessionId}` } }); assert.equal(usage.statusCode, 200); assert.equal(usage.json().items.length, 1);
  const denied = await app.inject({ method: 'POST', url: '/api/v1/quota/preflight', payload: base }); assert.equal(denied.statusCode, 401);
  await app.close();
});
