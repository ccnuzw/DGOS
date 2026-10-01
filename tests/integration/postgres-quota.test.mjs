import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from '../../apps/api/node_modules/pg/esm/index.mjs';
import { PostgresQuotaRepository } from '../../src/quota/repository.mjs';
import { QuotaService } from '../../src/quota/service.mjs';
import { PostgresAuditRepository } from '../../src/audit/outbox.mjs';

const connectionString = process.env.DGOS_DATABASE_URL ?? 'postgres://dgos:dgos@127.0.0.1:5432/dgos';

test('PostgreSQL quota reservation concurrency, idempotency, settlement and checkpoint recovery', async (t) => {
  const pool = new pg.Pool({ connectionString, max: 12 });
  try { await pool.query('SELECT 1'); } catch (error) { await pool.end(); t.skip(`PostgreSQL unavailable: ${error.message}`); return; }
  const audit = new PostgresAuditRepository(pool); const repository = new PostgresQuotaRepository(pool, { audit }); const service = new QuotaService({ repository, audit });
  const subjectId = randomUUID(); const suffix = randomUUID(); const base = { subjectId, scopeType: 'subject', scopeId: subjectId, metric: `requests_${suffix}`, windowSeconds: 3600, hardLimit: 3, softLimit: 2, requestId: randomUUID(), actorId: subjectId };
  await pool.query('DELETE FROM quota_reservations WHERE subject_id=$1', [subjectId]);
  const policy = await service.updatePolicy(base); assert.equal(policy.version, 1);
  await assert.rejects(() => service.updatePolicy({ ...base, baseVersion: 0 }), /policy_version_conflict/);
  const attempts = Array.from({ length: 8 }, () => ({ subjectId, scopeType: 'subject', scopeId: subjectId, metric: base.metric, windowSeconds: 3600, hardLimit: 3, requestId: randomUUID(), taskId: randomUUID(), attemptId: randomUUID(), amount: 1 }));
  const outcomes = await Promise.allSettled(attempts.map((input) => service.reserveQuota(input)));
  assert.equal(outcomes.filter((x) => x.status === 'fulfilled').length, 3, outcomes.filter((x) => x.status === 'rejected').map((x) => x.reason?.message).join(','));
  const total = await pool.query("SELECT COALESCE(sum(amount),0)::numeric AS amount FROM quota_reservations WHERE subject_id=$1 AND metric=$2 AND state='reserved'", [subjectId, base.metric]); assert.equal(Number(total.rows[0].amount), 3);
  const created = outcomes.find((x) => x.status === 'fulfilled').value;
  const replay = await service.reserveQuota({ ...attempts.find((x) => x.taskId === created.taskId), requestId: created.requestId }); assert.equal(replay.reservationId, created.reservationId);
  const settled = await service.settleUsage({ reservationId: created.reservationId, requestId: created.requestId, amount: 1, usageStatus: 'unavailable' });
  const duplicate = await service.settleUsage({ reservationId: created.reservationId, requestId: created.requestId, amount: 900, usageStatus: 'final' }); assert.equal(duplicate.usage.usageEventId, settled.usage.usageEventId); assert.equal(duplicate.idempotent, true);
  await pool.query("UPDATE quota_reservations SET expires_at=now()-interval '1 second' WHERE reservation_id=$1", [outcomes.find((x) => x.status === 'fulfilled' && x.value.reservationId !== created.reservationId).value.reservationId]);
  const repaired = await service.reconcile({ checkpointName: `quota-${suffix}` }); assert.equal(repaired.repaired, 1);
  const resumed = await service.reconcile({ checkpointName: `quota-${suffix}` }); assert.equal(resumed.state, 'completed');
  const auditCount = await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE actor_id=$1 AND action LIKE 'quota.%'", [subjectId]); assert.ok(auditCount.rows[0].count >= 4);
  await pool.query('DELETE FROM audit_outbox WHERE event_id IN (SELECT event_id FROM audit_events WHERE actor_id=$1)', [subjectId]); await pool.query('DELETE FROM audit_events WHERE actor_id=$1', [subjectId]);
  await pool.query('DELETE FROM usage_events WHERE subject_id=$1', [subjectId]); await pool.query('DELETE FROM quota_reconciliation_items WHERE task_id IN (SELECT task_id FROM quota_reservations WHERE subject_id=$1)', [subjectId]);
  await pool.query('DELETE FROM quota_reservations WHERE subject_id=$1', [subjectId]); await pool.query('DELETE FROM quota_policies WHERE scope_id=$1', [subjectId]); await pool.query('DELETE FROM quota_reconciliation_checkpoints WHERE checkpoint_name=$1', [`quota-${suffix}`]); await pool.end();
});
