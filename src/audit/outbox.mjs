import { randomUUID } from 'node:crypto';

const invalid = () => Object.assign(new Error('invalid_request'), { statusCode: 422 });
const safeId = (value) => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value) ? value : null;
const safeSummary = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const allowed = new Set([
    'appId', 'actionId', 'actionVersion', 'accountId', 'providerConfigId', 'connectionTestId',
    'taskId', 'attemptId', 'runId', 'reservationId', 'modelId', 'profileId', 'protocolId',
    'capability', 'decision', 'state', 'domain', 'settingsVersion', 'policyVersion',
    'protocolType', 'protocolVersion', 'descriptorVersion', 'catalogVersion', 'version', 'build',
    'scannedCount', 'deletedCount', 'skippedCount', 'failureCount', 'count',
    'auditRetentionDays', 'cacheRetentionDays', 'revokedSessionRetentionDays',
    'confirmed', 'restartRequired', 'confirmationRequired', 'quotaFinalized', 'dataRetained',
    'reasonCode', 'errorKey', 'errorClass', 'riskLevel',
  ]);
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => allowed.has(key) && (typeof item === 'boolean' || typeof item === 'number' && Number.isFinite(item) || typeof item === 'string' && (safeId(item) !== null || key === 'modelId' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]*\/[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(item) && item.length <= 128))));
};
const publicEvent = (event) => ({ eventId: event.eventId, occurredAt: event.occurredAt, requestId: event.requestId, actor: { type: event.actorType, id: event.actorId ?? null }, action: event.action, target: { type: event.targetType, id: safeId(event.targetId) }, result: event.result, summary: safeSummary(event.summary), ...(event.policyVersion == null ? {} : { policyVersion: String(event.policyVersion) }) });
export const validateAuditQuery = ({ from, to, actorId, action, cursor, limit = 50, restrictActorId }) => {
  const date = (value) => { if (value === undefined) return undefined; if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) throw invalid(); return value; };
  const start = date(from); const end = date(to);
  if (start && end && Date.parse(start) > Date.parse(end)) throw invalid();
  if (actorId !== undefined && (typeof actorId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorId))) throw invalid();
  if (action !== undefined && (typeof action !== 'string' || !/^[a-z][a-z0-9._-]{0,127}$/.test(action))) throw invalid();
  const size = typeof limit === 'string' && /^[1-9]\d*$/.test(limit) ? Number(limit) : limit;
  if (!Number.isInteger(size) || size < 1 || size > 100) throw invalid();
  let after;
  if (cursor !== undefined) {
    if (typeof cursor !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(cursor)) throw invalid();
    let decoded; try { decoded = Buffer.from(cursor, 'base64url').toString('utf8'); } catch { throw invalid(); }
    const match = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z)\|([0-9a-f-]{36})$/i.exec(decoded);
    if (!match || !Number.isFinite(Date.parse(match[1])) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match[2]) || Buffer.from(decoded).toString('base64url') !== cursor) throw invalid();
    after = { occurredAt: match[1], eventId: match[2] };
  }
  return { from: start, to: end, actorId, action, limit: size, restrictActorId, after };
};
const nextCursor = (occurredAt, eventId) => Buffer.from(`${occurredAt}|${eventId}`).toString('base64url');
const cursorTime = (occurredAt) => occurredAt.replace(/\.(\d{3})Z$/, (_, milliseconds) => `.${milliseconds}000Z`);

