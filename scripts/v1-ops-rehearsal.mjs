import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from '../apps/api/node_modules/pg/lib/index.js';
import { backup, restore } from './v1-ops-multistore.mjs';
import { createFileRootKeyHandle, DurableSecretService } from '../src/security/durable-secret-service.mjs';

const maintenanceUrl = process.env.DGOS_OPS_MAINTENANCE_URL;
const container = process.env.DGOS_OPS_PG_CONTAINER;
if (!maintenanceUrl || !container) throw new Error('isolated_ops_fixture_required');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const run = randomBytes(5).toString('hex');
const sourceDatabase = `dgos_v1_ops_${run}`;
const restoreDatabase = `dgos_v1_ops_restore_${run}`;
const root = await mkdtemp(path.join(tmpdir(), 'dgos-ops-r7-'));
const keyRoot = path.join(root, 'operator-key');
const secrets = path.join(root, 'ciphertext');
const packages = path.join(root, 'packages');
const archive = path.join(root, 'archive');
const restoredSecrets = path.join(root, 'restored-ciphertext');
const restoredPackages = path.join(root, 'restored-packages');
const admin = new pg.Pool({ connectionString: maintenanceUrl });
const databaseUrl = new URL(maintenanceUrl); databaseUrl.pathname = `/${sourceDatabase}`;
const restoreUrl = new URL(maintenanceUrl); restoreUrl.pathname = `/${restoreDatabase}`;
let sourceCreated = false; let restoredCreated = false; let pool;
const result = { environment: 'local-isolated-compose-fixture', database: sourceDatabase, restoreDatabase, rootKeyIncluded: false };
const productionModeFixture = process.env.DGOS_OPS_REHEARSAL_PRODUCTION_MODE === '1';
const authority = productionModeFixture ? { mode: 'production', maintenanceUrl, container, sourceDatabase, targetDatabase: restoreDatabase } : undefined;
try {
  assert.equal((await admin.query('SELECT current_database() AS name')).rows[0].name, 'postgres');
  await admin.query(`CREATE DATABASE ${sourceDatabase}`); sourceCreated = true;
  pool = new pg.Pool({ connectionString: databaseUrl.toString() });
  const { frozenOpsMigrations } = await import('./v1-ops-migrate.mjs');
  const { discoverMigrations, buildMigrationSql } = await import('./migrate.mjs');
  const migrations = frozenOpsMigrations(await discoverMigrations());
  await pool.query(buildMigrationSql(migrations));
  result.migrations = migrations.length;
  await mkdir(keyRoot, { mode: 0o700 }); await mkdir(packages, { mode: 0o700 });
  await writeFile(path.join(keyRoot, 'local.key'), randomBytes(32).toString('base64url'), { mode: 0o600 });
  await writeFile(path.join(keyRoot, 'current'), 'local', { mode: 0o600 });
  const service = await new DurableSecretService({ directory: secrets, rootKeyHandle: createFileRootKeyHandle({ keyDirectory: keyRoot }) }).ready();
  const principal = randomUUID(); const ref = `ops-r7-${run}`;
  await service.put({ secretRef: ref, value: 'controlled-secret', purpose: 'admin-login', subjectId: principal, ttlMs: 300000 });
  await pool.query("INSERT INTO admin_principals(principal_id,status,credential_ref,roles) VALUES($1,'active',$2,'[\"admin\"]')", [principal, ref]);
  const packageDigest = `sha256:${digest(`package-${run}`)}`;
  const releaseDir = path.join(packages, 'releases', 'fixture.app', 'stable', '1.0.0', '1', packageDigest.replace(':', '-'));
  await mkdir(releaseDir, { recursive: true, mode: 0o700 });
  await writeFile(path.join(releaseDir, '.dgos-release.json'), JSON.stringify({ digest: packageDigest }), { mode: 0o600 });
  await writeFile(path.join(releaseDir, 'index.html'), '<html>fixture</html>', { mode: 0o600 });
  const packageId = randomUUID();
  await pool.query("INSERT INTO app_package_releases(package_id,app_id,version,build,release_channel,manifest,package_digest,source,key_id,request_id,effective_trust_level,uninstall_policy,catalog_state) VALUES($1,'fixture.app','1.0.0',1,'stable','{}',$2,'official','fixture-key',$3,'standard','user-removable','official')", [packageId, packageDigest, randomUUID()]);
  const proxyActor = randomUUID(); const proxyRequest = randomUUID();
  await pool.query("INSERT INTO network_proxy_provisioning(actor_id,request_id,secret_ref,fingerprint,hmac_version,display_name,credential_status,state,lease_until) VALUES($1,$2,$3,$4,1,'fixture','not_required','prepared',now())", [proxyActor, proxyRequest, `proxy_${randomBytes(24).toString('base64url')}`, digest(`proxy-${run}`)]);
  await assert.rejects(
    backup({ maintenanceUrl, database: sourceDatabase, container, packageRoot: packages, secretRoot: secrets, destination: path.join(root, 'pending-archive'), writesStopped: true, authority }),
    /pending_store_intents_require_reconciliation/,
  );
  await pool.query('DELETE FROM network_proxy_provisioning WHERE actor_id=$1 AND request_id=$2', [proxyActor, proxyRequest]);
  const backupStart = Date.now();
  const archived = await backup({ maintenanceUrl, database: sourceDatabase, container, packageRoot: packages, secretRoot: secrets, destination: archive, writesStopped: true, authority });
  const backupDone = Date.now();
  const restored = await restore({ maintenanceUrl, container, backupRoot: archive, targetDatabase: restoreDatabase, packageRoot: restoredPackages, secretRoot: restoredSecrets, keyRoot, authority });
  restoredCreated = true;
  const restoredPool = new pg.Pool({ connectionString: restoreUrl.toString() });
  try {
    assert.equal((await restoredPool.query('SELECT count(*)::int AS n FROM app_package_releases')).rows[0].n, 1);
    assert.equal((await restoredPool.query('SELECT count(*)::int AS n FROM admin_principals')).rows[0].n, 1);
  } finally { await restoredPool.end(); }
  const restoredSecret = await new DurableSecretService({ directory: restoredSecrets, rootKeyHandle: createFileRootKeyHandle({ keyDirectory: keyRoot }) }).ready();
  assert.equal(await (await restoredSecret.resolve({ secretRef: ref, purpose: 'admin-login', subjectId: principal })).read(), 'controlled-secret');
  const restoreDone = Date.now();
  await assert.rejects(
    restore({ maintenanceUrl, container, backupRoot: archive, targetDatabase: restoreDatabase, packageRoot: path.join(root, 'existing-packages'), secretRoot: path.join(root, 'existing-secrets'), keyRoot }),
    /restore_destination_must_be_new/,
  );
  const missingKeyDatabase = `dgos_v1_ops_restore_nokey_${run}`;
  await assert.rejects(
    restore({ maintenanceUrl, container, backupRoot: archive, targetDatabase: missingKeyDatabase, packageRoot: path.join(root, 'no-key-packages'), secretRoot: path.join(root, 'no-key-secrets'), keyRoot: path.join(root, 'missing-key') }),
    /ENOENT|root_key|credential_unavailable/,
  );
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM pg_database WHERE datname=$1', [missingKeyDatabase])).rows[0].n, 0);
  await assert.rejects(
    restore({ maintenanceUrl: 'postgresql://dgos:fixture@127.0.0.1:5432/postgres', container, backupRoot: archive, targetDatabase: `dgos_v1_ops_restore_badurl_${run}`, packageRoot: path.join(root, 'badurl-packages'), secretRoot: path.join(root, 'badurl-secrets'), keyRoot }),
    /isolated_ops_maintenance_url_required/,
  );
  const packageFile = path.join(archive, 'packages', 'releases', 'fixture.app', 'stable', '1.0.0', '1', packageDigest.replace(':', '-'), 'index.html');
  await writeFile(packageFile, 'tampered');
  const tamperDatabase = `dgos_v1_ops_restore_tamper_${run}`;
  await assert.rejects(
    restore({ maintenanceUrl, container, backupRoot: archive, targetDatabase: tamperDatabase, packageRoot: path.join(root, 'tamper-packages'), secretRoot: path.join(root, 'tamper-secrets'), keyRoot }),
    /backup_integrity_failed/,
  );
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM pg_database WHERE datname=$1', [tamperDatabase])).rows[0].n, 0);
  result.negativeChecks = ['pending_secret_intent_rejected', 'existing_restore_database_rejected', 'missing_root_key_rejected_and_database_dropped', 'nonfixture_maintenance_url_rejected', 'tampered_package_rejected_and_database_dropped'];
  result.backupMs = backupDone - backupStart;
  result.engineMode = productionModeFixture ? 'explicit-production-authority-on-local-fixture' : 'fixture-locked';
  result.restoreMs = restoreDone - backupDone;
  result.observedRpoMs = 0;
  result.observedRtoMs = restoreDone - backupStart;
  result.archiveSha256 = digest(await readFile(path.join(archive, 'database.dump')));
  result.references = archived.manifest.references;
  result.restored = restored;
  result.status = 'local_fixture_restored';
} catch (error) { result.status = 'failed'; result.failure = error.message; process.exitCode = 1; }
finally {
  if (pool) await pool.end();
  if (restoredCreated) await admin.query(`DROP DATABASE ${restoreDatabase} WITH (FORCE)`);
  if (sourceCreated) await admin.query(`DROP DATABASE ${sourceDatabase} WITH (FORCE)`);
  await admin.end(); await rm(root, { recursive: true, force: true });
  result.cleanup = 'random databases and private local root removed';
  console.log(JSON.stringify(result));
}
