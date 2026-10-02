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
  const subjectId = randomUUID(); const suffix = randomUUID(); const base = { subjectId, scopeType: 'subject', scopeId: subjectId, metric: `requests_${suffix}`, windowSeconds: 3600, hardLimit: 3, softLimit: 2, effectiveAt: new Date().toISOString(), requestId: randomUUID(), actorId: subjectId };
  await pool.query('DELETE FROM quota_reservations WHERE subject_id=$1', [subjectId]);
  const policy = await service.updatePolicy(base); assert.equal(policy.version, '1');
  await assert.rejects(() => service.updatePolicy({ ...base, baseVersion: 0 }), /policy_version_conflict/);
  const attempts = Array.from({ length: 8 }, () => ({ subjectId, scopeType: 'subject', scopeId: subjectId, metric: base.metric, windowSeconds: 3600, hardLimit: 3, requestId: randomUUID(), taskId: randomUUID(), attemptId: randomUUID(), amount: 1 }));
  const outcomes = await Promise.allSettled(attempts.map((input) => service.reserveQuota(input)));
  assert.equal(outcomes.filter((x) => x.status === 'fulfilled').length, 3, outcomes.filter((x) => x.status === 'rejected').map((x) => x.reason?.message).join(','));
  const total = await pool.query("SELECT COALESCE(sum(amount),0)::numeric AS amount FROM quota_reservations WHERE subject_id=$1 AND metric=$2 AND state='reserved'", [subjectId, base.metric]); assert.equal(Number(total.rows[0].amount), 3);
  const created = outcomes.find((x) => x.status === 'fulfilled').value;
  const replay = await service.reserveQuota({ ...attempts.find((x) => x.taskId === created.taskId), requestId: created.requestId }); assert.equal(replay.reservationId, created.reservationId);
  const settled = await service.settleUsage({ reservationId: created.reservationId, requestId: created.requestId, taskId: created.taskId, attemptId: created.attemptId, terminalState: 'completed', amount: 1, usageStatus: 'unavailable' }, { actorId: subjectId, subjectId });
  const duplicateSettlements = await Promise.all(Array.from({ length: 5 }, () => service.settleUsage({ reservationId: created.reservationId, requestId: created.requestId, taskId: created.taskId, attemptId: created.attemptId, terminalState: 'completed', amount: 900, usageStatus: 'final' }, { actorId: subjectId, subjectId })));
  assert.equal(new Set(duplicateSettlements.map((entry) => entry.usageEventId)).size, 1); assert.equal(duplicateSettlements[0].usageEventId, settled.usage.usageEventId);
  await pool.query("UPDATE quota_reservations SET expires_at=now()-interval '1 second' WHERE reservation_id=$1", [outcomes.find((x) => x.status === 'fulfilled' && x.value.reservationId !== created.reservationId).value.reservationId]);
  const repaired = await service.reconcile({ checkpointName: `quota-${suffix}`, subjectId }); assert.equal(repaired.repaired, 1);
  const resumed = await service.reconcile({ checkpointName: `quota-${suffix}` }); assert.equal(resumed.state, 'completed'); assert.ok(resumed.repaired >= 0);
  const auditCount = await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE actor_id=$1 AND action LIKE 'quota.%'", [subjectId]); assert.ok(auditCount.rows[0].count >= 4);
  const outboxCount = await pool.query("SELECT count(*)::int AS count FROM audit_outbox WHERE event_id IN (SELECT event_id FROM audit_events WHERE actor_id=$1 AND action LIKE 'quota.%')", [subjectId]); assert.equal(outboxCount.rows[0].count, auditCount.rows[0].count);
  await pool.query('DELETE FROM audit_outbox WHERE event_id IN (SELECT event_id FROM audit_events WHERE actor_id=$1)', [subjectId]); await pool.query('DELETE FROM audit_events WHERE actor_id=$1', [subjectId]);
  await pool.query('DELETE FROM usage_events WHERE subject_id=$1', [subjectId]); await pool.query('DELETE FROM quota_reconciliation_items WHERE task_id IN (SELECT task_id FROM quota_reservations WHERE subject_id=$1)', [subjectId]);
  await pool.query('DELETE FROM quota_reservations WHERE subject_id=$1', [subjectId]); await pool.query('DELETE FROM quota_policies WHERE scope_id=$1', [subjectId]); await pool.query('DELETE FROM quota_reconciliation_checkpoints WHERE checkpoint_name=$1', [`quota-${suffix}`]); await pool.end();
});

