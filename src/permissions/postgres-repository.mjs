import { randomUUID } from 'node:crypto';
const row = (r) => r && ({ subjectId: r.subject_id, appId: r.app_id, capability: r.capability, scope: r.scope, decision: r.decision, policyVersion: String(r.policy_version), updatedAt: r.updated_at?.toISOString() });
export class PostgresPermissionRepository {
  constructor(pool) { this.pool = pool; this.version = 1; }
  async get(q) { const { rows } = await this.pool.query('SELECT * FROM permission_decisions WHERE subject_id=$1 AND app_id=$2 AND capability=$3 AND scope=$4', [q.subjectId,q.appId,q.capability,q.scope ?? '*']); return row(rows[0]); }
  async set(q, decision) { const { rows } = await this.pool.query('INSERT INTO permission_decisions(subject_id,app_id,capability,scope,decision,policy_version) VALUES($1,$2,$3,$4,$5,(SELECT COALESCE(max(policy_version),0)+1 FROM permission_decisions)) ON CONFLICT(subject_id,app_id,capability,scope) DO UPDATE SET decision=EXCLUDED.decision,policy_version=permission_decisions.policy_version+1,updated_at=now() RETURNING *', [q.subjectId,q.appId,q.capability,q.scope ?? '*',decision]); return row(rows[0]); }
  async createRequest(q) { const { rows } = await this.pool.query('INSERT INTO permission_requests(request_id,subject_id,app_id,capability,scope,expires_at,policy_version) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(request_id) DO UPDATE SET request_id=EXCLUDED.request_id RETURNING *', [q.requestId ?? randomUUID(),q.subjectId,q.appId,q.capability,q.scope ?? '*',q.expiresAt,q.policyVersion]); return rows[0]; }
}
