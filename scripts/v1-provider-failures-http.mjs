import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { fork, execFileSync } from 'node:child_process';
import { createServer as createHttpsServer } from 'node:https';
import { createServer as createTcpServer } from 'node:net';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import pg from '../apps/api/node_modules/pg/lib/index.js';
import { createClient } from '../apps/api/node_modules/redis/dist/index.js';
import { buildServer } from '../apps/api/src/server.mjs';
import { createPostgresWorker } from '../apps/worker/src/worker.mjs';
import { ProviderEgress } from '../src/security/provider-egress.mjs';
import { createNetworkRouteFactory } from '../src/security/network-route.mjs';
import { RedisSecretService } from '../src/security/secret-service.mjs';
import { DiskPackageStore } from '../src/apps/package-service.mjs';
import { discoverMigrations, buildMigrationSql } from './migrate.mjs';

const apiPort = 15181;
const tlsPort = 15182;
const badTlsPort = 15183;
const closedPort = 15184;
const workerMode = process.argv.includes('--worker');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const waitFor = async (name, read, accept, timeoutMs = 20_000) => {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) { const value = await read(); if (accept(value)) return value; await sleep(50); }
  throw new Error(`${name}_deadline`);
};
const routeFor = (secret, ca) => createNetworkRouteFactory({
  egress: new ProviderEgress({ internalHosts: ['provider.fixture.test'], lookup: async () => [{ address: '127.0.0.1' }], ca }),
  secretService: secret, allowLocalFixture: true,
  fixtureLookup: async () => [{ address: '127.0.0.1' }], fixtureCa: ca,
});

