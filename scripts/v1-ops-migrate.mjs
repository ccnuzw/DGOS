import pg from '../apps/api/node_modules/pg/lib/index.js';
import { discoverMigrations, buildMigrationSql } from './migrate.mjs';

const frozen = new Map([
  ['0045-network-route-activation', 'c2bc2a47a3360e47b02d4edd9880b88694ec3ab84cdf7613674cd2099d40040d'],
  ['0046-package-retention', '7321916de0ddff31f40d48b837acada75d8ec893691c7c65f22d0b707d6a9a83'],
  ['0047-ai-task-parameters', '22b6e9e886943f2b660de4d54989e0587c58cb67e373fbd45b7140849f6f15f6'],
  ['0048-network-route-fingerprint', '7879e6cf17753fa82254675756fbeb1fdfb9ad67e11808aec8922cd2f10cd33d'],
  ['0049-extension-management', 'ba0bc80a0ccc74e05a5244b50e52e6a26df39ad854995ba038020b7d5d954f1b'],
  ['0050-session-management', '8802fe3a02b0bf7364aeac96215da09454d0c53b48c06d2cb76c6f3d6b455d85'],
  ['0051-proxy-provisioning', '778fddef654d67bc3ecfc01e11fd91f826f91d68a5b6c5c72568b5e35cca1939'],
]);

export function frozenOpsMigrations(items) {
  const selected = items.filter((item) => Number(item.version.slice(0, 4)) < 45 || frozen.has(item.version));
  for (const [version, checksum] of frozen) {
    if (selected.find((item) => item.version === version)?.checksum !== checksum) throw new Error(`frozen_migration_checksum_mismatch:${version}`);
  }
  return selected;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  if (!process.env.DGOS_DATABASE_URL) throw new Error('DGOS_DATABASE_URL_required');
  const migrations = frozenOpsMigrations(await discoverMigrations());
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL, connectionTimeoutMillis: 3000 });
  try {
    await pool.query(buildMigrationSql(migrations));
    console.log(JSON.stringify({ migrations: migrations.map(({ version, checksum }) => ({ version, checksum })) }));
  } finally { await pool.end(); }
}
