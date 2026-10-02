import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:https';
import { execFileSync, fork } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer as createTcpServer } from 'node:net';
import pg from '../apps/api/node_modules/pg/lib/index.js';
import { createClient } from '../apps/api/node_modules/redis/dist/index.js';
import { buildServer } from '../apps/api/src/server.mjs';
import { createPostgresWorker } from '../apps/worker/src/worker.mjs';
import { ProviderEgress } from '../src/security/provider-egress.mjs';
import { createNetworkRouteFactory } from '../src/security/network-route.mjs';
import { RedisSecretService } from '../src/security/secret-service.mjs';
import { DiskPackageStore } from '../src/apps/package-service.mjs';
import { discoverMigrations, buildMigrationSql } from './migrate.mjs';

if (process.env.DGOS_VERIFY_ADMIN_URL && process.env.DGOS_PROVIDER_HTTP_ADMIN_DATABASE_URL) throw new Error('ambiguous_provider_admin_database');
const verifyMode = Boolean(process.env.DGOS_VERIFY_ADMIN_URL);
const adminUrl = new URL(process.env.DGOS_VERIFY_ADMIN_URL || process.env.DGOS_PROVIDER_HTTP_ADMIN_DATABASE_URL || 'postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_provider');
const parentDatabase = decodeURIComponent(adminUrl.pathname.slice(1));
if (!['postgres:', 'postgresql:'].includes(adminUrl.protocol) || adminUrl.hostname !== '127.0.0.1' || adminUrl.port !== '5432' || adminUrl.search || adminUrl.hash || (verifyMode ? !/^dgos_v1_verify_[0-9a-f]{32}$/.test(parentDatabase) : parentDatabase !== 'dgos_v1_provider')) throw new Error('dedicated_provider_database_required');
const redisUrl = process.env.DGOS_PROVIDER_HTTP_REDIS_URL ?? 'redis://127.0.0.1:6379/5';
if (new URL(redisUrl).pathname !== '/5') throw new Error('provider_redis_db5_required');
const suffix = randomBytes(16).toString('hex');
const database = `dgos_v1_provider_${suffix}`;
const databaseUrl = new URL(adminUrl); databaseUrl.pathname = `/${database}`;
const namespace = `v1-provider-r6:${suffix}`;
const apiPort = 15171; const fixturePort = 15172;
const assertExclusivePorts = async () => {
  const reservations = [];
  try {
    for (const port of [apiPort, fixturePort]) {
      const server = createTcpServer();
      await new Promise((done, fail) => { server.once('error', fail); server.listen({ host: '127.0.0.1', port, exclusive: true }, done); });
      reservations.push(server);
    }
  } finally {
    await Promise.all(reservations.map((server) => new Promise((done) => server.close(done))));
  }
};
const endpoint = `https://provider.fixture.test:${fixturePort}/v1`;
const workerMode = process.argv.includes('--worker');
const root = workerMode ? null : await mkdtemp(join(tmpdir(), 'dgos-provider-r6-'));
const evidenceDir = resolve('tests/provider/evidence');
const runId = `V1-PROVIDER-r6-${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${suffix.slice(0, 8)}`;
const reportPath = join(evidenceDir, `${runId}.json`);
const logPath = join(evidenceDir, `${runId}.log`);
const manifestPath = join(evidenceDir, `${runId}-manifest.json`);
const assets = ['scripts/v1-provider-http.mjs', 'apps/api/src/server.mjs', 'apps/worker/src/worker.mjs', 'src/ai-task/service.mjs', 'src/ai-task/repository.mjs', 'src/provider-adapters/openai-compatible.mjs', 'src/provider-config/task-admission.mjs', 'src/provider-config/text-profile.mjs', 'migrations/0047-ai-task-parameters.sql'];
const hash = (content) => createHash('sha256').update(content).digest('hex');
const assetHashes = async () => Object.fromEntries(await Promise.all(assets.map(async (path) => [path, hash(await readFile(path))])));
const before = workerMode ? null : await assetHashes();
const report = { runId, workPackage: 'V1-PROVIDER r6', startedAt: new Date().toISOString(), parentDatabase, database, redisDb: 5, namespace, apiPort, fixturePort, parentPid: process.pid, cases: [], limitations: ['Controlled local HTTPS fixture, not a paid or production Provider.', 'Only Provider HTTP and worker chain; not the full V1 release suite.'] };
const log = [];
const record = (name, facts = {}) => { report.cases.push({ name, result: 'passed', facts }); log.push(`${new Date().toISOString()} PASS ${name}`); console.log(`PASS ${name}`); };
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (name, read, predicate, ms = 12000) => { const until = Date.now() + ms; while (Date.now() < until) { const value = await read(); if (predicate(value)) return value; await pause(40); } throw new Error(`${name}_timeout`); };
const admin = workerMode ? null : new pg.Pool({ connectionString: adminUrl.href });
let pool, redis, api, fixture, worker, created = false, previousDatabaseUrl, previousNodeEnv, firstHeld;
const requests = [];
let fixtureMode = 'normal';
const fixtureToken = `fixture-${randomUUID()}`;
const routeFor = (secret, ca) => createNetworkRouteFactory({ egress: new ProviderEgress({ lookup: async () => [{ address: '127.0.0.1' }], internalHosts: ['provider.fixture.test'], ca }), secretService: secret, allowLocalFixture: true, fixtureLookup: async () => [{ address: '127.0.0.1' }], fixtureCa: ca });
const declaration = (name, profile) => ({ schemaVersion: 'dgos-capability/v1', kind: 'model', id: `fixture.${name}.${suffix}`, version: '1.0.0', executor: { type: 'declarative', engine: 'dgos-text-v1' }, capabilities: ['text.chat'], operations: { submit: { profile, method: 'POST', path: profile === 'responses' ? '/responses' : '/chat/completions' } }, workflows: { 'text.chat': { submit: 'submit' } }, defaults: { temperature: 0.4 }, limits: { maxInputCharacters: 80, maxOutputTokens: 30 }, uiSchemas: { parameters: ['temperature', 'maxOutputTokens'] }, modelProfiles: { exact: { modelNames: ['fixture-model'], workflow: 'text.chat', defaults: { maxOutputTokens: 12 }, limits: { maxOutputTokens: 15 } } }, assets: {} });
let session;
const http = async (path, { method = 'GET', body, status = 200, headers = {} } = {}) => {
  const response = await fetch(`http://127.0.0.1:${apiPort}/api/v1${path}`, { method, headers: { ...(session ? { authorization: `Bearer ${session}` } : {}), ...(body ? { 'content-type': 'application/json', 'x-dgos-csrf': 'provider-r6' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
  const raw = await response.text(); let value; try { value = raw ? JSON.parse(raw) : null; } catch { value = raw; }
  assert.equal(response.status, status, `${method} ${path}: HTTP ${response.status}, expected ${status}, errorKey=${value?.errorKey ?? 'none'}`);
  return value;
};
const post = (path, body, status = 200) => http(path, { method: 'POST', body, status });
const countCalls = (path) => requests.filter((item) => item.path === path).length;
const task = (configId, parameters, requestId = randomUUID()) => ({ requestId, target: 'text', intent: 'text.chat', input: { text: 'hello' }, options: { providerConfigId: configId, modelId: 'fixture-model', parameters } });
const status = (taskId) => http(`/ai-tasks/${taskId}`);
const terminal = (taskId) => waitFor('task_terminal', () => status(taskId), (value) => ['succeeded','failed','cancelled','timed_out'].includes(value.status));
const row = async (taskId) => (await pool.query('SELECT execution_snapshot,execution_digest,state FROM ai_tasks WHERE task_id=$1', [taskId])).rows[0];
const workerCommand = (action) => new Promise((done, fail) => {
  const child = worker;
  const id = randomUUID();
  const cleanup = () => { clearTimeout(timer); child.off('message', onMessage); child.off('exit', onExit); };
  const onExit = (code, signal) => { cleanup(); fail(new Error(`worker_${action}_exit_${signal ?? code}`)); };
  const timer = setTimeout(() => { cleanup(); fail(new Error(`worker_${action}_timeout`)); }, 20000);
  const onMessage = (message) => { if (message.id !== id) return; cleanup(); message.error ? fail(new Error(message.error)) : done(message.result); };
  child.on('message', onMessage); child.once('exit', onExit); child.send({ id, action });
});
const startWorker = async () => {
  const child = fork(new URL(import.meta.url), ['--worker'], { env: { ...process.env, DGOS_PROVIDER_HTTP_CHILD_DATABASE_URL: databaseUrl.href, DGOS_PROVIDER_HTTP_REDIS_URL: redisUrl, DGOS_PROVIDER_HTTP_NAMESPACE: namespace, DGOS_PROVIDER_HTTP_CA_FILE: join(root, 'cert.pem') }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  child.stderr.on('data', (bytes) => { log.push(`${new Date().toISOString()} CHILD_STDERR ${String(bytes).replace(/fixture-[A-Za-z0-9-]+/g, '<redacted>').slice(0, 300)}`); });
  await new Promise((done, fail) => { const timer = setTimeout(() => fail(new Error('worker_start_timeout')), 8000); child.on('message', (message) => { if (message.ready) { clearTimeout(timer); done(); } }); child.once('exit', (code) => { clearTimeout(timer); fail(new Error(`worker_start_exit_${code}`)); }); });
  worker = child; return child;
};
const stopWorker = async (signal = 'SIGTERM') => { if (!worker) return; const child = worker; worker = null; if (child.exitCode !== null || child.signalCode) return; child.kill(signal); await new Promise((done) => { const timer = setTimeout(() => { child.kill('SIGKILL'); done(); }, 5000); child.once('exit', () => { clearTimeout(timer); done(); }); }); };

if (process.argv.includes('--worker')) {
  const childUrl = new URL(process.env.DGOS_PROVIDER_HTTP_CHILD_DATABASE_URL ?? '');
  if (!/^dgos_v1_provider_[0-9a-f]{32}$/.test(childUrl.pathname.slice(1)) || new URL(process.env.DGOS_PROVIDER_HTTP_REDIS_URL).pathname !== '/5') throw new Error('worker_isolation_required');
  const childRedis = createClient({ url: process.env.DGOS_PROVIDER_HTTP_REDIS_URL }); childRedis.on('error', () => {}); await childRedis.connect();
  const secret = new RedisSecretService(childRedis, { keyPrefix: `${process.env.DGOS_PROVIDER_HTTP_NAMESPACE}:secret:` });
  const ca = await readFile(process.env.DGOS_PROVIDER_HTTP_CA_FILE);
  const networkRoute = routeFor(secret, ca);
  const runtime = createPostgresWorker({ env: { DGOS_DATABASE_URL: childUrl.href }, secretService: secret, networkOptions: { route: networkRoute } });
  await runtime.actionRuntime.ready;
  await runtime.actionRuntime.system.activateNetworkRoute(networkRoute, { role: 'worker', instanceId: runtime.worker.workerId, leaseMs: 30000 });
  const heartbeat = setInterval(() => runtime.actionRuntime.system.renewNetworkRoute(networkRoute, { role: 'worker', instanceId: runtime.worker.workerId, leaseMs: 30000 }).catch(() => {}), 5000);
  process.send({ ready: true, pid: process.pid });
  process.on('message', async ({ id, action }) => { try { const result = action === 'connection' ? await runtime.providerTestWorker.runOnce() : await runtime.worker.runOnce(); process.send({ id, result: result ? { status: result.status ?? result.state, taskId: result.taskId } : null }); } catch (error) { process.send({ id, error: error.errorKey ?? error.message }); } });
  process.on('SIGTERM', async () => { clearInterval(heartbeat); await runtime.actionRuntime.system.releaseNetworkRoute(runtime.worker.workerId).catch(() => {}); await runtime.pool.end(); await childRedis.quit(); process.exit(0); });
} else {
  let phase = 'preflight';
  try {
    await assertExclusivePorts();
    const actualParent = (await admin.query('SELECT current_database() AS name')).rows[0]?.name;
    assert.equal(actualParent, parentDatabase, 'provider_parent_database_mismatch');
    await admin.query(`CREATE DATABASE ${database}`); created = true;
    pool = new pg.Pool({ connectionString: databaseUrl.href });
    const migrations = (await discoverMigrations()).filter(({ version }) => Number(version.slice(0, 4)) <= 51);
    const frozenChecksums = {
      '0045-network-route-activation': 'c2bc2a47a3360e47b02d4edd9880b88694ec3ab84cdf7613674cd2099d40040d',
      '0046-package-retention': '7321916de0ddff31f40d48b837acada75d8ec893691c7c65f22d0b707d6a9a83',
      '0047-ai-task-parameters': '22b6e9e886943f2b660de4d54989e0587c58cb67e373fbd45b7140849f6f15f6',
      '0048-network-route-fingerprint': '7879e6cf17753fa82254675756fbeb1fdfb9ad67e11808aec8922cd2f10cd33d',
      '0049-extension-management': 'ba0bc80a0ccc74e05a5244b50e52e6a26df39ad854995ba038020b7d5d954f1b',
      '0050-session-management': '8802fe3a02b0bf7364aeac96215da09454d0c53b48c06d2cb76c6f3d6b455d85',
      '0051-proxy-provisioning': '778fddef654d67bc3ecfc01e11fd91f826f91d68a5b6c5c72568b5e35cca1939',
    };
    for (const [version, expected] of Object.entries(frozenChecksums)) assert.equal(migrations.find((item) => item.version === version)?.checksum, expected);
    await pool.query(buildMigrationSql(migrations));
    const applied = (await pool.query('SELECT version,checksum FROM dgos_schema_migrations ORDER BY version')).rows;
    assert.deepEqual(applied.map((item) => item.version), migrations.map((item) => item.version));
    record('isolated_frozen_schema', { migrationCount: applied.length, versions: applied.map((item) => item.version) });

    phase = 'fixture';
    execFileSync('openssl', ['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(root,'key.pem'),'-out',join(root,'cert.pem'),'-days','1','-subj','/CN=provider.fixture.test','-addext','subjectAltName=DNS:provider.fixture.test'], { stdio: 'ignore' });
    const ca = await readFile(join(root, 'cert.pem'));
    fixture = createServer({ key: await readFile(join(root, 'key.pem')), cert: ca }, async (req, res) => {
      let body = ''; for await (const chunk of req) body += chunk;
      if (req.headers.authorization !== `Bearer ${fixtureToken}`) { res.writeHead(401).end(); return; }
      requests.push({ path: req.url, body: body ? JSON.parse(body) : null });
      if (req.url === '/v1/models') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ data: [{ id: 'fixture-model', name: 'Fixture model' }] })); return; }
      if (req.url === '/v1/responses' || req.url === '/v1/chat/completions') {
        res.setHeader('content-type', 'text/event-stream');
        res.write(req.url.endsWith('/responses') ? 'data: {"type":"response.output_text.delta","delta":"early"}\n\n' : 'data: {"choices":[{"delta":{"content":"early"}}]}\n\n');
        if (fixtureMode === 'hold') { firstHeld = () => res.end('data: {"type":"response.completed","response":{"usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}}\n\n'); return; }
        if (fixtureMode === 'hang') return;
        res.end(req.url.endsWith('/responses') ? 'data: {"type":"response.completed"}\n\n' : 'data: [DONE]\n\n'); return;
      }
      res.writeHead(404).end();
    });
    await new Promise((done) => fixture.listen(fixturePort, '127.0.0.1', done));
    redis = createClient({ url: redisUrl }); redis.on('error', () => {}); await redis.connect();
    const secret = new RedisSecretService(redis, { keyPrefix: `${namespace}:secret:` });
    previousDatabaseUrl = process.env.DGOS_DATABASE_URL; previousNodeEnv = process.env.NODE_ENV;
    process.env.DGOS_DATABASE_URL = databaseUrl.href; process.env.NODE_ENV = 'test';
    api = buildServer({ logger: false, closeDatabasePools: true, secretService: secret, providerEgress: new ProviderEgress({ lookup: async () => [{ address: '127.0.0.1' }], internalHosts: ['provider.fixture.test'], ca }), networkOptions: { allowLocalFixture: true, fixtureLookup: async () => [{ address: '127.0.0.1' }], ca }, packageOptions: { store: new DiskPackageStore(join(root, 'packages')), trustRoots: new Map() } });
    await api.listen({ host: '127.0.0.1', port: apiPort });
    await startWorker();
    assert.notEqual(worker.pid, process.pid);
    record('public_api_and_independent_worker', { apiPort, parentPid: process.pid, workerPid: worker.pid });

    phase = 'public_setup';
    const boot = await post('/identity/admin/bootstrap', { displayName: 'Provider r6', credential: `fixture-admin-${randomUUID()}` }, 201); session = boot.sessionId;
    const ownerId = boot.principalId;
    const profiles = [];
    for (const [name, operation] of [['responses','responses'], ['chat','chat.completions']]) {
      const value = declaration(name, operation); const validated = await post('/provider/capability-protocols', { requestId: randomUUID(), declaration: value });
      const requestId = randomUUID(); const ticket = await post('/provider/capability-protocols/confirmations', { requestId, operation: 'provider.protocol.publish', protocolId: value.id, version: value.version, declaration: value, validationDigest: validated.digest }, 201);
      const published = await post(`/provider/capability-protocols/${value.id}/versions`, { requestId, declaration: value, validationDigest: validated.digest, confirmationId: ticket.confirmationId }, 201);
      assert.equal(published.status, 'active'); profiles.push(value);
    }
    const account = await post('/provider/accounts', { requestId: randomUUID(), protocolType: 'openai-compatible', displayName: 'Provider fixture', credential: fixtureToken, scope: { endpoint } }, 201);
    const connection = await post('/provider/connection-tests', { requestId: randomUUID(), accountId: account.accountId, protocolVersion: 'v1' }, 202);
    await workerCommand('connection');
    assert.equal((await http(`/provider/connection-tests/${connection.testId}`)).status, 'succeeded');
    await post(`/provider/accounts/${account.accountId}/state`, { requestId: randomUUID(), baseVersion: account.version, state: 'ready', connectionTestId: connection.testId });
    const configs = [];
    for (const value of profiles) {
      const createdConfig = await post('/provider/configs', { requestId: randomUUID(), providerAccountId: account.accountId, protocolType: 'openai-compatible', displayName: value.id, baseUrl: endpoint, capabilityProtocolId: value.id, capabilityProtocolVersion: value.version }, 201);
      const configId = createdConfig.id;
      await post(`/provider/configs/${configId}/validate`, { requestId: randomUUID() });
      await post(`/provider/configs/${configId}/models`, { requestId: randomUUID() });
      await post(`/provider/configs/${configId}/model-policies`, { requestId: randomUUID(), modelId: 'fixture-model', enabled: true, assignedCapabilities: ['text'], defaultFor: [], baseVersion: '0' });
      configs.push(configId);
    }
    await http('/quota/policies', { method: 'PUT', body: { requestId: randomUUID(), metric: 'requests', scopeType: 'subject', scopeId: ownerId, hardLimit: 100, softLimit: 100, windowSeconds: 3600, effectiveAt: new Date().toISOString() } });
    record('public_profile_account_config_quota_setup', { profileIds: profiles.map((item) => item.id), configIds: configs, connectionTestId: connection.testId });

    phase = 'responses_early'; fixtureMode = 'hold';
    const responsesInput = task(configs[0], { temperature: 0.7 });
    const responseTask = await post('/ai-tasks', responsesInput, 202);
    const snapshot = await row(responseTask.taskId);
    assert.equal(snapshot.execution_snapshot.executionSnapshotVersion, 1);
    assert.deepEqual(snapshot.execution_snapshot.normalizedParameters, { temperature: 0.7, maxOutputTokens: 12 });
    const running = workerCommand('task');
    await waitFor('early_delta', async () => (await pool.query("SELECT count(*)::int AS n FROM ai_task_events WHERE task_id=$1 AND event_type='text.delta'", [responseTask.taskId])).rows[0].n, (n) => n > 0);
    assert.equal((await status(responseTask.taskId)).status, 'running');
    const earlyEvents = await http(`/ai-tasks/${responseTask.taskId}/events`);
    assert.match(earlyEvents, /event: text\.delta/);
    assert.match(earlyEvents, /"delta":"early"/);
    const sequences = [...earlyEvents.matchAll(/^id: (\d+)$/gm)].map((match) => Number(match[1]));
    assert.ok(sequences.length >= 2);
    assert.deepEqual(sequences, [...sequences].sort((left, right) => left - right));
    const resumedEvents = await http(`/ai-tasks/${responseTask.taskId}/events`, { headers: { 'last-event-id': String(sequences[0]) } });
    const resumedSequences = [...resumedEvents.matchAll(/^id: (\d+)$/gm)].map((match) => Number(match[1]));
    assert.deepEqual(resumedSequences, sequences.slice(1));
    assert.equal(countCalls('/v1/responses'), 1);
    firstHeld(); fixtureMode = 'normal';
    await running;
    const responseDone = await terminal(responseTask.taskId);
    assert.equal(responseDone.status, 'succeeded'); assert.equal((await http(`/artifacts/${responseDone.artifactIds[0]}`)).content, 'early');
    assert.deepEqual(requests.find((item) => item.path === '/v1/responses').body, { model: 'fixture-model', input: 'hello', stream: true, temperature: 0.7, max_output_tokens: 12 });
    const replay = await post('/ai-tasks', responsesInput, 202); assert.equal(replay.taskId, responseTask.taskId); assert.equal(countCalls('/v1/responses'), 1);
    record('responses_snapshot_early_delta_artifact_replay', { taskId: responseTask.taskId, workerPid: worker.pid, executionDigest: snapshot.execution_digest, firstDeltaBeforeEof: true, lastEventIdResumed: true, eventCount: sequences.length, upstreamCalls: 1 });

    phase = 'chat_restart'; const oldPid = worker.pid; await stopWorker(); await startWorker(); assert.notEqual(worker.pid, oldPid);
    const chatInput = task(configs[1], { maxOutputTokens: 9 }); const chatTask = await post('/ai-tasks', chatInput, 202);
    const chatSnapshot = await row(chatTask.taskId); assert.equal(chatSnapshot.execution_snapshot.resolvedProfile.operationProfile, 'chat.completions');
    await workerCommand('task'); const chatDone = await terminal(chatTask.taskId); assert.equal(chatDone.status, 'succeeded');
    assert.deepEqual(requests.find((item) => item.path === '/v1/chat/completions').body, { model: 'fixture-model', messages: [{ role: 'user', content: 'hello' }], stream: true, stream_options: { include_usage: true }, temperature: 0.4, max_tokens: 9 });
    record('chat_snapshot_independent_worker_restart', { taskId: chatTask.taskId, oldPid, workerPid: worker.pid, upstreamCalls: 1 });

    phase = 'negative';
    const beforeTasks = (await pool.query('SELECT count(*)::int AS n FROM ai_tasks')).rows[0].n;
    const beforeReservations = (await pool.query('SELECT count(*)::int AS n FROM quota_reservations')).rows[0].n;
    const beforeCalls = requests.length;
    assert.equal((await post('/ai-tasks', task(configs[0], { vendorValue: 1 }), 422)).errorKey, 'invalid_request');
    assert.equal((await post('/ai-tasks', task(configs[0], { maxOutputTokens: 16 }), 422)).errorKey, 'invalid_request');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM ai_tasks')).rows[0].n, beforeTasks);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM quota_reservations')).rows[0].n, beforeReservations);
    assert.equal(requests.length, beforeCalls);
    record('invalid_parameters_zero_side_effect');

    phase = 'pre_dispatch_mutation';
    const deniedTask = await post('/ai-tasks', task(configs[1], { temperature: 0.3 }), 202);
    const callsBeforeDeny = requests.length;
    const currentConfig = (await http('/provider/configs')).items.find((item) => item.id === configs[1]);
    await http(`/provider/configs/${configs[1]}`, { method: 'PUT', body: { requestId: randomUUID(), baseVersion: currentConfig.version, displayName: 'Changed before dispatch' } });
    await workerCommand('task');
    const deniedDone = await terminal(deniedTask.taskId); assert.equal(deniedDone.status, 'failed');
    assert.equal(requests.length, callsBeforeDeny);
    assert.equal((await pool.query('SELECT state FROM quota_reservations WHERE task_id=$1', [deniedTask.taskId])).rows[0].state, 'released');
    record('pre_dispatch_config_mutation_denies_network', { taskId: deniedTask.taskId, errorKey: deniedDone.error?.errorKey, upstreamCalls: 0, reservation: 'released' });

    phase = 'sent_unknown'; fixtureMode = 'hang';
    const unknownTask = await post('/ai-tasks', task(configs[0], { maxOutputTokens: 8 }), 202);
    const sentBefore = countCalls('/v1/responses');
    const stuck = workerCommand('task').catch(() => {});
    await waitFor('upstream_sent', () => countCalls('/v1/responses'), (n) => n > sentBefore);
    const sentPid = worker.pid; await stopWorker('SIGKILL'); await stuck;
    await pool.query("UPDATE ai_task_attempts SET lease_until=now()-interval '1 second' WHERE task_id=$1", [unknownTask.taskId]);
    fixtureMode = 'normal'; await startWorker(); assert.notEqual(worker.pid, sentPid);
    await workerCommand('task'); const unknownDone = await terminal(unknownTask.taskId);
    assert.equal(unknownDone.error?.errorKey, 'upstream_outcome_unknown');
    assert.equal(countCalls('/v1/responses'), sentBefore + 1);
    assert.equal((await pool.query('SELECT state FROM quota_reservations WHERE task_id=$1', [unknownTask.taskId])).rows[0].state, 'needs_review');
    record('sigkill_sent_unknown_no_repeat', { taskId: unknownTask.taskId, oldPid: sentPid, workerPid: worker.pid, upstreamCalls: 1, reservation: 'needs_review' });

    phase = 'policy_mutation';
    const policyTask = await post('/ai-tasks', task(configs[0], { maxOutputTokens: 7 }), 202);
    const policyBefore = (await http(`/provider/configs/${configs[0]}/model-policies`)).items.find((item) => item.modelId === 'fixture-model');
    const policyCalls = requests.length;
    await post(`/provider/configs/${configs[0]}/model-policies`, { requestId: randomUUID(), modelId: 'fixture-model', enabled: false, assignedCapabilities: ['text'], defaultFor: [], baseVersion: policyBefore.policyVersion });
    await workerCommand('task');
    const policyDenied = await terminal(policyTask.taskId);
    assert.equal(policyDenied.status, 'failed');
    assert.equal(requests.length, policyCalls);
    assert.equal((await pool.query('SELECT state FROM quota_reservations WHERE task_id=$1', [policyTask.taskId])).rows[0].state, 'released');
    record('pre_dispatch_policy_mutation_denies_network', { taskId: policyTask.taskId, errorKey: policyDenied.error?.errorKey, upstreamCalls: 0, reservation: 'released' });

    report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.failure = { phase, message: String(error.message).replaceAll(fixtureToken, '<redacted>') }; log.push(`${new Date().toISOString()} FAIL ${phase} ${report.failure.message}`); console.error(`FAIL ${phase}: ${report.failure.message}`); process.exitCode = 1; }
  finally {
    await stopWorker().catch(() => {});
    await api?.close().catch(() => {});
    if (fixture) { fixture.closeAllConnections(); await new Promise((done) => fixture.close(done)); }
    await redis?.quit().catch(() => {});
    await pool?.end().catch(() => {});
    if (created) await admin.query(`DROP DATABASE IF EXISTS ${database}`).catch(() => {});
    await admin.end();
    if (previousDatabaseUrl === undefined) delete process.env.DGOS_DATABASE_URL; else process.env.DGOS_DATABASE_URL = previousDatabaseUrl;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    await rm(root, { recursive: true, force: true });
    report.finishedAt = new Date().toISOString(); report.sourceBefore = before; report.sourceAfter = await assetHashes();
    report.sourceStable = JSON.stringify(before) === JSON.stringify(report.sourceAfter);
    await mkdir(evidenceDir, { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    await writeFile(logPath, `${log.join('\n')}\n`, { flag: 'wx' });
    await writeFile(manifestPath, `${JSON.stringify({ runId, reportPath, logPath, reportSha256: hash(await readFile(reportPath)), logSha256: hash(await readFile(logPath)), sourceBefore: before, sourceAfter: report.sourceAfter, migrationVersions: report.cases[0]?.facts?.versions ?? [], status: report.status, limitations: report.limitations }, null, 2)}\n`, { flag: 'wx' });
    console.log(JSON.stringify({ status: report.status, cases: report.cases.length, reportPath, logPath, manifestPath }));
  }
}
