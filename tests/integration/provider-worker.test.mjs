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
  const worker = new ProviderTestWorker({ repository, secretService, egress: { async validateTarget() {} }, adapters: { fixture: { async probe() { return { status: 'ok' }; } } }, workerId: 'worker-1' });
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

test('cancelled running probe aborts and converges under its original testId', async () => {
  const repository = new InMemoryProviderRepository();
  const secretService = new InMemorySecretService();
  const account = await repository.createAccount({ ownerId: 'owner', protocolType: 'fixture', displayName: 'Fixture', credentialRef: 'fixture-secret' });
  await secretService.put({ secretRef: 'fixture-secret', value: 'secret', purpose: 'provider-account', subjectId: 'owner' });
  const queued = await repository.createConnectionTest({ requestId: 'cancel-1', accountId: account.accountId, accountVersion: '1', configVersion: '1', protocolVersion: 'v1' });
  const worker = new ProviderTestWorker({ repository, secretService, egress: { async validateTarget() {} }, adapters: { fixture: { async probe({ signal }) { await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true })); throw Object.assign(new Error('cancelled'), { errorKey: 'cancelled' }); } } }, leaseMs: 30, timeoutMs: 500 });
  const pending = worker.runOnce();
  await new Promise((resolve) => setTimeout(resolve, 5));
  await repository.cancelConnectionTest(queued.testId);
  const result = await pending;
  assert.equal(result.testId, queued.testId);
  assert.equal(result.status, 'cancelled');
});

test('late probe success cannot override cancellation or write a second terminal audit', async () => {
  const repository = new InMemoryProviderRepository();
  const secretService = new InMemorySecretService();
  const account = await repository.createAccount({ ownerId: 'owner', protocolType: 'fixture', displayName: 'Fixture', credentialRef: 'fixture-secret' });
  await secretService.put({ secretRef: 'fixture-secret', value: 'secret', purpose: 'provider-account', subjectId: 'owner' });
  const queued = await repository.createConnectionTest({ requestId: 'late-cancel', accountId: account.accountId, accountVersion: '1', configVersion: '1', protocolVersion: 'v1' });
  let enterProbe;
  const entered = new Promise((resolve) => { enterProbe = resolve; });
  let finishProbe;
  const response = new Promise((resolve) => { finishProbe = resolve; });
  const worker = new ProviderTestWorker({ repository, secretService, egress: { async validateTarget() {} }, adapters: { fixture: { async probe() { enterProbe(); await response; return { status: 'ok' }; } } }, leaseMs: 30, timeoutMs: 500 });
  const pending = worker.runOnce();
  await entered;
  await repository.cancelConnectionTest(queued.testId);
  const result = await pending;
  assert.equal(result.status, 'cancelled');
  assert.equal([...repository.audit.events.values()].filter((event) => event.action === 'provider.connection_test.finish').length, 1);
  finishProbe();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal((await repository.getConnectionTest(queued.testId)).status, 'cancelled');
  assert.equal([...repository.audit.events.values()].filter((event) => event.action === 'provider.connection_test.finish').length, 1);
});

test('claimed cancel request records exactly one terminal audit without probing', async () => {
  const repository = new InMemoryProviderRepository();
  const queued = await repository.createConnectionTest({ requestId: 'claimed-cancel', accountId: 'missing', accountVersion: '1', configVersion: '1', protocolVersion: 'v1' });
  const first = await repository.claimConnectionTest('old-worker', 1);
  first.leaseUntil = 0;
  await repository.cancelConnectionTest(queued.testId);
  const worker = new ProviderTestWorker({ repository, egress: { async validateTarget() { throw new Error('unexpected_probe'); } }, adapters: {}, workerId: 'replacement' });
  const result = await worker.runOnce();
  assert.equal(result.status, 'cancelled');
  assert.equal([...repository.audit.events.values()].filter((event) => event.action === 'provider.connection_test.finish').length, 1);
});

test('total deadline ends an unresponsive probe without a false success', async () => {
  const repository = new InMemoryProviderRepository();
  const secretService = new InMemorySecretService();
  const account = await repository.createAccount({ ownerId: 'owner', protocolType: 'fixture', displayName: 'Fixture', credentialRef: 'fixture-secret' });
  await secretService.put({ secretRef: 'fixture-secret', value: 'secret', purpose: 'provider-account', subjectId: 'owner' });
  const queued = await repository.createConnectionTest({ requestId: 'deadline', accountId: account.accountId, accountVersion: '1', configVersion: '1', protocolVersion: 'v1' });
  const worker = new ProviderTestWorker({ repository, secretService, egress: { async validateTarget() {} }, adapters: { fixture: { async probe() { await new Promise(() => {}); } } }, leaseMs: 30, timeoutMs: 25 });
  const result = await worker.runOnce();
  assert.equal(result.testId, queued.testId);
  assert.equal(result.status, 'timed_out');
  assert.equal([...repository.audit.events.values()].filter((event) => event.action === 'provider.connection_test.finish').length, 1);
});
