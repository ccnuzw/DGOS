import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskAdmission, createModelResolver } from '../../src/provider-config/task-admission.mjs';
import { validateTextProfile, resolveTextProfile } from '../../src/provider-config/text-profile.mjs';
import { InMemoryTextProfileDirectory } from '../../src/provider-config/text-profile-directory.mjs';
import { createOpenAiCompatibleAdapter } from '../../src/provider-adapters/openai-compatible.mjs';
import { InMemoryProviderProtocolConfirmations, protocolDigest } from '../../src/provider-config/protocol-confirmations.mjs';

test('new task admission checks config, account, catalog and policy without task side effects', async () => {
  const config = { providerConfigId: 'config', providerAccountId: 'account', ownerId: 'owner', protocolType: 'openai-compatible', status: 'ready' };
  const account = { accountId: 'account', ownerId: 'owner', protocolType: 'openai-compatible', status: 'ready' };
  const catalog = { status: 'fresh', catalogVersion: '3', items: [{ modelId: 'text-model', taskModes: ['text.chat'] }] };
  const policy = { modelId: 'text-model', enabled: true, assignedCapabilities: ['text'] };
  const admission = createTaskAdmission({ configRepository: { get: async () => config, getCatalog: async () => catalog, listPolicies: async () => [policy] }, accountRepository: { getAccount: async () => account }, registry: { get: () => ({ protocolType: 'openai-compatible' }) } });
  assert.equal((await admission({ ownerId: 'owner', providerConfigId: 'config', modelId: 'text-model', intent: 'text.chat' })).catalogVersion, '3');
  config.status = 'disabled';
  await assert.rejects(admission({ ownerId: 'owner', providerConfigId: 'config', modelId: 'text-model', intent: 'text.chat' }), (error) => error.errorKey === 'provider_config_disabled');
  config.status = 'ready'; policy.enabled = false;
  await assert.rejects(admission({ ownerId: 'owner', providerConfigId: 'config', modelId: 'text-model', intent: 'text.chat' }), (error) => error.errorKey === 'model_not_allowed');
});

test('text profile allows only declared text operations and exact model names', () => {
  const profile = { id: 'fixture.text', version: '1.0.0', kind: 'model', schemaVersion: 'dgos-capability/v1', executor: { type: 'declarative', engine: 'dgos-text-v1' }, capabilities: ['text.chat'], modelProfiles: { text: { modelNames: ['text-model'], workflow: 'text.chat' } }, operations: { submit: { profile: 'chat.completions', method: 'POST', path: '/chat/completions' } }, workflows: { 'text.chat': { submit: 'submit' } }, assets: {} };
  assert.equal(resolveTextProfile(profile, 'text-model').operationProfile, 'chat.completions');
  assert.throws(() => resolveTextProfile(profile, 'unknown'), (error) => error.errorKey === 'model_profile_missing');
  assert.throws(() => validateTextProfile({ ...profile, operations: { submit: { ...profile.operations.submit, path: 'https://private.invalid' } } }), (error) => error.errorKey === 'protocol_mismatch');
  assert.throws(() => validateTextProfile({ ...profile, operations: { submit: { ...profile.operations.submit, script: 'process.exit()' } } }), (error) => error.errorKey === 'protocol_mismatch');
});

test('text profile snapshots defaults, limits and selector rejection', () => {
  const profile = {
    id: 'fixture.limited', version: '1.0.0', kind: 'model', schemaVersion: 'dgos-capability/v1',
    executor: { type: 'declarative', engine: 'dgos-text-v1' }, capabilities: ['text.chat'],
    defaults: { temperature: 0.4, maxOutputTokens: 32 },
    limits: { maxInputCharacters: 1000, maxOutputTokens: 64 },
    uiSchemas: { parameters: ['temperature', 'maxOutputTokens'] },
    operations: { submit: { profile: 'chat.completions', method: 'POST', path: '/chat/completions' } },
    workflows: { 'text.chat': { submit: 'submit' } },
    modelProfiles: {
      text: {
        modelNames: ['fixture-model'],
        workflow: 'text.chat',
        defaults: { temperature: 0.7 },
        limits: { maxInputCharacters: 200, maxOutputTokens: 48 },
        uiSchemas: { parameters: ['temperature', 'maxOutputTokens'] },
      },
    },
    assets: {},
  };
  const resolved = resolveTextProfile(profile, 'fixture-model');
  assert.deepEqual(resolved.defaults, { temperature: 0.7, maxOutputTokens: 32 });
  assert.deepEqual(resolved.limits, { maxInputCharacters: 200, maxOutputTokens: 48 });
  assert.deepEqual(resolved.uiSchemas, { parameters: ['temperature', 'maxOutputTokens'] });
  assert.throws(() => resolveTextProfile(profile, 'other-model'), (error) => error.errorKey === 'model_profile_missing');
  assert.throws(() => validateTextProfile({
    ...profile,
    modelProfiles: { text: { ...profile.modelProfiles.text, limits: { maxOutputTokens: 16 }, defaults: { maxOutputTokens: 32 } } },
  }), (error) => error.errorKey === 'capability_mismatch');
});

