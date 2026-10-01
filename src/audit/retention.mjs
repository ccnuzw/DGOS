import { createHash, randomUUID } from 'node:crypto';

const RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
const digest = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

export class PostgresRetentionRepository {
  constructor(pool) { this.pool = pool; }
  async preview({ cutoffAt = new Date(Date.now() - RETENTION_MS) }) { const { rows } = await this.pool.query("SELECT count(*)::int AS count FROM audit_events WHERE created_at < $1", [cutoffAt]); return { cutoffAt: new Date(cutoffAt).toISOString(), eligibleCount: rows[0].count }; }
  async createJob({ previewDigest, cutoffAt }) { const { rows } = await this.pool.query('INSERT INTO retention_jobs (job_id, preview_digest, state, cutoff_at) VALUES ($1, $2, $3, $4) RETURNING *', [randomUUID(), previewDigest, 'planned', cutoffAt]); return this.row(rows[0]); }
  async getJob(jobId) { const { rows } = await this.pool.query('SELECT * FROM retention_jobs WHERE job_id = $1', [jobId]); return this.row(rows[0]); }
  async runJob(jobId, batchSize = 100) { const client = await this.pool.connect(); try { await client.query('BEGIN'); const job = (await client.query('SELECT * FROM retention_jobs WHERE job_id = $1 FOR UPDATE', [jobId])).rows[0]; if (!job) return undefined; const checkpoint = job.checkpoint ?? '9999-12-31T23:59:59.999Z'; const events = (await client.query("SELECT event_id, created_at FROM audit_events WHERE created_at < $1 AND created_at < $2 ORDER BY created_at DESC, event_id DESC LIMIT $3", [job.cutoff_at, checkpoint, batchSize])).rows; if (!events.length) { await client.query("UPDATE retention_jobs SET state = 'completed', updated_at = now() WHERE job_id = $1", [jobId]); await client.query('COMMIT'); return this.getJob(jobId); } const ids = events.map((event) => event.event_id); await client.query('DELETE FROM audit_outbox WHERE event_id = ANY($1::uuid[])', [ids]); const deleted = await client.query('DELETE FROM audit_events WHERE event_id = ANY($1::uuid[])', [ids]); const last = events.at(-1).created_at.toISOString(); const remaining = await client.query("SELECT 1 FROM audit_events WHERE created_at < $1 AND created_at < $2 LIMIT 1", [job.cutoff_at, last]); await client.query("UPDATE retention_jobs SET state = $2, checkpoint = $3, scanned_count = scanned_count + $4, deleted_count = deleted_count + $4, updated_at = now() WHERE job_id = $1", [jobId, remaining.rows.length ? 'running' : 'completed', last, deleted.rowCount]); await client.query('COMMIT'); return this.getJob(jobId); } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }
  row(row) { return row && { jobId: row.job_id, previewDigest: row.preview_digest, state: row.state, checkpoint: row.checkpoint, cutoffAt: row.cutoff_at.toISOString(), scannedCount: row.scanned_count, deletedCount: row.deleted_count, skippedCount: row.skipped_count, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() }; }
}

export class InMemoryRetentionRepository {
  constructor(audit) { this.audit = audit; this.jobs = new Map(); }
  async preview({ cutoffAt = new Date(Date.now() - RETENTION_MS) }) { const events = [...this.audit.events.values()].filter((event) => new Date(event.createdAt ?? 0) < cutoffAt); return { cutoffAt: cutoffAt.toISOString(), eligibleCount: events.length }; }
  async createJob({ previewDigest, cutoffAt }) { const job = { jobId: randomUUID(), previewDigest, state: 'planned', checkpoint: null, cutoffAt: new Date(cutoffAt).toISOString(), scannedCount: 0, deletedCount: 0, skippedCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; this.jobs.set(job.jobId, job); return job; }
  async getJob(jobId) { return this.jobs.get(jobId); }
  async runJob(jobId) { const job = this.jobs.get(jobId); if (!job) return undefined; job.state = 'completed'; job.updatedAt = new Date().toISOString(); return job; }
}

export function previewDigest(preview) { return digest(JSON.stringify(preview)); }
