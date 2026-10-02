import { randomUUID } from 'node:crypto';
import { PostgresAuditRepository } from '../audit/outbox.mjs';

function iso(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function rowPrincipal(row) {
  return row && { principalId: row.principal_id, status: row.status, credentialRef: row.credential_ref, roles: row.roles, version: Number(row.version), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}

function rowSession(row) {
  return row && { sessionId: row.session_id, sessionManagementId: row.session_management_id, cursorAt: row.cursor_at ?? iso(row.created_at).replace(/\.(\d{3})Z$/, (_, ms) => `.${ms}000Z`), principalId: row.principal_id, state: row.state, sessionVersion: Number(row.session_version), expiresAt: iso(row.expires_at), authFreshUntil: row.auth_fresh_until && iso(row.auth_fresh_until), revokedAt: row.revoked_at && iso(row.revoked_at), createdAt: iso(row.created_at), lastSeenAt: iso(row.last_seen_at) };
}

function rowKey(row) {
  return row && { keyId: row.key_id, ownerId: row.owner_id, name: row.scope?.name ?? 'API key', prefix: row.prefix, scopes: row.scope?.scopes ?? [], state: row.state, status: row.state, createdAt: iso(row.created_at), expiresAt: row.expires_at && iso(row.expires_at), rotationGroupId: row.rotation_group, rotationUntil: row.rotation_until && iso(row.rotation_until), rotatedTo: row.rotated_to, createdBy: row.created_by, version: Number(row.version) };
}

export class PostgresIdentityRepository {
  constructor(pool) { this.pool = pool; this.audit = new PostgresAuditRepository(pool); }

  async withTransaction(work) {
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async findPrincipalByHint(hint) {
    const { rows } = await this.pool.query('SELECT * FROM admin_principals WHERE principal_id::text = $1 OR credential_ref = $1 LIMIT 1', [hint]);
    return rowPrincipal(rows[0]);
  }
  async getPrincipal(principalId) { const { rows } = await this.pool.query('SELECT * FROM admin_principals WHERE principal_id = $1', [principalId]); return rowPrincipal(rows[0]); }

  async countPrincipals(client = this.pool) { return Number((await client.query('SELECT count(*)::int AS count FROM admin_principals')).rows[0].count); }

  async withBootstrapLock(work) {
    return this.withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('dgos-admin-bootstrap'))");
      return work(client);
    });
  }

  async createPrincipal({ principalId = randomUUID(), credentialRef, roles = ['admin'] }, client = this.pool) {
    const { rows } = await client.query('INSERT INTO admin_principals (principal_id, status, credential_ref, roles) VALUES ($1, $2, $3, $4) RETURNING *', [principalId, 'active', credentialRef, JSON.stringify(roles)]);
    return rowPrincipal(rows[0]);
  }

  async createSession({ principalId, expiresAt, authFreshUntil, sessionId = randomUUID() }, client = this.pool) {
    const { rows } = await client.query('INSERT INTO admin_sessions (session_id, principal_id, state, expires_at, auth_fresh_until) VALUES ($1, $2, $3, $4, $5) RETURNING *', [sessionId, principalId, 'active', expiresAt, authFreshUntil ?? expiresAt]);
    return rowSession(rows[0]);
  }
  async createSessionWithAudit(input, audit) { return this.withTransaction(async (client) => { const session = await this.createSession(input, client); await this.writeAudit(audit(session), client); return session; }); }

  async getSession(sessionId) {
    const { rows } = await this.pool.query('SELECT * FROM admin_sessions WHERE session_id = $1', [sessionId]);
    return rowSession(rows[0]);
  }
  async listSessions(principalId, { limit, after } = {}) {
    if (after) {
      const owner = await this.pool.query('SELECT 1 FROM admin_sessions WHERE principal_id=$1 AND session_management_id=$2 AND created_at=$3', [principalId, after.managementId, after.createdAt]);
      if (!owner.rows[0]) throw Object.assign(new Error('invalid_request'), { statusCode: 422 });
    }
    const values = [principalId, limit + 1];
    const condition = after ? 'AND (created_at, session_management_id) < ($3::timestamptz, $4::text)' : '';
    if (after) values.push(after.createdAt, after.managementId);
    const { rows } = await this.pool.query(`SELECT *, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at FROM admin_sessions WHERE principal_id = $1 ${condition} ORDER BY created_at DESC, session_management_id DESC LIMIT $2`, values);
    return rows.map(rowSession);
  }
  async revokeManagedSession({ managementId, actorId, requestId }) { return this.withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`admin-session-revoke:${actorId}:${requestId}`]);
    const prior = await client.query('SELECT * FROM admin_session_revoke_receipts WHERE principal_id=$1 AND request_id=$2 FOR UPDATE', [actorId, requestId]);
    if (prior.rows[0]) {
      if (prior.rows[0].session_management_id !== managementId) throw Object.assign(new Error('idempotency_conflict'), { statusCode: 409 });
      return { requestId, sessionManagementId: managementId, state: 'revoked', revokedAt: iso(prior.rows[0].revoked_at), sessionVersion: String(prior.rows[0].session_version) };
    }
    const { rows } = await client.query('SELECT * FROM admin_sessions WHERE session_management_id=$1 AND principal_id=$2 FOR UPDATE', [managementId, actorId]);
    if (!rows[0]) throw Object.assign(new Error('session_not_found'), { statusCode: 404 });
    let session = rowSession(rows[0]);
    if (session.state !== 'revoked') {
      const changed = await client.query("UPDATE admin_sessions SET state='revoked', revoked_at=now(), session_version=session_version+1 WHERE session_id=$1 RETURNING *", [session.sessionId]);
      session = rowSession(changed.rows[0]);
      await this.writeAudit({ requestId, actorId, action: 'admin.session.revoke', targetType: 'admin_session', targetId: managementId }, client);
    }
    await client.query('INSERT INTO admin_session_revoke_receipts (principal_id,request_id,session_management_id,revoked_at,session_version) VALUES ($1,$2,$3,$4,$5)', [actorId, requestId, managementId, session.revokedAt, session.sessionVersion]);
    return { requestId, sessionManagementId: managementId, state: 'revoked', revokedAt: session.revokedAt, sessionVersion: String(session.sessionVersion) };
  }); }

  async renewSession(sessionId, expectedVersion, expiresAt, client = this.pool) {
    const { rows } = await client.query("UPDATE admin_sessions SET expires_at = $3, last_seen_at = now(), session_version = session_version + 1 WHERE session_id = $1 AND session_version = $2 AND state = 'active' AND expires_at > now() RETURNING *", [sessionId, expectedVersion, expiresAt]);
    return rowSession(rows[0]);
  }
  async renewSessionWithAudit(sessionId, expectedVersion, expiresAt, audit) { return this.withTransaction(async (client) => { const session = await this.renewSession(sessionId, expectedVersion, expiresAt, client); if (!session) return undefined; await this.audit.record(audit(session), client); return session; }); }

  async revokeSession(sessionId, client = this.pool) {
    const { rows } = await client.query("UPDATE admin_sessions SET state = 'revoked', revoked_at = now(), session_version = session_version + 1 WHERE session_id = $1 AND state = 'active' RETURNING *", [sessionId]);
    return rowSession(rows[0]);
  }
  async revokeSessionWithAudit(sessionId, audit, actorId) { return this.withTransaction(async (client) => {
    const { rows } = await client.query('SELECT principal_id FROM admin_sessions WHERE session_id=$1 FOR UPDATE', [sessionId]);
    if (!rows[0]) return undefined;
    if (rows[0].principal_id !== actorId) throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 });
    const session = await this.revokeSession(sessionId, client);
    if (session) await this.writeAudit(audit(session), client);
    return session;
  }); }

  async listKeys(ownerId) {
    const { rows } = await this.pool.query('SELECT * FROM api_key_records WHERE owner_id = $1 ORDER BY created_at DESC', [ownerId]);
    return rows.map(rowKey);
  }

  async createKey({ ownerId, prefix, digest, scopes, name, expiresAt, createdBy, rotationGroupId = randomUUID(), keyId = randomUUID() }, client = this.pool) {
    const scope = JSON.stringify({ name, scopes });
    const { rows } = await client.query('INSERT INTO api_key_records (key_id, owner_id, prefix, digest, scope, rotation_group, state, expires_at, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *', [keyId, ownerId, prefix, digest, scope, rotationGroupId, 'active', expiresAt ?? null, createdBy ?? null]);
    return rowKey(rows[0]);
  }
  async createKeyWithAudit(input, audit) { return this.withTransaction(async (client) => { const key = await this.createKey(input, client); await this.writeAudit(audit(key), client); return key; }); }
  async rotateKeyWithAudit(previousId, input, audit) {
    return this.withTransaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM api_key_records WHERE key_id = $1 FOR UPDATE', [previousId]);
      const previous = rowKey(rows[0]);
      if (!previous || previous.status !== 'active') return undefined;
      if (input.baseVersion && Number(input.baseVersion) !== previous.version) throw Object.assign(new Error('version_conflict'), { statusCode: 409 });
      const next = await this.createKey(input, client);
      const overlapUntil = input.overlapUntil ? new Date(input.overlapUntil) : null;
      const revoked = overlapUntil ? await client.query("UPDATE api_key_records SET state = 'rotation_pending', rotation_until = $2, rotated_to = $3, version = version + 1 WHERE key_id = $1 AND state = 'active' RETURNING key_id", [previousId, overlapUntil, next.keyId]) : await client.query("UPDATE api_key_records SET state = 'revoked', revoked_at = now(), version = version + 1 WHERE key_id = $1 AND state = 'active' RETURNING key_id", [previousId]);
      if (!revoked.rows[0]) return undefined;
      await this.writeAudit(audit(next, previous), client);
      return next;
    });
  }
  async revokeKeyWithAudit(keyId, audit) { return this.withTransaction(async (client) => { const { rows } = await client.query("UPDATE api_key_records SET state = 'revoked', revoked_at = now(), version = version + 1 WHERE key_id = $1 AND state IN ('active', 'rotation_pending') RETURNING *", [keyId]); const key = rowKey(rows[0]); if (key) await this.writeAudit(audit(key), client); return key; }); }

  async getKey(keyId) { const { rows } = await this.pool.query('SELECT * FROM api_key_records WHERE key_id = $1', [keyId]); return rowKey(rows[0]); }

  async listAllActiveKeys() { const { rows } = await this.pool.query("SELECT * FROM api_key_records WHERE (state = 'active' OR (state = 'rotation_pending' AND rotation_until > now())) AND (expires_at IS NULL OR expires_at > now())"); return rows.map((row) => ({ ...rowKey(row), state: row.state, digest: row.digest })); }
  async expireRotations() { const { rows } = await this.pool.query("UPDATE api_key_records SET state = 'revoked', revoked_at = now(), version = version + 1 WHERE state = 'rotation_pending' AND rotation_until <= now() RETURNING key_id"); return rows.length; }

  async revokeKey(keyId) { const { rows } = await this.pool.query("UPDATE api_key_records SET state = 'revoked', revoked_at = now(), version = version + 1 WHERE key_id = $1 AND state IN ('active', 'rotation_pending') RETURNING *", [keyId]); return rowKey(rows[0]); }

  async writeAudit({ requestId, actorId, action, targetType, targetId, result = 'succeeded', summary = {} }, client = this.pool) {
    return this.audit.record({ requestId, actorId, action, targetType, targetId, result, summary }, client);
  }
}

