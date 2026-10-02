import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAiCompatibleAdapter } from '../../apps/api/src/provider-service.mjs';

const account = { scope: { endpoint: 'https://provider.example/v1/' } };
const response = (status, body) => ({ status, ok: status >= 200 && status < 300, async json() { return body; } });

test('connection probe sends bounded, abortable request and accepts a models envelope', async () => {
  const controller = new AbortController();
  const egress = { async request(input) {
    assert.equal(input.url, 'https://provider.example/v1/models');
    assert.equal(input.signal, controller.signal);
    assert.equal(input.timeoutMs, 1234);
    assert.equal(input.maxResponseBytes, 64 * 1024);
    assert.equal(input.headers.authorization, 'Bearer fixture-secret');
    return response(200, { data: [{ id: 'model-1' }] });
  } };
  assert.deepEqual(await createOpenAiCompatibleAdapter().probe({ account, credential: 'fixture-secret', egress, signal: controller.signal, timeoutMs: 1234 }), { status: 'ok' });
  controller.abort();
  await assert.rejects(createOpenAiCompatibleAdapter().probe({ account, credential: 'fixture-secret', egress, signal: controller.signal }), { errorKey: 'cancelled' });
});

test('connection probe classifies status and malformed models without exposing upstream body', async () => {
  const adapter = createOpenAiCompatibleAdapter();
  for (const [status, reason] of [[401, 'authentication_failed'], [403, 'authentication_failed'], [429, 'rate_limited'], [503, 'upstream_unavailable']]) {
    await assert.rejects(adapter.probe({ account, credential: 'fixture', egress: { request: async () => response(status, { secret: 'upstream-body' }) } }), (error) => error.errorKey === reason && !error.message.includes('upstream-body'));
  }
  for (const body of [{}, { data: null }, { data: [{ name: 'missing-id' }] }, [], 'ok']) {
    await assert.rejects(adapter.probe({ account, credential: 'fixture', egress: { request: async () => response(200, body) } }), { errorKey: 'protocol_mismatch' });
  }
  await assert.rejects(adapter.probe({ account, credential: 'fixture', egress: { request: async () => ({ ...response(200), async json() { throw new SyntaxError('secret upstream body'); } }) } }), (error) => error.errorKey === 'protocol_mismatch' && !error.message.includes('secret'));
});
