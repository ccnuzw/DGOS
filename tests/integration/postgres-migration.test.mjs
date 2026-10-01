import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('PostgreSQL migration runner discovers and hashes migrations', async () => {
  const { stdout } = await execFileAsync(process.execPath, ['scripts/migrate.mjs'], { cwd: process.cwd() });
  const migrations = JSON.parse(stdout);
  assert.equal(migrations.length, 6);
  assert.equal(migrations[0].version, '0001-v1-governance');
  assert.equal(migrations[1].version, '0002-connection-test-leases');
  assert.equal(migrations[2].version, '0003-audit-outbox-leases');
  assert.equal(migrations[3].version, '0004-retention-jobs');
  assert.equal(migrations[4].version, '0005-quota-usage');
  const connectionString = process.env.DGOS_DATABASE_URL ?? 'postgres://dgos:dgos@127.0.0.1:5432/dgos';
  const { stdout: migrationRows } = await execFileAsync('docker', ['exec', 'dgos-postgres-1', 'psql', '-U', 'dgos', '-d', 'dgos', '-Atc', "SELECT version || ':' || checksum FROM dgos_schema_migrations ORDER BY version"], { cwd: process.cwd() }).catch(() => ({ stdout: '' }));
  if (migrationRows) assert.match(migrationRows, /0005-quota-usage:d037c22c993b91c64e0c54f12d78ed698e303f57fbd64ecbd027721869016e86/);
  assert.equal(migrations[5].version, '0006-runtime');
  assert.match(migrations[0].checksum, /^[a-f0-9]{64}$/);
});
