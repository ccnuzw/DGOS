import { createHash } from 'node:crypto';
const digest = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const safe = (task) => ({ taskId: task.taskId, status: task.status, text: task.text || undefined, artifactIds: task.artifactIds ?? [], error: task.error });
export class AiTaskService {
  constructor({ repository, configService, accountRepository, secretService, registry, egress, quota, audit, providerRunner }) { Object.assign(this, { repository, configService, accountRepository, secretService, registry, egress, quota, audit, providerRunner }); this.controllers = new Map(); }
  async submit({ ownerId, requestId, target, intent, input, options = {} }) { if (intent !== 'text.chat' || typeof input?.text !== 'string') throw Object.assign(new Error('invalid_request'), { statusCode: 422 }); const inputDigest = digest({ target, intent, input, options }); const prior = await this.repository.findByRequest(ownerId, requestId, inputDigest); if (prior) return { taskId: prior.taskId, requestId, status: prior.status }; const resolved = options.providerConfigId ? await this.configService.repository.get(options.providerConfigId) : null; if (!resolved || resolved.ownerId !== ownerId) throw Object.assign(new Error('provider_config_not_found'), { statusCode: 404 }); const policies = await this.configService.repository.listPolicies(resolved.providerConfigId); const policy = policies.find((p) => p.modelId === options.modelId && p.enabled && p.assignedCapabilities.includes('text')); if (!policy) throw Object.assign(new Error('model_not_allowed'), { statusCode: 422 }); const task = await this.repository.createTask({ ownerId, requestId, target, intent, modelId: options.modelId, providerConfigId: resolved.providerConfigId, inputDigest, inputText: input.text }); try { if (this.quota?.preflight) await this.quota.preflight({ subjectId: ownerId, taskId: task.taskId, intent, metric: 'requests', amount: 1, requestId }); } catch (error) { await this.repository.transition(task.taskId, 'failed', { error: { errorKey: error.errorKey ?? error.message ?? 'quota_exceeded' } }); throw error; } const account = await this.accountRepository.getAccount(resolved.providerAccountId); if (!account) { await this.repository.transition(task.taskId, 'failed', { error: { errorKey: 'provider_account_not_found' } }); throw Object.assign(new Error('provider_account_not_found'), { statusCode: 404 }); } await this.repository.createAttempt({ taskId: task.taskId, providerConfigId: resolved.providerConfigId, providerAccountId: account.accountId, modelId: options.modelId }); await this.repository.event(task.taskId, 'task.accepted', {}); await this.audit?.record({ requestId, actorId: ownerId, action: 'ai.task.submit', targetType: 'ai_task', targetId: task.taskId, summary: { taskId: task.taskId, modelId: options.modelId, inputDigest } }); return { taskId: task.taskId, requestId, status: 'queued', descriptorVersion: resolved.descriptorVersion }; }
  async run(taskId, text, ownerId, options = {}) {
    const task = await this.repository.getTask(taskId);
    if (!task || ['cancelled', 'cancel_requested'].includes(task.status)) return;
    let attempt;
    let reservationId;
    let providerStarted = false;
    let finalized = false;
    const assertLease = () => { if (options.attempt && options.isLeaseValid && !options.isLeaseValid()) throw Object.assign(new Error('lease_lost'), { errorKey: 'lease_lost' }); };
    const finalizeQuota = async ({ terminalState, usageStatus = 'unavailable', estimated = false, release = false, usage }) => {
      if (finalized || !reservationId || !this.quota) return;
      finalized = true;
      const input = { requestId: task.requestId, reservationId, taskId, attemptId: attempt.attemptId, terminalState, metric: 'requests', amount: 1, unit: 'count', usageStatus, estimated, operation: 'ai.task', release, inputTokens: usage?.inputTokens ?? null, outputTokens: usage?.outputTokens ?? null, totalTokens: usage?.totalTokens ?? null, estimatedCost: usage?.estimatedCost ?? null, sourceDigest: usage?.sourceDigest ?? null };
      if (release && this.quota.release) return this.quota.release(input);
      return this.quota.settle(input);
    };
    try {
      const config = await this.configService.repository.get(task.providerConfigId);
      if (!config) throw Object.assign(new Error('provider_config_not_found'), { errorKey: 'provider_config_not_found' });
      const account = await this.accountRepository.getAccount(config.providerAccountId);
      if (!account) throw Object.assign(new Error('provider_account_not_found'), { errorKey: 'provider_account_not_found' });
      const adapter = this.registry.get(config.protocolType);
      if (!adapter) throw Object.assign(new Error('protocol_unavailable'), { errorKey: 'protocol_unavailable' });
      const handle = await this.secretService.resolve({ secretRef: account._secretRef, purpose: 'provider-account', subjectId: ownerId });
      const credential = await handle.read();
      attempt = options.attempt ?? await this.repository.createAttempt({ taskId, providerConfigId: config.providerConfigId, providerAccountId: account.accountId, modelId: task.modelId });
      assertLease();
      if (this.quota?.reserve) {
        const reservation = await this.quota.reserve({ requestId: task.requestId, subjectId: ownerId, taskId, attemptId: attempt.attemptId, scopeType: 'subject', scopeId: ownerId, providerAccountId: account.accountId, providerConfigId: config.providerConfigId, modelRef: task.modelId, metric: 'requests', amount: 1 });
        reservationId = reservation.reservationId ?? reservation.reservationRef;
        if (options.workerId && this.repository.updateAttemptOwned) await this.repository.updateAttemptOwned(attempt.attemptId, options.workerId, { quotaReservationRef: reservationId }); else await this.repository.updateAttempt(attempt.attemptId, { quotaReservationRef: reservationId });
      }
      if (!options.attempt) await this.repository.updateAttempt(attempt.attemptId, { state: 'running', startedAt: new Date() });
      await this.repository.transition(taskId, 'running');
      await this.repository.event(taskId, 'task.progress', { status: 'running' });
      let output = '';
      let providerUsage;
      const controller = new AbortController();
      this.controllers.set(taskId, controller);
      const iterator = this.providerRunner ? this.providerRunner({ task, config, account, adapter, credential, egress: this.egress, signal: controller.signal }) : adapter.streamText({ config, credential, egress: this.egress, modelId: task.modelId, input: text, signal: controller.signal });
      providerStarted = true;
      for await (const chunk of iterator) {
        const delta = typeof chunk === 'string' ? chunk : chunk?.delta;
        if (chunk && typeof chunk === 'object' && chunk.usage && chunk.usage.trusted === true) providerUsage = chunk.usage;
        if (typeof delta !== 'string') continue;
        const current = await this.repository.getTask(taskId);
        assertLease();
        if (current.status === 'cancel_requested' || current.status === 'cancelled') {
          await this.repository.updateAttempt(attempt.attemptId, { state: 'cancelled', completedAt: new Date() });
          await finalizeQuota({ terminalState: 'cancelled', release: false });
          await this.repository.transition(taskId, 'cancelled');
          await this.repository.event(taskId, 'task.cancelled', {});
          return;
        }
        output += delta;
        await this.repository.transition(taskId, 'running', { text: output });
        await this.repository.event(taskId, 'text.delta', { delta });
      }
      assertLease();
      const artifact = await this.repository.createArtifact({ taskId, ownerId, mimeType: 'text/plain', content: output });
      await this.repository.transition(taskId, 'succeeded', { text: output, artifactIds: [artifact.artifactId] });
      const finished = options.workerId ? await this.repository.finishAttempt(attempt.attemptId, 'succeeded', {}, options.workerId) : await this.repository.updateAttempt(attempt.attemptId, { state: 'succeeded', completedAt: new Date() });
      if (options.workerId && !finished) throw Object.assign(new Error('lease_lost'), { errorKey: 'lease_lost' });
      await finalizeQuota({ terminalState: 'completed', usageStatus: providerUsage ? 'final' : 'unavailable', usage: providerUsage });
      await this.repository.event(taskId, 'task.completed', { snapshot: safe({ ...(await this.repository.getTask(taskId)), artifactIds: [artifact.artifactId] }) });
      await this.audit?.record({ requestId: task.requestId, actorId: ownerId, action: 'ai.task.complete', targetType: 'ai_task', targetId: taskId, summary: { taskId, attemptId: attempt.attemptId } });
    } catch (error) {
      const key = error.errorKey ?? 'upstream_unavailable';
      const terminalState = key === 'timed_out' ? 'timed_out' : key === 'cancelled' ? 'cancelled' : 'failed';
      if (attempt && key !== 'lease_lost') { const finished = options.workerId ? await this.repository.finishAttempt(attempt.attemptId, terminalState, { errorClass: key }, options.workerId) : await this.repository.updateAttempt(attempt.attemptId, { state: terminalState, errorClass: key, completedAt: new Date() }); if (options.workerId && !finished) return; }
      if (key === 'lease_lost') return;
      if (attempt) await finalizeQuota({ terminalState, usageStatus: providerStarted ? 'unavailable' : 'unavailable', estimated: terminalState === 'timed_out' && providerStarted, release: terminalState === 'cancelled' || !providerStarted });
      if (terminalState === 'cancelled') { await this.repository.transition(taskId, 'cancelled'); await this.repository.event(taskId, 'task.cancelled', {}); }
      else { await this.repository.transition(taskId, terminalState, { error: { errorKey: key } }); await this.repository.event(taskId, 'task.failed', { snapshot: safe({ ...(await this.repository.getTask(taskId)), error: { errorKey: key } }) }); }
      await this.audit?.record({ requestId: task.requestId, actorId: ownerId, action: 'ai.task.fail', targetType: 'ai_task', targetId: taskId, result: 'failed', summary: { taskId, errorClass: key, quotaFinalized: Boolean(reservationId) } });
    } finally { this.controllers.delete(taskId); }
  }
  async get(taskId, ownerId) { const task = await this.repository.getTask(taskId); if (!task || task.ownerId !== ownerId) throw Object.assign(new Error('task_not_found'), { statusCode: 404 }); return safe(task); }
  async events(taskId, ownerId, after) { await this.get(taskId, ownerId); return this.repository.listEvents(taskId, after); }
  async cancel(taskId, ownerId, requestId) { const task = await this.repository.getTask(taskId); if (!task || task.ownerId !== ownerId) throw Object.assign(new Error('task_not_found'), { statusCode: 404 }); if (['succeeded', 'failed', 'cancelled', 'timed_out'].includes(task.status)) return safe(task); if (task.status === 'accepted' || task.status === 'queued') { await this.repository.transition(taskId, 'cancelled'); await this.repository.event(taskId, 'task.cancelled', {}); return safe(await this.repository.getTask(taskId)); } await this.repository.transition(taskId, 'cancel_requested'); this.controllers.get(taskId)?.abort(); await this.repository.event(taskId, 'task.progress', { status: 'cancel_requested' }); return safe(await this.repository.getTask(taskId)); }
  async artifact(id, ownerId) { const artifact = await this.repository.getArtifact(id); if (!artifact || artifact.ownerId !== ownerId) throw Object.assign(new Error('artifact_not_found'), { statusCode: 404 }); return { artifactId: artifact.artifactId, mimeType: artifact.mimeType, content: artifact.content }; }
}
