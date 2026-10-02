import { randomUUID } from 'node:crypto';

const REASON_CODES = new Set(['endpoint_invalid', 'policy_blocked', 'authentication_failed', 'rate_limited', 'protocol_mismatch', 'upstream_unavailable', 'network_unreachable', 'tls_invalid', 'credential_unavailable']);

export class ProviderTestWorker {
  constructor({ repository, configRepository, secretService, egress, adapters, workerId = randomUUID(), leaseMs = 15_000, timeoutMs = 12_000, clock = () => Date.now() }) { if (typeof egress?.validateTarget !== 'function') throw new TypeError('ProviderEgress.validateTarget required'); Object.assign(this, { repository, configRepository, secretService, egress, adapters, workerId, leaseMs, timeoutMs, clock }); }
  async runOnce() {
    const test = await this.repository.claimConnectionTest(this.workerId, this.leaseMs);
    if (!test) return undefined;
    const started = this.clock();
    const controller = new AbortController();
    let timedOut = false; let leaseLost = false; let cancelled = false;
    let heartbeatBusy = false;
    const finish = (state, reasonCode) => {
      const duration = this.clock() - started;
      const audit = (value) => ({ requestId: test.requestId, action: 'provider.connection_test.finish', targetType: 'connection_test', targetId: test.testId, result: state, summary: { status: value.status, ...(reasonCode ? { reasonCode } : {}) } });
      return this.repository.finishConnectionTestWithAudit
        ? this.repository.finishConnectionTestWithAudit(test.testId, state, reasonCode, duration, this.workerId, audit)
        : this.repository.finishConnectionTest(test.testId, state, reasonCode, duration, this.workerId);
    };
    if (test.status === 'cancel_requested') return finish('cancelled');
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, this.timeoutMs);
    const heartbeat = setInterval(async () => {
      if (heartbeatBusy || controller.signal.aborted) return;
      heartbeatBusy = true;
      try {
        const current = await this.repository.getConnectionTest(test.testId);
        if (current?.status === 'cancel_requested') { cancelled = true; controller.abort(); return; }
        if (!await this.repository.renewConnectionTestLease(test.testId, this.workerId, this.leaseMs)) { leaseLost = true; controller.abort(); }
      } catch { leaseLost = true; controller.abort(); }
      finally { heartbeatBusy = false; }
    }, Math.max(10, Math.min(250, Math.floor(this.leaseMs / 3))));
    try {
      const probe = async () => {
        const active = () => { if (controller.signal.aborted) throw Object.assign(new Error('cancelled'), { errorKey: 'cancelled' }); };
        const account = await this.repository.getAccount(test.accountId);
        active();
        if (!account || !['ready','credential_pending'].includes(account.status) || account.version !== test.accountVersion) throw Object.assign(new Error('credential_unavailable'), { errorKey: 'credential_unavailable' });
        if (test.providerConfigId) { const config = await this.configRepository?.get(test.providerConfigId); active(); if (!config || config.providerAccountId !== account.accountId || config.ownerId !== account.ownerId || config.version !== test.configVersion || config.protocolType !== account.protocolType) throw Object.assign(new Error('protocol_mismatch'), { errorKey: 'protocol_mismatch' }); }
        const adapter = this.adapters[account.protocolType];
        if (!adapter || adapter.protocolVersion && adapter.protocolVersion !== test.protocolVersion) throw Object.assign(new Error('protocol_mismatch'), { errorKey: 'protocol_mismatch' });
        await this.egress.validateTarget(account.scope?.endpoint);
        active();
        const handle = await this.secretService.resolve({ secretRef: account._secretRef, purpose: 'provider-account', subjectId: account.ownerId });
        active();
        const credential = await handle.read();
        active();
        await adapter.probe({ account, credential, egress: this.egress, signal: controller.signal, timeoutMs: this.timeoutMs });
      };
      await new Promise((resolve, reject) => {
        const abort = () => reject(Object.assign(new Error('cancelled'), { errorKey: 'cancelled' }));
        controller.signal.addEventListener('abort', abort, { once: true });
        if (controller.signal.aborted) abort();
        Promise.resolve().then(probe).then(resolve, reject).finally(() => controller.signal.removeEventListener('abort', abort));
      });
      if (leaseLost) return undefined;
      if (controller.signal.aborted || cancelled || (await this.repository.getConnectionTest(test.testId))?.status === 'cancel_requested') return finish(cancelled ? 'cancelled' : timedOut ? 'timed_out' : 'cancelled');
      return finish('succeeded');
    } catch (error) {
      if (leaseLost) return undefined;
      const state = cancelled || (await this.repository.getConnectionTest(test.testId))?.status === 'cancel_requested' ? 'cancelled' : timedOut ? 'timed_out' : 'failed';
      const reasonCode = state === 'failed' ? (REASON_CODES.has(error.errorKey ?? error.message) ? error.errorKey ?? error.message : 'upstream_unavailable') : undefined;
      return finish(state, reasonCode);
    } finally { clearTimeout(timeout); clearInterval(heartbeat); }
  }
  async runUntilEmpty() { const results = []; while (true) { const result = await this.runOnce(); if (!result) return results; results.push(result); } }
}
