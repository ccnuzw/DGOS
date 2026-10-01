import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { createOpenAiCompatibleFixture } from '../../test-support/openai-compatible-fixture.mjs';
import { buildServer } from '../../apps/api/src/server.mjs';
import { ProviderEgress } from '../../src/security/provider-egress.mjs';
import { InMemorySecretService } from '../../src/security/secret-service.mjs';
import { PostgresAiTaskRepository } from '../../src/ai-task/repository.mjs';
import { createOpenAiCompatibleAdapter } from '../../src/provider-adapters/openai-compatible.mjs';
import { discoverMigrations, buildMigrationSql } from '../../scripts/migrate.mjs';
import { createPostgresWorker } from '../../apps/worker/src/worker.mjs';

const dbUrl = process.env.DGOS_DATABASE_URL;
const skip = !dbUrl;

async function waitFor(get, expected, timeout = 5000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = await get(); if (value === expected) return value; await new Promise((r) => setTimeout(r, 25)); }
  return get();
}

async function setup() {
  const admin = new pg.Pool({ connectionString: dbUrl });
  const database = `dgos_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE DATABASE ${database}`);
  const isolatedUrl = new URL(dbUrl); isolatedUrl.pathname = `/${database}`;
  const pool = new pg.Pool({ connectionString: isolatedUrl.toString() });
  await pool.query(buildMigrationSql(await discoverMigrations()));
  process.env.DGOS_DATABASE_URL = isolatedUrl.toString();
  const fixture = createOpenAiCompatibleFixture({ chunks: ['hello ', 'world'], responseText: 'unused' });
  const address = await fixture.start();
  const egress = { request: ({ url, ...init }) => fetch(String(url).replace('https://fixture.test/v1', address.baseUrl), init) };
  const secretService = new InMemorySecretService();
  const taskRepository = new PostgresAiTaskRepository(pool);
  const adapter = createOpenAiCompatibleAdapter();
  const adapterForFixture = { ...adapter, async validate(input) { return adapter.validate({ ...input, config: { ...input.config, baseUrl: 'https://fixture.test/v1' } }); }, async listModels(input) { return adapter.listModels({ ...input, config: { ...input.config, baseUrl: 'https://fixture.test/v1' } }); }, streamText(input) { return adapter.streamText({ ...input, config: { ...input.config, baseUrl: 'https://fixture.test/v1' } }); } };
  const providerRunner = async function* ({ task, credential, signal }) { const response = await fetch(`${address.baseUrl}/chat/completions`, { method: 'POST', headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: task.modelId, messages: [{ role: 'user', content: task.inputText }], stream: true }), signal }); assert.equal(response.status, 200); for (const line of (await response.text()).split(/\r?\n/)) { if (!line.startsWith('data:')) continue; const value = line.slice(5).trim(); if (value === '[DONE]') break; const delta = JSON.parse(value).choices?.[0]?.delta?.content; if (delta) yield delta; } };
  const app = buildServer({ logger: false, closeDatabasePools: true, secretService, providerEgress: egress, providerAdapters: [adapterForFixture], providerRunner });
  const runtime = createPostgresWorker({ pool, secretService });
  runtime.taskService.egress = egress;
  runtime.taskService.providerRunner = providerRunner;
  runtime.worker.start();
  app.addHook('onClose', async () => runtime.worker.stop());
  await app.listen({ host: '127.0.0.1', port: 0 });
  const api = `http://127.0.0.1:${app.server.address().port}`;
  return { pool, admin, database, isolatedUrl: isolatedUrl.toString(), fixture, address, app, api, taskRepository };
}

