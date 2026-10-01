import { buildServer } from '../apps/api/src/server.mjs';
import { createOpenAiCompatibleFixture } from '../test-support/openai-compatible-fixture.mjs';
import { createOpenAiCompatibleAdapter } from '../src/provider-adapters/openai-compatible.mjs';
import { createHash } from 'node:crypto';

process.env.DGOS_ALLOW_INSECURE_FIXTURE = '1';
const fixture = createOpenAiCompatibleFixture({ chunks: ['hello ', 'world'] });
const address = await fixture.start();
const egress = { request: ({ url, ...init }) => fetch(String(url).replace('https://fixture.test/v1', address.baseUrl), init) };
const adapter = createOpenAiCompatibleAdapter();
const adapterForFixture = { ...adapter, async validate(input) { return adapter.validate({ ...input, config: { ...input.config, baseUrl: 'https://fixture.test/v1' } }); }, async listModels(input) { return adapter.listModels({ ...input, config: { ...input.config, baseUrl: 'https://fixture.test/v1' } }); } };
const providerRunner = async function* ({ task, credential, signal }) { const response = await fetch(`${address.baseUrl}/chat/completions`, { method: 'POST', headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: task.modelId, messages: [{ role: 'user', content: task.inputText }], stream: true }), signal }); for (const line of (await response.text()).split(/\r?\n/)) { if (!line.startsWith('data:')) continue; const value = line.slice(5).trim(); if (value === '[DONE]') break; const delta = JSON.parse(value).choices?.[0]?.delta?.content; if (delta) yield delta; } };
const quotaAdapter = { preflight: async () => ({ decision: 'allow', allowed: true }), reserve: async (input) => ({ reservationId: `web-${input.taskId}`, ...input }), settle: async (input) => ({ reservationId: input.reservationId, usageEventId: `usage-${input.taskId}`, state: input.release ? 'released' : 'settled' }), release: async (input) => ({ reservationId: input.reservationId, state: 'released' }) };
const app = buildServer({ logger: false, providerEgress: egress, providerAdapters: [adapterForFixture], providerRunner, quotaAdapter });
await app.listen({ host: '127.0.0.1', port: Number(process.env.API_PORT || 0) });
const api = `http://127.0.0.1:${app.server.address().port}`;
process.stdout.write(`${JSON.stringify({ api, fixture: address.baseUrl, token: fixture.token })}\n`);
const close = async () => { await app.close(); await fixture.close(); process.exit(0); };
process.once('SIGINT', close); process.once('SIGTERM', close);
