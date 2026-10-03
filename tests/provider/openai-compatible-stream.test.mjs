import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOpenAiCompatibleAdapter } from '../../src/provider-adapters/openai-compatible.mjs';
import { ProviderEgress } from '../../src/security/provider-egress.mjs';

const config = { baseUrl: 'https://adapter.fixture.test' };
const execute = (adapter, egress, signal) => adapter.streamText({ config, credential: 'fixture-token', egress, modelId: 'fixture-model', input: 'hello', signal });

test('adapter yields first delta before real TLS upstream ends, then accepts terminal usage', { timeout: 10000 }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dgos-adapter-stream-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await promisify(execFile)('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(root, 'key.pem'), '-out', join(root, 'cert.pem'), '-days', '1', '-subj', '/CN=adapter.fixture.test', '-addext', 'subjectAltName=DNS:adapter.fixture.test']);
  const cert = await readFile(join(root, 'cert.pem'));
  let finish;
  let ended = false;
  const server = createServer({ key: await readFile(join(root, 'key.pem')), cert }, (_req, response) => {
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.write('data: {"choices":[{"delta":{"content":"first"}}]}\n\n');
    finish = () => {
      ended = true;
      response.end('data: {"choices":[],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}\n\ndata: [DONE]\n\n');
    };
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const egress = new ProviderEgress({ lookup: async () => [{ address: '127.0.0.1' }], internalHosts: ['adapter.fixture.test'], ca: cert });
  const adapter = createOpenAiCompatibleAdapter();
  const iterator = execute(adapter, egress, undefined);
  config.baseUrl = `https://adapter.fixture.test:${server.address().port}`;
  const first = await iterator.next();
  assert.equal(first.value, 'first');
  assert.equal(ended, false);
  finish();
  const usage = await iterator.next();
  assert.deepEqual({ ...usage.value.usage, sourceDigest: undefined }, { trusted: true, inputTokens: 2, outputTokens: 3, totalTokens: 5, sourceDigest: undefined });
  assert.match(usage.value.usage.sourceDigest, /^[a-f0-9]{64}$/);
  assert.equal((await iterator.next()).done, true);
});

test('adapter requires complete SSE and discards untrusted usage evidence', async () => {
  const adapter = createOpenAiCompatibleAdapter();
  const scenarios = [
    ['data: {"choices":[{"delta":{"content":"x"}}]}\n\n', 'protocol_mismatch'],
    ['data: {"choices":[{"delta":{"content":"x"}}]}\n\ndata: [DONE]\n', 'protocol_mismatch'],
    ['data: {"choices":[{"delta":{"content":"x"}}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":6}}\n\ndata: [DONE]\n\n', null],
  ];
  for (const [body, expected] of scenarios) {
    const calls = [];
    const egress = { async request(input) { calls.push(input); return { ok: true, body: (async function* () { for (let offset = 0; offset < body.length; offset += 7) yield Buffer.from(body.slice(offset, offset + 7)); })() }; } };
    if (expected) await assert.rejects(Array.fromAsync(execute(adapter, egress)), { errorKey: expected });
    else assert.deepEqual(await Array.fromAsync(execute(adapter, egress)), ['x']);
    assert.equal(calls[0].streamResponse, true);
  }
});

test('adapter cancellation rejects a partially delivered stream', async () => {
  const controller = new AbortController();
  const adapter = createOpenAiCompatibleAdapter();
  const egress = { async request() { return { ok: true, body: (async function* () {
    yield Buffer.from('data: {"choices":[{"delta":{"content":"x"}}]}\n\n');
    controller.abort();
    throw Object.assign(new Error('cancelled'), { errorKey: 'cancelled' });
  })() }; } };
  await assert.rejects(Array.fromAsync(execute(adapter, egress, controller.signal)), { errorKey: 'cancelled' });
});

test('Responses usage is trusted only from a completed response and full transport EOF', async () => {
  const adapter = createOpenAiCompatibleAdapter({ profileDirectory: { async getActive() { return {
    schemaVersion: 'dgos-capability/v1', kind: 'model', id: 'fixture.responses', version: '1.0.0',
    executor: { type: 'declarative', engine: 'dgos-text-v1' }, capabilities: ['text.chat'],
    operations: { submit: { profile: 'responses', method: 'POST', path: '/responses' } },
    workflows: { 'text.chat': { submit: 'submit' } },
    modelProfiles: { text: { modelNames: ['fixture-model'], workflow: 'text.chat' } }, assets: {},
  }; } } });
  const bound = { ...config, ownerId: 'fixture-owner', capabilityProtocolId: 'fixture.responses', capabilityProtocolVersion: '1.0.0' };
  const body = 'event: response.created\ndata: {"type":"response.created","response":{"status":"in_progress"}}\n\nevent: response.in_progress\ndata: {"type":"response.in_progress"}\n\nevent: response.output_item.added\ndata: {"type":"response.output_item.added"}\n\nevent: response.content_part.added\ndata: {"type":"response.content_part.added"}\n\nevent: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"ok"}\n\nevent: response.output_text.annotation.added\ndata: {"type":"response.output_text.annotation.added"}\n\nevent: response.output_text.done\ndata: {"type":"response.output_text.done","text":"ok"}\n\nevent: response.content_part.done\ndata: {"type":"response.content_part.done"}\n\nevent: response.output_item.done\ndata: {"type":"response.output_item.done"}\n\nevent: response.completed\ndata: {"type":"response.completed","response":{"status":"completed","usage":{"input_tokens":4,"output_tokens":2,"total_tokens":6}}}\n\n';
  const run = (failAfterCompletion = false) => adapter.streamText({ config: bound, credential: 'fixture-token', modelId: 'fixture-model', input: 'hello', egress: {
    async request(input) {
      assert.equal(input.streamResponse, true);
      assert.match(input.url, /\/responses$/);
      return { ok: true, body: (async function* () {
        yield Buffer.from(body);
        if (failAfterCompletion) throw Object.assign(new Error('network_unreachable'), { errorKey: 'network_unreachable' });
      })() };
    },
  } });
  const chunks = await Array.fromAsync(run());
  assert.equal(chunks[0], 'ok');
  assert.deepEqual({ ...chunks[1].usage, sourceDigest: undefined }, { trusted: true, inputTokens: 4, outputTokens: 2, totalTokens: 6, sourceDigest: undefined });
  await assert.rejects(Array.fromAsync(run(true)), { errorKey: 'network_unreachable' });
});
