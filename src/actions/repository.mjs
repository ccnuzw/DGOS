import { randomUUID } from 'node:crypto';

const copy = (value) => value === undefined ? undefined : structuredClone(value);

export class InMemoryActionRepository {
  constructor() { this.definitions = new Map(); this.plans = new Map(); this.runs = new Map(); }
  async saveDefinition(definition) { this.definitions.set(`${definition.actionId}:${definition.actionVersion}`, copy(definition)); return definition; }
  async createPlan(plan) { this.plans.set(plan.planId, copy(plan)); return plan; }
  async getPlan(id) { return copy(this.plans.get(id)); }
  async updatePlan(id, state, expected = ['planned']) { const plan = this.plans.get(id); if (!plan || !expected.includes(plan.state)) return undefined; plan.state = state; return copy(plan); }
  async createRun(run) { const prior = [...this.runs.values()].find((x) => x.subjectId === run.subjectId && x.requestId === run.requestId); if (prior) return { run: copy(prior), created: false }; const value = { ...copy(run), runId: run.runId ?? randomUUID(), handlerClaimed: false }; this.runs.set(value.runId, value); return { run: copy(value), created: true }; }
  async createRunForPlan(run, { audit } = {}) {
    const prior = await this.findRunByRequest(run.subjectId, run.requestId);
    if (prior) return { run: prior, created: false };
    const plan = this.plans.get(run.planId);
    if (!plan || plan.state !== 'planned') return { run: undefined, created: false };
    const value = { ...copy(run), runId: run.runId ?? randomUUID(), handlerClaimed: false };
    plan.state = 'committing';
    try { await audit?.record({ requestId: value.requestId, actorId: value.subjectId, action: 'action.execute', targetType: 'action_run', targetId: value.runId, summary: { actionId: value.actionId, actionVersion: value.actionVersion } }); }
    catch (cause) { plan.state = 'planned'; throw cause; }
    this.runs.set(value.runId, value);
    plan.state = 'queued';
    return { run: copy(value), created: true };
  }
  async findRunByRequest(subjectId, requestId) { return copy([...this.runs.values()].find((x) => x.subjectId === subjectId && x.requestId === requestId)); }
  async getRun(id) { return copy(this.runs.get(id)); }
  async transitionRun(id, from, to, patch = {}) { const run = this.runs.get(id); if (!run || !from.includes(run.state)) return undefined; Object.assign(run, copy(patch), { state: to }); return copy(run); }
  async claimNext(workerId, leaseMs = 15_000) { const run = [...this.runs.values()].find((x) => x.state === 'queued' && !x.handlerClaimed); return run && this.claimRun(run.runId, workerId, leaseMs); }
  async claimRun(id, workerId, leaseMs = 15_000) { const run = this.runs.get(id); if (!run || run.state !== 'queued' || run.handlerClaimed) return undefined; const now = Date.now(); Object.assign(run, { state: 'running', handlerClaimed: true, handlerCalls: 1, leaseOwner: workerId, leaseUntil: new Date(now + leaseMs).toISOString(), heartbeatAt: new Date(now).toISOString() }); return copy(run); }
  async heartbeatRun(id, workerId, leaseMs = 15_000) { const run = this.runs.get(id); if (!run || !['running', 'cancel_requested'].includes(run.state) || run.leaseOwner !== workerId) return undefined; run.leaseUntil = new Date(Date.now() + leaseMs).toISOString(); run.heartbeatAt = new Date().toISOString(); return copy(run); }
  async reclaimRuns() { const now = Date.now(); const changed = []; for (const run of this.runs.values()) if (['running', 'cancel_requested'].includes(run.state) && run.handlerClaimed && run.leaseUntil && Date.parse(run.leaseUntil) <= now) { Object.assign(run, { state: 'failed', errorSummary: run.state === 'cancel_requested' ? 'cancel_outcome_unknown' : 'outcome_unknown', leaseOwner: null }); changed.push(copy(run)); } return changed; }
  async listRuns() { return copy([...this.runs.values()].filter((x) => ['queued', 'running', 'cancel_requested'].includes(x.state))); }
  async claimHandler(id, workerId) { const run = this.runs.get(id); return run?.leaseOwner === workerId && run.handlerClaimed ? copy(run) : undefined; }
}

