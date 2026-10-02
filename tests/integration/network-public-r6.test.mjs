import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { buildServer } from '../../apps/api/src/server.mjs';
import { createPostgresWorker } from '../../apps/worker/src/worker.mjs';
import { ProviderEgress } from '../../src/security/provider-egress.mjs';
import { InMemorySecretService } from '../../src/security/secret-service.mjs';
import { createNetworkRouteFactory } from '../../src/security/network-route.mjs';
import { loadExtensionRuntime } from '../../src/extensions/runtime.mjs';
import { discoverMigrations, buildMigrationSql } from '../../scripts/migrate.mjs';

const dbUrl = process.env.DGOS_DATABASE_URL;
const isolated = (() => { try { return /^(?:dgos_v1_network_[0-9a-f]+|dgos_v1_verify_[0-9a-f]{32})$/.test(new URL(dbUrl).pathname.slice(1)); } catch { return false; } })();
const listen = (server, port) => new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const close = (server) => new Promise((resolve) => server.close(resolve));

test('public Provider API, Worker Task and MCP HTTP use the activated CONNECT route', { skip: !isolated && 'isolated network database required', timeout: 20_000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dgos-network-public-'));
  const previousPackageRoot = process.env.DGOS_PACKAGE_ROOT;
  const previousTrustFile = process.env.DGOS_PACKAGE_TRUST_ROOTS_FILE;
  process.env.DGOS_PACKAGE_ROOT = path.join(root, 'packages');
  process.env.DGOS_PACKAGE_TRUST_ROOTS_FILE = path.join(root, 'roots.json');
  await writeFile(process.env.DGOS_PACKAGE_TRUST_ROOTS_FILE, '[]');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-noenc', '-keyout', path.join(root, 'key.pem'), '-out', path.join(root, 'cert.pem'), '-days', '1', '-subj', '/CN=target.test', '-addext', 'subjectAltName=DNS:target.test'], { stdio: 'ignore' });
  const ca = await readFile(path.join(root, 'cert.pem'));
  const requests = []; const tunnels = []; const sockets = new Set();
  const target = https.createServer({ key: await readFile(path.join(root, 'key.pem')), cert: ca }, async (req, res) => {
    assert.equal(req.headers['proxy-authorization'], undefined);
    let body = ''; for await (const chunk of req) body += chunk;
    requests.push({ path: req.url, method: req.method, body });
    if (req.url === '/v1/models') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ data: [{ id: 'model-network', name: 'Network Fixture' }] })); return; }
    if (req.url === '/v1/chat/completions') { res.setHeader('content-type', 'text/event-stream'); res.end('data: {"choices":[{"delta":{"content":"routed"}}]}\n\ndata: [DONE]\n\n'); return; }
    if (req.url === '/mcp') { const input = JSON.parse(body); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ jsonrpc: '2.0', id: input.id, result: input.method === 'tools/list' ? { tools: [{ name: 'echo', inputSchema: { type: 'object' } }] } : input.method === 'tools/call' ? { structuredContent: { value: input.params.arguments.value } } : {} })); return; }
    res.writeHead(404).end();
  });
  const proxy = net.createServer((client) => {
    sockets.add(client); client.once('close', () => sockets.delete(client));
    let pending = Buffer.alloc(0);
    const parse = (chunk) => {
      pending = Buffer.concat([pending, chunk]); const end = pending.indexOf('\r\n\r\n'); if (end < 0) return;
      client.off('data', parse);
      const head = pending.subarray(0, end).toString('latin1');
      tunnels.push({ authority: /^CONNECT (\S+) HTTP\//.exec(head)?.[1], auth: /proxy-authorization: ([^\r\n]+)/i.exec(head)?.[1] });
      const upstream = net.connect(15183, '127.0.0.1', () => { client.write('HTTP/1.1 200 Connection Established\r\n\r\n'); const tail = pending.subarray(end + 4); if (tail.length) upstream.write(tail); client.pipe(upstream).pipe(client); });
      sockets.add(upstream); upstream.once('close', () => sockets.delete(upstream)); upstream.on('error', () => client.destroy()); client.on('error', () => upstream.destroy());
    };
    client.on('data', parse);
  });
  const admin = new pg.Pool({ connectionString: dbUrl });
  const databaseName = `dgos_v1_network_${randomBytes(6).toString('hex')}`;
  await admin.query(`CREATE DATABASE ${databaseName}`);
  const childUrl = new URL(dbUrl); childUrl.pathname = `/${databaseName}`;
  const previousDatabaseUrl = process.env.DGOS_DATABASE_URL;
  process.env.DGOS_DATABASE_URL = childUrl.toString();
  const pool = new pg.Pool({ connectionString: childUrl.toString() });
  const migrations = (await discoverMigrations()).filter(({ version }) => Number(version.slice(0, 4)) <= 48);
  await pool.query(buildMigrationSql(migrations));
  const secret = new InMemorySecretService();
  const lookup = async () => [{ address: '127.0.0.1' }];
  const egress = () => new ProviderEgress({ lookup, internalHosts: ['target.test'], ca });
  const route = () => createNetworkRouteFactory({ egress: egress(), secretService: secret, proxyLookup: lookup, ca, allowLocalFixture: true, fixtureLookup: lookup, fixtureCa: ca });
  const networkOptions = { allowLocalFixture: true, proxyLookup: lookup, ca, fixtureLookup: lookup, fixtureHosts: ['target.test'] };
  const build = () => buildServer({ logger: { level: 'error' }, secretService: secret, providerEgress: egress(), dispatchTask: async () => {}, networkOptions });
  const apiRequest = async (app, method, url, payload, headers = {}) => app.inject({ method, url, payload, headers });
  let first; let second; let mcp;
  try {
    await listen(target, 15183); await listen(proxy, 15184);
    await secret.put({ secretRef: 'network-public-proxy', value: JSON.stringify({ url: 'http://127.0.0.1:15184/', authorization: 'Basic Zml4dHVyZQ==' }), purpose: 'network-proxy', subjectId: 'system', ttlMs: 60_000 });
    first = build(); await first.ready();
    const bootstrap = await apiRequest(first, 'POST', '/api/v1/identity/admin/bootstrap', { displayName: 'Network', credential: 'network-admin-secret' });
    assert.equal(bootstrap.statusCode, 201, bootstrap.body);
    const ownerId = bootstrap.json().principalId;
    const auth = { authorization: `Bearer ${bootstrap.json().sessionId}`, 'x-dgos-csrf': 'network' };
    const initial = await apiRequest(first, 'GET', '/api/v1/system/settings', undefined, auth);
    const changed = await apiRequest(first, 'PATCH', '/api/v1/system/settings', { requestId: randomUUID(), baseVersion: initial.json().settingsVersion, domain: 'network', patch: { proxyMode: 'manual', manualProxyRef: 'network-public-proxy' } }, auth);
    assert.equal(changed.statusCode, 200, changed.body);
    assert.equal(changed.json().network.restartRequired, true);
    assert.equal(first.networkRoute.active().effectiveRoute, 'direct');
    assert.equal(tunnels.length, 0);
    await first.close(); first = null;
    second = build(); await second.ready();
    const worker = createPostgresWorker({ pool, env: { DGOS_DATABASE_URL: childUrl.toString() }, secretService: secret, networkOptions: { route: route() } });
    await worker.actionRuntime.ready;
    await worker.actionRuntime.system.activateNetworkRoute(worker.networkRoute, { role: 'worker', instanceId: worker.worker.workerId });
    assert.equal((await second.system.snapshot()).settings.network.restartRequired, false);

    const endpoint = 'https://target.test:15183/v1';
    const account = await apiRequest(second, 'POST', '/api/v1/provider/accounts', { protocolType: 'openai-compatible', displayName: 'Network Fixture', credential: 'fixture-provider-token', scope: { endpoint } }, auth);
    assert.equal(account.statusCode, 201, account.body);
    const config = await apiRequest(second, 'POST', '/api/v1/provider/configs', { requestId: randomUUID(), providerAccountId: account.json().accountId, protocolType: 'openai-compatible', displayName: 'Network Fixture', baseUrl: endpoint }, auth);
    assert.equal(config.statusCode, 201, config.body);
    const configId = config.json().id;
    const validated = await apiRequest(second, 'POST', `/api/v1/provider/configs/${configId}/validate`, { requestId: randomUUID() }, auth);
    assert.equal(validated.statusCode, 200, validated.body);
    const connection = await apiRequest(second, 'POST', '/api/v1/provider/connection-tests', { requestId: randomUUID(), accountId: account.json().accountId, protocolVersion: 'v1' }, auth);
    assert.equal(connection.statusCode, 202, connection.body);
    await worker.providerTestWorker.runOnce();
    const passed = await apiRequest(second, 'GET', `/api/v1/provider/connection-tests/${connection.json().testId}`, undefined, auth);
    assert.equal(passed.json().status, 'succeeded', passed.body);
    const ready = await apiRequest(second, 'POST', `/api/v1/provider/accounts/${account.json().accountId}/state`, { requestId: randomUUID(), baseVersion: account.json().version, state: 'ready', connectionTestId: connection.json().testId }, auth);
    assert.equal(ready.statusCode, 200, ready.body);
    const models = await apiRequest(second, 'POST', `/api/v1/provider/configs/${configId}/models`, { requestId: randomUUID() }, auth);
    assert.equal(models.statusCode, 200, models.body);
    const policy = await apiRequest(second, 'POST', `/api/v1/provider/configs/${configId}/model-policies`, { requestId: randomUUID(), modelId: 'model-network', enabled: true, assignedCapabilities: ['text'], defaultFor: [], baseVersion: '0' }, auth);
    assert.equal(policy.statusCode, 200, policy.body);
    const quotaPolicy = await apiRequest(second, 'PUT', '/api/v1/quota/policies', { requestId: randomUUID(), metric: 'requests', scopeType: 'subject', scopeId: ownerId, hardLimit: 20, softLimit: 18, windowSeconds: 3600, effectiveAt: new Date().toISOString() }, auth);
    assert.equal(quotaPolicy.statusCode, 200, quotaPolicy.body);
    const task = await apiRequest(second, 'POST', '/api/v1/ai-tasks', { requestId: randomUUID(), target: 'text', intent: 'text.chat', input: { text: 'hello' }, options: { providerConfigId: configId, modelId: 'model-network' } }, auth);
    assert.equal(task.statusCode, 202, task.body);
    await worker.worker.runOnce();
    const done = await apiRequest(second, 'GET', `/api/v1/ai-tasks/${task.json().taskId}`, undefined, auth);
    assert.equal(done.json().status, 'succeeded', done.body);
    assert.equal(done.json().text, 'routed');

    const configPath = path.join(root, 'mcp.json');
    await writeFile(configPath, JSON.stringify({ version: 1, sources: [{ source: 'system:network_mcp', trustState: 'trusted', manifest: { kind: 'mcp', id: 'network_mcp', version: '1.0.0', operations: [{ operationId: 'echo', permission: 'mcp.tool.invoke', risk: 'low', sideEffects: false, inputSchema: { type: 'object', required: ['value'], properties: { value: { type: 'string' } } } }] } }], runnerProfiles: {}, endpointProfiles: { network: { endpoint: 'https://target.test:15183/mcp', egressPolicyId: 'network-policy' } } }));
    const loaded = await loadExtensionRuntime({ configPath, networkRoute: worker.networkRoute, networkFixtureHosts: ['target.test'] });
    mcp = loaded.runner;
    const binding = { subjectId: ownerId, kind: 'mcp', extensionId: 'network_mcp', version: '1.0.0', config: { transport: 'streamable-http', endpointRef: 'network' } };
    const tools = await mcp.connect(binding);
    assert.equal(tools[0].name, 'echo');
    assert.deepEqual(await mcp.invoke({ ...binding, operationId: 'echo', input: { value: 'via-proxy' } }), { value: 'via-proxy' });
    await assert.rejects(() => worker.networkRoute.forEgress(new ProviderEgress({ allowHosts: ['target.test'], lookup, internalHosts: ['target.test'], ca })).request({ url: 'https://other.test/mcp' }), /policy_blocked/);
    assert.ok(tunnels.length >= 5);
    assert.ok(tunnels.every((entry) => entry.authority === '127.0.0.1:15183' && entry.auth === 'Basic Zml4dHVyZQ=='));
    assert.ok(requests.some((entry) => entry.path === '/v1/models'));
    assert.ok(requests.some((entry) => entry.path === '/v1/chat/completions'));
    assert.ok(requests.some((entry) => entry.path === '/mcp'));
    await secret.revoke('network-public-proxy');
    await assert.rejects(() => worker.networkRoute.request({ url: `${endpoint}/models` }), /credential_unavailable/);
    await worker.actionRuntime.system.releaseNetworkRoute(worker.worker.workerId);
  } finally {
    await mcp?.close(); await second?.close(); await first?.close(); await pool.end();
    await admin.query(`DROP DATABASE ${databaseName}`); await admin.end();
    for (const socket of sockets) socket.destroy(); target.closeAllConnections(); await close(proxy); await close(target);
    if (previousPackageRoot === undefined) delete process.env.DGOS_PACKAGE_ROOT; else process.env.DGOS_PACKAGE_ROOT = previousPackageRoot;
    if (previousTrustFile === undefined) delete process.env.DGOS_PACKAGE_TRUST_ROOTS_FILE; else process.env.DGOS_PACKAGE_TRUST_ROOTS_FILE = previousTrustFile;
    process.env.DGOS_DATABASE_URL = previousDatabaseUrl;
    await rm(root, { recursive: true, force: true });
  }
});
