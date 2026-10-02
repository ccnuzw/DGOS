import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import pg from '../apps/api/node_modules/pg/lib/index.js';
import { integrationEnvironment } from './release-environment.mjs';
import { sourceIdentity } from './verify-release.mjs';

const environment = integrationEnvironment();
const runId = `V1-core-${new Date().toISOString().replaceAll(/[:.]/g, '-')}`;
const output = `docs/05-测试与发布/端到端验收/报告/${runId}`;
const command = 'DGOS_CORE_CREDENTIAL=<redacted> node scripts/v1-core-compose.mjs';
const assets = ['scripts/v1-core-compose.mjs', 'docker-compose.integration.yml', 'apps/api/src/server.mjs', 'apps/api/src/provider-protocol-routes.mjs', 'apps/worker/src/worker.mjs', 'src/ai-task/repository.mjs', 'src/ai-task/service.mjs', 'src/quota/repository.mjs', 'src/quota/service.mjs', 'src/provider-config/task-admission.mjs', 'src/provider-config/protocol-confirmations.mjs', 'src/actions/service.mjs'];
const hashAssets = async () => Object.fromEntries(await Promise.all(assets.map(async (file) => [file, createHash('sha256').update(await readFile(file)).digest('hex')])));
const report = { run_id: runId, environment: 'local-compose-fixture', started_at: new Date().toISOString(), command, working_directory: process.cwd(), scope: 'V1 core public HTTP and dedicated PostgreSQL facts', cases: [], limitations: ['Fixture is local; no public Provider/TLS or production guarantee.', 'Main worktree has concurrent edits; this is not a frozen build or full V1 E2E pass.'], cleanup: 'No database reset; batch rows remain for inspection. Dedicated Compose services remain running.', sanitization: 'Credential, session token, request bodies, and fixture request bodies are omitted.' };
const pool = new pg.Pool({ connectionString: environment.databaseUrl, connectionTimeoutMillis: 3000 });
const credential = process.env.DGOS_CORE_CREDENTIAL;
let session;
let workersStopped = false;
let phase = 'preflight';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (name, read, predicate, timeoutMs = 20000) => { const deadline = Date.now() + timeoutMs; let value; do { value = await read(); if (predicate(value)) return value; await sleep(150); } while (Date.now() < deadline); throw new Error(`${name}_timeout`); };
const http = async (path, { method = 'GET', body, status = 200, headers = {}, timeoutMs = 8000 } = {}) => {
  const response = await fetch(`${environment.apiUrl}/api/v1${path}`, { method, signal: AbortSignal.timeout(timeoutMs), headers: { ...(session ? { authorization: `Bearer ${session.sessionId}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  if (response.status !== status) {
    let errorKey;
    try { errorKey = JSON.parse(text).errorKey; } catch { /* Keep response body out of evidence. */ }
    throw new Error(`${method} ${path}: HTTP ${response.status}, expected ${status}, errorKey=${errorKey ?? 'unavailable'}`);
  }
  return text ? JSON.parse(text) : null;
};
const fixture = async (scenario) => {
  const response = await fetch(`${environment.fixtureUrl}/__fixture`, { signal: AbortSignal.timeout(5000), ...(scenario ? { method: 'POST', body: JSON.stringify({ scenario }) } : {}) });
  assert.equal(response.status, 200);
  return response.json();
};
const calls = async () => (await fixture()).requests.filter((request) => request.path === '/v1/chat/completions').length;
const compose = (...args) => execFileSync('docker', [...environment.composeArgs, ...args], { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
const record = (name, facts) => { report.cases.push({ name, result: 'passed', facts }); console.log(JSON.stringify({ case: name, result: 'passed' })); };
const taskBody = (configId, requestId = randomUUID()) => ({ requestId, target: 'text', intent: 'text.chat', input: { text: `core-${runId}` }, options: { providerConfigId: configId, modelId: 'fixture-text-model' } });
const taskState = (taskId) => http(`/ai-tasks/${taskId}`);
const terminal = (taskId) => waitFor('task_terminal', () => taskState(taskId), (task) => ['succeeded', 'failed', 'cancelled', 'timed_out'].includes(task.status), 25000);
const taskFacts = async (taskId) => {
  const { rows } = await pool.query(`SELECT t.state, (SELECT count(*)::int FROM ai_task_attempts WHERE task_id=t.task_id) AS attempts, (SELECT count(*)::int FROM quota_reservations WHERE task_id=t.task_id) AS reservations, (SELECT count(*)::int FROM usage_events WHERE task_id=t.task_id) AS usage, (SELECT count(*)::int FROM artifacts WHERE task_id=t.task_id) AS artifacts, (SELECT count(*)::int FROM ai_task_events WHERE task_id=t.task_id AND event_type IN ('task.completed','task.failed','task.cancelled')) AS terminal_events, (SELECT count(*)::int FROM audit_events e JOIN audit_outbox o ON o.event_id=e.event_id WHERE e.target_type='ai_task' AND e.target_id=t.task_id::text AND e.action='ai.task.submit') AS submit_outbox, (SELECT count(*)::int FROM audit_events e JOIN audit_outbox o ON o.event_id=e.event_id WHERE e.target_type='ai_task' AND e.target_id=t.task_id::text AND e.action IN ('ai.task.complete','ai.task.fail')) AS terminal_outbox FROM ai_tasks t WHERE task_id=$1`, [taskId]);
  return rows[0];
};

try {
  report.source_before = await sourceIdentity();
  report.asset_sha256 = await hashAssets();
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name, 'dgos_v1_integrated');
  const { rows: migrationRows } = await pool.query('SELECT version,checksum FROM dgos_schema_migrations ORDER BY version');
  report.migrations = migrationRows;
  for (const version of ['0033-provider-admission', '0034-extension-recovery', '0035-package-recovery', '0036-provider-operations', '0037-app-data-migration', '0038-permission-action-lifecycle', '0039-provider-protocol-confirmations', '0040-provider-profile-bindings']) assert.ok(migrationRows.some((row) => row.version === version), `required_migration_missing:${version}`);
  const schema = (await pool.query("SELECT to_regclass('provider_secret_revoke_intents') AS intents, to_regclass('provider_text_profiles') AS profiles, to_regclass('app_data_migrations') AS data_migrations, to_regclass('permission_change_receipts') AS permission_receipts, to_regclass('provider_protocol_confirmations') AS provider_confirmations")).rows[0];
  assert.ok(schema.intents && schema.profiles && schema.data_migrations && schema.permission_receipts && schema.provider_confirmations, 'required_schema_missing');
  const profileColumns = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='provider_configs' AND column_name IN ('capability_protocol_id','capability_protocol_version')")).rows;
  assert.equal(profileColumns.length, 2, 'provider_profile_columns_missing');
  assert.ok(credential && credential.length >= 8, 'DGOS_CORE_CREDENTIAL_required');
  await waitFor('api_ready', async () => { try { return (await fetch(`${environment.apiUrl}/ready`, { signal: AbortSignal.timeout(2000) })).status; } catch { return 0; } }, (status) => status === 200, 15000);
  assert.equal((await fetch(environment.webUrl, { signal: AbortSignal.timeout(5000) })).status, 200);
  await fixture('success');
  record('Dedicated Compose and schema', { database: 'dgos_v1_integrated', migrationCount: migrationRows.length, apiReady: true, webReady: true });

  phase = 'admin_session';
  const principals = (await pool.query('SELECT principal_id FROM admin_principals ORDER BY created_at LIMIT 1')).rows;
  if (principals.length) {
    const total = (await pool.query('SELECT count(*)::int AS n FROM admin_principals')).rows[0].n;
    const principalHint = process.env.DGOS_CORE_PRINCIPAL_ID ?? (total === 1 ? principals[0].principal_id : undefined);
    assert.ok(principalHint, 'DGOS_CORE_PRINCIPAL_ID_required_for_multiple_admins');
    session = await http('/identity/admin/login', { method: 'POST', body: { principalHint, credential } });
  } else {
    session = await http('/identity/admin/bootstrap', { method: 'POST', status: 201, body: { displayName: `Core ${runId}`, credential } });
  }
  assert.ok(session.sessionId && session.principalId);
  record('Admin session', { principalId: session.principalId, path: principals.length ? 'login' : 'bootstrap' });

  phase = 'provider_probe_ready';
  const account = await http('/provider/accounts', { method: 'POST', status: 201, body: { requestId: randomUUID(), protocolType: 'openai-compatible', displayName: runId, credential: 'dgos-fixture-token', scope: { endpoint: 'https://fixture.test/v1' } } });
  const probe = await http('/provider/connection-tests', { method: 'POST', status: 202, body: { requestId: randomUUID(), accountId: account.accountId, accountVersion: account.version, protocolVersion: 'v1' } });
  const probeDone = await waitFor('provider_probe', () => http(`/provider/connection-tests/${probe.testId}`), (value) => ['succeeded', 'failed', 'cancelled'].includes(value.status));
  assert.equal(probeDone.status, 'succeeded');
  const ready = await http(`/provider/accounts/${account.accountId}/state`, { method: 'POST', body: { requestId: randomUUID(), baseVersion: account.version, connectionTestId: probe.testId, state: 'ready' } });
  assert.equal(ready.status, 'ready');
  record('Probe then explicit ready', { accountId: account.accountId, testId: probe.testId, accountVersion: ready.version });

  phase = 'provider_config_catalog_policy';
  const config = await http('/provider/configs', { method: 'POST', status: 201, body: { requestId: randomUUID(), providerAccountId: account.accountId, protocolType: 'openai-compatible', displayName: runId, baseUrl: 'https://fixture.test/v1' } });
  const configId = config.providerConfigId ?? config.id;
  const validated = await http(`/provider/configs/${configId}/validate`, { method: 'POST', body: { requestId: randomUUID() } });
  assert.equal(validated.provider.status, 'ready');
  const catalog = await http(`/provider/configs/${configId}/models`, { method: 'POST', body: { requestId: randomUUID() } });
  const model = catalog.items.find((item) => item.modelId === 'fixture-text-model');
  assert.ok(model);
  const policy = await http(`/provider/configs/${configId}/model-policies`, { method: 'POST', body: { requestId: randomUUID(), modelId: model.modelId, enabled: true, assignedCapabilities: ['text'], defaultFor: [], baseVersion: '0' } });
  assert.equal(policy.enabled, true);
  record('Config validate, catalog refresh and model policy', { configId, catalogVersion: catalog.catalogVersion, policyVersion: policy.policyVersion });

  phase = 'quota_policy_preflight';
  const existingQuota = (await http('/quota/policies')).items.find((item) => item.scope?.type === 'subject' && String(item.scope?.id) === String(session.principalId) && item.metric === 'requests');
  const quotaPolicy = await http('/quota/policies', { method: 'PUT', body: { requestId: randomUUID(), metric: 'requests', scopeType: 'subject', scopeId: session.principalId, ...(existingQuota ? { baseVersion: existingQuota.version } : {}), hardLimit: 100, softLimit: 90, windowSeconds: 3600, effectiveAt: new Date().toISOString() } });
  const preflight = await http('/quota/preflight', { method: 'POST', body: { requestId: randomUUID(), subjectId: session.principalId, intent: 'text.chat', metric: 'requests', amount: 1 } });
  assert.equal(preflight.decision, 'allow');
  record('Quota preflight', { policyVersion: quotaPolicy.version, decision: preflight.decision });

  phase = 'task_success_replay';
  const before = await calls();
  const input = taskBody(configId);
  const submitted = await http('/ai-tasks', { method: 'POST', status: 202, body: input });
  assert.equal((await http('/ai-tasks', { method: 'POST', status: 202, body: input })).taskId, submitted.taskId);
  const completed = await terminal(submitted.taskId);
  assert.equal(completed.status, 'succeeded');
  assert.equal(await calls() - before, 1);
  const artifact = await http(`/artifacts/${completed.artifactIds[0]}`);
  assert.equal(artifact.content, 'hello world');
  const eventsResponse = await fetch(`${environment.apiUrl}/api/v1/ai-tasks/${submitted.taskId}/events`, { signal: AbortSignal.timeout(8000), headers: { authorization: `Bearer ${session.sessionId}`, 'last-event-id': '1' } });
  assert.equal(eventsResponse.status, 200);
  const eventIds = [...(await eventsResponse.text()).matchAll(/^id: (\d+)/gm)].map((match) => Number(match[1]));
  assert.ok(eventIds.length && eventIds.every((id) => id > 1));
  const successFacts = await taskFacts(submitted.taskId);
  assert.deepEqual(successFacts, { state: 'succeeded', attempts: 1, reservations: 1, usage: 1, artifacts: 1, terminal_events: 1, submit_outbox: 1, terminal_outbox: 1 });
  record('Task replay, SSE, artifact and unique settlement', { taskId: submitted.taskId, ...successFacts, upstreamCalls: 1, eventIds });

  phase = 'task_cancel';
  compose('stop', 'worker'); workersStopped = true;
  const cancelReceipt = await http('/ai-tasks', { method: 'POST', status: 202, body: taskBody(configId) });
  await http(`/ai-tasks/${cancelReceipt.taskId}`, { method: 'DELETE', body: { requestId: randomUUID() } });
  const cancelled = await terminal(cancelReceipt.taskId);
  assert.equal(cancelled.status, 'cancelled');
  const cancelledFacts = await taskFacts(cancelReceipt.taskId);
  assert.equal(cancelledFacts.terminal_events, 1);
  assert.equal(cancelledFacts.terminal_outbox, 1);
  assert.equal(cancelledFacts.usage, 0);
  record('Cancellation terminal facts', { taskId: cancelReceipt.taskId, ...cancelledFacts });
  compose('start', 'worker'); workersStopped = false;

  phase = 'worker_competition';
  const raceBefore = await calls();
  const raceReceipts = await Promise.all(Array.from({ length: 3 }, () => http('/ai-tasks', { method: 'POST', status: 202, body: taskBody(configId) })));
  for (const receipt of raceReceipts) { assert.equal((await terminal(receipt.taskId)).status, 'succeeded'); assert.deepEqual(await taskFacts(receipt.taskId), { state: 'succeeded', attempts: 1, reservations: 1, usage: 1, artifacts: 1, terminal_events: 1, submit_outbox: 1, terminal_outbox: 1 }); }
  assert.equal(await calls() - raceBefore, 3);
  record('Two workers competing for three attempts', { taskIds: raceReceipts.map((item) => item.taskId), upstreamCalls: 3 });

  phase = 'worker_crash_recovery';
  await fixture('timeout');
  const crashBefore = await calls();
  const crashing = await http('/ai-tasks', { method: 'POST', status: 202, body: taskBody(configId) });
  await waitFor('upstream_started', calls, (count) => count > crashBefore, 12000);
  compose('kill', '-s', 'SIGKILL', 'worker'); workersStopped = true;
  await fixture('success');
  compose('start', 'worker'); workersStopped = false;
  const uncertain = await terminal(crashing.taskId);
  assert.equal(uncertain.status, 'failed');
  assert.equal(uncertain.error?.errorKey, 'upstream_outcome_unknown');
  assert.equal(await calls() - crashBefore, 1);
  const unknownFacts = await taskFacts(crashing.taskId);
  assert.equal(unknownFacts.terminal_events, 1);
  assert.equal(unknownFacts.terminal_outbox, 1);
  assert.equal(unknownFacts.usage, 0);
  const reservation = (await pool.query('SELECT state FROM quota_reservations WHERE task_id=$1', [crashing.taskId])).rows[0];
  assert.equal(reservation.state, 'needs_review');
  record('SIGKILL after dispatch retains unknown without replay', { taskId: crashing.taskId, ...unknownFacts, reservationState: reservation.state, upstreamCalls: 1 });

  phase = 'hard_quota_denial';
  const used = (await pool.query("SELECT count(*)::int AS n FROM usage_events WHERE subject_id=$1 AND metric='requests' AND window_start=$2", [session.principalId, new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString()])).rows[0].n;
  const policyUpdate = await http('/quota/policies', { method: 'PUT', body: { requestId: randomUUID(), metric: 'requests', scopeType: 'subject', scopeId: session.principalId, baseVersion: quotaPolicy.version, hardLimit: used, softLimit: used, windowSeconds: 3600, effectiveAt: new Date().toISOString() } });
  const countBeforeDeny = (await pool.query('SELECT count(*)::int AS n FROM ai_tasks WHERE owner_id=$1', [session.principalId])).rows[0].n;
  await http('/ai-tasks', { method: 'POST', status: 429, body: taskBody(configId) });
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM ai_tasks WHERE owner_id=$1', [session.principalId])).rows[0].n, countBeforeDeny);
  record('Hard quota denial leaves no Task', { policyVersion: policyUpdate.version, taskCount: countBeforeDeny });

  phase = 'action_cross_process';
  const settings = await http('/system/settings');
  await http('/permissions', { method: 'PATCH', body: { subjectId: session.principalId, appId: 'dgos.system', capability: 'system.settings.write', decision: 'allow' } });
  const actionInput = { baseVersion: settings.settingsVersion, patch: { domain: 'appearance', value: { mode: 'dark' } } };
  const plan = await http('/actions/system.settings.patch/plan', { method: 'POST', body: { input: actionInput } });
  assert.equal(plan.permission.decision, 'allow');
  const action = await http('/actions/system.settings.patch/execute', { method: 'POST', status: 202, body: { planId: plan.planId, input: actionInput, confirmed: true } });
  const done = await waitFor('action_terminal', () => http(`/action-runs/${action.runId}`), (run) => ['succeeded', 'failed'].includes(run.state));
  assert.equal(done.state, 'succeeded');
  const latest = await http('/system/settings');
  assert.ok(Number(latest.settingsVersion) > Number(settings.settingsVersion));
  await http('/system/settings', { method: 'PATCH', status: 409, body: actionInput });
  await http('/permissions', { method: 'PATCH', body: { subjectId: session.principalId, appId: 'dgos.system', capability: 'system.settings.write', decision: 'deny' } });
  await http('/actions/system.settings.patch/plan', { method: 'POST', status: 403, body: { input: { ...actionInput, baseVersion: latest.settingsVersion } } });
  assert.equal((await http('/system/settings')).settingsVersion, latest.settingsVersion);
  record('Action worker, latest settings version, conflict and deny', { runId: action.runId, settingsVersion: latest.settingsVersion });

  report.exit_code = 0;
} catch (error) {
  report.exit_code = 1;
  report.error = error.message;
  report.failed_phase = phase;
  process.exitCode = 1;
  console.error(`V1 core Compose failed: ${error.message}`);
} finally {
  if (workersStopped) { try { compose('start', 'worker'); workersStopped = false; } catch (error) { report.exit_code = 1; report.error ??= `worker_restore_failed:${error.message}`; process.exitCode = 1; } }
  await pool.end();
  report.finished_at = new Date().toISOString();
  report.source_after = await sourceIdentity();
  report.asset_sha256_after = await hashAssets();
  report.source_drift = report.source_before?.head_commit !== report.source_after.head_commit || report.source_before?.working_tree_sha256 !== report.source_after.working_tree_sha256 || assets.some((asset) => report.asset_sha256?.[asset] !== report.asset_sha256_after[asset]);
  if (report.source_drift) { report.exit_code = 1; process.exitCode = 1; report.error ??= 'Source changed during verification'; }
  report.commit = report.source_before?.commit ?? null;
  report.head_commit = report.source_before?.head_commit ?? null;
  report.code_version = report.commit ?? (report.head_commit ? `${report.head_commit}+working-tree:${report.source_before.working_tree_sha256}` : 'unbound');
  report.test_report = `${output}.md`;
  report.stats = { expected: 11, passed: report.cases.length, failed: report.exit_code ? 1 : 0, skipped: Math.max(0, 11 - report.cases.length - (report.exit_code ? 1 : 0)), unexpected: report.exit_code ? 1 : 0, flaky: 0 };
  report.prior_attempts = ['docs/05-测试与发布/端到端验收/报告/V1-core-2026-10-01T17-50-28-797Z-manifest.json', 'docs/05-测试与发布/端到端验收/报告/V1-core-2026-10-01T17-55-17-691Z-manifest.json', 'docs/05-测试与发布/端到端验收/报告/V1-core-2026-10-01T17-55-43-102Z-manifest.json', 'docs/05-测试与发布/端到端验收/报告/V1-core-2026-10-01T17-56-46-534Z-manifest.json', 'docs/05-测试与发布/端到端验收/报告/V1-core-2026-10-01T17-57-19-678Z-manifest.json', 'docs/05-测试与发布/端到端验收/报告/V1-core-2026-10-01T17-59-12-353Z-manifest.json', 'docs/05-测试与发布/端到端验收/报告/V1-core-2026-10-01T18-00-07-428Z-manifest.json', 'docs/05-测试与发布/端到端验收/报告/V1-core-2026-10-01T18-01-32-524Z-manifest.json', 'docs/05-测试与发布/端到端验收/报告/V1-core-2026-10-01T23-37-52-799Z-manifest.json', 'docs/05-测试与发布/端到端验收/报告/V1-core-2026-10-01T23-38-46-283Z-manifest.json', 'docs/05-测试与发布/端到端验收/报告/V1-core-2026-10-01T23-40-02-857Z-manifest.json', 'docs/05-测试与发布/端到端验收/报告/V1-core-2026-10-01T23-40-57-422Z-manifest.json'];
  await writeFile(`${output}-manifest.json`, JSON.stringify(report, null, 2) + '\n');
  await writeFile(`${output}.md`, `# ${runId}\n\nEnvironment: local Compose fixture; code: ${report.code_version}; command: \`${command}\`; exit: ${report.exit_code}.\n\n${report.cases.map((item) => `- ${item.name}: passed`).join('\n')}\n\n${report.error ? `Failure: ${report.error}\n\n` : ''}Limitations: ${report.limitations.join(' ')}\n\n[Manifest](${runId}-manifest.json)\n`);
  console.log(`Evidence: ${output}-manifest.json`);
}