if (workerMode) {
  const childUrl = new URL(process.env.DGOS_PROVIDER_FAILURES_CHILD_DATABASE_URL ?? '');
  const childName = decodeURIComponent(childUrl.pathname.slice(1));
  if (!/^dgos_v1_provider_failures_[0-9a-f]{32}$/.test(childName) ||
      new URL(process.env.DGOS_PROVIDER_FAILURES_REDIS_URL ?? '').pathname !== '/5' ||
      !/^v1-provider-failures:[0-9a-f]{32}$/.test(process.env.DGOS_PROVIDER_FAILURES_PREFIX ?? '')) throw new Error('worker_isolation_required');
  const redis = createClient({ url: process.env.DGOS_PROVIDER_FAILURES_REDIS_URL });
  redis.on('error', () => {});
  await redis.connect();
  const secret = new RedisSecretService(redis, { keyPrefix: `${process.env.DGOS_PROVIDER_FAILURES_PREFIX}:secret:` });
  const route = routeFor(secret, await readFile(process.env.DGOS_PROVIDER_FAILURES_CA_FILE));
  const runtime = createPostgresWorker({ env: { DGOS_DATABASE_URL: childUrl.href }, secretService: secret, networkOptions: { route } });
  await runtime.actionRuntime.ready;
  await runtime.actionRuntime.system.activateNetworkRoute(route, { role: 'worker', instanceId: runtime.worker.workerId, leaseMs: 30_000 });
  const heartbeat = setInterval(() => runtime.actionRuntime.system.renewNetworkRoute(route, { role: 'worker', instanceId: runtime.worker.workerId, leaseMs: 30_000 }).catch(() => {}), 5_000);
  process.send({ ready: true, pid: process.pid });
  process.on('message', async ({ id }) => {
    try { const value = await runtime.providerTestWorker.runOnce(); process.send({ id, result: value && { testId: value.testId, status: value.status, reasonCode: value.reasonCode } }); }
    catch (error) { process.send({ id, error: error.errorKey ?? error.message }); }
  });
  process.on('SIGTERM', async () => {
    clearInterval(heartbeat);
    await runtime.actionRuntime.system.releaseNetworkRoute(runtime.worker.workerId).catch(() => {});
    await runtime.pool.end(); await redis.quit(); process.exit(0);
  });
} else {
  if (process.env.DGOS_VERIFY_ADMIN_URL && process.env.DGOS_PROVIDER_FAILURES_ADMIN_DATABASE_URL) throw new Error('ambiguous_admin_database');
  const verifyMode = Boolean(process.env.DGOS_VERIFY_ADMIN_URL);
  const adminUrl = new URL(process.env.DGOS_VERIFY_ADMIN_URL || process.env.DGOS_PROVIDER_FAILURES_ADMIN_DATABASE_URL || 'postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_provider');
  const parentName = decodeURIComponent(adminUrl.pathname.slice(1));
  if (!['postgres:', 'postgresql:'].includes(adminUrl.protocol) || adminUrl.hostname !== '127.0.0.1' || adminUrl.port !== '5432' || adminUrl.search || adminUrl.hash ||
      (verifyMode ? !/^dgos_v1_verify_[0-9a-f]{32}$/.test(parentName) : parentName !== 'dgos_v1_provider')) throw new Error('dedicated_provider_database_required');
  const redisUrl = process.env.DGOS_PROVIDER_FAILURES_REDIS_URL ?? 'redis://127.0.0.1:6379/5';
  if (new URL(redisUrl).pathname !== '/5') throw new Error('provider_redis_db5_required');
  const suffix = randomBytes(16).toString('hex');
  const database = `dgos_v1_provider_failures_${suffix}`;
  const childUrl = new URL(adminUrl); childUrl.pathname = `/${database}`;
  const prefix = `v1-provider-failures:${suffix}`;
  const root = await mkdtemp(join(tmpdir(), 'dgos-provider-failures-'));
  const evidenceDir = resolve('tests/provider/evidence');
  const runId = `V1-PROVIDER-FAILURES-r8-${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${suffix.slice(0, 8)}`;
  const reportPath = join(evidenceDir, `${runId}.json`);
  const logPath = join(evidenceDir, `${runId}.log`);
  const manifestPath = join(evidenceDir, `${runId}-manifest.json`);
  const assets = ['scripts/v1-provider-failures-http.mjs', 'apps/api/src/provider-service.mjs', 'apps/api/src/server.mjs', 'apps/worker/src/provider-test-worker.mjs', 'apps/worker/src/worker.mjs', 'src/provider/repository.mjs', 'src/security/provider-egress.mjs'];
  const sourceHashes = async () => Object.fromEntries(await Promise.all(assets.map(async (path) => [path, hash(await readFile(path))])));
  const before = await sourceHashes();
  const report = { runId, workPackage: 'V1-PROVIDER-FAILURES r8', startedAt: new Date().toISOString(), parentDatabase: parentName, database, redisDb: 5, prefix, ports: [apiPort, tlsPort, badTlsPort], parentPid: process.pid, cases: [], limitations: ['Controlled local TLS fixture; no paid or production Provider.', 'Current source only; final candidate replay requires source identity comparison.'] };
  const lines = [];
  const token = `fixture-secret-${randomUUID()}`;
  const requests = [];
  const sockets = new Set();
  let fixtureMode = 'success';
  let session;
  let admin, pool, redis, api, tls, badTls, created = false;
  let previousDatabaseUrl, previousNodeEnv;
  const workers = new Set();
  let phase = 'preflight';
  const log = (line) => { lines.push(`${new Date().toISOString()} ${String(line).replaceAll(token, '<redacted>')}`); };
  const http = async (path, { method = 'GET', body, status = 200 } = {}) => {
    const response = await fetch(`http://127.0.0.1:${apiPort}/api/v1${path}`, { method, headers: { ...(session ? { authorization: `Bearer ${session}` } : {}), ...(body ? { 'content-type': 'application/json', 'x-dgos-csrf': 'provider-failures-r8' } : {}), ...(method === 'DELETE' ? { 'x-dgos-csrf': 'provider-failures-r8' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10_000) });
    const raw = await response.text();
    let value; try { value = JSON.parse(raw); } catch { value = raw; }
    assert.equal(response.status, status, `${method} ${path}: HTTP ${response.status}, errorKey=${value?.errorKey}`);
    return value;
  };
  const post = (path, body, status) => http(path, { method: 'POST', body, status });
  const metrics = async () => {
    const { rows } = await pool.query("SELECT (SELECT count(*)::int FROM ai_tasks) tasks, (SELECT count(*)::int FROM quota_reservations) reservations, (SELECT count(*)::int FROM model_catalogs) catalogs, (SELECT count(*)::int FROM model_catalog_entries) entries, (SELECT count(*)::int FROM model_policies) policies");
    return rows[0];
  };
  const startWorker = async () => {
    const child = fork(new URL(import.meta.url), ['--worker'], { env: { ...process.env, DGOS_PROVIDER_FAILURES_CHILD_DATABASE_URL: childUrl.href, DGOS_PROVIDER_FAILURES_REDIS_URL: redisUrl, DGOS_PROVIDER_FAILURES_PREFIX: prefix, DGOS_PROVIDER_FAILURES_CA_FILE: join(root, 'cert.pem') }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    workers.add(child);
    child.stderr.on('data', (bytes) => log(`CHILD_${child.pid} ${String(bytes).slice(0, 300)}`));
    await new Promise((done, fail) => {
      const timer = setTimeout(() => fail(new Error(`worker_${child.pid}_start_deadline`)), 10_000);
      child.once('message', (message) => { clearTimeout(timer); message.ready ? done() : fail(new Error('worker_not_ready')); });
      child.once('exit', (code) => { clearTimeout(timer); fail(new Error(`worker_${child.pid}_exit_${code}`)); });
    });
    return child;
  };
  const command = (child) => new Promise((done, fail) => {
    const id = randomUUID();
    const cleanup = () => { clearTimeout(timer); child.off('message', receive); child.off('exit', exited); };
    const timer = setTimeout(() => { cleanup(); fail(new Error(`worker_${child.pid}_command_deadline`)); }, 25_000);
    const exited = (code, signal) => { cleanup(); fail(new Error(`worker_${child.pid}_command_exit_${signal ?? code}`)); };
    const receive = (message) => { if (message.id !== id) return; cleanup(); message.error ? fail(new Error(message.error)) : done(message.result); };
    child.on('message', receive); child.once('exit', exited); child.send({ id });
  });
  const stopWorker = async (child, signal = 'SIGTERM') => {
    if (!child || child.exitCode !== null || child.signalCode) { workers.delete(child); return; }
    child.kill(signal);
    await Promise.race([new Promise((done) => child.once('exit', done)), sleep(3_000).then(() => { if (child.exitCode === null && !child.signalCode) child.kill('SIGKILL'); })]);
    if (child.exitCode === null && !child.signalCode) await new Promise((done) => child.once('exit', done));
    workers.delete(child);
  };
  const runCase = async (name, execute) => {
    phase = name;
    try { const facts = await execute(); report.cases.push({ name, result: 'passed', facts }); log(`PASS ${name}`); console.log(`PASS ${name}`); }
    catch (error) { report.cases.push({ name, result: 'failed', facts: error.facts, message: String(error.message).replaceAll(token, '<redacted>') }); log(`FAIL ${name} ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
  };
  const countRequests = () => requests.length;
  const startTest = (accountId) => post('/provider/connection-tests', { requestId: randomUUID(), accountId, protocolVersion: 'v1' }, 202);
  const getTest = (testId) => http(`/provider/connection-tests/${testId}`);
  const terminal = (testId, timeoutMs = 20_000) => waitFor('connection_terminal', () => getTest(testId), (item) => ['succeeded', 'failed', 'timed_out', 'cancelled'].includes(item.status), timeoutMs);
  const connectionAudit = async (testId) => (await pool.query("SELECT result FROM audit_events WHERE target_type='connection_test' AND target_id=$1 AND action='provider.connection_test.finish'", [testId])).rows;
  const checkPrivate = async (value) => {
    assert.doesNotMatch(JSON.stringify(value), /fixture-secret-|provider-credential:/);
    assert.doesNotMatch(JSON.stringify(lines), /fixture-secret-/);
    const audits = (await pool.query("SELECT summary FROM audit_events WHERE target_type='connection_test'")).rows;
    assert.doesNotMatch(JSON.stringify(audits), /fixture-secret-|provider-credential:/);
  };
  const exercise = async (accountId, expectedStatus, expectedReason, worker) => {
    const baseline = await metrics(); const calls = countRequests();
    const queued = await startTest(accountId);
    const executed = await command(worker);
    const result = await terminal(queued.testId);
    const audit = await connectionAudit(queued.testId);
    const facts = { testId: queued.testId, workerPid: worker.pid, status: result.status, reasonCode: result.reasonCode, upstreamCalls: countRequests() - calls, finishAudits: audit.length, isolatedStoresUnchanged: JSON.stringify(await metrics()) === JSON.stringify(baseline) };
    try {
      assert.equal(facts.isolatedStoresUnchanged, true);
      await checkPrivate(result);
      assert.equal(audit.length, 1);
      const terminalCalls = countRequests(); await command(worker);
      assert.equal(countRequests(), terminalCalls, 'request_after_terminal');
      assert.equal(result.status, expectedStatus);
      assert.equal(result.reasonCode, expectedReason);
      assert.equal(result.testId, queued.testId);
      assert.equal(executed?.testId, queued.testId);
    } catch (error) { error.facts = facts; throw error; }
    return facts;
  };
  try {
    const reservations = [];
    try {
      for (const port of [apiPort, tlsPort, badTlsPort, closedPort]) {
        const server = createTcpServer();
        await new Promise((done, fail) => { server.once('error', fail); server.listen({ host: '127.0.0.1', port, exclusive: true }, done); });
        reservations.push(server);
      }
    } finally { await Promise.all(reservations.map((server) => new Promise((done) => server.close(done)))); }
    admin = new pg.Pool({ connectionString: adminUrl.href });
    assert.equal((await admin.query('SELECT current_database() name')).rows[0].name, parentName);
    await admin.query(`CREATE DATABASE ${database}`); created = true;
    pool = new pg.Pool({ connectionString: childUrl.href });
    const migrations = (await discoverMigrations()).filter(({ version }) => Number(version.slice(0, 4)) <= 51);
    assert.equal(migrations.length, 47, 'frozen_47_migrations_required');
    const frozen = {
      '0045-network-route-activation': 'c2bc2a47a3360e47b02d4edd9880b88694ec3ab84cdf7613674cd2099d40040d',
      '0046-package-retention': '7321916de0ddff31f40d48b837acada75d8ec893691c7c65f22d0b707d6a9a83',
      '0047-ai-task-parameters': '22b6e9e886943f2b660de4d54989e0587c58cb67e373fbd45b7140849f6f15f6',
      '0048-network-route-fingerprint': '7879e6cf17753fa82254675756fbeb1fdfb9ad67e11808aec8922cd2f10cd33d',
      '0049-extension-management': 'ba0bc80a0ccc74e05a5244b50e52e6a26df39ad854995ba038020b7d5d954f1b',
      '0050-session-management': '8802fe3a02b0bf7364aeac96215da09454d0c53b48c06d2cb76c6f3d6b455d85',
      '0051-proxy-provisioning': '778fddef654d67bc3ecfc01e11fd91f826f91d68a5b6c5c72568b5e35cca1939',
    };
    for (const [version, checksum] of Object.entries(frozen)) assert.equal(migrations.find((item) => item.version === version)?.checksum, checksum, version);
    await pool.query(buildMigrationSql(migrations));
    const applied = (await pool.query('SELECT version,checksum FROM dgos_schema_migrations ORDER BY version')).rows;
    assert.deepEqual(applied.map((item) => item.version), migrations.map((item) => item.version));
    report.migrations = { count: applied.length, finalVersion: applied.at(-1).version, frozen };
    phase = 'tls_setup';
    for (const [stem, cn] of [['', 'provider.fixture.test'], ['bad-', 'provider.fixture.test']]) {
      execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(root, `${stem}key.pem`), '-out', join(root, `${stem}cert.pem`), '-days', '1', '-subj', `/CN=${cn}`, '-addext', `subjectAltName=DNS:${cn}`], { stdio: 'ignore' });
    }
    const ca = await readFile(join(root, 'cert.pem'));
    tls = createHttpsServer({ key: await readFile(join(root, 'key.pem')), cert: ca }, async (req, res) => {
      requests.push({ mode: fixtureMode, path: req.url });
      if (req.headers.authorization !== `Bearer ${token}`) { res.writeHead(401).end('fixture-secret-in-body'); return; }
      if (fixtureMode === 'auth') { res.writeHead(401).end('fixture-secret-in-body'); return; }
      if (fixtureMode === 'rate') { res.writeHead(429).end('fixture-secret-in-body'); return; }
      if (fixtureMode === 'protocol') { res.setHeader('content-type', 'application/json'); res.end('fixture-secret-in-body'); return; }
      if (fixtureMode === 'hold') { sockets.add(res); res.on('close', () => sockets.delete(res)); return; }
      res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ data: [] }));
    });
    badTls = createHttpsServer({ key: await readFile(join(root, 'bad-key.pem')), cert: await readFile(join(root, 'bad-cert.pem')) }, (_req, res) => res.end('{}'));
    await new Promise((done) => tls.listen(tlsPort, '127.0.0.1', done));
    await new Promise((done) => badTls.listen(badTlsPort, '127.0.0.1', done));
    redis = createClient({ url: redisUrl }); redis.on('error', () => {}); await redis.connect();
    const secret = new RedisSecretService(redis, { keyPrefix: `${prefix}:secret:` });
    previousDatabaseUrl = process.env.DGOS_DATABASE_URL; previousNodeEnv = process.env.NODE_ENV;
    process.env.DGOS_DATABASE_URL = childUrl.href; process.env.NODE_ENV = 'test';
    api = buildServer({ logger: false, closeDatabasePools: true, secretService: secret, providerEgress: new ProviderEgress({ internalHosts: ['provider.fixture.test'], lookup: async () => [{ address: '127.0.0.1' }], ca }), networkOptions: { allowLocalFixture: true, fixtureLookup: async () => [{ address: '127.0.0.1' }], ca }, packageOptions: { store: new DiskPackageStore(join(root, 'packages')), trustRoots: new Map() } });
    await api.listen({ host: '127.0.0.1', port: apiPort });
    phase = 'public_setup';
    const boot = await post('/identity/admin/bootstrap', { displayName: 'Provider failures r8', credential: `bootstrap-${randomUUID()}` }, 201);
    session = boot.sessionId;
    const accounts = {};
    for (const [name, port] of [['normal', tlsPort], ['badTls', badTlsPort], ['closed', closedPort]]) {
      accounts[name] = await post('/provider/accounts', { requestId: randomUUID(), protocolType: 'openai-compatible', displayName: `Fixture ${name}`, credential: token, scope: { endpoint: `https://provider.fixture.test:${port}/v1` } }, 201);
    }
    const first = await startWorker(); const second = await startWorker();
    report.workerPids = [first.pid, second.pid];
    assert.notEqual(first.pid, second.pid);
    await runCase('authentication_failed', async () => { fixtureMode = 'auth'; return exercise(accounts.normal.accountId, 'failed', 'authentication_failed', first); });
    await runCase('rate_limited', async () => { fixtureMode = 'rate'; return exercise(accounts.normal.accountId, 'failed', 'rate_limited', second); });
    await runCase('protocol_mismatch', async () => { fixtureMode = 'protocol'; return exercise(accounts.normal.accountId, 'failed', 'protocol_mismatch', first); });
    await runCase('tls_invalid', async () => { fixtureMode = 'success'; return exercise(accounts.badTls.accountId, 'failed', 'tls_invalid', second); });
    await runCase('network_unreachable', async () => { fixtureMode = 'success'; return exercise(accounts.closed.accountId, 'failed', 'network_unreachable', first); });
    await runCase('timed_out', async () => { fixtureMode = 'hold'; return exercise(accounts.normal.accountId, 'timed_out', undefined, second); });
    await runCase('running_cancel', async () => {
      fixtureMode = 'hold'; const baseline = await metrics(); const calls = countRequests();
      const queued = await startTest(accounts.normal.accountId);
      const pending = command(first);
      await waitFor('running_probe', () => getTest(queued.testId), (item) => item.status === 'running' && countRequests() > calls);
      const cancelAt = Date.now();
      const requested = await http(`/provider/connection-tests/${queued.testId}`, { method: 'DELETE' });
      assert.equal(requested.status, 'cancel_requested');
      const result = await terminal(queued.testId, 20_000);
      const elapsedMs = Date.now() - cancelAt;
      const executed = await pending;
      const facts = { testId: queued.testId, workerPid: first.pid, status: result.status, elapsedMs, upstreamCalls: countRequests() - calls, openResponsesAtTerminal: sockets.size, finishAudits: (await connectionAudit(queued.testId)).length };
      facts.isolatedStoresUnchanged = JSON.stringify(await metrics()) === JSON.stringify(baseline);
      try {
        assert.equal(facts.isolatedStoresUnchanged, true); await checkPrivate(result);
        assert.equal(facts.upstreamCalls, 1); assert.equal(facts.finishAudits, 1);
        const terminalCalls = countRequests(); await command(second);
        assert.equal(countRequests(), terminalCalls, 'request_after_terminal');
        assert.equal(result.status, 'cancelled'); assert.equal(executed?.testId, queued.testId);
        assert.ok(elapsedMs < 7_000, `running_cancel_not_prompt:${elapsedMs}ms`);
        assert.equal(facts.openResponsesAtTerminal, 0, 'upstream_request_remained_open');
      } catch (error) { error.facts = facts; throw error; }
      return facts;
    });
    await runCase('two_workers_restart_terminal_unique', async () => {
      fixtureMode = 'hold'; const baseline = await metrics(); const calls = countRequests();
      const queued = await startTest(accounts.normal.accountId);
      const pending = command(first).catch(() => null);
      await waitFor('restart_probe_sent', () => getTest(queued.testId), (item) => item.status === 'running' && countRequests() > calls);
      await stopWorker(first, 'SIGKILL'); await pending;
      await pool.query("UPDATE connection_tests SET lease_until=now()-interval '1 second' WHERE test_id=$1 AND state='running'", [queued.testId]);
      fixtureMode = 'success';
      const [one, two] = await Promise.all([command(second), startWorker().then(async (replacement) => ({ replacement, value: await command(replacement) }))]);
      const result = await terminal(queued.testId); const audit = await connectionAudit(queued.testId);
      const facts = { testId: queued.testId, deadPid: first.pid, survivingPid: second.pid, replacementPid: two.replacement.pid, status: result.status, attempts: (await pool.query('SELECT attempts FROM connection_tests WHERE test_id=$1', [queued.testId])).rows[0].attempts, upstreamCalls: countRequests() - calls, finishAudits: audit.length, workerClaims: [one?.testId ?? null, two.value?.testId ?? null] };
      assert.equal(result.status, 'succeeded'); assert.equal(facts.attempts, 2);
      assert.equal(facts.finishAudits, 1); assert.equal(facts.upstreamCalls, 2);
      assert.equal(facts.workerClaims.filter(Boolean).length, 1);
      assert.deepEqual(await metrics(), baseline); await checkPrivate(result);
      const laterCalls = countRequests(); await command(second); await command(two.replacement);
      assert.equal(countRequests(), laterCalls, 'request_after_terminal');
      assert.equal((await connectionAudit(queued.testId)).length, 1);
      return facts;
    });
    report.status = report.cases.some((item) => item.result === 'failed') ? 'failed' : 'passed';
  } catch (error) {
    report.status = 'failed'; report.failure = { phase, message: String(error.message).replaceAll(token, '<redacted>') };
    log(`FATAL ${phase} ${report.failure.message}`); console.error(`FATAL ${phase}: ${report.failure.message}`);
  } finally {
    for (const worker of [...workers]) await stopWorker(worker, 'SIGKILL').catch(() => {});
    await api?.close().catch(() => {});
    for (const server of [tls, badTls]) if (server) { server.closeAllConnections(); await new Promise((done) => server.close(done)); }
    await redis?.quit().catch(() => {});
    await pool?.end().catch(() => {});
    if (created) {
      await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [database]).catch(() => {});
      await admin.query(`DROP DATABASE ${database}`).catch((error) => { report.cleanupError = `database:${error.code}`; });
    }
    await admin?.end().catch(() => {});
    if (previousDatabaseUrl === undefined) delete process.env.DGOS_DATABASE_URL; else process.env.DGOS_DATABASE_URL = previousDatabaseUrl;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    // Only the unique I prefix is scanned and deleted; Redis DB5 is shared.
    try {
      const cleanupRedis = createClient({ url: redisUrl }); cleanupRedis.on('error', () => {}); await cleanupRedis.connect();
      let cursor = '0'; let removed = 0;
      do { const page = await cleanupRedis.scan(cursor, { MATCH: `${prefix}:*`, COUNT: 100 }); cursor = String(page.cursor); if (page.keys.length) { removed += page.keys.length; await cleanupRedis.del(page.keys); } } while (cursor !== '0');
      report.redisKeysRemoved = removed; await cleanupRedis.quit();
    } catch (error) { report.cleanupError = `${report.cleanupError ?? ''} redis:${error.code ?? error.name}`; }
    await rm(root, { recursive: true, force: true });
    report.finishedAt = new Date().toISOString(); report.sourceBefore = before; report.sourceAfter = await sourceHashes();
    report.sourceStable = JSON.stringify(before) === JSON.stringify(report.sourceAfter);
    if (!report.sourceStable) report.status = 'failed';
    if (report.cleanupError) report.status = 'failed';
    await mkdir(evidenceDir, { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    await writeFile(logPath, `${lines.join('\n')}\n`, { flag: 'wx' });
    await writeFile(manifestPath, `${JSON.stringify({ runId, status: report.status, reportPath, logPath, reportSha256: hash(await readFile(reportPath)), logSha256: hash(await readFile(logPath)), sourceBefore: before, sourceAfter: report.sourceAfter, sourceStable: report.sourceStable, migrations: report.migrations, limitations: report.limitations }, null, 2)}\n`, { flag: 'wx' });
    console.log(JSON.stringify({ status: report.status, cases: report.cases.length, reportPath, logPath, manifestPath }));
    if (report.status !== 'passed') process.exitCode = 1;
  }
}
