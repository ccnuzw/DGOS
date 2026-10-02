import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('package fixture signs nine capabilities and seeds only through public HTTP', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-package-fixture-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const generate = JSON.parse(execFileSync(process.execPath, ['scripts/v1-package-fixture.mjs', 'generate', '--output', dir], { encoding: 'utf8' }));
  assert.equal(generate.capabilityCount, 9);
  assert.equal((await readdir(dir)).some((name) => name.endsWith('.pem')), false);
  const roots = JSON.parse(await readFile(generate.trustRootsFile, 'utf8'));
  const envelope = JSON.parse(await readFile(generate.envelopeFile, 'utf8'));
  assert.equal(roots[0].source, 'official');
  assert.deepEqual(envelope.manifest.permissions, envelope.manifest.capabilityAllowlist);
  assert.equal(envelope.manifest.permissions.length, 9);
  assert.ok(envelope.manifest.permissions.includes('dgos.system.context.read'));
  assert.ok(envelope.manifest.permissions.includes('dgos.system.context.events'));

  const requests = [];
  const subjectId = 'c30f4855-e0d5-4004-85c5-6e7d373281c8';
  const server = createServer(async (request, response) => {
    const body = await new Promise((resolve) => { const chunks = []; request.on('data', (part) => chunks.push(part)); request.on('end', () => resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null)); });
    requests.push({ method: request.method, path: request.url, body });
    const path = request.url;
    let status = 200; let result;
    if (path === '/api/v1/identity/admin/login') result = { sessionId: 'fixture-session', principalId: subjectId };
    else if (request.headers.authorization !== 'Bearer fixture-session') { status = 401; result = { errorKey: 'session_invalid' }; }
    else if (path === '/api/v1/apps' && request.method === 'POST') { status = 201; result = { digest: generate.digest, catalogState: 'official' }; }
    else if (path.endsWith('/deployment') && requests.filter((entry) => entry.path.endsWith('/deployment')).length === 1) { status = 404; result = { errorKey: 'app_not_installed' }; }
    else if (path.endsWith('/deployment')) result = { appId: envelope.manifest.appId, state: 'active', activeRelease: { digest: generate.digest }, versionNumber: 1 };
    else if (path.endsWith('/install')) result = { appId: envelope.manifest.appId, state: 'active' };
    else if (path === '/api/v1/permissions') result = { subjectId, appId: body.appId, capability: body.capability, decision: 'allow', scope: '*' };
    else { status = 404; result = { errorKey: 'unhandled_fixture_route' }; }
    response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(result));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const { stdout } = await promisify(execFile)(process.execPath, ['scripts/v1-package-fixture.mjs', 'seed', '--output', dir, '--api-url', `http://127.0.0.1:${port}/`], { encoding: 'utf8', env: { ...process.env, DGOS_PACKAGE_FIXTURE_PRINCIPAL_ID: subjectId, DGOS_PACKAGE_FIXTURE_CREDENTIAL: 'fixture-only' } });
  const seed = JSON.parse(stdout);
  assert.equal(seed.subjectId, subjectId);
  assert.equal(seed.grants.length, 9);
  assert.equal(requests.filter((entry) => entry.method === 'PATCH' && entry.path === '/api/v1/permissions').length, 9);
  assert.equal(requests.filter((entry) => entry.method === 'POST' && entry.path.endsWith('/install')).length, 1);
  assert.equal(requests.find((entry) => entry.method === 'POST' && entry.path === '/api/v1/apps').body.requestId, envelope.requestId);
  assert.equal(JSON.stringify(seed).includes('fixture-only'), false);
});
