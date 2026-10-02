import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PostgresProviderConfigRepository } from '../../src/provider-config/repository.mjs';
import { PostgresAiTaskRepository } from '../../src/ai-task/repository.mjs';
import { PostgresAuditRepository } from '../../src/audit/outbox.mjs';
import { isAiTaskRegressionParent, isolatedAiTaskDatabase } from '../../test-support/ai-task-regression.mjs';

test('PostgreSQL persists provider catalogs, policies, tasks, ordered events and artifacts', async (t) => {
  if (!isAiTaskRegressionParent(process.env.DGOS_DATABASE_URL)) { t.skip('requires dedicated dgos_v1_task or Verify parent database'); return; }
  const database = await isolatedAiTaskDatabase(process.env.DGOS_DATABASE_URL);
  t.after(() => database.cleanup());
  const { pool } = database;
  const ownerId = randomUUID(); const accountId = randomUUID(); const requestId = randomUUID();
  const configRepo = new PostgresProviderConfigRepository(pool); const taskRepo = new PostgresAiTaskRepository(pool);
  await pool.query("INSERT INTO admin_principals(principal_id,status,credential_ref) VALUES($1,'invited','fixture')", [ownerId]);
  await pool.query("INSERT INTO provider_accounts(account_id,owner_type,owner_id,protocol_type,display_name,credential_ref,scope,state) VALUES($1,'admin',$2,'openai-compatible','fixture','fixture-ref','{}','ready')", [accountId, ownerId]);
  let configId; let taskId; let artifactId;
  try {
    const config = await configRepo.create({ ownerId, providerAccountId: accountId, protocolType: 'openai-compatible', displayName: 'fixture', baseUrl: 'https://fixture.invalid/v1', requestId });
    configId = config.providerConfigId;
    const catalog = await configRepo.replaceCatalog(configId, [{ modelId: 'fixture-text', displayName: 'Fixture Text', capabilitySummary: { text: true }, taskModes: ['text.chat'], streaming: true, tools: false }]);
    assert.equal(catalog.catalogVersion, '1');
    const policy = await configRepo.updatePolicy(configId, { modelId: 'fixture-text', enabled: true, assignedCapabilities: ['text'], defaultFor: [], baseVersion: '0' });
    assert.equal(policy.policyVersion, '1');
    const task = await taskRepo.createTask({ ownerId, requestId, target: 'text', intent: 'text.chat', modelId: 'fixture-text', providerConfigId: configId, inputDigest: 'digest-fixture' });
    taskId = task.taskId;
    const attempt = await taskRepo.createAttempt({ taskId, providerConfigId: configId, providerAccountId: accountId, modelId: 'fixture-text' });
    assert.equal(attempt.taskId, taskId);
    assert.equal(await taskRepo.claimAttempt('postgres-test-worker', 1000), undefined);
    await new PostgresAuditRepository(pool).record({ requestId, actorId: ownerId, action: 'ai.task.submit', targetType: 'ai_task', targetId: taskId });
    const claimed = await taskRepo.claimAttempt('postgres-test-worker', 1000);
    assert.equal(claimed.taskId, taskId);
    const e1 = await taskRepo.event(taskId, 'task.accepted'); const e2 = await taskRepo.event(taskId, 'text.delta', { delta: 'hello' });
    assert.deepEqual([String(e1.sequence), String(e2.sequence)], ['1', '2']);
    const artifact = await taskRepo.createArtifact({ taskId, ownerId, mimeType: 'text/plain', content: 'hello' }); artifactId = artifact.artifactId;
    await taskRepo.transition(taskId, 'succeeded', { text: 'hello', artifactIds: [artifact.artifactId] });
    assert.deepEqual((await taskRepo.getTask(taskId)).artifactIds, [artifact.artifactId]);
    assert.equal((await taskRepo.getArtifact(artifactId)).content, 'hello');
    assert.equal((await taskRepo.findByRequest(ownerId, requestId, 'digest-fixture')).taskId, taskId);
  } finally {
    if (taskId) { await pool.query('DELETE FROM audit_outbox WHERE event_id IN (SELECT event_id FROM audit_events WHERE target_id=$1)', [taskId]); await pool.query('DELETE FROM audit_events WHERE target_id=$1', [taskId]); }
    if (artifactId) await pool.query('DELETE FROM artifacts WHERE artifact_id=$1', [artifactId]);
    if (taskId) { await pool.query('DELETE FROM ai_task_events WHERE task_id=$1', [taskId]); await pool.query('DELETE FROM ai_task_attempts WHERE task_id=$1', [taskId]); await pool.query('DELETE FROM ai_tasks WHERE task_id=$1', [taskId]); }
    if (configId) { await pool.query('DELETE FROM model_policies WHERE provider_config_id=$1', [configId]); await pool.query('DELETE FROM model_catalog_entries WHERE provider_config_id=$1', [configId]); await pool.query('DELETE FROM model_catalogs WHERE provider_config_id=$1', [configId]); await pool.query('DELETE FROM provider_configs WHERE provider_config_id=$1', [configId]); }
    await pool.query('DELETE FROM provider_accounts WHERE account_id=$1', [accountId]); await pool.query('DELETE FROM admin_principals WHERE principal_id=$1', [ownerId]);
  }
});
