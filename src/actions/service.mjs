import { createHash, randomUUID } from 'node:crypto';
import { InMemoryActionRepository } from './repository.mjs';
import { publicActionDeclaration } from './public-declaration.mjs';

export const stableActionJson = (value) => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableActionJson).join(',')}]`;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) return `{${Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => `${JSON.stringify(key)}:${stableActionJson(value[key])}`).join(',')}}`;
  throw Object.assign(new Error('invalid_request'), { statusCode: 422 });
};
export const stableActionDigest = (value) => createHash('sha256').update(stableActionJson(value ?? {})).digest('hex');
const digest = stableActionDigest;
const error = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const terminal = new Set(['succeeded', 'failed', 'cancelled']);
const sensitiveDomains = new Set(['appPermissions', 'privacy', 'network']);

const actionRisk = (action, input) => {
  if (action.riskLevel === 'high' || action.confirmation === 'elevated') return 'high';
  if (action.actionId === 'system.settings.patch' && sensitiveDomains.has(input?.patch?.domain)) return 'high';
  const terms = [...(action.requiredCapabilities ?? [action.requiredCapability]), ...(action.sideEffects ?? [])];
  if (terms.some((term) => /(?:permission|privacy|network|secret|credential)/i.test(String(term)))) return 'high';
  return action.riskLevel;
};

export class ActionService {
  constructor({ registry, permissions, audit, repository = new InMemoryActionRepository(), workerId = randomUUID(), leaseMs = 15000, autoDispatch = true } = {}) {
    Object.assign(this, { registry, permissions, audit, repository, workerId, leaseMs, autoDispatch });
    this.handlers = new Map(); this.registrations = []; this.controllers = new Map();
  }
  register(action, handler) {
    const definition = this.registry.register(action);
    this.registrations.push(Promise.resolve(this.repository.saveDefinition?.(definition)));
    if (handler) this.handlers.set(action.actionId, handler);
    return definition;
  }
  list() { return { items: this.registry.list().map((action) => publicActionDeclaration(action)), registryVersion: String(this.registry.version) }; }
  async executionPolicy({ actionId, planId, input = {}, subjectId }) {
    const action = this.registry.get(actionId);
    if (!action) throw error('action_not_found', 404);
    const plan = await this.repository.getPlan(planId);
    if (!plan || plan.actionId !== actionId || plan.subjectId !== subjectId) throw error('confirmation_required', 428);
    const currentRisk = actionRisk(action, input);
    if (plan.riskLevel !== currentRisk) throw error('version_conflict', 409);
    return { freshSessionRequired: currentRisk === 'high' };
  }
  async checkActionPermissions(action, subjectId, requestId, input) {
    const decisions = [];
    const capabilities = new Set(action.requiredCapabilities ?? [action.requiredCapability]);
    if (action.actionId === 'system.settings.appPermissions.patch' || action.actionId === 'system.settings.patch' && input?.patch?.domain === 'appPermissions') capabilities.add('permission.manage');
    for (const capability of capabilities) {
      decisions.push(await this.permissions.check({ subjectId, appId: action.ownerAppId, capability, requestId }));
    }
    return decisions;
  }
  validateInput(action, input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw error('invalid_request', 422);
    const encoded = JSON.stringify(input);
    if (encoded.length > 16_384 || /"(?:password|credential|apiKey|accessToken|refreshToken|proxySecret)"\s*:/i.test(encoded)) throw error('invalid_request', 422);
    if (Object.keys(input).some((name) => !(name in (action.inputSchema?.properties ?? {})))) throw error('invalid_request', 422);
    for (const name of action.inputSchema?.required ?? []) if (!(name in input)) throw error('invalid_request', 422);
    for (const [name, spec] of Object.entries(action.inputSchema?.properties ?? {})) {
      if (!(name in input)) continue;
      const value = input[name];
      if (spec.type === 'object' ? !value || typeof value !== 'object' || Array.isArray(value) : spec.type === 'array' ? !Array.isArray(value) : spec.type === 'integer' ? !Number.isInteger(value) : spec.type && typeof value !== spec.type) throw error('invalid_request', 422);
    }
  }
  async plan({ actionId, input = {}, subjectId, requestId }) {
    await Promise.all(this.registrations);
    const action = this.registry.get(actionId); if (!action) throw error('action_not_found', 404);
    this.validateInput(action, input);
    const permissions = await this.checkActionPermissions(action, subjectId, requestId, input);
    if (permissions.some((decision) => decision.decision === 'deny')) throw error('permission_denied', 403);
    const permission = permissions[0];
    const riskLevel = actionRisk(action, input);
    const confirmationRequired = action.confirmation === 'elevated' || action.confirmation === 'required' || riskLevel !== 'low' || (action.sideEffects?.length ?? 0) > 0 || permissions.some((decision) => decision.decision !== 'allow');
    const plan = { planId: randomUUID(), requestId: requestId ?? randomUUID(), actionId, actionVersion: String(action.actionVersion), registryVersion: String(this.registry.version), inputDigest: digest(input), inputSummary: Object.keys(input).slice(0, 32), riskLevel, requiredCapability: action.requiredCapability, confirmationRequired, confirmationState: confirmationRequired ? 'pending' : 'not_required', permission, expiresAt: new Date(Date.now() + 300000).toISOString(), state: 'planned', subjectId };
    const saved = await this.repository.createPlan(plan);
    await this.audit?.record({ requestId: plan.requestId, actorId: subjectId, action: 'action.plan', targetType: 'action', targetId: actionId, summary: { riskLevel: action.riskLevel, confirmationRequired } });
    return saved;
  }
  async execute({ actionId, input = {}, subjectId, planId, confirmed = false, requestId }) {
    const plan = await this.repository.getPlan(planId); const action = this.registry.get(actionId);
    if (!action) throw error('action_not_found', 404);
    if (!plan || plan.subjectId !== subjectId || plan.actionId !== actionId) throw error('confirmation_required', 428);
    if (requestId) {
      const existing = await this.repository.findRunByRequest(subjectId, requestId);
      if (existing) {
        if (existing.planId !== planId || existing.actionId !== actionId || existing.inputDigest !== digest(input)) throw error('version_conflict', 409);
        return this.publicRun(existing);
      }
    }
    if (plan.state !== 'planned') throw error('confirmation_required', 428);
    if (Date.parse(plan.expiresAt) <= Date.now()) throw error('confirmation_required', 410);
    if (String(plan.actionVersion) !== String(action.actionVersion)) throw error('version_conflict', 409);
    if (digest(input) !== plan.inputDigest) throw error('invalid_request', 422);
    if (plan.riskLevel !== actionRisk(action, input)) throw error('version_conflict', 409);
    this.validateInput(action, input);
    const permissions = await this.checkActionPermissions(action, subjectId, requestId, input);
    if (permissions.some((decision) => decision.decision !== 'allow')) throw error('permission_denied', 403);
    if (plan.confirmationRequired && !confirmed) throw error('confirmation_required', 428);
    const created = await this.repository.createRunForPlan({ runId: randomUUID(), planId, actionId, actionVersion: String(action.actionVersion), inputDigest: plan.inputDigest, input, subjectId, requestId: requestId ?? randomUUID(), timeoutAt: new Date(Date.now() + (action.timeout ?? 30000)).toISOString(), state: 'queued', handlerCalls: 0 }, { audit: this.audit });
    const run = created.run;
    if (!run) throw error('version_conflict', 409);
    if (!created.created) {
      if (run.planId !== planId || run.actionId !== actionId || run.inputDigest !== plan.inputDigest) throw error('version_conflict', 409);
      return this.publicRun(run);
    }
    if (this.autoDispatch) queueMicrotask(() => this.processOne(run.runId).catch(() => {}));
    return this.publicRun(run);
  }
  publicRun(run) { if (!run) return run; const { input, ...visible } = run; return visible; }
  async processOne(runId) {
    const run = runId ? await this.repository.claimRun(runId, this.workerId, this.leaseMs) : await this.repository.claimNext(this.workerId, this.leaseMs);
    if (!run) return undefined;
    if (Date.parse(run.timeoutAt) <= Date.now()) {
      await this.repository.transitionRun(run.runId, ['running'], 'failed', { errorSummary: 'action_timeout' });
      return this.publicRun(await this.repository.getRun(run.runId));
    }
    const action = this.registry.get(run.actionId);
    if (!action || String(action.actionVersion) !== String(run.actionVersion)) {
      await this.repository.transitionRun(run.runId, ['running'], 'failed', { errorSummary: 'action_version_unavailable' });
      return this.publicRun(await this.repository.getRun(run.runId));
    }
    const handler = this.handlers.get(action.actionId);
    if (!handler) {
      await this.repository.transitionRun(run.runId, ['running'], 'failed', { errorSummary: 'action_handler_unavailable' });
      return this.publicRun(await this.repository.getRun(run.runId));
    }
    const controller = new AbortController(); this.controllers.set(run.runId, controller);
    const monitor = setInterval(async () => {
      try {
        const current = await this.repository.heartbeatRun(run.runId, this.workerId, this.leaseMs);
        if (!current) controller.abort('lease_lost');
        else if (current.state === 'cancel_requested') controller.abort('cancel_requested');
      } catch { controller.abort('lease_lost'); }
    }, Math.max(50, Math.min(1000, Math.floor(this.leaseMs / 3))));
    let timeout;
    const deadline = new Promise((_, reject) => { timeout = setTimeout(() => { controller.abort('action_timeout'); reject(error('action_timeout', 504)); }, Math.max(1, Date.parse(run.timeoutAt) - Date.now())); });
    try {
      const permissions = await this.checkActionPermissions(action, run.subjectId, run.requestId, run.input);
      if (permissions.some((decision) => decision.decision !== 'allow')) throw error('permission_denied', 403);
      const current = await this.repository.getRun(run.runId);
      if (current.state === 'cancel_requested') controller.abort('cancel_requested');
      if (controller.signal.aborted) throw error(String(controller.signal.reason), 409);
      const result = await Promise.race([handler(run.input ?? {}, { runId: run.runId, subjectId: run.subjectId, requestId: run.requestId, signal: controller.signal }), deadline]);
      const latest = await this.repository.getRun(run.runId);
      if (latest.state === 'cancel_requested') {
        // A completed handler may already have committed a side effect. Keep the uncertainty visible.
        await this.repository.transitionRun(run.runId, ['cancel_requested'], 'failed', { errorSummary: 'cancel_outcome_unknown' });
      } else if (controller.signal.aborted) await this.repository.transitionRun(run.runId, ['running'], 'failed', { errorSummary: String(controller.signal.reason) });
      else await this.repository.transitionRun(run.runId, ['running'], 'succeeded', { resultSummary: this.projectResult(action, result) });
    } catch (cause) {
      const latest = await this.repository.getRun(run.runId);
      const cancellationConfirmed = latest?.state === 'cancel_requested' && controller.signal.reason === 'cancel_requested' && cause?.name === 'AbortError';
      const reason = cancellationConfirmed ? 'cancelled' : controller.signal.reason === 'action_timeout' ? 'outcome_unknown' : ['permission_denied', 'version_conflict', 'invalid_request'].includes(cause?.message) ? cause.message : latest?.state === 'cancel_requested' ? 'cancel_outcome_unknown' : 'handler_failed';
      await this.repository.transitionRun(run.runId, ['running', 'cancel_requested'], cancellationConfirmed ? 'cancelled' : 'failed', cancellationConfirmed ? {} : { errorSummary: reason });
    } finally {
      clearInterval(monitor); clearTimeout(timeout); this.controllers.delete(run.runId);
      await this.audit?.record({ requestId: run.requestId, actorId: run.subjectId, action: 'action.run.terminal', targetType: 'action_run', targetId: run.runId, summary: { state: (await this.repository.getRun(run.runId))?.state } });
    }
    return this.publicRun(await this.repository.getRun(run.runId));
  }
  projectResult(action, result) {
    if (action.actionId.startsWith('system.navigate.')) {
      const target = action.actionId.slice('system.navigate.'.length);
      return { ok: true, navigation: { target } };
    }
    return { ok: result?.ok ?? true };
  }
  async reclaim() { const changed = await this.repository.reclaimRuns?.() ?? []; for (const run of changed) await this.audit?.record({ requestId: run.requestId, actorId: run.subjectId, action: 'action.run.recovered', targetType: 'action_run', targetId: run.runId, summary: { state: run.state, reason: run.errorSummary } }); return changed.map((run) => this.publicRun(run)); }
  async get(runId, subjectId) { const run = await this.repository.getRun(runId); if (!run || run.subjectId !== subjectId) throw error('action_run_not_found', 404); return this.publicRun(run); }
  async cancel(runId, subjectId, requestId) {
    const run = await this.get(runId, subjectId); if (terminal.has(run.state)) return run;
    const queued = await this.repository.transitionRun(runId, ['queued'], 'cancelled', { cancelRequestId: requestId });
    if (queued) return this.publicRun(queued);
    const pending = await this.repository.transitionRun(runId, ['running'], 'cancel_requested', { cancelRequestId: requestId });
    this.controllers.get(runId)?.abort('cancel_requested');
    return this.publicRun(pending ?? await this.repository.getRun(runId));
  }
}
