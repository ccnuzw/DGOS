import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from '../apps/api/node_modules/pg/lib/index.js';
import { createClient } from '../apps/api/node_modules/redis/dist/index.js';
import { buildMigrationSql } from './migrate.mjs';
import { buildServer } from '../apps/api/src/server.mjs';
import { startWorkerProcess } from '../apps/worker/src/worker.mjs';
import { RedisSecretService } from '../src/security/secret-service.mjs';
import { createRuntimeEgress } from '../src/security/runtime-egress.mjs';
import { createOpenAiCompatibleFixture } from '../test-support/openai-compatible-fixture.mjs';
import { desktopCandidatePreflight } from '../apps/desktop/scripts/candidate-preflight.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const appBinary = path.join(root, 'apps/desktop/src-tauri/target/debug/bundle/macos/DGOS.app/Contents/MacOS/dgos-desktop');
const keychainBinary = path.join(root, 'apps/desktop/src-tauri/target/debug/dgos-keychain-fixture');
const id = randomUUID().replaceAll('-', '');
const database = `dgos_v1_desktop_${id}`;
const service = `com.dgos.desktop.test.${id}`;
const apiOrigin = 'http://127.0.0.1:15158';
const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dgos-desktop-real-'));
const workspaceFile = path.join(stateDir, 'workspace.json');
const resultFile = path.join(stateDir, 'webview-result.json');
const runId = `V1-NATIVE-EXECUTION-r13-${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${id.slice(0, 8)}`;
const manifestName = `.herdr/${runId}-manifest.json`;
const screenshotName = `.herdr/${runId}-window.png`;
const manifestFile = path.join(root, manifestName);
const screenshotFile = path.join(root, screenshotName);
const dbBase = 'postgresql://dgos:dgos@127.0.0.1:5432/';
const redisUrl = 'redis://127.0.0.1:6379/7';
const candidateDir = path.resolve(process.env.DGOS_DESKTOP_CANDIDATE_DIR ?? path.join(root, '.herdr/state/package-fixture-r9'));
const env = { ...process.env, NODE_ENV: 'test', DGOS_DATABASE_URL: `${dbBase}${database}`, REDIS_URL: redisUrl,
  DGOS_ALLOW_INSECURE_FIXTURE: '1', DGOS_ALLOWED_ORIGINS: apiOrigin, DGOS_PACKAGE_ROOT: path.join(stateDir, 'packages'), DGOS_DESKTOP_WORKSPACE_FILE: workspaceFile,
  DGOS_PACKAGE_TRUST_ROOTS_FILE: path.join(candidateDir, 'trust-roots.json') };
Object.assign(process.env, { NODE_ENV: env.NODE_ENV, DGOS_DATABASE_URL: env.DGOS_DATABASE_URL, REDIS_URL: env.REDIS_URL,
  DGOS_ALLOW_INSECURE_FIXTURE: env.DGOS_ALLOW_INSECURE_FIXTURE, DGOS_ALLOWED_ORIGINS: env.DGOS_ALLOWED_ORIGINS,
  DGOS_PACKAGE_ROOT: env.DGOS_PACKAGE_ROOT, DGOS_PACKAGE_TRUST_ROOTS_FILE: env.DGOS_PACKAGE_TRUST_ROOTS_FILE });
const manifest = { work_package: 'V1-NATIVE-EXECUTION r13', run_id: runId, result: 'failed', database, apiOrigin, redisDatabase: 7,
  command: 'node scripts/v1-desktop-real.mjs', cases: [], limitations: ['Local Provider fixture and debug-driven signed iframe DOM; no manual GUI or release signing acceptance. Screenshot requires human review.'] };
const hash = (file) => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const sourceFiles = ['apps/desktop/src-tauri/src/host.rs', 'apps/desktop/src-tauri/src/proxy.rs', 'apps/desktop/src-tauri/src/lib.rs',
  'apps/desktop/scripts/e2e-macos.mjs', 'apps/desktop/scripts/window-server.swift', 'apps/api/src/server.mjs', 'apps/worker/src/worker.mjs',
  'src/ai-task/service.mjs', 'test-support/openai-compatible-fixture.mjs', 'scripts/v1-desktop-real.mjs',
  'apps/desktop/scripts/candidate-preflight.mjs', 'apps/desktop/scripts/workbench-main-driver.js',
  'apps/desktop/scripts/workbench-frame-driver.js', 'apps/ai-workbench-package/manifest.json',
  'apps/ai-workbench-package/index.html', 'apps/ai-workbench-package/workbench.css',
  'apps/ai-workbench-package/workbench.js', 'apps/ai-workbench-package/icon.svg',
  'packages/design-tokens/src/tokens.css', path.relative(root, path.join(candidateDir, 'ai-workbench-envelope.json')),
  path.relative(root, path.join(candidateDir, 'trust-roots.json'))];
