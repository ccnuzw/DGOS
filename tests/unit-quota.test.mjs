import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { InMemoryQuotaRepository } from '../src/quota/repository.mjs';
import { QuotaService } from '../src/quota/service.mjs';

const ids = () => ({ subjectId: '11111111-1111-4111-8111-111111111111', taskId: randomUUID(), attemptId: randomUUID(), metric: 'requests', scopeType: 'subject', scopeId: '11111111-1111-4111-8111-111111111111' });

test('quota preflight and reservation are bounded and idempotent', async () => {
  const repository = new InMemoryQuotaRepository(); const service = new QuotaService({ repository }); const base = ids();
  await service.updatePolicy({ ...base, metric: 'requests', windowSeconds: 3600, hardLimit: 2, softLimit: 1, effectiveAt: new Date().toISOString(), requestId: randomUUID() });
  assert.equal((await service.preflightQuota({ ...base, amount: 1 })).decision, 'allow');
  const one = await service.reserveQuota({ ...base, amount: 1, requestId: randomUUID() });
  assert.equal((await service.reserveQuota({ ...base, amount: 1, requestId: one.requestId })).reservationId, one.reservationId);
  const extra = ids();
  await assert.rejects(() => service.reserveQuota({ ...extra, subjectId: base.subjectId, scopeType: base.scopeType, scopeId: base.scopeId, metric: base.metric, amount: 2, requestId: randomUUID(), taskId: randomUUID(), attemptId: randomUUID() }), /quota_exceeded/);
  assert.equal((await service.preflightQuota({ ...base, amount: 2 })).decision, 'deny');
});

test('settlement handles terminal states, missing usage and replay', async () => {
  const repository = new InMemoryQuotaRepository(); const service = new QuotaService({ repository }); const base = ids();
  await service.updatePolicy({ ...base, metric: 'requests', windowSeconds: 3600, hardLimit: 10, effectiveAt: new Date().toISOString(), requestId: randomUUID() });
  for (const [state, usageStatus] of [['succeeded','final'],['failed','unavailable'],['cancelled',null],['timed_out','estimated']]) {
    const taskId = randomUUID(); const attemptId = randomUUID();
    const input = { subjectId: base.subjectId, scopeType: base.scopeType, scopeId: base.scopeId, metric: base.metric, amount: 1, requestId: randomUUID(), taskId, attemptId };
    const terminalState = state === 'succeeded' ? 'completed' : state === 'timed_out' ? 'timed_out' : state;
    const reservation = await service.reserveQuota(input);
    const stored = await repository.getReservation(reservation.reservationId);
    assert.equal(stored.taskId, input.taskId);
    assert.equal(stored.attemptId, input.attemptId);
    const result = await service.settleUsage({ reservationId: reservation.reservationId, requestId: input.requestId, taskId: input.taskId, attemptId: input.attemptId, terminalState, release: state === 'cancelled', amount: 1, usageStatus, estimated: state === 'timed_out' }, { actorId: base.subjectId, subjectId: base.subjectId });
    assert.ok(['reserved', 'settled', 'released'].includes(result.state));
    if (state !== 'cancelled') {
      assert.ok(result.usageEventId);
      const replay = await service.settleUsage({ reservationId: reservation.reservationId, requestId: randomUUID(), taskId: input.taskId, attemptId: input.attemptId, terminalState, amount: 1, usageStatus }, { actorId: base.subjectId, subjectId: base.subjectId });
      assert.equal(replay.usageEventId, result.usageEventId);
    }
  }
});

test('usage query is subject isolated and reconciliation expires reservations', async () => {
  const repository = new InMemoryQuotaRepository(); const service = new QuotaService({ repository }); const base = ids();
  await service.updatePolicy({ ...base, metric: 'requests', windowSeconds: 60, hardLimit: 10, effectiveAt: new Date().toISOString(), requestId: randomUUID() });
  const reservation = await service.reserveQuota({ ...base, amount: 1, requestId: randomUUID(), expiresAt: new Date(Date.now() - 1000).toISOString() });
  const repair = await service.reconcile(); assert.equal(repair.repaired, 1); assert.equal((await service.queryUsage({ subjectId: 'other', from: new Date(0).toISOString(), to: new Date().toISOString() }, { actorId: 'other', subjectId: 'other' })).items.length, 0); assert.equal((await repository.getReservation(reservation.reservationId)).state, 'expired');
});

