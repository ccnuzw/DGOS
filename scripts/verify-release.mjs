import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from '../apps/api/node_modules/pg/lib/index.js';
import { discoverMigrations, buildMigrationSql } from './migrate.mjs';

const DEFAULT_COMMANDS = [
  // The root package's bare `node --test` can discover tests in worktrees.
  ['node', ['--test', '--test-concurrency=1', ...await discoverRootTests()]],
  ['pnpm', ['run', 'test:web:e2e']],
  ['node', ['--test', 'tests/e2e/assistant-settings-actions.spec.mjs']],
  ['pnpm', ['run', 'check']],
  ['pnpm', ['-r', 'build']],
  ['pnpm', ['run', 'migrate:check']],
  ['node', ['scripts/check-docs.mjs']],
  ['node', ['scripts/docs-gate.mjs', '--phase', 'release', '--json']],
];

export async function discoverRootTests(root = process.cwd()) {
  const base = resolve(root, 'tests');
  const walk = async (directory) => {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) files.push(...await walk(path));
      else if (entry.isFile() && /\.(?:test|spec)\.mjs$/.test(entry.name)) files.push(relative(root, path).split(sep).join('/'));
    }
    return files;
  };
  return (await walk(base)).sort();
}

export function validateAdminUrl(value) {
  if (!value) throw new Error('DGOS_VERIFY_ADMIN_URL is required');
  let url;
  try { url = new URL(value); } catch { throw new Error('DGOS_VERIFY_ADMIN_URL is invalid'); }
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !/^dgos_v1_integrated(?:_[a-z0-9_]+)?$/.test(name)) {
    throw new Error('DGOS_VERIFY_ADMIN_URL must name the dedicated dgos_v1_integrated database');
  }
  return url;
}

export function childDatabaseName() {
  return `dgos_v1_verify_${randomUUID().replaceAll('-', '')}`;
}

export async function runCommand(command, args, env, timeoutMs = 85000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform !== 'win32' && child.pid) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
      } else child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.once('error', (error) => { output += `\n${error.message}`; });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ exit_code: Number.isInteger(code) ? code : null, signal, timed_out: timedOut, output });
    });
  });
}

export function summarizeCommandResult(result) {
  return result.exit_code === 0 && !result.timed_out && !result.signal;
}

export function snapshotIdentity(head, entries) {
  if (entries.length === 0) return { commit: head, head_commit: head, working_tree_sha256: null };
  const hash = createHash('sha256');
  for (const [name, contents] of entries) {
    const nameBytes = Buffer.from(name);
    const body = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
    const length = Buffer.alloc(8);
    length.writeBigUInt64BE(BigInt(nameBytes.length)); hash.update(length); hash.update(nameBytes);
    length.writeBigUInt64BE(BigInt(body.length)); hash.update(length); hash.update(body);
  }
  return { commit: null, head_commit: head, working_tree_sha256: hash.digest('hex') };
}

const sourceScopes = ['apps', 'packages', 'src', 'migrations', 'scripts', 'tests', 'test-support', 'docs', 'deployment', 'deploy', 'infra', '.github', 'docker-compose.yml', 'docker-compose.integration.yml', 'docker-compose.production.yml', 'Dockerfile', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'docs-gate.json', 'docs-policy.json', 'docs-evidence.json', 'docs-facts.json'];
const reportRoot = 'docs/05-测试与发布/端到端验收/报告/';
const generatedEvidencePattern = /^(?:tests\/provider\/evidence\/V1-PROVIDER(?:-FAILURES)?-r[68]-[A-Za-z0-9_-]+(?:-manifest\.json|\.json|\.log)|tests\/extensions\/evidence\/V1-EXT-PUBLIC-r7-[A-Za-z0-9_-]+(?:-manifest\.json|\.json|\.log)|\.herdr\/V1-EXT-http-[A-Za-z0-9_-]+(?:-manifest)?\.json|\.herdr\/state\/package-http-evidence\/V1-package-http-[A-Za-z0-9_-]+(?:-manifest\.json|\.log\.json|\.md))$/;

