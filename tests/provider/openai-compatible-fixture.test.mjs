import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAiCompatibleFixture } from '../../test-support/openai-compatible-fixture.mjs';
import { createOpenAiCompatibleAdapter } from '../../src/provider-adapters/openai-compatible.mjs';

async function withFixture(options, callback) {
  const fixture = createOpenAiCompatibleFixture(options);
  const address = await fixture.start();
  try { return await callback({ fixture, address }); } finally { await fixture.close(); }
}

const direct = (baseUrl, token, init = {}) => fetch(`${baseUrl}${init.path ?? ''}`, { ...init, headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
const mappedEgress = (address) => ({ request: ({ url, ...init }) => fetch(url.replace('https://fixture.test/v1', address.baseUrl), init) });

test('fixture exposes OpenAI models structure', async () => withFixture({}, async ({ fixture, address }) => {
  const response = await direct(address.baseUrl, fixture.token, { path: '/models' });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.object, 'list');
  assert.equal(body.data[0].id, fixture.model);
}));

test('fixture emits parseable chat completion SSE', async () => withFixture({ chunks: ['hello', ' world'] }, async ({ fixture, address }) => {
  const response = await direct(address.baseUrl, fixture.token, { method: 'POST', path: '/chat/completions', body: JSON.stringify({ stream: true }), headers: { 'content-type': 'application/json' } });
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  assert.match(await response.text(), /data: .*\[DONE\]/);
}));

test('fixture rejects missing or invalid authorization and supports forbidden scenario', async () => withFixture({}, async ({ fixture, address }) => {
  assert.equal((await fetch(`${address.baseUrl}/models`)).status, 401);
  assert.equal((await direct(address.baseUrl, 'wrong', { path: '/models' })).status, 401);
  assert.equal((await direct(address.baseUrl, fixture.token, { path: '/models?scenario=forbidden' })).status, 403);
}));

test('adapter can list models and stream from the real fixture', async () => withFixture({ chunks: ['hello', ' world'] }, async ({ fixture, address }) => {
  const adapter = createOpenAiCompatibleAdapter();
  const egress = mappedEgress(address);
  const config = { baseUrl: 'https://fixture.test/v1' };
  assert.equal((await adapter.listModels({ config, credential: fixture.token, egress }))[0].modelId, fixture.model);
  assert.deepEqual(await Array.fromAsync(adapter.streamText({ config, credential: fixture.token, egress, modelId: fixture.model, input: 'hello' })), ['hello', ' world']);
}));

test('adapter maps timeout, disconnect, malformed and empty streams', async () => {
  const adapter = createOpenAiCompatibleAdapter();
  for (const [scenario, expected] of [['timeout', 'network_unreachable'], ['disconnect', 'network_unreachable'], ['malformed', 'protocol_mismatch'], ['empty', 'protocol_mismatch']]) {
    await withFixture({ scenario, delayMs: 20 }, async ({ fixture, address }) => {
      const mapped = mappedEgress(address);
      const signal = scenario === 'timeout' ? AbortSignal.timeout(10) : undefined;
      await assert.rejects(Array.fromAsync(adapter.streamText({ config: { baseUrl: 'https://fixture.test/v1' }, credential: fixture.token, egress: mapped, modelId: fixture.model, input: 'test', signal })), (error) => error.errorKey === expected || (scenario === 'timeout' && error.errorKey === 'timed_out'));
    });
  }
});
