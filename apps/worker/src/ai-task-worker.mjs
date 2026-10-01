import { randomUUID } from 'node:crypto';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class AiTaskWorker {
  constructor({ repository, taskService, workerId = randomUUID(), leaseMs = 15_000, heartbeatMs = Math.max(1_000, Math.floor(leaseMs / 3)), pollIntervalMs = 1_000, idleBackoffMs = 5_000, errorBackoffMs = 2_000 }) { Object.assign(this, { repository, taskService, workerId, leaseMs, heartbeatMs, pollIntervalMs, idleBackoffMs, errorBackoffMs }); this.running = false; this.loopPromise = undefined; }

  async runOnce() {
    const attempt = await this.repository.claimAttempt(this.workerId, this.leaseMs);
    if (!attempt) return undefined;
    const task = await this.repository.getTask(attempt.taskId);
    if (!task || ['succeeded', 'failed', 'cancelled', 'timed_out'].includes(task.status)) {
      await this.repository.finishAttempt(attempt.attemptId, task?.status === 'cancelled' ? 'cancelled' : 'failed', { errorClass: 'task_unavailable' }, this.workerId);
      return attempt;
    }
    let leaseLost = false;
    const heartbeat = setInterval(async () => { try { if (!await this.repository.renewAttemptLease(attempt.attemptId, this.workerId, this.leaseMs)) leaseLost = true; } catch { leaseLost = true; } }, this.heartbeatMs);
    heartbeat.unref?.();
    try {
      await this.taskService.run(task.taskId, task.inputText ?? '', task.ownerId, { attempt, workerId: this.workerId, isLeaseValid: () => !leaseLost });
    } catch {
      // AiTaskService owns terminal state and quota finalization.
    } finally { clearInterval(heartbeat); }
    return this.repository.getTask(task.taskId);
  }

  start() { if (this.running) return this.loopPromise; this.running = true; this.loopPromise = this.#loop(); return this.loopPromise; }
  async #loop() { while (this.running) { try { const result = await this.runOnce(); if (!this.running) break; await sleep(result ? this.pollIntervalMs : this.idleBackoffMs); } catch { if (!this.running) break; await sleep(this.errorBackoffMs); } } }
  async stop() { this.running = false; await this.loopPromise; this.loopPromise = undefined; }
}
