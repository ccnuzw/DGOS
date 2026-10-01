import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import pg from '../apps/api/node_modules/pg/lib/index.js';
import { discoverMigrations, buildMigrationSql } from './migrate.mjs';

const runId = `F-checks-${new Date().toISOString().replaceAll(/[:.]/g, '-')}`;
const directory = `docs/05-测试与发布/端到端验收/报告/${runId}`;
await mkdir(directory, { recursive: true });
const admin = new pg.Pool({ connectionString: 'postgresql://dgos:dgos@127.0.0.1:5432/dgos' });
const database = `dgos_f_${Date.now()}`;
await admin.query(`CREATE DATABASE ${database}`);
const url = `postgresql://dgos:dgos@127.0.0.1:5432/${database}`;
const pool = new pg.Pool({ connectionString: url });
const results = [];
const commands = [
  ['pnpm', ['test']],
  ['pnpm', ['run', 'test:web:e2e']],
  ['node', ['--test', 'tests/e2e/assistant-settings-actions.spec.mjs']],
  ['pnpm', ['run', 'check']],
  ['pnpm', ['-r', 'build']],
  ['pnpm', ['run', 'migrate:check']],
  ['node', ['scripts/check-docs.mjs']],
  ['node', ['scripts/docs-gate.mjs', '--phase', 'release', '--json']],
];
try {
  await pool.query(buildMigrationSql(await discoverMigrations()));
  await pool.query(buildMigrationSql(await discoverMigrations()));
  await pool.end();
  for (const [command, args] of commands) {
    const label = [command, ...args].join(' '); console.log(`Running ${label}`);
    const env = { ...process.env, DGOS_DATABASE_URL: url };
    if (args.some((arg) => arg.includes('assistant-settings-actions'))) delete env.DGOS_DATABASE_URL;
    const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 85000 });
    let output = ''; child.stdout.on('data', (chunk) => { output += chunk; }); child.stderr.on('data', (chunk) => { output += chunk; });
    const exitCode = await new Promise((resolve) => child.once('exit', resolve));
    const path = `${directory}/${results.length + 1}.txt`;
    await writeFile(path, output);
    results.push({ command: label, exit_code: exitCode, output: path }); console.log(`${label}: ${exitCode}`);
  }
} finally {
  await admin.query(`DROP DATABASE ${database} WITH (FORCE)`); await admin.end();
  await writeFile(`${directory}-manifest.json`, JSON.stringify({ run_id: runId, environment: 'local-isolated-postgres', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), commands: results, cleanup: '临时数据库已删除；原 dgos 数据库未由本脚本测试修改。', limitations: ['release docs-gate 预期因缺发布证据阻塞；不将其当作通过。'] }, null, 2) + '\n');
  console.log(`Evidence: ${directory}-manifest.json`);
  if (results.some((r) => r.exit_code && !r.command.includes('docs-gate'))) process.exitCode = 1;
}
