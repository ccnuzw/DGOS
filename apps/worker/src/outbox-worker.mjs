export class AuditOutboxWorker {
  constructor({ auditRepository, publish, workerId, leaseMs = 15_000 }) { this.auditRepository = auditRepository; this.publish = publish; this.workerId = workerId; this.leaseMs = leaseMs; }
  async runOnce() { const item = await this.auditRepository.claim(this.workerId, this.leaseMs); if (!item) return undefined; try { await this.publish(item.eventId); return this.auditRepository.markPublished(item.eventId, this.workerId); } catch { return this.auditRepository.markFailed(item.eventId, this.workerId); } }
}