const distFiles = (directory, prefix = '') => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const name = path.posix.join(prefix, entry.name);
  return entry.isDirectory() ? distFiles(path.join(directory, entry.name), name) : [name];
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let admin, pool, redis, api, runtime, fixture, child, session;
let nativeSessionRequests = 0;
let dbCreated = false;
let testKeyWritten = false;
const ownWindows = (pid) => JSON.parse(execFileSync('swift', [path.join(root, 'apps/desktop/scripts/window-server.swift'), String(pid)], { encoding: 'utf8', timeout: 12000, stdio: ['ignore', 'pipe', 'pipe'] }));
const http = async (endpoint, { method = 'GET', body, status = 200 } = {}) => {
  const response = await fetch(`${apiOrigin}/api/v1${endpoint}`, { method, signal: AbortSignal.timeout(8000),
    headers: { ...(session ? { authorization: `Bearer ${session.sessionId}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  if (response.status !== status) {
    let errorKey; try { errorKey = JSON.parse(text).errorKey; } catch { /* Omit response body. */ }
    throw new Error(`${method} ${endpoint}: HTTP ${response.status}; expected ${status}; ${errorKey ?? 'unknown_error'}`);
  }
  return text ? JSON.parse(text) : null;
};
const until = async (read, predicate, label, limit = 15000) => {
  const deadline = Date.now() + limit;
  while (Date.now() < deadline) { const value = await read(); if (predicate(value)) return value; await sleep(150); }
  throw new Error(`${label}_timeout`);
};
const key = (action, input) => {
  const args = [action, service, '127.0.0.1:15158'];
  try {
    return execFileSync(keychainBinary, args, { input, encoding: 'utf8', timeout: 12000 });
  } catch (error) {
    // Keychain can briefly hold a stale item after a prior interrupted run.
    if (action === 'put') {
      try { execFileSync(keychainBinary, ['delete', service, '127.0.0.1:15158'], { encoding: 'utf8', timeout: 4000 }); } catch { /* item absent */ }
      return execFileSync(keychainBinary, args, { input, encoding: 'utf8', timeout: 12000 });
    }
    throw error;
  }
};

try {
  assert.equal(process.platform, 'darwin');
  assert.ok(fs.existsSync(appBinary) && fs.existsSync(keychainBinary), 'Build the debug app and dedicated keychain helper first');
  const candidate = await desktopCandidatePreflight();
  manifest.preflight = { migrationCount: candidate.migrations.length, finalMigration: candidate.migrations.at(-1).version,
    packageDigest: candidate.packageDigest, envelopeSha256: candidate.envelopeSha256, trustRootsSha256: candidate.trustRootsSha256,
    embeddedAssetNames: candidate.embeddedAssetNames, appSha256: candidate.appSha256 };
  manifest.artifact_sha256 = hash('apps/desktop/src-tauri/target/debug/bundle/macos/DGOS.app/Contents/MacOS/dgos-desktop');
  manifest.source_sha256 = Object.fromEntries(sourceFiles.map((file) => [file, hash(file)]));
  manifest.web_dist_sha256 = Object.fromEntries(distFiles(path.join(root, 'apps/web/dist')).sort().map((file) => [file, hash(`apps/web/dist/${file}`)]));
  admin = new pg.Pool({ connectionString: `${dbBase}dgos_v1_integrated`, connectionTimeoutMillis: 3000 });
  await admin.query(`CREATE DATABASE ${database}`); dbCreated = true;
  pool = new pg.Pool({ connectionString: env.DGOS_DATABASE_URL, connectionTimeoutMillis: 3000 });
  const migrations = candidate.migrations;
  await pool.query(buildMigrationSql(migrations));
  manifest.migrations = migrations.map(({ version, checksum }) => ({ version, checksum }));
  manifest.cases.push({ name: 'isolated_database_migrated', result: 'passed', count: migrations.length });
  redis = createClient({ url: redisUrl }); await redis.connect();
  const secrets = new RedisSecretService(redis, { keyPrefix: `v1-desktop:${id}:secret:` });
  fixture = createOpenAiCompatibleFixture({ token: `provider-${id}`, chunks: ['desktop-workbench-', 'fixture hello world'] });
  const fixtureAddress = await fixture.start(15157);
  env.DGOS_FIXTURE_BASE_URL = `http://127.0.0.1:${fixtureAddress.port}`;
  process.env.DGOS_FIXTURE_BASE_URL = env.DGOS_FIXTURE_BASE_URL;
  api = buildServer({ logger: false, closeDatabasePools: true, secretService: secrets, providerEgress: createRuntimeEgress(env) });
  api.addHook('onRequest', async (request) => {
    if (request.url === '/api/v1/identity/admin/session' && !request.headers['x-request-id']) nativeSessionRequests += 1;
  });
  await api.listen({ host: '127.0.0.1', port: 15158 });
  runtime = await startWorkerProcess({ env: { ...env, DGOS_WORKER_ID: randomUUID(), DGOS_AI_TASK_POLL_MS: '50', DGOS_AI_TASK_IDLE_BACKOFF_MS: '100' }, secretService: secrets });
  manifest.cases.push({ name: 'api_worker_provider_fixture_started', result: 'passed' });
  session = await http('/identity/admin/bootstrap', { method: 'POST', status: 201,
    body: { displayName: 'Desktop E2E', credential: `test-${randomUUID()}-${randomUUID()}` } });
  assert.ok(session.sessionId && session.principalId);
  const submittedApp = await http('/apps', { method: 'POST', status: 201, body: candidate.envelope });
  assert.equal(submittedApp.digest, candidate.packageDigest);
  assert.equal(submittedApp.catalogState, 'official');
  const appId = candidate.envelope.manifest.appId;
  await http(`/apps/${appId}/install`, { method: 'POST', body: { requestId: randomUUID(), version: '1.0.1', build: 2, releaseChannel: 'stable' } });
  const deployment = await http(`/apps/${appId}/deployment`);
  assert.equal(deployment.state, 'active');
  assert.equal(deployment.activeRelease?.digest, candidate.packageDigest);
  for (const capability of candidate.envelope.manifest.permissions) {
    const decision = await http('/permissions', { method: 'PATCH', body: { requestId: randomUUID(), appId, capability, decision: 'allow' } });
    assert.equal(decision.decision, 'allow');
  }
  manifest.cases.push({ name: 'signed_workbench_1_0_1_installed', result: 'passed', appId, digest: candidate.packageDigest, capabilityCount: candidate.envelope.manifest.permissions.length });
  const declaration = { schemaVersion: 'dgos-capability/v1', kind: 'model', id: `desktop.candidate.${id.slice(0, 12)}`,
    version: '1.0.0', executor: { type: 'declarative', engine: 'dgos-text-v1' }, capabilities: ['text.chat'],
    operations: { submit: { profile: 'chat.completions', method: 'POST', path: '/chat/completions' } },
    workflows: { 'text.chat': { submit: 'submit' } }, defaults: { temperature: 0.4, maxOutputTokens: 8 },
    limits: { maxInputCharacters: 200, maxOutputTokens: 20 }, uiSchemas: { parameters: ['temperature', 'maxOutputTokens'] },
    modelProfiles: { fixture: { modelNames: ['fixture-text-model'], workflow: 'text.chat' } }, assets: {} };
  const profileRequestId = randomUUID();
  const validation = await http('/provider/capability-protocols', { method: 'POST', body: { requestId: profileRequestId, declaration } });
  assert.equal(validation.status, 'validating');
  const confirmation = await http('/provider/capability-protocols/confirmations', { method: 'POST', status: 201,
    body: { requestId: profileRequestId, operation: 'provider.protocol.publish', protocolId: declaration.id,
      version: declaration.version, declaration, validationDigest: validation.digest } });
  const published = await http(`/provider/capability-protocols/${declaration.id}/versions`, { method: 'POST', status: 201,
    body: { requestId: profileRequestId, declaration, validationDigest: validation.digest, confirmationId: confirmation.confirmationId } });
  assert.equal(published.status, 'active');
  const account = await http('/provider/accounts', { method: 'POST', status: 201,
    body: { requestId: randomUUID(), protocolType: 'openai-compatible', displayName: 'Desktop fixture', credential: fixture.token, scope: { endpoint: 'https://fixture.test/v1' } } });
  const probe = await http('/provider/connection-tests', { method: 'POST', status: 202,
    body: { requestId: randomUUID(), accountId: account.accountId, accountVersion: account.version, protocolVersion: 'v1' } });
  const probeResult = await until(() => http(`/provider/connection-tests/${probe.testId}`), (value) => ['succeeded', 'failed'].includes(value.status), 'provider_probe');
  assert.equal(probeResult.status, 'succeeded', `provider_probe:${probeResult.reasonCode ?? 'unknown'}`);
  await http(`/provider/accounts/${account.accountId}/state`, { method: 'POST', body: { requestId: randomUUID(), baseVersion: account.version, connectionTestId: probe.testId, state: 'ready' } });
  const config = await http('/provider/configs', { method: 'POST', status: 201,
    body: { requestId: randomUUID(), providerAccountId: account.accountId, protocolType: 'openai-compatible', displayName: 'Desktop fixture',
      baseUrl: 'https://fixture.test/v1', capabilityProtocolId: declaration.id, capabilityProtocolVersion: declaration.version } });
  const configId = config.providerConfigId ?? config.id;
  await http(`/provider/configs/${configId}/validate`, { method: 'POST', body: { requestId: randomUUID() } });
  await http(`/provider/configs/${configId}/models`, { method: 'POST', body: { requestId: randomUUID() } });
  await http(`/provider/configs/${configId}/model-policies`, { method: 'POST', body: { requestId: randomUUID(), modelId: 'fixture-text-model', enabled: true, assignedCapabilities: ['text'], defaultFor: [], baseVersion: '0' } });
  await http('/quota/policies', { method: 'PUT', body: { requestId: randomUUID(), metric: 'requests', scopeType: 'subject', scopeId: session.principalId,
    hardLimit: 100, softLimit: 90, windowSeconds: 3600, effectiveAt: new Date().toISOString() } });
  manifest.cases.push({ name: 'public_http_session_and_provider_ready', result: 'passed', subjectId: session.principalId, configId });
  key('put', session.sessionId);
  testKeyWritten = true;
  child = spawn(appBinary, [], { cwd: root, env: { ...env, DGOS_DESKTOP_API_ORIGIN: apiOrigin, DGOS_DESKTOP_TEST_KEYCHAIN_SERVICE: service,
    DGOS_DESKTOP_TEST_WORKBENCH: '1', DGOS_DESKTOP_TEST_RESULT_FILE: resultFile,
    DGOS_DESKTOP_WORKSPACE_FILE: path.join(stateDir, 'workspace.json') }, stdio: ['ignore', 'ignore', 'pipe'] });
  manifest.nativePid = child.pid;
  let stderr = ''; child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-8000); });
  let lastWebviewState;
  const result = await until(() => {
    if (child.exitCode !== null) throw new Error(`desktop_exited:${stderr}`);
    lastWebviewState = fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile, 'utf8')) : null;
    return lastWebviewState;
  }, (value) => value?.stage === 'complete' || value?.stage === 'failed', 'webview_result', 120000)
    .catch((error) => {
      manifest.webviewLastState = lastWebviewState;
      manifest.nativeStderr = stderr;
      try {
        manifest.windowServerAtFailure = ownWindows(child.pid);
        const window = manifest.windowServerAtFailure.find((item) => item.ownerPid === child.pid && item.layer === 0 && item.bounds.Width > 500 && item.bounds.Height > 300);
        if (window) {
          execFileSync('screencapture', ['-x', '-l', String(window.windowId), screenshotFile], { timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] });
          manifest.screenshotAtFailure = { file: screenshotName, windowId: window.windowId, ownerPid: child.pid,
            bytes: fs.statSync(screenshotFile).size, sha256: hash(screenshotName), visualReview: 'pending' };
        }
      } catch (windowError) { manifest.windowCaptureError = String(windowError.stderr || windowError.message).slice(0, 180); }
      throw error;
    });
  manifest.webviewLastState = result;
  manifest.nativeStderr = stderr;
  try {
    const windows = execFileSync('osascript', ['-e', 'tell application "System Events"', '-e', `set ownProcesses to (every process whose unix id is ${child.pid})`, '-e', 'get count of windows of item 1 of ownProcesses', '-e', 'end tell'], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] });
    manifest.windowQuery = { method: 'System Events by own PID', count: Number(windows.trim()) };
  } catch (error) { manifest.windowQuery = { method: 'System Events by own PID', available: false, reason: String(error.stderr || error.message).slice(0, 160) }; }
  try {
    const windows = await until(() => ownWindows(child.pid), (items) => items.some((item) => item.layer === 0 && item.bounds.Width > 500 && item.bounds.Height > 300), 'windowserver_visible', 10000);
    const window = windows.find((item) => item.ownerPid === child.pid && item.layer === 0 && item.bounds.Width > 500 && item.bounds.Height > 300);
    manifest.windowServer = { ownerPidMatched: true, ownerPid: child.pid, windowId: window.windowId,
      bounds: window.bounds, layer: window.layer, alpha: window.alpha, allOwnWindows: windows };
    try {
      await sleep(350);
      execFileSync('screencapture', ['-x', '-l', String(window.windowId), screenshotFile], { timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] });
      const bytes = fs.statSync(screenshotFile).size;
      if (bytes > 10000) manifest.screenshot = { file: screenshotName, windowId: window.windowId, ownerPid: child.pid,
        bytes, sha256: hash(screenshotName), domRenderMarker: Boolean(result.workbenchVisible), doubleAnimationFrame: Boolean(result.paintReady), visualReview: 'pending' };
      else { fs.rmSync(screenshotFile, { force: true }); manifest.screenshot = { available: false, reason: 'capture_too_small' }; }
    } catch (error) { fs.rmSync(screenshotFile, { force: true }); manifest.screenshot = { available: false, reason: String(error.stderr || error.message).slice(0, 180) }; }
  } catch (error) { manifest.windowServer = { available: false, reason: String(error.message).slice(0, 180) }; }
  assert.equal(result.stage, 'complete', `Webview stopped at ${result.stage}: ${result.error ?? 'unknown'}`);
  assert.equal(result.route, '/catalog');
  assert.equal(result.workbenchVersion, '1.0.1');
  assert.equal(result.workbenchBuild, 2);
  assert.equal(result.workbenchVisible, true);
  assert.equal(result.workbenchStatus, 'succeeded');
  assert.equal(result.paintReady, true);
  assert.ok(manifest.screenshot?.sha256, 'app_window_screenshot_required');
  assert.equal(key('get'), session.sessionId);
  assert.deepEqual(result.selectedParameters, { temperature: 0.7, maxOutputTokens: 10 });
  assert.ok(result.resumedSameTask && result.artifactMatched && result.deltaCount > 0);
  for (const capability of ['dgos.model.list', 'dgos.model.resolve', 'dgos.aiTask.submit', 'dgos.aiTask.events', 'dgos.aiTask.get', 'dgos.artifact.read']) {
    assert.ok(result.bridgeCalls.includes(capability), `missing_workbench_bridge:${capability}`);
  }
  const task = await http(`/ai-tasks/${result.taskId}`); assert.equal(task.status, 'succeeded');
  const savedTask = await pool.query('SELECT execution_snapshot FROM ai_tasks WHERE task_id=$1 AND owner_id=$2', [result.taskId, session.principalId]);
  assert.equal(savedTask.rowCount, 1);
  assert.deepEqual(savedTask.rows[0].execution_snapshot?.normalizedParameters, result.selectedParameters);
  assert.ok(fixture.requests.some((request) => request.path === '/v1/chat/completions'));
  manifest.cases.push({ name: 'signed_workbench_bridge_parameters_delta_artifact_reload', result: 'passed', taskId: result.taskId,
    parameters: result.selectedParameters, deltaCount: result.deltaCount, bridgeCalls: result.bridgeCalls,
    providerCalls: fixture.requests.filter((request) => request.path === '/v1/chat/completions').length });
  manifest.cases.push({ name: 'signed_workbench_native_gui_entry', result: 'passed', version: result.workbenchVersion,
    build: result.workbenchBuild, status: result.workbenchStatus, screenshot: manifest.screenshot.file });
  await until(() => child.exitCode !== null || child.signalCode !== null, Boolean, 'desktop_window_close', 12000);
  manifest.cases.push({ name: 'native_window_close', result: 'passed', exitCode: child.exitCode, signal: child.signalCode });
  child = null;
  fs.rmSync(resultFile);
  const nativeBeforeRelaunch = nativeSessionRequests;
  child = spawn(appBinary, [], { cwd: root, env: { ...env, DGOS_DESKTOP_API_ORIGIN: apiOrigin, DGOS_DESKTOP_TEST_KEYCHAIN_SERVICE: service,
    DGOS_DESKTOP_TEST_RESTORE_PROBE: '1', DGOS_DESKTOP_TEST_WORKBENCH: undefined, DGOS_DESKTOP_TEST_RESULT_FILE: resultFile,
    DGOS_DESKTOP_WORKSPACE_FILE: path.join(stateDir, 'workspace.json') }, stdio: ['ignore', 'ignore', 'pipe'] });
  const scoped = path.join(stateDir, `workspace-${createHash('sha256').update(session.principalId).digest('hex')}.json`);
  await until(() => fs.existsSync(scoped), Boolean, 'subject_workspace', 10000);
  await until(() => nativeSessionRequests, (count) => count > nativeBeforeRelaunch, 'relaunch_native_session', 10000);
  assert.equal(key('get'), session.sessionId);
  const snapshot = JSON.parse(fs.readFileSync(scoped, 'utf8'));
  assert.equal(snapshot.windows.find((item) => item.label === 'main')?.route, '/catalog');
  const restored = await until(() => fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile, 'utf8')) : null,
    (value) => value?.stage === 'restored', 'restored_window_result', 10000);
  assert.equal(restored.route, '/catalog');
  assert.equal(restored.window.visible, true);
  assert.ok(restored.window.width >= 720 && restored.window.height >= 500);
  manifest.cases.push({ name: 'native_session_relaunch_subject_workspace', result: 'passed', workspaceScoped: true, nativeSessionRequests,
    persistedMainRoute: '/catalog', persistedMainWindow: snapshot.windows.find((item) => item.label === 'main'), restoredMainWindow: restored });
  manifest.result = 'passed';
} catch (error) {
  manifest.error = String(error.message).slice(0, 300);
  process.exitCode = 1;
} finally {
  const historyFile = resultFile.replace(/\.json$/, '.jsonl');
  if (fs.existsSync(historyFile)) {
    try { manifest.stageHistory = fs.readFileSync(historyFile, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)); }
    catch (error) { manifest.stageHistoryError = String(error.message).slice(0, 160); }
  }
  if (child?.exitCode === null && child.signalCode === null) { child.kill('SIGTERM'); await sleep(500); if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }
  if (testKeyWritten) {
    try { key('delete'); manifest.testKeychainItemDeleted = true; } catch { manifest.testKeychainItemDeleted = false; }
  }
  await runtime?.stop().catch(() => {});
  await api?.close().catch(() => {});
  await fixture?.close().catch(() => {});
  if (redis?.isOpen) {
    const keys = await redis.keys(`v1-desktop:${id}:secret:*`);
    if (keys.length) await redis.del(keys);
    manifest.redisPrefixRemaining = (await redis.keys(`v1-desktop:${id}:secret:*`)).length;
    await redis.quit();
  }
  await pool?.end().catch(() => {});
  if (dbCreated) await admin.query(`DROP DATABASE ${database} WITH (FORCE)`).catch((error) => { manifest.cleanup_error = error.message; });
  if (dbCreated && !manifest.cleanup_error) {
    const result = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database]);
    manifest.databaseRemoved = result.rowCount === 0;
  }
  await admin?.end().catch(() => {});
  fs.rmSync(stateDir, { recursive: true, force: true });
  manifest.source_sha256_after = Object.fromEntries(sourceFiles.map((file) => [file, hash(file)]));
  manifest.web_dist_sha256_after = Object.fromEntries(distFiles(path.join(root, 'apps/web/dist')).sort().map((file) => [file, hash(`apps/web/dist/${file}`)]));
  manifest.artifact_sha256_after = hash('apps/desktop/src-tauri/target/debug/bundle/macos/DGOS.app/Contents/MacOS/dgos-desktop');
  manifest.sourceDrift = JSON.stringify(manifest.source_sha256) !== JSON.stringify(manifest.source_sha256_after)
    || JSON.stringify(manifest.web_dist_sha256) !== JSON.stringify(manifest.web_dist_sha256_after)
    || manifest.artifact_sha256 !== manifest.artifact_sha256_after;
  if (manifest.sourceDrift) { manifest.result = 'failed'; manifest.error ??= 'source_or_web_dist_changed_during_run'; process.exitCode = 1; }
  manifest.finished_at = new Date().toISOString();
  manifest.cleanup = { testKeychainItemDeleted: testKeyWritten ? manifest.testKeychainItemDeleted : 'not_created', tempDirectoryDeleted: true,
    databaseRemoved: manifest.databaseRemoved ?? false, redisPrefixRemaining: manifest.redisPrefixRemaining ?? null };
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ result: manifest.result, cases: manifest.cases.map((item) => item.name), error: manifest.error, manifest: manifestName }));
}