test('bound text profile selects the real upstream operation and rejects disabled declarations', async () => {
  const directory = new InMemoryTextProfileDirectory();
  const profile = { id: 'fixture.responses', version: '1.0.0', kind: 'model', schemaVersion: 'dgos-capability/v1', executor: { type: 'declarative', engine: 'dgos-text-v1' }, capabilities: ['text.chat'], modelProfiles: { text: { modelNames: ['text-model'], workflow: 'text.chat' } }, operations: { submit: { profile: 'responses', method: 'POST', path: '/responses' } }, workflows: { 'text.chat': { submit: 'submit' } }, assets: {} };
  const audit = { async record() {} };
  const confirmations = new InMemoryProviderProtocolConfirmations();
  const publish = async (declaration, requestId) => { const binding = { subjectId: 'owner', sessionId: 'fixture-session', operation: 'provider.protocol.publish', resourceId: declaration.id, version: declaration.version, digest: protocolDigest(declaration), requestId }; const ticket = await confirmations.issue(binding); return directory.publish({ ownerId: 'owner', protocolType: 'openai-compatible', profile: declaration, audit, requestId, confirmation: { store: confirmations, input: { ...binding, confirmationId: ticket.confirmationId } } }); };
  await assert.rejects(directory.publish({ ownerId: 'owner', protocolType: 'openai-compatible', profile, audit, requestId: 'missing' }), (error) => error.message === 'confirmation_required');
  await publish(profile, 'publish');
  const config = { providerConfigId: 'config', providerAccountId: 'account', ownerId: 'owner', protocolType: 'openai-compatible', status: 'ready', baseUrl: 'https://fixture.test/v1', capabilityProtocolId: profile.id, capabilityProtocolVersion: profile.version };
  const account = { accountId: 'account', ownerId: 'owner', protocolType: 'openai-compatible', status: 'ready' };
  const dependencies = { configRepository: { get: async () => config, getCatalog: async () => ({ status: 'fresh', catalogVersion: '1', items: [{ modelId: 'text-model', taskModes: ['text.chat'] }] }), listPolicies: async () => [{ modelId: 'text-model', enabled: true, assignedCapabilities: ['text'] }] }, accountRepository: { getAccount: async () => account }, registry: { get: () => createOpenAiCompatibleAdapter({ profileDirectory: directory }) }, profileDirectory: directory };
  const admission = createTaskAdmission(dependencies);
  assert.equal((await admission({ ownerId: 'owner', providerConfigId: 'config', modelId: 'text-model', intent: 'text.chat' })).textProfile.operationProfile, 'responses');
  assert.deepEqual(await createModelResolver(dependencies)({ ownerId: 'owner', providerConfigId: 'config', modelId: 'text-model', intent: 'text.chat' }), { providerConfigId: 'config', modelId: 'text-model', intent: 'text.chat', descriptorVersion: 'text.v1', profile: 'responses', workflow: 'text.chat', defaults: {}, limits: {}, uiSchemas: {}, assets: {}, protocolId: profile.id, protocolVersion: profile.version });
  const requests = [];
  const egress = { async request(input) { requests.push(input); return { ok: true, status: 200, body: (async function* () { yield Buffer.from('data: {"type":"response.output_text.delta","delta":"hello"}\n\ndata: {"type":"response.completed"}\n\n'); })() }; } };
  const adapter = createOpenAiCompatibleAdapter({ profileDirectory: directory });
  assert.deepEqual(await Array.fromAsync(adapter.streamText({ config, credential: 'fixture-token', egress, modelId: 'text-model', input: 'hi' })), ['hello']);
  assert.equal(new URL(requests[0].url).pathname, '/v1/responses');
  assert.equal(JSON.parse(requests[0].body).input, 'hi');
  const stateBinding = { subjectId: 'owner', sessionId: 'fixture-session', operation: 'provider.protocol.state', resourceId: profile.id, version: profile.version, digest: protocolDigest({ protocolId: profile.id, version: profile.version, baseVersion: 1, state: 'disabled' }), requestId: 'disable' };
  const stateTicket = await confirmations.issue(stateBinding);
  await directory.setState({ ownerId: 'owner', protocolId: profile.id, version: profile.version, baseVersion: 1, state: 'disabled', audit, requestId: 'disable', confirmation: { store: confirmations, input: { ...stateBinding, confirmationId: stateTicket.confirmationId } } });
  await assert.rejects(admission({ ownerId: 'owner', providerConfigId: 'config', modelId: 'text-model', intent: 'text.chat' }), (error) => error.errorKey === 'protocol_unavailable');
  await assert.rejects(Array.fromAsync(adapter.streamText({ config, credential: 'fixture-token', egress, modelId: 'text-model', input: 'hi' })), (error) => error.errorKey === 'protocol_unavailable');
  assert.equal(requests.length, 1);
  await publish({ ...profile, version: '2.0.0' }, 'new-version');
  await assert.rejects(publish(profile, 'replay-old'), (error) => error.message === 'version_conflict');
  await assert.rejects(admission({ ownerId: 'owner', providerConfigId: 'config', modelId: 'text-model', intent: 'text.chat' }), (error) => error.errorKey === 'protocol_unavailable');
});
