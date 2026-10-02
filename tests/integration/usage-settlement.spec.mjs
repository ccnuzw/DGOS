import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryQuotaRepository } from '../../src/quota/repository.mjs';
import { QuotaService } from '../../src/quota/service.mjs';
import { randomUUID } from 'node:crypto';

test('V1-E2E-15 terminal settlement and release are exactly once', async () => {
  const repository = new InMemoryQuotaRepository();
  const service = new QuotaService({ repository });
  const subjectId = randomUUID();
  const authContext = { subjectId, actorId: subjectId, admin: false };
  const base = { subjectId, scopeType: 'subject', scopeId: subjectId, metric: 'requests', windowSeconds: 3600, hardLimit: 10, effectiveAt: new Date().toISOString() };
  await service.updatePolicy({ ...base, requestId: randomUUID(), actorId: subjectId });
  const reservation = await service.reserveQuota({ ...base, requestId: randomUUID(), taskId: randomUUID(), attemptId: randomUUID(), amount: 1 });
  const settled = await service.settleUsage({ reservationId: reservation.reservationId, requestId: reservation.requestId, taskId: reservation.taskId, attemptId: reservation.attemptId, terminalState: 'failed', amount: 1, unit: 'count', usageStatus: 'unavailable', operation: 'ai.task' }, authContext);
  const replay = await service.settleUsage({ reservationId: reservation.reservationId, requestId: randomUUID(), taskId: reservation.taskId, attemptId: reservation.attemptId, terminalState: 'failed', amount: 999, usageStatus: 'final' }, authContext);
  assert.equal(replay.usageEventId, settled.usageEventId);
  const releaseReservation = await service.reserveQuota({ ...base, requestId: randomUUID(), taskId: randomUUID(), attemptId: randomUUID(), amount: 1 });
  const released = await service.releaseQuota({ reservationId: releaseReservation.reservationId, requestId: releaseReservation.requestId, taskId: releaseReservation.taskId, attemptId: releaseReservation.attemptId, terminalState: 'cancelled' }, authContext);
  const releasedReplay = await service.releaseQuota({ reservationId: releaseReservation.reservationId, requestId: randomUUID(), taskId: releaseReservation.taskId, attemptId: releaseReservation.attemptId, terminalState: 'cancelled' }, authContext);
  assert.equal(released.state, 'released');
  assert.equal(releasedReplay.state, 'released');
});
