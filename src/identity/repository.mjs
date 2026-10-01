import { randomUUID } from 'node:crypto';
import { PostgresAuditRepository } from '../audit/outbox.mjs';

function iso(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function rowPrincipal(row) {
  return row && { principalId: row.principal_id, status: row.status, credentialRef: row.credential_ref, roles: row.roles, version: Number(row.version), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}

function rowSession(row) {
  return row && { sessionId: row.session_id, principalId: row.principal_id, state: row.state, sessionVersion: Number(row.session_version), expiresAt: iso(row.expires_at), revokedAt: row.revoked_at && iso(row.revoked_at), createdAt: iso(row.created_at), lastSeenAt: iso(row.last_seen_at) };
}

function rowKey(row) {
  return row && { keyId: row.key_id, ownerId: row.owner_id, name: row.scope?.name ?? 'API key', prefix: row.prefix, scopes: row.scope?.scopes ?? [], status: row.state, createdAt: iso(row.created_at), expiresAt: row.expires_at && iso(row.expires_at), rotationGroupId: row.rotation_group, version: Number(row.version) };
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

  async countPrincipals() { return Number((await this.pool.query('SELECT count(*)::int AS count FROM admin_principals')).rows[0].count); }

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

  async createSession({ principalId, expiresAt, sessionId = randomUUID() }, client = this.pool) {
    const { rows } = await client.query('INSERT INTO admin_sessions (session_id, principal_id, state, expires_at) VALUES ($1, $2, $3, $4) RETURNING *', [sessionId, principalId, 'active', expiresAt]);
    return rowSession(rows[0]);
  }

  async getSession(sessionId) {
    const { rows } = await this.pool.query('SELECT * FROM admin_sessions WHERE session_id = $1', [sessionId]);
    return rowSession(rows[0]);
  }

  async renewSession(sessionId, expectedVersion, expiresAt) {
    const { rows } = await this.pool.query("UPDATE admin_sessions SET expires_at = $3, last_seen_at = now(), session_version = session_version + 1 WHERE session_id = $1 AND session_version = $2 AND state = 'active' AND expires_at > now() RETURNING *", [sessionId, expectedVersion, expiresAt]);
    return rowSession(rows[0]);
  }
  async renewSessionWithAudit(sessionId, expectedVersion, expiresAt, audit) { return this.withTransaction(async (client) => { const session = await this.renewSession(sessionId, expectedVersion, expiresAt, client); if (!session) return undefined; await this.audit.record(audit(session), client); return session; }); }

  async revokeSession(sessionId, client = this.pool) {
    const { rows } = await client.query("UPDATE admin_sessions SET state = 'revoked', revoked_at = now(), session_version = session_version + 1 WHERE session_id = $1 AND state = 'active' RETURNING *", [sessionId]);
    return rowSession(rows[0]);
  }

  async listKeys(ownerId) {
    const { rows } = await this.pool.query('SELECT * FROM api_key_records WHERE owner_id = $1 ORDER BY created_at DESC', [ownerId]);
    return rows.map(rowKey);
  }

  async createKey({ ownerId, prefix, digest, scopes, name, expiresAt, rotationGroupId = randomUUID(), keyId = randomUUID() }, client = this.pool) {
    const scope = JSON.stringify({ name, scopes });
    const { rows } = await client.query('INSERT INTO api_key_records (key_id, owner_id, prefix, digest, scope, rotation_group, state, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *', [keyId, ownerId, prefix, digest, scope, rotationGroupId, 'active', expiresAt ?? null]);
    return rowKey(rows[0]);
  }
  async createKeyWithAudit(input, audit) { return this.withTransaction(async (client) => { const key = await this.createKey(input, client); await this.writeAudit(audit(key), client); return key; }); }
  async rotateKeyWithAudit(previousId, input, audit) {
    return this.withTransaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM api_key_records WHERE key_id = $1 FOR UPDATE', [previousId]);
      const previous = rowKey(rows[0]);
      if (!previous || previous.status !== 'active') return undefined;
      const next = await this.createKey(input, client);
      const revoked = await client.query("UPDATE api_key_records SET state = 'revoked', revoked_at = now(), version = version + 1 WHERE key_id = $1 AND state = 'active' RETURNING key_id", [previousId]);
      if (!revoked.rows[0]) return undefined;
      await this.writeAudit(audit(next, previous), client);
      return next;
    });
  }
  async revokeKeyWithAudit(keyId, audit) { return this.withTransaction(async (client) => { const { rows } = await client.query("UPDATE api_key_records SET state = 'revoked', revoked_at = now(), version = version + 1 WHERE key_id = $1 AND state = 'active' RETURNING *", [keyId]); const key = rowKey(rows[0]); if (key) await this.writeAudit(audit(key), client); return key; }); }

  async getKey(keyId) { const { rows } = await this.pool.query('SELECT * FROM api_key_records WHERE key_id = $1', [keyId]); return rowKey(rows[0]); }

  async listAllActiveKeys() { const { rows } = await this.pool.query("SELECT * FROM api_key_records WHERE state = 'active' AND (expires_at IS NULL OR expires_at > now())"); return rows.map((row) => ({ ...rowKey(row), state: row.state, digest: row.digest })); }

  async revokeKey(keyId) { const { rows } = await this.pool.query("UPDATE api_key_records SET state = 'revoked', revoked_at = now(), version = version + 1 WHERE key_id = $1 AND state = 'active' RETURNING *", [keyId]); return rowKey(rows[0]); }

  async writeAudit({ requestId, actorId, action, targetType, targetId, result = 'succeeded', summary = {} }, client = this.pool) {
    return this.audit.record({ requestId, actorId, action, targetType, targetId, result, summary }, client);
  }
}

