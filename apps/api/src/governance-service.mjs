import { previewDigest } from '../../../src/audit/retention.mjs';

export class GovernanceService {
  constructor({ retentionRepository, auditRepository }) { this.retention = retentionRepository; this.audit = auditRepository; }
  attachPackageRetention(packageRetention) { this.retention.packageRetention = packageRetention; return this; }
  async getPolicy() { return this.retention.policy(); }
  async updatePolicy(input) { return this.retention.updatePolicy(input); }
  async previewRetention() { const preview = await this.retention.preview({}); return { ...preview, previewDigest: previewDigest(preview) }; }
  async startRetention({ requestId, actorId, confirmDigest, previewDigest: suppliedDigest, dryRun = false }) { const preview = await this.previewRetention(); const confirmation = suppliedDigest ?? confirmDigest; if (confirmation && confirmation !== preview.previewDigest) throw Object.assign(new Error('retention_preview_conflict'), { statusCode: 409 }); if (dryRun) return { preview, state: 'planned' }; const job = await this.retention.createJob({ previewDigest: preview.previewDigest, cutoffAt: preview.cutoffAt, policyVersion: preview.policyVersion, requestId, actorId, confirmed: Boolean(confirmation) }); return { ...job, preview }; }
  async getRetention(jobId) { const job = await this.retention.getJob(jobId); if (!job) throw Object.assign(new Error('retention_job_not_found'), { statusCode: 404 }); return job; }
  async runRetention(jobId, requestId, actorId, confirmation) { const job = await this.retention.runJob(jobId, 100, { requestId, actorId, confirmation }); if (!job) throw Object.assign(new Error('retention_job_not_found'), { statusCode: 404 }); return job; }
}
