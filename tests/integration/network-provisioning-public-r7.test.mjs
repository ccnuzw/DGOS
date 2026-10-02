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
import { ProviderEgress } from '../../src/security/provider-egress.mjs';
import { InMemorySecretService } from '../../src/security/secret-service.mjs';
import { discoverMigrations, buildMigrationSql } from '../../scripts/migrate.mjs';

const database = process.env.DGOS_DATABASE_URL;
const isolated = (() => { try { return /^(?:dgos_v1_network_[0-9a-f]+|dgos_v1_verify_[0-9a-f]{32})$/.test(new URL(database).pathname.slice(1)); } catch { return false; } })();
const listen = (server, port) => new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const close = (server) => new Promise((resolve) => server.close(resolve));

test('public provisioning, network PATCH and API restart activate the CONNECT route', { skip: !isolated && 'isolated network database required', timeout: 30_000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dgos-proxy-public-r7-'));
  const oldDatabase = process.env.DGOS_DATABASE_URL;
  const oldPackageRoot = process.env.DGOS_PACKAGE_ROOT;
  const oldTrustRoots = process.env.DGOS_PACKAGE_TRUST_ROOTS_FILE;
  process.env.DGOS_PACKAGE_ROOT = path.join(root, 'packages');
  process.env.DGOS_PACKAGE_TRUST_ROOTS_FILE = path.join(root, 'trust-roots.json');
  await writeFile(process.env.DGOS_PACKAGE_TRUST_ROOTS_FILE, '[]');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-noenc', '-keyout', path.join(root, 'key.pem'), '-out', path.join(root, 'cert.pem'), '-days', '1', '-subj', '/CN=target.test', '-addext', 'subjectAltName=DNS:target.test'], { stdio: 'ignore' });
  const ca = await readFile(path.join(root, 'cert.pem'));
  const target = https.createServer({ key: await readFile(path.join(root, 'key.pem')), cert: ca }, (_request, response) => { response.end('routed'); });
  const sockets = new Set(); const tunnels = [];
  const proxy = net.createServer((client) => {
    sockets.add(client); client.once('close', () => sockets.delete(client));
    let data = Buffer.alloc(0);
    const parse = (chunk) => {
      data = Buffer.concat([data, chunk]); const end = data.indexOf('\r\n\r\n'); if (end < 0) return;
      client.off('data', parse);
      const head = data.subarray(0, end).toString('latin1');
      tunnels.push({ authority: /^CONNECT (\S+) HTTP\//.exec(head)?.[1], auth: /proxy-authorization: ([^\r\n]+)/i.exec(head)?.[1] });
      const upstream = net.connect(15187, '127.0.0.1', () => { client.write('HTTP/1.1 200 Connection Established\r\n\r\n'); client.pipe(upstream).pipe(client); });
      sockets.add(upstream); upstream.once('close', () => sockets.delete(upstream)); upstream.on('error', () => client.destroy()); client.on('error', () => upstream.destroy());
    };
    client.on('data', parse);
  });
  const admin = new pg.Pool({ connectionString: database });
  const name = `dgos_v1_network_${randomBytes(6).toString('hex')}`;
  await admin.query(`CREATE DATABASE ${name}`);
  const childUrl = new URL(database); childUrl.pathname = `/${name}`;
  process.env.DGOS_DATABASE_URL = childUrl.toString();
  const pool = new pg.Pool({ connectionString: childUrl.toString() });
  pool.on('error', () => {});
  let first; let second;
  try {
    const migrations = (await discoverMigrations()).filter(({ version }) => Number(version.slice(0, 4)) <= 51);
    const expected = new Map([
      ['0049-extension-management', 'ba0bc80a0ccc74e05a5244b50e52e6a26df39ad854995ba038020b7d5d954f1b'],
      ['0050-session-management', '8802fe3a02b0bf7364aeac96215da09454d0c53b48c06d2cb76c6f3d6b455d85'],
      ['0051-proxy-provisioning', '778fddef654d67bc3ecfc01e11fd91f826f91d68a5b6c5c72568b5e35cca1939'],
    ]);
    for (const [version, checksum] of expected) assert.equal(migrations.find((item) => item.version === version)?.checksum, checksum);
    await pool.query(buildMigrationSql(migrations));
    await listen(target, 15187); await listen(proxy, 15186);
    const secret = new InMemorySecretService();
    const lookup = async () => [{ address: '127.0.0.1' }];
    const networkOptions = { allowLocalFixture: true, proxyLookup: lookup, ca };
    const transportOptions = { fixtureLocalOrigin: 'http://127.0.0.1:15185', allowInsecureFixture: true };
    const build = () => buildServer({ logger: false, secretService: secret, providerEgress: new ProviderEgress({ lookup, internalHosts: ['target.test'], ca }), dispatchTask: async () => {}, networkOptions, transportOptions });
    first = build(); await first.listen({ host: '127.0.0.1', port: 15185 });
    const base = 'http://127.0.0.1:15185';
    const send = async (method, route, body, cookie) => {
      const response = await fetch(base + route, { method, headers: { ...(cookie ? { cookie, origin: base, 'x-dgos-csrf': 'network' } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, headers: response.headers, body: await response.json() };
    };
    const bootstrap = await send('POST', '/api/v1/identity/admin/bootstrap', { displayName: 'Network', credential: 'network-admin-secret' });
    assert.equal(bootstrap.status, 201, JSON.stringify(bootstrap.body));
    const cookie = bootstrap.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie);
    const before = await send('GET', '/api/v1/system/settings', undefined, cookie);
    assert.equal(before.status, 200);
    const pendingRef = `proxy_${randomBytes(32).toString('base64url')}`;
    await secret.put({ secretRef: pendingRef, purpose: 'network-proxy', subjectId: 'system', value: JSON.stringify({ url: 'http://127.0.0.1:15186/' }), ttlMs: 60_000 });
    const rejected = await send('PATCH', '/api/v1/system/settings', { requestId: randomUUID(), baseVersion: before.body.settingsVersion, domain: 'network', patch: { proxyMode: 'manual', manualProxyRef: pendingRef } }, cookie);
    assert.equal(rejected.status, 503);
    const input = { requestId: randomUUID(), displayName: 'Local fixture proxy', endpoint: 'http://127.0.0.1:15186/', username: 'operator', password: 'private-pass' };
    const provisioned = await send('POST', '/api/v1/system/network/proxy-configurations', input, cookie);
    assert.equal(provisioned.status, 201, JSON.stringify(provisioned.body));
    assert.equal(provisioned.headers.get('cache-control'), 'no-store');
    assert.equal(provisioned.body.status, 'stored');
    assert.equal(provisioned.body.credentialStatus, 'configured');
    assert.doesNotMatch(JSON.stringify(provisioned.body), /private-pass|15186/);
    assert.equal((await send('GET', '/api/v1/system/settings', undefined, cookie)).body.settingsVersion, before.body.settingsVersion);
    assert.equal(first.networkRoute.active().effectiveRoute, 'direct');
    assert.equal(tunnels.length, 0);
    const replay = await send('POST', '/api/v1/system/network/proxy-configurations', input, cookie);
    assert.equal(replay.status, 201); assert.deepEqual(replay.body, provisioned.body);
    const changed = await send('PATCH', '/api/v1/system/settings', { requestId: randomUUID(), baseVersion: before.body.settingsVersion, domain: 'network', patch: { proxyMode: 'manual', manualProxyRef: provisioned.body.manualProxyRef } }, cookie);
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    assert.equal(changed.body.network.restartRequired, true);
    assert.equal(first.networkRoute.active().effectiveRoute, 'direct');
    assert.equal(tunnels.length, 0);
    await first.close(); first = undefined;
    second = build(); await second.listen({ host: '127.0.0.1', port: 15185 });
    assert.equal(second.networkRoute.active().effectiveRoute, 'manual');
    assert.equal(await (await second.networkRoute.request({ url: 'https://target.test:15187/', timeoutMs: 3000 })).text(), 'routed');
    assert.deepEqual(tunnels, [{ authority: '127.0.0.1:15187', auth: 'Basic ' + Buffer.from('operator:private-pass').toString('base64') }]);
  } finally {
    await second?.close(); await first?.close();
    await pool.end(); await admin.query(`DROP DATABASE ${name} WITH (FORCE)`); await admin.end();
    for (const socket of sockets) socket.destroy(); target.closeAllConnections(); await close(proxy); await close(target);
    process.env.DGOS_DATABASE_URL = oldDatabase;
    if (oldPackageRoot === undefined) delete process.env.DGOS_PACKAGE_ROOT; else process.env.DGOS_PACKAGE_ROOT = oldPackageRoot;
    if (oldTrustRoots === undefined) delete process.env.DGOS_PACKAGE_TRUST_ROOTS_FILE; else process.env.DGOS_PACKAGE_TRUST_ROOTS_FILE = oldTrustRoots;
    await rm(root, { recursive: true, force: true });
  }
});