export class InMemoryIdentityRepository {
  principals = new Map(); sessions = new Map(); keys = new Map(); audits = [];
  async countPrincipals() { return this.principals.size; }
  async findPrincipalByHint(hint) { return [...this.principals.values()].find((p) => p.credentialRef === hint); }
  async createPrincipal({ principalId = randomUUID(), credentialRef, roles = ['admin'] }) { const p = { principalId, status: 'active', credentialRef, roles, version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; this.principals.set(principalId, p); return p; }
  async createSession({ principalId, expiresAt, sessionId = randomUUID() }) { const s = { sessionId, principalId, state: 'active', sessionVersion: 1, expiresAt: new Date(expiresAt).toISOString(), createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() }; this.sessions.set(sessionId, s); return s; }
  async getSession(id) { return this.sessions.get(id); }
  async renewSession(id, version, expiresAt) { const s = this.sessions.get(id); if (!s || s.state !== 'active' || s.sessionVersion !== Number(version) || new Date(s.expiresAt) <= new Date()) return undefined; s.expiresAt = new Date(expiresAt).toISOString(); s.sessionVersion += 1; s.lastSeenAt = new Date().toISOString(); return s; }
  async revokeSession(id) { const s = this.sessions.get(id); if (!s || s.state !== 'active') return undefined; s.state = 'revoked'; s.sessionVersion += 1; s.revokedAt = new Date().toISOString(); return s; }
  async listKeys(ownerId) { return [...this.keys.values()].filter((k) => k.ownerId === ownerId); }
  async createKey(input) { const k = { keyId: input.keyId ?? randomUUID(), ownerId: input.ownerId, prefix: input.prefix, digest: input.digest, name: input.name, scopes: input.scopes, status: 'active', state: 'active', createdAt: new Date().toISOString(), expiresAt: input.expiresAt ?? null, rotationGroupId: input.rotationGroupId ?? randomUUID(), version: 1 }; this.keys.set(k.keyId, k); return k; }
  async getKey(id) { return this.keys.get(id); }
  async listAllActiveKeys() { return [...this.keys.values()].filter((key) => key.state === 'active' && (!key.expiresAt || new Date(key.expiresAt) > new Date())); }
  async revokeKey(id) { const k = this.keys.get(id); if (!k || k.state !== 'active') return undefined; k.state = k.status = 'revoked'; k.version += 1; return k; }
  async rotateKey(previousId, input) { const previous = this.keys.get(previousId); if (!previous || previous.state !== 'active') return undefined; const next = await this.createKey(input); previous.state = previous.status = 'revoked'; previous.version += 1; return next; }
  async withBootstrapLock(work) { return work(undefined); }
  async writeAudit(event) { this.audits.push(event); return this.audit?.record ? this.audit.record(event) : randomUUID(); }
}
