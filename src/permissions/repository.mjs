export class InMemoryPermissionRepository {
  constructor() { this.decisions = new Map(); this.requests = new Map(); this.version = 1; }
  key({ subjectId, appId, capability, scope = '*' }) { return [subjectId, appId, capability, scope].join(':'); }
  get(query) { return this.decisions.get(this.key(query)); }
  set(query, decision) { this.version += 1; const record = { ...query, scope: query.scope ?? '*', decision, policyVersion: String(this.version), updatedAt: new Date().toISOString() }; this.decisions.set(this.key(record), record); return record; }
  createRequest(input) { const record={...input,requestId:input.requestId,state:'pending'}; this.requests.set(input.requestId,record); return record; }
  getRequest(id) { return this.requests.get(id); }
  transitionRequest(id,state,expected=['pending']) { const record=this.requests.get(id); if(!record||!expected.includes(record.state)||Date.parse(record.expiresAt)<=Date.now()) return undefined; record.state=state; return record; }
}
