import { isReservedBuiltinAppId, trustedBuiltinCapabilities } from './builtin-declarations.mjs';

const copy = (value) => value === undefined ? undefined : structuredClone(value);
const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const auditEvent = (input) => ({ requestId: input.requestId, actorId: input.subjectId, action: 'permission.change', targetType: 'permission', targetId: `${input.appId}:${input.capability}`, summary: { decision: input.decision, scope: input.scope ?? '*' } });

export class InMemoryPermissionRepository {
  constructor({ declarations = new Map(), appRepository } = {}) { this.decisions = new Map(); this.requests = new Map(); this.receipts = new Map(); this.declarations = declarations; this.appRepository = appRepository; this.version = 1; this.committing = new Set(); }
  key({ subjectId, appId, capability, scope = '*' }) { return [subjectId, appId, capability, scope].join(':'); }
  declare(subjectId, appId, capabilities) { this.declarations.set(`${subjectId}:${appId}`, [...capabilities]); }
  declaredCapabilities({ subjectId, appId }) {
    if (!this.appRepository) return this.declarations.get(`${subjectId}:${appId}`) ?? [];
    return (async () => {
      const install = await this.appRepository.getInstall(subjectId, appId);
      if (!install || !['installed', 'active'].includes(install.state)) return [];
      const release = await this.appRepository.getApp(appId, install.version, install.build);
      if (!release || !['official', 'approved'].includes(release.catalogState)) return [];
      const allowlist = new Set(release.manifest.capabilityAllowlist ?? []);
      return (release.manifest.permissions ?? []).filter((capability) => allowlist.has(capability));
    })();
  }
  get(query) { return copy(this.decisions.get(this.key(query))); }
  listForSubject(subjectId) { return [...this.decisions.values()].filter((item) => item.subjectId === subjectId).map(copy).sort((a, b) => this.key(a).localeCompare(this.key(b))); }
  async decide(input, { audit, trustedBuiltins = false } = {}) {
    const key = this.key(input); const fingerprint = JSON.stringify([key, input.decision]);
    if (input.requestId && this.receipts.has(input.requestId)) { const receipt = this.receipts.get(input.requestId); if (receipt.fingerprint !== fingerprint) throw fail('version_conflict', 409); return copy(receipt.result); }
    if (this.committing.has(key)) throw fail('version_conflict', 409);
    this.committing.add(key);
    try {
      if (input.decision === 'allow' && isReservedBuiltinAppId(input.appId) && (!trustedBuiltins || !trustedBuiltinCapabilities(input.appId).includes(input.capability))) throw fail('permission_denied', 403);
      const record = { subjectId: input.subjectId, appId: input.appId, capability: input.capability, scope: input.scope ?? '*', decision: input.decision, policyVersion: String(this.version + 1), updatedAt: new Date().toISOString() };
      await audit?.record(auditEvent({ ...record, requestId: input.requestId }));
      this.version += 1; this.decisions.set(key, record);
      if (input.requestId) this.receipts.set(input.requestId, { fingerprint, result: copy(record) });
      return copy(record);
    } finally { this.committing.delete(key); }
  }
  set(query, decision) { this.version += 1; const record = { ...query, scope: query.scope ?? '*', decision, policyVersion: String(this.version), updatedAt: new Date().toISOString() }; this.decisions.set(this.key(record), record); return record; }
  createRequest(input) { const prior = this.requests.get(input.requestId); if (prior) { if (this.key(prior) !== this.key(input)) throw fail('version_conflict', 409); return copy(prior); } const record={...input,scope:input.scope??'*',requestId:input.requestId,state:'pending'}; this.requests.set(input.requestId,record); return copy(record); }
  getRequest(id) { return copy(this.requests.get(id)); }
  transitionRequest(id,state,expected=['pending']) { const record=this.requests.get(id); if(!record||!expected.includes(record.state)||Date.parse(record.expiresAt)<=Date.now()) return undefined; record.state=state; return record; }
  async resolveRequest(requestId, state, { audit, trustedBuiltins = false } = {}) {
    const request = this.requests.get(requestId);
    if (!request) throw fail('invalid_request', 404);
    if (request.state !== 'pending' || Date.parse(request.expiresAt) <= Date.now()) throw fail('version_conflict', 409);
    const key = this.key(request); if (this.committing.has(key)) throw fail('version_conflict', 409);
    this.committing.add(key);
    try {
      const decision = state === 'approved' ? 'allow' : 'deny';
      const declared = isReservedBuiltinAppId(request.appId) ? trustedBuiltins ? trustedBuiltinCapabilities(request.appId) : [] : await this.declaredCapabilities(request);
      if (decision === 'allow' && (this.get(request)?.decision === 'deny' || !declared.includes(request.capability))) throw fail('permission_denied', 403);
      const record = { subjectId: request.subjectId, appId: request.appId, capability: request.capability, scope: request.scope, decision, policyVersion: String(this.version + 1), updatedAt: new Date().toISOString() };
      await audit?.record(auditEvent({ ...record, requestId }));
      this.version += 1; this.decisions.set(key, record); request.state = state;
      return copy(record);
    } finally { this.committing.delete(key); }
  }
}
