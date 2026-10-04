#!/usr/bin/env node

/** V1 final integration matrix runner. Every section is an isolated command result. */
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { dirname, join, relative, resolve } from 'node:path';

const exec = promisify(execFile);
const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const stamp = new Date().toISOString().replaceAll(/[-:.TZ]/g, '').slice(0, 14);
const runId = `w4-final-${stamp}-${process.pid}`;
const runDir = join(root, '.herdr', 'evidence', 'w4-final-runs', runId);
const sha = value => createHash('sha256').update(value).digest('hex');
const rel = path => relative(root, path);
const iso = date => date.toISOString();

async function git(args) { return (await exec('git', args, { cwd: root, maxBuffer: 256 * 1024 * 1024 })).stdout.trim(); }
async function source() { return { commit: await git(['rev-parse', 'HEAD']), branch: await git(['branch', '--show-current']), patch_sha256: sha(await git(['diff', '--binary', 'HEAD', '--', 'apps', 'packages', 'src', 'tests', 'docs', 'migrations'])), working_tree_dirty: Boolean(await git(['status', '--porcelain'])) }; }
async function treeHash(path) {
  try {
    const info = await stat(join(root, path));
    if (info.isFile()) return { path, kind: 'file', sha256: sha(await readFile(join(root, path))) };
    const entries = [];
    async function walk(dir, prefix = '') { for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) { const abs = join(dir, entry.name); const name = prefix ? `${prefix}/${entry.name}` : entry.name; if (entry.isDirectory()) await walk(abs, name); else if (entry.isFile()) entries.push(`${name}\0${sha(await readFile(abs))}`); } }
    await walk(join(root, path));
    return { path, kind: 'directory', files: entries.length, sha256: sha(entries.join('\n')) };
  } catch { return { path, present: false, sha256: null }; }
}
async function fixtureCredentials() {
  try {
    const statePath = join(root, 'data/v1-ui-management-fixture/state.json');
    const state = JSON.parse(await readFile(statePath, 'utf8'));
    const credentials = JSON.parse(await readFile(state.privateCredentialsFile, 'utf8'));
    return { state, env: { REAL_ADMIN_ID: state.principalId, REAL_ADMIN_CREDENTIAL: credentials.adminCredential, W2_PROVIDER_CONFIG_ID: state.providerConfigId, W2_MODEL_ID: state.modelId, REAL_MANAGEMENT_FIXTURE: '1', W2_E2E: '1', WEB_EXTERNAL: '1', WEB_BASE_URL: state.web }, source: { state: rel(statePath), credentials: rel(state.privateCredentialsFile), credentials_sha256: sha(await readFile(state.privateCredentialsFile)) } };
  } catch { return null; }
}
async function migrationSet() {
  const migrationsDir = join(root, 'migrations');
  const files = (await readdir(migrationsDir)).filter(file => file.endsWith('.sql')).sort();
  const rows = await Promise.all(files.map(async file => `${file}\0${sha(await readFile(join(migrationsDir, file)))}`));
  return { files, sha256: sha(rows.join('\n')) };
}
async function readiness() {
  const evidence = JSON.parse(await readFile(join(root, '.herdr/evidence/WP-W3-02-native-bridge-fix-2026-10-04.json'), 'utf8'));
  return { w3_02_native: evidence.status, native_handshake: evidence.acceptance?.handshake, task_artifact_reload: evidence.acceptance?.taskArtifactReload, ready: evidence.status === 'completed' && evidence.acceptance?.handshake === 'passed' && evidence.acceptance?.taskArtifactReload === 'passed' };
}
async function run(spec) {
  const dir = join(runDir, spec.group); await mkdir(dir, { recursive: true });
  const started = new Date(); let stdout = ''; let stderr = ''; let exit = 1; let signal = null;
  await new Promise(done => { const child = spawn(spec.argv[0], spec.argv.slice(1), { cwd: root, env: { ...process.env, CI: '1', W2_E2E_RUN_ID: runId, ...spec.env }, stdio: ['ignore', 'pipe', 'pipe'] }); child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; }); child.on('error', error => { stderr += `${error.message}\n`; }); child.on('close', (code, sig) => { exit = typeof code === 'number' ? code : 1; signal = sig; done(); }); });
  const outPath = join(dir, `${spec.id}.stdout.log`), errPath = join(dir, `${spec.id}.stderr.log`);
  await writeFile(outPath, stdout); await writeFile(errPath, stderr);
  const isPlaywright = spec.argv.includes('playwright');
  const skipped = Number(stdout.match(/\b(\d+) skipped\b/)?.[1] || 0);
  const tests = Number(stdout.match(/Running (\d+) tests?/)?.[1] || stdout.match(/# tests (\d+)/)?.[1] || 0);
  const row = { id: spec.id, group: spec.group, argv: spec.argv, exit_code: exit, signal, result: exit ? 'FAIL' : isPlaywright && (skipped || !tests) ? 'INCOMPLETE' : 'PASS', tests, skipped, started_at: iso(started), ended_at: iso(new Date()), stdout_log: rel(outPath), stderr_log: rel(errPath) };
  return row;
}

async function main() {
  for (const group of ['web', 'fr002', 'fr003', 'fr009', 'native', 'gates']) await mkdir(join(runDir, group), { recursive: true });
  const started = new Date(); const sourceStart = await source(); const fixture = await fixtureCredentials(); const prerequisites = await readiness();
  const commonWeb = fixture?.env || {};
  const commands = [
    { id: 'web-provider-task-recovery', group: 'web', argv: ['pnpm', 'exec', 'playwright', 'test', 'apps/web/e2e/w2-03-web-e2e.spec.mjs', '--grep', 'login, provider|duplicate requestId|SSE cursor', '--config=apps/web/playwright.config.mjs', '--reporter=line'], env: commonWeb },
    { id: 'fr002-catalog-lifecycle', group: 'fr002', argv: ['node', '--test', '--test-concurrency=1', 'tests/integration/app-package-fixture.test.mjs', 'tests/integration/app-package-routes.test.mjs', 'tests/unit/app-packages.test.mjs', 'tests/unit/runtime.test.mjs'], env: {} },
    { id: 'fr003-skill-and-mcp', group: 'fr003', argv: ['pnpm', 'exec', 'playwright', 'test', 'apps/web/e2e/real-management-fixture.spec.mjs', '--grep', 'Skill definition|Skill translation|MCP first credential|MCP connects', '--config=apps/web/playwright.config.mjs', '--reporter=line'], env: commonWeb },
    { id: 'fr009-assistant-permission-confirm-cancel-recovery', group: 'fr009', argv: ['node', '--test', '--test-concurrency=1', 'tests/e2e/assistant-settings-actions.spec.mjs'], env: {} },
    { id: 'native-desktop-static-check', group: 'native', argv: ['pnpm', '--filter', '@dgos/desktop', 'check'], env: {} },
    { id: 'native-session-smoke', group: 'native', argv: ['node', 'apps/desktop/scripts/e2e-macos.mjs'], env: {} },
    { id: 'native-workbench-task-artifact', group: 'native', argv: ['node', 'apps/desktop/scripts/native-workbench-diagnostic.mjs'], env: {} },
    { id: 'migration-contract', group: 'gates', argv: ['node', 'scripts/check-migration.mjs'], env: {} },
    { id: 'docs-structure', group: 'gates', argv: ['node', 'scripts/check-docs.mjs'], env: {} },
    { id: 'secret-scan', group: 'gates', argv: ['node', 'scripts/secret-scan.mjs', '--paths', 'scripts', '.herdr', 'docs', 'packages'], env: {} },
  ];
  const prepareOnly = process.argv.includes('--prepare') || !prerequisites.ready;
  const results = [];
  for (const spec of commands) {
    if (prepareOnly && (spec.group === 'web' || spec.group === 'fr003' || spec.group === 'fr009' || spec.group === 'native')) {
      results.push({ id: spec.id, group: spec.group, argv: spec.argv, result: 'BLOCKED', exit_code: null, reason: `W3 final prerequisites not met: native_status=${prerequisites.w3_02_native}, handshake=${prerequisites.native_handshake}, taskArtifactReload=${prerequisites.task_artifact_reload}` });
    } else results.push(await run(spec));
  }
  const sourceEnd = await source();
  const sourceDrift = sourceStart.commit !== sourceEnd.commit || sourceStart.patch_sha256 !== sourceEnd.patch_sha256;
  const groups = Object.fromEntries(['web', 'fr002', 'fr003', 'fr009', 'native', 'gates'].map(group => { const rows = results.filter(row => row.group === group); const state = rows.some(row => row.result === 'FAIL') ? 'FAIL' : rows.some(row => row.result === 'BLOCKED') ? 'BLOCKED' : rows.some(row => row.result === 'INCOMPLETE') ? 'INCOMPLETE' : 'PASS'; return [group, { result: state, commands: rows.map(row => row.id) }]; }));
  const nativeEvidence = await readFile(join(runDir, 'native', 'native-session-smoke.stdout.log'), 'utf8').catch(() => '');
  const nativeSmoke = (() => { const line = nativeEvidence.split(/\r?\n/).find(item => item.startsWith('{"result"')); try { return line ? JSON.parse(line) : null; } catch { return null; } })();
  const limitations = [
    'Final candidate requires a frozen source/build; any source drift blocks a pass.',
    'Local deterministic Provider fixture is not external Provider evidence.',
    'Native macOS smoke script covers session/webview bridge only; it does not prove Workbench iframe handshake, Task or Artifact.',
    'MCP/Assistant fixture tests use isolated local resources and do not replace production-provider or signed-release evidence.',
    'Commands returning skipped or having no detectable Playwright tests are INCOMPLETE, never PASS.',
  ];
  const overall = sourceDrift || Object.values(groups).some(group => ['FAIL', 'INCOMPLETE'].includes(group.result)) ? 'FAIL' : Object.values(groups).some(group => group.result === 'BLOCKED') ? 'BLOCKED' : 'PASS';
  const manifest = { schema: 'dgos/w4-final-integration/v1', work_package: 'WP-W4-01', run_id: runId, mode: prepareOnly ? 'prepare' : 'final-candidate', started_at: iso(started), ended_at: iso(new Date()), source: sourceStart, source_end: sourceEnd, source_drift: sourceDrift, prerequisites, assets: await Promise.all(['apps/web/dist', 'apps/desktop/src-tauri/target/debug/bundle/macos/DGOS.app', 'apps/desktop/src-tauri/target/debug/dgos-keychain-fixture', 'apps/ai-workbench-package/dist'].map(treeHash)), migration_set: await migrationSet(), environment: { platform: process.platform, arch: process.arch, node: process.version, package_manager: await exec('pnpm', ['--version']).then(result => `pnpm ${result.stdout.trim()}`).catch(() => 'unavailable'), base_url: fixture?.state.web || null, database_name: fixture?.state.database || null, redis_db: fixture?.state.redisDb ?? null }, fixture_source: fixture?.source || null, native_smoke: nativeSmoke, groups, commands: results, result: overall, mvp_demo_ready: overall === 'PASS' && prerequisites.ready, limitations, evidence_root: rel(runDir) };
  await writeFile(join(runDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(runDir, 'report.md'), [`# ${runId}`, '', `- Final result: ${manifest.result}`, `- MVP demo ready: ${manifest.mvp_demo_ready}`, `- Commit: \`${sourceStart.commit}\``, `- Source drift: ${sourceDrift}`, '', '| Matrix group | Result | Commands |', '| --- | --- | --- |', ...Object.entries(groups).map(([name, item]) => `| ${name} | ${item.result} | ${item.commands.join(', ')} |`), '', '## Limitations', ...limitations.map(value => `- ${value}`), ''].join('\n'));
  process.stdout.write(`${JSON.stringify({ run_id: runId, result: manifest.result, manifest: rel(join(runDir, 'manifest.json')) }, null, 2)}\n`);
  if (manifest.result !== 'PASS') process.exitCode = 1;
}
main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
