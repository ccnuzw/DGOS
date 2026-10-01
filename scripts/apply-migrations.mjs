import pg from '../apps/api/node_modules/pg/lib/index.js';
import { discoverMigrations, buildMigrationSql } from './migrate.mjs';
if (!process.env.DGOS_DATABASE_URL) throw new Error('DGOS_DATABASE_URL is required');
const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL });
try {
  const migrations = await discoverMigrations();
  await pool.query(buildMigrationSql(migrations));
  console.log(JSON.stringify({ migrations: migrations.map(({ version, checksum }) => ({ version, checksum })) }));
} finally { await pool.end(); }
