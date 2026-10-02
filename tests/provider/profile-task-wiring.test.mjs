import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { buildServer } from '../../apps/api/src/server.mjs';
import { InMemoryIdentityRepository } from '../../src/identity/repository.mjs';
import { InMemoryProviderRepository } from '../../src/provider/repository.mjs';
import { InMemoryAiTaskRepository } from '../../src/ai-task/repository.mjs';

const modelId = 'fixture-responses-model';
const declaration = {
  schemaVersion: 'dgos-capability/v1', kind: 'model', id: 'fixture.responses', version: '1.0.0',
  executor: { type: 'declarative', engine: 'dgos-text-v1' }, capabilities: ['text.chat'],
  operations: { submit: { profile: 'responses', method: 'POST', path: '/responses' } },
  workflows: { 'text.chat': { submit: 'submit' } },
  modelProfiles: { text: { modelNames: [modelId], workflow: 'text.chat' } }, assets: {},
};

test('public Task uses bound responses operation once and stores the text artifact', async () => {
  const requests = [];
  const upstream = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    requests.push({ method: request.method, path: request.url, body, authorization: request.headers.authorization });
    if (request.headers.authorization !== 'Bearer fixture-provider-token') { response.writeHead(401).end(); return; }
    if (request.method === 'GET' && request.url === '/v1/models') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ data: [{ id: modelId, name: 'Fixture Responses Model' }] }));
      return;
    }
    if (request.method === 'POST' && request.url === '/v1/responses') {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.end('data: {"type":"response.output_text.delta","delta":"profile "}\n\ndata: {"type":"response.output_text.delta","delta":"result"}\n\ndata: {"type":"response.completed"}\n\n');
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const address = `http://127.0.0.1:${upstream.address().port}/v1`;
  const endpoint = 'https://provider.fixture.test/v1';
  const egress = {
    async validateTarget(url) { assert.equal(url, endpoint); return new URL(url); },
    request({ url, ...init }) { assert.ok(url.startsWith(endpoint)); return fetch(url.replace(endpoint, address), init); },
  };
  const providerRepository = new InMemoryProviderRepository();
  const taskRepository = new InMemoryAiTaskRepository();
  const app = buildServer({
    logger: false, repository: new InMemoryIdentityRepository(), providerRepository, aiTaskRepository: taskRepository,
    providerEgress: egress,
    providerRunner: ({ task, config, adapter, credential, signal }) => adapter.streamText({ config, credential, egress, modelId: task.modelId, input: task.inputText, signal }),
    quotaAdapter: { async preflight() {}, async reserve() { return { reservationId: 'fixture-reservation' }; }, async settle() {}, async release() {} },
  });
  try {
    const bootstrap = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'Profile Owner', credential: 'fixture-admin-credential' } });
    assert.equal(bootstrap.statusCode, 201, bootstrap.body);
    const headers = { authorization: `Bearer ${bootstrap.json().sessionId}` };
    const post = (url, payload) => app.inject({ method: 'POST', url, headers, payload });
    const validation = await post('/api/v1/provider/capability-protocols', { requestId: randomUUID(), declaration });
    assert.equal(validation.statusCode, 200, validation.body);
    const publishId = randomUUID();
    const ticket = await post('/api/v1/provider/capability-protocols/confirmations', { requestId: publishId, operation: 'provider.protocol.publish', protocolId: declaration.id, version: declaration.version, declaration, validationDigest: validation.json().digest });
    assert.equal(ticket.statusCode, 201, ticket.body);
    const published = await post(`/api/v1/provider/capability-protocols/${declaration.id}/versions`, { requestId: publishId, declaration, validationDigest: validation.json().digest, confirmationId: ticket.json().confirmationId });
    assert.equal(published.statusCode, 201, published.body);

    const account = await post('/api/v1/provider/accounts', { protocolType: 'openai-compatible', displayName: 'Fixture Account', credential: 'fixture-provider-token', scope: { endpoint } });
    assert.equal(account.statusCode, 201, account.body);
    const config = await post('/api/v1/provider/configs', { requestId: randomUUID(), providerAccountId: account.json().accountId, protocolType: 'openai-compatible', displayName: 'Responses Config', baseUrl: endpoint, capabilityProtocolId: declaration.id, capabilityProtocolVersion: declaration.version });
    assert.equal(config.statusCode, 201, config.body);
    assert.equal(config.json().capabilityProtocolVersion, declaration.version);
    const validated = await post(`/api/v1/provider/configs/${config.json().id}/validate`, { requestId: randomUUID() });
    assert.equal(validated.statusCode, 200, validated.body);
    const connection = await post('/api/v1/provider/connection-tests', { requestId: randomUUID(), accountId: account.json().accountId, protocolVersion: 'v1' });
    assert.equal(connection.statusCode, 202, connection.body);
    await providerRepository.finishConnectionTest(connection.json().testId, 'succeeded', undefined, 1);
    const ready = await post(`/api/v1/provider/accounts/${account.json().accountId}/state`, { requestId: randomUUID(), baseVersion: account.json().version, state: 'ready', connectionTestId: connection.json().testId });
    assert.equal(ready.statusCode, 200, ready.body);
    const catalog = await post(`/api/v1/provider/configs/${config.json().id}/models`, { requestId: randomUUID() });
    assert.equal(catalog.statusCode, 200, catalog.body);
    const policy = await post(`/api/v1/provider/configs/${config.json().id}/model-policies`, { requestId: randomUUID(), modelId, enabled: true, assignedCapabilities: ['text'], defaultFor: [], baseVersion: '0' });
    assert.equal(policy.statusCode, 200, policy.body);

    const submitted = await post('/api/v1/ai-tasks', { requestId: randomUUID(), target: 'text', intent: 'text.chat', input: { text: 'hello' }, options: { providerConfigId: config.json().id, modelId } });
    assert.equal(submitted.statusCode, 202, submitted.body);
    const taskId = submitted.json().taskId;
    let snapshot;
    const deadline = Date.now() + 3000;
    do {
      snapshot = await app.inject({ method: 'GET', url: `/api/v1/ai-tasks/${taskId}`, headers });
      if (['succeeded', 'failed', 'cancelled', 'timed_out'].includes(snapshot.json().status)) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    } while (Date.now() < deadline);
    assert.equal(snapshot.json().status, 'succeeded', snapshot.body);
    assert.equal(snapshot.json().text, 'profile result');
    assert.equal(snapshot.json().artifactIds.length, 1);
    const artifact = await app.inject({ method: 'GET', url: `/api/v1/artifacts/${snapshot.json().artifactIds[0]}`, headers });
    assert.equal(artifact.statusCode, 200, artifact.body);
    assert.equal(artifact.json().content, 'profile result');
    assert.equal(requests.filter((entry) => entry.path === '/v1/responses').length, 1);
    assert.equal(requests.filter((entry) => entry.path === '/v1/chat/completions').length, 0);
    assert.equal(JSON.parse(requests.find((entry) => entry.path === '/v1/responses').body).input, 'hello');
  } finally {
    await app.close();
    await new Promise((resolve, reject) => upstream.close((error) => error ? reject(error) : resolve()));
  }
});
