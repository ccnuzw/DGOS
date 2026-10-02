import { randomUUID } from 'node:crypto';
import { generateApiKey, verifyApiKey } from '../../../src/security/secret-service.mjs';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const AUTH_FRESH_MS = 10 * 60 * 1000;
const MAX_ROTATION_MS = 24 * 60 * 60 * 1000;
const safeDate = (value) => new Date(value ?? Date.now() + SESSION_TTL_MS).toISOString();

export function assertDelegatedKeyScopes(scopes, actorScopes) {
  if (!Array.isArray(scopes) || !scopes.length || scopes.some((scope) => typeof scope !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_.]*$/.test(scope) || scope === '*')) throw Object.assign(new Error('invalid_scope'), { statusCode: 422 });
  if (actorScopes && !actorScopes.includes('*') && scopes.some((scope) => !actorScopes.includes(scope))) throw Object.assign(new Error('permission_denied'), { statusCode: 403 });
}

export class IdentityService {
  constructor({ repository, secretService, clock = () => Date.now() }) { this.repository = repository; this.secretService = secretService; this.clock = clock; }
  async bootstrap({ displayName, credential, requestId }) {
    if (!displayName || !credential) throw Object.assign(new Error('invalid_request'), { statusCode: 422 });
    const principalId = randomUUID();
    const credentialRef = `admin-credential:${principalId}`;
    await this.secretService.put({ secretRef: credentialRef, value: credential, purpose: 'admin-login', subjectId: principalId, ttlMs: 365 * 24 * 60 * 60 * 1000 });
    const create = async (client) => { if (await this.repository.countPrincipals(client) > 0) throw Object.assign(new Error('bootstrap_already_completed'), { statusCode: 409 }); const p = await this.repository.createPrincipal({ principalId, credentialRef, roles: ['admin'] }, client); return this.#issueSession(p, requestId, client); };
    try { return this.repository.withBootstrapLock ? await this.repository.withBootstrapLock(create) : await create(undefined); }
    catch (error) { try { await this.secretService.revoke(credentialRef); } catch { /* Preserve the original bootstrap failure. */ } throw error; }
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
    const record = authenticateApiKey(secret, records, this.clock());
    if (!record) throw Object.assign(new Error('invalid_credentials'), { statusCode: 401 });
    const owner = await this.repository.getPrincipal?.(record.ownerId);
    if (owner && owner.status !== 'active') throw Object.assign(new Error('invalid_credentials'), { statusCode: 401 });
    return { subjectId: record.ownerId, scopes: record.scopes, keyId: record.keyId, authMethod: 'api_key' };
  }
  async #issueSession(principal, requestId, client) { const input = { principalId: principal.principalId, expiresAt: new Date(this.clock() + SESSION_TTL_MS), authFreshUntil: new Date(this.clock() + AUTH_FRESH_MS) }; const audit = (session) => ({ requestId, actorId: principal.principalId, action: 'admin.session.create', targetType: 'admin_session', targetId: session.sessionId }); const session = client ? await this.repository.createSession(input, client) : await this.repository.createSessionWithAudit(input, audit); if (client) await this.repository.writeAudit(audit(session), client); return { requestId, principalId: principal.principalId, sessionId: session.sessionId, state: session.state, expiresAt: session.expiresAt, sessionVersion: String(session.sessionVersion), authFreshUntil: session.authFreshUntil }; }
  async getSession(sessionId) { const s = await this.repository.getSession(sessionId); if (!s || s.state !== 'active' || new Date(s.expiresAt) <= new Date(this.clock())) throw Object.assign(new Error('session_invalid'), { statusCode: 401 }); const owner = await this.repository.getPrincipal?.(s.principalId); if (owner && owner.status !== 'active') throw Object.assign(new Error('session_invalid'), { statusCode: 401 }); return { requestId: null, principalId: s.principalId, sessionId: s.sessionId, state: s.state, expiresAt: s.expiresAt, authFreshUntil: s.authFreshUntil, sessionVersion: String(s.sessionVersion), createdAt: s.createdAt, lastActiveAt: s.lastSeenAt }; }
  async renewSession({ sessionId, version, requestId }) { const s = this.repository.renewSessionWithAudit ? await this.repository.renewSessionWithAudit(sessionId, version, new Date(this.clock() + SESSION_TTL_MS), (session) => ({ requestId, actorId: session.principalId, action: 'admin.session.renew', targetType: 'admin_session', targetId: sessionId })) : await this.repository.renewSession(sessionId, version, new Date(this.clock() + SESSION_TTL_MS)); if (!s) throw Object.assign(new Error('session_conflict'), { statusCode: 409 }); if (!this.repository.renewSessionWithAudit) await this.repository.writeAudit({ requestId, actorId: s.principalId, action: 'admin.session.renew', targetType: 'admin_session', targetId: sessionId }); return { requestId, principalId: s.principalId, sessionId, state: s.state, expiresAt: s.expiresAt, sessionVersion: String(s.sessionVersion), authFreshUntil: s.authFreshUntil }; }
  async revokeSession({ sessionId, requestId, actorId }) { const audit = () => ({ requestId, actorId, action: 'admin.session.revoke', targetType: 'admin_session', targetId: sessionId }); let s; if (this.repository.revokeSessionWithAudit) s = await this.repository.revokeSessionWithAudit(sessionId, audit, actorId); else { const target = await this.repository.getSession(sessionId); if (target && target.principalId !== actorId) throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 }); s = await this.repository.revokeSession(sessionId); if (s) await this.repository.writeAudit(audit()); } if (!s) throw Object.assign(new Error('session_not_found'), { statusCode: 404 }); return { requestId, principalId: s.principalId, sessionId, state: s.state, expiresAt: s.expiresAt, sessionVersion: String(s.sessionVersion) }; }
  async listSessions({ actorId, currentSessionId, requestId, limit = 50, cursor }) {
    const size = typeof limit === 'string' && /^[1-9]\d*$/.test(limit) ? Number(limit) : limit;
    if (!Number.isInteger(size) || size < 1 || size > 100) throw Object.assign(new Error('invalid_request'), { statusCode: 422 });
    let after;
    if (cursor !== undefined) {
      if (typeof cursor !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(cursor)) throw Object.assign(new Error('invalid_request'), { statusCode: 422 });
      const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
      const match = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z)\|(sm_[A-Za-z0-9_-]{32,128})$/.exec(decoded);
      if (!match || Buffer.from(decoded).toString('base64url') !== cursor) throw Object.assign(new Error('invalid_request'), { statusCode: 422 });
      after = { createdAt: match[1], managementId: match[2] };
    }
    const rows = await this.repository.listSessions(actorId, { limit: size, after });
    const page = rows.slice(0, size);
    await this.repository.writeAudit({ requestId, actorId, action: 'admin.session.list', targetType: 'admin_principal', targetId: actorId });
    const items = page.map((s) => ({ sessionManagementId: s.sessionManagementId, current: s.sessionId === currentSessionId, state: s.state === 'active' && Date.parse(s.expiresAt) <= this.clock() ? 'expired' : s.state, createdAt: s.createdAt, lastActiveAt: s.lastSeenAt, expiresAt: s.expiresAt, ...(s.revokedAt ? { revokedAt: s.revokedAt } : {}), sessionVersion: String(s.sessionVersion), deviceSummary: { host: 'unknown' } }));
    const last = page.at(-1);
    return { requestId, items, ...(rows.length > size && last ? { nextCursor: Buffer.from(`${last.cursorAt}|${last.sessionManagementId}`).toString('base64url') } : {}) };
  }
  async revokeManagedSession({ managementId, actorId, requestId }) {
    if (!/^sm_[A-Za-z0-9_-]{32,128}$/.test(managementId ?? '')) throw Object.assign(new Error('session_not_found'), { statusCode: 404 });
    return this.repository.revokeManagedSession({ managementId, actorId, requestId });
  }
  async listKeys(ownerId) { return { items: await this.repository.listKeys(ownerId) }; }
  async createKey({ ownerId, name, scopes, expiresAt, requestId, actorId, actorScopes }) { if (!ownerId || !name || ownerId !== actorId) throw Object.assign(new Error('permission_denied'), { statusCode: 403 }); const actor = await this.repository.getPrincipal(actorId); if (!actor || actor.status !== 'active') throw Object.assign(new Error('permission_denied'), { statusCode: 403 }); assertDelegatedKeyScopes(scopes, actorScopes ?? (actor.roles?.includes('admin') ? ['*'] : [])); const key = generateApiKey(); const input = { ownerId, name, scopes, createdBy: actorId, expiresAt: expiresAt ? safeDate(expiresAt) : null, ...key }; const audit = (record) => ({ requestId, actorId, action: 'api_key.create', targetType: 'api_key', targetId: record.keyId, summary: { prefix: record.prefix, scopes } }); const record = this.repository.createKeyWithAudit ? await this.repository.createKeyWithAudit(input, audit) : await this.repository.createKey(input); if (!this.repository.createKeyWithAudit) await this.repository.writeAudit(audit(record)); return { requestId, key: this.#publicKey(record), secret: key.secret }; }
  async rotateKey({ keyId, requestId, actorId, baseVersion, overlapUntil }) { const old = await this.repository.getKey(keyId); if (!old || old.state !== 'active') throw Object.assign(new Error('api_key_not_found'), { statusCode: 404 }); if (old.ownerId !== actorId) throw Object.assign(new Error('permission_denied'), { statusCode: 403 }); const until = overlapUntil === undefined ? new Date(this.clock() + 15 * 60_000) : new Date(overlapUntil); if (!Number.isFinite(until.getTime()) || until.getTime() <= this.clock() || until.getTime() > this.clock() + MAX_ROTATION_MS) throw Object.assign(new Error('invalid_request'), { statusCode: 422 }); const key = generateApiKey(); const input = { ownerId: old.ownerId, name: old.name, scopes: old.scopes, expiresAt: old.expiresAt, rotationGroupId: old.rotationGroupId, createdBy: actorId, baseVersion, overlapUntil: until.toISOString(), ...key }; const audit = (record) => ({ requestId, actorId, action: 'api_key.rotate', targetType: 'api_key', targetId: record.keyId, summary: { previousKeyId: keyId, prefix: record.prefix, overlapUntil: until.toISOString() } }); const record = this.repository.rotateKeyWithAudit ? await this.repository.rotateKeyWithAudit(keyId, input, audit) : await this.repository.rotateKey(keyId, input); if (!record) throw Object.assign(new Error('api_key_not_found'), { statusCode: 404 }); if (!this.repository.rotateKeyWithAudit) await this.repository.writeAudit(audit(record)); return { requestId, key: this.#publicKey(record), secret: key.secret, previousKeyId: keyId }; }
  async revokeKey({ keyId, requestId, actorId }) { const old = await this.repository.getKey(keyId); if (!old) throw Object.assign(new Error('api_key_not_found'), { statusCode: 404 }); if (old.ownerId !== actorId) throw Object.assign(new Error('permission_denied'), { statusCode: 403 }); const audit = (record) => ({ requestId, actorId, action: 'api_key.revoke', targetType: 'api_key', targetId: keyId }); const record = this.repository.revokeKeyWithAudit ? await this.repository.revokeKeyWithAudit(keyId, audit) : await this.repository.revokeKey(keyId); if (!record) throw Object.assign(new Error('api_key_not_found'), { statusCode: 404 }); if (!this.repository.revokeKeyWithAudit) await this.repository.writeAudit(audit(record)); return this.#publicKey(record); }
  #publicKey(key) { return { keyId: key.keyId, ownerId: key.ownerId, name: key.name, prefix: key.prefix, scopes: key.scopes, status: key.status ?? key.state, createdAt: key.createdAt, expiresAt: key.expiresAt, rotationGroupId: key.rotationGroupId, version: String(key.version) }; }
}

export function authenticateApiKey(secret, records, now = Date.now()) { return records.find((record) => ['active', 'rotation_pending'].includes(record.state) && (!record.expiresAt || new Date(record.expiresAt).getTime() > now) && (record.state !== 'rotation_pending' || new Date(record.rotationUntil).getTime() > now) && verifyApiKey(secret, record.digest)); }