export class PostgresAuditRepository {
  constructor(pool) { this.pool = pool; }
  async record(event, client) {
    if (client && client !== this.pool) return this.insert(event, client);
    const connection = await this.pool.connect();
    try { await connection.query('BEGIN'); const eventId = await this.insert(event, connection); await connection.query('COMMIT'); return eventId; }
    catch (error) { await connection.query('ROLLBACK'); throw error; }
    finally { connection.release(); }
  }
  async insert(event, client) {
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
    const query = validateAuditQuery({ from, to, actorId, action, cursor, limit, restrictActorId });
    if (query.from) add('created_at >= ?', query.from);
    if (query.to) add('created_at <= ?', query.to);
    if (query.actorId) add('actor_id = ?', query.actorId);
    if (query.restrictActorId) add('actor_id = ?', query.restrictActorId);
    if (query.action) add('action = ?', query.action);
    if (query.after) { values.push(query.after.occurredAt, query.after.eventId); where.push(`(created_at, event_id) < ($${values.length - 1}, $${values.length})`); }
    values.push(query.limit + 1);
    const sql = `SELECT event_id, request_id, actor_type, actor_id, action, target_type, target_id, result, summary, policy_version, created_at, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at FROM audit_events ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC, event_id DESC LIMIT $${values.length}`;
    const { rows } = await this.pool.query(sql, values);
    const page = rows.slice(0, query.limit).map((row) => publicEvent({ eventId: row.event_id, occurredAt: row.created_at.toISOString(), requestId: row.request_id, actorType: row.actor_type, actorId: row.actor_id, action: row.action, targetType: row.target_type, targetId: row.target_id, result: row.result, summary: row.summary, policyVersion: row.policy_version }));
    const last = rows[Math.min(rows.length, query.limit) - 1];
    return { items: page, nextCursor: rows.length > query.limit && last ? nextCursor(last.cursor_at, last.event_id) : null };
  }
}

export class InMemoryAuditRepository {
  events = new Map(); outbox = new Map();
  async record(event) { const eventId = event.eventId ?? randomUUID(); this.events.set(eventId, { ...event, eventId, createdAt: event.createdAt ?? new Date().toISOString() }); this.outbox.set(eventId, { eventId, attempts: 0, publishedAt: null, nextAttemptAt: Date.now(), leaseOwner: null, leaseUntil: null }); return eventId; }
  async claim(workerId, leaseMs = 15_000) { const now = Date.now(); const item = [...this.outbox.values()].find((entry) => !entry.publishedAt && entry.nextAttemptAt <= now && (!entry.leaseUntil || entry.leaseUntil < now)); if (!item) return undefined; item.leaseOwner = workerId; item.leaseUntil = now + leaseMs; item.attempts += 1; return item; }
  async markPublished(eventId, workerId) { const item = this.outbox.get(eventId); if (!item || item.leaseOwner !== workerId || item.publishedAt) return undefined; item.publishedAt = Date.now(); item.leaseOwner = null; item.leaseUntil = null; return item; }
  async markFailed(eventId, workerId, retryMs = 1_000) { const item = this.outbox.get(eventId); if (!item || item.leaseOwner !== workerId || item.publishedAt) return undefined; item.nextAttemptAt = Date.now() + retryMs; item.leaseOwner = null; item.leaseUntil = null; return item; }
  async query(input) {
    const query = validateAuditQuery(input);
    const items = [...this.events.values()]
      .map((event) => publicEvent({ eventId: event.eventId, occurredAt: event.createdAt ?? new Date().toISOString(), requestId: event.requestId, actorType: event.actorId ? 'admin' : event.actorType ?? 'system', actorId: event.actorId, action: event.action, targetType: event.targetType, targetId: event.targetId, result: event.result ?? 'succeeded', summary: event.summary, policyVersion: event.policyVersion }))
      .filter((event) => (!query.restrictActorId || event.actor.id === query.restrictActorId) && (!query.actorId || event.actor.id === query.actorId) && (!query.action || event.action === query.action) && (!query.from || Date.parse(event.occurredAt) >= Date.parse(query.from)) && (!query.to || Date.parse(event.occurredAt) <= Date.parse(query.to)) && (!query.after || cursorTime(event.occurredAt) < query.after.occurredAt || cursorTime(event.occurredAt) === query.after.occurredAt && event.eventId < query.after.eventId))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.eventId.localeCompare(a.eventId));
    const page = items.slice(0, query.limit);
    return { items: page, nextCursor: items.length > query.limit ? nextCursor(cursorTime(page.at(-1).occurredAt), page.at(-1).eventId) : null };
  }
}

export class OutboxPublisher {
  constructor({ auditRepository, publish, workerId = randomUUID(), leaseMs = 15_000 }) { Object.assign(this, { auditRepository, publish, workerId, leaseMs }); }
  async publishOnce() { const item = await this.auditRepository.claim(this.workerId, this.leaseMs); if (!item) return undefined; try { await this.publish(item.eventId); return this.auditRepository.markPublished(item.eventId, this.workerId); } catch { return this.auditRepository.markFailed(item.eventId, this.workerId); } }
}
