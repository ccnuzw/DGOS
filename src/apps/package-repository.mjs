import { randomUUID } from 'node:crypto';

const key = (appId, version, build, releaseChannel) => `${appId}:${releaseChannel}:${version}:${build}`;
export class InMemoryPackageRepository {
  constructor() { this.packages = new Map(); this.deployments = new Map(); this.operations = []; this.migrations = new Map(); }
  async recordMigration(row) { this.migrations.set(row.migrationId, { ...row, state: 'prepared' }); }
  async finishMigration(migrationId, state, afterDigest) { const row = this.migrations.get(migrationId); Object.assign(row, { state, afterDigest }); }
  async listPendingMigrations(subjectId, appId) { return [...this.migrations.values()].filter((item) => item.state === 'prepared' && item.subjectId === subjectId && item.appId === appId); }
  async recordPackage({ app, digest, source, keyId, requestId, effectiveTrustLevel, uninstallPolicy, catalogState }) {
    const identity = key(app.appId, app.version, app.build, app.releaseChannel);
    if (this.packages.has(identity)) throw Object.assign(new Error('version_conflict'), { statusCode: 409 });
    const record = { packageId: randomUUID(), appId: app.appId, version: app.version, build: app.build, releaseChannel: app.releaseChannel, manifest: app, digest, source, keyId, requestId, trustLevel: effectiveTrustLevel, uninstallPolicy, catalogState, reviewVersion: 1 };
    this.packages.set(identity, record); return record;
  }
  async removePackage(record) { this.packages.delete(key(record.appId, record.version, record.build, record.releaseChannel)); }
  async withLock(_subjectId, _appId, work) { return work(); }
  async withAppLock(_appId, work) { return work(); }
  async atomic(work) { return work(); }
  async auditEvent(event) { this.auditEvents ??= []; this.auditEvents.push(event); }
  async listRecoveryTargets() { return [...new Map([...this.deployments.values(), ...this.operations.filter((item) => item.state === 'prepared' && item.subjectId)].map((item) => [`${item.subjectId}:${item.appId}`, { subjectId: item.subjectId, appId: item.appId }])).values()]; }
  async markActionsSynced(subjectId, appId) { const row = await this.getDeployment(subjectId, appId); if (row) row.actionsSynced = true; }
  async settlePrepared(subjectId, appId) { for (const item of this.operations) if (item.subjectId === subjectId && item.appId === appId && item.state === 'prepared') item.state = 'rolled_back'; }
  async getPackageById(packageId) { return [...this.packages.values()].find((item) => item.packageId === packageId) ?? null; }
  async findPackageByRequest(requestId) { return [...this.packages.values()].find((item) => item.requestId === requestId) ?? null; }
  async getPackage(appId, version, build, releaseChannel) { if (!releaseChannel) return null; if (version === undefined || build === undefined) return [...this.packages.values()].filter((item) => item.appId === appId && item.releaseChannel === releaseChannel).sort((a, b) => b.version.localeCompare(a.version))[0] ?? null; return this.packages.get(key(appId, version, build, releaseChannel)); }
  async listPackages({ publicOnly = true } = {}) { return [...this.packages.values()].filter((row) => !publicOnly || ['official', 'approved'].includes(row.catalogState)); }
  async reviewPackage({ record, baseVersion, decision, actorId, requestId, reason }) {
    if (record.reviewVersion !== baseVersion) throw Object.assign(new Error('version_conflict'), { statusCode: 409 });
    if (record.catalogState !== 'pending_review' && !(record.catalogState === 'approved' && decision === 'withdrawn')) throw Object.assign(new Error('review_conflict'), { statusCode: 409 });
    Object.assign(record, { catalogState: decision, reviewVersion: record.reviewVersion + 1, reviewerId: actorId, reviewRequestId: requestId, reviewReason: reason }); return record;
  }
  async getDeployment(subjectId, appId) { return this.deployments.get(`${subjectId}:${appId}`) ?? null; }
  async restoreDeployment(subjectId, appId, previous) { if (previous) this.deployments.set(`${subjectId}:${appId}`, previous); else this.deployments.delete(`${subjectId}:${appId}`); }
  async saveDeployment({ subjectId, appId, release, requestId, previousDigest, expectedVersion, state, dataRetained = true }) {
    const current = await this.getDeployment(subjectId, appId);
    if ((current?.versionNumber ?? null) !== expectedVersion) throw Object.assign(new Error('version_conflict'), { statusCode: 409 });
    const record = { subjectId, appId, packageId: release.packageId, version: release.version, build: release.build, releaseChannel: release.releaseChannel, digest: release.digest, previousDigest, state, dataRetained, requestId, versionNumber: (current?.versionNumber ?? 0) + 1, actionsSynced: false };
    this.deployments.set(`${subjectId}:${appId}`, record); return record;
  }
  async recordOperation(operation) { this.operations.push({ ...operation, occurredAt: new Date().toISOString() }); }
}
