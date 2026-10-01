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

function dollarQuote(value) {
  let tag = 'migration_sql';
  while (value.includes(`$${tag}$`)) tag += '_x';
  return `$${tag}$${value}$${tag}$`;
}

// 0008 was applied by an earlier branch with the same SQL as 0010. Keep the
// alias only for databases that already recorded that historical version.
const legacyAliases = new Map([
  ['0010-quota-usage-idempotency', { version: '0008-quota-usage-idempotency', checksum: '87001b0cd6fe7dfa552f3eb278bac932ef0864af09b06cdc98c78bddd38ac5f2' }],
  ['0011-runtime-persistence', { version: '0011-runtime-persistence', checksum: '153e5f7a9633f4e8caf242dfc3bb64ae0ee7b4d622a970eca275a79b1e55323e' }]
]);

export async function discoverMigrations() {
  const files = (await readdir(migrationsDir))
    .filter((file) => /^\d+-.+\.sql$/.test(file))
    .sort();
  return Promise.all(files.map(async (file) => {
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    return { version: basename(file, '.sql'), file, checksum: checksum(sql), sql };
  }));
}

export function migrationPlan(migrations) {
  return migrations.map(({ version, file, checksum: hash }) => ({ version, file, checksum: hash }));
}

export function buildMigrationSql(migrations) {
  const statements = [
    'CREATE TABLE IF NOT EXISTS dgos_schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());',
    ...migrations.map(({ version, checksum: hash, sql }) => [
    'BEGIN;',
    `DO $$ BEGIN IF EXISTS (SELECT 1 FROM dgos_schema_migrations WHERE version = ${quote(version)} AND checksum NOT IN (${quote(hash)}, ${quote(legacyAliases.get(version)?.checksum ?? '')})) THEN RAISE EXCEPTION 'migration checksum mismatch: ${version}'; END IF; END $$;`,
    `DO $migration$ BEGIN IF NOT EXISTS (SELECT 1 FROM dgos_schema_migrations WHERE version = ${quote(version)} AND checksum = ${quote(hash)}) AND NOT EXISTS (SELECT 1 FROM dgos_schema_migrations WHERE version = ${quote(legacyAliases.get(version)?.version ?? '')} AND checksum = ${quote(legacyAliases.get(version)?.checksum ?? '')}) THEN EXECUTE ${dollarQuote(sql.trim())}; END IF; END $migration$;`,
    `INSERT INTO dgos_schema_migrations (version, checksum) VALUES (${quote(version)}, ${quote(hash)}) ON CONFLICT (version) DO NOTHING;`,
    'COMMIT;',
    ].join('\n')),
  ];
  return statements.join('\n\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const migrations = await discoverMigrations();
  if (process.argv.includes('--print-sql')) {
    process.stdout.write(`${buildMigrationSql(migrations)}\n`);
  } else {
    console.log(JSON.stringify(migrationPlan(migrations), null, 2));
    console.error('Migration runner is in plan mode. Pass --print-sql and execute against the approved PostgreSQL environment.');
  }
}
