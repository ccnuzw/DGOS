import { apiVersion } from '@dgos/sdk';
export { AiTaskWorker } from './ai-task-worker.mjs';

export function workerConfig(env = process.env) {
  return {
    workerId: env.DGOS_WORKER_ID,
    leaseMs: Number(env.DGOS_AI_TASK_LEASE_MS ?? 15_000),
    heartbeatMs: Number(env.DGOS_AI_TASK_HEARTBEAT_MS ?? 5_000),
    pollIntervalMs: Number(env.DGOS_AI_TASK_POLL_MS ?? 1_000),
    idleBackoffMs: Number(env.DGOS_AI_TASK_IDLE_BACKOFF_MS ?? 5_000),
    errorBackoffMs: Number(env.DGOS_AI_TASK_ERROR_BACKOFF_MS ?? 2_000),
  };
}

export function createWorkerInfo() {
  return { service: 'dgos-worker', apiVersion, status: 'idle', capabilities: ['provider.connection_test', 'ai_task.claim', 'ai_task.recovery'] };
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  console.log(JSON.stringify({ ...createWorkerInfo(), workerId: workerConfig().workerId ?? 'generated', config: workerConfig() }));
}
