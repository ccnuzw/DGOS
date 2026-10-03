#!/usr/bin/env node

/**
 * Run one reproducible Wave 1 candidate batch.
 *
 * The batch binds source, assets, environment and every command result to one
 * immutable run directory. A failed run is never overwritten by a later run.
 * Web text-only and native Workbench evidence are intentionally independent.
 */
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { dirname, join, relative, resolve } from 'node:path';

const exec = promisify(execFile);
const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const evidenceRoot = join(root, '.herdr', 'evidence', 'w1-candidate-runs');
const now = new Date();
const stamp = now.toISOString().replaceAll(/[-:.TZ]/g, '').slice(0, 14);
const runId = `w1-${stamp}-${process.pid}`;
const runDir = join(evidenceRoot, runId);

const command = (id, group, argv, required = true) => ({ id, group, argv, required });
const defaultCommands = [
  command('check-docs', 'governance', ['node', 'scripts/check-docs.mjs']),
  command('typecheck', 'web-text-only', ['pnpm', '--filter', '@dgos/web', 'check']),
  command('provider-tests', 'web-text-only', ['node', '--test', 'tests/provider/*.test.mjs']),
  command('task-api-tests', 'web-text-only', ['node', '--test', 'tests/integration/ai-task-api.test.mjs', 'tests/integration/provider-worker.test.mjs']),
  command('native-static-check', 'native-workbench', ['pnpm', '--filter', '@dgos/desktop', 'check']),
];

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const iso = (date) => date.toISOString();

async function git(args) {
  const { stdout } = await exec('git', args, { cwd: root, maxBuffer: 256 * 1024 * 1024 });
  return stdout.trim();
}

async function fileSha256(path) {
  try { return sha256(await readFile(path)); } catch { return null; }
}

async function sourceSnapshot() {
  return {
    code_version: await git(['rev-parse', 'HEAD']),
    branch: await git(['branch', '--show-current']),
    dirty: (await git(['status', '--porcelain'])) !== '',
    patch_sha256: sha256(await git(['diff', '--binary', 'HEAD'])),
  };
}

async function treeSha256(path) {
  const entries = [];
  async function visit(current, prefix = '') {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = join(current, entry.name);
      if (entry.isSymbolicLink()) {
        entries.push(`${relPath}\0symlink`);
      } else if (entry.isDirectory()) {
        await visit(absolute, relPath);
      } else if (entry.isFile()) {
        entries.push(`${relPath}\0${await fileSha256(absolute)}`);
      }
    }
  }
  await visit(path);
  return sha256(entries.join('\n'));
}

async function snapshotAssets() {
  const candidates = [
    'apps/web/dist',
    'apps/desktop/src-tauri/target/release',
    'apps/ai-workbench-package/dist',
    'apps/web/package.json',
    'apps/desktop/package.json',
  ];
  const assets = [];
  for (const relPath of candidates) {
    const path = join(root, relPath);
    try {
      const info = await stat(path);
      if (info.isFile()) assets.push({ path: relPath, sha256: await fileSha256(path), size: info.size, kind: 'file' });
      else assets.push({ path: relPath, sha256: await treeSha256(path), kind: 'directory-tree' });
    } catch {
      assets.push({ path: relPath, sha256: null, present: false });
    }
  }
  return assets;
}

async function runCommand(spec, outputDir) {
  const started = new Date();
  let result = { exit_code: 1, signal: null, timed_out: false };
  let stdout = '';
  let stderr = '';
  const timeoutMs = Number(process.env.DGOS_CANDIDATE_TIMEOUT_MS || 180000);
  await new Promise((resolveRun) => {
    const child = spawn(spec.argv[0], spec.argv.slice(1), {
      cwd: root,
      env: { ...process.env, CI: '1', DGOS_CANDIDATE_RUN_ID: runId },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => { result.timed_out = true; child.kill('SIGTERM'); }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => { stderr += `${error.message}\n`; result.exit_code = 1; });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      result.exit_code = typeof code === 'number' ? code : 1;
      result.signal = signal || null;
      resolveRun();
    });
  });
  await writeFile(join(outputDir, `${spec.id}.stdout.log`), stdout);
  await writeFile(join(outputDir, `${spec.id}.stderr.log`), stderr);
  return { ...spec, ...result, started_at: iso(started), ended_at: iso(new Date()), stdout_log: relative(root, join(outputDir, `${spec.id}.stdout.log`)), stderr_log: relative(root, join(outputDir, `${spec.id}.stderr.log`)) };
}

