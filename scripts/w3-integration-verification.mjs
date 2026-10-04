#!/usr/bin/env node

/** Wave 3 integration evidence runner. Commands are intentionally explicit. */
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { dirname, join, relative, resolve } from 'node:path';

const exec = promisify(execFile);
const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const runId = `w3-${new Date().toISOString().replaceAll(/[-:.TZ]/g, '').slice(0, 14)}-${process.pid}`;
const runDir = join(root, '.herdr', 'evidence', 'w3-integration-runs', runId);
const sha = value => createHash('sha256').update(value).digest('hex');
const rel = path => relative(root, path);
const iso = date => date.toISOString();

async function git(args) { return (await exec('git', args, { cwd: root, maxBuffer: 256 * 1024 * 1024 })).stdout.trim(); }
async function source() { return { code_version: await git(['rev-parse', 'HEAD']), branch: await git(['branch', '--show-current']), dirty: Boolean(await git(['status', '--porcelain'])), patch_sha256: sha(await git(['diff', '--binary', 'HEAD', '--', 'apps', 'packages', 'src', 'tests', 'docs', 'migrations'])) }; }
async function fixtureEnv() {
  try {
    const state = JSON.parse(await readFile(join(root, 'data/v1-ui-management-fixture/state.json'), 'utf8'));
    const credentialsPath = state.privateCredentialsFile;
    const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
    return { env: { REAL_ADMIN_ID: state.principalId, REAL_ADMIN_CREDENTIAL: credentials.adminCredential, W2_PROVIDER_CONFIG_ID: state.providerConfigId, W2_MODEL_ID: state.modelId, REAL_MANAGEMENT_FIXTURE: '1', W2_E2E: '1', WEB_EXTERNAL: '1', WEB_BASE_URL: state.web }, source: credentialsPath };
  } catch { return { env: {}, source: null }; }
}
async function asset(path) {
  try {
    const info = await stat(join(root, path));
    if (info.isFile()) return { path, kind: 'file', sha256: sha(await readFile(join(root, path))), size: info.size };
    const rows = [];
    async function walk(base, prefix = '') { for (const entry of (await readdir(base, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) { const child = join(base, entry.name); const name = prefix ? `${prefix}/${entry.name}` : entry.name; if (entry.isDirectory()) await walk(child, name); else if (entry.isFile()) rows.push(`${name}\0${sha(await readFile(child))}`); } }
    await walk(join(root, path));
    return { path, kind: 'directory-tree', sha256: sha(rows.join('\n')), files: rows.length };
  } catch { return { path, present: false, sha256: null }; }
}
function command(id, group, argv, env = {}) { return { id, group, argv, env }; }
async function run(spec, dir, inheritedEnv = {}) {
  const started = new Date(); let stdout = ''; let stderr = ''; let code = 1; let signal = null;
  await new Promise(done => { const child = spawn(spec.argv[0], spec.argv.slice(1), { cwd: root, env: { ...process.env, CI: '1', ...inheritedEnv, ...spec.env }, stdio: ['ignore', 'pipe', 'pipe'] }); child.stdout.on('data', c => { stdout += c; }); child.stderr.on('data', c => { stderr += c; }); child.on('error', e => { stderr += `${e.message}\n`; }); child.on('close', (exit, sig) => { code = typeof exit === 'number' ? exit : 1; signal = sig; done(); }); });
  await writeFile(join(dir, `${spec.id}.stdout.log`), stdout); await writeFile(join(dir, `${spec.id}.stderr.log`), stderr);
  return { id: spec.id, group: spec.group, argv: spec.argv, exit_code: code, signal, status: code === 0 ? 'passed' : 'failed', started_at: iso(started), ended_at: iso(new Date()), stdout_log: rel(join(dir, `${spec.id}.stdout.log`)), stderr_log: rel(join(dir, `${spec.id}.stderr.log`)) };
}

async function main() {
  await mkdir(join(runDir, 'web'), { recursive: true }); await mkdir(join(runDir, 'fr002'), { recursive: true }); await mkdir(join(runDir, 'native'), { recursive: true });
  const started = new Date(); const sourceStart = await source(); const fixture = await fixtureEnv();
  const webEnv = { ...fixture.env, WEB_EXTERNAL: '1', WEB_BASE_URL: 'http://127.0.0.1:15176' };
  const commands = [
    command('web-e2e-fr003-fr009', 'web', ['pnpm', 'exec', 'playwright', 'test', 'apps/web/e2e/real-management-fixture.spec.mjs', '--grep', 'Skill definition|Skill translation|assistant request', '--config=apps/web/playwright.config.mjs', '--reporter=line'], webEnv),
    command('web-e2e-w2-provider-task', 'web', ['pnpm', 'exec', 'playwright', 'test', 'apps/web/e2e/w2-03-web-e2e.spec.mjs', '--config=apps/web/playwright.config.mjs', '--reporter=line'], webEnv),
    command('fr002-api-and-lifecycle', 'fr002', ['node', '--test', '--test-concurrency=1', 'tests/integration/app-package-fixture.test.mjs', 'tests/unit/app-packages.test.mjs', 'tests/unit/runtime.test.mjs']),
    command('provider-task-api', 'fr002', ['node', '--test', '--test-concurrency=1', 'tests/integration/ai-task-api.test.mjs', 'tests/integration/provider-worker.test.mjs', 'tests/provider/profile-task-wiring.test.mjs']),
    command('native-static-check', 'native', ['pnpm', '--filter', '@dgos/desktop', 'check']),
    command('native-smoke', 'native', ['node', 'apps/desktop/scripts/e2e-macos.mjs']),
  ];
  const results = [];
  for (const spec of commands) {
    const row = await run(spec, join(runDir, spec.group), fixture.env);
    if (spec.group === 'web') {
      const out = await readFile(join(root, row.stdout_log), 'utf8');
      const skipped = Number(out.match(/\b(\d+) skipped\b/)?.[1] || 0);
      const total = Number(out.match(/Running (\d+) tests?/)?.[1] || 0);
      row.skipped = skipped;
      row.executed = Math.max(0, total - skipped);
      if (skipped > 0 || total === 0) row.status = 'incomplete';
    }
    results.push(row);
  }
  const sourceEnd = await source();
  const sourceDrift = sourceStart.code_version !== sourceEnd.code_version || sourceStart.patch_sha256 !== sourceEnd.patch_sha256;
  const groups = Object.fromEntries(['web', 'fr002', 'native'].map(group => { const rows = results.filter(r => r.group === group); return [group, { result: rows.some(r => r.status === 'failed') ? 'FAIL' : rows.some(r => r.status === 'incomplete') ? 'INCOMPLETE' : 'PASS', commands: rows.map(r => r.id) }]; }));
  const manifest = { schema: 'dgos/w3-integration-verification/v1', work_package: 'WP-W3-04', run_id: runId, started_at: iso(started), ended_at: iso(new Date()), source: sourceStart, source_end: sourceEnd, source_drift: sourceDrift, asset_sha256: await Promise.all(['apps/web/dist', 'apps/desktop/src-tauri/target/debug/bundle/macos/DGOS.app', 'apps/desktop/src-tauri/target/debug/dgos-keychain-fixture', 'apps/ai-workbench-package/dist'].map(asset)), environment: { platform: process.platform, arch: process.arch, node: process.version, package_manager: await exec('pnpm', ['--version']).then(x => `pnpm ${x.stdout.trim()}`).catch(() => 'unavailable'), cwd: root }, credential_source: fixture.source ? { path: rel(fixture.source), sha256: sha(await readFile(fixture.source)) } : null, groups, commands: results, result: sourceDrift || Object.values(groups).some(g => ['FAIL', 'INCOMPLETE'].includes(g.result)) ? 'FAIL' : 'PASS', limitations: ['Web fixture uses deterministic local Provider upstream; it is not external Provider evidence.', 'Native smoke proves process/window/webview bridge/keychain session only; it does not assert Provider/Task/Artifact.', 'Historical reports and prior builds are not included in this manifest.', 'A failing command remains evidence and cannot be promoted to PASS.'], evidence_root: rel(runDir) };
  await writeFile(join(runDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(runDir, 'report.md'), [`# ${runId}`, '', `- Result: ${manifest.result}`, `- Code version: \`${sourceStart.code_version}\``, `- Source drift: ${sourceDrift}`, '', '| Group | Command | Result | Exit |', '| --- | --- | --- | ---: |', ...results.map(r => `| ${r.group} | \`${r.argv.join(' ')}\` | ${r.status} | ${r.exit_code} |`), '', '## Limitations', ...manifest.limitations.map(x => `- ${x}`), ''].join('\n'));
  process.stdout.write(`${JSON.stringify({ run_id: runId, result: manifest.result, manifest: rel(join(runDir, 'manifest.json')) }, null, 2)}\n`); if (manifest.result !== 'PASS') process.exitCode = 1;
}
main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
