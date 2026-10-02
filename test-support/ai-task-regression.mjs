import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from '../apps/api/node_modules/pg/lib/index.js';
import { discoverMigrations, buildMigrationSql } from '../scripts/migrate.mjs';

const frozen = new Map([
  ['0043-provider-protocol-receipts', '2cbc7d81813a50c85393ae857b260c796e8a7ea4db8f7c122541ab0abf5266fb'],
  ['0044-system-projection', 'a95019d20a3d2e63678b23f14fb35929f65c0192b075b4d995d35c8fb067e647'],
  ['0045-network-route-activation', 'c2bc2a47a3360e47b02d4edd9880b88694ec3ab84cdf7613674cd2099d40040d'],
  ['0046-package-retention', '7321916de0ddff31f40d48b837acada75d8ec893691c7c65f22d0b707d6a9a83'],
  ['0047-ai-task-parameters', '22b6e9e886943f2b660de4d54989e0587c58cb67e373fbd45b7140849f6f15f6'],
  ['0048-network-route-fingerprint', '7879e6cf17753fa82254675756fbeb1fdfb9ad67e11808aec8922cd2f10cd33d'],
  ['0049-extension-management', 'ba0bc80a0ccc74e05a5244b50e52e6a26df39ad854995ba038020b7d5d954f1b'],
  ['0050-session-management', '8802fe3a02b0bf7364aeac96215da09454d0c53b48c06d2cb76c6f3d6b455d85'],
  ['0051-proxy-provisioning', '778fddef654d67bc3ecfc01e11fd91f826f91d68a5b6c5c72568b5e35cca1939'],
]);

export function isAiTaskRegressionParent(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ['postgres:', 'postgresql:'].includes(url.protocol)
      && /^(?:dgos_v1_task|dgos_v1_verify_[0-9a-f]{32})$/.test(decodeURIComponent(url.pathname.slice(1)));
  } catch { return false; }
}

export async function isolatedAiTaskDatabase(parentUrl) {
  assert.ok(isAiTaskRegressionParent(parentUrl), 'dedicated_ai_task_parent_required');
  const url = new URL(parentUrl);
  const parentName = decodeURIComponent(url.pathname.slice(1));
  const childName = `dgos_v1_verify_${randomUUID().replaceAll('-', '')}`;
  const childUrl = new URL(url);
  childUrl.pathname = `/${childName}`;
  const admin = new pg.Pool({ connectionString: url.toString(), connectionTimeoutMillis: 5000 });
  let pool;
  let created = false;
  try {
    assert.equal((await admin.query('SELECT current_database() AS name')).rows[0]?.name, parentName);
    const migrations = (await discoverMigrations()).filter(({ version }) => Number(version.slice(0, 4)) <= 51);
    assert.equal(migrations.length, 47, 'frozen_47_migrations_required');
    for (const [version, checksum] of frozen) assert.equal(migrations.find((item) => item.version === version)?.checksum, checksum, version);
    assert.ok(!migrations.some(({ version }) => Number(version.slice(0, 4)) >= 43 && !frozen.has(version)), 'unknown_frozen_migration');
    await admin.query(`CREATE DATABASE ${childName}`);
    created = true;
    pool = new pg.Pool({ connectionString: childUrl.toString(), connectionTimeoutMillis: 5000 });
    assert.equal((await pool.query('SELECT current_database() AS name')).rows[0]?.name, childName);
    await pool.query(buildMigrationSql(migrations));
    const applied = (await pool.query('SELECT version,checksum FROM dgos_schema_migrations ORDER BY version')).rows;
    assert.deepEqual(applied.map(({ version, checksum }) => ({ version, checksum })), migrations.map(({ version, checksum }) => ({ version, checksum })));
    return { pool, async cleanup() {
      await pool.end();
      try { await admin.query(`DROP DATABASE ${childName} WITH (FORCE)`); }
      finally { await admin.end(); }
    } };
  } catch (error) {
    try {
      if (pool) await pool.end();
      if (created) await admin.query(`DROP DATABASE ${childName} WITH (FORCE)`);
    } finally { await admin.end(); }
    throw error;
  }
}
