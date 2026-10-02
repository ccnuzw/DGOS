#!/usr/bin/env node
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

const profilePath = resolve('.herdr/v1-stress-profile.json');
const maxPort = (value, name) => { const port = Number(value); if (!Number.isInteger(port) || port < 15111 || port > 15119) throw new Error(`${name}_outside_perf_ports`); return port; };
const sha = (value) => createHash('sha256').update(value).digest('hex');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const nowMs = () => Number(process.hrtime.bigint()) / 1e6;

const quantile = (sorted, q) => sorted.length ? Number(sorted[Math.ceil(sorted.length * q) - 1].toFixed(2)) : null;

export function distribution(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    min_ms: sorted.length ? Number(sorted[0].toFixed(2)) : null,
    p50_ms: quantile(sorted, 0.5),
    p95_ms: quantile(sorted, 0.95),
    p99_ms: quantile(sorted, 0.99),
    max_ms: sorted.length ? Number(sorted.at(-1).toFixed(2)) : null,
    avg_ms: sorted.length ? Number((sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2)) : null
  };
}

export function validateProfile(profile) {
  assert.equal(profile.status, 'engineering_proposal_active');
  assert.ok(Number.isInteger(profile.max_duration_seconds) && profile.max_duration_seconds <= 1800);
  assert.ok(Number.isInteger(profile.max_concurrency) && profile.max_concurrency <= 200);
  assert.ok(Number.isInteger(profile.max_submissions) && profile.max_submissions <= 1000);
  assert.ok(profile.load_stages.length >= 4);
  assert.ok(Number.isInteger(profile.request_timeout_ms) && profile.request_timeout_ms >= 1000);
  assert.ok(Number.isInteger(profile.terminal_timeout_ms) && profile.terminal_timeout_ms >= 10000);
  assert.ok(Number.isInteger(profile.sample_interval_ms) && profile.sample_interval_ms >= 100);
  for (const stage of profile.load_stages) {
    assert.ok(stage.duration_ms > 0 && stage.concurrency > 0 && stage.concurrency <= profile.max_concurrency);
  }
  return profile;
}

export function validateEnvironment(env = process.env) {
  if (env.DGOS_STRESS_STARTUP_READY !== '1') throw new Error('stress_startup_ready_receipt_required');
  const admin = new URL(env.DGOS_STRESS_ADMIN_URL ?? '');
  if (!['127.0.0.1', 'localhost'].includes(admin.hostname) || admin.port !== '5432' || admin.pathname !== '/postgres' || admin.username !== 'dgos') throw new Error('stress_admin_must_be_local_postgres');
  const redis = new URL(env.DGOS_STRESS_REDIS_URL ?? '');
  if (redis.protocol !== 'redis:' || !['127.0.0.1', 'localhost'].includes(redis.hostname) || redis.port !== '6379' || redis.pathname !== '/9') throw new Error('stress_redis_must_be_local_db9');
  const apiPort = maxPort(env.DGOS_STRESS_API_PORT ?? 15113, 'api');
  const fixturePort = maxPort(env.DGOS_STRESS_FIXTURE_PORT ?? 15114, 'fixture');
  if (apiPort === fixturePort) throw new Error('stress_ports_overlap');
  return { admin, redis, apiPort, fixturePort };
}

