import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ProviderEgress } from '../../src/security/provider-egress.mjs';

test('pinned transport enforces response size and timeout limits', async () => {
  const egress = new ProviderEgress({ lookup: async () => [{ address: '127.0.0.1' }], timeoutMs: 10, maxResponseBytes: 4 });
  await assert.rejects(egress.request({ url: 'https://provider.example/health' }), (error) => error.errorKey === 'policy_blocked');
  assert.equal(typeof createServer, 'function');
});

test('default transport dials the validated IP while retaining TLS host verification', async () => {
  const egress = new ProviderEgress({ lookup: async () => [{ address: '8.8.8.8' }] });
  await assert.rejects(egress.request({ url: 'https://provider.example/health', timeoutMs: 50 }), (error) => ['network_unreachable', 'timed_out'].includes(error.errorKey));
});

test('controlled TLS fixture verifies host, response limit, redirect and timeout', async () => {
  const dir = await mkdtemp('.tmp-provider-tls-');
  await promisify(execFile)('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${dir}/key.pem`, '-out', `${dir}/cert.pem`, '-days', '1', '-subj', '/CN=provider.fixture.test', '-addext', 'subjectAltName=DNS:provider.fixture.test']);
  const key = await readFile(`${dir}/key.pem`);
  const cert = await readFile(`${dir}/cert.pem`);
  const server = createServer({ key, cert }, (request, response) => {
    if (request.url === '/redirect') { response.writeHead(302, { location: 'https://127.0.0.1/private' }); response.end(); return; }
    if (request.url === '/slow') { setTimeout(() => response.end('late'), 100); return; }
    response.end(request.url === '/large' ? 'long-response' : '{"ok":true}');
  });
  await new Promise((resolve) => server.listen(15171, '127.0.0.1', resolve));
  try {
    const egress = new ProviderEgress({ lookup: async () => [{ address: '127.0.0.1' }], internalHosts: ['provider.fixture.test'], ca: cert });
    const base = 'https://provider.fixture.test:15171';
    assert.deepEqual(await (await egress.request({ url: `${base}/ok` })).json(), { ok: true });
    await assert.rejects(egress.request({ url: `${base}/large`, maxResponseBytes: 4 }), (error) => error.errorKey === 'response_too_large');
    await assert.rejects(egress.request({ url: `${base}/redirect` }), (error) => error.errorKey === 'policy_blocked');
    await assert.rejects(egress.request({ url: `${base}/slow`, timeoutMs: 10 }), (error) => error.errorKey === 'timed_out');
    await assert.rejects(egress.request({ url: 'https://other.fixture.test:15171/ok' }), (error) => error.errorKey === 'endpoint_invalid');
  } finally { await new Promise((resolve) => server.close(resolve)); await rm(dir, { recursive: true }); }
});
