import { randomUUID } from 'node:crypto';

export class AiTaskWorker {
  constructor({ repository, taskService, workerId = randomUUID(), leaseMs = 15_000 }) { Object.assign(this, { repository, taskService, workerId, leaseMs }); }

  async runOnce() {
    const attempt = await this.repository.claimAttempt(this.workerId, this.leaseMs);
    if (!attempt) return undefined;
    const task = await this.repository.getTask(attempt.taskId);
    if (!task || ['succeeded', 'failed', 'cancelled', 'timed_out'].includes(task.status)) {
      await this.repository.finishAttempt(attempt.attemptId, task?.status === 'cancelled' ? 'cancelled' : 'failed', { errorClass: 'task_unavailable' }, this.workerId);
      return attempt;
    }
    try {
      await this.taskService.run(task.taskId, task.inputText ?? '', task.ownerId, { attempt, workerId: this.workerId });
    } catch {
      // AiTaskService owns terminal state and quota finalization.
    }
    return this.repository.getTask(task.taskId);
  }
}
