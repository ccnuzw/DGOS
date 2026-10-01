import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const sql = await readFile(join(root, 'migrations/0001-v1-governance.sql'), 'utf8');
const required = [
  'CREATE TABLE IF NOT EXISTS dgos_schema_migrations',
  'CREATE TABLE IF NOT EXISTS admin_principals',
  'CREATE TABLE IF NOT EXISTS admin_sessions',
  'CREATE TABLE IF NOT EXISTS api_key_records',
  'CREATE TABLE IF NOT EXISTS provider_accounts',
  'CREATE TABLE IF NOT EXISTS provider_bindings',
  'CREATE TABLE IF NOT EXISTS connection_tests',
  'CREATE TABLE IF NOT EXISTS audit_events',
  'CREATE TABLE IF NOT EXISTS quota_reservations',
  'CREATE TABLE IF NOT EXISTS usage_events',
  'CREATE TABLE IF NOT EXISTS audit_outbox',
  'UNIQUE (task_id, attempt_id, metric)',
];
const missing = required.filter((fragment) => !sql.includes(fragment));
if (missing.length > 0) {
  console.error(JSON.stringify({ ok: false, missing }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, migration: '0001-v1-governance.sql', requiredChecks: required.length }, null, 2));
