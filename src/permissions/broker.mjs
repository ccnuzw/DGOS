import { isReservedBuiltinAppId, trustedBuiltinCapabilities } from './builtin-declarations.mjs';

const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });

export class PermissionBroker {
  constructor({ repository, audit, trustedBuiltins = false } = {}) { this.repository = repository; this.audit = audit; this.trustedBuiltins = trustedBuiltins; }
  check({ subjectId, appId, capability, scope = '*', requestId }) {
    const project = ([decision, declared]) => {
      const permitted = declared.includes(capability);
      const effective = !permitted || decision?.decision === 'deny' ? 'deny' : decision?.decision ?? 'ask';
      const result = { decision: effective, reasonCode: !permitted ? 'not_declared' : decision?.decision ?? 'no_decision', policyVersion: decision?.policyVersion ?? String(this.repository.version ?? 0), subjectId, appId, capability, scope };
      const recorded = this.audit?.record({ requestId, actorId: subjectId, action: 'permission.check', targetType: 'permission', targetId: `${appId}:${capability}`, summary: { decision: result.decision, scope } });
      return recorded?.then ? recorded.then(() => result) : result;
    };
    const decision = this.repository.get({ subjectId, appId, capability, scope });
    const declared = isReservedBuiltinAppId(appId)
      ? this.trustedBuiltins ? trustedBuiltinCapabilities(appId) : []
      : this.repository.declaredCapabilities?.({ subjectId, appId }) ?? [];
    return decision?.then || declared?.then ? Promise.all([decision, declared]).then(project) : project([decision, declared]);
  }
  async decide(input) {
    if (!['allow', 'ask', 'deny'].includes(input.decision)) throw fail('invalid_request', 422);
    return this.repository.decide(input, { audit: this.audit, trustedBuiltins: this.trustedBuiltins });
  }
  async request(input) {
    const result = await this.check(input);
    if (result.decision !== 'ask') return result;
    const expiresAt = new Date(Date.now() + Math.min(900000, input.ttlMs ?? 300000)).toISOString();
    const saved = await this.repository.createRequest({ ...input, policyVersion: result.policyVersion, expiresAt });
    return { ...result, confirmationRequired: true, confirmationId: `${saved.requestId}:permission`, expiresAt: saved.expiresAt };
  }
  approveRequest({ requestId }) { return this.repository.resolveRequest(requestId, 'approved', { audit: this.audit, trustedBuiltins: this.trustedBuiltins }); }
  denyRequest({ requestId }) { return this.repository.resolveRequest(requestId, 'denied', { audit: this.audit, trustedBuiltins: this.trustedBuiltins }); }
  revoke(input) { return this.decide({ ...input, decision: 'deny' }); }
}

export function createTrustedBuiltinPermissionBroker({ repository, audit } = {}) {
  return new PermissionBroker({ repository, audit, trustedBuiltins: true });
}
