import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { distribution, validateProfile, validateEnvironment, selectedMigrations } from '../../scripts/v1-performance.mjs';
import { discoverMigrations } from '../../scripts/migrate.mjs';

test('r6 proposed profile bounds workload and percentiles use raw observations', async () => {
  const profile = validateProfile(JSON.parse(await readFile('.herdr/v1-performance-profile-r6.json')));
  assert.equal(profile.approval, null);
  assert.deepEqual(distribution([100, 1, 10, 2, 3]), { count: 5, p50_ms: 3, p95_ms: 100, p99_ms: 100, max_ms: 100 });
  assert.throws(() => validateProfile({ ...profile, max_concurrency: 9 }));
  assert.throws(() => validateProfile({ ...profile, stages: [...profile.stages.slice(0, 3), { name: 'recovery', duration_ms: 70000, concurrency: 1 }] }));
});

test('r16 refuses unready startup and selects only the 47 frozen migrations', async () => {
  const env = { DGOS_PERF_STARTUP_READY: '1', DGOS_PERF_ADMIN_URL: 'postgresql://dgos:local@127.0.0.1:5432/postgres', DGOS_PERF_REDIS_URL: 'redis://127.0.0.1:6379/8' };
  assert.throws(() => validateEnvironment({ ...env, DGOS_PERF_STARTUP_READY: '0' }), /ready_receipt/);
  assert.throws(() => validateEnvironment({ ...env, DGOS_PERF_ADMIN_URL: 'postgresql://dgos:local@127.0.0.1:5432/dgos' }), /maintenance_db/);
  assert.throws(() => validateEnvironment({ ...env, DGOS_PERF_REDIS_URL: 'redis://127.0.0.1:6379/0' }), /db8/);
  assert.equal(validateEnvironment(env).apiPort, 15111);
  const items = await discoverMigrations();
  const result = selectedMigrations(items);
  assert.equal(result.selected.length, 47);
  assert.deepEqual(result.selected.slice(-7).map((item) => item.version), [
    '0045-network-route-activation', '0046-package-retention', '0047-ai-task-parameters',
    '0048-network-route-fingerprint', '0049-extension-management',
    '0050-session-management', '0051-proxy-provisioning',
  ]);
  assert.equal(result.actualSetSha, '0cb6df60c0bbd5527bc6c8f1314be67fed7dbe6de7f1de30bb8681771af2744d');
  for (const version of ['0045-network-route-activation', '0046-package-retention', '0047-ai-task-parameters', '0048-network-route-fingerprint', '0049-extension-management', '0050-session-management', '0051-proxy-provisioning']) {
    assert.throws(() => selectedMigrations(items.map((item) => item.version === version ? { ...item, checksum: 'b'.repeat(64) } : item)), new RegExp(`frozen_checksum_mismatch:${version}`));
  }
  assert.throws(() => selectedMigrations(items.filter((item) => item.version !== '0049-extension-management')), /frozen_migration_count_mismatch:46/);
  assert.throws(() => selectedMigrations(items.map((item) => item.version === '0001-v1-governance' ? { ...item, checksum: 'b'.repeat(64) } : item)), /frozen_migration_set_mismatch/);
  assert.throws(() => selectedMigrations([...items, { version: '0052-future', checksum: 'b'.repeat(64) }]), /unfrozen_migration_discovered:0052-future/);
  assert.throws(() => selectedMigrations([...items, { version: '0042-unapproved', checksum: 'b'.repeat(64) }]), /frozen_migration_count_mismatch:48/);
});