export class InMemoryIdentityRepository {
  principals = new Map(); sessions = new Map(); keys = new Map(); audits = []; revokeReceipts = new Map();
  async countPrincipals() { return this.principals.size; }
  async findPrincipalByHint(hint) { return [...this.principals.values()].find((p) => p.principalId === hint || p.credentialRef === hint); }
  async getPrincipal(principalId) { return this.principals.get(principalId); }
  async createPrincipal({ principalId = randomUUID(), credentialRef, roles = ['admin'] }) { const p = { principalId, status: 'active', credentialRef, roles, version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; this.principals.set(principalId, p); return p; }
  async createSession({ principalId, expiresAt, authFreshUntil, sessionId = randomUUID() }) { const s = { sessionId, sessionManagementId: `sm_${randomUUID().replaceAll('-', '')}`, principalId, state: 'active', sessionVersion: 1, expiresAt: new Date(expiresAt).toISOString(), authFreshUntil: new Date(authFreshUntil ?? expiresAt).toISOString(), createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() }; this.sessions.set(sessionId, s); return s; }
  async createSessionWithAudit(input, audit) { const session = { sessionId: randomUUID(), sessionManagementId: `sm_${randomUUID().replaceAll('-', '')}`, principalId: input.principalId, state: 'active', sessionVersion: 1, expiresAt: new Date(input.expiresAt).toISOString(), authFreshUntil: new Date(input.authFreshUntil ?? input.expiresAt).toISOString(), createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() }; this.sessions.set(session.sessionId, session); try { await this.writeAudit(audit(session)); } catch (error) { this.sessions.delete(session.sessionId); throw error; } return session; }
  async getSession(id) { return this.sessions.get(id); }
  async listSessions(principalId, { limit, after } = {}) { const cursorAt = (s) => s.createdAt.replace(/\.(\d{3})Z$/, (_, ms) => `.${ms}000Z`); if (after && ![...this.sessions.values()].some((s) => s.principalId === principalId && s.sessionManagementId === after.managementId && cursorAt(s) === after.createdAt)) throw Object.assign(new Error('invalid_request'), { statusCode: 422 }); return [...this.sessions.values()].filter((s) => s.principalId === principalId && (!after || cursorAt(s) < after.createdAt || cursorAt(s) === after.createdAt && s.sessionManagementId < after.managementId)).sort((a,b) => b.createdAt.localeCompare(a.createdAt) || b.sessionManagementId.localeCompare(a.sessionManagementId)).slice(0, limit + 1); }
  async revokeManagedSession({ managementId, actorId, requestId }) { const receiptKey = `${actorId}:${requestId}`; const prior = this.revokeReceipts.get(receiptKey); if (prior) { if (prior.sessionManagementId !== managementId) throw Object.assign(new Error('idempotency_conflict'), { statusCode: 409 }); return prior; } const session = [...this.sessions.values()].find((s) => s.sessionManagementId === managementId && s.principalId === actorId); if (!session) throw Object.assign(new Error('session_not_found'), { statusCode: 404 }); const previous = { ...session }; if (session.state !== 'revoked') this.revokeSession(session.sessionId); try { await this.writeAudit({ requestId, actorId, action: 'admin.session.revoke', targetType: 'admin_session', targetId: managementId }); } catch (error) { this.sessions.set(session.sessionId, previous); throw error; } const receipt = { requestId, sessionManagementId: managementId, state: 'revoked', revokedAt: session.revokedAt, sessionVersion: String(session.sessionVersion) }; this.revokeReceipts.set(receiptKey, receipt); return receipt; }
  async renewSession(id, version, expiresAt) { const s = this.sessions.get(id); if (!s || s.state !== 'active' || s.sessionVersion !== Number(version) || new Date(s.expiresAt) <= new Date()) return undefined; s.expiresAt = new Date(expiresAt).toISOString(); s.sessionVersion += 1; s.lastSeenAt = new Date().toISOString(); return s; }
  async revokeSession(id) { const s = this.sessions.get(id); if (!s || s.state !== 'active') return undefined; s.state = 'revoked'; s.sessionVersion += 1; s.revokedAt = new Date().toISOString(); return s; }
  async listKeys(ownerId) { return [...this.keys.values()].filter((k) => k.ownerId === ownerId); }
  async createKey(input) { const k = { keyId: input.keyId ?? randomUUID(), ownerId: input.ownerId, prefix: input.prefix, digest: input.digest, name: input.name, scopes: input.scopes, status: 'active', state: 'active', createdAt: new Date().toISOString(), expiresAt: input.expiresAt ?? null, rotationGroupId: input.rotationGroupId ?? randomUUID(), createdBy: input.createdBy ?? null, version: 1 }; this.keys.set(k.keyId, k); return k; }
  async getKey(id) { return this.keys.get(id); }
  async listAllActiveKeys() { return [...this.keys.values()].filter((key) => (key.state === 'active' || (key.state === 'rotation_pending' && new Date(key.rotationUntil) > new Date())) && (!key.expiresAt || new Date(key.expiresAt) > new Date())); }
  async revokeKey(id) { const k = this.keys.get(id); if (!k || !['active', 'rotation_pending'].includes(k.state)) return undefined; k.state = k.status = 'revoked'; k.version += 1; return k; }
  async rotateKey(previousId, input) { const previous = this.keys.get(previousId); if (!previous || previous.state !== 'active') return undefined; if (input.baseVersion && Number(input.baseVersion) !== previous.version) throw Object.assign(new Error('version_conflict'), { statusCode: 409 }); const next = await this.createKey(input); previous.state = previous.status = input.overlapUntil ? 'rotation_pending' : 'revoked'; previous.rotationUntil = input.overlapUntil ?? null; previous.rotatedTo = next.keyId; previous.version += 1; return next; }
  async expireRotations() { let count = 0; for (const key of this.keys.values()) if (key.state === 'rotation_pending' && new Date(key.rotationUntil) <= new Date()) { key.state = key.status = 'revoked'; count += 1; } return count; }
  async withBootstrapLock(work) { const principals = new Map(this.principals); const sessions = new Map(this.sessions); try { return await work(undefined); } catch (error) { this.principals = principals; this.sessions = sessions; throw error; } }
  async writeAudit(event) { const eventId = this.audit?.record ? await this.audit.record(event) : randomUUID(); this.audits.push(event); return eventId; }
}
