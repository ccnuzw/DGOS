export class PermissionBroker {
  constructor({ repository, audit } = {}) { this.repository = repository; this.audit = audit; }
  check({ subjectId, appId, capability, scope = '*', declared = [], requestId }) {
    const project = (decision) => {
      const result = { decision: decision?.decision ?? (declared.includes(capability) ? 'ask' : 'deny'), reasonCode: decision?.decision ?? (declared.includes(capability) ? 'no_decision' : 'not_declared'), policyVersion: decision?.policyVersion ?? String(this.repository.version ?? 0), subjectId, appId, capability, scope };
      const recorded = this.audit?.record({ requestId, actorId: subjectId, action: 'permission.check', targetType: 'permission', targetId: `${appId}:${capability}`, summary: { decision: result.decision, scope } });
      return recorded?.then ? recorded.then(() => result) : result;
    };
    const decision = this.repository.get({ subjectId, appId, capability, scope });
    return decision?.then ? decision.then(project) : project(decision);
  }
  async decide(input) { if (!['allow', 'ask', 'deny'].includes(input.decision)) throw Object.assign(new Error('invalid_request'), { statusCode: 422 }); const result = await this.repository.set(input, input.decision); await this.audit?.record({ requestId: input.requestId, actorId: input.subjectId, action: 'permission.change', targetType: 'permission', targetId: `${input.appId}:${input.capability}`, summary: { decision: input.decision, scope: input.scope } }); return result; }
  async request(input) { const result = await this.check(input); if (result.decision === 'ask') { const expiresAt = new Date(Date.now() + Math.min(900000, input.ttlMs ?? 300000)).toISOString(); await this.repository.createRequest?.({ ...input, policyVersion: result.policyVersion, expiresAt }); return { ...result, confirmationRequired: true, confirmationId: `${input.requestId}:permission`, expiresAt }; } return result; }
  async approveRequest({ requestId, ...input }) { const request = await this.repository.getRequest?.(requestId); if (!request) throw Object.assign(new Error('invalid_request'), { statusCode: 404 }); const transitioned = await this.repository.transitionRequest?.(requestId, 'approved'); if (!transitioned) throw Object.assign(new Error('version_conflict'), { statusCode: 409 }); return this.decide({ ...input, subjectId: request.subjectId ?? request.subject_id, appId: request.appId ?? request.app_id, capability: request.capability, scope: request.scope, decision: 'allow', requestId }); }
  async denyRequest({ requestId, ...input }) { const request = await this.repository.getRequest?.(requestId); if (!request) throw Object.assign(new Error('invalid_request'), { statusCode: 404 }); const transitioned = await this.repository.transitionRequest?.(requestId, 'denied'); if (!transitioned) throw Object.assign(new Error('version_conflict'), { statusCode: 409 }); return this.decide({ ...input, subjectId: request.subjectId ?? request.subject_id, appId: request.appId ?? request.app_id, capability: request.capability, scope: request.scope, decision: 'deny', requestId }); }
  revoke(input) { return this.decide({ ...input, decision: 'deny' }); }
}
