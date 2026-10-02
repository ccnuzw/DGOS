import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppCapabilities } from '../../apps/api/src/app-capabilities.mjs';
import { InMemoryPermissionRepository } from '../../src/permissions/repository.mjs';
import { InMemoryAuditRepository } from '../../src/audit/outbox.mjs';
import { SystemService } from '../../src/system/service.mjs';
import { InMemorySystemRepository } from '../../src/system/repository.mjs';

test('instance context requires both declared grants, projects no private settings and uses numeric cursors', async () => {
  const permissionRepository = new InMemoryPermissionRepository();
  const audit = new InMemoryAuditRepository();
  const repository = new InMemorySystemRepository();
  const system = new SystemService({ repository, audit });
  await system.ready;
  repository.settings.contextVersion = '10';
  repository.settings.settings.network.manualProxyRef = 'private-proxy-ref';
  repository.settings.settings.appPermissions = [{ subjectId: 'other', decision: 'deny' }];
  const appId = 'example.workbench'; const subjectId = 'owner'; const instanceId = 'bound-instance';
  const capabilities = ['dgos.system.context.read', 'dgos.system.context.events'];
  permissionRepository.declare(subjectId, appId, capabilities);
  for (const capability of capabilities) permissionRepository.set({ subjectId, appId, capability }, 'allow');
  const { bridgeAuthorize, bridgeHandlers } = createAppCapabilities({ permissionRepository, audit, system });
  const context = { subjectId, appId, instanceId, requestId: 'context-read', input: {} };
  assert.equal(await bridgeAuthorize({ ...context, capability: capabilities[1] }), true);
  const read = await bridgeHandlers[capabilities[0]](context);
  assert.equal(read.instanceId, instanceId); assert.equal(read.appId, appId);
  assert.equal(JSON.stringify(read).includes('private-proxy-ref'), false);
  assert.equal(read.appPermissions, undefined);
  const batch = await bridgeHandlers[capabilities[1]]({ ...context, input: { cursor: '9' } });
  assert.equal(batch.cursor, '10'); assert.equal(batch.items.length, 1); assert.equal(batch.reset, false);
  assert.equal((await bridgeHandlers[capabilities[1]]({ ...context, input: { cursor: '10' } })).items.length, 0);
  assert.equal((await bridgeHandlers[capabilities[1]]({ ...context, input: { cursor: '11' } })).reset, true);
  await assert.rejects(bridgeHandlers[capabilities[0]]({ ...context, input: { appId: 'other' } }), /invalid_request/);
  await assert.rejects(bridgeHandlers[capabilities[1]]({ ...context, input: { cursor: 9 } }), /invalid_request/);
  permissionRepository.set({ subjectId, appId, capability: capabilities[0] }, 'deny');
  assert.equal(await bridgeAuthorize({ ...context, capability: capabilities[1] }), false);
  permissionRepository.set({ subjectId, appId, capability: capabilities[0] }, 'allow');
  permissionRepository.declare(subjectId, appId, [capabilities[1]]);
  assert.equal(await bridgeAuthorize({ ...context, capability: capabilities[1] }), false);
});

test('model bridge exposes only current resolved models and the exact public projection', async () => {
  const calls = [];
  const { bridgeHandlers } = createAppCapabilities({ providerConfigs: {
    list: async (owner) => { assert.equal(owner, 'owner'); return { items: [{ id: 'ready', status: 'ready' }, { id: 'disabled', status: 'disabled' }] }; },
    models: async (id) => { assert.equal(id, 'ready'); return { status: 'fresh', secretRef: 'must-not-project', items: [{ modelId: 'ok', displayName: 'Allowed' }, { modelId: 'denied', displayName: 'Denied' }] }; },
  }, resolveModel: async (input) => { calls.push(input); if (input.modelId === 'denied') throw new Error('model_not_allowed'); return { profile: 'chat.completions' }; } });
  assert.equal(bridgeHandlers['dgos.provider.list'], undefined);
  assert.equal(bridgeHandlers['dgos.provider.models'], undefined);
  assert.deepEqual(await bridgeHandlers['dgos.model.list']({ subjectId: 'owner', input: {} }), { items: [{ providerConfigId: 'ready', modelId: 'ok', displayName: 'Allowed', intent: 'text.chat' }] });
  assert.ok(calls.every((input) => input.ownerId === 'owner'));
  await assert.rejects(bridgeHandlers['dgos.model.resolve']({ subjectId: 'owner', input: { providerConfigId: 'ready', modelId: 'ok', intent: 'image.generate' } }), /invalid_request/);
});

test('bridge rejects caller identity injection and forwards events as bounded JSON', async () => {
  const submitted = [];
  const { bridgeHandlers } = createAppCapabilities({ aiTasks: {
    submit: async (input) => { submitted.push(input); return { taskId: 'task' }; },
    events: async (id, subject, cursor) => { assert.equal(id, 'task'); assert.equal(subject, 'owner'); assert.equal(cursor, 3); return [{ sequence: 4, type: 'text.delta', data: { delta: 'x' } }]; },
  } });
  const input = { target: 'text', intent: 'text.chat', input: { text: 'hello' }, options: { providerConfigId: 'p', modelId: 'm' } };
  await assert.rejects(bridgeHandlers['dgos.aiTask.submit']({ subjectId: 'owner', requestId: 'outer', input: { ...input, ownerId: 'other' } }), /invalid_request/);
  assert.equal(submitted.length, 0);
  await bridgeHandlers['dgos.aiTask.submit']({ subjectId: 'owner', requestId: 'outer', input });
  assert.equal(submitted[0].ownerId, 'owner'); assert.equal(submitted[0].requestId, 'outer');
  await bridgeHandlers['dgos.aiTask.submit']({ subjectId: 'owner', requestId: 'parameterized', input: { ...input, options: { ...input.options, parameters: { temperature: 0.7, maxOutputTokens: 128 } } } });
  assert.deepEqual(submitted[1].options.parameters, { temperature: 0.7, maxOutputTokens: 128 });
  for (const parameters of [{ temperature: NaN }, { temperature: '0.7' }, { temperature: 2.1 }, { maxOutputTokens: 1.2 }, { maxOutputTokens: 0 }, { max_tokens: 128 }, { headers: { authorization: 'forbidden' } }]) {
    await assert.rejects(bridgeHandlers['dgos.aiTask.submit']({ subjectId: 'owner', requestId: 'bad', input: { ...input, options: { ...input.options, parameters } } }), /invalid_request/);
  }
  assert.equal(submitted.length, 2);
  const events = await bridgeHandlers['dgos.aiTask.events']({ subjectId: 'owner', input: { taskId: 'task', cursor: 3 } });
  assert.equal(events.items[0].sequence, 4);
  await assert.rejects(bridgeHandlers['dgos.aiTask.events']({ subjectId: 'owner', input: { taskId: 'task', cursor: -1 } }), /invalid_request/);
});