test('PostgreSQL quota locks policy with reservation and rolls back on audit failure', async (t) => {
  const pool = new pg.Pool({ connectionString, max: 4 });
  try { await pool.query('SELECT 1'); } catch (error) { await pool.end(); t.skip(`PostgreSQL unavailable: ${error.message}`); return; }
  t.after(async () => pool.end());
  const audit = new PostgresAuditRepository(pool); const repository = new PostgresQuotaRepository(pool, { audit }); const service = new QuotaService({ repository });
  const subjectId = randomUUID(); const metric = `requests_${randomUUID()}`;
  const base = { subjectId, scopeType: 'subject', scopeId: subjectId, metric, windowSeconds: 3600, hardLimit: 2, effectiveAt: new Date(Date.now() - 1000).toISOString(), requestId: randomUUID() };
  await service.updatePolicy(base);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await repository.lockQuotaWindow(base, client);
    const pending = service.reserveQuota({ ...base, requestId: randomUUID(), taskId: randomUUID(), attemptId: randomUUID(), amount: 1 });
    await client.query('INSERT INTO quota_policies(policy_id,scope_type,scope_id,metric,window_seconds,hard_limit,version,effective_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(), 'subject', subjectId, metric, 3600, 0, 2, base.effectiveAt]);
    await client.query('COMMIT');
    await assert.rejects(pending, /quota_exceeded/);
  } finally { client.release(); }
  const denied = await pool.query('SELECT count(*)::int AS count FROM quota_reservations WHERE subject_id=$1 AND metric=$2', [subjectId, metric]); assert.equal(denied.rows[0].count, 0);
  await service.updatePolicy({ ...base, baseVersion: 2, hardLimit: 2 });
  const requestId = randomUUID(); const taskId = randomUUID(); const attemptId = randomUUID();
  const reservation = await service.reserveQuota({ ...base, requestId, taskId, attemptId, amount: 1 });
  const settlement = { reservationId: reservation.reservationId, requestId, taskId, attemptId, terminalState: 'completed', amount: 1, usageStatus: 'final' };
  await assert.rejects(() => service.settleUsage(settlement, { actorId: randomUUID(), subjectId }), /insufficient_scope/);
  const untouched = await repository.getReservation(reservation.reservationId); assert.equal(untouched.state, 'reserved');
  repository.audit = { record: async () => { throw new Error('audit_failed'); } };
  await assert.rejects(() => service.settleUsage(settlement, { actorId: subjectId, subjectId }), /audit_failed/);
  const state = await repository.getReservation(reservation.reservationId); assert.equal(state.state, 'reserved');
  const usage = await pool.query('SELECT count(*)::int AS count FROM usage_events WHERE reservation_id=$1', [reservation.reservationId]); assert.equal(usage.rows[0].count, 0);
  await assert.rejects(() => service.reserveQuota({ ...base, requestId: randomUUID(), taskId: randomUUID(), attemptId: randomUUID(), amount: 1 }), /audit_failed/);
  const after = await pool.query('SELECT count(*)::int AS count FROM quota_reservations WHERE subject_id=$1 AND metric=$2', [subjectId, metric]); assert.equal(after.rows[0].count, 1);
  repository.audit = null;
  await assert.rejects(() => service.updatePolicy({ ...base, baseVersion: 3 }), /audit_unavailable/);
  const versions = await pool.query('SELECT count(*)::int AS count FROM quota_policies WHERE scope_id=$1 AND metric=$2', [subjectId, metric]); assert.equal(versions.rows[0].count, 3);
  const auditRows = await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE request_id=$1 AND action='quota.reservation.settle'", [requestId]); assert.equal(auditRows.rows[0].count, 0);
  await pool.query("UPDATE quota_reservations SET expires_at=now()-interval '1 second' WHERE reservation_id=$1", [reservation.reservationId]);
  const expiredHeld = await repository.reservedAmount({ scopeType: 'subject', scopeId: subjectId, metric, windowStart: state.windowStart }); assert.equal(expiredHeld, 1);
  await pool.query("UPDATE quota_reservations SET state='needs_review',expires_at=now()-interval '1 second' WHERE reservation_id=$1", [reservation.reservationId]);
  const held = await repository.reservedAmount({ scopeType: 'subject', scopeId: subjectId, metric, windowStart: state.windowStart }); assert.equal(held, 1);
  repository.audit = audit;
  await assert.rejects(() => service.reserveQuota({ ...base, requestId: randomUUID(), taskId: randomUUID(), attemptId: randomUUID(), amount: 2 }), /quota_exceeded/);
  await pool.query('DELETE FROM audit_outbox WHERE event_id IN (SELECT event_id FROM audit_events WHERE actor_id=$1 AND action LIKE \'quota.%\')', [subjectId]);
  await pool.query('DELETE FROM audit_events WHERE actor_id=$1 AND action LIKE \'quota.%\'', [subjectId]);
  await pool.query('DELETE FROM quota_reservations WHERE subject_id=$1 AND metric=$2', [subjectId, metric]);
  await pool.query('DELETE FROM quota_policies WHERE scope_id=$1 AND metric=$2', [subjectId, metric]);
});
