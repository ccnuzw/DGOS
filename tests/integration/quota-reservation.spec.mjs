import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryQuotaRepository } from '../../src/quota/repository.mjs';
import { QuotaService } from '../../src/quota/service.mjs';
import { randomUUID } from 'node:crypto';

test('V1-E2E-15 reservation hard limit and stable replay', async () => {
  const repository = new InMemoryQuotaRepository();
  const service = new QuotaService({ repository });
  const subjectId = randomUUID();
  const base = { subjectId, scopeType: 'subject', scopeId: subjectId, metric: 'requests', windowSeconds: 3600, hardLimit: 2, softLimit: 1, effectiveAt: new Date().toISOString() };
  await service.updatePolicy({ ...base, requestId: randomUUID(), actorId: subjectId });
  const requests = Array.from({ length: 5 }, () => ({ ...base, requestId: randomUUID(), taskId: randomUUID(), attemptId: randomUUID(), amount: 1 }));
  const results = await Promise.allSettled(requests.map((input) => service.reserveQuota(input)));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 2);
  const replayInput = requests[0];
  const replay = await service.reserveQuota(replayInput);
  const original = results.find((result) => result.status === 'fulfilled' && result.value.taskId === replayInput.taskId)?.value;
  assert.equal(replay.reservationId, original.reservationId);
});