test('quota rejects unbounded values and cross-subject settlement without mutation', async () => {
  const repository = new InMemoryQuotaRepository(); const service = new QuotaService({ repository, clock: () => Date.now() }); const base = ids();
  const policy = { ...base, windowSeconds: 3600, hardLimit: 2, effectiveAt: new Date(Date.now() - 1000).toISOString(), requestId: randomUUID() };
  for (const hardLimit of [-1, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) await assert.rejects(() => service.updatePolicy({ ...policy, hardLimit }), /invalid_request/);
  for (const windowSeconds of [0, 1.5, Infinity, 2147483648]) await assert.rejects(() => service.updatePolicy({ ...policy, windowSeconds }), /invalid_request/);
  await assert.rejects(() => service.updatePolicy({ ...policy, effectiveAt: 'no-date' }), /invalid_request/);
  await service.updatePolicy(policy);
  for (const amount of [-1, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '1']) await assert.rejects(() => service.reserveQuota({ ...base, requestId: randomUUID(), amount }), /invalid_request/);
  const requestId = randomUUID(); const reservation = await service.reserveQuota({ ...base, requestId, amount: 1 });
  const settle = { reservationId: reservation.reservationId, requestId, taskId: base.taskId, attemptId: base.attemptId, terminalState: 'completed', amount: 1, usageStatus: 'final' };
  await assert.rejects(() => service.settleUsage(settle, { actorId: randomUUID(), subjectId: base.subjectId }), /insufficient_scope/);
  await assert.rejects(() => service.settleUsage(settle, { actorId: base.subjectId, subjectId: randomUUID(), admin: true }), /insufficient_scope/);
  await assert.rejects(() => service.reserveQuota({ ...base, scopeId: randomUUID(), requestId: randomUUID(), amount: 1 }), /insufficient_scope/);
  await assert.rejects(() => service.queryUsage({ subjectId: base.subjectId, from: new Date(0).toISOString(), to: new Date().toISOString() }, { actorId: randomUUID(), subjectId: base.subjectId }), /insufficient_scope/);
  assert.equal((await repository.getReservation(reservation.reservationId)).state, 'reserved'); assert.equal(repository.usage.size, 0);
  await service.settleUsage(settle, { actorId: base.subjectId, subjectId: base.subjectId });
  assert.equal((await service.settleUsage(settle, { actorId: randomUUID(), subjectId: base.subjectId, admin: true })).state, 'settled');
  assert.equal((await repository.queryUsage({ subjectId: base.subjectId, from: new Date(0).toISOString(), to: new Date(Date.now() + 1000).toISOString() })).items.length, 1);
});

test('quota policy update and reserve share a lock and use the newest effective policy', async () => {
  const repository = new InMemoryQuotaRepository(); const service = new QuotaService({ repository }); const base = ids();
  const policy = { ...base, windowSeconds: 3600, hardLimit: 1, effectiveAt: new Date(Date.now() - 1000).toISOString(), requestId: randomUUID() };
  await service.updatePolicy(policy);
  const release = await repository.lockQuotaWindow(base);
  const update = service.updatePolicy({ ...policy, requestId: randomUUID(), baseVersion: 1, hardLimit: 0 });
  const reserve = service.reserveQuota({ ...base, requestId: randomUUID(), amount: 1 });
  release();
  await update;
  await assert.rejects(reserve, /quota_exceeded/);
  assert.equal(repository.reservations.size, 0);
});

test('quota audit failure rolls back reservation and policy; uncertain reservation holds capacity', async () => {
  const repository = new InMemoryQuotaRepository(); const service = new QuotaService({ repository }); const base = ids();
  repository.writeAudit = async () => { throw new Error('audit_failed'); };
  const policy = { ...base, windowSeconds: 3600, hardLimit: 1, effectiveAt: new Date(Date.now() - 1000).toISOString(), requestId: randomUUID() };
  await assert.rejects(() => service.updatePolicy(policy), /audit_failed/); assert.equal(repository.policies.length, 0);
  delete repository.writeAudit;
  await service.updatePolicy(policy);
  repository.writeAudit = async () => { throw new Error('audit_failed'); };
  await assert.rejects(() => service.reserveQuota({ ...base, requestId: randomUUID(), amount: 1 }), /audit_failed/); assert.equal(repository.reservations.size, 0);
  delete repository.writeAudit;
  const reservation = await service.reserveQuota({ ...base, requestId: randomUUID(), amount: 1 });
  repository.reservations.get(reservation.reservationId).expiresAt = new Date(Date.now() - 1000).toISOString();
  assert.equal(await repository.reservedAmount({ ...base, windowStart: (await repository.getReservation(reservation.reservationId)).windowStart }), 1);
  repository.reservations.get(reservation.reservationId).state = 'needs_review';
  await assert.rejects(() => service.reserveQuota({ ...ids(), subjectId: base.subjectId, scopeId: base.scopeId, requestId: randomUUID(), amount: 1 }), /quota_exceeded/);
  repository.usage.set(`${base.taskId}:${base.attemptId}:${base.metric}`, { taskId: base.taskId, attemptId: base.attemptId, metric: base.metric, amount: 1 });
  assert.equal(await repository.reservedAmount({ ...base, windowStart: (await repository.getReservation(reservation.reservationId)).windowStart }), 1);
});
