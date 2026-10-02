import { createHash, randomUUID } from 'node:crypto';
import { PostgresAuditRepository } from './outbox.mjs';

const RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
const digest = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

export class PostgresRetentionRepository {
  constructor(pool, { audit = new PostgresAuditRepository(pool), clock = () => Date.now(), packageRetention } = {}) { this.pool = pool; this.audit = audit; this.clock = clock; this.packageRetention = packageRetention; }
  async policy(client = this.pool) { const { rows } = await client.query('SELECT * FROM governance_policy WHERE singleton = true'); const row = rows[0]; return row && { policyVersion: String(row.policy_version), version: String(row.policy_version), auditRetentionDays: row.audit_retention_days, cacheRetentionDays: row.cache_retention_days, revokedSessionRetentionDays: row.revoked_session_retention_days, updatedAt: row.updated_at.toISOString() }; }
  async updatePolicy({ baseVersion, auditRetentionDays, cacheRetentionDays = 30, revokedSessionRetentionDays = 30, reason, requestId, actorId }) {
    if (!Number.isInteger(auditRetentionDays) || auditRetentionDays < 180 || !Number.isInteger(cacheRetentionDays) || cacheRetentionDays < 30 || !Number.isInteger(revokedSessionRetentionDays) || revokedSessionRetentionDays < 30 || !reason?.trim()) throw Object.assign(new Error('invalid_retention_policy'), { statusCode: 422 });
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); const { rows } = await client.query('UPDATE governance_policy SET policy_version=policy_version+1,audit_retention_days=$2,cache_retention_days=$3,revoked_session_retention_days=$4,updated_at=now() WHERE singleton=true AND policy_version=$1 RETURNING *', [baseVersion, auditRetentionDays, cacheRetentionDays, revokedSessionRetentionDays]); if (!rows[0]) throw Object.assign(new Error('version_conflict'), { statusCode: 409 }); const eventId = await this.audit.record({ requestId, actorId, action: 'governance.policy.update', targetType: 'governance_policy', summary: { reason, auditRetentionDays, cacheRetentionDays, revokedSessionRetentionDays }, policyVersion: rows[0].policy_version }, client); await client.query('COMMIT'); return { ...(await this.policy()), eventId }; }
    catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async preview({ cutoffAt } = {}) { const policy = await this.policy(); if (!policy) throw new Error('governance_policy_unavailable'); const stableNow = Math.floor(this.clock() / 60_000) * 60_000; const safeCutoff = new Date(stableNow - policy.auditRetentionDays * 86400000); const cutoff = cutoffAt ? new Date(cutoffAt) : safeCutoff; if (cutoff > safeCutoff) throw Object.assign(new Error('invalid_retention_policy'), { statusCode: 422 }); const { rows } = await this.pool.query("SELECT count(*)::int AS count FROM audit_events WHERE created_at < $1", [cutoff]); const sessionCutoff = new Date(stableNow - policy.revokedSessionRetentionDays * 86400000); const sessions = await this.pool.query("SELECT count(*)::int AS count FROM admin_sessions WHERE state='revoked' AND revoked_at < $1", [sessionCutoff]); return { cutoffAt: cutoff.toISOString(), revokedSessionCutoffAt: sessionCutoff.toISOString(), policyVersion: policy.version, eligibleCount: rows[0].count, revokedSessionCount: sessions.rows[0].count, ...(this.packageRetention ? { packageRetention: await this.packageRetention.preview(policy) } : {}) }; }
  async createJob({ previewDigest, cutoffAt, policyVersion, requestId = randomUUID(), actorId = null, confirmed = false }) { const client = await this.pool.connect(); try { await client.query('BEGIN'); const { rows } = await client.query('INSERT INTO retention_jobs (job_id, preview_digest, state, cutoff_at, policy_version, request_id, actor_id, checkpoint) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [randomUUID(), previewDigest, 'planned', cutoffAt, policyVersion ?? (await this.policy(client)).version, requestId, actorId, confirmed ? JSON.stringify({ confirmedDigest: previewDigest }) : null]); await this.audit.record({ requestId, actorId, action: 'governance.retention.start', targetType: 'retention_job', targetId: rows[0].job_id, summary: { previewDigest, confirmed } }, client); await client.query('COMMIT'); return this.row(rows[0]); } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }
  async getJob(jobId) { const { rows } = await this.pool.query('SELECT * FROM retention_jobs WHERE job_id = $1', [jobId]); return this.row(rows[0]); }
  async runJob(jobId, batchSize = 100, { requestId, actorId, confirmation } = {}) {
    const preliminary = await this.pool.query('SELECT * FROM retention_jobs WHERE job_id=$1', [jobId]);
    const pendingJob = preliminary.rows[0];
    let packageBatch;
    if (pendingJob && pendingJob.state !== 'completed') {
      const currentPolicy = await this.policy();
      if (Number(pendingJob.policy_version) !== Number(currentPolicy?.version)) throw Object.assign(new Error('version_conflict'), { statusCode: 409 });
      if (pendingJob.actor_id && actorId !== pendingJob.actor_id) throw Object.assign(new Error('permission_denied'), { statusCode: 403 });
      const stored = pendingJob.checkpoint ? JSON.parse(pendingJob.checkpoint).confirmedDigest : null;
      if (stored !== pendingJob.preview_digest && confirmation !== pendingJob.preview_digest) throw Object.assign(new Error('retention_preview_conflict'), { statusCode: 409 });
      if (pendingJob.state === 'planned') {
        const currentPreview = await this.preview({ cutoffAt: pendingJob.cutoff_at.toISOString() });
        if (previewDigest(currentPreview) !== pendingJob.preview_digest) throw Object.assign(new Error('retention_preview_conflict'), { statusCode: 409 });
      }
      if (this.packageRetention) packageBatch = await this.packageRetention.runBatch(pendingJob, currentPolicy, batchSize);
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const job = (await client.query('SELECT * FROM retention_jobs WHERE job_id=$1 FOR UPDATE', [jobId])).rows[0];
      if (!job) { await client.query('COMMIT'); return undefined; }
      if (job.state === 'completed') { await client.query('COMMIT'); return this.row(job); }
      const policy = await this.policy(client);
      if (Number(job.policy_version) !== Number(policy?.version)) throw Object.assign(new Error('version_conflict'), { statusCode: 409 });
      if (job.actor_id && actorId !== job.actor_id) throw Object.assign(new Error('permission_denied'), { statusCode: 403 });
      const storedConfirmation = job.checkpoint ? JSON.parse(job.checkpoint).confirmedDigest : null;
      if (storedConfirmation !== job.preview_digest && confirmation !== job.preview_digest) throw Object.assign(new Error('retention_preview_conflict'), { statusCode: 409 });
      const safeCutoff = new Date(this.clock() - policy.auditRetentionDays * 86400000);
      const cutoff = new Date(Math.min(new Date(job.cutoff_at).getTime(), safeCutoff.getTime()));
      const events = (await client.query("SELECT e.event_id,e.created_at FROM audit_events e WHERE e.created_at<$1 AND NOT EXISTS (SELECT 1 FROM audit_outbox o WHERE o.event_id=e.event_id AND o.published_at IS NULL) ORDER BY e.created_at DESC,e.event_id DESC LIMIT $2 FOR UPDATE OF e", [cutoff, batchSize])).rows;
      const ids = events.map((event) => event.event_id);
      if (ids.length) { await client.query('DELETE FROM audit_outbox WHERE event_id=ANY($1::uuid[])', [ids]); await client.query('DELETE FROM audit_events WHERE event_id=ANY($1::uuid[])', [ids]); }
      const sessionCutoff = new Date(this.clock() - policy.revokedSessionRetentionDays * 86400000);
      const sessions = await client.query("DELETE FROM admin_sessions WHERE session_id IN (SELECT s.session_id FROM admin_sessions s WHERE s.state='revoked' AND s.revoked_at<$1 AND NOT EXISTS (SELECT 1 FROM audit_events e WHERE e.target_type='admin_session' AND e.target_id=s.session_id::text) LIMIT $2 FOR UPDATE OF s SKIP LOCKED) RETURNING session_id", [sessionCutoff, batchSize]);
      const nextCheckpoint = JSON.stringify({ confirmedDigest: job.preview_digest, ...(events.length ? { createdAt: events.at(-1).created_at.toISOString(), eventId: events.at(-1).event_id } : {}) });
      const pending = await client.query("SELECT 1 FROM audit_events e JOIN audit_outbox o ON o.event_id=e.event_id WHERE e.created_at<$1 AND o.published_at IS NULL LIMIT 1", [cutoff]);
      const state = events.length < batchSize && sessions.rowCount < batchSize && !packageBatch?.full ? (pending.rowCount || packageBatch?.failed ? 'partial' : 'completed') : 'running';
      const updated = (await client.query('UPDATE retention_jobs SET state=$2,checkpoint=$3,scanned_count=scanned_count+$4,deleted_count=deleted_count+$4,updated_at=now() WHERE job_id=$1 RETURNING *', [jobId, state, nextCheckpoint, events.length + sessions.rowCount])).rows[0];
      await this.audit.record({ requestId: requestId ?? job.request_id, actorId: actorId ?? job.actor_id, action: 'governance.retention.progress', targetType: 'retention_job', targetId: jobId, summary: { state, deletedCount: events.length + sessions.rowCount } }, client);
      await client.query('COMMIT'); return this.row(updated);
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  row(row) { return row && { jobId: row.job_id, requestId: row.request_id, previewDigest: row.preview_digest, state: row.state, checkpoint: row.checkpoint, cutoffAt: row.cutoff_at.toISOString(), policyVersion: row.policy_version && String(row.policy_version), scannedCount: row.scanned_count, deletedCount: row.deleted_count, skippedCount: row.skipped_count, failureCount: row.failure_count ?? 0, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() }; }
}

export class InMemoryRetentionRepository {
  constructor(audit) { this.audit = audit; this.jobs = new Map(); this.currentPolicy = { policyVersion: '1', version: '1', auditRetentionDays: 180, cacheRetentionDays: 30, revokedSessionRetentionDays: 30 }; }
  async policy() { return { ...this.currentPolicy }; }
  async updatePolicy({ baseVersion, auditRetentionDays, cacheRetentionDays = 30, revokedSessionRetentionDays = 30, reason, requestId, actorId }) { if (!Number.isInteger(auditRetentionDays) || auditRetentionDays < 180 || !Number.isInteger(cacheRetentionDays) || cacheRetentionDays < 30 || !Number.isInteger(revokedSessionRetentionDays) || revokedSessionRetentionDays < 30 || !reason?.trim()) throw Object.assign(new Error('invalid_retention_policy'), { statusCode: 422 }); if (String(baseVersion) !== this.currentPolicy.version) throw Object.assign(new Error('version_conflict'), { statusCode: 409 }); const eventId = await this.audit.record({ requestId, actorId, action: 'governance.policy.update', targetType: 'governance_policy', summary: { reason } }); this.currentPolicy = { policyVersion: String(Number(baseVersion) + 1), version: String(Number(baseVersion) + 1), auditRetentionDays, cacheRetentionDays, revokedSessionRetentionDays }; return { ...this.currentPolicy, eventId }; }
  async preview({ cutoffAt } = {}) { const safe = new Date(Math.floor(Date.now() / 60_000) * 60_000 - this.currentPolicy.auditRetentionDays * 86400000); const selected = cutoffAt ? new Date(cutoffAt) : safe; if (selected > safe) throw Object.assign(new Error('invalid_retention_policy'), { statusCode: 422 }); const events = [...this.audit.events.values()].filter((event) => new Date(event.createdAt ?? Date.now()) < selected); return { cutoffAt: selected.toISOString(), policyVersion: this.currentPolicy.version, eligibleCount: events.length, revokedSessionCount: 0 }; }
  async createJob({ previewDigest, cutoffAt, policyVersion, requestId = randomUUID(), actorId, confirmed = false }) { const job = { jobId: randomUUID(), requestId, actorId, previewDigest, state: 'planned', checkpoint: confirmed ? JSON.stringify({ confirmedDigest: previewDigest }) : null, cutoffAt: new Date(cutoffAt).toISOString(), policyVersion: policyVersion ?? this.currentPolicy.version, scannedCount: 0, deletedCount: 0, skippedCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; await this.audit.record({ requestId, actorId, action: 'governance.retention.start', targetType: 'retention_job', targetId: job.jobId }); this.jobs.set(job.jobId, job); return job; }
  async getJob(jobId) { return this.jobs.get(jobId); }
  async runJob(jobId, _batchSize, { requestId, actorId, confirmation } = {}) { const job = this.jobs.get(jobId); if (!job) return undefined; if (job.policyVersion !== this.currentPolicy.version) throw Object.assign(new Error('version_conflict'), { statusCode: 409 }); if (job.actorId && actorId !== job.actorId) throw Object.assign(new Error('permission_denied'), { statusCode: 403 }); if (job.checkpoint && JSON.parse(job.checkpoint).confirmedDigest !== job.previewDigest && confirmation !== job.previewDigest || !job.checkpoint && confirmation !== job.previewDigest) throw Object.assign(new Error('retention_preview_conflict'), { statusCode: 409 }); await this.audit.record({ requestId: requestId ?? job.requestId, actorId, action: 'governance.retention.progress', targetType: 'retention_job', targetId: jobId }); job.checkpoint = JSON.stringify({ confirmedDigest: job.previewDigest }); job.state = 'completed'; job.updatedAt = new Date().toISOString(); return job; }
}

export function previewDigest(preview) {
  const stable = {
    cutoffAt: preview.cutoffAt,
    revokedSessionCutoffAt: preview.revokedSessionCutoffAt,
    policyVersion: preview.policyVersion,
    packageRetention: preview.packageRetention?.plan ?? preview.packageRetention?.policyVersion ?? null,
  };
  return digest(JSON.stringify(stable));
}
