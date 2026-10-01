import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDir = join(root, 'migrations');

function checksum(sql) {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export async function discoverMigrations() {
  const files = (await readdir(migrationsDir))
    .filter((file) => /^\d+-.+\.sql$/.test(file))
    .sort();
  return Promise.all(files.map(async (file) => {
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    return { version: basename(file, '.sql'), file, checksum: checksum(sql), sql };
  }));
}

export function buildMigrationSql(migrations) {
  const statements = [
    'CREATE TABLE IF NOT EXISTS dgos_schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());',
    ...migrations.map(({ version, checksum: hash, sql }) => [
    'BEGIN;',
    `DO $$ BEGIN IF EXISTS (SELECT 1 FROM dgos_schema_migrations WHERE version = ${quote(version)} AND checksum <> ${quote(hash)}) THEN RAISE EXCEPTION 'migration checksum mismatch: ${version}'; END IF; END $$;`,
    sql.trim(),
    `INSERT INTO dgos_schema_migrations (version, checksum) VALUES (${quote(version)}, ${quote(hash)}) ON CONFLICT (version) DO NOTHING;`,
    'COMMIT;',
    ].join('\n')),
  ];
  return statements.join('\n\n');
}

const migrations = await discoverMigrations();
if (process.argv.includes('--print-sql')) {
  process.stdout.write(`${buildMigrationSql(migrations)}\n`);
} else {
  console.log(JSON.stringify(migrations.map(({ version, file, checksum: hash }) => ({ version, file, checksum: hash })), null, 2));
  console.error('Migration runner is in plan mode. Pass --print-sql and execute against the approved PostgreSQL environment.');
}
