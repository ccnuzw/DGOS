import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { PostgresRetentionRepository, previewDigest } from '../../src/audit/retention.mjs';

test('PostgreSQL retention job deletes expired audit rows in resumable batches', async (t) => {
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL ?? 'postgres://dgos:dgos@127.0.0.1:5432/dgos' });
  try { await pool.query('SELECT 1'); } catch (error) { await pool.end(); t.skip(`PostgreSQL unavailable: ${error.message}`); return; }
  const auditIds = [randomUUID(), randomUUID()];
  for (const eventId of auditIds) {
    await pool.query('INSERT INTO audit_events (event_id, request_id, actor_type, action, target_type, result, created_at) VALUES ($1, $2, $3, $4, $5, $6, now() - interval \'181 days\')', [eventId, randomUUID(), 'system', 'retention.fixture', 'fixture', 'succeeded']);
    await pool.query('INSERT INTO audit_outbox (event_id, published_at) VALUES ($1, now())', [eventId]);
  }
  const repository = new PostgresRetentionRepository(pool);
  const preview = await repository.preview({});
  const job = await repository.createJob({ previewDigest: previewDigest(preview), cutoffAt: preview.cutoffAt, policyVersion: preview.policyVersion, confirmed: true });
  const progressed = await repository.runJob(job.jobId, 1);
  assert.equal(progressed.deletedCount, 1);
  assert.equal(progressed.state, 'running');
  const completed = await repository.runJob(job.jobId, 10);
  assert.equal(completed.state, 'completed');
  const remaining = await pool.query('SELECT count(*)::int AS count FROM audit_events WHERE event_id = ANY($1::uuid[])', [auditIds]);
  assert.equal(remaining.rows[0].count, 0);
  await pool.query('DELETE FROM retention_jobs WHERE job_id = $1', [job.jobId]);
  await pool.end();
});

test('retention keeps unpublished audit and rolls back when progress audit fails', async (t) => {
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL ?? 'postgres://dgos:dgos@127.0.0.1:5432/dgos' });
  try { await pool.query('SELECT 1'); } catch (error) { await pool.end(); t.skip(`PostgreSQL unavailable: ${error.message}`); return; }
  const publishedId = randomUUID(); const pendingId = randomUUID();
  for (const eventId of [publishedId, pendingId]) {
    await pool.query("INSERT INTO audit_events (event_id,request_id,actor_type,action,target_type,result,created_at) VALUES ($1,$2,'system','retention.fixture','fixture','succeeded',now()-interval '181 days')", [eventId, randomUUID()]);
    await pool.query('INSERT INTO audit_outbox (event_id,published_at) VALUES ($1,$2)', [eventId, eventId === publishedId ? new Date() : null]);
  }
  const repository = new PostgresRetentionRepository(pool);
  const preview = await repository.preview({});
  const job = await repository.createJob({ previewDigest: previewDigest(preview), cutoffAt: preview.cutoffAt, policyVersion: preview.policyVersion, confirmed: true });
  const audit = repository.audit;
  repository.audit = { record: async () => { throw new Error('audit_unavailable'); } };
  await assert.rejects(repository.runJob(job.jobId), /audit_unavailable/);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM audit_events WHERE event_id=$1', [publishedId])).rows[0].count, 1);
  assert.equal((await repository.getJob(job.jobId)).deletedCount, 0);
  repository.audit = audit;
  const result = await repository.runJob(job.jobId);
  assert.equal(result.state, 'partial');
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM audit_events WHERE event_id=$1', [publishedId])).rows[0].count, 0);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM audit_events WHERE event_id=$1', [pendingId])).rows[0].count, 1);
  await pool.query('DELETE FROM retention_jobs WHERE job_id=$1', [job.jobId]);
  await pool.query('DELETE FROM audit_outbox WHERE event_id=$1', [pendingId]);
  await pool.query('DELETE FROM audit_events WHERE event_id=$1', [pendingId]);
  await pool.end();
});
