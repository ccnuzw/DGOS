import { previewDigest } from '../../../src/audit/retention.mjs';

export class GovernanceService {
  constructor({ retentionRepository, auditRepository }) { this.retention = retentionRepository; this.audit = auditRepository; }
  async startRetention({ requestId, actorId, confirmDigest }) { const preview = await this.retention.preview({}); const digest = previewDigest(preview); if (confirmDigest && confirmDigest !== digest) throw Object.assign(new Error('retention_preview_conflict'), { statusCode: 409 }); const job = await this.retention.createJob({ previewDigest: digest, cutoffAt: preview.cutoffAt }); await this.audit.record({ requestId, actorId, action: 'governance.retention.start', targetType: 'retention_job', targetId: job.jobId, summary: { previewDigest: digest, eligibleCount: preview.eligibleCount } }); return { ...job, preview: { ...preview, previewDigest: digest } }; }
  async getRetention(jobId) { const job = await this.retention.getJob(jobId); if (!job) throw Object.assign(new Error('retention_job_not_found'), { statusCode: 404 }); return job; }
  async runRetention(jobId, requestId, actorId) { const job = await this.retention.runJob(jobId); if (!job) throw Object.assign(new Error('retention_job_not_found'), { statusCode: 404 }); await this.audit.record({ requestId, actorId, action: 'governance.retention.progress', targetType: 'retention_job', targetId: jobId, summary: { state: job.state, checkpoint: job.checkpoint, deletedCount: job.deletedCount } }); return job; }
}
