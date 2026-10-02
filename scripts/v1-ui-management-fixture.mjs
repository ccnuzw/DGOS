import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import { execFileSync, fork, spawn } from 'node:child_process';
import { createServer } from 'node:https';
import { connect } from 'node:net';
import { mkdir, open, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import pg from '../apps/api/node_modules/pg/lib/index.js';
import { createClient } from '../apps/api/node_modules/redis/dist/index.js';
import { buildServer } from '../apps/api/src/server.mjs';
import { createPostgresWorker } from '../apps/worker/src/worker.mjs';
import { ExtensionRunDaemon } from '../apps/extension-runner/src/daemon.mjs';
import { ExtensionService } from '../src/extensions/service.mjs';
import { PostgresExtensionRepository } from '../src/extensions/repository.mjs';
import { PostgresExtensionManagementRepository } from '../src/extensions/management-repository.mjs';
import { loadExtensionRuntime } from '../src/extensions/runtime.mjs';
import { PostgresPackageRepository } from '../src/apps/postgres-package-repository.mjs';
import { PostgresAuditRepository } from '../src/audit/outbox.mjs';
import { DiskPackageStore, canonicalJson } from '../src/apps/package-service.mjs';
import { ProviderEgress } from '../src/security/provider-egress.mjs';
import { createNetworkRouteFactory } from '../src/security/network-route.mjs';
import { RedisSecretService } from '../src/security/secret-service.mjs';
import { discoverMigrations, buildMigrationSql } from './migrate.mjs';

const root = resolve(new URL('..', import.meta.url).pathname);
const privateDir = join(root, 'data/v1-ui-management-fixture');
const stateFile = join(privateDir, 'state.json');
const adminUrl = new URL('postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_provider');
const redisUrl = 'redis://127.0.0.1:6379/5';
const apiPort = 15175, webPort = 15176, tlsPort = 15177;
const hosts = ['provider.fixture.test', 'extension.fixture.test'];
const sha = (value) => createHash('sha256').update(value).digest('hex');
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
const portInUse = (port) => new Promise((done) => {
  const socket = connect({ host: '127.0.0.1', port });
  socket.setTimeout(1000);
  socket.once('connect', () => { socket.destroy(); done(true); });
  socket.once('error', () => done(false));
  socket.once('timeout', () => { socket.destroy(); done(true); });
});
const routeFor = (secret, ca) => createNetworkRouteFactory({ egress: new ProviderEgress({ internalHosts: hosts, lookup: async () => [{ address: '127.0.0.1' }], ca }), secretService: secret, allowLocalFixture: true, fixtureLookup: async () => [{ address: '127.0.0.1' }], fixtureCa: ca });

if (process.argv.includes('--stop')) {
  const state = JSON.parse(await readFile(stateFile, 'utf8'));
  assert.match(state.database, /^dgos_v1_ui_management_([0-9a-f]{32})$/);
  assert.equal(state.namespace, `v1-ui-management:${state.database.slice(-32)}`);
  const command = execFileSync('ps', ['-p', String(state.pid), '-o', 'command='], { encoding: 'utf8' });
  if (!command.includes('v1-ui-management-fixture.mjs')) throw new Error('fixture_owner_pid_mismatch');
  if (state.attachedWorkerPid) {
    const attachedCommand = execFileSync('ps', ['-p', String(state.attachedWorkerPid), '-o', 'command='], { encoding: 'utf8' });
    if (!attachedCommand.includes('v1-ui-management-fixture.mjs --worker-attach')) throw new Error('fixture_attached_worker_pid_mismatch');
    process.kill(state.attachedWorkerPid, 'SIGTERM');
    for (let i = 0; i < 50; i++) {
      try { process.kill(state.attachedWorkerPid, 0); } catch (error) { if (error.code === 'ESRCH') break; throw error; }
      await delay(100);
    }
  }
  process.kill(state.pid, 'SIGTERM');
  for (let i = 0; i < 100; i++) { try { await readFile(stateFile); } catch { console.log('Fixture stopped and state removed.'); process.exit(0); } await delay(100); }
  try { process.kill(state.pid, 0); throw new Error('fixture_cleanup_timeout_owner_still_running'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  const redis = createClient({ url: redisUrl }); redis.on('error', () => {}); await redis.connect();
  try {
    const keys = new Set();
    for await (const batch of redis.scanIterator({ MATCH: `${state.namespace}:*`, COUNT: 100 })) {
      for (const key of Array.isArray(batch) ? batch : [batch]) if (typeof key === 'string' && key.startsWith(`${state.namespace}:`)) keys.add(key);
    }
    if (keys.size) await redis.del([...keys]);
  } finally { await redis.quit(); }
  const admin = new pg.Pool({ connectionString: adminUrl.href });
  try { await admin.query(`DROP DATABASE IF EXISTS ${state.database}`); } finally { await admin.end(); }
  await rm(join(privateDir, state.database.slice(-32)), { recursive: true, force: true });
  await rm(stateFile, { force: true });
  console.log('Fixture stopped; stale scoped state recovered.');
  process.exit(0);
}

if (process.argv.includes('--worker-attach')) {
  const state = JSON.parse(await readFile(stateFile, 'utf8'));
  assert.match(state.database, /^dgos_v1_ui_management_[0-9a-f]{32}$/);
  assert.equal(state.namespace, `v1-ui-management:${state.database.slice(-32)}`);
  const parentCommand = execFileSync('ps', ['-p', String(state.pid), '-o', 'command='], { encoding: 'utf8' });
  if (!parentCommand.includes('v1-ui-management-fixture.mjs')) throw new Error('fixture_owner_pid_mismatch');
  if (state.workerPid) {
    try { process.kill(state.workerPid, 0); throw new Error('fixture_original_worker_still_running'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  const childUrl = new URL(adminUrl); childUrl.pathname = `/${state.database}`;
  process.env.DGOS_UI_FIXTURE_DATABASE_URL = childUrl.href;
  process.env.DGOS_UI_FIXTURE_REDIS_URL = redisUrl;
  process.env.DGOS_UI_FIXTURE_NAMESPACE = state.namespace;
  process.env.DGOS_UI_FIXTURE_CA_FILE = join(privateDir, state.database.slice(-32), 'cert.pem');
  process.env.DGOS_UI_FIXTURE_CONFIG_FILE = join(privateDir, state.database.slice(-32), 'extensions.json');
  process.env.NODE_ENV = 'test';
}

if (process.argv.includes('--worker') || process.argv.includes('--worker-attach')) {
  const childUrl = new URL(process.env.DGOS_UI_FIXTURE_DATABASE_URL ?? '');
  assert.match(childUrl.pathname, /^\/dgos_v1_ui_management_[0-9a-f]{32}$/);
  assert.equal(new URL(process.env.DGOS_UI_FIXTURE_REDIS_URL).pathname, '/5');
  const redis = createClient({ url: process.env.DGOS_UI_FIXTURE_REDIS_URL }); redis.on('error', () => {}); await redis.connect();
  const secret = new RedisSecretService(redis, { keyPrefix: `${process.env.DGOS_UI_FIXTURE_NAMESPACE}:secret:` });
  const ca = await readFile(process.env.DGOS_UI_FIXTURE_CA_FILE);
  const route = routeFor(secret, ca);
  const runtime = createPostgresWorker({ env: { DGOS_DATABASE_URL: childUrl.href }, secretService: secret, networkOptions: { route } });
  await runtime.actionRuntime.ready;
  await runtime.actionRuntime.system.activateNetworkRoute(route, { role: 'worker', instanceId: runtime.worker.workerId, leaseMs: 30000 });
  const heartbeat = setInterval(() => runtime.actionRuntime.system.renewNetworkRoute(route, { role: 'worker', instanceId: runtime.worker.workerId, leaseMs: 30000 }).catch(() => {}), 5000);
  const audit = new PostgresAuditRepository(runtime.pool);
  const options = await loadExtensionRuntime({ configPath: process.env.DGOS_UI_FIXTURE_CONFIG_FILE, packageRepository: new PostgresPackageRepository(runtime.pool), pool: runtime.pool, audit, permissions: runtime.actionRuntime.permissions, secretService: secret, networkRoute: route, networkFixtureHosts: hosts });
  const extensions = new ExtensionService({ ...options, repository: new PostgresExtensionRepository(runtime.pool), managementRepository: new PostgresExtensionManagementRepository(runtime.pool, audit), aiTasks: runtime.taskService });
  const daemon = new ExtensionRunDaemon({ service: extensions, onError: (error) => process.send?.({ workerError: error.message }) });
  runtime.actionRuntime.worker.start();
  let busy = false;
  const loop = setInterval(async () => { if (busy) return; busy = true; try { await runtime.providerTestWorker.runOnce(); await runtime.worker.runOnce(); await daemon.tick(); } catch (error) { process.send?.({ workerError: error.message }); } finally { busy = false; } }, 200);
  process.send?.({ ready: true, pid: process.pid });
  if (process.argv.includes('--worker-attach')) {
    const state = JSON.parse(await readFile(stateFile, 'utf8'));
    state.attachedWorkerPid = process.pid;
    await writeFile(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ status: 'worker_ready', pid: process.pid, database: state.database, actionWorker: true }));
  }
  process.on('SIGTERM', async () => { clearInterval(loop); clearInterval(heartbeat); while (busy) await delay(20); await runtime.actionRuntime.worker.stop(); await daemon.stop(); await runtime.actionRuntime.system.releaseNetworkRoute(runtime.worker.workerId).catch(() => {}); await runtime.pool.end(); await redis.quit(); process.exit(0); });
} else {
  if (process.env.NODE_ENV === 'production') throw new Error('test_fixture_only');
  const suffix = randomBytes(16).toString('hex');
  const database = `dgos_v1_ui_management_${suffix}`;
  const databaseUrl = new URL(adminUrl); databaseUrl.pathname = `/${database}`;
  const namespace = `v1-ui-management:${suffix}`;
  const fixtureDir = join(privateDir, suffix);
  let admin, pool, redis, api, tls, worker, web, created = false, cleaning = false, ownedState = false, session;
  const providerToken = `fixture-${randomUUID()}`;
  const mcpCredential = 'fixture-secret';
  const adminCredential = `fixture-admin-${randomUUID()}`;
  const mcpId = `mcp_${suffix}`;
  const mcpSource = `system:ui_management_${suffix}`;
  const appId = `com.example.uimanagement${suffix}`;
  const appKeys = generateKeyPairSync('ed25519');
  const profile = { schemaVersion: 'dgos-capability/v1', kind: 'model', id: `fixture.ui.${suffix}`, version: '1.0.0', executor: { type: 'declarative', engine: 'dgos-text-v1' }, capabilities: ['text.chat'], operations: { submit: { profile: 'responses', method: 'POST', path: '/responses' } }, workflows: { 'text.chat': { submit: 'submit' } }, defaults: { temperature: 0.4 }, limits: { maxInputCharacters: 8192, maxOutputTokens: 128 }, uiSchemas: { parameters: ['temperature', 'maxOutputTokens'] }, modelProfiles: { exact: { modelNames: ['fixture-model'], workflow: 'text.chat' } }, assets: {} };
  const endpoint = `https://provider.fixture.test:${tlsPort}/v1`;
  const http = async (path, { method = 'GET', body, status = 200 } = {}) => {
    const response = await fetch(`http://127.0.0.1:${apiPort}/api/v1${path}`, { method, headers: { ...(session ? { authorization: `Bearer ${session}` } : {}), ...(body ? { 'content-type': 'application/json', 'x-dgos-csrf': 'ui-management' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
    const value = await response.json().catch(() => ({}));
    assert.equal(response.status, status, `${method} ${path}: ${response.status} ${value.errorKey ?? ''}`);
    return value;
  };
  const post = (path, body, status = 200) => http(path, { method: 'POST', body, status });
  const permission = (targetApp, capability, scope = '*') => http('/permissions', { method: 'PATCH', body: { requestId: randomUUID(), appId: targetApp, capability, scope, decision: 'allow' } });
  const waitFor = async (read, accept, label) => { for (let i = 0; i < 100; i++) { const value = await read(); if (accept(value)) return value; await delay(100); } throw new Error(`${label}_timeout`); };
  const stopChild = async (child) => { if (!child || child.exitCode !== null || child.signalCode) return; child.kill('SIGTERM'); await Promise.race([new Promise((done) => child.once('exit', done)), delay(5000).then(() => { child.kill('SIGKILL'); })]); };
  const cleanup = async () => {
    if (cleaning || !ownedState) return; cleaning = true;
    await stopChild(web); await stopChild(worker);
    await api?.close().catch(() => {});
    if (tls) { tls.closeAllConnections(); await new Promise((done) => tls.close(done)); }
    if (redis?.isOpen) {
      const keys = new Set();
      for await (const batch of redis.scanIterator({ MATCH: `${namespace}:*`, COUNT: 100 })) {
        for (const key of Array.isArray(batch) ? batch : [batch]) if (typeof key === 'string' && key.startsWith(`${namespace}:`)) keys.add(key);
      }
      if (keys.size) await redis.del([...keys]);
      await redis.quit();
    }
    await pool?.end().catch(() => {});
    if (created) await admin.query(`DROP DATABASE IF EXISTS ${database}`);
    await admin?.end();
    await rm(fixtureDir, { recursive: true, force: true });
    await rm(stateFile, { force: true });
    console.log('CLEANUP complete');
  };
  process.once('SIGINT', () => void cleanup().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); }));
  process.once('SIGTERM', () => void cleanup().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); }));
  try {
    await mkdir(privateDir, { recursive: true, mode: 0o700 });
    const lock = await open(stateFile, 'wx', 0o600);
    ownedState = true;
    try { await lock.writeFile(JSON.stringify({ pid: process.pid, status: 'starting' })); } finally { await lock.close(); }
    for (const port of [apiPort, webPort, tlsPort]) if (await portInUse(port)) throw new Error(`fixture_port_${port}_in_use`);
    await mkdir(fixtureDir, { mode: 0o700 });
    admin = new pg.Pool({ connectionString: adminUrl.href });
    await admin.query(`CREATE DATABASE ${database}`); created = true;
    pool = new pg.Pool({ connectionString: databaseUrl.href });
    const migrations = (await discoverMigrations()).filter(({ version }) => Number(version.slice(0, 4)) <= 51);
    const frozen = { '0045-network-route-activation': 'c2bc2a47a3360e47b02d4edd9880b88694ec3ab84cdf7613674cd2099d40040d', '0046-package-retention': '7321916de0ddff31f40d48b837acada75d8ec893691c7c65f22d0b707d6a9a83', '0047-ai-task-parameters': '22b6e9e886943f2b660de4d54989e0587c58cb67e373fbd45b7140849f6f15f6', '0048-network-route-fingerprint': '7879e6cf17753fa82254675756fbeb1fdfb9ad67e11808aec8922cd2f10cd33d', '0049-extension-management': 'ba0bc80a0ccc74e05a5244b50e52e6a26df39ad854995ba038020b7d5d954f1b', '0050-session-management': '8802fe3a02b0bf7364aeac96215da09454d0c53b48c06d2cb76c6f3d6b455d85', '0051-proxy-provisioning': '778fddef654d67bc3ecfc01e11fd91f826f91d68a5b6c5c72568b5e35cca1939' };
    for (const [version, checksum] of Object.entries(frozen)) assert.equal(migrations.find((item) => item.version === version)?.checksum, checksum);
    await pool.query(buildMigrationSql(migrations));
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(fixtureDir, 'key.pem'), '-out', join(fixtureDir, 'cert.pem'), '-days', '1', '-subj', '/CN=provider.fixture.test', '-addext', 'subjectAltName=DNS:provider.fixture.test,DNS:extension.fixture.test'], { stdio: 'ignore' });
    const ca = await readFile(join(fixtureDir, 'cert.pem'));
    tls = createServer({ key: await readFile(join(fixtureDir, 'key.pem')), cert: ca }, async (request, response) => {
      if (request.headers.authorization !== `Bearer ${providerToken}`) { response.writeHead(401).end(); return; }
      if (request.url === '/v1/models') { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ data: [{ id: 'fixture-model', name: 'Fixture model' }] })); return; }
      if (request.url === '/v1/responses') { let body = ''; for await (const chunk of request) body += chunk; const match = /\n(\{.*\})$/s.exec(JSON.parse(body).input); const source = match ? JSON.parse(match[1]) : null; const text = source ? JSON.stringify(Object.fromEntries(Object.entries(source).map(([key, value]) => [key, `${value} translated`]))) : 'fixture answer'; response.setHeader('content-type', 'text/event-stream'); response.end(`data: ${JSON.stringify({ type: 'response.output_text.delta', delta: text })}\n\ndata: {"type":"response.completed"}\n\n`); return; }
      response.writeHead(404).end();
    });
    await new Promise((done, fail) => tls.once('error', fail).listen(tlsPort, '127.0.0.1', done));
    const config = JSON.parse(await readFile(join(root, 'src/extensions/v1-default-runtime.json'), 'utf8'));
    config.sources.push({ source: mcpSource, trustState: 'trusted', manifest: { kind: 'mcp', id: mcpId, version: '1.0.0', requiresCredential: true, operations: ['echo', 'credential'].map((operationId) => ({ operationId, permission: 'mcp.tool.invoke', risk: 'low', sideEffects: false, inputSchema: { type: 'object', properties: {} } })) } });
    config.runnerProfiles.ui_management = { command: process.execPath, cwd: join(root, 'tests/extensions'), args: [join(root, 'tests/extensions/stdio-mcp-fixture.mjs')], sandbox: process.platform === 'darwin' ? 'macos-restricted' : 'linux-bwrap', timeoutMs: 4000, credentialEnv: { apiKey: 'DGOS_MCP_TEST_CREDENTIAL' } };
    config.mcpTemplates = [{ templateId: 'ui_management', version: '1.0.0', source: mcpSource, name: 'UI management fixture MCP', config: { transport: 'stdio', runnerProfileId: 'ui_management' }, credentialFields: [{ name: 'apiKey', label: 'API key', required: true }] }];
    await writeFile(join(fixtureDir, 'extensions.json'), JSON.stringify(config), { mode: 0o600 });
    redis = createClient({ url: redisUrl }); redis.on('error', () => {}); await redis.connect();
    const secret = new RedisSecretService(redis, { keyPrefix: `${namespace}:secret:` });
    process.env.DGOS_DATABASE_URL = databaseUrl.href; process.env.NODE_ENV = 'test'; process.env.DGOS_ALLOWED_ORIGINS = `http://127.0.0.1:${webPort}`;
    api = buildServer({ logger: false, closeDatabasePools: true, secretService: secret, providerEgress: new ProviderEgress({ internalHosts: hosts, lookup: async () => [{ address: '127.0.0.1' }], ca }), networkOptions: { allowLocalFixture: true, fixtureLookup: async () => [{ address: '127.0.0.1' }], ca, fixtureHosts: hosts }, transportOptions: { nativeLocalOrigin: `http://127.0.0.1:${apiPort}` }, packageOptions: { store: new DiskPackageStore(join(fixtureDir, 'packages')), trustRoots: new Map([['ui-management', { source: 'official', publicKey: appKeys.publicKey }]]) }, extensionOptions: { configPath: join(fixtureDir, 'extensions.json') } });
    await api.listen({ host: '127.0.0.1', port: apiPort });
    worker = fork(new URL(import.meta.url), ['--worker'], { env: { ...process.env, DGOS_UI_FIXTURE_DATABASE_URL: databaseUrl.href, DGOS_UI_FIXTURE_REDIS_URL: redisUrl, DGOS_UI_FIXTURE_NAMESPACE: namespace, DGOS_UI_FIXTURE_CA_FILE: join(fixtureDir, 'cert.pem'), DGOS_UI_FIXTURE_CONFIG_FILE: join(fixtureDir, 'extensions.json') }, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    await Promise.race([new Promise((done, fail) => { worker.on('message', (value) => value.ready && done()); worker.once('exit', (code) => fail(new Error(`worker_exit_${code}`))); }), delay(15000).then(() => { throw new Error('worker_start_timeout'); })]);
    const boot = await post('/identity/admin/bootstrap', { displayName: 'UI management fixture', credential: adminCredential }, 201); session = boot.sessionId;
    const validated = await post('/provider/capability-protocols', { requestId: randomUUID(), declaration: profile });
    const publishRequestId = randomUUID();
    const ticket = await post('/provider/capability-protocols/confirmations', { requestId: publishRequestId, operation: 'provider.protocol.publish', protocolId: profile.id, version: profile.version, declaration: profile, validationDigest: validated.digest }, 201);
    await post(`/provider/capability-protocols/${profile.id}/versions`, { requestId: publishRequestId, declaration: profile, validationDigest: validated.digest, confirmationId: ticket.confirmationId }, 201);
    const account = await post('/provider/accounts', { requestId: randomUUID(), protocolType: 'openai-compatible', displayName: 'UI fixture Provider', credential: providerToken, scope: { endpoint } }, 201);
    const connection = await post('/provider/connection-tests', { requestId: randomUUID(), accountId: account.accountId, protocolVersion: 'v1' }, 202);
    await waitFor(() => http(`/provider/connection-tests/${connection.testId}`), (value) => value.status === 'succeeded', 'provider_connection');
    await post(`/provider/accounts/${account.accountId}/state`, { requestId: randomUUID(), baseVersion: account.version, state: 'ready', connectionTestId: connection.testId });
    const provider = await post('/provider/configs', { requestId: randomUUID(), providerAccountId: account.accountId, protocolType: 'openai-compatible', displayName: 'UI fixture Provider', baseUrl: endpoint, capabilityProtocolId: profile.id, capabilityProtocolVersion: profile.version }, 201);
    await post(`/provider/configs/${provider.id}/validate`, { requestId: randomUUID() });
    await post(`/provider/configs/${provider.id}/models`, { requestId: randomUUID() });
    await post(`/provider/configs/${provider.id}/model-policies`, { requestId: randomUUID(), modelId: 'fixture-model', enabled: true, assignedCapabilities: ['text'], defaultFor: [], baseVersion: '0' });
    await http('/quota/policies', { method: 'PUT', body: { requestId: randomUUID(), metric: 'requests', scopeType: 'subject', scopeId: boot.principalId, hardLimit: 1000, softLimit: 1000, windowSeconds: 3600, effectiveAt: new Date().toISOString() } });
    for (const capability of ['skill.install', 'skill.manage', 'skill.read', 'skill.execute', 'mcp.install', 'mcp.manage', 'mcp.read', 'mcp.connect', 'mcp.execute', 'extension.run.read']) await permission('dgos.extensions', capability);
    const html = Buffer.from('<html><body>UI fixture caller</body></html>'), icon = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const manifest = { format: 'dgos-app/v1', appId, version: '1.0.0', build: 1, releaseChannel: 'stable', minRuntimeVersion: '1.0.0', dataVersion: 1, name: { 'zh-CN': 'UI fixture', 'en-US': 'UI fixture' }, description: { 'zh-CN': 'Fixture', 'en-US': 'Fixture' }, category: 'productivity', icon: 'icon.svg', defaultWindow: { width: 800, height: 600 }, entrypoints: { web: 'index.html' }, permissions: ['mcp.tool.invoke'], capabilityAllowlist: ['mcp.tool.invoke'], dependencies: { apps: [], skills: [], mcp: [{ sourceId: mcpId, version: '1.0.0', operationIds: ['credential', 'echo'] }] }, trustLevel: 'standard', uninstallPolicy: 'user-removable', backgroundPolicy: 'release' };
    const resourceDigests = { 'index.html': `sha256:${sha(html)}`, 'icon.svg': `sha256:${sha(icon)}` };
    await post('/apps', { requestId: randomUUID(), manifest, files: { 'index.html': html.toString('base64'), 'icon.svg': icon.toString('base64') }, resourceDigests, keyId: 'ui-management', signature: sign(null, Buffer.from(canonicalJson({ manifest, resourceDigests })), appKeys.privateKey).toString('base64') }, 201);
    await post(`/apps/${appId}/install`, { requestId: randomUUID(), version: '1.0.0', build: 1, releaseChannel: 'stable' });
    await permission(appId, 'mcp.tool.invoke', `mcp:${mcpId}:credential`);
    assert.ok((await http('/mcp/templates')).items.some((item) => item.templateId === 'ui_management' && item.setupState === 'needs-credentials'));
    web = spawn(process.execPath, [join(root, 'apps/web/scripts/serve.mjs')], { cwd: root, env: { ...process.env, HOST: '127.0.0.1', PORT: String(webPort), API_BASE_URL: `http://127.0.0.1:${apiPort}` }, stdio: ['ignore', 'inherit', 'inherit'] });
    await waitFor(async () => fetch(`http://127.0.0.1:${webPort}/`).then((response) => response.status).catch(() => 0), (status) => status === 200, 'web');
    const distHash = sha(await readFile(join(root, 'apps/web/dist/index.html')));
    const state = { pid: process.pid, workerPid: worker.pid, webPid: web.pid, database, namespace, redisDb: 5, api: `http://127.0.0.1:${apiPort}`, web: `http://127.0.0.1:${webPort}`, tlsPort, principalId: boot.principalId, providerConfigId: provider.id, modelId: 'fixture-model', mcpTemplateId: 'ui_management', mcpSource, mcpId, appId, distIndexSha256: distHash, privateCredentialsFile: join(fixtureDir, 'credentials.json') };
    await writeFile(state.privateCredentialsFile, JSON.stringify({ adminCredential, mcpCredential, sessionId: session, providerToken }, null, 2), { mode: 0o600 });
    await writeFile(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ status: 'ready', ...state }, null, 2));
    await new Promise(() => {});
  } catch (error) { console.error(`Fixture startup failed: ${error.stack ?? error}`); await cleanup(); process.exitCode = 1; }
}
