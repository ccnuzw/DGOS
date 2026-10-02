import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from '../apps/api/node_modules/pg/lib/index.js';
import { createClient } from '../apps/api/node_modules/redis/dist/index.js';
import { discoverMigrations, buildMigrationSql } from './migrate.mjs';
import { sourceIdentity } from './verify-release.mjs';
import { createOpenAiCompatibleFixture } from '../test-support/openai-compatible-fixture.mjs';

const profilePath = resolve('.herdr/v1-performance-profile-r6.json');
const maxPort = (value, name) => { const port = Number(value); if (!Number.isInteger(port) || port < 15111 || port > 15119) throw new Error(`${name}_outside_perf_ports`); return port; };
const sha = (value) => createHash('sha256').update(value).digest('hex');
const frozenSetSha = '0cb6df60c0bbd5527bc6c8f1314be67fed7dbe6de7f1de30bb8681771af2744d';
const frozenRecent = new Map([
  ['0045-network-route-activation', 'c2bc2a47a3360e47b02d4edd9880b88694ec3ab84cdf7613674cd2099d40040d'],
  ['0046-package-retention', '7321916de0ddff31f40d48b837acada75d8ec893691c7c65f22d0b707d6a9a83'],
  ['0047-ai-task-parameters', '22b6e9e886943f2b660de4d54989e0587c58cb67e373fbd45b7140849f6f15f6'],
  ['0048-network-route-fingerprint', '7879e6cf17753fa82254675756fbeb1fdfb9ad67e11808aec8922cd2f10cd33d'],
  ['0049-extension-management', 'ba0bc80a0ccc74e05a5244b50e52e6a26df39ad854995ba038020b7d5d954f1b'],
  ['0050-session-management', '8802fe3a02b0bf7364aeac96215da09454d0c53b48c06d2cb76c6f3d6b455d85'],
  ['0051-proxy-provisioning', '778fddef654d67bc3ecfc01e11fd91f826f91d68a5b6c5c72568b5e35cca1939'],
]);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const nowMs = () => Number(process.hrtime.bigint()) / 1e6;
let smokeDeadline = Infinity;
const quantile = (sorted, q) => sorted.length ? Number(sorted[Math.ceil(sorted.length * q) - 1].toFixed(2)) : null;
export function distribution(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return { count: sorted.length, p50_ms: quantile(sorted, 0.5), p95_ms: quantile(sorted, 0.95), p99_ms: quantile(sorted, 0.99), max_ms: sorted.length ? Number(sorted.at(-1).toFixed(2)) : null };
}
export function validateProfile(profile) {
  assert.equal(profile.status, 'engineering_proposal_unapproved');
  assert.equal(profile.approval, null);
  assert.ok(Number.isInteger(profile.max_duration_seconds) && profile.max_duration_seconds <= 60);
  assert.ok(Number.isInteger(profile.max_concurrency) && profile.max_concurrency <= 8);
  assert.ok(Number.isInteger(profile.max_submissions) && profile.max_submissions <= 16);
  assert.ok(profile.stages.length === 4 && profile.stages.reduce((sum, stage) => sum + stage.duration_ms, 0) <= 15_000);
  assert.deepEqual(profile.stages.map((stage) => stage.name), ['ramp', 'short_steady', 'bounded_overload_probe', 'recovery']);
  assert.ok(Number.isInteger(profile.request_timeout_ms) && profile.request_timeout_ms >= 500 && profile.request_timeout_ms <= 5000);
  assert.ok(Number.isInteger(profile.terminal_timeout_ms) && profile.terminal_timeout_ms > 0 && profile.terminal_timeout_ms <= 15000);
  assert.ok(Number.isInteger(profile.sample_interval_ms) && profile.sample_interval_ms >= 500 && profile.sample_interval_ms <= 2000);
  for (const stage of profile.stages) assert.ok(stage.duration_ms > 0 && stage.concurrency > 0 && stage.concurrency <= profile.max_concurrency);
  assert.deepEqual(Object.values(profile.mix).reduce((sum, n) => sum + n, 0), 10);
  return profile;
}
export function validateEnvironment(env = process.env) {
  if (env.DGOS_PERF_STARTUP_READY !== '1') throw new Error('perf_startup_ready_receipt_required');
  const admin = new URL(env.DGOS_PERF_ADMIN_URL ?? '');
  if (!['127.0.0.1', 'localhost'].includes(admin.hostname) || admin.port !== '5432' || admin.pathname !== '/postgres' || admin.username !== 'dgos' || admin.search || admin.hash) throw new Error('perf_admin_must_be_local_postgres_maintenance_db');
  const redis = new URL(env.DGOS_PERF_REDIS_URL ?? '');
  if (redis.protocol !== 'redis:' || !['127.0.0.1', 'localhost'].includes(redis.hostname) || redis.port !== '6379' || redis.pathname !== '/8' || redis.search || redis.hash) throw new Error('perf_redis_must_be_local_db8');
  const apiPort = maxPort(env.DGOS_PERF_API_PORT ?? 15111, 'api');
  const fixturePort = maxPort(env.DGOS_PERF_FIXTURE_PORT ?? 15112, 'fixture');
  if (apiPort === fixturePort) throw new Error('perf_ports_overlap');
  return { admin, redis, apiPort, fixturePort };
}
export function selectedMigrations(items) {
  const unexpected = items.find((item) => Number(item.version.slice(0, 4)) >= 45 && !frozenRecent.has(item.version));
  if (unexpected) throw new Error(`unfrozen_migration_discovered:${unexpected.version}`);
  const selected = items.filter((item) => Number(item.version.slice(0, 4)) < 45 || frozenRecent.has(item.version));
  if (selected.length !== 47) throw new Error(`frozen_migration_count_mismatch:${selected.length}`);
  for (const [version, checksum] of frozenRecent) {
    if (selected.find((item) => item.version === version)?.checksum !== checksum) throw new Error(`frozen_checksum_mismatch:${version}`);
  }
  const actualSetSha = sha(JSON.stringify(selected.map(({ version, checksum }) => [version, checksum])));
  if (actualSetSha !== frozenSetSha) throw new Error('frozen_migration_set_mismatch');
  return { selected, actualSetSha };
}
const child = (file, env, log) => {
  const spawned = spawn(process.execPath, ['--input-type=module', '--eval', file], { cwd: resolve('.'), env, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [spawned.stdout, spawned.stderr]) stream.on('data', (bytes) => { log.push(bytes.toString('utf8').slice(0, 2000)); if (log.length > 100) log.shift(); });
  return spawned;
};
const apiBootstrap = `
import { buildServer } from './apps/api/src/server.mjs';
import { createClient } from './apps/api/node_modules/redis/dist/index.js';
import { RedisSecretService } from './src/security/secret-service.mjs';
import { createRateLimiter, createLoginBackoff } from './src/security/rate-limiter.mjs';
import { createRuntimeEgress } from './src/security/runtime-egress.mjs';
const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();
const namespace = process.env.DGOS_PERF_NAMESPACE;
const app = buildServer({ closeDatabasePools: true, secretService: new RedisSecretService(redis, { namespace }), rateLimiter: createRateLimiter({ redis, namespace }), loginBackoff: createLoginBackoff({ redis, namespace }), providerEgress: createRuntimeEgress() });
app.addHook('onClose', async () => { await redis.quit(); });
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => app.close().catch(() => { process.exitCode = 1; }));
await app.listen({ host: '127.0.0.1', port: Number(process.env.PORT) });
`;
const workerBootstrap = `
import { startWorkerProcess } from './apps/worker/src/worker.mjs';
import { createClient } from './apps/worker/node_modules/redis/dist/index.js';
import { RedisSecretService } from './src/security/secret-service.mjs';
const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();
const runtime = await startWorkerProcess({ secretService: new RedisSecretService(redis, { namespace: process.env.DGOS_PERF_NAMESPACE }) });
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => runtime.stop().then(() => redis.quit(), () => { process.exitCode = 1; }));
`;
const stopChild = async (process) => {
  if (!process || process.exitCode !== null || process.signalCode !== null) return;
  process.kill('SIGTERM');
  await Promise.race([new Promise((done) => process.once('exit', done)), sleep(3000)]);
  if (process.exitCode === null && process.signalCode === null) process.kill('SIGKILL');
};
const waitReady = async (url, process, deadline) => {
  while (Date.now() < deadline) {
    if (process.exitCode !== null) throw new Error(`service_exited:${process.exitCode}`);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(700) })).status === 200) return; } catch { /* bounded readiness retry */ }
    await sleep(200);
  }
  throw new Error('service_ready_timeout');
};
const call = async (base, path, session, { method = 'GET', body, expected = 200, timeoutMs = 5000 } = {}) => {
  const response = await fetch(`${base}/api/v1${path}`, { method, signal: AbortSignal.timeout(Math.max(1, Math.min(timeoutMs, smokeDeadline - Date.now()))), headers: { ...(session ? { authorization: `Bearer ${session}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  if (response.status !== expected) throw new Error(`http_${response.status}_${path}`);
  return text ? JSON.parse(text) : null;
};
const rssKb = (pid) => {
  if (!pid) return null;
  try { return Number(execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8', timeout: 1000 }).trim()) || null; } catch { return null; }
};
const cleanupRedisNamespace = async (url, namespace) => {
  const client = createClient({ url: url.toString() });
  await client.connect();
  let removed = 0;
  try {
    for await (const keys of client.scanIterator({ MATCH: `${namespace}:*`, COUNT: 100 })) {
      const batch = Array.isArray(keys) ? keys : [keys];
      if (batch.length) removed += await client.unlink(batch);
    }
    return removed;
  } finally { await client.quit(); }
};

async function main() {
  const profileBytes = await readFile(profilePath);
  const profile = validateProfile(JSON.parse(profileBytes));
  const config = validateEnvironment();
  const migrations = selectedMigrations(await discoverMigrations());
  const name = `dgos_v1_perf_${randomBytes(6).toString('hex')}`;
  const runId = `V1-PERFORMANCE-r6-${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
  const report = { run_id: runId, environment: 'local-isolated-smoke', scope: 'bounded calibration only', command: 'DGOS_PERF_STARTUP_READY=1 DGOS_PERF_ADMIN_URL=<redacted> DGOS_PERF_REDIS_URL=redis://127.0.0.1:6379/8 node scripts/v1-performance.mjs', working_directory: process.cwd(), profile_sha256: sha(profileBytes), migration_set_sha256: migrations.actualSetSha, database: name, redis_db: 8, redis_namespace: `v1-perf:${name}`, ports: { api: config.apiPort, fixture: config.fixturePort }, stages: [], samples: [], invariants: null, generator: {}, limitations: ['Engineering proposal is unapproved.', 'Local fixture is not paid Provider, production TLS, staging steady load, or release acceptance.', 'Dirty working tree is not a frozen build.'], sanitization: 'Credentials, tokens, request/response bodies and process logs omitted.', started_at: new Date().toISOString() };
  const admin = new pg.Pool({ connectionString: config.admin.toString(), connectionTimeoutMillis: 2500, query_timeout: 15000 });
  const databaseUrl = new URL(config.admin); databaseUrl.pathname = `/${name}`;
  let pool; let fixture; let api; let worker; let created = false; let session; let ownerId; let configId; let sampling; let aborted = false; let temporaryRoot;
  const taskIds = []; const taskAcceptedAt = new Map(); const logs = { api: [], worker: [] };
  const base = `http://127.0.0.1:${config.apiPort}`;
  const credential = randomBytes(24).toString('hex');
  const overallDeadline = Date.now() + profile.max_duration_seconds * 1000;
  smokeDeadline = overallDeadline;
  const get = (path, options) => call(base, path, session, options);
  const taskBody = () => ({ requestId: randomUUID(), target: 'text', intent: 'text.chat', input: { text: `perf ${runId}` }, options: { providerConfigId: configId, modelId: 'fixture-text-model' } });
  try {
    report.source_before = await sourceIdentity();
    assert.equal((await admin.query('SELECT current_database() AS name')).rows[0].name, 'postgres');
    temporaryRoot = await mkdtemp(join(tmpdir(), 'dgos-v1-perf-'));
    await admin.query(`CREATE DATABASE ${name}`); created = true;
    pool = new pg.Pool({ connectionString: databaseUrl.toString(), connectionTimeoutMillis: 2500, query_timeout: 15000 });
    assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name, name);
    await pool.query(buildMigrationSql(migrations.selected));
    const applied = await pool.query('SELECT version,checksum FROM dgos_schema_migrations');
    for (const item of migrations.selected) assert.ok(applied.rows.some((row) => row.version === item.version && row.checksum === item.checksum), `migration_missing:${item.version}`);
    report.migrations = migrations.selected.map(({ version, checksum }) => ({ version, checksum }));
    fixture = createOpenAiCompatibleFixture({ port: config.fixturePort, host: '127.0.0.1' });
    await fixture.start();
    const env = { ...process.env, TMPDIR: temporaryRoot, DGOS_PACKAGE_ROOT: join(temporaryRoot, 'packages'), DGOS_DATABASE_URL: databaseUrl.toString(), REDIS_URL: config.redis.toString(), DGOS_PERF_NAMESPACE: report.redis_namespace, NODE_ENV: 'test', DGOS_ALLOW_INSECURE_FIXTURE: '1', DGOS_FIXTURE_BASE_URL: `http://127.0.0.1:${config.fixturePort}`, DGOS_AI_TASK_POLL_MS: '100', DGOS_AI_TASK_IDLE_BACKOFF_MS: '100' };
    delete env.DGOS_EXTENSION_CONFIG_FILE;
    api = child(apiBootstrap, { ...env, HOST: '127.0.0.1', PORT: String(config.apiPort) }, logs.api);
    await waitReady(`${base}/ready`, api, overallDeadline);
    worker = child(workerBootstrap, env, logs.worker);
    await sleep(400);
    if (worker.exitCode !== null) throw new Error(`worker_exited:${worker.exitCode}`);
    const receipt = await get('/identity/admin/bootstrap', { method: 'POST', body: { displayName: runId, credential }, expected: 201 });
    session = receipt.sessionId; ownerId = receipt.principalId;
    const account = await get('/provider/accounts', { method: 'POST', body: { requestId: randomUUID(), protocolType: 'openai-compatible', displayName: runId, credential: 'dgos-fixture-token', scope: { endpoint: 'https://fixture.test/v1' } }, expected: 201 });
    const probe = await get('/provider/connection-tests', { method: 'POST', body: { requestId: randomUUID(), accountId: account.accountId, accountVersion: account.version, protocolVersion: 'v1' }, expected: 202 });
    let probeState;
    while (Date.now() < overallDeadline) { probeState = await get(`/provider/connection-tests/${probe.testId}`); if (['succeeded', 'failed'].includes(probeState.status)) break; await sleep(150); }
    assert.equal(probeState?.status, 'succeeded', 'provider_probe_not_ready');
    await get(`/provider/accounts/${account.accountId}/state`, { method: 'POST', body: { requestId: randomUUID(), baseVersion: account.version, connectionTestId: probe.testId, state: 'ready' } });
    const configReceipt = await get('/provider/configs', { method: 'POST', body: { requestId: randomUUID(), providerAccountId: account.accountId, protocolType: 'openai-compatible', displayName: runId, baseUrl: 'https://fixture.test/v1' }, expected: 201 });
    configId = configReceipt.providerConfigId ?? configReceipt.id;
    await get(`/provider/configs/${configId}/validate`, { method: 'POST', body: { requestId: randomUUID() } });
    const catalog = await get(`/provider/configs/${configId}/models`, { method: 'POST', body: { requestId: randomUUID() } });
    assert.ok(catalog.items.some((item) => item.modelId === 'fixture-text-model'));
    await get(`/provider/configs/${configId}/model-policies`, { method: 'POST', body: { requestId: randomUUID(), modelId: 'fixture-text-model', enabled: true, assignedCapabilities: ['text'], defaultFor: [], baseVersion: '0' } });
    await get('/quota/policies', { method: 'PUT', body: { requestId: randomUUID(), metric: 'requests', scopeType: 'subject', scopeId: ownerId, hardLimit: profile.max_submissions + 4, softLimit: profile.max_submissions + 2, windowSeconds: 3600, effectiveAt: new Date().toISOString() } });
    const from = new Date(Date.now() - 3600_000).toISOString();
    const to = new Date(Date.now() + 3600_000).toISOString();
    let active = 0; let maxActive = 0; let turn = 0; let submitAttempts = 0; let generatorLateMs = 0; let sampleFailure = 0;
    sampling = setInterval(async () => {
      try {
        const stat = await pool.query("SELECT (SELECT count(*)::int FROM ai_task_attempts WHERE state IN ('queued','running')) AS queue_depth, (SELECT count(*)::int FROM pg_stat_activity WHERE datname=current_database()) AS pg_connections, (SELECT xact_commit FROM pg_stat_database WHERE datname=current_database()) AS pg_commits");
        report.samples.push({ at: new Date().toISOString(), ...stat.rows[0], api_rss_kb: rssKb(api.pid), worker_rss_kb: rssKb(worker.pid), generator_rss_kb: Math.round(process.memoryUsage().rss / 1024), active });
      } catch { sampleFailure += 1; }
    }, profile.sample_interval_ms);
    const operations = ['system_settings_read', 'usage_query', 'task_submit'];
    for (const [stageIndex, stage] of profile.stages.entries()) {
      const stageStart = nowMs(); const end = stageStart + stage.duration_ms; const events = [];
      const stageSubmitLimit = Math.floor(profile.max_submissions * (stageIndex + 1) / profile.stages.length);
      const loop = async () => {
        while (nowMs() < end && Date.now() < overallDeadline && !aborted) {
          const n = turn++ % 10; const operation = n < 7 ? operations[0] : n < 9 ? operations[1] : operations[2];
          if (operation === 'task_submit' && submitAttempts >= stageSubmitLimit) { await sleep(10); continue; }
          if (operation === 'task_submit') submitAttempts += 1;
          const start = nowMs(); active += 1; maxActive = Math.max(maxActive, active);
          try {
            let value;
            if (operation === 'system_settings_read') { value = await get('/system/settings', { timeoutMs: profile.request_timeout_ms }); assert.ok(value.settingsVersion); }
            else if (operation === 'usage_query') { value = await get(`/usage?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { timeoutMs: profile.request_timeout_ms }); assert.ok(value && typeof value === 'object'); }
            else value = await get('/ai-tasks', { method: 'POST', body: taskBody(), expected: 202, timeoutMs: profile.request_timeout_ms });
            if (operation === 'task_submit') { assert.ok(value.taskId); taskIds.push(value.taskId); taskAcceptedAt.set(value.taskId, Date.now()); }
            events.push({ operation, classification: 'success', latency_ms: nowMs() - start });
          } catch (error) {
            const status = /^http_(\d{3})_/.exec(error.message)?.[1];
            const classification = status === '429' ? 'expected_capacity_rejection' : status ? (Number(status) >= 500 ? 'unexpected_5xx' : 'unexpected_4xx') : 'transport_or_timeout';
            events.push({ operation, classification, latency_ms: nowMs() - start });
          } finally { active -= 1; }
          await sleep(10);
        }
      };
      const workers = Array.from({ length: stage.concurrency }, () => loop());
      await Promise.all(workers);
      generatorLateMs += Math.max(0, nowMs() - end);
      const elapsed = nowMs() - stageStart;
      const summary = Object.fromEntries(operations.map((operation) => [operation, distribution(events.filter((event) => event.operation === operation && event.classification === 'success').map((event) => event.latency_ms))]));
      report.stages.push({ name: stage.name, target_concurrency: stage.concurrency, duration_ms: Number(elapsed.toFixed(1)), requests: events.length, throughput_rps: Number((events.length * 1000 / elapsed).toFixed(2)), classification: Object.fromEntries([...new Set(events.map((event) => event.classification))].map((key) => [key, events.filter((event) => event.classification === key).length])), latency: summary });
    }
    clearInterval(sampling); sampling = null;
    const terminalDeadline = Math.min(overallDeadline, Date.now() + profile.terminal_timeout_ms);
    let tasks;
    do {
      tasks = await pool.query("SELECT task_id,state FROM ai_tasks WHERE owner_id=$1", [ownerId]);
      if (tasks.rows.every((task) => ['succeeded','failed','cancelled','timed_out'].includes(task.state))) break;
      await sleep(200);
    } while (Date.now() < terminalDeadline);
    const facts = await pool.query(`SELECT t.task_id,t.state, (SELECT count(*)::int FROM ai_task_attempts WHERE task_id=t.task_id) AS attempts, (SELECT count(*)::int FROM quota_reservations WHERE task_id=t.task_id AND state='settled') AS settled, (SELECT count(*)::int FROM usage_events WHERE task_id=t.task_id) AS usage, (SELECT count(*)::int FROM artifacts WHERE task_id=t.task_id) AS artifacts, (SELECT count(*)::int FROM ai_task_events WHERE task_id=t.task_id AND event_type IN ('task.completed','task.failed','task.cancelled')) AS terminal_events, (SELECT count(*)::int FROM audit_events e JOIN audit_outbox o ON o.event_id=e.event_id WHERE e.target_type='ai_task' AND e.target_id=t.task_id::text AND e.action='ai.task.submit') AS submit_outbox, (SELECT max(completed_at) FROM ai_task_attempts WHERE task_id=t.task_id) AS completed_at FROM ai_tasks t WHERE owner_id=$1`, [ownerId]);
    const anomalies = facts.rows.filter((row) => row.state !== 'succeeded' || row.attempts !== 1 || row.settled !== 1 || row.usage !== 1 || row.artifacts !== 1 || row.terminal_events !== 1 || row.submit_outbox !== 1).map((row) => ({ task_id: row.task_id, state: row.state, attempts: row.attempts, settled: row.settled, usage: row.usage, artifacts: row.artifacts, terminal_events: row.terminal_events, submit_outbox: row.submit_outbox }));
    const fixtureCalls = fixture.requests.filter((item) => item.path === '/v1/chat/completions').length;
    const duplicateUsage = await pool.query('SELECT count(*)::int AS n FROM (SELECT task_id,attempt_id,metric FROM usage_events WHERE subject_id=$1 GROUP BY task_id,attempt_id,metric HAVING count(*)>1) d', [ownerId]);
    const negativeUsage = await pool.query('SELECT count(*)::int AS n FROM usage_events WHERE subject_id=$1 AND amount<0', [ownerId]);
    report.invariants = { submitted: taskIds.length, terminal: tasks.rows.filter((task) => ['succeeded','failed','cancelled','timed_out'].includes(task.state)).length, upstream_calls: fixtureCalls, anomalies, duplicate_usage: duplicateUsage.rows[0].n, negative_usage: negativeUsage.rows[0].n, no_duplicate_upstream: fixtureCalls === taskIds.length, terminal_latency: distribution(facts.rows.filter((row) => row.completed_at && taskAcceptedAt.has(row.task_id)).map((row) => row.completed_at.getTime() - taskAcceptedAt.get(row.task_id))) };
    report.generator = { max_active: maxActive, submit_attempts: submitAttempts, stage_overshoot_ms: Number(generatorLateMs.toFixed(1)), sample_failures: sampleFailure, samples: report.samples.length, saturated: sampleFailure > 0 || generatorLateMs > 1000 || maxActive < 2 };
    if (!taskIds.length || anomalies.length || duplicateUsage.rows[0].n || negativeUsage.rows[0].n || fixtureCalls !== taskIds.length || sampleFailure || report.generator.saturated || report.stages.some((stage) => Object.keys(stage.classification).some((key) => key !== 'success'))) throw new Error('perf_smoke_consistency_or_generator_failure');
    report.exit_code = 0;
  } catch (error) {
    report.exit_code = 1; report.failure = error.message; process.exitCode = 1;
    if (!session && logs.api.length) console.error(`api_startup_diagnostic: ${logs.api.join('').slice(-1500).replaceAll(/postgres(?:ql)?:\/\/[^\s]+/g, '<database-url>').replaceAll(/redis:\/\/[^\s]+/g, '<redis-url>')}`);
  } finally {
    aborted = true; if (sampling) clearInterval(sampling);
    await stopChild(worker); await stopChild(api); await fixture?.close().catch(() => {});
    if (pool) await pool.end().catch(() => {});
    if (created) { try { await admin.query(`DROP DATABASE ${name} WITH (FORCE)`); report.cleanup = `dropped ${name}`; } catch (error) { report.cleanup = `manual_cleanup_required:${name}:${error.message}`; report.exit_code = 1; process.exitCode = 1; } }
    await admin.end().catch(() => {});
    if (created) { try { report.redis_keys_removed = await cleanupRedisNamespace(config.redis, report.redis_namespace); } catch (error) { report.redis_cleanup = `manual_cleanup_required:${report.redis_namespace}:${error.message}`; report.exit_code = 1; process.exitCode = 1; } }
    if (temporaryRoot) { await rm(temporaryRoot, { recursive: true, force: true }); report.temporary_root_cleanup = 'removed'; }
    report.source_after = await sourceIdentity();
    report.profile_sha256_after = sha(await readFile(profilePath));
    report.source_drift = report.source_before?.working_tree_sha256 !== report.source_after?.working_tree_sha256 || report.source_before?.head_commit !== report.source_after?.head_commit || report.profile_sha256 !== report.profile_sha256_after;
    if (report.source_drift) { report.exit_code = 1; process.exitCode = 1; report.failure ??= 'source_or_profile_drift'; }
    report.commit = report.source_before?.commit ?? null; report.head_commit = report.source_before?.head_commit ?? null;
    report.finished_at = new Date().toISOString();
    report.logs = { api_lines: logs.api.length, worker_lines: logs.worker.length, bodies_and_secrets_omitted: true };
    report.code_version = report.commit ?? (report.head_commit ? `${report.head_commit}+working-tree:${report.source_before?.working_tree_sha256}` : 'unbound');
    report.test_report = `.herdr/${runId}.md`;
    report.asset_sha256 = { 'scripts/v1-performance.mjs': sha(await readFile('scripts/v1-performance.mjs')), '.herdr/v1-performance-profile-r6.json': report.profile_sha256 };
    report.stats = { expected: 4, passed: report.stages.length, failed: report.exit_code ? 1 : 0, skipped: Math.max(0, 4 - report.stages.length), unexpected: report.exit_code ? 1 : 0, flaky: 0 };
    report.prior_attempts = [];
    await writeFile(`.herdr/${runId}-manifest.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    await writeFile(report.test_report, `# ${runId}\n\nLocal isolated smoke; exit ${report.exit_code}; source drift ${report.source_drift}; profile SHA-256 ${report.profile_sha256}.\n\n${report.stages.map((stage) => `- ${stage.name}: ${stage.requests} requests, ${stage.throughput_rps} rps, ${JSON.stringify(stage.classification)}`).join('\n')}\n\nInvariants: ${report.invariants ? JSON.stringify(report.invariants) : 'not reached'}\n\nFailure: ${report.failure ?? 'none'}\n\nCleanup: ${report.cleanup ?? 'database not created'}; Redis keys removed ${report.redis_keys_removed ?? 'unknown'}.\n\nLimitations: ${report.limitations.join(' ')}\n\n[Manifest](${runId}-manifest.json)\n`, { flag: 'wx' });
    console.log(JSON.stringify({ run_id: runId, exit_code: report.exit_code, stages: report.stages.length, failure: report.failure ?? null, cleanup: report.cleanup, source_drift: report.source_drift, manifest: `.herdr/${runId}-manifest.json` }));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
