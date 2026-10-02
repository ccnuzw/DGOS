import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProviderEgress } from '../../src/security/provider-egress.mjs';

test('DNS resolution shares the request deadline and is cancellable before any transport', async () => {
  let calls = 0;
  const egress = new ProviderEgress({ lookup: () => new Promise(() => {}), fetchImpl: async () => { calls++; } });
  await assert.rejects(egress.request({ url: 'https://pending.test/', timeoutMs: 20 }), { errorKey: 'timed_out' });
  const controller = new AbortController();
  const request = egress.request({ url: 'https://pending.test/', signal: controller.signal });
  controller.abort();
  await assert.rejects(request, { errorKey: 'cancelled' });
  assert.equal(calls, 0);
});

test('real TLS body arrives before upstream ends and retains limits, cancellation and total deadline', { timeout: 10000 }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dgos-stream-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await promisify(execFile)('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(root, 'key.pem'), '-out', join(root, 'cert.pem'), '-days', '1', '-subj', '/CN=stream.fixture.test', '-addext', 'subjectAltName=DNS:stream.fixture.test']);
  const cert = await readFile(join(root, 'cert.pem'));
  let finishUpstream; let ended = false; let closeStream;
  const server = createServer({ key: await readFile(join(root, 'key.pem')), cert }, (req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    if (req.url === '/early') {
      res.write('first');
      finishUpstream = () => { ended = true; res.end('last'); };
    } else if (req.url === '/large') res.end('too large');
    else {
      res.write('first');
      const pulse = setInterval(() => res.write('x'), 10);
      res.on('close', () => { clearInterval(pulse); closeStream?.(); });
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const egress = new ProviderEgress({ lookup: async () => [{ address: '127.0.0.1' }], internalHosts: ['stream.fixture.test'], ca: cert });
  const base = `https://stream.fixture.test:${server.address().port}`;
  const response = await egress.request({ url: `${base}/early`, streamResponse: true, timeoutMs: 2000 });
  const first = await response.body.next();
  assert.equal(first.value.toString(), 'first'); assert.equal(ended, false);
  finishUpstream();
  assert.equal((await response.body.next()).value.toString(), 'last');
  assert.equal((await response.body.next()).done, true);
  const large = await egress.request({ url: `${base}/large`, streamResponse: true, maxResponseBytes: 4 });
  await assert.rejects(Array.fromAsync(large.body), { errorKey: 'response_too_large' });
  const controller = new AbortController();
  const cancelled = await egress.request({ url: `${base}/cancel`, streamResponse: true, signal: controller.signal });
  await cancelled.body.next(); controller.abort();
  await assert.rejects(Array.fromAsync(cancelled.body), { errorKey: 'cancelled' });
  const timed = await egress.request({ url: `${base}/deadline`, streamResponse: true, timeoutMs: 80 });
  await assert.rejects(Array.fromAsync(timed.body), { errorKey: 'timed_out' });
  const closed = new Promise((resolve) => { closeStream = resolve; });
  const earlyStop = await egress.request({ url: `${base}/return`, streamResponse: true });
  await earlyStop.body.next(); await earlyStop.body.return(); await closed;
});
