import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('PostgreSQL migration runner discovers and hashes migrations', async () => {
  const { stdout } = await execFileAsync(process.execPath, ['scripts/migrate.mjs'], { cwd: process.cwd() });
  const migrations = JSON.parse(stdout);
  assert.ok(migrations.length >= 7);
  assert.deepEqual(migrations.slice(0, 4).map((item) => item.version), ['0001-v1-governance', '0002-connection-test-leases', '0003-audit-outbox-leases', '0004-retention-jobs']);
  assert.ok(migrations.some((item) => item.version === '0005-quota-usage'));
  assert.ok(migrations.some((item) => item.version === '0006-runtime'));
  assert.ok(migrations.some((item) => item.version === '0007-provider-config-ai-task'));
  assert.ok(migrations.some((item) => item.version === '0011-runtime-persistence'));
  assert.deepEqual(migrations.map((item) => item.version), [...migrations.map((item) => item.version)].sort());
  assert.match(migrations[0].checksum, /^[a-f0-9]{64}$/);
});

test('migration runner preserves the retired 0008 history through the 0010 alias', async () => {
  const { execFile: run } = await import('node:child_process');
  const { promisify: toPromise } = await import('node:util');
  const exec = toPromise(run);
  const { stdout } = await exec(process.execPath, ['scripts/migrate.mjs', '--print-sql'], { cwd: process.cwd() });
  assert.match(stdout, /version = '0008-quota-usage-idempotency'/);
  assert.match(stdout, /87001b0cd6fe7dfa552f3eb278bac932ef0864af09b06cdc98c78bddd38ac5f2/);
});
