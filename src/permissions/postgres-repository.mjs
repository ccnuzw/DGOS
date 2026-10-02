import { randomUUID } from 'node:crypto';
import { isReservedBuiltinAppId, trustedBuiltinCapabilities } from './builtin-declarations.mjs';
const row = (r) => r && ({ subjectId: r.subject_id, appId: r.app_id, capability: r.capability, scope: r.scope, decision: r.decision, policyVersion: String(r.policy_version), updatedAt: r.updated_at?.toISOString() });
const requestRow = (r) => r && ({ requestId: r.request_id, subjectId: r.subject_id, appId: r.app_id, capability: r.capability, scope: r.scope, state: r.state, expiresAt: r.expires_at?.toISOString?.() ?? r.expires_at, policyVersion: String(r.policy_version), createdAt: r.created_at?.toISOString?.() ?? r.created_at });
const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const fingerprint = (input) => JSON.stringify([input.subjectId, input.appId, input.capability, input.scope ?? '*', input.decision]);
export class PostgresPermissionRepository {
  constructor(pool) { this.pool = pool; this.version = 1; }
  async transaction(work) { const client = await this.pool.connect(); try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }
  async get(q) { const { rows } = await this.pool.query('SELECT * FROM permission_decisions WHERE subject_id=$1 AND app_id=$2 AND capability=$3 AND scope=$4', [q.subjectId,q.appId,q.capability,q.scope ?? '*']); return row(rows[0]); }
  async listForSubject(subjectId, client = this.pool) { const { rows } = await client.query('SELECT * FROM permission_decisions WHERE subject_id=$1 ORDER BY app_id,capability,scope', [subjectId]); return rows.map(row); }
  async declaredCapabilities({ subjectId, appId }, client = this.pool) {
    if (isReservedBuiltinAppId(appId)) return [];
    const { rows } = await client.query("SELECT r.manifest FROM app_package_deployments d JOIN app_package_releases r ON r.package_id=d.package_id WHERE d.subject_id=$1 AND d.app_id=$2 AND d.state='active' AND d.package_digest=r.package_digest AND r.catalog_state IN ('official','approved')", [subjectId, appId]);
    const manifest = rows[0]?.manifest;
    if (!manifest) return [];
    const allowlist = new Set(manifest.capabilityAllowlist ?? []);
    return (manifest.permissions ?? []).filter((capability) => allowlist.has(capability));
  }
  async recordAudit(client, input) {
    const eventId = randomUUID();
    await client.query('INSERT INTO audit_events(event_id,request_id,actor_type,actor_id,action,target_type,target_id,result,summary) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [eventId, input.requestId ?? randomUUID(), 'admin', input.subjectId, 'permission.change', 'permission', null, 'succeeded', JSON.stringify({ appId: input.appId, capability: input.capability, scope: input.scope ?? '*', decision: input.decision })]);
    await client.query('INSERT INTO audit_outbox(event_id) VALUES($1)', [eventId]);
  }
  async writeDecision(client, input, { denyPrecedence = false, trustedBuiltins = false } = {}) {
    const requestId = input.requestId ?? randomUUID();
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`permission:${input.subjectId}:${input.appId}:${input.capability}:${input.scope ?? '*'}`]);
    const prior = await client.query('SELECT * FROM permission_decisions WHERE subject_id=$1 AND app_id=$2 AND capability=$3 AND scope=$4 FOR UPDATE', [input.subjectId, input.appId, input.capability, input.scope ?? '*']);
    if (denyPrecedence && input.decision === 'allow' && prior.rows[0]?.decision === 'deny') throw fail('permission_denied', 403);
    const declared = isReservedBuiltinAppId(input.appId) ? trustedBuiltins ? trustedBuiltinCapabilities(input.appId) : [] : await this.declaredCapabilities(input, client);
    if (input.decision === 'allow' && !declared.includes(input.capability)) throw fail('permission_denied', 403);
    const { rows } = await client.query('INSERT INTO permission_decisions(subject_id,app_id,capability,scope,decision,policy_version) VALUES($1,$2,$3,$4,$5,1) ON CONFLICT(subject_id,app_id,capability,scope) DO UPDATE SET decision=EXCLUDED.decision,policy_version=permission_decisions.policy_version+1,updated_at=now() RETURNING *', [input.subjectId, input.appId, input.capability, input.scope ?? '*', input.decision]);
    await this.recordAudit(client, { ...input, requestId });
    return row(rows[0]);
  }
  async writeSystemRules(client, rules, { trustedBuiltins = true } = {}) {
    const result = [];
    for (const rule of rules) result.push(await this.writeDecision(client, rule, { trustedBuiltins }));
    return result;
  }
  async decide(input, { trustedBuiltins = false } = {}) {
    return this.transaction(async (client) => {
      if (input.requestId) {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`permission-request:${input.requestId}`]);
        const prior = await client.query('SELECT fingerprint,result FROM permission_change_receipts WHERE request_id=$1', [input.requestId]);
        if (prior.rows[0]) { if (prior.rows[0].fingerprint !== fingerprint(input)) throw fail('version_conflict', 409); return prior.rows[0].result; }
      }
      const result = await this.writeDecision(client, input, { trustedBuiltins });
      if (input.requestId) await client.query('INSERT INTO permission_change_receipts(request_id,fingerprint,result) VALUES($1,$2,$3)', [input.requestId, fingerprint(input), JSON.stringify(result)]);
      return result;
    });
  }
  async set(q, decision) { return this.decide({ ...q, decision }); }
  async createRequest(q) { return this.transaction(async (client) => {
    const requestId = q.requestId ?? randomUUID();
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`permission-request:${requestId}`]);
    const existing = await client.query('SELECT * FROM permission_requests WHERE request_id=$1', [requestId]);
    if (existing.rows[0]) { const prior = requestRow(existing.rows[0]); if ([prior.subjectId,prior.appId,prior.capability,prior.scope].join(':') !== [q.subjectId,q.appId,q.capability,q.scope ?? '*'].join(':')) throw fail('version_conflict', 409); return prior; }
    const pending = await client.query("SELECT * FROM permission_requests WHERE subject_id=$1 AND app_id=$2 AND capability=$3 AND scope=$4 AND state='pending' FOR UPDATE", [q.subjectId,q.appId,q.capability,q.scope ?? '*']);
    if (pending.rows[0]) return requestRow(pending.rows[0]);
    const { rows } = await client.query('INSERT INTO permission_requests(request_id,subject_id,app_id,capability,scope,expires_at,policy_version) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *', [requestId,q.subjectId,q.appId,q.capability,q.scope ?? '*',q.expiresAt,q.policyVersion]);
    return requestRow(rows[0]);
  }); }
  async transitionRequest(requestId, state, expected = ['pending']) { const { rows } = await this.pool.query('UPDATE permission_requests SET state=$2 WHERE request_id=$1 AND state=ANY($3::text[]) AND expires_at > now() RETURNING *', [requestId,state,expected]); return requestRow(rows[0]); }
  async getRequest(requestId) { const { rows } = await this.pool.query('SELECT * FROM permission_requests WHERE request_id=$1', [requestId]); return requestRow(rows[0]); }
  async resolveRequest(requestId, state, { trustedBuiltins = false } = {}) { return this.transaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM permission_requests WHERE request_id=$1 FOR UPDATE', [requestId]);
    if (!rows[0]) throw fail('invalid_request', 404);
    const request = requestRow(rows[0]);
    if (request.state !== 'pending' || Date.parse(request.expiresAt) <= Date.now()) throw fail('version_conflict', 409);
    const result = await this.writeDecision(client, { ...request, decision: state === 'approved' ? 'allow' : 'deny' }, { denyPrecedence: true, trustedBuiltins });
    await client.query('UPDATE permission_requests SET state=$2 WHERE request_id=$1', [requestId, state]);
    return result;
  }); }
}
