import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverMigrations } from '../../scripts/migrate.mjs';
import { frozenOpsMigrations } from '../../scripts/v1-ops-migrate.mjs';

test('production migration runner uses only the exact frozen list', async () => {
  const all = await discoverMigrations();
  const selected = frozenOpsMigrations(all);
  assert.ok(selected.some((item) => item.version === '0051-proxy-provisioning'));
  assert.equal(selected.filter((item) => Number(item.version.slice(0, 4)) >= 45).length, 7);
  assert.throws(() => frozenOpsMigrations(all.map((item) => item.version === '0051-proxy-provisioning' ? { ...item, checksum: '0'.repeat(64) } : item)), /frozen_migration_checksum_mismatch:0051/);
  assert.ok(!frozenOpsMigrations([...all, { version: '0052-unreviewed', checksum: 'x' }]).some((item) => item.version === '0052-unreviewed'));
});
