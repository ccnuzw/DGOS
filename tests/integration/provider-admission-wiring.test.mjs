import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../../apps/api/src/server.mjs';
import { ProviderTestWorker } from '../../apps/worker/src/provider-test-worker.mjs';
import { InMemoryIdentityRepository } from '../../src/identity/repository.mjs';
import { InMemoryAuditRepository } from '../../src/audit/outbox.mjs';
import { InMemoryProviderRepository } from '../../src/provider/repository.mjs';
import { InMemoryProviderConfigRepository } from '../../src/provider-config/repository.mjs';
import { InMemoryAiTaskRepository } from '../../src/ai-task/repository.mjs';
import { InMemorySecretService } from '../../src/security/secret-service.mjs';

const endpoint = 'https://provider.invalid/v1';
const modelId = 'fixture-text-model';

test('public task admission rejects incomplete Provider state without enqueueing and preserves existing task', async () => {
  const providerRepository = new InMemoryProviderRepository();
  const configRepository = new InMemoryProviderConfigRepository();
  const taskRepository = new InMemoryAiTaskRepository();
  const secretService = new InMemorySecretService();
  const egress = { async validateTarget(url) { assert.equal(url, endpoint); } };
  let failValidation = false;
  let reserves = 0;
  const adapter = {
    protocolType: 'openai-compatible', protocolVersion: 'v1', descriptorVersion: 'text.v1',
    taskModes: ['text.chat'], streamingText: true, cancellation: true, modelListing: true,
    async validate() {
      if (failValidation) throw Object.assign(new Error('protocol_mismatch'), { errorKey: 'protocol_mismatch' });
      return { descriptorVersion: 'text.v1', inputs: ['text'], outputs: ['text'], taskModes: ['text.chat'] };
    },
    async listModels() { return [{ modelId, displayName: 'Fixture model', taskModes: ['text.chat'], streaming: true }]; },
  };
  const app = buildServer({
    logger: false, repository: new InMemoryIdentityRepository(), auditRepository: new InMemoryAuditRepository(),
    providerRepository, providerConfigRepository: configRepository, aiTaskRepository: taskRepository,
    secretService, providerAdapters: [adapter], providerEgress: egress,
    dispatchTask: async () => {}, quotaAdapter: { preflight: async () => ({ decision: 'allow' }), reserve: async () => { reserves += 1; return { reservationId: 'unused' }; } },
  });
  try {
    const bootstrap = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'Admission Owner', credential: 'owner-password' } });
    assert.equal(bootstrap.statusCode, 201, bootstrap.body);
    const auth = { authorization: `Bearer ${bootstrap.json().sessionId}` };
    const post = (url, payload) => app.inject({ method: 'POST', url, headers: auth, payload });
    const accountResponse = await post('/api/v1/provider/accounts', { protocolType: 'openai-compatible', displayName: 'Fixture', credential: 'fixture-secret', scope: { endpoint } });
    assert.equal(accountResponse.statusCode, 201, accountResponse.body);
    const account = accountResponse.json();
    assert.equal(account.status, 'credential_pending');
    const configResponse = await post('/api/v1/provider/configs', { requestId: 'config-1', providerAccountId: account.accountId, protocolType: 'openai-compatible', displayName: 'Fixture config', baseUrl: endpoint });
    assert.equal(configResponse.statusCode, 201, configResponse.body);
    const configId = configResponse.json().id;
    let requestNumber = 0;
    const submit = (providerConfigId = configId) => post('/api/v1/ai-tasks', { requestId: `admission-${++requestNumber}`, target: 'text', intent: 'text.chat', input: { text: 'hello' }, options: { providerConfigId, modelId } });
    const noTask = () => { assert.equal(taskRepository.tasks.size, 0); assert.equal(taskRepository.attempts.size, 0); assert.equal(reserves, 0); };

    const draft = await submit();
    assert.equal(draft.statusCode, 422, draft.body);
    assert.equal(draft.json().errorKey, 'provider_config_disabled');
    noTask();

    const validated = await post(`/api/v1/provider/configs/${configId}/validate`, { requestId: 'validate-1' });
    assert.equal(validated.statusCode, 200, validated.body);
    const unrefreshed = await app.inject({ method: 'GET', url: `/api/v1/provider/configs/${configId}/models`, headers: auth });
    assert.equal(unrefreshed.json().catalogVersion, '0');
    const pendingAccount = await submit();
    assert.equal(pendingAccount.statusCode, 422, pendingAccount.body);
    assert.equal(pendingAccount.json().errorKey, 'provider_account_disabled');
    noTask();

    const connection = await post('/api/v1/provider/connection-tests', { requestId: 'test-1', accountId: account.accountId, accountVersion: account.version, protocolVersion: 'v1' });
    assert.equal(connection.statusCode, 202, connection.body);
    const worker = new ProviderTestWorker({ repository: providerRepository, configRepository, secretService, egress, adapters: { 'openai-compatible': { protocolVersion: 'v1', async probe({ credential }) { assert.equal(credential, 'fixture-secret'); } } } });
    const finished = await worker.runOnce();
    assert.equal(finished.status, 'succeeded');
    assert.equal(finished.testId, connection.json().testId);
    const ready = await post(`/api/v1/provider/accounts/${account.accountId}/state`, { requestId: 'account-ready', baseVersion: account.version, state: 'ready', connectionTestId: finished.testId });
    assert.equal(ready.statusCode, 200, ready.body);
    const stale = await submit();
    assert.equal(stale.statusCode, 422, stale.body);
    assert.equal(stale.json().errorKey, 'model_catalog_stale');
    noTask();

    const refreshed = await post(`/api/v1/provider/configs/${configId}/models`, { requestId: 'refresh-1' });
    assert.equal(refreshed.statusCode, 200, refreshed.body);
    const policy = await post(`/api/v1/provider/configs/${configId}/model-policies`, { requestId: 'policy-1', modelId, enabled: true, assignedCapabilities: ['text'], defaultFor: [], baseVersion: '0' });
    assert.equal(policy.statusCode, 200, policy.body);
    const accepted = await submit();
    assert.equal(accepted.statusCode, 202, accepted.body);
    const taskId = accepted.json().taskId;
    assert.equal(taskRepository.tasks.size, 1);

    const disabledAccount = await post(`/api/v1/provider/accounts/${account.accountId}/state`, { requestId: 'account-disabled', baseVersion: ready.json().version, state: 'disabled' });
    assert.equal(disabledAccount.statusCode, 200, disabledAccount.body);
    const denied = await submit();
    assert.equal(denied.statusCode, 422, denied.body);
    assert.equal(denied.json().errorKey, 'provider_account_disabled');
    assert.equal(taskRepository.tasks.size, 1);
    const existing = await app.inject({ method: 'GET', url: `/api/v1/ai-tasks/${taskId}`, headers: auth });
    assert.equal(existing.statusCode, 200, existing.body);
    assert.equal(existing.json().taskId, taskId);

    const secondConfig = await post('/api/v1/provider/configs', { requestId: 'config-2', providerAccountId: account.accountId, protocolType: 'openai-compatible', displayName: 'Failing config', baseUrl: endpoint });
    assert.equal(secondConfig.statusCode, 201, secondConfig.body);
    failValidation = true;
    const disabled = await post(`/api/v1/provider/configs/${secondConfig.json().id}/validate`, { requestId: 'validate-fail' });
    assert.equal(disabled.statusCode, 422, disabled.body);
    const configState = await app.inject({ method: 'GET', url: '/api/v1/provider/configs', headers: auth });
    assert.equal(configState.json().items.find((item) => item.id === secondConfig.json().id).status, 'disabled');
    const disabledSubmission = await submit(secondConfig.json().id);
    assert.equal(disabledSubmission.statusCode, 422, disabledSubmission.body);
    assert.equal(disabledSubmission.json().errorKey, 'provider_config_disabled');
    assert.equal(taskRepository.tasks.size, 1);
    assert.equal(taskRepository.attempts.size, 1);
    assert.equal(reserves, 0);
    const surviving = await app.inject({ method: 'GET', url: `/api/v1/ai-tasks/${taskId}`, headers: auth });
    assert.equal(surviving.statusCode, 200, surviving.body);
    assert.equal(surviving.json().taskId, taskId);
  } finally { await app.close(); }
});
