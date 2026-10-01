import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import pg from '../apps/api/node_modules/pg/lib/index.js';

const runId = `F-${new Date().toISOString().replaceAll(/[:.]/g, '-')}`;
const output = `docs/05-测试与发布/端到端验收/报告/${runId}`;
await mkdir(output, { recursive: true });
const report = { run_id: runId, environment: 'local-compose-fixture', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), started_at: new Date().toISOString(), cases: [], limitations: ['受控 HTTP Provider fixture；未验证真实外部 Provider/TLS、签名桌面、生产 KMS。', 'worker SIGKILL 在已发上游请求时会重发；只保证已验证场景的唯一 quota 结算。', 'Action recovery 尚未持久化 handler 输入并重新派发；不能宣称重启接管完成。'] };
const compose = (...args) => execFileSync('docker', ['compose', '-f', 'docker-compose.integration.yml', ...args], { encoding: 'utf8', timeout: 30000 });
const pool = new pg.Pool({ connectionString: 'postgresql://dgos:dgos@127.0.0.1:15432/dgos' });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(10000);
page.on('pageerror', (error) => console.error('Browser error:', error.message));
let session;
const api = async (path, { method = 'GET', body, status = 200, headers = {} } = {}) => {
  const response = await fetch(`http://127.0.0.1:14173/api/v1${path}`, { method, headers: { ...(session ? { authorization: `Bearer ${session.sessionId}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text(); assert.equal(response.status, status, `${path}: ${text}`);
  return text ? JSON.parse(text) : null;
};
const waitFor = async (work, predicate, timeout = 25000) => { const deadline = Date.now() + timeout; let value; do { value = await work(); if (predicate(value)) return value; await new Promise((r) => setTimeout(r, 100)); } while (Date.now() < deadline); throw new Error(`wait_timeout: ${JSON.stringify(value)}`); };
const fixture = async (scenario) => (await fetch('http://127.0.0.1:14080/__fixture', scenario ? { method: 'POST', body: JSON.stringify({ scenario }) } : {})).json();
const countCalls = async () => (await fixture()).requests.filter((r) => r.path === '/v1/chat/completions').length;
const record = (name, evidence) => { report.cases.push({ name, status: 'passed', ...evidence }); console.log(JSON.stringify({ case: name, status: 'passed' })); };
try {
  await page.goto('http://127.0.0.1:14173');
  await page.getByRole('button', { name: 'First-time setup' }).click();
  await page.getByLabel('Display name').fill('Release integration');
  await page.getByLabel('Credential').fill('local-release-fixture');
  const boot = page.waitForResponse((r) => r.url().endsWith('/identity/admin/bootstrap'));
  await page.getByRole('button', { name: 'Create admin session' }).click();
  session = await (await boot).json(); assert.ok(session.sessionId);
  await api('/quota/policies', { method: 'PUT', body: { requestId: randomUUID(), metric: 'requests', scopeType: 'subject', scopeId: session.principalId, hardLimit: 100, softLimit: 90, windowSeconds: 3600, effectiveAt: new Date().toISOString() } });
  await page.getByText('Create provider configuration').click();
  await page.getByLabel('Base URL').fill('https://fixture.test/v1');
  await page.getByLabel('Credential').fill('dgos-fixture-token');
  await page.getByRole('button', { name: 'Save configuration' }).click();
  await page.getByRole('button', { name: 'Validate and refresh catalog' }).click();
  await page.getByRole('button', { name: 'Enable', exact: true }).click();
  await page.getByRole('button', { name: 'Enabled', exact: true }).waitFor();
  const configId = (await api('/provider/configs')).items[0].id;
  const taskInput = (requestId = randomUUID()) => ({ requestId, target: 'text', intent: 'text.chat', input: { text: 'release integration' }, options: { providerConfigId: configId, modelId: 'fixture-text-model' } });
  const terminal = (id) => waitFor(() => api(`/ai-tasks/${id}`), (t) => ['succeeded', 'failed', 'cancelled', 'timed_out'].includes(t.status));
  const facts = async (id) => {
    const attempts = (await pool.query('SELECT attempt_id,state,attempts FROM ai_task_attempts WHERE task_id=$1', [id])).rows;
    const reservations = (await pool.query('SELECT reservation_id,state FROM quota_reservations WHERE task_id=$1', [id])).rows;
    const usage = (await pool.query('SELECT usage_event_id FROM usage_events WHERE task_id=$1', [id])).rows;
    return { taskId: id, attempts, reservations, usage };
  };
  const before = await countCalls();
  const submitted = page.waitForResponse((r) => r.url().endsWith('/ai-tasks') && r.request().method() === 'POST');
  await page.getByLabel('Prompt').fill('hello from Compose browser');
  await page.getByRole('button', { name: 'Run task' }).click();
  const response = await submitted; const receipt = await response.json();
  await page.locator('.pill.succeeded').waitFor({ timeout: 20000 });
  assert.equal(await page.locator('.result pre').textContent(), 'hello world');
  const replay = await api('/ai-tasks', { method: 'POST', body: response.request().postDataJSON(), status: 202 });
  assert.equal(replay.taskId, receipt.taskId); assert.equal(await countCalls() - before, 1);
  await page.getByRole('button', { name: 'Re-query / resume' }).click();
  const result = await terminal(receipt.taskId);
  const artifact = await api(`/artifacts/${result.artifactIds[0]}`); assert.equal(artifact.content, 'hello world');
  const successFacts = await facts(receipt.taskId); assert.equal(successFacts.attempts.length, 1); assert.equal(successFacts.reservations.length, 1); assert.equal(successFacts.usage.length, 1);
  const events = (await pool.query('SELECT sequence,event_type FROM ai_task_events WHERE task_id=$1 ORDER BY sequence', [receipt.taskId])).rows;
  assert.equal(events.filter((e) => e.event_type === 'task.completed').length, 1);
  const resumed = await fetch(`http://127.0.0.1:14173/api/v1/ai-tasks/${receipt.taskId}/events`, { headers: { authorization: `Bearer ${session.sessionId}`, 'last-event-id': String(events[1].sequence) } });
  const ids = [...(await resumed.text()).matchAll(/^id: (\d+)/gm)].map((m) => Number(m[1])); assert.ok(ids.length && ids.every((id) => id > events[1].sequence));
  await page.screenshot({ path: `${output}/workbench.png`, fullPage: true });
  record('Web → API → PostgreSQL → two workers → adapter → fixture → SSE/Artifact; replay', { ...successFacts, artifactId: result.artifactIds[0], sequences: events.map((e) => e.sequence), upstreamCalls: 1 });

  for (const scenario of ['forbidden', 'malformed', 'empty', 'disconnect', 'timeout']) {
    await fixture(scenario); const start = await countCalls();
    const task = await api('/ai-tasks', { method: 'POST', body: taskInput(), status: 202 });
    const final = await terminal(task.taskId); assert.equal(final.status, scenario === 'timeout' ? 'timed_out' : 'failed'); assert.deepEqual(final.artifactIds, []);
    const data = await facts(task.taskId); assert.equal(data.reservations.length, 1); assert.equal(data.usage.length, 1); assert.equal(await countCalls() - start, 1);
    record(`Provider ${scenario}`, { ...data, status: 'passed', terminal: final.status });
  }
  await fixture('timeout');
  const cancel = await api('/ai-tasks', { method: 'POST', body: taskInput(), status: 202 });
  await waitFor(() => api(`/ai-tasks/${cancel.taskId}`), (t) => t.status === 'running');
  await api(`/ai-tasks/${cancel.taskId}`, { method: 'DELETE', body: {} });
  assert.equal((await terminal(cancel.taskId)).status, 'cancelled');
  await api(`/ai-tasks/${cancel.taskId}`, { method: 'DELETE', body: {} });
  const cancelled = await facts(cancel.taskId); assert.equal(cancelled.reservations.length, 1); assert.equal(cancelled.reservations[0].state, 'released'); assert.equal(cancelled.usage.length, 0);
  record('Cross-process cancellation releases once', cancelled);

  // Pause consumers, enqueue through API, then simulate a dead claimant before upstream IO.
  compose('stop', 'worker'); await fixture('success'); const calls = await countCalls();
  const queued = await api('/ai-tasks', { method: 'POST', body: taskInput(), status: 202 });
  await new Promise((r) => setTimeout(r, 300)); assert.equal(await countCalls(), calls);
  const attempt = (await facts(queued.taskId)).attempts[0];
  await pool.query("UPDATE ai_task_attempts SET state='running',lease_owner='crashed-before-provider',lease_until=now()-interval '1 second',attempts=1 WHERE attempt_id=$1", [attempt.attempt_id]);
  compose('start', 'worker'); assert.equal((await terminal(queued.taskId)).status, 'succeeded');
  const reclaimed = await facts(queued.taskId); assert.equal(reclaimed.attempts[0].attempts, 2); assert.equal(reclaimed.usage.length, 1); assert.equal(await countCalls() - calls, 1);
  record('Expired pre-provider claim is recovered once by competing processes', reclaimed);

  await fixture('timeout'); const crashCalls = await countCalls();
  const crashing = await api('/ai-tasks', { method: 'POST', body: taskInput(), status: 202 });
  await waitFor(countCalls, (n) => n > crashCalls);
  compose('kill', '-s', 'SIGKILL', 'worker'); await fixture('success'); compose('start', 'worker');
  assert.equal((await terminal(crashing.taskId)).status, 'succeeded');
  const crashFacts = await facts(crashing.taskId); assert.equal(crashFacts.reservations.length, 1); assert.equal(crashFacts.usage.length, 1);
  record('SIGKILL during upstream IO; lease recovery and unique settlement', { ...crashFacts, upstreamCalls: await countCalls() - crashCalls, limitation: '已发上游请求后 crash 会重发；不构成上游 exactly-once 证据。' });

  const settings = await api('/system/settings');
  await api('/permissions', { method: 'PATCH', body: { subjectId: session.principalId, appId: 'dgos.system', capability: 'system.settings.write', decision: 'allow' } });
  const input = { baseVersion: settings.settingsVersion, patch: { domain: 'appearance', value: { mode: 'dark' } } };
  const plan = await api('/actions/system.settings.patch/plan', { method: 'POST', body: { input } });
  assert.equal(plan.permission.decision, 'allow');
  const action = await api('/actions/system.settings.patch/execute', { method: 'POST', body: { planId: plan.planId, input, confirmed: true }, status: 202 });
  const actionDone = await waitFor(() => api(`/action-runs/${action.runId}`), (r) => ['succeeded', 'failed'].includes(r.state));
  assert.equal(actionDone.state, 'succeeded'); assert.equal(actionDone.handlerCalls, 1);
  const changed = await api('/system/settings'); assert.ok(Number(changed.settingsVersion) > Number(settings.settingsVersion));
  await api('/system/settings', { method: 'PATCH', body: input, status: 409 });
  await api('/permissions', { method: 'PATCH', body: { subjectId: session.principalId, appId: 'dgos.system', capability: 'system.settings.write', decision: 'deny' } });
  const deniedInput = { baseVersion: changed.settingsVersion, patch: { domain: 'appearance', value: { mode: 'light' } } };
  const deniedPlan = await api('/actions/system.settings.patch/plan', { method: 'POST', body: { input: deniedInput } });
  await api('/actions/system.settings.patch/execute', { method: 'POST', body: { planId: deniedPlan.planId, input: deniedInput, confirmed: true }, status: 403 });
  assert.equal((await api('/system/settings')).settingsVersion, changed.settingsVersion);
  record('PostgreSQL assistant action / settings conflict / deny', { runId: action.runId, settingsVersion: changed.settingsVersion });

  await api('/permissions', { method: 'PATCH', body: { subjectId: session.principalId, appId: 'dgos.system', capability: 'system.settings.write', decision: 'allow' } });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.getByLabel('baseVersion', { exact: true }).fill(changed.settingsVersion);
  await page.getByLabel('patch', { exact: true }).fill(JSON.stringify({ domain: 'appearance', value: { mode: 'light' } }));
  assert.ok(await page.getByLabel('patch', { exact: true }).inputValue());
  const [plannedResponse] = await Promise.all([page.waitForResponse((r) => r.url().includes('/actions/system.settings.patch/plan')), page.getByRole('button', { name: 'Create plan' }).click()]);
  assert.equal(plannedResponse.status(), 200, await plannedResponse.text());
  const [execution] = await Promise.all([page.waitForResponse((r) => r.url().includes('/actions/system.settings.patch/execute')), page.getByRole('button', { name: 'Confirm and execute' }).click()]);
  const browserAction = await execution.json();
  const browserDone = await waitFor(() => api(`/action-runs/${browserAction.runId}`), (r) => ['succeeded', 'failed'].includes(r.state));
  assert.equal(browserDone.state, 'succeeded');
  await page.screenshot({ path: `${output}/assistant.png`, fullPage: true });
  record('Browser assistant JSON input / plan / execute with PostgreSQL', { runId: browserAction.runId });

  const key = await api('/secret/api-keys', { method: 'POST', body: { name: 'release-test', scopes: ['apiKey.read'] }, status: 201 });
  const rotated = await api(`/secret/api-keys/${key.key.keyId}/rotate`, { method: 'POST', body: {} });
  await api('/secret/api-keys', { status: 401, headers: { authorization: `ApiKey ${key.secret}` } });
  await api('/provider/configs', { status: 403, headers: { authorization: `ApiKey ${rotated.secret}` } });
  await api(`/secret/api-keys/${rotated.key.keyId}`, { method: 'DELETE' });
  await api('/secret/api-keys', { status: 401, headers: { authorization: `ApiKey ${rotated.secret}` } });
  const audit = await api('/audit/events?action=api_key.create'); assert.ok(audit.items.some((e) => e.target.id === key.key.keyId));
  record('PostgreSQL API key rotation/scope/revocation/audit', { keyId: key.key.keyId, eventIds: audit.items.map((e) => e.eventId) });
  const settingsBeforeRestart = await api('/system/settings');
  compose('restart', 'api');
  await waitFor(async () => { try { return (await fetch('http://127.0.0.1:13000/ready')).ok; } catch { return false; } }, Boolean);
  assert.equal((await api('/system/settings')).settingsVersion, settingsBeforeRestart.settingsVersion);
  const login = await api('/identity/admin/login', { method: 'POST', body: { principalHint: session.principalId, credential: 'local-release-fixture' } }); assert.ok(login.sessionId);
  await api('/identity/admin/session', { method: 'POST', body: { baseVersion: '1' } });
  await api(`/identity/admin/sessions/${session.sessionId}`, { method: 'DELETE' });
  await api('/identity/admin/session', { status: 401 });
  session = login;
  record('API restart keeps secrets/settings; login, renew and revoke', { principalId: session.principalId, settingsVersion: settingsBeforeRestart.settingsVersion });

  const backup = execFileSync('docker', ['compose', '-f', 'docker-compose.integration.yml', 'exec', '-T', 'postgres', 'pg_dump', '-U', 'dgos', '-d', 'dgos', '--no-owner', '--no-acl'], { maxBuffer: 16 * 1024 * 1024 });
  await pool.query('CREATE DATABASE dgos_restore');
  try {
    execFileSync('docker', ['compose', '-f', 'docker-compose.integration.yml', 'exec', '-T', 'postgres', 'psql', '-U', 'dgos', '-d', 'dgos_restore', '-v', 'ON_ERROR_STOP=1'], { input: backup, maxBuffer: 16 * 1024 * 1024 });
    const restored = new pg.Pool({ connectionString: 'postgresql://dgos:dgos@127.0.0.1:15432/dgos_restore' });
    try { const original = (await pool.query('SELECT task_id,state FROM ai_tasks ORDER BY task_id')).rows; assert.deepEqual((await restored.query('SELECT task_id,state FROM ai_tasks ORDER BY task_id')).rows, original); assert.equal((await restored.query('SELECT content FROM artifacts WHERE artifact_id=$1', [result.artifactIds[0]])).rows[0].content, 'hello world'); record('Local PostgreSQL backup/restore drill', { taskCount: original.length, backupSha256: createHash('sha256').update(backup).digest('hex'), limitation: '不含 Redis 秘密备份；非生产灾备验收。' }); } finally { await restored.end(); }
  } finally { await pool.query('DROP DATABASE dgos_restore'); }
  report.migrations = (await pool.query('SELECT version,checksum FROM dgos_schema_migrations ORDER BY version')).rows;
  report.exit_code = 0;
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
  report.exit_code = 1; report.error = error.message; process.exitCode = 1; console.error(error);
} finally {
  await browser.close(); await pool.end();
  report.finished_at = new Date().toISOString();
  report.command = 'pnpm run test:release';
  report.working_directory = process.cwd();
  report.code_version = report.commit;
  report.stats = { passed: report.cases.length, failed: report.exit_code ? 1 : 0 };
  report.test_report = `${output}.md`;
  report.cleanup = '浏览器及验证 DB pool 已关闭；Compose 服务保留待操作者 down，dgos_restore 已删除。';
  report.sanitization = '只存业务 ID、状态、摘要与截图；不存 Cookie/API Key/Provider credential/备份正文。';
  report.scope = '本地跨容器任务、动作、认证、迁移和数据库恢复';
  report.asset_sha256 = {};
  for (const file of ['scripts/release-integration.mjs', 'docker-compose.integration.yml', 'apps/api/src/server.mjs', 'apps/worker/src/worker.mjs', 'src/ai-task/service.mjs', 'src/provider-adapters/openai-compatible.mjs', 'apps/web/src/main.js']) report.asset_sha256[file] = createHash('sha256').update(await readFile(file)).digest('hex');
  report.working_tree = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' });
  await writeFile(`${output}-manifest.json`, JSON.stringify(report, null, 2) + '\n');
  await writeFile(`${output}.md`, `# ${runId} 执行记录\n\n环境：${report.environment}；代码：${report.commit} + manifest 中工作区及源码摘要。命令：\`pnpm run test:release\`。退出码：${report.exit_code}。\n\n${report.cases.map((c) => `- ${c.name}: ${c.status}`).join('\n')}\n\n${report.error ?? ''}\n\n限制：${report.limitations.join('；')}\n\n[机器证据](${runId}-manifest.json)\n`);
  console.log(`Evidence: ${output}-manifest.json`);
}
