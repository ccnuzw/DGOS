import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { PostgresIdentityRepository } from '../../src/identity/repository.mjs';
import { InMemorySecretService } from '../../src/security/secret-service.mjs';
import { IdentityService } from '../../apps/api/src/identity-service.mjs';
import { PostgresRetentionRepository } from '../../src/audit/retention.mjs';
import { GovernanceService } from '../../apps/api/src/governance-service.mjs';

const connectionString = process.env.DGOS_DATABASE_URL;
const dedicated = (() => { try { return /^\/(?:dgos_v1_governance|dgos_v1_verify_[0-9a-f]{32})$/.test(new URL(connectionString).pathname); } catch { return false; } })();

test('PostgreSQL login audit failure rolls back session creation', async (t) => {
  if (!dedicated) { t.skip('dedicated governance or Verify database required'); return; }
  const pool = new pg.Pool({ connectionString });
  t.after(() => pool.end());
  const repository = new PostgresIdentityRepository(pool);
  const service = new IdentityService({ repository, secretService: new InMemorySecretService() });
  const bootstrap = await service.bootstrap({ displayName: 'Governance test', credential: 'fixture-only', requestId: randomUUID() });
  const before = Number((await pool.query('SELECT count(*)::int AS count FROM admin_sessions WHERE principal_id=$1', [bootstrap.principalId])).rows[0].count);
  const audit = repository.audit;
  repository.audit = { record: async () => { throw new Error('audit_unavailable'); } };
  await assert.rejects(service.login({ principalHint: bootstrap.principalId, credential: 'fixture-only', requestId: randomUUID() }), /audit_unavailable/);
  assert.equal(Number((await pool.query('SELECT count(*)::int AS count FROM admin_sessions WHERE principal_id=$1', [bootstrap.principalId])).rows[0].count), before);
  repository.audit = audit;
  await pool.query('DELETE FROM audit_outbox WHERE event_id IN (SELECT event_id FROM audit_events WHERE actor_id=$1)', [bootstrap.principalId]);
  await pool.query('DELETE FROM audit_events WHERE actor_id=$1', [bootstrap.principalId]);
  await pool.query('DELETE FROM admin_sessions WHERE principal_id=$1', [bootstrap.principalId]);
  await pool.query('DELETE FROM admin_principals WHERE principal_id=$1', [bootstrap.principalId]);
});

test('PostgreSQL retention needs confirmed preview and preserves referenced revoked session', async (t) => {
  if (!dedicated) { t.skip('dedicated governance or Verify database required'); return; }
  const pool = new pg.Pool({ connectionString });
  t.after(() => pool.end());
  const auditId = randomUUID();
  const principalId = randomUUID();
  const sessionId = randomUUID();
  const referenceId = randomUUID();
  const repository = new PostgresRetentionRepository(pool);
  const governance = new GovernanceService({ retentionRepository: repository });
  await pool.query("INSERT INTO admin_principals(principal_id,status,credential_ref,roles) VALUES($1,'active',$2,'[\"admin\"]'::jsonb)", [principalId, `r3-retention-${principalId}`]);
  await pool.query("INSERT INTO admin_sessions(session_id,principal_id,state,expires_at,revoked_at) VALUES($1,$2,'revoked',now()-interval '40 days',now()-interval '40 days')", [sessionId, principalId]);
  await pool.query("INSERT INTO audit_events(event_id,request_id,actor_type,action,target_type,target_id,result) VALUES($1,$2,'system','retention.r3.reference','admin_session',$3,'succeeded')", [referenceId, randomUUID(), sessionId]);
  await pool.query('INSERT INTO audit_outbox(event_id) VALUES($1)', [referenceId]);
  await pool.query("INSERT INTO audit_events(event_id,request_id,actor_type,action,target_type,result,created_at) VALUES($1,$2,'system','retention.r3.fixture','fixture','succeeded',now()-interval '181 days')", [auditId, randomUUID()]);
  await pool.query('INSERT INTO audit_outbox(event_id,published_at) VALUES($1,now())', [auditId]);
  const preview = await governance.previewRetention();
  const plan = await governance.startRetention({ requestId: randomUUID() });
  await assert.rejects(governance.runRetention(plan.jobId, randomUUID()), /retention_preview_conflict/);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM audit_events WHERE event_id=$1', [auditId])).rows[0].count, 1);
  const confirmed = await governance.startRetention({ requestId: randomUUID(), previewDigest: preview.previewDigest });
  await governance.runRetention(confirmed.jobId, randomUUID());
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM audit_events WHERE event_id=$1', [auditId])).rows[0].count, 0);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM admin_sessions WHERE session_id=$1', [sessionId])).rows[0].count, 1);
  await pool.query('DELETE FROM retention_jobs WHERE job_id=ANY($1::uuid[])', [[plan.jobId, confirmed.jobId]]);
  await pool.query('DELETE FROM audit_outbox WHERE event_id=$1', [referenceId]);
  await pool.query('DELETE FROM audit_events WHERE event_id=$1', [referenceId]);
  await pool.query('DELETE FROM admin_sessions WHERE session_id=$1', [sessionId]);
  await pool.query('DELETE FROM admin_principals WHERE principal_id=$1', [principalId]);
});