export class PostgresActionRepository {
  constructor(pool) { this.pool = pool; }
  async withTransaction(work) { const c = await this.pool.connect(); try { await c.query('BEGIN'); const value = await work(c); await c.query('COMMIT'); return value; } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); } }
  async saveDefinition(x) { await this.pool.query('INSERT INTO action_definitions(action_id,action_version,owner_app_id,definition) VALUES($1,$2,$3,$4) ON CONFLICT(action_id,action_version) DO UPDATE SET definition=EXCLUDED.definition,enabled=true', [x.actionId,x.actionVersion,x.ownerAppId,JSON.stringify(x)]); return x; }
  async createPlan(x) { const { rows } = await this.pool.query('INSERT INTO action_plans(plan_id,request_id,subject_id,action_id,action_version,input_digest,risk,confirmation_required,confirmation_state,input_summary,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(subject_id,request_id) DO UPDATE SET request_id=EXCLUDED.request_id RETURNING *', [x.planId ?? randomUUID(),x.requestId,x.subjectId,x.actionId,x.actionVersion,x.inputDigest,x.riskLevel,x.confirmationRequired,x.confirmationRequired?'pending':'not_required',JSON.stringify({ keys:x.inputSummary, permission:x.permission, registryVersion:x.registryVersion }),x.expiresAt]); return this.planRow(rows[0]); }
  planRow(r) { if (!r) return undefined; const summary=r.input_summary; return { planId:r.plan_id,requestId:r.request_id,subjectId:r.subject_id,actionId:r.action_id,actionVersion:String(r.action_version),inputDigest:r.input_digest,riskLevel:r.risk,confirmationRequired:r.confirmation_required,confirmationState:r.confirmation_state,inputSummary:Array.isArray(summary)?summary:summary?.keys??[],permission:Array.isArray(summary)?undefined:summary?.permission,registryVersion:Array.isArray(summary)?undefined:summary?.registryVersion,expiresAt:r.expires_at.toISOString(),state:r.state }; }
  async getPlan(id, client=this.pool) { const { rows } = await client.query('SELECT * FROM action_plans WHERE plan_id=$1',[id]); return this.planRow(rows[0]); }
  async updatePlan(id,state,expected=['planned'],client=this.pool) { const { rows }=await client.query('UPDATE action_plans SET state=$2 WHERE plan_id=$1 AND state=ANY($3::text[]) RETURNING *',[id,state,expected]); return this.planRow(rows[0]); }
  runRow(r) { return r && ({runId:r.run_id,planId:r.plan_id,requestId:r.request_id,subjectId:r.subject_id,actionId:r.action_id,actionVersion:String(r.action_version),inputDigest:r.input_digest,input:r.input_payload,state:r.state,handlerCalls:r.handler_calls,timeoutAt:r.timeout_at?.toISOString(),cancelRequestId:r.cancel_request_id,resultSummary:r.result_summary,errorSummary:r.error_summary,leaseOwner:r.lease_owner,leaseUntil:r.lease_until?.toISOString(),heartbeatAt:r.heartbeat_at?.toISOString(),createdAt:r.created_at?.toISOString()}); }
  async createRun(x) { return this.withTransaction(async (c) => { const old=await c.query('SELECT * FROM action_runs WHERE subject_id=$1 AND request_id=$2',[x.subjectId,x.requestId]); if(old.rows[0]) return {run:this.runRow(old.rows[0]),created:false}; const {rows}=await c.query("INSERT INTO action_runs(run_id,request_id,subject_id,action_id,plan_id,action_version,input_digest,input_payload,state,timeout_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'queued',$9) ON CONFLICT(subject_id,request_id) DO NOTHING RETURNING *",[x.runId??randomUUID(),x.requestId,x.subjectId,x.actionId,x.planId,x.actionVersion,x.inputDigest,JSON.stringify(x.input ?? {}),x.timeoutAt]); if(rows[0]) return {run:this.runRow(rows[0]),created:true}; const raced=await c.query('SELECT * FROM action_runs WHERE subject_id=$1 AND request_id=$2',[x.subjectId,x.requestId]); return {run:this.runRow(raced.rows[0]),created:false}; }); }
  async createRunForPlan(x, { audit } = {}) { return this.withTransaction(async (c) => {
    const plan = await c.query('SELECT state FROM action_plans WHERE plan_id=$1 AND subject_id=$2 FOR UPDATE',[x.planId,x.subjectId]);
    const prior = await c.query('SELECT * FROM action_runs WHERE subject_id=$1 AND request_id=$2',[x.subjectId,x.requestId]);
    if (prior.rows[0]) return { run:this.runRow(prior.rows[0]), created:false };
    if (plan.rows[0]?.state !== 'planned') return { run:undefined, created:false };
    const {rows}=await c.query("INSERT INTO action_runs(run_id,request_id,subject_id,action_id,plan_id,action_version,input_digest,input_payload,state,timeout_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'queued',$9) ON CONFLICT(subject_id,request_id) DO NOTHING RETURNING *",[x.runId??randomUUID(),x.requestId,x.subjectId,x.actionId,x.planId,x.actionVersion,x.inputDigest,JSON.stringify(x.input ?? {}),x.timeoutAt]);
    if (!rows[0]) { const raced=await c.query('SELECT * FROM action_runs WHERE subject_id=$1 AND request_id=$2',[x.subjectId,x.requestId]); return {run:this.runRow(raced.rows[0]),created:false}; }
    await this.recordExecutionAudit(c, this.runRow(rows[0]));
    await c.query("UPDATE action_plans SET state='queued' WHERE plan_id=$1",[x.planId]);
    return { run:this.runRow(rows[0]), created:true };
  }); }
  async recordExecutionAudit(client, run) {
    const event = { requestId:run.requestId, actorId:run.subjectId, action:'action.execute', targetType:'action_run', targetId:run.runId, summary:{ actionId:run.actionId, actionVersion:run.actionVersion } };
    const eventId = randomUUID();
    await client.query('INSERT INTO audit_events (event_id,request_id,actor_type,actor_id,action,target_type,target_id,result,summary) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',[eventId,event.requestId,'admin',event.actorId,event.action,event.targetType,event.targetId,'succeeded',JSON.stringify(event.summary)]);
    await client.query('INSERT INTO audit_outbox (event_id) VALUES ($1)',[eventId]);
  }
  async findRunByRequest(subjectId,requestId) { const {rows}=await this.pool.query('SELECT * FROM action_runs WHERE subject_id=$1 AND request_id=$2',[subjectId,requestId]); return this.runRow(rows[0]); }
  async getRun(id) { const {rows}=await this.pool.query('SELECT * FROM action_runs WHERE run_id=$1',[id]); return this.runRow(rows[0]); }
  async transitionRun(id,from,to,patch={}) { const {rows}=await this.pool.query('UPDATE action_runs SET state=$3,handler_calls=COALESCE($4,handler_calls),cancel_request_id=COALESCE($5,cancel_request_id),result_summary=COALESCE($6,result_summary),error_summary=COALESCE($7,error_summary),lease_owner=COALESCE($8,lease_owner),lease_until=COALESCE($9,lease_until),heartbeat_at=COALESCE($10,heartbeat_at) WHERE run_id=$1 AND state=ANY($2::text[]) RETURNING *',[id,from,to,patch.handlerCalls??null,patch.cancelRequestId??null,patch.resultSummary?JSON.stringify(patch.resultSummary):null,patch.errorSummary??null,patch.leaseOwner??null,patch.leaseUntil??null,patch.heartbeatAt??null]); return this.runRow(rows[0]); }
  async claimNext(workerId, leaseMs = 15_000) { const {rows}=await this.pool.query("WITH next AS (SELECT run_id FROM action_runs WHERE state='queued' AND handler_claimed=false AND input_payload IS NOT NULL ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE action_runs r SET state='running',handler_claimed=true,handler_calls=1,lease_owner=$1,lease_until=now()+($2::int * interval '1 millisecond'),heartbeat_at=now() FROM next WHERE r.run_id=next.run_id RETURNING r.*",[workerId,leaseMs]); return this.runRow(rows[0]); }
  async claimRun(id, workerId, leaseMs = 15_000) { const {rows}=await this.pool.query("UPDATE action_runs SET state='running',handler_claimed=true,handler_calls=1,lease_owner=$2,lease_until=now()+($3::int * interval '1 millisecond'),heartbeat_at=now() WHERE run_id=$1 AND state='queued' AND handler_claimed=false AND input_payload IS NOT NULL RETURNING *",[id,workerId,leaseMs]); return this.runRow(rows[0]); }
  async heartbeatRun(id, workerId, leaseMs = 15_000) { const {rows}=await this.pool.query("UPDATE action_runs SET lease_until=now()+($3::int * interval '1 millisecond'),heartbeat_at=now() WHERE run_id=$1 AND state IN ('running','cancel_requested') AND lease_owner=$2 RETURNING *",[id,workerId,leaseMs]); return this.runRow(rows[0]); }
  async reclaimRuns() { const {rows}=await this.pool.query("UPDATE action_runs SET state='failed',error_summary=CASE WHEN state='cancel_requested' THEN 'cancel_outcome_unknown' ELSE 'outcome_unknown' END,lease_owner=NULL WHERE state IN ('running','cancel_requested') AND handler_claimed=true AND lease_until < now() RETURNING *"); return rows.map((r)=>this.runRow(r)); }
  async listRuns() { const {rows}=await this.pool.query("SELECT * FROM action_runs WHERE state IN ('queued','running','cancel_requested')"); return rows.map((r)=>this.runRow(r)); }
  async claimHandler(id, workerId) { const {rows}=await this.pool.query('SELECT * FROM action_runs WHERE run_id=$1 AND lease_owner=$2 AND handler_claimed=true',[id,workerId]); return this.runRow(rows[0]); }
}
