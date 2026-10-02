import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from '../../apps/api/node_modules/fastify/fastify.js';
import { InMemoryTextProfileDirectory } from '../../src/provider-config/text-profile-directory.mjs';
import { InMemoryProviderProtocolConfirmations } from '../../src/provider-config/protocol-confirmations.mjs';
import { registerProviderProtocolRoutes } from '../../apps/api/src/provider-protocol-routes.mjs';

const declaration = { id: 'fixture.text', version: '1.0.0', kind: 'model', schemaVersion: 'dgos-capability/v1', executor: { type: 'declarative', engine: 'dgos-text-v1' }, capabilities: ['text.chat'], modelProfiles: { text: { modelNames: ['fixture-text'], workflow: 'text.chat' } }, operations: { submit: { profile: 'chat.completions', method: 'POST', path: '/chat/completions' } }, workflows: { 'text.chat': { submit: 'submit' } }, assets: {} };

test('protocol directory exposes one public DTO and validation has no publish side effect', async () => {
  const app = Fastify({ logger: false });
  const directory = new InMemoryTextProfileDirectory();
  const confirmations = new InMemoryProviderProtocolConfirmations();
  const events = [];
  registerProviderProtocolRoutes(app, { directory, confirmations, adapterRegistry: { list: () => [{ protocolType: 'openai-compatible', protocolVersion: 'v1', descriptorVersion: 'text.v1', taskModes: ['text.chat'], streamingText: true, cancellation: true, modelListing: true, endpointRules: ['secret'] }] }, audit: { async record(event) { events.push(event); } }, requireScope: async () => ({ subjectId: 'owner', authMethod: 'session', sessionId: 'fixture-session' }), validateCsrf: async () => {}, requireFreshSession: async () => {} });
  try {
    const protocols = await app.inject({ method: 'GET', url: '/api/v1/provider/protocols' });
    assert.equal(protocols.statusCode, 200);
    assert.equal(protocols.json().items[0].endpointRules, undefined);
    assert.equal(protocols.json().items[0].status, 'active');
    const validated = await app.inject({ method: 'POST', url: '/api/v1/provider/capability-protocols', payload: { requestId: 'fixture', declaration } });
    assert.equal(validated.statusCode, 200, validated.body);
    assert.deepEqual((await app.inject({ method: 'GET', url: '/api/v1/provider/capability-protocols' })).json().items, []);
    const requestId = 'fixture-publish';
    const mixedPublish = await app.inject({ method: 'POST', url: '/api/v1/provider/capability-protocols/confirmations', payload: { requestId: 'mixed-publish', operation: 'provider.protocol.publish', protocolId: declaration.id, version: declaration.version, declaration, validationDigest: validated.json().digest, state: 'disabled' } });
    assert.equal(mixedPublish.statusCode, 422);
    const mixedState = await app.inject({ method: 'POST', url: '/api/v1/provider/capability-protocols/confirmations', payload: { requestId: 'mixed-state', operation: 'provider.protocol.state', protocolId: declaration.id, version: declaration.version, baseVersion: 1, state: 'disabled', declaration } });
    assert.equal(mixedState.statusCode, 422);
    assert.equal(confirmations.tickets.size, 0);
    assert.equal(events.length, 0);
    const ticket = await app.inject({ method: 'POST', url: '/api/v1/provider/capability-protocols/confirmations', payload: { requestId, operation: 'provider.protocol.publish', protocolId: declaration.id, version: declaration.version, declaration, validationDigest: validated.json().digest } });
    assert.equal(ticket.statusCode, 201, ticket.body);
    const published = await app.inject({ method: 'POST', url: '/api/v1/provider/capability-protocols/fixture.text/versions', payload: { requestId, declaration, validationDigest: validated.json().digest, confirmationId: ticket.json().confirmationId } });
    assert.equal(published.statusCode, 201, published.body);
    assert.equal(published.json().modelProfiles.text.modelNames[0], 'fixture-text');
    const publishReplay = await app.inject({ method: 'POST', url: '/api/v1/provider/capability-protocols/fixture.text/versions', payload: { requestId, declaration, validationDigest: validated.json().digest, confirmationId: ticket.json().confirmationId } });
    assert.equal(publishReplay.statusCode, 201, publishReplay.body);
    assert.deepEqual(publishReplay.json(), published.json());
    assert.equal(events.length, 1);
    const changedPublish = await app.inject({ method: 'POST', url: '/api/v1/provider/capability-protocols/fixture.text/versions', payload: { requestId, declaration: { ...declaration, label: 'changed' }, validationDigest: validated.json().digest, confirmationId: ticket.json().confirmationId } });
    assert.equal(changedPublish.statusCode, 409);
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/provider/capability-protocols' })).json().items.length, 1);
    const stateTicket = await app.inject({ method: 'POST', url: '/api/v1/provider/capability-protocols/confirmations', payload: { requestId: 'fixture-state', operation: 'provider.protocol.state', protocolId: declaration.id, version: declaration.version, baseVersion: 1, state: 'disabled' } });
    assert.equal(stateTicket.statusCode, 201, stateTicket.body);
    const statePayload = { requestId: 'fixture-state', baseVersion: 1, state: 'disabled', confirmationId: stateTicket.json().confirmationId };
    const changed = await app.inject({ method: 'POST', url: '/api/v1/provider/capability-protocols/fixture.text/versions/1.0.0/state', payload: statePayload });
    assert.equal(changed.statusCode, 200, changed.body);
    assert.equal(changed.json().registryVersion, 2);
    assert.equal(changed.json().version, '1.0.0');
    const stateReplay = await app.inject({ method: 'POST', url: '/api/v1/provider/capability-protocols/fixture.text/versions/1.0.0/state', payload: statePayload });
    assert.equal(stateReplay.statusCode, 200, stateReplay.body);
    assert.deepEqual(stateReplay.json(), changed.json());
    assert.equal(events.length, 2);
    const changedState = await app.inject({ method: 'POST', url: '/api/v1/provider/capability-protocols/fixture.text/versions/1.0.0/state', payload: { ...statePayload, state: 'active' } });
    assert.equal(changedState.statusCode, 409);
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/provider/capability-protocols' })).json().items.length, 0);
  } finally { await app.close(); }
});
