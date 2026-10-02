import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

assert.equal(process.platform, 'darwin');
const root = path.resolve(new URL('../../..', import.meta.url).pathname);
const binary = path.join(root, 'apps/desktop/src-tauri/target/debug/bundle/macos/DGOS.app/Contents/MacOS/dgos-desktop');
const helper = path.join(root, 'apps/desktop/src-tauri/target/debug/dgos-keychain-fixture');
const swift = path.join(root, 'apps/desktop/scripts/window-server.swift');
const screenshot = path.join(root, '.herdr/V1-DESKTOP-r6-window.png');
const service = `com.dgos.desktop.test.${randomUUID()}`;
const token = `fixture-${randomUUID()}`;
const subject = 'visible-fixture-subject';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dgos-visible-'));
const resultFile = path.join(dir, 'result.json');
const workspaceFile = path.join(dir, 'workspace.json');
const manifestFile = path.join(root, '.herdr/V1-DESKTOP-r6-visible.json');
const origin = 'http://127.0.0.1:15159';
const manifest = { workPackage: 'V1-DESKTOP r6', result: 'failed', mode: 'isolated-native-window-fixture', origin,
  screenshot: { available: false }, cases: [], limitations: ['Debug controlled window actions are not manual user interaction.'] };
const sourceFiles = ['apps/desktop/src-tauri/src/host.rs', 'apps/desktop/src-tauri/src/lib.rs', 'apps/desktop/src-tauri/src/proxy.rs',
  'apps/desktop/scripts/visible-macos.mjs', 'apps/desktop/scripts/window-server.swift'];
