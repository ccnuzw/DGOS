import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { PostgresAiTaskRepository } from '../../src/ai-task/repository.mjs';
import { AiTaskService } from '../../src/ai-task/service.mjs';
import { PostgresProviderConfigRepository } from '../../src/provider-config/repository.mjs';
import { PostgresProviderRepository } from '../../src/provider/repository.mjs';
import { PostgresTextProfileDirectory } from '../../src/provider-config/text-profile-directory.mjs';
import { createTaskAdmission } from '../../src/provider-config/task-admission.mjs';
import { createOpenAiCompatibleAdapter } from '../../src/provider-adapters/openai-compatible.mjs';
import { ProtocolAdapterRegistry } from '../../src/provider-adapters/registry.mjs';
import { PostgresQuotaRepository } from '../../src/quota/repository.mjs';
import { QuotaService, createQuotaAdapter } from '../../src/quota/service.mjs';
import { PostgresAuditRepository } from '../../src/audit/outbox.mjs';
import { AiTaskWorker } from '../../apps/worker/src/ai-task-worker.mjs';
import { isIsolatedProviderDatabase } from './isolated-provider-database.mjs';

test('dedicated PG worker persists both text profiles, request replay and pre-dispatch denial', async (t) => {
  if (!isIsolatedProviderDatabase(process.env.DGOS_DATABASE_URL)) { t.skip('requires isolated Provider database'); return; }
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL });
  const ownerId = randomUUID(); const accountId = randomUUID(); const configId = randomUUID(); const taskIds = [];
  const model = 'fixture-model'; const bodies = [];
  let releaseFirstResponse;
  const firstResponseGate = new Promise((resolve) => { releaseFirstResponse = resolve; });
  const audit = new PostgresAuditRepository(pool);
  const accounts = new PostgresProviderRepository(pool);
  const configs = new PostgresProviderConfigRepository(pool);
  const directory = new PostgresTextProfileDirectory(pool, audit);
  const registry = new ProtocolAdapterRegistry([createOpenAiCompatibleAdapter({ profileDirectory: directory })]);
  const repo = new PostgresAiTaskRepository(pool);
  const quota = createQuotaAdapter(new QuotaService({ repository: new PostgresQuotaRepository(pool, { audit }), audit }));
  const egress = { async request(input) {
    bodies.push({ path: new URL(input.url).pathname, body: JSON.parse(input.body), streamResponse: input.streamResponse });
    const event = input.url.endsWith('/responses') ? 'data: {"type":"response.output_text.delta","delta":"ok"}\n\ndata: {"type":"response.completed"}\n\n' : 'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n';
    return { status: 200, ok: true, body: (async function* () {
      if (input.url.endsWith('/responses')) {
        yield Buffer.from('data: {"type":"response.output_text.delta","delta":"ok"}\n\n');
        await firstResponseGate;
        yield Buffer.from('data: {"type":"response.completed"}\n\n');
      } else yield Buffer.from(event);
    })() };
  } };
  const makeService = () => new AiTaskService({ repository: new PostgresAiTaskRepository(pool), configService: { repository: configs }, accountRepository: accounts, secretService: { async resolve() { return { async read() { return 'fixture-token'; } }; } }, registry, egress, quota, audit, admission: createTaskAdmission({ configRepository: configs, accountRepository: accounts, registry, profileDirectory: directory }), dispatch: async () => {} });
  const request = (id, parameters) => ({ ownerId, requestId: id, target: 'text', intent: 'text.chat', input: { text: 'hello' }, options: { providerConfigId: configId, modelId: model, ...(parameters ? { parameters } : {}) } });
  try {
    await pool.query("INSERT INTO admin_principals(principal_id,status,credential_ref) VALUES($1,'invited','fixture')", [ownerId]);
    await pool.query("INSERT INTO provider_accounts(account_id,owner_type,owner_id,protocol_type,display_name,credential_ref,scope,state) VALUES($1,'admin',$2,'openai-compatible','fixture','fixture-ref','{}','ready')", [accountId, ownerId]);
    await pool.query("INSERT INTO provider_configs(provider_config_id,owner_id,provider_account_id,protocol_type,display_name,base_url,status,protocol_version,descriptor_version,request_id) VALUES($1,$2,$3,'openai-compatible','fixture','https://fixture.test/v1','ready','v1','text.v1',$4)", [configId, ownerId, accountId, randomUUID()]);
    await configs.replaceCatalog(configId, [{ modelId: model, displayName: model, taskModes: ['text.chat'], capabilitySummary: { text: true }, streaming: true, tools: false }]);
    await pool.query("INSERT INTO model_policies(provider_config_id,model_id,enabled,assigned_capabilities,default_for,classification_source) VALUES($1,$2,true,'[\"text\"]','[]','user')", [configId, model]);
    const oldCatalog = await configs.getCatalog(configId);
    const record = configs.audit.record;
    configs.audit.record = async () => { throw new Error('audit_unavailable'); };
    try { await assert.rejects(configs.withAuditedMutation((client) => configs.replaceCatalog(configId, [{ modelId: 'wrong-model', displayName: 'Wrong Model', taskModes: ['text.chat'], capabilitySummary: { text: true }, streaming: true, tools: false }], client, '1'), audit, () => ({ requestId: randomUUID(), actorId: ownerId, action: 'provider.models.refresh', targetType: 'provider_config', targetId: configId, summary: {} })), /audit_unavailable/); }
    finally { configs.audit.record = record; }
    assert.deepEqual(await configs.getCatalog(configId), oldCatalog);
    await pool.query("INSERT INTO quota_policies(policy_id,scope_type,scope_id,metric,window_seconds,hard_limit,soft_limit,version,effective_at) VALUES($1,'subject',$2,'requests',3600,100,100,1,now())", [randomUUID(), ownerId]);
    const responseProfile = { schemaVersion: 'dgos-capability/v1', kind: 'model', id: 'fixture.responses', version: '1.0.0', executor: { type: 'declarative', engine: 'dgos-text-v1' }, capabilities: ['text.chat'], operations: { submit: { profile: 'responses', method: 'POST', path: '/responses' } }, workflows: { 'text.chat': { submit: 'submit' } }, defaults: { temperature: 0.4 }, limits: { maxInputCharacters: 20, maxOutputTokens: 30 }, uiSchemas: { parameters: ['temperature', 'maxOutputTokens'] }, modelProfiles: { text: { modelNames: [model], workflow: 'text.chat', defaults: { maxOutputTokens: 12 }, limits: { maxOutputTokens: 15 } } }, assets: {} };
    await pool.query("INSERT INTO provider_text_profiles(profile_id,version,owner_id,protocol_type,status,digest,declaration) VALUES($1,1,$2,'openai-compatible','active',$3,$4)", [responseProfile.id, ownerId, 'fixture-digest', JSON.stringify(responseProfile)]);
    await pool.query('UPDATE provider_configs SET capability_protocol_id=$2,capability_protocol_version=$3 WHERE provider_config_id=$1', [configId, responseProfile.id, responseProfile.version]);
    const service = makeService();
    const rejected = request(randomUUID(), { maxOutputTokens: 16 });
    await assert.rejects(service.submit(rejected), { errorKey: 'invalid_request' });
    await assert.rejects(service.submit(request(randomUUID(), { vendor_option: true })), { errorKey: 'invalid_request' });
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM ai_tasks WHERE owner_id=$1', [ownerId])).rows[0].n, 0);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM quota_reservations WHERE subject_id=$1', [ownerId])).rows[0].n, 0);
    assert.equal(bodies.length, 0);
    const firstRequest = request(randomUUID(), { temperature: 0.7 });
    const first = await service.submit(firstRequest); taskIds.push(first.taskId);
    const saved = await repo.getTask(first.taskId);
    assert.deepEqual(saved.executionSnapshot.normalizedParameters, { temperature: 0.7, maxOutputTokens: 12 });
    assert.equal(saved.executionSnapshot.resolvedProfile.operationProfile, 'responses');
    const replay = await service.submit(firstRequest); assert.equal(replay.taskId, first.taskId);
    const restartedWorker = new AiTaskWorker({ repository: new PostgresAiTaskRepository(pool), taskService: makeService(), workerId: 'parameter-worker' });
    const running = restartedWorker.runOnce();
    try {
      const deadline = Date.now() + 2000;
      let early;
      do {
        early = await repo.listEvents(first.taskId, 0);
        if (early.some((item) => item.type === 'text.delta' && item.delta === 'ok')) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      } while (Date.now() < deadline);
      assert.ok(early.some((item) => item.type === 'text.delta' && item.delta === 'ok'));
      assert.equal((await repo.getTask(first.taskId)).status, 'running');
    } finally { releaseFirstResponse(); }
    assert.equal((await running).status, 'succeeded');
    assert.deepEqual(bodies[0], { path: '/v1/responses', body: { model, input: 'hello', stream: true, temperature: 0.7, max_output_tokens: 12 }, streamResponse: true });
    await pool.query('UPDATE provider_configs SET capability_protocol_id=NULL,capability_protocol_version=NULL,version=version+1 WHERE provider_config_id=$1', [configId]);
    assert.equal((await service.submit(firstRequest)).taskId, first.taskId);
    const second = await service.submit(request(randomUUID(), { maxOutputTokens: 9 })); taskIds.push(second.taskId);
    assert.equal((await restartedWorker.runOnce()).status, 'succeeded');
    assert.deepEqual(bodies[1], { path: '/v1/chat/completions', body: { model, messages: [{ role: 'user', content: 'hello' }], stream: true, stream_options: { include_usage: true }, max_tokens: 9 }, streamResponse: true });
    const denied = await service.submit(request(randomUUID(), { temperature: 0.2 })); taskIds.push(denied.taskId);
    await pool.query('UPDATE provider_configs SET version=version+1 WHERE provider_config_id=$1', [configId]);
    assert.equal((await restartedWorker.runOnce()).status, 'failed');
    assert.equal(bodies.length, 2);
    assert.equal((await pool.query('SELECT state FROM quota_reservations WHERE task_id=$1', [denied.taskId])).rows[0].state, 'released');
  } finally {
    await pool.query('DELETE FROM audit_outbox WHERE event_id IN (SELECT event_id FROM audit_events WHERE actor_id=$1)', [ownerId]);
    await pool.query('DELETE FROM audit_events WHERE actor_id=$1', [ownerId]);
    await pool.query('DELETE FROM usage_events WHERE task_id=ANY($1::uuid[])', [taskIds]);
    await pool.query('DELETE FROM quota_reservations WHERE task_id=ANY($1::uuid[])', [taskIds]);
    await pool.query('DELETE FROM artifacts WHERE task_id=ANY($1::uuid[])', [taskIds]);
    await pool.query('DELETE FROM ai_task_events WHERE task_id=ANY($1::uuid[])', [taskIds]);
    await pool.query('DELETE FROM ai_task_attempts WHERE task_id=ANY($1::uuid[])', [taskIds]);
    await pool.query('DELETE FROM ai_tasks WHERE task_id=ANY($1::uuid[])', [taskIds]);
    await pool.query('DELETE FROM quota_policies WHERE scope_id=$1', [ownerId]);
    await pool.query('DELETE FROM model_policies WHERE provider_config_id=$1', [configId]);
    await pool.query('DELETE FROM model_catalog_entries WHERE provider_config_id=$1', [configId]);
    await pool.query('DELETE FROM model_catalogs WHERE provider_config_id=$1', [configId]);
    await pool.query('DELETE FROM provider_text_profiles WHERE owner_id=$1', [ownerId]);
    await pool.query('DELETE FROM provider_configs WHERE provider_config_id=$1', [configId]);
    await pool.query('DELETE FROM provider_accounts WHERE account_id=$1', [accountId]);
    await pool.query('DELETE FROM admin_principals WHERE principal_id=$1', [ownerId]);
    await pool.end();
  }
});
