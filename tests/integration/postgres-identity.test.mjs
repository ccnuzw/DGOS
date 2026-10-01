import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from '../../apps/api/node_modules/pg/esm/index.mjs';
import { PostgresIdentityRepository } from '../../src/identity/repository.mjs';
import { InMemorySecretService } from '../../src/security/secret-service.mjs';
import { IdentityService } from '../../apps/api/src/identity-service.mjs';

const connectionString = process.env.DGOS_DATABASE_URL ?? 'postgres://dgos:dgos@127.0.0.1:5432/dgos';

test('PostgreSQL repository persists identity, key digest, and audit outbox', async (t) => {
  const pool = new pg.Pool({ connectionString });
  try { await pool.query('SELECT 1'); } catch (error) { await pool.end(); t.skip(`PostgreSQL unavailable: ${error.message}`); return; }
  await pool.query("DELETE FROM audit_outbox WHERE event_id IN (SELECT event_id FROM audit_events WHERE actor_id IN (SELECT principal_id FROM admin_principals WHERE credential_ref LIKE 'admin-credential:%'))");
  await pool.query("DELETE FROM audit_events WHERE actor_id IN (SELECT principal_id FROM admin_principals WHERE credential_ref LIKE 'admin-credential:%')");
  await pool.query("DELETE FROM api_key_records WHERE owner_id IN (SELECT principal_id FROM admin_principals WHERE credential_ref LIKE 'admin-credential:%')");
  await pool.query("DELETE FROM admin_sessions WHERE principal_id IN (SELECT principal_id FROM admin_principals WHERE credential_ref LIKE 'admin-credential:%')");
  await pool.query("DELETE FROM admin_principals WHERE credential_ref LIKE 'admin-credential:%'");
  const repo = new PostgresIdentityRepository(pool);
  const secret = new InMemorySecretService();
  const service = new IdentityService({ repository: repo, secretService: secret });
  const suffix = Date.now().toString();
  const bootstrap = await service.bootstrap({ displayName: `Integration ${suffix}`, credential: `credential-${suffix}`, requestId: randomUUID() });
  const key = await service.createKey({ ownerId: bootstrap.principalId, name: `integration-${suffix}`, scopes: ['audit.read'], requestId: randomUUID(), actorId: bootstrap.principalId });
  assert.match(key.secret, /^dgos_/);
  const rows = await pool.query('SELECT digest, scope, state FROM api_key_records WHERE key_id = $1', [key.key.keyId]);
  assert.equal(rows.rows[0].digest.includes(key.secret), false);
  assert.deepEqual(rows.rows[0].scope.scopes, ['audit.read']);
  assert.equal(rows.rows[0].state, 'active');
  const outbox = await pool.query('SELECT count(*)::int AS count FROM audit_outbox');
  assert.ok(outbox.rows[0].count >= 2);
  await pool.query('DELETE FROM audit_outbox WHERE event_id IN (SELECT event_id FROM audit_events WHERE actor_id = $1)', [bootstrap.principalId]);
  await pool.query('DELETE FROM audit_events WHERE actor_id = $1', [bootstrap.principalId]);
  await pool.query('DELETE FROM api_key_records WHERE owner_id = $1', [bootstrap.principalId]);
  await pool.query('DELETE FROM admin_sessions WHERE principal_id = $1', [bootstrap.principalId]);
  await pool.query('DELETE FROM admin_principals WHERE principal_id = $1', [bootstrap.principalId]);
  await pool.end();
});