async function main() {
  await mkdir(join(runDir, 'governance'), { recursive: true });
  await mkdir(join(runDir, 'web-text-only'), { recursive: true });
  await mkdir(join(runDir, 'native-workbench'), { recursive: true });
  const started = new Date();
  const sourceStart = await sourceSnapshot();
  const environment = {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    package_manager: await exec('pnpm', ['--version'], { cwd: root }).then(({ stdout }) => `pnpm ${stdout.trim()}`).catch(() => 'unavailable'),
    cwd: root,
  };
  const assets = await snapshotAssets();
  const commands = process.env.DGOS_W1_COMMANDS
    ? JSON.parse(process.env.DGOS_W1_COMMANDS).map((item) => ({ ...item, argv: [item.command, ...(item.args || [])] }))
    : defaultCommands;
  const results = [];
  for (const spec of commands) {
    const outputDir = join(runDir, spec.group);
    results.push({ ...(await runCommand(spec, outputDir)), status: 'passed' });
    results.at(-1).status = results.at(-1).exit_code === 0 ? 'passed' : 'failed';
  }
  const nativeE2e = process.env.DGOS_NATIVE_WORKBENCH_COMMAND
    ? { id: 'native-workbench-e2e', group: 'native-workbench', argv: process.env.DGOS_NATIVE_WORKBENCH_COMMAND.split(/\s+/), required: false }
    : null;
  if (nativeE2e) {
    results.push({ ...(await runCommand(nativeE2e, join(runDir, 'native-workbench'))), status: 'passed' });
    results.at(-1).status = results.at(-1).exit_code === 0 ? 'passed' : 'failed';
  } else {
    results.push({ id: 'native-workbench-e2e', group: 'native-workbench', argv: [], required: false, status: 'blocked', exit_code: null, limitation: 'No explicit macOS foreground-window/bridge E2E command supplied; static check is not runtime evidence.' });
  }
  const limitations = [
    'This batch records local host execution only.',
    'Web text-only and native Workbench results are separate evidence groups.',
    'Native static check does not prove foreground-window ownership, frame-present or bridge handshake.',
    'Native Workbench runtime E2E is blocked unless DGOS_NATIVE_WORKBENCH_COMMAND is supplied on macOS.',
  ];
  const failed = results.filter((item) => item.status === 'failed' && item.required);
  const sourceEnd = await sourceSnapshot();
  const sourceDrift = JSON.stringify(sourceStart) !== JSON.stringify(sourceEnd);
  const groups = Object.fromEntries(['governance', 'web-text-only', 'native-workbench'].map((group) => {
    const groupRows = results.filter((item) => item.group === group);
    const groupStatus = groupRows.some((item) => item.status === 'failed' && item.required) ? 'FAIL' : groupRows.some((item) => item.status === 'blocked') ? 'BLOCKED' : 'PASS';
    return [group, { result: groupStatus, commands: groupRows.map((item) => item.id) }];
  }));
  const batchResult = failed.length || sourceDrift ? 'FAIL' : Object.values(groups).some((group) => group.result === 'BLOCKED') ? 'BLOCKED' : 'PASS';
  const manifest = {
    schema: 'dgos/w1-candidate-regression/v1',
    work_package: 'WP-W1-03',
    run_id: runId,
    started_at: iso(started),
    ended_at: iso(new Date()),
    code_version: source.code_version,
    source: sourceStart,
    source_end: sourceEnd,
    source_drift: sourceDrift,
    asset_sha256: assets,
    environment,
    groups,
    commands: results,
    result: batchResult,
    limitations,
    evidence_root: relative(root, runDir),
  };
  await writeFile(join(runDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(runDir, 'report.md'), [
    `# ${runId}`,
    '',
    `- Result: ${manifest.result}`,
    `- Code version: \`${sourceStart.code_version}\``,
    `- Dirty working tree: ${sourceStart.dirty}`,
    `- Source drift during batch: ${sourceDrift}`,
    '',
    '| Group | Command | Status | Exit |',
    '| --- | --- | --- | ---: |',
    ...results.map((item) => `| ${item.group} | \`${item.argv?.join(' ') || item.id}\` | ${item.status} | ${item.exit_code ?? ''} |`),
    '',
    '## Limitations',
    ...limitations.map((item) => `- ${item}`),
    '',
  ].join('\n'));
  process.stdout.write(`${JSON.stringify({ run_id: runId, result: manifest.result, manifest: relative(root, join(runDir, 'manifest.json')) }, null, 2)}\n`);
  if (manifest.result !== 'PASS') process.exitCode = 1;
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