const digest = (file) => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const distFiles = () => {
  const walk = (directory, prefix = '') => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const name = path.posix.join(prefix, entry.name);
    return entry.isDirectory() ? walk(path.join(directory, entry.name), name) : [`apps/web/dist/${name}`];
  });
  return walk(path.join(root, 'apps/web/dist')).sort();
};
const server = http.createServer((request, response) => {
  const valid = request.url === '/api/v1/identity/admin/session' && request.headers.cookie === `dgos_session=${token}`;
  const authorized = request.headers.cookie === `dgos_session=${token}`;
  const settings = request.url === '/api/v1/system/settings';
  const context = request.url === '/api/v1/system/context';
  response.writeHead(valid || authorized && (settings || context) ? 200 : 401, { 'content-type': 'application/json' });
  response.end(valid ? JSON.stringify({ principalId: subject, sessionId: token, sessionVersion: '1', state: 'active' })
    : authorized && settings ? JSON.stringify({ settingsVersion: '1', appearance: { appearanceMode: 'light', displayScale: 1 }, locale: { uiLocale: 'en-US' }, network: { proxyMode: 'off' }, grid: {}, privacy: { telemetry: false }, appPermissions: [] })
      : authorized && context ? JSON.stringify({ contextVersion: '1', settings: { appearance: { appearanceMode: 'light', displayScale: 1 } }, runtimeVersion: 'v1' })
        : JSON.stringify({ errorKey: 'session_invalid' }));
});
const listen = () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(15159, '127.0.0.1', resolve); });
const closeServer = () => new Promise((resolve) => server.close(resolve));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (read, ready, label, timeout = 12000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = await read(); if (ready(value)) return value; await wait(150); }
  throw new Error(`${label}_timeout`);
};
const key = (action, input) => execFileSync(helper, [action, service, '127.0.0.1:15159'], { input, encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
const launch = (extra = {}) => spawn(binary, [], { cwd: root, env: { ...process.env, DGOS_DESKTOP_API_ORIGIN: origin,
  DGOS_DESKTOP_TEST_KEYCHAIN_SERVICE: service, DGOS_DESKTOP_TEST_RESULT_FILE: resultFile,
  DGOS_DESKTOP_WORKSPACE_FILE: workspaceFile, ...extra }, stdio: ['ignore', 'ignore', 'pipe'] });
const ownWindows = (pid) => JSON.parse(execFileSync('swift', [swift, String(pid)], { encoding: 'utf8', timeout: 12000, stdio: ['ignore', 'pipe', 'pipe'] }));
let child;
let written = false;
try {
  assert.ok(fs.existsSync(binary) && fs.existsSync(helper));
  manifest.artifactSha256 = digest('apps/desktop/src-tauri/target/debug/bundle/macos/DGOS.app/Contents/MacOS/dgos-desktop');
  manifest.sourceSha256Before = Object.fromEntries([...sourceFiles, ...distFiles()].map((file) => [file, digest(file)]));
  await listen();
  key('put', token); written = true;
  assert.equal(key('get'), token);
  child = launch({ DGOS_DESKTOP_TEST_VISIBLE: '1' });
  let stderr = ''; child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-1000); });
  try { manifest.windowServerEarly = await until(() => ownWindows(child.pid), (items) => items.length > 0, 'early_windowserver', 5000); }
  catch (error) { manifest.windowServerEarly = { available: false, reason: error.message }; }
  manifest.processAtWindowWait = { pid: child.pid, exitCode: child.exitCode, signal: child.signalCode };
  const result = await until(() => {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`app_exited_before_window_result:${stderr}`);
    return fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile, 'utf8')) : null;
  }, (value) => value !== null, 'window_result', 30000);
  manifest.nativeResult = result;
  try {
    const windows = await until(() => ownWindows(child.pid), (items) => items.some((item) => item.layer === 0 && item.bounds.Width > 500 && item.bounds.Height > 300), 'windowserver_window');
    const window = windows.find((item) => item.layer === 0 && item.bounds.Width > 500 && item.bounds.Height > 300);
    manifest.windowServer = { ownPid: child.pid, windowId: window.windowId, bounds: window.bounds, alpha: window.alpha, layer: window.layer };
    try {
      execFileSync('screencapture', ['-x', '-l', String(window.windowId), screenshot], { timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] });
      const bytes = fs.statSync(screenshot).size;
      assert.ok(bytes > 10000);
      manifest.screenshot = { available: true, file: '.herdr/V1-DESKTOP-r6-window.png', bytes,
        sha256: createHash('sha256').update(fs.readFileSync(screenshot)).digest('hex') };
    } catch (error) { fs.rmSync(screenshot, { force: true }); manifest.screenshot = { available: false, reason: String(error.stderr || error.message).slice(0, 180) }; }
  } catch (error) { manifest.windowServer = { available: false, reason: error.message }; }
  assert.equal(result.stage, 'complete', result.error);
  assert.equal(result.windowInitial?.visible, true, `initial:${JSON.stringify(result)}`);
  assert.equal(result.windowFocused?.focused, true, `focus:${JSON.stringify(result)}`);
  assert.equal(result.windowMaximized?.maximized, true, `maximize:${JSON.stringify(result)}`);
  assert.equal(result.windowRestored?.maximized, false, `restore:${JSON.stringify(result)}`);
  assert.equal(result.windowRoute, '/settings', `route:${JSON.stringify(result)}`);
  assert.equal(result.settingsControlVisible, true, `settings_control:${JSON.stringify(result)}`);
  assert.equal(result.windowAfterNavigation?.route, '/settings', `native_route:${JSON.stringify(result)}`);
  manifest.cases.push({ name: 'tauri_visible_focus_maximize_restore_route', result: 'passed', states: result });
  await until(() => child.exitCode !== null || child.signalCode !== null, Boolean, 'native_close', 10000);
  manifest.cases.push({ name: 'native_window_close', result: 'passed', exitCode: child.exitCode, signal: child.signalCode });
  child = null;
  const scoped = path.join(dir, `workspace-${createHash('sha256').update(subject).digest('hex')}.json`);
  const snapshot = JSON.parse(fs.readFileSync(scoped, 'utf8'));
  manifest.persistedBeforeRelaunch = snapshot;
  assert.equal(snapshot.windows.find((item) => item.label === 'main')?.route, '/settings');
  fs.rmSync(resultFile);
  child = launch({ DGOS_DESKTOP_TEST_RESTORE_PROBE: '1' });
  const restored = await until(() => fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile, 'utf8')) : null,
    (value) => value?.stage === 'restored', 'restored_state');
  manifest.restoredReadback = restored;
  assert.equal(restored.route, '/settings');
  assert.equal(restored.window.visible, true);
  assert.equal(restored.window.width, snapshot.windows.find((item) => item.label === 'main')?.width);
  assert.equal(restored.window.height, snapshot.windows.find((item) => item.label === 'main')?.height);
  manifest.cases.push({ name: 'subject_window_reopen_restored', result: 'passed', persisted: snapshot.windows.find((item) => item.label === 'main'), restored });
  manifest.result = 'passed';
} catch (error) { manifest.error = String(error.message).slice(0, 250); manifest.processAtFailure = child ? { pid: child.pid, exitCode: child.exitCode, signal: child.signalCode } : null; process.exitCode = 1; }
finally {
  if (child?.exitCode === null && child.signalCode === null) { child.kill('SIGTERM'); await wait(500); if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }
  if (written) { try { key('delete'); manifest.keychainItemDeleted = true; } catch { manifest.keychainItemDeleted = false; } }
  if (server.listening) await closeServer();
  fs.rmSync(dir, { recursive: true, force: true });
  manifest.sourceSha256After = Object.fromEntries([...sourceFiles, ...distFiles()].map((file) => [file, digest(file)]));
  manifest.sourceDrift = JSON.stringify(manifest.sourceSha256Before) !== JSON.stringify(manifest.sourceSha256After);
  if (manifest.sourceDrift) { manifest.result = 'failed'; manifest.error ??= 'source_changed_during_window_run'; process.exitCode = 1; }
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ result: manifest.result, cases: manifest.cases.map((item) => item.name), windowServer: manifest.windowServer,
    screenshot: manifest.screenshot, error: manifest.error }));
}