export function parsePorcelainZ(status) {
  const tokens = status.toString('utf8').split('\0');
  if (tokens.at(-1) !== '') throw new Error('incomplete porcelain -z output');
  tokens.pop();
  const changes = [];
  for (let i = 0; i < tokens.length; i++) {
    const entry = tokens[i];
    if (!/^(?:[ MADRCTU?!]{2}) /.test(entry)) throw new Error('invalid porcelain -z entry');
    const xy = entry.slice(0, 2);
    const path = entry.slice(3);
    if (!path) throw new Error('empty porcelain path');
    let original = null;
    if (/[RC]/.test(xy)) {
      original = tokens[++i];
      if (!original) throw new Error('incomplete porcelain rename/copy pair');
    }
    changes.push({ xy, path, original });
  }
  return changes;
}

function evidenceOutputPaths(evidenceDir) {
  if (!evidenceDir) return null;
  const normalized = evidenceDir.replaceAll('\\', '/').replace(/\/$/, '');
  const name = normalized.slice(reportRoot.length);
  if (!normalized.startsWith(reportRoot) || !/^(?:F-checks|V1-regression|V1-candidate)-[A-Za-z0-9_-]+$/.test(name)) throw new Error('evidenceDir must be one precise generated report run');
  return { directory: `${normalized}/`, report: `${normalized}.md`, manifest: `${normalized}-manifest.json` };
}

export function isEvidenceOutput(path, evidenceDirs) {
  const dirs = Array.isArray(evidenceDirs) ? evidenceDirs : [evidenceDirs];
  return dirs.some((dir) => {
    const output = evidenceOutputPaths(dir);
    return Boolean(output && (path.startsWith(output.directory) || path === output.report || path === output.manifest));
  });
}

// Call from the repository root; only this run's generated reports are excluded.
export async function sourceIdentity({ evidenceDir = null, evidenceDirs = evidenceDir ? [evidenceDir] : [], generatedFiles = [] } = {}) {
  for (const dir of evidenceDirs) evidenceOutputPaths(dir);
  if (generatedFiles.some((path) => !generatedEvidencePattern.test(path))) throw new Error('generatedFiles must be exact harness evidence paths');
  const capture = async () => {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '-z', '--', ...sourceScopes], { maxBuffer: 16 * 1024 * 1024 });
    const entries = [];
    for (const change of parsePorcelainZ(status)) {
      if ((isEvidenceOutput(change.path, evidenceDirs) || generatedFiles.includes(change.path)) && (!change.original || isEvidenceOutput(change.original, evidenceDirs) || generatedFiles.includes(change.original))) continue;
      let contents;
      try { contents = await readFile(change.path); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        contents = '<deleted>';
      }
      entries.push([`${change.xy} ${change.path}\0${change.original ?? ''}`, contents]);
    }
    return snapshotIdentity(head, entries);
  };
  const first = await capture();
  const second = await capture();
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('Source changed during source snapshot');
  return second;
}

