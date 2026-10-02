import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { executeVerification, runCommand, snapshotIdentity, sourceIdentity, validateAdminUrl, childDatabaseName, discoverRootTests, parsePorcelainZ, isEvidenceOutput } from '../../scripts/verify-release.mjs';

const adminUrl = 'postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_integrated';
const database = childDatabaseName();

test('admin URL rejects missing or original business database before opening a pool', async () => {
  assert.throws(() => validateAdminUrl(undefined), /required/);
  assert.throws(() => validateAdminUrl('postgresql://dgos:dgos@127.0.0.1:5432/dgos'), /dedicated/);
  assert.throws(() => validateAdminUrl('postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_actions'), /dedicated/);
  let opened = false;
  await assert.rejects(executeVerification({ adminUrl: 'postgresql://dgos:dgos@127.0.0.1:5432/dgos', makePool: () => { opened = true; }, migrationSql: '', evidenceDir: '/tmp/unused', identity: {}, database }), /dedicated/);
  assert.equal(opened, false);
});

test('nonzero child exit is recorded and only the generated child database is dropped', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-verify-test-'));
  await mkdir(join(dir, 'run'));
  const queries = [];
  const makePool = (url) => ({
    async query(sql) {
      queries.push([new URL(url).pathname.slice(1), sql]);
      if (sql.startsWith('SELECT current_database()')) return { rows: [{ name: new URL(url).pathname.slice(1) }] };
      return { rows: [] };
    },
    async end() {},
  });
  try {
    const observedTimeouts = [];
    const identity = snapshotIdentity('head', [['src/file', 'changed']]);
    const result = await executeVerification({ adminUrl, makePool, migrationSql: 'SELECT 1', evidenceDir: join(dir, 'run'), identity, identityReader: async () => identity, database, timeoutMs: 180_000, commands: [['node', ['broken']], ['node', ['never-run']]], commandRunner: async (_command, _args, _env, timeoutMs) => { observedTimeouts.push(timeoutMs); return { exit_code: 2, output: 'failed' }; } });
    assert.equal(result.ok, false);
    assert.equal(result.results.length, 1);
    assert.deepEqual(observedTimeouts, [180_000]);
    assert.equal(result.results[0].timeout_ms, 180_000);
    assert.equal(result.cleanup, `dropped ${database}`);
    assert.deepEqual(queries.filter(([, sql]) => sql.startsWith('DROP DATABASE')), [['dgos_v1_integrated', `DROP DATABASE ${database} WITH (FORCE)`]]);
    const manifest = JSON.parse(await readFile(join(dir, 'run-manifest.json'), 'utf8'));
    assert.equal(manifest.commit, null);
    assert.match(manifest.working_tree_sha256, /^[a-f0-9]{64}$/);
    assert.equal(manifest.commands[0].passed, false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('migration failure still drops only the created child database', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-verify-test-'));
  const queries = [];
  const makePool = (url) => ({
    async query(sql) {
      queries.push(sql);
      if (sql.startsWith('SELECT current_database()')) return { rows: [{ name: new URL(url).pathname.slice(1) }] };
      if (sql === 'BAD MIGRATION') throw new Error('migration failed');
      return { rows: [] };
    },
    async end() {},
  });
  try {
    const identity = snapshotIdentity('head', []);
    const result = await executeVerification({ adminUrl, makePool, migrationSql: 'BAD MIGRATION', evidenceDir: join(dir, 'run'), identity, identityReader: async () => identity, database, commands: [] });
    assert.equal(result.ok, false);
    assert.match(result.error, /migration failed/);
    assert.ok(queries.includes(`DROP DATABASE ${database} WITH (FORCE)`));
    assert.equal(queries.some((sql) => /DROP DATABASE dgos(?:\s|$)/.test(sql)), false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('timeout and signal produce non-success even without numeric exit code', async () => {
  const result = await runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 1000)'], process.env, 20);
  assert.equal(result.timed_out, true);
  assert.equal(result.exit_code, null);
  assert.equal(result.signal, 'SIGKILL');
});

test('null child exit is recorded as failure and halts later commands', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-verify-test-'));
  await mkdir(join(dir, 'run'));
  const calls = [];
  const makePool = (url) => ({
    async query(sql) {
      if (sql.startsWith('SELECT current_database()')) return { rows: [{ name: new URL(url).pathname.slice(1) }] };
      return { rows: [] };
    },
    async end() {},
  });
  try {
    const identity = snapshotIdentity('head', []);
    const result = await executeVerification({ adminUrl, makePool, migrationSql: 'SELECT 1', evidenceDir: join(dir, 'run'), identity, identityReader: async () => identity, database: childDatabaseName(), commands: [['node', ['first']], ['node', ['second']]], commandRunner: async (command, args) => { calls.push(args[0]); return { exit_code: null, signal: 'SIGKILL', timed_out: true, output: '' }; } });
    assert.equal(result.ok, false);
    assert.deepEqual(calls, ['first']);
    assert.equal(result.results[0].passed, false);
    const manifest = JSON.parse(await readFile(join(dir, 'run-manifest.json'), 'utf8'));
    assert.equal(manifest.commands[0].exit_code, null);
    assert.equal(manifest.commands[0].timed_out, true);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('dirty source identity does not pretend HEAD is the tested commit', () => {
  assert.equal(snapshotIdentity('head', []).commit, 'head');
  const dirty = snapshotIdentity('head', [['src/a.mjs', 'one']]);
  assert.equal(dirty.commit, null);
  assert.notEqual(dirty.working_tree_sha256, snapshotIdentity('head', [['src/a.mjs', 'two']]).working_tree_sha256);
  assert.notEqual(snapshotIdentity('head', [['a', 'bc']]).working_tree_sha256, snapshotIdentity('head', [['ab', 'c']]).working_tree_sha256);
});

test('porcelain -z consumes rename and copy source paths as pairs', () => {
  assert.deepEqual(parsePorcelainZ(Buffer.from('R  docs/new.md\0docs/old.md\0 M src/service.mjs\0?? docs/new-contract.md\0')), [
    { xy: 'R ', path: 'docs/new.md', original: 'docs/old.md' },
    { xy: ' M', path: 'src/service.mjs', original: null },
    { xy: '??', path: 'docs/new-contract.md', original: null },
  ]);
  assert.throws(() => parsePorcelainZ(Buffer.from('R  docs/new.md\0')), /incomplete/);
  const oldName = snapshotIdentity('head', [['R  docs/new.md\0docs/old.md', 'same']]);
  const otherName = snapshotIdentity('head', [['R  docs/new.md\0docs/other.md', 'same']]);
  assert.notEqual(oldName.working_tree_sha256, otherName.working_tree_sha256);
});

test('only exact generated report paths are excluded from source identity', () => {
  const run = 'docs/05-测试与发布/端到端验收/报告/V1-regression-fixture';
  assert.equal(isEvidenceOutput(`${run}/001.tap.txt`, run), true);
  assert.equal(isEvidenceOutput(`${run}.md`, run), true);
  assert.equal(isEvidenceOutput(`${run}-manifest.json`, run), true);
  assert.equal(isEvidenceOutput(`${run}-other.md`, run), false);
  assert.equal(isEvidenceOutput('docs/05-测试与发布/端到端验收/验证证据.md', run), false);
  assert.equal(isEvidenceOutput('docs/03-功能规格/V1/README.md', run), false);
  assert.throws(() => isEvidenceOutput('docs/README.md', 'docs'), /precise generated report/);
});

test('source identity ignores only current generated report and detects docs and rename drift', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-source-identity-'));
  const run = 'docs/05-测试与发布/端到端验收/报告/V1-regression-fixture';
  const source = resolve('scripts/verify-release.mjs');
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { stdio: 'ignore' });
  const capture = () => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `import { sourceIdentity } from ${JSON.stringify(source)}; console.log(JSON.stringify(await sourceIdentity({ evidenceDir: ${JSON.stringify(run)} })));`], { cwd: dir, encoding: 'utf8' }));
  try {
    git('init');
    await mkdir(join(dir, 'docs/05-测试与发布/端到端验收/报告'), { recursive: true });
    await mkdir(join(dir, 'tests'));
    await writeFile(join(dir, 'docs/contract.md'), 'original');
    git('add', 'docs/contract.md');
    git('-c', 'user.name=Verify', '-c', 'user.email=verify@local.invalid', 'commit', '-m', 'fixture');
    const before = capture();
    assert.equal(before.commit, before.head_commit);
    await mkdir(join(dir, run));
    await writeFile(join(dir, run, '001.tap.txt'), 'test log');
    await writeFile(join(dir, `${run}.md`), 'report');
    await writeFile(join(dir, `${run}-manifest.json`), '{}');
    assert.deepEqual(capture(), before);
    await writeFile(join(dir, 'docs/contract.md'), 'changed contract');
    const changed = capture();
    assert.equal(changed.commit, null);
    assert.notEqual(changed.working_tree_sha256, before.working_tree_sha256);
    await rename(join(dir, 'docs/contract.md'), join(dir, 'docs/renamed-contract.md'));
    assert.notEqual(capture().working_tree_sha256, changed.working_tree_sha256);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('end snapshot drift fails the runner even when command exits zero', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-verify-drift-'));
  await mkdir(join(dir, 'run'));
  const identity = snapshotIdentity('head', [['src/service.mjs', 'before']]);
  const makePool = (url) => ({
    async query(sql) { return sql.startsWith('SELECT current_database()') ? { rows: [{ name: new URL(url).pathname.slice(1) }] } : { rows: [] }; },
    async end() {},
  });
  try {
    const result = await executeVerification({ adminUrl, makePool, migrationSql: 'SELECT 1', evidenceDir: join(dir, 'run'), identity, identityReader: async () => snapshotIdentity('head', [['src/service.mjs', 'after']]), database: childDatabaseName(), commands: [['node', ['passing']]], commandRunner: async () => ({ exit_code: 0, output: 'ok' }) });
    assert.equal(result.ok, false);
    assert.match(result.error, /Source changed/);
    const manifest = JSON.parse(await readFile(join(dir, 'run-manifest.json'), 'utf8'));
    assert.equal(manifest.source_drift, true);
    assert.notEqual(manifest.source_identity_start.working_tree_sha256, manifest.source_identity_end.working_tree_sha256);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('test discovery stays in the root tests tree', async () => {
  const files = await discoverRootTests();
  assert.ok(files.includes('tests/tooling/verify-release.test.mjs'));
  assert.ok(files.length > 20);
  assert.ok(files.every((file) => file.startsWith('tests/') && !file.includes('.worktrees/')));
});

test('source identity is exported and detects this dirty verification script', async () => {
  const identity = await sourceIdentity();
  assert.match(identity.head_commit, /^[a-f0-9]{40}$/);
  assert.equal(identity.commit, null);
  assert.match(identity.working_tree_sha256, /^[a-f0-9]{64}$/);
});
