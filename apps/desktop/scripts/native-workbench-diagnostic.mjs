import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

if (process.platform !== 'darwin') {
  console.error(JSON.stringify({ result: 'failed', error: 'macOS GUI diagnostic requires Darwin' }));
  process.exit(2);
}

const root = path.resolve(new URL('../../..', import.meta.url).pathname);
const binary = path.join(root, 'apps/desktop/src-tauri/target/debug/bundle/macos/DGOS.app/Contents/MacOS/dgos-desktop');
const keychain = path.join(root, 'apps/desktop/src-tauri/target/debug/dgos-keychain-fixture');
const swift = path.join(root, 'apps/desktop/scripts/window-server.swift');
let port = 15159;
const token = `fixture-${randomUUID()}`;
const service = `com.dgos.desktop.test.${randomUUID()}`;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dgos-native-workbench-'));
const resultFile = path.join(temp, 'result.json');
const workspaceFile = path.join(temp, 'workspace.json');
const screenshot = path.join(root, `.herdr/evidence/native-workbench-${new Date().toISOString().replaceAll(/[:.]/g, '-')}.png`);
const manifest = path.join(root, `.herdr/evidence/native-workbench-${new Date().toISOString().replaceAll(/[:.]/g, '-')}.json`);
const requests = [];
let child;
let keyWritten = false;
const server = http.createServer((request, response) => {
  requests.push({ url: request.url, method: request.method, requestId: request.headers['x-request-id'] ?? null });
  const valid = request.headers.cookie === `dgos_session=${token}`;
  const body = request.url === '/api/v1/identity/admin/session' && valid
    ? JSON.stringify({ principalId: 'native-diagnostic-subject', sessionId: token, sessionVersion: '1', state: 'active' })
    : JSON.stringify({ errorKey: 'session_invalid' });
  response.writeHead(valid ? 200 : 401, { 'content-type': 'application/json' }); response.end(body);
});
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const key = (action, input) => execFileSync(keychain, [action, service, `127.0.0.1:${port}`], { input, encoding: 'utf8', timeout: 5000 });
const ownWindows = (pid) => JSON.parse(execFileSync('swift', [swift, String(pid)], { encoding: 'utf8', timeout: 12000 }));
const until = async (read, predicate, label, timeout = 30000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = await read(); if (predicate(value)) return value; await wait(150); }
  throw new Error(`${label}_timeout`);
};
const output = { workPackage: 'WP-W1-01', result: 'failed', command: 'node apps/desktop/scripts/native-workbench-diagnostic.mjs', limitations: ['Diagnostic uses loopback Session fixture and debug native binary; Provider/Task chain is not asserted here.'] };
try {
  if (!fs.existsSync(binary) || !fs.existsSync(keychain)) throw new Error('build_debug_app_and_keychain_fixture_first');
  let listening = false;
  for (const candidate of [15159, 15158, 15157, 15156, 15155, 15154, 15153, 15152, 15151]) {
    try {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(candidate, '127.0.0.1', resolve); });
      port = candidate; listening = true; break;
    } catch { /* Try the next assigned loopback port. */ }
  }
  if (!listening) throw new Error('no_assigned_loopback_port_available');
  key('put', token); keyWritten = true;
  child = spawn(binary, [], { cwd: root, env: { ...process.env, DGOS_DESKTOP_API_ORIGIN: `http://127.0.0.1:${port}`, DGOS_DESKTOP_TEST_KEYCHAIN_SERVICE: service, DGOS_DESKTOP_TEST_WORKBENCH: '1', DGOS_DESKTOP_TEST_RESULT_FILE: resultFile, DGOS_DESKTOP_WORKSPACE_FILE: workspaceFile }, stdio: ['ignore', 'ignore', 'pipe'] });
  output.nativePid = child.pid;
  let stderr = ''; child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-8000); });
  const windows = await until(() => ownWindows(child.pid), (items) => items.some((item) => item.layer === 0 && item.bounds.Width > 500 && item.bounds.Height > 300), 'windowserver_owner', 15000);
  const owner = windows.find((item) => item.layer === 0 && item.bounds.Width > 500 && item.bounds.Height > 300);
  output.windowServer = { ownerPid: child.pid, windowId: owner.windowId, bounds: owner.bounds, layer: owner.layer, alpha: owner.alpha };
  try { execFileSync('screencapture', ['-x', '-l', String(owner.windowId), screenshot], { timeout: 10000 }); output.screenshot = { file: path.relative(root, screenshot), bytes: fs.statSync(screenshot).size, sha256: createHash('sha256').update(fs.readFileSync(screenshot)).digest('hex') }; } catch (error) { output.screenshot = { available: false, reason: String(error.message).slice(0, 180) }; }
  const result = await until(() => fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile, 'utf8')) : null, (value) => ['complete', 'failed'].includes(value?.stage), 'native_result', 90000);
  output.webview = result; output.nativeStderr = stderr; output.requests = requests;
  if (result.stage !== 'complete') throw new Error(result.error ?? 'native_workbench_failed');
  output.result = 'passed';
} catch (error) { output.error = String(error.message).slice(0, 300); output.nativeStderr ??= ''; if (child) output.nativePid = child.pid; }
finally {
  if (child?.exitCode === null && child?.signalCode === null) { child.kill('SIGTERM'); await wait(500); if (child.exitCode === null) child.kill('SIGKILL'); }
  if (keyWritten) { try { key('delete'); } catch {} }
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  fs.rmSync(temp, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(manifest), { recursive: true }); fs.writeFileSync(manifest, JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify({ ...output, manifest: path.relative(root, manifest) }));
  if (output.result !== 'passed') process.exitCode = 1;
}
