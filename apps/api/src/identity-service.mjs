import { randomUUID } from 'node:crypto';
import { generateApiKey, verifyApiKey } from '../../../src/security/secret-service.mjs';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const safeDate = (value) => new Date(value ?? Date.now() + SESSION_TTL_MS).toISOString();

export class IdentityService {
  constructor({ repository, secretService, clock = () => Date.now() }) { this.repository = repository; this.secretService = secretService; this.clock = clock; }
  async bootstrap({ displayName, credential, requestId }) {
    if (!displayName || !credential) throw Object.assign(new Error('invalid_request'), { statusCode: 422 });
    const principalId = randomUUID();
    const credentialRef = `admin-credential:${principalId}`;
    await this.secretService.put({ secretRef: credentialRef, value: credential, purpose: 'admin-login', subjectId: principalId, ttlMs: 365 * 24 * 60 * 60 * 1000 });
    const create = async (client) => { if (await this.repository.countPrincipals() > 0) throw Object.assign(new Error('bootstrap_already_completed'), { statusCode: 409 }); const p = await this.repository.createPrincipal({ principalId, credentialRef, roles: ['admin'] }, client); return this.#issueSession(p, requestId, client); };
    return this.repository.withBootstrapLock ? this.repository.withBootstrapLock(create) : create(undefined);
  }
  async login({ principalHint, credential, requestId }) {
    const p = await this.repository.findPrincipalByHint(principalHint);
    if (!p || p.status !== 'active') throw Object.assign(new Error('invalid_credentials'), { statusCode: 401 });
    try { const handle = await this.secretService.resolve({ secretRef: p.credentialRef, purpose: 'admin-login', subjectId: p.principalId }); if (await handle.read() !== credential) throw new Error(); }
    catch { throw Object.assign(new Error('invalid_credentials'), { statusCode: 401 }); }
    return this.#issueSession(p, requestId);
  }
  async authenticateApiKey(secret) {
    if (!secret) throw Object.assign(new Error('authentication_required'), { statusCode: 401 });
    const records = [];
    if (this.repository.listAllActiveKeys) records.push(...await this.repository.listAllActiveKeys());
    const record = authenticateApiKey(secret, records);
    if (!record) throw Object.assign(new Error('invalid_credentials'), { statusCode: 401 });
    return { subjectId: record.ownerId, scopes: record.scopes, keyId: record.keyId, authMethod: 'api_key' };
  }
  async #issueSession(principal, requestId, client) { const session = await this.repository.createSession({ principalId: principal.principalId, expiresAt: new Date(this.clock() + SESSION_TTL_MS) }, client); await this.repository.writeAudit({ requestId, actorId: principal.principalId, action: 'admin.session.create', targetType: 'admin_session', targetId: session.sessionId }, client); return { requestId, principalId: principal.principalId, sessionId: session.sessionId, state: session.state, expiresAt: session.expiresAt, sessionVersion: String(session.sessionVersion), authFreshUntil: session.expiresAt }; }
  async getSession(sessionId) { const s = await this.repository.getSession(sessionId); if (!s || s.state !== 'active' || new Date(s.expiresAt) <= new Date(this.clock())) throw Object.assign(new Error('session_invalid'), { statusCode: 401 }); return { requestId: null, principalId: s.principalId, sessionId: s.sessionId, state: s.state, expiresAt: s.expiresAt, sessionVersion: String(s.sessionVersion), createdAt: s.createdAt, lastActiveAt: s.lastSeenAt }; }
  async renewSession({ sessionId, version, requestId }) { const s = this.repository.renewSessionWithAudit ? await this.repository.renewSessionWithAudit(sessionId, version, new Date(this.clock() + SESSION_TTL_MS), (session) => ({ requestId, actorId: session.principalId, action: 'admin.session.renew', targetType: 'admin_session', targetId: sessionId })) : await this.repository.renewSession(sessionId, version, new Date(this.clock() + SESSION_TTL_MS)); if (!s) throw Object.assign(new Error('session_conflict'), { statusCode: 409 }); if (!this.repository.renewSessionWithAudit) await this.repository.writeAudit({ requestId, actorId: s.principalId, action: 'admin.session.renew', targetType: 'admin_session', targetId: sessionId }); return { requestId, principalId: s.principalId, sessionId, state: s.state, expiresAt: s.expiresAt, sessionVersion: String(s.sessionVersion), authFreshUntil: s.expiresAt }; }
  async revokeSession({ sessionId, requestId, actorId }) { const s = await this.repository.revokeSession(sessionId); if (!s) throw Object.assign(new Error('session_not_found'), { statusCode: 404 }); await this.repository.writeAudit({ requestId, actorId, action: 'admin.session.revoke', targetType: 'admin_session', targetId: sessionId }); return { requestId, principalId: s.principalId, sessionId, state: s.state, expiresAt: s.expiresAt, sessionVersion: String(s.sessionVersion) }; }
  async listKeys(ownerId) { return { items: await this.repository.listKeys(ownerId) }; }
  async createKey({ ownerId, name, scopes, expiresAt, requestId, actorId }) { if (!ownerId || !name || !Array.isArray(scopes) || scopes.length === 0) throw Object.assign(new Error('invalid_request'), { statusCode: 422 }); const key = generateApiKey(); const record = await this.repository.createKey({ ownerId, name, scopes, expiresAt: expiresAt ? safeDate(expiresAt) : null, ...key }); await this.repository.writeAudit({ requestId, actorId, action: 'api_key.create', targetType: 'api_key', targetId: record.keyId, summary: { prefix: record.prefix, scopes } }); return { requestId, key: this.#publicKey(record), secret: key.secret }; }
  async rotateKey({ keyId, requestId, actorId }) { const old = await this.repository.getKey(keyId); if (!old || old.state !== 'active') throw Object.assign(new Error('api_key_not_found'), { statusCode: 404 }); const key = generateApiKey(); const record = await this.repository.rotateKey(keyId, { ownerId: old.ownerId, name: old.name, scopes: old.scopes, rotationGroupId: old.rotationGroupId, ...key }); if (!record) throw Object.assign(new Error('api_key_not_found'), { statusCode: 404 }); await this.repository.writeAudit({ requestId, actorId, action: 'api_key.rotate', targetType: 'api_key', targetId: record.keyId, summary: { previousKeyId: keyId, prefix: record.prefix } }); return { requestId, key: this.#publicKey(record), secret: key.secret, previousKeyId: keyId }; }
  async revokeKey({ keyId, requestId, actorId }) { const record = await this.repository.revokeKey(keyId); if (!record) throw Object.assign(new Error('api_key_not_found'), { statusCode: 404 }); await this.repository.writeAudit({ requestId, actorId, action: 'api_key.revoke', targetType: 'api_key', targetId: keyId }); return this.#publicKey(record); }
  #publicKey(key) { return { keyId: key.keyId, ownerId: key.ownerId, name: key.name, prefix: key.prefix, scopes: key.scopes, status: key.status ?? key.state, createdAt: key.createdAt, expiresAt: key.expiresAt, rotationGroupId: key.rotationGroupId, version: String(key.version) }; }
}

export function authenticateApiKey(secret, records) { return records.find((record) => record.state === 'active' && verifyApiKey(secret, record.digest)); }
