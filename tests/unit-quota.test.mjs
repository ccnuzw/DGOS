import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { InMemoryQuotaRepository } from '../src/quota/repository.mjs';
import { QuotaService } from '../src/quota/service.mjs';

const ids = () => ({ subjectId: '11111111-1111-4111-8111-111111111111', taskId: randomUUID(), attemptId: randomUUID(), metric: 'requests', scopeType: 'subject', scopeId: '11111111-1111-4111-8111-111111111111' });

test('quota preflight and reservation are bounded and idempotent', async () => {
  const repository = new InMemoryQuotaRepository(); const service = new QuotaService({ repository }); const base = ids();
  await service.updatePolicy({ ...base, metric: 'requests', windowSeconds: 3600, hardLimit: 2, softLimit: 1, requestId: randomUUID() });
  assert.equal((await service.preflightQuota({ ...base, amount: 1 })).decision, 'allow');
  const one = await service.reserveQuota({ ...base, amount: 1, requestId: randomUUID() });
  assert.equal((await service.reserveQuota({ ...base, amount: 1, requestId: one.requestId })).reservationId, one.reservationId);
  for (let i = 0; i < 2; i += 1) { const extra = ids(); await service.reserveQuota({ ...extra, subjectId: base.subjectId, scopeType: base.scopeType, scopeId: base.scopeId, metric: base.metric, amount: 1, requestId: randomUUID() }); }
  assert.equal((await service.preflightQuota({ ...base, amount: 1 })).decision, 'deny');
});

test('settlement handles terminal states, missing usage and replay', async () => {
  const repository = new InMemoryQuotaRepository(); const service = new QuotaService({ repository }); const base = ids();
  await service.updatePolicy({ ...base, metric: 'requests', windowSeconds: 3600, hardLimit: 10, requestId: randomUUID() });
  for (const [state, usageStatus] of [['succeeded','final'],['failed','unavailable'],['cancelled',null],['timed_out','estimated']]) {
    const taskId = randomUUID(); const attemptId = randomUUID();
    const input = { subjectId: base.subjectId, scopeType: base.scopeType, scopeId: base.scopeId, metric: base.metric, amount: 1, requestId: randomUUID(), taskId, attemptId };
    const reservation = await service.reserveQuota(input); const result = await service.settleUsage({ reservationId: reservation.reservationId, requestId: input.requestId, release: state === 'cancelled', amount: 1, usageStatus, estimated: state === 'timed_out' });
    assert.ok(['reserved', 'settled', 'released'].includes(result.reservation.state));
    if (state !== 'cancelled') assert.equal((await service.settleUsage({ reservationId: reservation.reservationId, requestId: input.requestId, amount: 1, usageStatus })).idempotent, true);
  }
});

test('usage query is subject isolated and reconciliation expires reservations', async () => {
  const repository = new InMemoryQuotaRepository(); const service = new QuotaService({ repository }); const base = ids();
  await service.updatePolicy({ ...base, metric: 'requests', windowSeconds: 60, hardLimit: 10, requestId: randomUUID() });
  const reservation = await service.reserveQuota({ ...base, amount: 1, requestId: randomUUID(), expiresAt: new Date(Date.now() - 1000).toISOString() });
  const repair = await service.reconcile(); assert.equal(repair.repaired, 1); assert.equal((await service.queryUsage({ subjectId: 'other', from: new Date(0).toISOString(), to: new Date().toISOString() })).items.length, 0); assert.equal((await repository.getReservation(reservation.reservationId)).state, 'expired');
});