export async function executeVerification({ adminUrl, makePool = (url) => new pg.Pool({ connectionString: url }), commands = DEFAULT_COMMANDS, commandRunner = runCommand, migrationSql, evidenceDir, identity, identityReader = sourceIdentity, database = childDatabaseName(), timeoutMs = 600_000 }) {
  const parsed = validateAdminUrl(adminUrl);
  if (!/^dgos_v1_verify_[a-f0-9]{32}$/.test(database)) throw new Error('unsafe child database name');
  if (!evidenceDir || !identity) throw new Error('evidenceDir and identity are required');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000) throw new Error('timeoutMs must be a positive integer of at least 1000');
  const childUrl = new URL(parsed);
  childUrl.pathname = `/${database}`;
  const results = [];
  const admin = makePool(parsed.toString());
  let childPool;
  let created = false;
  let cleanup = 'not-created';
  let failure;
  let identityEnd = null;
  let sourceDrift = true;
  try {
    const actual = (await admin.query('SELECT current_database() AS name')).rows[0]?.name;
    if (actual !== decodeURIComponent(parsed.pathname.slice(1))) throw new Error(`admin database mismatch: ${actual}`);
    await admin.query(`CREATE DATABASE ${database}`);
    created = true;
    childPool = makePool(childUrl.toString());
    const childActual = (await childPool.query('SELECT current_database() AS name')).rows[0]?.name;
    if (childActual !== database) throw new Error(`child database mismatch: ${childActual}`);
    await childPool.query(migrationSql);
    await childPool.query(migrationSql);
    await childPool.end();
    childPool = null;
    for (const [command, args] of commands) {
      const label = [command, ...args].join(' ');
      const env = { ...process.env, DGOS_DATABASE_URL: childUrl.toString() };
      if (label.includes('assistant-settings-actions')) delete env.DGOS_DATABASE_URL;
      const result = await commandRunner(command, args, env, timeoutMs);
      const outputPath = `${evidenceDir}/${results.length + 1}.txt`;
      await writeFile(outputPath, result.output ?? '');
      const passed = summarizeCommandResult(result);
      results.push({ command: label, exit_code: result.exit_code, signal: result.signal ?? null, timed_out: Boolean(result.timed_out), timeout_ms: timeoutMs, passed, output: outputPath });
      console.log(`${label}: ${result.exit_code}${result.timed_out ? ' (timeout)' : ''}`);
      if (!passed) break;
    }
  } catch (error) {
    failure = error;
  } finally {
    try { if (childPool) await childPool.end(); } catch (error) { failure ??= error; }
    if (created) {
      try { await admin.query(`DROP DATABASE ${database} WITH (FORCE)`); cleanup = `dropped ${database}`; }
      catch (error) { cleanup = `failed to drop ${database}: ${error.message}`; failure ??= error; }
    }
    try { await admin.end(); } catch (error) { failure ??= error; }
    try { identityEnd = await identityReader({ evidenceDir }); sourceDrift = JSON.stringify(identity) !== JSON.stringify(identityEnd); }
    catch (error) { failure ??= error; }
    if (sourceDrift) failure ??= new Error('Source changed during verification');
    await writeFile(`${evidenceDir}-manifest.json`, JSON.stringify({ run_id: evidenceDir.split('/').at(-1), environment: 'local-isolated-postgres', ...identity, source_identity_start: identity, source_identity_end: identityEnd, source_drift: sourceDrift, admin_database: decodeURIComponent(parsed.pathname.slice(1)), child_database: database, commands: results, cleanup, error: failure?.message ?? null, limitations: ['A docs-gate failure is an observed release blocker, not a passed check.', 'An uncommitted source tree is identified by working_tree_sha256; HEAD alone is not the tested source.'] }, null, 2) + '\n');
  }
  return { ok: !failure && results.every((r) => r.passed), results, cleanup, error: failure?.message ?? null };
}

async function main() {
  const adminUrl = process.env.DGOS_VERIFY_ADMIN_URL;
  validateAdminUrl(adminUrl);
  const timeoutMs = Number(process.env.DGOS_VERIFY_COMMAND_TIMEOUT_MS ?? 600_000);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000) throw new Error('DGOS_VERIFY_COMMAND_TIMEOUT_MS must be an integer of at least 1000');
  const runId = `F-checks-${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const evidenceDir = `docs/05-测试与发布/端到端验收/报告/${runId}`;
  await mkdir(evidenceDir, { recursive: false });
  const identity = await sourceIdentity({ evidenceDir });
  const result = await executeVerification({ adminUrl, migrationSql: buildMigrationSql(await discoverMigrations()), evidenceDir, identity, timeoutMs });
  console.log(`Evidence: ${evidenceDir}-manifest.json`);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
