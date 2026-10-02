import { createHash, randomUUID } from 'node:crypto';

export const protocolDigest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const invalid = (key, statusCode) => Object.assign(new Error(key), { errorKey: key, statusCode });
const same = (a, b) => ['subjectId','sessionId','operation','resourceId','version','digest','requestId'].every((key) => a[key] === b[key]);

export class InMemoryProviderProtocolConfirmations {
  constructor({ clock = Date.now } = {}) { this.clock = clock; this.tickets = new Map(); }
  async issue(input) {
    const existing = [...this.tickets.values()].find((ticket) => ticket.subjectId === input.subjectId && ticket.requestId === input.requestId);
    if (existing) { if (!same(existing, input)) throw invalid('version_conflict', 409); return this.receipt(existing); }
    const ticket = { ...input, confirmationId: randomUUID(), expiresAt: new Date(this.clock() + 5 * 60_000).toISOString(), consumed: false };
    this.tickets.set(ticket.confirmationId, ticket);
    return this.receipt(ticket);
  }
  receipt(ticket) { return { confirmationId: ticket.confirmationId, requestId: ticket.requestId, expiresAt: ticket.expiresAt, digest: ticket.digest }; }
  async consume(input) {
    const ticket = this.tickets.get(input.confirmationId);
    if (!ticket || !same(ticket, input) || ticket.consumed || Date.parse(ticket.expiresAt) <= this.clock()) throw invalid('confirmation_required', 428);
    ticket.consumed = true;
  }
}

export class PostgresProviderProtocolConfirmations {
  constructor(pool) { this.pool = pool; }
  async issue(input) {
    const { rows } = await this.pool.query('INSERT INTO provider_protocol_confirmations(confirmation_id,subject_id,session_id,operation,resource_id,declaration_version,payload_digest,request_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+interval \'5 minutes\') ON CONFLICT(subject_id,request_id) DO UPDATE SET request_id=EXCLUDED.request_id RETURNING *', [randomUUID(), input.subjectId, input.sessionId, input.operation, input.resourceId, input.version, input.digest, input.requestId]);
    const row = rows[0];
    if (row.session_id !== input.sessionId || row.operation !== input.operation || row.resource_id !== input.resourceId || row.declaration_version !== input.version || row.payload_digest !== input.digest) throw invalid('version_conflict', 409);
    return { confirmationId: row.confirmation_id, requestId: row.request_id, expiresAt: row.expires_at.toISOString(), digest: row.payload_digest };
  }
  async consume(input, client) {
    if (!client) throw invalid('confirmation_required', 428);
    const { rows } = await client.query('UPDATE provider_protocol_confirmations SET consumed_at=now() WHERE confirmation_id=$1 AND subject_id=$2 AND session_id=$3 AND operation=$4 AND resource_id=$5 AND declaration_version=$6 AND payload_digest=$7 AND request_id=$8 AND consumed_at IS NULL AND expires_at>now() RETURNING confirmation_id', [input.confirmationId, input.subjectId, input.sessionId, input.operation, input.resourceId, input.version, input.digest, input.requestId]);
    if (!rows[0]) throw invalid('confirmation_required', 428);
  }
}
