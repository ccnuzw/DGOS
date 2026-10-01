import { randomUUID } from 'node:crypto';

export class InMemoryAppRepository {
  constructor({ audit } = {}) { this.apps = new Map(); this.installs = new Map(); this.audit = audit; }
  async recordApp(record) { const key = `${record.appId}:${record.version}:${record.build}`; if (this.apps.has(key)) return this.apps.get(key); this.apps.set(key, { ...record, appVersionId: randomUUID() }); return this.apps.get(key); }
  async listApps({ publicOnly = false } = {}) { return [...this.apps.values()].filter((x) => !publicOnly || ['official', 'approved'].includes(x.catalogState)); }
  async getApp(appId, version, build) { return [...this.apps.values()].find((x) => x.appId === appId && (!version || x.version === version) && (!build || x.build === build)); }
  async setCatalogState(appId, version, build, state, actorId) { const item = await this.getApp(appId, version, build); if (!item) return null; item.catalogState = state; item.updatedAt = new Date().toISOString(); if (this.audit) await this.audit.record({ actorId, action: `app.catalog.${state}`, targetType: 'app', targetId: appId, summary: { version, build, state } }); return item; }
  async getInstall(subjectId, appId) { return this.installs.get(`${subjectId}:${appId}`); }
  async saveInstall(record) { this.installs.set(`${record.subjectId}:${record.appId}`, record); return record; }
  async listInstalls(subjectId) { return [...this.installs.values()].filter((x) => x.subjectId === subjectId); }
}
