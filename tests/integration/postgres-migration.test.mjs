import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('PostgreSQL migration runner discovers and hashes migrations', async () => {
  const { stdout } = await execFileAsync(process.execPath, ['scripts/migrate.mjs'], { cwd: process.cwd() });
  const migrations = JSON.parse(stdout);
  assert.equal(migrations.length, 3);
  assert.equal(migrations[0].version, '0001-v1-governance');
  assert.equal(migrations[1].version, '0002-connection-test-leases');
  assert.equal(migrations[2].version, '0003-audit-outbox-leases');
  assert.match(migrations[0].checksum, /^[a-f0-9]{64}$/);
});
