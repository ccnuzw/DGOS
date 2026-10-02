import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createHash, randomUUID } from 'node:crypto';

if (process.platform !== 'darwin') {
  console.error('macOS GUI E2E requires Darwin');
  process.exit(2);
}

const desktop = path.resolve(new URL('..', import.meta.url).pathname);
const app = path.join(desktop, 'src-tauri/target/debug/bundle/macos/DGOS.app');
const executable = path.join(app, 'Contents/MacOS/dgos-desktop');
assert.ok(fs.existsSync(executable), 'Build the unsigned debug .app before GUI E2E');
const keychain = path.join(desktop, 'src-tauri/target/debug/dgos-keychain-fixture');
const external = process.argv.includes('--external-api');
const port = 15159;
const apiOrigin = external ? process.env.DGOS_DESKTOP_API_ORIGIN : `http://127.0.0.1:${port}`;
assert.ok(apiOrigin && /^http:\/\/(127\.0\.0\.1|localhost):1515[1-9]$/.test(apiOrigin), 'Use an assigned loopback API origin');
const service = `com.dgos.desktop.test.${randomUUID()}`;
const account = `${new URL(apiOrigin).hostname}:${new URL(apiOrigin).port}`;
const token = `fixture-${randomUUID()}`;
const subject = 'fixture-admin-a';
const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dgos-desktop-e2e-'));
const requests = [];
const server = http.createServer((req, res) => {
  const cookie = req.headers.cookie?.match(/(?:^|; )dgos_session=([^;]+)/)?.[1];
  requests.push({ url: req.url, origin: req.headers.origin, csrf: req.headers['x-dgos-csrf'], requestId: req.headers['x-request-id'], cookie });
  if (req.url === '/api/v1/identity/admin/session' && req.method === 'DELETE') {
    revoked = true;
    res.writeHead(204, { 'set-cookie': 'dgos_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0' });
    res.end();
    return;
  }
  const valid = cookie === token && !revoked;
  res.writeHead(valid ? 200 : 401, { 'content-type': 'application/json' });
  res.end(valid ? JSON.stringify({ principalId: subject, sessionId: token, sessionVersion: '1', state: 'active' }) : JSON.stringify({ errorKey: 'session_invalid' }));
});
const listen = () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
const close = () => new Promise((resolve) => server.close(resolve));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let child;
let revoked = false;
const key = (action, input) => execFileSync(keychain, [action, service, account], { input, encoding: 'utf8', timeout: 5000 });
const launch = () => spawn(executable, [], { env: { ...process.env, DGOS_DESKTOP_API_ORIGIN: apiOrigin,
  DGOS_DESKTOP_TEST_KEYCHAIN_SERVICE: service, DGOS_DESKTOP_TEST_BOOTSTRAP_TOKEN: token,
  DGOS_DESKTOP_WORKSPACE_FILE: path.join(stateDir, 'workspace.json') }, stdio: ['ignore', 'pipe', 'pipe'] });
const stop = async (processHandle) => { if (processHandle?.exitCode === null) { processHandle.kill('SIGTERM'); await Promise.race([new Promise((resolve) => processHandle.once('exit', resolve)), wait(5000)]); } };
try {
  if (!external) { assert.ok(fs.existsSync(keychain), 'Build dgos-keychain-fixture before GUI E2E'); await listen(); key('put', token); assert.equal(key('get'), token, 'Fixture keychain readback failed'); }
  child = launch();
  let stderr = '';
  child.stderr.on('data', (data) => { stderr += data.toString(); });
  let windowFound = false;
  for (let i = 0; i < 60; i += 1) {
    await wait(500);
    if (child.exitCode !== null) throw new Error(`DGOS exited before window appeared: ${stderr.slice(-2000)}`);
    try {
      const names = execFileSync('osascript', ['-e', `tell application "System Events" to get name of every process whose unix id is ${child.pid}`], { encoding: 'utf8', timeout: 3000 });
      windowFound = names.trim().length > 0;
    } catch { /* Accessibility may be unavailable; request evidence remains mandatory. */ }
    if (windowFound && (external || requests.some((r) => r.url === '/api/v1/identity/admin/session'))) break;
  }
  assert.ok(windowFound, `DGOS native app process did not appear in System Events; requests=${JSON.stringify(requests)} stderr=${stderr.slice(-1500)}`);
  if (external) {
    console.log(JSON.stringify({ result: 'prepared', externalApi: apiOrigin, nativeProcess: true, windowPixelsChecked: false }));
  } else {
    for (let i = 0; i < 20 && requests.length === 0; i += 1) await wait(250);
    const request = requests.find((r) => r.url === '/api/v1/identity/admin/session' && r.cookie === token);
    assert.ok(request, `Keychain session did not reach fixture API; seen=${JSON.stringify(requests.map((r) => ({ url: r.url, hasCookie: Boolean(r.cookie) })))} stderr=${stderr.slice(-800)}`);
    assert.equal(request.origin, apiOrigin);
    assert.equal(request.csrf, 'desktop');
    for (let i = 0; i < 20 && !requests.some((r) => r.requestId === 'desktop-bridge-fixture'); i += 1) await wait(250);
    assert.ok(requests.some((r) => r.requestId === 'desktop-bridge-fixture' && r.cookie === token && r.origin === apiOrigin && r.csrf === 'desktop'),
      `Webview desktop_api bridge did not reach fixture API; seen=${JSON.stringify(requests.map((r) => ({ url: r.url, requestId: r.requestId, hasCookie: Boolean(r.cookie) })))} stderr=${stderr.slice(-800)}`);
    const scoped = path.join(stateDir, `workspace-${createHash('sha256').update(subject).digest('hex')}.json`);
    for (let i = 0; i < 20 && !fs.existsSync(scoped); i += 1) await wait(250);
    assert.ok(fs.existsSync(scoped), 'Subject workspace was not persisted');
    await stop(child);
    child = launch();
    for (let i = 0; i < 20 && requests.filter((r) => r.url === '/api/v1/identity/admin/session' && r.cookie === token).length < 2; i += 1) await wait(250);
    assert.ok(requests.filter((r) => r.url === '/api/v1/identity/admin/session' && r.cookie === token).length >= 2, 'Relaunch did not reuse keychain session');
    await stop(child);
    const logout = await fetch(`${apiOrigin}/api/v1/identity/admin/session`, { method: 'DELETE', headers: { cookie: `dgos_session=${token}`, origin: apiOrigin, 'x-dgos-csrf': 'desktop' } });
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get('set-cookie') || '', /Max-Age=0/);
    const before = requests.length;
    child = launch();
    for (let i = 0; i < 20 && requests.length === before; i += 1) await wait(250);
    assert.ok(requests.slice(before).some((r) => r.url === '/api/v1/identity/admin/session' && r.cookie === token), 'Revoked session was not checked');
    assert.equal(fs.readFileSync(scoped, 'utf8').includes(subject), false, 'Workspace must not store raw subject');
    console.log(JSON.stringify({ result: 'passed', fixture: true, nativeProcess: true, webviewBridge: true, keychainRelaunch: true,
      revokedSessionChecked: true, subjectWorkspace: true, origin: apiOrigin, windowPixelsChecked: false }));
  }
} finally {
  await stop(child);
  if (!external) { await close().catch(() => {}); try { key('delete'); } catch { /* Randomized test item only. */ } }
  fs.rmSync(stateDir, { recursive: true, force: true });
}
