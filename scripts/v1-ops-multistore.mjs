import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from '../apps/api/node_modules/pg/lib/index.js';
import { createFileRootKeyHandle, DurableSecretService } from '../src/security/durable-secret-service.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const databaseName = (value, authority) => {
  if (authority?.mode === 'production') {
    if (!/^[a-z][a-z0-9_]{2,62}$/.test(value ?? '') || ['postgres', 'template0', 'template1'].includes(value)) throw new Error('authorized_database_name_invalid');
  } else if (!/^dgos_v1_ops_[a-z0-9_]{8,64}$/.test(value ?? '')) throw new Error('isolated_ops_database_required');
  return value;
};
const dockerContainer = (value, authority) => {
  if (authority?.mode === 'production') {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(value ?? '') || value !== authority.container) throw new Error('authorized_container_mismatch');
  } else if (!/^dgos-ops-r7-[a-z0-9]+-postgres-1$/.test(value ?? '')) throw new Error('isolated_ops_container_required');
  return value;
};
const safeRoot = async (folder, { mustBeNew = false } = {}) => {
  const target = path.resolve(folder);
  if (mustBeNew) { try { await lstat(target); throw new Error('destination_must_be_new'); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  else { const entry = await lstat(target); if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('source_directory_invalid'); }
  return target;
};
const listFiles = async (root, prefix = '') => {
  const names = [];
  for (const entry of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) names.push(...await listFiles(root, relative));
    else if (entry.isFile()) names.push(relative);
    else throw new Error('store_non_regular_entry');
  }
  return names.sort();
};
const files = async (root) => Promise.all((await listFiles(root)).map(async (name) => ({ name, sha256: hash(await readFile(path.join(root, name))) })));
const copyFiles = async (source, destination, expected) => {
  await mkdir(destination, { recursive: true, mode: 0o700 });
  for (const item of expected) {
    if (!item || typeof item.name !== 'string' || item.name.startsWith('/') || item.name.split('/').some((part) => !part || part === '.' || part === '..') || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error('backup_manifest_invalid');
    const from = path.join(source, item.name); const info = await lstat(from);
    if (!info.isFile() || info.isSymbolicLink() || hash(await readFile(from)) !== item.sha256) throw new Error('backup_integrity_failed');
    const to = path.join(destination, item.name); await mkdir(path.dirname(to), { recursive: true, mode: 0o700 });
    await cp(from, to, { errorOnExist: true, force: false });
  }
  if (JSON.stringify(await files(source)) !== JSON.stringify(expected)) throw new Error('backup_manifest_incomplete');
};
const maintenance = (template, authority) => {
  let url;
  try { url = new URL(template); } catch { throw new Error('ops_maintenance_url_invalid'); }
  if (url.protocol !== 'postgresql:' || !url.username || !url.password || url.pathname !== '/postgres' || url.hash || url.search) throw new Error('ops_maintenance_url_invalid');
  if (authority?.mode === 'production') {
    if (template !== authority.maintenanceUrl || !/^[a-z_][a-z0-9_]{0,62}$/.test(decodeURIComponent(url.username))) throw new Error('authorized_maintenance_url_mismatch');
  } else if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '15310') throw new Error('isolated_ops_maintenance_url_required');
  return { url, user: decodeURIComponent(url.username) };
};
const urlFor = (template, name, authority) => { const { url } = maintenance(template, authority); url.pathname = `/${databaseName(name, authority)}`; return url.toString(); };
const assertSameCluster = async (admin, container, user) => {
  const fromUrl = (await admin.query('SELECT system_identifier::text AS id FROM pg_control_system()')).rows[0].id;
  const fromContainer = execFileSync('docker', ['exec', container, 'psql', '-U', user, '-d', 'postgres', '-At', '-c', 'SELECT system_identifier FROM pg_control_system()'], { timeout: 10000, encoding: 'utf8' }).trim();
  if (fromUrl !== fromContainer) throw new Error('postgres_cluster_mismatch');
};
const assertAuthority = (authority, operation, source, target) => {
  if (!authority) return;
  if (authority.mode !== 'production' || authority.sourceDatabase !== source || (operation === 'restore' && authority.targetDatabase !== target)) throw new Error('ops_authorization_mismatch');
};
const poolFor = (url) => new pg.Pool({ connectionString: url, connectionTimeoutMillis: 3000 });
const assertNoPendingWrites = async (pool) => {
  const { rows } = await pool.query(`SELECT
    (SELECT count(*) FROM provider_secret_revoke_intents WHERE state='pending') +
    (SELECT count(*) FROM extension_secret_revoke_intents WHERE state='pending') +
    (SELECT count(*) FROM extension_secret_write_intents WHERE state='prepared') +
    (SELECT count(*) FROM network_proxy_provisioning WHERE state IN ('prepared','compensating')) +
    (SELECT count(*) FROM app_package_stage_candidates WHERE state IN ('pending','staged','cleaning')) AS pending`);
  if (Number(rows[0].pending) !== 0) throw new Error('pending_store_intents_require_reconciliation');
};
const references = async (pool) => {
  const secrets = await pool.query("SELECT credential_ref AS ref FROM admin_principals UNION SELECT credential_ref FROM provider_accounts WHERE state NOT IN ('revoked') UNION SELECT credential_ref FROM extension_installs WHERE credential_ref IS NOT NULL AND state <> 'removed' UNION SELECT secret_ref FROM network_proxy_provisioning WHERE state='committed'");
  const releases = await pool.query("SELECT package_digest AS digest FROM app_package_releases UNION SELECT package_digest FROM app_package_deployments UNION SELECT package_digest FROM app_package_stage_candidates WHERE state='finalized' UNION SELECT source_package_digest FROM app_data_migrations WHERE state='prepared' UNION SELECT target_package_digest FROM app_data_migrations WHERE state='prepared'");
  return { secretRefDigests: secrets.rows.map((row) => hash(row.ref)).sort(), packageDigests: releases.rows.map((row) => row.digest).sort() };
};
const assertReferences = async (pool, secretRoot, packageRoot, expected) => {
  const actual = await references(pool);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('database_reference_mismatch');
  const present = new Set((await files(secretRoot)).map((item) => item.name));
  for (const digest of actual.secretRefDigests) if (!present.has(`${digest}.json`)) throw new Error('secret_reference_missing');
  const metadata = new Set((await files(packageRoot)).filter((item) => item.name.endsWith('/.dgos-release.json')).map((item) => item.name.split('/').at(-2).replace(/^sha256-/, 'sha256:')));
  for (const digest of actual.packageDigests) if (!metadata.has(digest)) throw new Error('package_reference_missing');
  return actual;
};

export async function backup({ maintenanceUrl, database, container, packageRoot, secretRoot, destination, writesStopped, authority }) {
  if (writesStopped !== true) throw new Error('writes_stopped_confirmation_required');
  assertAuthority(authority, 'backup', database);
  const target = await safeRoot(destination, { mustBeNew: true });
  await safeRoot(packageRoot); await safeRoot(secretRoot);
  const name = databaseName(database, authority); const pgContainer = dockerContainer(container, authority);
  const { user } = maintenance(maintenanceUrl, authority);
  const admin = poolFor(maintenanceUrl);
  const pool = poolFor(urlFor(maintenanceUrl, name, authority));
  try {
    await assertSameCluster(admin, pgContainer, user);
    const actual = (await pool.query('SELECT current_database() AS name')).rows[0].name;
    if (actual !== name) throw new Error('source_database_mismatch');
    await assertNoPendingWrites(pool);
    const before = await references(pool);
    await mkdir(target, { mode: 0o700 });
    const dump = execFileSync('docker', ['exec', pgContainer, 'pg_dump', '-U', user, '-d', name, '-Fc', '--no-owner', '--no-acl'], { maxBuffer: 128 * 1024 * 1024, timeout: 120000 });
    await writeFile(path.join(target, 'database.dump'), dump, { mode: 0o600, flag: 'wx' });
    const packageFiles = await files(packageRoot); const secretFiles = await files(secretRoot);
    await copyFiles(packageRoot, path.join(target, 'packages'), packageFiles);
    await copyFiles(secretRoot, path.join(target, 'ciphertext'), secretFiles);
    const after = await references(pool);
    await assertNoPendingWrites(pool);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('source_changed_during_backup');
    await assertReferences(pool, secretRoot, packageRoot, before);
    const manifest = { format: 1, sourceDatabase: name, capturedAt: new Date().toISOString(), databaseSha256: hash(dump), packages: packageFiles, ciphertext: secretFiles, references: before, rootKeyIncluded: false };
    await writeFile(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    return { manifest, destination: target };
  } finally { await pool.end(); await admin.end(); }
}

export async function restore({ maintenanceUrl, container, backupRoot, targetDatabase, packageRoot, secretRoot, keyRoot, authority }) {
  const name = databaseName(targetDatabase, authority); const pgContainer = dockerContainer(container, authority);
  if (!authority && !name.includes('_restore_')) throw new Error('restore_database_name_required');
  const { user } = maintenance(maintenanceUrl, authority);
  urlFor(maintenanceUrl, name, authority);
  const targetPackages = await safeRoot(packageRoot, { mustBeNew: true });
  const targetSecrets = await safeRoot(secretRoot, { mustBeNew: true });
  const manifest = JSON.parse(await readFile(path.join(backupRoot, 'manifest.json'), 'utf8'));
  if (manifest.format !== 1 || manifest.rootKeyIncluded !== false || !Array.isArray(manifest.packages) || !Array.isArray(manifest.ciphertext) || !manifest.references) throw new Error('backup_manifest_invalid');
  assertAuthority(authority, 'restore', manifest.sourceDatabase, name);
  if (name === manifest.sourceDatabase) throw new Error('restore_source_database_forbidden');
  const dump = await readFile(path.join(backupRoot, 'database.dump'));
  if (hash(dump) !== manifest.databaseSha256) throw new Error('backup_integrity_failed');
  const admin = poolFor(maintenanceUrl); let created = false;
  try {
    if ((await admin.query('SELECT current_database() AS name')).rows[0].name !== 'postgres') throw new Error('maintenance_database_required');
    await assertSameCluster(admin, pgContainer, user);
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name]);
    if (exists.rowCount) throw new Error('restore_destination_must_be_new');
    await admin.query(`CREATE DATABASE ${name}`); created = true;
    execFileSync('docker', ['exec', '-i', pgContainer, 'pg_restore', '-U', user, '-d', name, '--no-owner', '--no-acl', '--exit-on-error'], { input: dump, maxBuffer: 16 * 1024 * 1024, timeout: 120000 });
    await copyFiles(path.join(backupRoot, 'packages'), targetPackages, manifest.packages);
    await copyFiles(path.join(backupRoot, 'ciphertext'), targetSecrets, manifest.ciphertext);
    const keys = createFileRootKeyHandle({ keyDirectory: keyRoot });
    const secret = await new DurableSecretService({ directory: targetSecrets, rootKeyHandle: keys }).ready();
    const verified = await secret.verifyCiphertext();
    const pool = poolFor(urlFor(maintenanceUrl, name, authority));
    try { await assertNoPendingWrites(pool); await assertReferences(pool, targetSecrets, targetPackages, manifest.references); }
    finally { await pool.end(); }
    return { state: 'restored_read_only_validation_required', database: name, ciphertextVerified: verified.verified, packageFiles: manifest.packages.length };
  } catch (error) {
    if (created) { try { await admin.query(`DROP DATABASE ${name} WITH (FORCE)`); } catch { error.restoreDatabase = name; } }
    await Promise.all([rm(targetPackages, { recursive: true, force: true }), rm(targetSecrets, { recursive: true, force: true })]);
    throw error;
  }
  finally { await admin.end(); }
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const [mode, ...args] = process.argv.slice(2);
  const maintenanceUrl = process.env.DGOS_OPS_MAINTENANCE_URL;
  const container = process.env.DGOS_OPS_PG_CONTAINER;
  const authority = process.env.DGOS_OPS_MODE === 'production' ? {
    mode: 'production', maintenanceUrl: process.env.DGOS_OPS_AUTH_MAINTENANCE_URL,
    container: process.env.DGOS_OPS_AUTH_PG_CONTAINER,
    sourceDatabase: process.env.DGOS_OPS_AUTH_SOURCE_DATABASE,
    targetDatabase: process.env.DGOS_OPS_AUTH_TARGET_DATABASE,
  } : undefined;
  if (process.env.DGOS_OPS_MODE && !['fixture', 'production'].includes(process.env.DGOS_OPS_MODE)) throw new Error('ops_mode_invalid');
  if (mode === 'backup') {
    const [database, packageRoot, secretRoot, destination, flag] = args;
    console.log(JSON.stringify(await backup({ maintenanceUrl, container, database, packageRoot, secretRoot, destination, writesStopped: flag === '--all-writes-stopped', authority })));
  } else if (mode === 'restore') {
    const [backupRoot, targetDatabase, packageRoot, secretRoot, keyRoot] = args;
    console.log(JSON.stringify(await restore({ maintenanceUrl, container, backupRoot, targetDatabase, packageRoot, secretRoot, keyRoot, authority })));
  } else throw new Error('usage: v1-ops-multistore.mjs backup|restore ...');
}
