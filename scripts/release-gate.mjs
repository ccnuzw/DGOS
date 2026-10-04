import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { buildCandidateManifest } from './candidate-freeze.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const DEFAULT_GATES = [
  { id: 'migration', command: 'pnpm', args: ['run', 'migrate:check'] },
  { id: 'secret-scan', command: 'node', args: ['scripts/secret-scan.mjs'] },
  { id: 'docs-check', command: 'node', args: ['scripts/check-docs.mjs'] },
  { id: 'docs-release-gate', command: 'node', args: ['scripts/docs-gate.mjs', '--phase', 'release', '--json'] },
];

export function run(command, args, env = process.env, timeoutMs = 120_000) {
  return new Promise((resolveResult) => {
    const child = spawn(command, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid && process.platform !== 'win32') { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
      child.kill('SIGTERM');
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.once('error', (error) => { output += `\n${error.message}`; });
    child.once('close', (code, signal) => { clearTimeout(timer); resolveResult({ exit_code: code, signal, timed_out: timedOut, passed: code === 0 && !signal && !timedOut, output }); });
  });
}

export async function runReleaseGates({ output = `candidates/${Date.now()}/release-gate.json`, gates = DEFAULT_GATES, env = process.env } = {}) {
  const candidate = await buildCandidateManifest({ output: `${output}.candidate.json` });
  const results = [];
  for (const gate of gates) results.push({ id: gate.id, ...await run(gate.command, gate.args, env) });
  const passed = results.every((result) => result.passed);
  const limitations = [
    'A passing local gate does not prove macOS signing/notarization, a real external Provider, target-environment restore, performance approval, or production readiness.',
    ...(candidate.source.dirty ? ['Candidate source tree is dirty and is not release eligible.'] : []),
  ];
  const report = { schema: 'dgos/v1-release-gate', gate_run_id: `gate-${new Date().toISOString()}-${randomUUID().slice(0, 8)}`, created_at: new Date().toISOString(), candidate, status: passed && !candidate.source.dirty ? 'passed' : 'blocked', gates: results.map(({ output: _output, ...result }) => result), limitations };
  await mkdir(dirname(resolve(ROOT, output)), { recursive: true });
  await writeFile(resolve(ROOT, output), `${JSON.stringify(report, null, 2)}\n`);
  for (const result of results) await writeFile(resolve(ROOT, `${output}.${result.id}.log`), result.output);
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outputIndex = process.argv.indexOf('--output');
  const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : `candidates/${Date.now()}/release-gate.json`;
  const report = await runReleaseGates({ output });
  console.log(JSON.stringify({ status: report.status, gate_run_id: report.gate_run_id, manifest: output, gates: report.gates }, null, 2));
  if (report.status !== 'passed') process.exitCode = 2;
}
