import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryAiTaskRepository } from '../../src/ai-task/repository.mjs';
import { AiTaskWorker } from '../../apps/worker/src/ai-task-worker.mjs';

test('AI task worker claims queued attempts and reclaims expired leases', async () => {
  const repository = new InMemoryAiTaskRepository();
  const task = await repository.createTask({ ownerId: 'owner', requestId: 'request', target: 'text', intent: 'text.chat', modelId: 'model', providerConfigId: 'config', inputText: 'hello' });
  const attempt = await repository.createAttempt({ taskId: task.taskId, providerConfigId: 'config', providerAccountId: 'account', modelId: 'model' });
  const claimed = await repository.claimAttempt('worker-a', 10);
  assert.equal(claimed.attemptId, attempt.attemptId);
  assert.equal(await repository.claimAttempt('worker-b', 10), undefined);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal((await repository.claimAttempt('worker-b', 10)).attemptId, attempt.attemptId);
});

test('AI task worker passes the claimed attempt and persisted input to the service', async () => {
  const repository = new InMemoryAiTaskRepository();
  const task = await repository.createTask({ ownerId: 'owner', requestId: 'request', target: 'text', intent: 'text.chat', modelId: 'model', providerConfigId: 'config', inputText: 'hello' });
  const attempt = await repository.createAttempt({ taskId: task.taskId, providerConfigId: 'config', providerAccountId: 'account', modelId: 'model' });
  let args;
  const worker = new AiTaskWorker({ repository, taskService: { run: async (...value) => { args = value; } }, workerId: 'worker-a' });
  await worker.runOnce();
  assert.equal(args[0], task.taskId);
  assert.equal(args[1], 'hello');
  assert.equal(args[3].attempt.attemptId, attempt.attemptId);
  assert.equal(repository.attempts.size, 1);
});
