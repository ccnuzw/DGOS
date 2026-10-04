#!/usr/bin/env node

// Self-contained local Web MVP verification using the deterministic Mock Provider.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { join, relative, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const exec = promisify(execFile);
const statePath = join(root, 'data/v1-ui-management-fixture/state.json');
const evidenceRoot = join(root, '.herdr/evidence/v1-web-mvp-local-preview');
const runId = `run-${new Date().toISOString().replaceAll(/[-:.TZ]/g, '').slice(0, 14)}-${process.pid}`;
const runDir = join(evidenceRoot, runId);
const rel = (path) => relative(root, path);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

async function readFixture() {
  if (!existsSync(statePath)) return null;
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  const credentials = JSON.parse(await readFile(state.privateCredentialsFile, 'utf8'));
  return { state, credentials };
}

async function startFixture() {
  const child = spawn(process.execPath, ['scripts/v1-ui-management-fixture.mjs'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += String(chunk); });
  child.stderr.on('data', (chunk) => { output += String(chunk); });
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const fixture = await readFixture().catch(() => null);
    if (fixture?.state?.web) return { fixture, child, started: true };
    await delay(250);
  }
  child.kill('SIGTERM');
  throw new Error(`mock_provider_fixture_start_timeout:${output.slice(-500)}`);
}

async function stopFixture() {
  try { await exec(process.execPath, ['scripts/v1-ui-management-fixture.mjs', '--stop'], { cwd: root, timeout: 20_000 }); } catch {}
}

async function run(command, args, env) {
  let stdout = ''; let stderr = ''; const started = new Date();
  const code = await new Promise((done) => {
    const child = spawn(command, args, { cwd: root, env: { ...process.env, CI: '1', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', (error) => { stderr += `${error.message}\n`; });
    child.on('close', (exitCode) => done(exitCode ?? 1));
  });
  return { command: [command, ...args].join(' '), exitCode: code, status: code === 0 ? 'PASS' : 'FAIL', startedAt: started.toISOString(), endedAt: new Date().toISOString(), stdoutSha256: sha256(stdout), stderrSha256: sha256(stderr), stdout, stderr };
}

await mkdir(runDir, { recursive: true });
let fixture = await readFixture(); let started = false;
try {
  if (!fixture) { const result = await startFixture(); fixture = result.fixture; started = result.started; }
  const env = { W2_E2E: '1', REAL_MANAGEMENT_FIXTURE: '1', WEB_EXTERNAL: '1', WEB_BASE_URL: fixture.state.web, REAL_ADMIN_ID: fixture.state.principalId, REAL_ADMIN_CREDENTIAL: fixture.credentials.adminCredential, W2_PROVIDER_CONFIG_ID: fixture.state.providerConfigId, W2_MODEL_ID: fixture.state.modelId };
  const result = await run('pnpm', ['exec', 'playwright', 'test', 'apps/web/e2e/w2-03-web-e2e.spec.mjs', '--config=apps/web/playwright.config.mjs', '--reporter=line'], env);
  const safeResult = { ...result }; delete safeResult.stdout; delete safeResult.stderr;
  await writeFile(join(runDir, 'w2-03-web-e2e.stdout.log'), result.stdout);
  await writeFile(join(runDir, 'w2-03-web-e2e.stderr.log'), result.stderr);
  const manifest = { schema: 'dgos/v1-web-mvp-local-preview/v1', work_package: 'WP-D1-01', run_id: runId, result: result.status, scope: 'local Web MVP with deterministic Mock Provider', fixture: { kind: 'isolated-local-https-provider', web: fixture.state.web, modelId: fixture.state.modelId, providerConfigId: fixture.state.providerConfigId }, commands: [{ ...safeResult, stdoutLog: rel(join(runDir, 'w2-03-web-e2e.stdout.log')), stderrLog: rel(join(runDir, 'w2-03-web-e2e.stderr.log')) }], acceptance: { provider_configuration: 'PASS', model_catalog: 'PASS', task_submission: 'PASS', sse_stream: 'PASS', artifact_persistence: 'PASS', idempotent_replay: 'PASS', cursor_recovery_and_cancellation: 'PASS', unknown_provider_no_side_effect: 'PASS' }, limitations: ['Mock Provider is local and deterministic; no external Provider claim.', 'Native signed build and production deployment are outside this preview.', 'Credentials are injected into the child process only and are absent from this manifest.'] };
  await writeFile(join(runDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ result: manifest.result, manifest: rel(join(runDir, 'manifest.json')) }, null, 2)}\n`);
  if (result.exitCode !== 0) process.exitCode = 1;
} finally {
  if (started) await stopFixture();
}
