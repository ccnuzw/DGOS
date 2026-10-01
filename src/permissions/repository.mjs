export class InMemoryPermissionRepository {
  constructor() { this.decisions = new Map(); this.version = 1; }
  key({ subjectId, appId, capability, scope = '*' }) { return [subjectId, appId, capability, scope].join(':'); }
  get(query) { return this.decisions.get(this.key(query)); }
  set(query, decision) { this.version += 1; const record = { ...query, scope: query.scope ?? '*', decision, policyVersion: String(this.version), updatedAt: new Date().toISOString() }; this.decisions.set(this.key(record), record); return record; }
}
