import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTextProfile, resolveTextProfile } from '../../src/provider-config/text-profile.mjs';
import { normalizeTextExecution, normalizeRequestParameters } from '../../src/provider-config/text-parameters.mjs';
import { createOpenAiCompatibleAdapter } from '../../src/provider-adapters/openai-compatible.mjs';
import { ProviderConfigService } from '../../src/provider-config/service.mjs';
import { InMemoryProviderConfigRepository } from '../../src/provider-config/repository.mjs';

const declaration = { schemaVersion: 'dgos-capability/v1', kind: 'model', id: 'fixture.text', version: '1.0.0', executor: { type: 'declarative', engine: 'dgos-text-v1' }, capabilities: ['text.chat'], operations: { submit: { profile: 'responses', method: 'POST', path: '/responses' } }, workflows: { 'text.chat': { submit: 'submit' } }, defaults: { temperature: 0.5 }, limits: { maxInputCharacters: 3, maxOutputTokens: 20 }, uiSchemas: { parameters: ['temperature'] }, modelProfiles: { exact: { modelNames: ['fixture-model'], workflow: 'text.chat', defaults: { maxOutputTokens: 9 }, limits: { maxOutputTokens: 12 }, uiSchemas: { parameters: ['maxOutputTokens'] } } }, assets: {} };

test('parameter merge is per key, limits tighten, and text counts Unicode scalars', () => {
  const profile = resolveTextProfile(declaration, 'fixture-model');
  assert.deepEqual(profile.defaults, { temperature: 0.5, maxOutputTokens: 9 });
  assert.deepEqual(profile.limits, { maxInputCharacters: 3, maxOutputTokens: 12 });
  const adapter = createOpenAiCompatibleAdapter();
  const execution = normalizeTextExecution({ adapter, textProfile: profile, parameters: { temperature: 0.7 }, input: 'a😀b' });
  assert.deepEqual(execution.normalizedParameters, { temperature: 0.7, maxOutputTokens: 9 });
  assert.deepEqual(execution.uiSchemas, { parameters: ['maxOutputTokens'] });
  for (const parameters of [{ maxOutputTokens: 13 }, { unknown: true }, { temperature: NaN }, { temperature: Infinity }, { maxOutputTokens: 1.2 }, { maxOutputTokens: '2' }]) assert.throws(() => normalizeTextExecution({ adapter, textProfile: profile, parameters, input: 'a' }), { errorKey: 'invalid_request' });
  assert.throws(() => normalizeTextExecution({ adapter, textProfile: profile, input: '😀😀😀😀' }), { errorKey: 'invalid_request' });
  assert.throws(() => normalizeTextExecution({ adapter, textProfile: profile, input: '\uD800' }), { errorKey: 'invalid_request' });
  assert.throws(() => normalizeRequestParameters(null), { errorKey: 'invalid_request' });
  assert.throws(() => resolveTextProfile({ ...declaration, modelProfiles: { ...declaration.modelProfiles, duplicate: declaration.modelProfiles.exact } }, 'fixture-model'), { errorKey: 'capability_mismatch' });
  assert.throws(() => validateTextProfile({ ...declaration, defaults: { temperature: Infinity } }), { errorKey: 'protocol_mismatch' });
});

test('catalog refresh rolls back on audit failure and rejects stale config version', async () => {
  const repository = new InMemoryProviderConfigRepository();
  const config = await repository.create({ ownerId: 'owner', providerAccountId: 'account', protocolType: 'openai-compatible', baseUrl: 'https://fixture.test/v1', displayName: 'Fixture', requestId: 'create' });
  await repository.state(config.id, config.version, 'ready', 'text.v1');
  const audit = { async record() { throw new Error('audit_unavailable'); } };
  const service = new ProviderConfigService({ repository, accountRepository: { async getAccount() { return { accountId: 'account', ownerId: 'owner', status: 'ready', _secretRef: 'fixture-ref' }; } }, secretService: { async resolve() { return { async read() { return 'fixture-token'; } }; } }, registry: { get: () => ({ async listModels() { return [{ modelId: 'fixture-model', taskModes: ['text.chat'] }]; } }) }, egress: { async validateTarget() {} }, audit });
  await assert.rejects(service.refresh(config.id, 'owner', 'refresh'), /audit_unavailable/);
  assert.equal(await repository.getCatalog(config.id), undefined);
  const oldCatalog = await repository.replaceCatalog(config.id, [{ modelId: 'old-model', taskModes: ['text.chat'] }]);
  await assert.rejects(service.refresh(config.id, 'owner', 'refresh-again'), /audit_unavailable/);
  assert.deepEqual(await repository.getCatalog(config.id), oldCatalog);
  await assert.rejects(repository.replaceCatalog(config.id, [], undefined, '1'), { errorKey: 'version_conflict' });
});
