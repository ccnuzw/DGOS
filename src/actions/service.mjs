import { createHash, randomUUID } from 'node:crypto';
import { InMemoryActionRepository } from './repository.mjs';

const digest = (value) => createHash('sha256').update(JSON.stringify(value ?? {})).digest('hex');
const error = (message, statusCode) => Object.assign(new Error(message), { statusCode });

export class ActionService {
  constructor({ registry, permissions, audit, repository = new InMemoryActionRepository(), workerId = randomUUID(), leaseMs = 15000 } = {}) {
    Object.assign(this, { registry, permissions, audit, repository, workerId, leaseMs });
    this.handlers = new Map(); this.registrations = [];
  }
  register(action, handler) {
    const definition = this.registry.register(action);
    this.registrations.push(Promise.resolve(this.repository.saveDefinition?.({ ...definition, actionVersion: this.registry.version })));
    if (handler) this.handlers.set(action.actionId, handler);
    return definition;
  }
  list() { return { items: this.registry.list().map(({ actionId, ownerAppId, requiredCapability, riskLevel, sideEffects, timeout, cancellationPolicy, inputSchema, description }) => ({ actionId, ownerAppId, requiredCapability, riskLevel, sideEffects, timeout, cancellationPolicy, inputSchema: inputSchema ?? { type: 'object', properties: {} }, description })), registryVersion: String(this.registry.version) }; }
  validateInput(action, input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw error('invalid_request', 422);
    for (const name of action.inputSchema?.required ?? []) if (!(name in input)) throw error('invalid_request', 422);
    for (const [name, spec] of Object.entries(action.inputSchema?.properties ?? {})) {
      if (!(name in input)) continue;
      const value = input[name];
      if (spec.type === 'object' ? !value || typeof value !== 'object' || Array.isArray(value) : spec.type === 'array' ? !Array.isArray(value) : spec.type === 'integer' ? !Number.isInteger(value) : spec.type && typeof value !== spec.type) throw error('invalid_request', 422);
    }
  }
  async plan({ actionId, input = {}, subjectId, appId, requestId }) {
    await Promise.all(this.registrations);
    const action = this.registry.get(actionId); if (!action) throw error('action_not_found', 404);
    this.validateInput(action, input);
    const permission = await this.permissions.check({ subjectId, appId: appId ?? action.ownerAppId, capability: action.requiredCapability, declared: [action.requiredCapability], requestId });
    const confirmationRequired = action.riskLevel === 'high' || permission.decision !== 'allow';
    const plan = { planId: randomUUID(), requestId, actionId, actionVersion: String(action.actionVersion ?? this.registry.version), registryVersion: String(this.registry.version), inputDigest: digest(input), inputSummary: Object.keys(input).slice(0, 32), riskLevel: action.riskLevel, requiredCapability: action.requiredCapability, confirmationRequired, confirmationState: confirmationRequired ? 'pending' : 'not_required', permission, expiresAt: new Date(Date.now() + 300000).toISOString(), state: 'planned', subjectId };
    await this.repository.createPlan(plan);
    await this.audit?.record({ requestId, actorId: subjectId, action: 'action.plan', targetType: 'action', targetId: actionId, summary: { riskLevel: action.riskLevel, confirmationRequired } });
    return plan;
  }
  async execute({ actionId, input = {}, subjectId, appId, planId, confirmed = false, requestId }) {
    const plan = await this.repository.getPlan(planId); const action = this.registry.get(actionId);
    if (!action) throw error('action_not_found', 404);
    if (!plan || plan.subjectId !== subjectId || plan.actionId !== actionId || plan.state !== 'planned') throw error('confirmation_required', 428);
    if (Date.parse(plan.expiresAt) <= Date.now()) throw error('confirmation_required', 410);
    if (String(plan.actionVersion) !== String(action.actionVersion ?? this.registry.version)) throw error('version_conflict', 409);
    if (digest(input) !== plan.inputDigest) throw error('invalid_request', 422);
    this.validateInput(action, input);
    const permission = await this.permissions.check({ subjectId, appId: appId ?? action.ownerAppId, capability: action.requiredCapability, declared: [action.requiredCapability], requestId });
    if (permission.decision !== 'allow') throw error('permission_denied', 403);
    if (plan.confirmationRequired && !confirmed) throw error('confirmation_required', 428);
    const created = await this.repository.createRun({ runId: randomUUID(), planId, actionId, actionVersion: String(action.actionVersion ?? this.registry.version), inputDigest: plan.inputDigest, subjectId, requestId, timeoutAt: new Date(Date.now() + (action.timeout ?? 30000)).toISOString(), state: 'queued', handlerCalls: 0 });
    const run = created.run;
    if (!created.created) return run;
    if (!await this.repository.updatePlan(planId, 'queued', ['planned'])) { await this.repository.transitionRun(run.runId, ['queued'], 'cancelled'); return run; }
    await this.audit?.record({ requestId, actorId: subjectId, action: 'action.execute', targetType: 'action_run', targetId: run.runId, summary: { actionId } });
    queueMicrotask(() => this.run(run, action, input).catch(() => {}));
    return run;
  }
  async run(run, action, input) {
    const started = await this.repository.claimRun(run.runId, this.workerId, this.leaseMs);
    if (!started || !await this.repository.claimHandler(run.runId, this.workerId)) return;
    let timer;
    const heartbeat = setInterval(() => this.repository.heartbeatRun(run.runId, this.workerId, this.leaseMs).catch(() => {}), Math.max(1000, Math.floor(this.leaseMs / 3)));
    try {
      const handler = this.handlers.get(action.actionId);
      if (!handler) throw error('action_not_found', 404);
      const result = await Promise.race([handler(input, { runId: run.runId, subjectId: run.subjectId, requestId: run.requestId }), new Promise((_, reject) => { timer = setTimeout(() => reject(error('action_timeout', 504)), action.timeout ?? 30000); })]);
      const current = await this.repository.getRun(run.runId);
      await this.repository.transitionRun(run.runId, ['running', 'cancel_requested'], current?.state === 'cancel_requested' ? 'cancelled' : 'succeeded', { handlerCalls: 1, resultSummary: { ok: result?.ok ?? true } });
    } catch (e) {
      await this.repository.transitionRun(run.runId, ['running', 'cancel_requested'], 'failed', { handlerCalls: 1, errorSummary: ['version_conflict', 'permission_denied', 'action_timeout', 'invalid_request'].includes(e.message) ? e.message : 'handler_failed' });
    } finally { clearTimeout(timer); clearInterval(heartbeat); }
  }
  async reclaim() { return this.repository.reclaimRuns?.(this.workerId, this.leaseMs) ?? []; }
  async get(runId, subjectId) { const run = await this.repository.getRun(runId); if (!run || run.subjectId !== subjectId) throw error('action_run_not_found', 404); return run; }
  async cancel(runId, subjectId, requestId) { const run = await this.get(runId, subjectId); if (['succeeded', 'failed', 'cancelled'].includes(run.state)) return run; return await this.repository.transitionRun(runId, ['queued'], 'cancelled', { cancelRequestId: requestId }) ?? await this.repository.transitionRun(runId, ['running'], 'cancel_requested', { cancelRequestId: requestId }) ?? run; }
}