test('real PostgreSQL/API/provider fixture workflow records durable evidence', { skip }, async () => {
  process.env.DGOS_ALLOW_INSECURE_FIXTURE = '1';
  const ctx = await setup();
  const evidence = { requestId: randomUUID(), fixtureRequests: 0, sseSequences: [], quota: {} };
  const request = async (path, init = {}) => { const response = await fetch(`${ctx.api}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } }); const body = await response.text(); return { response, body, json: () => body ? JSON.parse(body) : undefined }; };
  try {
    const bootstrap = await request('/api/v1/identity/admin/bootstrap', { method: 'POST', body: JSON.stringify({ displayName: 'Real Workflow', credential: 'fixture-owner' }) });
    assert.equal(bootstrap.response.status, 201); const session = bootstrap.json(); const auth = { authorization: `Bearer ${session.sessionId}`, 'x-dgos-csrf': 'integration' }; evidence.ownerId = session.principalId;
    const quotaPolicy = await request('/api/v1/quota/policies', { method: 'PUT', headers: auth, body: JSON.stringify({ requestId: randomUUID(), metric: 'requests', scopeType: 'subject', scopeId: evidence.ownerId, hardLimit: 20, softLimit: 18, windowSeconds: 3600, effectiveAt: new Date().toISOString() }) }); assert.equal(quotaPolicy.response.status, 200, quotaPolicy.body); evidence.quota.policyVersion = quotaPolicy.json().version;
    const account = await request('/api/v1/provider/accounts', { method: 'POST', headers: auth, body: JSON.stringify({ protocolType: 'openai-compatible', displayName: 'Local Fixture', credential: 'dgos-fixture-token', scope: { endpoint: ctx.address.baseUrl } }) });
    assert.equal(account.response.status, 201); const accountId = account.json().accountId;
    const config = await request('/api/v1/provider/configs', { method: 'POST', headers: auth, body: JSON.stringify({ requestId: randomUUID(), providerAccountId: accountId, protocolType: 'openai-compatible', displayName: 'Local Fixture', baseUrl: ctx.address.baseUrl }) });
    assert.equal(config.response.status, 201, config.body);
    assert.equal(config.response.status, 201); const configId = config.json().id;
    const validated = await request(`/api/v1/provider/configs/${configId}/validate`, { method: 'POST', headers: auth, body: '{}' }); assert.equal(validated.response.status, 200, `${validated.body} fixture=${JSON.stringify(ctx.fixture.requests)}`);
    const refreshed = await request(`/api/v1/provider/configs/${configId}/models`, { method: 'POST', headers: auth, body: '{}' }); assert.equal(refreshed.response.status, 200); const modelId = refreshed.json().items[0].modelId;
    const policy = await request(`/api/v1/provider/configs/${configId}/model-policies`, { method: 'POST', headers: auth, body: JSON.stringify({ modelId, enabled: true, assignedCapabilities: ['text'], defaultFor: [], baseVersion: '0' }) }); assert.equal(policy.response.status, 200);
    const taskRequestId = randomUUID(); evidence.requestId = taskRequestId;
    const submitted = await request('/api/v1/ai-tasks', { method: 'POST', headers: auth, body: JSON.stringify({ requestId: taskRequestId, target: 'text', intent: 'text.chat', input: { text: 'hello' }, options: { providerConfigId: configId, modelId } }) }); assert.equal(submitted.response.status, 202); const receipt = submitted.json(); evidence.taskId = receipt.taskId;
    const duplicate = await request('/api/v1/ai-tasks', { method: 'POST', headers: auth, body: JSON.stringify({ requestId: taskRequestId, target: 'text', intent: 'text.chat', input: { text: 'hello' }, options: { providerConfigId: configId, modelId } }) }); assert.equal(duplicate.json().taskId, receipt.taskId);
    const status = await waitFor(async () => { const current = (await request(`/api/v1/ai-tasks/${receipt.taskId}`, { headers: auth })).json(); return ['succeeded','failed','timed_out','cancelled'].includes(current.status) ? current.status : undefined; }, 'succeeded'); const diagnostic = await request(`/api/v1/ai-tasks/${receipt.taskId}`, { headers: auth }); const rows = await ctx.pool.query('SELECT * FROM quota_reservations WHERE task_id=$1', [receipt.taskId]); assert.equal(status, 'succeeded', `${diagnostic.body} reservations=${JSON.stringify(rows.rows)} fixture=${JSON.stringify(ctx.fixture.requests)}`);
    const snapshot = await request(`/api/v1/ai-tasks/${receipt.taskId}`, { headers: auth }); const task = snapshot.json(); evidence.artifactId = task.artifactIds[0];
    const events = await request(`/api/v1/ai-tasks/${receipt.taskId}/events`, { headers: auth }); evidence.sseSequences = [...events.body.matchAll(/^id: (\d+)/gm)].map((m) => Number(m[1])); assert.deepEqual(evidence.sseSequences, [...evidence.sseSequences].sort((a, b) => a - b));
    const first = evidence.sseSequences[0]; const resumed = await request(`/api/v1/ai-tasks/${receipt.taskId}/events`, { headers: { ...auth, 'last-event-id': String(first) } }); assert.doesNotMatch(resumed.body, new RegExp(`id: ${first}\\n`));
    const artifact = await request(`/api/v1/artifacts/${evidence.artifactId}`, { headers: auth }); assert.equal(artifact.response.status, 200); assert.equal(artifact.json().content, 'hello world');
    evidence.fixtureRequests = ctx.fixture.requestCount;
    evidence.fixtureByPath = Object.fromEntries(ctx.fixture.requests.reduce((map, item) => map.set(item.path, (map.get(item.path) ?? 0) + 1), new Map()));
    assert.ok(evidence.fixtureByPath['/v1/models'] >= 2); assert.equal(evidence.fixtureByPath['/v1/chat/completions'], 1);
    const attempt = await ctx.taskRepository.findAttemptByTask(receipt.taskId); evidence.attemptId = attempt.attempt_id ?? attempt.attemptId;
    const reservation = await ctx.pool.query('SELECT reservation_id FROM quota_reservations WHERE task_id=$1', [receipt.taskId]); evidence.reservationId = reservation.rows[0]?.reservation_id; const usage = await ctx.pool.query('SELECT usage_event_id FROM usage_events WHERE task_id=$1', [receipt.taskId]); evidence.usageEventId = usage.rows[0]?.usage_event_id;
    assert.ok(evidence.taskId && evidence.attemptId && evidence.artifactId);
  } finally {
    await ctx.app.close(); await ctx.fixture.close(); await ctx.pool.end(); await ctx.admin.query(`DROP DATABASE IF EXISTS ${ctx.database}`); await ctx.admin.end(); process.env.DGOS_DATABASE_URL = dbUrl; delete process.env.DGOS_ALLOW_INSECURE_FIXTURE;
  }
});
