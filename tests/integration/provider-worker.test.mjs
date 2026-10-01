import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemorySecretService } from '../../src/security/secret-service.mjs';
import { InMemoryProviderRepository } from '../../src/provider/repository.mjs';
import { ProviderTestWorker } from '../../apps/worker/src/provider-test-worker.mjs';

test('provider worker claims queued tests and converges them once', async () => {
  const repository = new InMemoryProviderRepository();
  const secretService = new InMemorySecretService();
  const ownerId = 'owner';
  const account = await repository.createAccount({ ownerId, protocolType: 'fixture', displayName: 'Fixture', credentialRef: 'fixture-secret' });
  await secretService.put({ secretRef: 'fixture-secret', value: 'secret', purpose: 'provider-account', subjectId: ownerId });
  const queued = await repository.createConnectionTest({ requestId: 'request-1', accountId: account.accountId, accountVersion: '1', configVersion: '1', protocolVersion: 'v1' });
  const worker = new ProviderTestWorker({ repository, secretService, egress: {}, adapters: { fixture: { async probe() { return { status: 'ok' }; } } }, workerId: 'worker-1' });
  const finished = await worker.runOnce();
  assert.equal(finished.testId, queued.testId);
  assert.equal(finished.status, 'succeeded');
  assert.equal(await worker.runOnce(), undefined);
});

test('expired provider worker lease can be reclaimed', async () => {
  let now = 1000;
  const repository = new InMemoryProviderRepository();
  const queued = await repository.createConnectionTest({ requestId: 'request-2', accountId: 'missing', accountVersion: '1', configVersion: '1', protocolVersion: 'v1' });
  const first = await repository.claimConnectionTest('worker-a', 10);
  now += 11;
  first.leaseUntil = 1000;
  const second = await repository.claimConnectionTest('worker-b', 10);
  assert.equal(second.testId, queued.testId);
});