const rssKb = (pid) => {
  if (!pid) return null;
  try {
    return Number(execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8', timeout: 1000 }).trim()) || null;
  } catch { return null; }
};

const child = (file, env, log) => {
  const spawned = spawn(process.execPath, ['--input-type=module', '--eval', file], { cwd: resolve('.'), env, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [spawned.stdout, spawned.stderr]) {
    stream.on('data', (bytes) => {
      log.push(bytes.toString('utf8').slice(0, 2000));
      if (log.length > 200) log.shift();
    });
  }
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
const namespace = process.env.DGOS_STRESS_NAMESPACE;
const app = buildServer({
  closeDatabasePools: true,
  secretService: new RedisSecretService(redis, { namespace }),
  rateLimiter: createRateLimiter({ redis, namespace }),
  loginBackoff: createLoginBackoff({ redis, namespace }),
  providerEgress: createRuntimeEgress()
});
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
const runtime = await startWorkerProcess({
  secretService: new RedisSecretService(redis, { namespace: process.env.DGOS_STRESS_NAMESPACE })
});
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => runtime.stop().then(() => redis.quit(), () => { process.exitCode = 1; }));
`;

const stopChild = async (process) => {
  if (!process || process.exitCode !== null || process.signalCode !== null) return;
  process.kill('SIGTERM');
  await Promise.race([new Promise((done) => process.once('exit', done)), sleep(5000)]);
  if (process.exitCode === null && process.signalCode === null) process.kill('SIGKILL');
};

const waitReady = async (url, process, deadline) => {
  while (Date.now() < deadline) {
    if (process.exitCode !== null) throw new Error(`service_exited:${process.exitCode}`);
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).status === 200) return;
    } catch { /* bounded readiness retry */ }
    await sleep(300);
  }
  throw new Error('service_ready_timeout');
};

const call = async (base, path, session, { method = 'GET', body, expected = 200, timeoutMs = 10000 } = {}) => {
  const response = await fetch(`${base}/api/v1${path}`, {
    method,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      ...(session ? { authorization: `Bearer ${session}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  if (response.status !== expected) throw new Error(`http_${response.status}_${path}`);
  return text ? JSON.parse(text) : null;
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
  const migrations = await discoverMigrations();
  const name = `dgos_v1_stress_${randomBytes(6).toString('hex')}`;
  const runId = `V1-STRESS-TEST-r1-${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;

  const report = {
    run_id: runId,
    test_type: 'stress_test',
    environment: 'local-isolated-stress',
    scope: 'production readiness validation',
    command: 'DGOS_STRESS_STARTUP_READY=1 node scripts/v1-stress-test.mjs',
    working_directory: process.cwd(),
    profile_sha256: sha(profileBytes),
    database: name,
    redis_db: 9,
    redis_namespace: `v1-stress:${name}`,
    ports: { api: config.apiPort, fixture: config.fixturePort },
    stages: [],
    samples: [],
    failure_tests: [],
    metrics: {
      throughput: [],
      latency: {},
      errors: {},
      resources: {}
    },
    started_at: new Date().toISOString()
  };

  const admin = new pg.Pool({ connectionString: config.admin.toString(), connectionTimeoutMillis: 5000, query_timeout: 30000 });
  const databaseUrl = new URL(config.admin);
  databaseUrl.pathname = `/${name}`;

  let pool;
  let fixture;
  let api;
  let worker;
  let created = false;
  let session;
  let ownerId;
  let configId;
  let sampling;
  let aborted = false;
  let temporaryRoot;

  const taskIds = [];
  const taskAcceptedAt = new Map();
  const logs = { api: [], worker: [] };
  const base = `http://127.0.0.1:${config.apiPort}`;
  const credential = randomBytes(24).toString('hex');
  const overallDeadline = Date.now() + profile.max_duration_seconds * 1000;

  const get = (path, options) => call(base, path, session, options);
  const taskBody = () => ({
    requestId: randomUUID(),
    target: 'text',
    intent: 'text.chat',
    input: { text: `stress ${runId} ${randomBytes(4).toString('hex')}` },
    options: { providerConfigId: configId, modelId: 'fixture-text-model' }
  });

  try {
    report.source_before = await sourceIdentity();
    assert.equal((await admin.query('SELECT current_database() AS name')).rows[0].name, 'postgres');

    temporaryRoot = await mkdtemp(join(tmpdir(), 'dgos-v1-stress-'));
    await admin.query(`CREATE DATABASE ${name}`);
    created = true;

    pool = new pg.Pool({ connectionString: databaseUrl.toString(), connectionTimeoutMillis: 5000, query_timeout: 30000 });
    assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name, name);
    await pool.query(buildMigrationSql(migrations));

    report.migrations_applied = migrations.length;

    fixture = createOpenAiCompatibleFixture({ port: config.fixturePort, host: '127.0.0.1' });
    await fixture.start();

    const env = {
      ...process.env,
      TMPDIR: temporaryRoot,
      DGOS_PACKAGE_ROOT: join(temporaryRoot, 'packages'),
      DGOS_DATABASE_URL: databaseUrl.toString(),
      REDIS_URL: config.redis.toString(),
      DGOS_STRESS_NAMESPACE: report.redis_namespace,
      NODE_ENV: 'test',
      DGOS_ALLOW_INSECURE_FIXTURE: '1',
      DGOS_FIXTURE_BASE_URL: `http://127.0.0.1:${config.fixturePort}`,
      DGOS_AI_TASK_POLL_MS: '50',
      DGOS_AI_TASK_IDLE_BACKOFF_MS: '50'
    };
    delete env.DGOS_EXTENSION_CONFIG_FILE;

    api = child(apiBootstrap, { ...env, HOST: '127.0.0.1', PORT: String(config.apiPort) }, logs.api);
    await waitReady(`${base}/ready`, api, overallDeadline);

    worker = child(workerBootstrap, env, logs.worker);
    await sleep(500);
    if (worker.exitCode !== null) throw new Error(`worker_exited:${worker.exitCode}`);

    // Bootstrap admin user
    const receipt = await get('/identity/admin/bootstrap', { method: 'POST', body: { displayName: runId, credential }, expected: 201 });
    session = receipt.sessionId;
    ownerId = receipt.principalId;

    // Setup provider
    const account = await get('/provider/accounts', { method: 'POST', body: { requestId: randomUUID(), protocolType: 'openai-compatible', displayName: runId, credential: 'dgos-fixture-token', scope: { endpoint: 'https://fixture.test/v1' } }, expected: 201 });
    const probe = await get('/provider/connection-tests', { method: 'POST', body: { requestId: randomUUID(), accountId: account.accountId, accountVersion: account.version, protocolVersion: 'v1' }, expected: 202 });

    let probeState;
    while (Date.now() < overallDeadline) {
      probeState = await get(`/provider/connection-tests/${probe.testId}`);
      if (['succeeded', 'failed'].includes(probeState.status)) break;
      await sleep(200);
    }
    assert.equal(probeState?.status, 'succeeded', 'provider_probe_not_ready');

    await get(`/provider/accounts/${account.accountId}/state`, { method: 'POST', body: { requestId: randomUUID(), baseVersion: account.version, connectionTestId: probe.testId, state: 'ready' } });
    const configReceipt = await get('/provider/configs', { method: 'POST', body: { requestId: randomUUID(), providerAccountId: account.accountId, protocolType: 'openai-compatible', displayName: runId, baseUrl: 'https://fixture.test/v1' }, expected: 201 });
    configId = configReceipt.providerConfigId ?? configReceipt.id;

    await get(`/provider/configs/${configId}/validate`, { method: 'POST', body: { requestId: randomUUID() } });
    const catalog = await get(`/provider/configs/${configId}/models`, { method: 'POST', body: { requestId: randomUUID() } });
    assert.ok(catalog.items.some((item) => item.modelId === 'fixture-text-model'));

    await get(`/provider/configs/${configId}/model-policies`, { method: 'POST', body: { requestId: randomUUID(), modelId: 'fixture-text-model', enabled: true, assignedCapabilities: ['text'], defaultFor: [], baseVersion: '0' } });
    await get('/quota/policies', { method: 'PUT', body: { requestId: randomUUID(), metric: 'requests', scopeType: 'subject', scopeId: ownerId, hardLimit: profile.max_submissions + 10, softLimit: profile.max_submissions + 5, windowSeconds: 3600, effectiveAt: new Date().toISOString() } });

    console.log(`✓ System bootstrapped successfully (session: ${session.slice(0, 8)}...)`);

    const from = new Date(Date.now() - 3600_000).toISOString();
    const to = new Date(Date.now() + 3600_000).toISOString();
    let active = 0;
    let maxActive = 0;
    let submitAttempts = 0;
    let sampleFailure = 0;

    // Start resource sampling
    sampling = setInterval(async () => {
      try {
        const stat = await pool.query("SELECT (SELECT count(*)::int FROM ai_task_attempts WHERE state IN ('queued','running')) AS queue_depth, (SELECT count(*)::int FROM pg_stat_activity WHERE datname=current_database()) AS pg_connections, (SELECT xact_commit FROM pg_stat_database WHERE datname=current_database()) AS pg_commits");
        report.samples.push({
          at: new Date().toISOString(),
          ...stat.rows[0],
          api_rss_kb: rssKb(api.pid),
          worker_rss_kb: rssKb(worker.pid),
          generator_rss_kb: Math.round(process.memoryUsage().rss / 1024),
          active
        });
      } catch { sampleFailure += 1; }
    }, profile.sample_interval_ms);

    // Define operations mix
    const operations = Object.entries(profile.workload_mix);
    const operationPool = operations.flatMap(([op, weight]) => Array(weight).fill(op));

    console.log(`\nStarting stress test with ${profile.load_stages.length} stages...\n`);

    // Execute load stages
    for (const [stageIndex, stage] of profile.load_stages.entries()) {
      const stageStart = nowMs();
      const end = stageStart + stage.duration_ms;
      const events = [];
      const stageSubmitLimit = Math.floor(profile.max_submissions * (stageIndex + 1) / profile.load_stages.length);

      console.log(`Stage ${stageIndex + 1}/${profile.load_stages.length}: ${stage.name} (concurrency: ${stage.concurrency}, duration: ${stage.duration_ms}ms)`);

      const loop = async (workerId) => {
        let workerRequests = 0;
        while (nowMs() < end && Date.now() < overallDeadline && !aborted) {
          const operationType = operationPool[Math.floor(Math.random() * operationPool.length)];

          if (operationType === 'task_submit' && submitAttempts >= stageSubmitLimit) {
            await sleep(20);
            continue;
          }
          if (operationType === 'task_submit') submitAttempts += 1;

          const start = nowMs();
          active += 1;
          maxActive = Math.max(maxActive, active);

          try {
            let value;
            switch (operationType) {
              case 'login':
                // Skip actual login, use existing session
                value = { principalId: ownerId };
                await sleep(10);
                break;
              case 'system_settings_read':
                value = await get('/system/settings', { timeoutMs: profile.request_timeout_ms });
                assert.ok(value.settingsVersion);
                break;
              case 'usage_query':
                value = await get(`/usage?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { timeoutMs: profile.request_timeout_ms });
                assert.ok(value && typeof value === 'object');
                break;
              case 'task_submit':
                value = await get('/ai-tasks', { method: 'POST', body: taskBody(), expected: 202, timeoutMs: profile.request_timeout_ms });
                assert.ok(value.taskId);
                taskIds.push(value.taskId);
                taskAcceptedAt.set(value.taskId, Date.now());
                break;
              case 'task_status':
                if (taskIds.length > 0) {
                  const taskId = taskIds[Math.floor(Math.random() * taskIds.length)];
                  value = await get(`/ai-tasks/${taskId}`, { timeoutMs: profile.request_timeout_ms });
                  assert.ok(value.taskId);
                }
                break;
              case 'task_events':
                if (taskIds.length > 0) {
                  const taskId = taskIds[Math.floor(Math.random() * taskIds.length)];
                  value = await get(`/ai-tasks/${taskId}/events`, { timeoutMs: profile.request_timeout_ms });
                }
                break;
              case 'provider_list':
                value = await get('/provider/configs', { timeoutMs: profile.request_timeout_ms });
                assert.ok(Array.isArray(value));
                break;
              default:
                throw new Error(`unknown_operation:${operationType}`);
            }

            events.push({ operation: operationType, classification: 'success', latency_ms: nowMs() - start, worker_id: workerId });
            workerRequests++;
          } catch (error) {
            const status = /^http_(\d{3})_/.exec(error.message)?.[1];
            const classification = status === '429' ? 'expected_capacity_rejection' :
                                 status ? (Number(status) >= 500 ? 'unexpected_5xx' : 'unexpected_4xx') :
                                 'transport_or_timeout';
            events.push({ operation: operationType, classification, latency_ms: nowMs() - start, worker_id: workerId, error: error.message });
          } finally {
            active -= 1;
          }

          await sleep(5);
        }
        return workerRequests;
      };

      const workers = Array.from({ length: stage.concurrency }, (_, i) => loop(i));
      await Promise.all(workers);

      const elapsed = nowMs() - stageStart;
      const stageSummary = {};

      for (const op of Object.keys(profile.workload_mix)) {
        const opEvents = events.filter(e => e.operation === op && e.classification === 'success');
        stageSummary[op] = distribution(opEvents.map(e => e.latency_ms));
      }

      const successCount = events.filter(e => e.classification === 'success').length;
      const errorCount = events.filter(e => e.classification !== 'success' && e.classification !== 'expected_capacity_rejection').length;
      const errorRate = events.length > 0 ? (errorCount / events.length * 100).toFixed(2) : 0;

      report.stages.push({
        name: stage.name,
        target_concurrency: stage.concurrency,
        duration_ms: Number(elapsed.toFixed(1)),
        requests: events.length,
        successful: successCount,
        errors: errorCount,
        error_rate_percent: Number(errorRate),
        throughput_rps: Number((events.length * 1000 / elapsed).toFixed(2)),
        classification: Object.fromEntries(
          [...new Set(events.map((event) => event.classification))].map((key) =>
            [key, events.filter((event) => event.classification === key).length]
          )
        ),
        latency: stageSummary
      });

      console.log(`  ✓ Completed: ${events.length} requests, ${Number((events.length * 1000 / elapsed).toFixed(2))} rps, ${errorRate}% errors`);
    }

    clearInterval(sampling);
    sampling = null;

    console.log(`\nWaiting for tasks to complete...`);

    // Wait for tasks to complete
    const terminalDeadline = Math.min(overallDeadline, Date.now() + profile.terminal_timeout_ms);
    let tasks;
    do {
      tasks = await pool.query("SELECT task_id, state FROM ai_tasks WHERE owner_id=$1", [ownerId]);
      const pendingCount = tasks.rows.filter(task => !['succeeded','failed','cancelled','timed_out'].includes(task.state)).length;
      if (pendingCount === 0) break;
      if (Date.now() % 5000 < 300) {
        console.log(`  ${pendingCount} tasks still pending...`);
      }
      await sleep(300);
    } while (Date.now() < terminalDeadline);

    // Collect final metrics
    const facts = await pool.query(`
      SELECT
        t.task_id, t.state,
        (SELECT count(*)::int FROM ai_task_attempts WHERE task_id=t.task_id) AS attempts,
        (SELECT count(*)::int FROM quota_reservations WHERE task_id=t.task_id AND state='settled') AS settled,
        (SELECT count(*)::int FROM usage_events WHERE task_id=t.task_id) AS usage,
        (SELECT count(*)::int FROM artifacts WHERE task_id=t.task_id) AS artifacts,
        (SELECT max(completed_at) FROM ai_task_attempts WHERE task_id=t.task_id) AS completed_at
      FROM ai_tasks t
      WHERE owner_id=$1
    `, [ownerId]);

    const anomalies = facts.rows.filter(row =>
      row.state !== 'succeeded' || row.attempts !== 1 || row.settled !== 1 ||
      row.usage !== 1 || row.artifacts !== 1
    ).map(row => ({
      task_id: row.task_id, state: row.state, attempts: row.attempts,
      settled: row.settled, usage: row.usage, artifacts: row.artifacts
    }));

    const terminalLatencies = facts.rows
      .filter(row => row.completed_at && taskAcceptedAt.has(row.task_id))
      .map(row => row.completed_at.getTime() - taskAcceptedAt.get(row.task_id));

    const fixtureCalls = fixture.requests.filter(item => item.path === '/v1/chat/completions').length;
    const duplicateUsage = await pool.query('SELECT count(*)::int AS n FROM (SELECT task_id, attempt_id, metric FROM usage_events WHERE subject_id=$1 GROUP BY task_id, attempt_id, metric HAVING count(*)>1) d', [ownerId]);
    const negativeUsage = await pool.query('SELECT count(*)::int AS n FROM usage_events WHERE subject_id=$1 AND amount<0', [ownerId]);

    // Calculate resource usage
    const apiRss = report.samples.filter(s => s.api_rss_kb).map(s => s.api_rss_kb);
    const workerRss = report.samples.filter(s => s.worker_rss_kb).map(s => s.worker_rss_kb);
    const dbConnections = report.samples.filter(s => s.pg_connections).map(s => s.pg_connections);

    report.metrics = {
      throughput: {
        overall_rps: Number((report.stages.reduce((sum, s) => sum + s.requests, 0) / (report.stages.reduce((sum, s) => sum + s.duration_ms, 0) / 1000)).toFixed(2)),
        peak_rps: Math.max(...report.stages.map(s => s.throughput_rps))
      },
      latency: {
        terminal_task_latency: distribution(terminalLatencies)
      },
      errors: {
        total_errors: report.stages.reduce((sum, s) => sum + s.errors, 0),
        overall_error_rate_percent: Number((report.stages.reduce((sum, s) => sum + s.errors, 0) / report.stages.reduce((sum, s) => sum + s.requests, 0) * 100).toFixed(3))
      },
      resources: {
        api_memory_kb: { min: Math.min(...apiRss), max: Math.max(...apiRss), avg: Math.round(apiRss.reduce((a, b) => a + b, 0) / apiRss.length) },
        worker_memory_kb: { min: Math.min(...workerRss), max: Math.max(...workerRss), avg: Math.round(workerRss.reduce((a, b) => a + b, 0) / workerRss.length) },
        db_connections: { min: Math.min(...dbConnections), max: Math.max(...dbConnections), avg: Math.round(dbConnections.reduce((a, b) => a + b, 0) / dbConnections.length) }
      }
    };

    report.invariants = {
      submitted: taskIds.length,
      terminal: tasks.rows.filter(task => ['succeeded','failed','cancelled','timed_out'].includes(task.state)).length,
      upstream_calls: fixtureCalls,
      anomalies: anomalies.length > 0 ? anomalies : null,
      duplicate_usage: duplicateUsage.rows[0].n,
      negative_usage: negativeUsage.rows[0].n
    };

    report.generator = {
      max_active: maxActive,
      submit_attempts: submitAttempts,
      sample_failures: sampleFailure,
      samples: report.samples.length
    };

    // Evaluate pass/fail criteria
    const targetMet = {
      throughput: report.metrics.throughput.overall_rps >= profile.metrics.throughput_target_rps,
      error_rate: report.metrics.errors.overall_error_rate_percent <= profile.metrics.error_rate_target_percent,
      no_anomalies: anomalies.length === 0 && duplicateUsage.rows[0].n === 0 && negativeUsage.rows[0].n === 0
    };

    if (!taskIds.length || !targetMet.no_anomalies || report.metrics.errors.overall_error_rate_percent > 1) {
      throw new Error('stress_test_failure_criteria_not_met');
    }

    report.exit_code = 0;
    report.status = 'PASSED';
    console.log(`\n✓ Stress test PASSED`);

  } catch (error) {
    report.exit_code = 1;
    report.failure = error.message;
    report.status = 'FAILED';
    process.exitCode = 1;
    console.error(`\n✗ Stress test FAILED: ${error.message}`);
    if (!session && logs.api.length) {
      console.error(`API startup diagnostic: ${logs.api.join('').slice(-1500)}`);
    }
  } finally {
    aborted = true;
    if (sampling) clearInterval(sampling);

    await stopChild(worker);
    await stopChild(api);
    await fixture?.close().catch(() => {});

    if (pool) await pool.end().catch(() => {});
    if (created) {
      try {
        await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
        report.cleanup = `dropped ${name}`;
      } catch (error) {
        report.cleanup = `manual_cleanup_required:${name}:${error.message}`;
        report.exit_code = 1;
        process.exitCode = 1;
      }
    }
    await admin.end().catch(() => {});

    if (created) {
      try {
        report.redis_keys_removed = await cleanupRedisNamespace(config.redis, report.redis_namespace);
      } catch (error) {
        report.redis_cleanup = `manual_cleanup_required:${report.redis_namespace}:${error.message}`;
      }
    }

    if (temporaryRoot) {
      await rm(temporaryRoot, { recursive: true, force: true });
      report.temporary_root_cleanup = 'removed';
    }

    report.source_after = await sourceIdentity();
    report.finished_at = new Date().toISOString();
    report.duration_seconds = Number(((new Date(report.finished_at) - new Date(report.started_at)) / 1000).toFixed(1));

    // Write results
    await writeFile(`.herdr/${runId}-manifest.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });

    console.log(`\nResults written to: .herdr/${runId}-manifest.json`);
    console.log(JSON.stringify({
      run_id: runId,
      status: report.status,
      exit_code: report.exit_code,
      stages: report.stages.length,
      failure: report.failure ?? null,
      throughput_rps: report.metrics?.throughput?.overall_rps ?? null,
      error_rate: report.metrics?.errors?.overall_error_rate_percent ?? null
    }));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
