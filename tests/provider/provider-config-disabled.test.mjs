import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryProviderConfigRepository } from '../../src/provider-config/repository.mjs';
import { ProviderConfigService } from '../../src/provider-config/service.mjs';
import { createTaskAdmission } from '../../src/provider-config/task-admission.mjs';

test('failed validation disables new task admission until explicit refresh', async () => {
  const repository = new InMemoryProviderConfigRepository();
  const account = { accountId: 'account', ownerId: 'owner', protocolType: 'fixture', status: 'ready', _secretRef: 'fixture-ref' };
  const accountRepository = { async getAccount() { return account; } };
  let fails = false;
  const registry = { get() { return { protocolVersion: 'v1', async validate() { if (fails) throw Object.assign(new Error('authentication_failed'), { errorKey: 'authentication_failed' }); return { descriptorVersion: 'text.v1' }; }, async listModels() { return [{ modelId: 'text', taskModes: ['text.chat'] }]; } }; } };
  const service = new ProviderConfigService({ repository, accountRepository, registry, egress: { async validateTarget() {} }, audit: { async record() {} }, secretService: { async resolve() { return { async read() { return 'fixture'; } }; } } });
  const config = await service.create({ ownerId: 'owner', providerAccountId: 'account', protocolType: 'fixture', baseUrl: 'https://provider.fixture.test', displayName: 'Fixture', requestId: 'create' });
  await service.validate(config.id, 'owner', 'validate-1');
  await service.refresh(config.id, 'owner', 'refresh-1');
  await service.policy(config.id, 'owner', { modelId: 'text', enabled: true, assignedCapabilities: ['text'], baseVersion: '0' });
  const admission = createTaskAdmission({ configRepository: repository, accountRepository, registry });
  const input = { ownerId: 'owner', providerConfigId: config.id, modelId: 'text', intent: 'text.chat' };
  assert.equal((await admission(input)).model.modelId, 'text');
  fails = true;
  await assert.rejects(service.validate(config.id, 'owner', 'validate-2'), (error) => error.message === 'authentication_failed');
  await assert.rejects(admission(input), (error) => error.errorKey === 'provider_config_disabled');
  fails = false;
  await service.validate(config.id, 'owner', 'validate-3');
  await assert.rejects(admission(input), (error) => error.errorKey === 'model_catalog_stale');
  await service.refresh(config.id, 'owner', 'refresh-2');
  assert.equal((await admission(input)).model.modelId, 'text');
});
