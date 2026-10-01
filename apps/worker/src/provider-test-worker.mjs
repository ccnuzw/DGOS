import { randomUUID } from 'node:crypto';

const REASON_CODES = new Set(['endpoint_invalid', 'policy_blocked', 'authentication_failed', 'rate_limited', 'protocol_mismatch', 'upstream_unavailable']);

export class ProviderTestWorker {
  constructor({ repository, secretService, egress, adapters, workerId = randomUUID(), leaseMs = 15_000, timeoutMs = 12_000, clock = () => Date.now() }) { Object.assign(this, { repository, secretService, egress, adapters, workerId, leaseMs, timeoutMs, clock }); }
  async runOnce() {
    const test = await this.repository.claimConnectionTest(this.workerId, this.leaseMs);
    if (!test) return undefined;
    const account = await this.repository.getAccount(test.accountId);
    if (!account) return this.repository.finishConnectionTest(test.testId, 'failed', 'upstream_unavailable', 0, this.workerId);
    const started = this.clock();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const handle = await this.secretService.resolve({ secretRef: account._secretRef, purpose: 'provider-account', subjectId: account.ownerId });
      await this.adapters[account.protocolType].probe({ account, credential: await handle.read(), egress: this.egress, signal: controller.signal });
      const finished = await (this.repository.finishConnectionTestWithAudit ? this.repository.finishConnectionTestWithAudit(test.testId, 'succeeded', undefined, this.clock() - started, this.workerId, (value) => ({ requestId: test.requestId, action: 'provider.connection_test.finish', targetType: 'connection_test', targetId: test.testId, result: 'succeeded', summary: { status: value.status } })) : this.repository.finishConnectionTest(test.testId, 'succeeded', undefined, this.clock() - started, this.workerId));
      return finished;
    } catch (error) {
      const reasonCode = error.name === 'AbortError' ? 'upstream_unavailable' : (REASON_CODES.has(error.errorKey ?? error.message) ? error.errorKey ?? error.message : 'upstream_unavailable');
      const finished = await (this.repository.finishConnectionTestWithAudit ? this.repository.finishConnectionTestWithAudit(test.testId, 'failed', reasonCode, this.clock() - started, this.workerId, (value) => ({ requestId: test.requestId, action: 'provider.connection_test.finish', targetType: 'connection_test', targetId: test.testId, result: 'failed', summary: { status: value.status, reasonCode } })) : this.repository.finishConnectionTest(test.testId, 'failed', reasonCode, this.clock() - started, this.workerId));
      return finished;
    } finally { clearTimeout(timeout); }
  }
  async runUntilEmpty() { const results = []; while (true) { const result = await this.runOnce(); if (!result) return results; results.push(result); } }
}
