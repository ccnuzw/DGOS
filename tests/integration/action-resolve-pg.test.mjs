import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { buildServer } from '../../apps/api/src/server.mjs';
import { DiskPackageStore } from '../../src/apps/package-service.mjs';
import { discoverMigrations, buildMigrationSql } from '../../scripts/migrate.mjs';
import { frozenOpsMigrations } from '../../scripts/v1-ops-migrate.mjs';

const parentUrl = process.env.DGOS_DATABASE_URL;
const allowedParent = (url) => {
  try { return /^(?:dgos_v1_actions|dgos_v1_verify_[0-9a-f]{32})$/.test(new URL(url).pathname.slice(1)); }
  catch { return false; }
};

test('resolve PostgreSQL parent guard accepts Actions and exact Verify child URLs only', () => {
  assert.equal(allowedParent('postgresql://localhost/dgos_v1_actions'), true);
  assert.equal(allowedParent(`postgresql://localhost/dgos_v1_verify_${'a'.repeat(32)}`), true);
  for (const name of ['dgos', 'dgos_v1_integrated', 'dgos_v1_verify_bad', `dgos_v1_verify_${'A'.repeat(32)}`, `dgos_v1_verify_${'a'.repeat(32)}_extra`, 'dgos_v1_action_resolve_child']) {
    assert.equal(allowedParent(`postgresql://localhost/${name}`), false, name);
  }
  assert.equal(allowedParent('not-a-url'), false);
});

test('resolve uses the authenticated request context for PostgreSQL permission audit and fails closed', { skip: !parentUrl }, async (t) => {
  if (!allowedParent(parentUrl)) throw new Error('action_resolve_requires_dedicated_actions_or_verify_database');
  const migrations = frozenOpsMigrations(await discoverMigrations());
  if (migrations.length !== 47 || migrations.at(-1)?.version !== '0051-proxy-provisioning') throw new Error('action_resolve_frozen_migration_set_mismatch');
  const name = `dgos_v1_action_resolve_${randomUUID().replaceAll('-', '')}`;
  const childUrl = new URL(parentUrl);
  childUrl.pathname = `/${name}`;
  const admin = new pg.Pool({ connectionString: parentUrl });
  const packageRoot = await mkdtemp(join(tmpdir(), 'dgos-action-resolve-'));
  let created = false;
  let app;
  let db;
  t.after(async () => {
    await app?.close();
    await db?.end();
    if (created) await admin.query(`DROP DATABASE "${name}"`);
    await admin.end();
    await rm(packageRoot, { recursive: true, force: true });
  });
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  db = new pg.Pool({ connectionString: childUrl.toString() });
  await db.query(buildMigrationSql(migrations));
  const previousUrl = process.env.DGOS_DATABASE_URL;
  process.env.DGOS_DATABASE_URL = childUrl.toString();
  try { app = buildServer({ logger: false, packageOptions: { store: new DiskPackageStore(packageRoot), trustRoots: new Map() } }); }
  finally { process.env.DGOS_DATABASE_URL = previousUrl; }

  const bootstrap = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'Resolver', credential: 'resolver-fixture-secret' } });
  assert.equal(bootstrap.statusCode, 201, bootstrap.body);
  const { sessionId, principalId } = bootstrap.json();
  const headers = { authorization: `Bearer ${sessionId}` };
  const resolve = (requestId) => app.inject({ method: 'POST', url: '/api/v1/actions/resolve', headers: { ...headers, 'x-request-id': requestId }, payload: { requestId, text: 'open settings' } });
  const allowedId = randomUUID();
  const allowed = await resolve(allowedId);
  assert.equal(allowed.statusCode, 200, allowed.body);
  assert.deepEqual(allowed.json().candidates.map((item) => item.actionId), ['system.navigate.system.settings']);
  assert.equal(allowed.json().candidates[0].executable, false);
  const allowedAudit = await db.query("SELECT request_id,actor_id,action FROM audit_events WHERE request_id=$1 AND action='permission.check'", [allowedId]);
  assert.ok(allowedAudit.rows.length >= 1);
  assert.ok(allowedAudit.rows.every((row) => row.request_id === allowedId && row.actor_id === principalId));

  await app.permissions.decide({ subjectId: principalId, appId: 'dgos.system', capability: 'system.navigate', decision: 'deny', requestId: randomUUID() });
  const deniedId = randomUUID();
  const denied = await resolve(deniedId);
  assert.equal(denied.statusCode, 200, denied.body);
  assert.deepEqual(denied.json().candidates, []);
  const deniedAudit = await db.query("SELECT count(*)::int AS count FROM audit_events WHERE request_id=$1 AND action='permission.check'", [deniedId]);
  assert.ok(deniedAudit.rows[0].count >= 1);

  await db.query(`CREATE FUNCTION reject_resolve_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'permission.check' THEN RAISE EXCEPTION 'audit_unavailable'; END IF; RETURN NEW; END $$`);
  await db.query('CREATE TRIGGER reject_resolve_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_resolve_audit()');
  const failedId = randomUUID();
  const failed = await resolve(failedId);
  assert.equal(failed.statusCode, 500, failed.body);
  const failedAudit = await db.query('SELECT count(*)::int AS count FROM audit_events WHERE request_id=$1', [failedId]);
  assert.equal(failedAudit.rows[0].count, 0);
  const sideEffects = await db.query('SELECT (SELECT count(*)::int FROM action_plans) AS plans, (SELECT count(*)::int FROM action_runs) AS runs');
  assert.deepEqual(sideEffects.rows[0], { plans: 0, runs: 0 });
});
