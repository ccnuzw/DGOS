import { randomUUID } from 'node:crypto';

export class InMemoryActionRepository {
  constructor() { this.definitions = new Map(); this.plans = new Map(); this.runs = new Map(); }
  async saveDefinition(definition) { this.definitions.set(`${definition.actionId}:${definition.actionVersion}`, structuredClone(definition)); return definition; }
  async createPlan(plan) { this.plans.set(plan.planId, structuredClone(plan)); return plan; }
  async getPlan(id) { return this.plans.get(id); }
  async updatePlan(id, state, expected = ['planned']) { const plan = this.plans.get(id); if (!plan || !expected.includes(plan.state)) return undefined; plan.state = state; return plan; }
  async createRun(run) { const prior = [...this.runs.values()].find((x) => x.subjectId === run.subjectId && x.requestId === run.requestId); if (prior) return { run: prior, created: false }; const value = { ...run, runId: run.runId ?? randomUUID() }; this.runs.set(value.runId, value); return { run: value, created: true }; }
  async findRunByRequest(subjectId, requestId) { return [...this.runs.values()].find((x) => x.subjectId === subjectId && x.requestId === requestId); }
  async getRun(id) { return this.runs.get(id); }
  async transitionRun(id, from, to, patch = {}) { const run = this.runs.get(id); if (!run || !from.includes(run.state)) return undefined; Object.assign(run, patch, { state: to }); return run; }
  async listRuns() { return [...this.runs.values()]; }
}

export class PostgresActionRepository {
  constructor(pool) { this.pool = pool; }
  async withTransaction(work) { const c = await this.pool.connect(); try { await c.query('BEGIN'); const value = await work(c); await c.query('COMMIT'); return value; } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); } }
  async saveDefinition(x) { await this.pool.query('INSERT INTO action_definitions(action_id,action_version,owner_app_id,definition) VALUES($1,$2,$3,$4) ON CONFLICT(action_id,action_version) DO UPDATE SET definition=EXCLUDED.definition,enabled=true', [x.actionId,x.actionVersion,x.ownerAppId,JSON.stringify(x)]); return x; }
  async createPlan(x) { const { rows } = await this.pool.query('INSERT INTO action_plans(plan_id,request_id,subject_id,action_id,action_version,input_digest,risk,confirmation_required,confirmation_state,input_summary,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(subject_id,request_id) DO UPDATE SET request_id=EXCLUDED.request_id RETURNING *', [x.planId ?? randomUUID(),x.requestId,x.subjectId,x.actionId,x.actionVersion,x.inputDigest,x.riskLevel,x.confirmationRequired,x.confirmationRequired?'pending':'not_required',JSON.stringify(x.inputSummary),x.expiresAt]); return this.planRow(rows[0]); }
  planRow(r) { return r && ({ planId:r.plan_id,requestId:r.request_id,subjectId:r.subject_id,actionId:r.action_id,actionVersion:String(r.action_version),inputDigest:r.input_digest,riskLevel:r.risk,confirmationRequired:r.confirmation_required,confirmationState:r.confirmation_state,inputSummary:r.input_summary,expiresAt:r.expires_at.toISOString(),state:r.state }); }
  async getPlan(id, client=this.pool) { const { rows } = await client.query('SELECT * FROM action_plans WHERE plan_id=$1',[id]); return this.planRow(rows[0]); }
  async updatePlan(id,state,expected=['planned'],client=this.pool) { const { rows }=await client.query('UPDATE action_plans SET state=$2 WHERE plan_id=$1 AND state=ANY($3::text[]) RETURNING *',[id,state,expected]); return this.planRow(rows[0]); }
  runRow(r) { return r && ({runId:r.run_id,planId:r.plan_id,requestId:r.request_id,subjectId:r.subject_id,actionId:r.action_id,actionVersion:String(r.action_version),state:r.state,handlerCalls:r.handler_calls,timeoutAt:r.timeout_at?.toISOString(),cancelRequestId:r.cancel_request_id,resultSummary:r.result_summary,errorSummary:r.error_summary,createdAt:r.created_at?.toISOString()}); }
  async createRun(x) { return this.withTransaction(async (c) => { const old=await c.query('SELECT * FROM action_runs WHERE subject_id=$1 AND request_id=$2',[x.subjectId,x.requestId]); if(old.rows[0]) return {run:this.runRow(old.rows[0]),created:false}; const {rows}=await c.query("INSERT INTO action_runs(run_id,request_id,subject_id,action_id,plan_id,action_version,input_digest,state,timeout_at) VALUES($1,$2,$3,$4,$5,$6,$7,'queued',$8) ON CONFLICT(subject_id,request_id) DO NOTHING RETURNING *",[x.runId??randomUUID(),x.requestId,x.subjectId,x.actionId,x.planId,x.actionVersion,x.inputDigest,x.timeoutAt]); return {run:this.runRow(rows[0]),created:Boolean(rows[0])}; }); }
  async findRunByRequest(subjectId,requestId) { const {rows}=await this.pool.query('SELECT * FROM action_runs WHERE subject_id=$1 AND request_id=$2',[subjectId,requestId]); return this.runRow(rows[0]); }
  async getRun(id) { const {rows}=await this.pool.query('SELECT * FROM action_runs WHERE run_id=$1',[id]); return this.runRow(rows[0]); }
  async transitionRun(id,from,to,patch={}) { const {rows}=await this.pool.query('UPDATE action_runs SET state=$3,handler_calls=COALESCE($4,handler_calls),cancel_request_id=COALESCE($5,cancel_request_id),result_summary=COALESCE($6,result_summary),error_summary=COALESCE($7,error_summary) WHERE run_id=$1 AND state=ANY($2::text[]) AND ( $3 <> \'running\' OR handler_calls=0 ) RETURNING *',[id,from,to,patch.handlerCalls??null,patch.cancelRequestId??null,patch.resultSummary?JSON.stringify(patch.resultSummary):null,patch.errorSummary??null]); return this.runRow(rows[0]); }
  async listRuns() { const {rows}=await this.pool.query("SELECT * FROM action_runs WHERE state IN ('queued','running','cancel_requested')"); return rows.map((r)=>this.runRow(r)); }
}
