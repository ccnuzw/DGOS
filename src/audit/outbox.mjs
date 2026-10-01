import { randomUUID } from 'node:crypto';

export class PostgresAuditRepository {
  constructor(pool) { this.pool = pool; }
  async record(event, client = this.pool) {
    const eventId = event.eventId ?? randomUUID();
    await client.query('INSERT INTO audit_events (event_id, request_id, actor_type, actor_id, action, target_type, target_id, result, summary, policy_version) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [eventId, event.requestId, event.actorId ? 'admin' : event.actorType ?? 'system', event.actorId ?? null, event.action, event.targetType, event.targetId ?? null, event.result ?? 'succeeded', JSON.stringify(event.summary ?? {}), event.policyVersion ?? null]);
    await client.query('INSERT INTO audit_outbox (event_id) VALUES ($1) ON CONFLICT (event_id) DO NOTHING', [eventId]);
    return eventId;
  }
  async claim(workerId, leaseMs = 15_000) { const client = await this.pool.connect(); try { await client.query('BEGIN'); const { rows } = await client.query("SELECT event_id FROM audit_outbox WHERE published_at IS NULL AND next_attempt_at <= now() AND (lease_until IS NULL OR lease_until < now()) ORDER BY next_attempt_at, event_id FOR UPDATE SKIP LOCKED LIMIT 1"); if (!rows[0]) { await client.query('COMMIT'); return undefined; } const result = await client.query("UPDATE audit_outbox SET lease_owner = $1, lease_until = now() + ($2::int * interval '1 millisecond'), attempts = attempts + 1 WHERE event_id = $3 RETURNING *", [workerId, leaseMs, rows[0].event_id]); await client.query('COMMIT'); return result.rows[0]; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }
  async markPublished(eventId, workerId) { const { rows } = await this.pool.query('UPDATE audit_outbox SET published_at = now(), lease_owner = NULL, lease_until = NULL WHERE event_id = $1 AND lease_owner = $2 AND published_at IS NULL RETURNING *', [eventId, workerId]); return rows[0]; }
  async markFailed(eventId, workerId, retryMs = 1_000) { const { rows } = await this.pool.query("UPDATE audit_outbox SET next_attempt_at = now() + ($3::int * interval '1 millisecond'), lease_owner = NULL, lease_until = NULL WHERE event_id = $1 AND lease_owner = $2 AND published_at IS NULL RETURNING *", [eventId, workerId, retryMs]); return rows[0]; }
  async query({ from, to, actorId, action, cursor, limit = 50, restrictActorId }) {
    const values = []; const where = [];
    const add = (clause, value) => { values.push(value); where.push(clause.replace('?', `$${values.length}`)); };
    if (from) add('created_at >= ?', from);
    if (to) add('created_at <= ?', to);
    if (actorId) add('actor_id = ?', actorId);
    if (restrictActorId) add('actor_id = ?', restrictActorId);
    if (action) add('action = ?', action);
    if (cursor) { const [createdAt, eventId] = Buffer.from(cursor, 'base64url').toString('utf8').split('|'); if (!createdAt || !eventId) throw Object.assign(new Error('invalid_request'), { statusCode: 422 }); add('(created_at, event_id) < (?, ?)', createdAt); values.push(eventId); where[where.length - 1] = `(created_at, event_id) < ($${values.length - 1}, $${values.length})`; }
    values.push(Math.min(100, Math.max(1, Number(limit) || 50)) + 1);
    const sql = `SELECT event_id, request_id, actor_type, actor_id, action, target_type, target_id, result, summary, policy_version, created_at FROM audit_events ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC, event_id DESC LIMIT $${values.length}`;
    const { rows } = await this.pool.query(sql, values);
    const more = rows.length > Number(values.at(-1)) - 1; const page = rows.slice(0, Number(values.at(-1)) - 1).map((row) => ({ eventId: row.event_id, occurredAt: row.created_at.toISOString(), requestId: row.request_id, actor: { type: row.actor_type, id: row.actor_id }, action: row.action, target: { type: row.target_type, id: row.target_id }, result: row.result, summary: row.summary, policyVersion: row.policy_version === null ? undefined : String(row.policy_version) }));
    const last = rows[Math.min(rows.length, Number(values.at(-1)) - 1) - 1];
    return { items: page, nextCursor: more && last ? Buffer.from(`${last.created_at.toISOString()}|${last.event_id}`).toString('base64url') : null };
  }
}

export class InMemoryAuditRepository {
  events = new Map(); outbox = new Map();
  async record(event) { const eventId = event.eventId ?? randomUUID(); this.events.set(eventId, { ...event, eventId }); this.outbox.set(eventId, { eventId, attempts: 0, publishedAt: null, nextAttemptAt: Date.now(), leaseOwner: null, leaseUntil: null }); return eventId; }
  async claim(workerId, leaseMs = 15_000) { const now = Date.now(); const item = [...this.outbox.values()].find((entry) => !entry.publishedAt && entry.nextAttemptAt <= now && (!entry.leaseUntil || entry.leaseUntil < now)); if (!item) return undefined; item.leaseOwner = workerId; item.leaseUntil = now + leaseMs; item.attempts += 1; return item; }
  async markPublished(eventId, workerId) { const item = this.outbox.get(eventId); if (!item || item.leaseOwner !== workerId || item.publishedAt) return undefined; item.publishedAt = Date.now(); item.leaseOwner = null; item.leaseUntil = null; return item; }
  async markFailed(eventId, workerId, retryMs = 1_000) { const item = this.outbox.get(eventId); if (!item || item.leaseOwner !== workerId || item.publishedAt) return undefined; item.nextAttemptAt = Date.now() + retryMs; item.leaseOwner = null; item.leaseUntil = null; return item; }
  async query({ actorId, restrictActorId, action, limit = 50 }) { const items = [...this.events.values()].filter((event) => (!restrictActorId || event.actorId === restrictActorId) && (!actorId || event.actorId === actorId) && (!action || event.action === action)).slice(0, Math.min(100, Number(limit) || 50)); return { items: items.map((event) => ({ eventId: event.eventId, requestId: event.requestId, actor: { type: event.actorId ? 'admin' : 'system', id: event.actorId ?? null }, action: event.action, target: { type: event.targetType, id: event.targetId ?? null }, result: event.result ?? 'succeeded', summary: event.summary ?? {}, occurredAt: event.createdAt ?? new Date().toISOString() })), nextCursor: null }; }
}

export class OutboxPublisher {
  constructor({ auditRepository, publish, workerId = randomUUID(), leaseMs = 15_000 }) { Object.assign(this, { auditRepository, publish, workerId, leaseMs }); }
  async publishOnce() { const item = await this.auditRepository.claim(this.workerId, this.leaseMs); if (!item) return undefined; try { await this.publish(item.eventId); return this.auditRepository.markPublished(item.eventId, this.workerId); } catch { return this.auditRepository.markFailed(item.eventId, this.workerId); } }
}
