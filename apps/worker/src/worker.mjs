import { apiVersion } from '@dgos/sdk';
export { AiTaskWorker } from './ai-task-worker.mjs';

export function createWorkerInfo() {
  return { service: 'dgos-worker', apiVersion, status: 'idle', capabilities: ['provider.connection_test', 'ai_task.claim', 'ai_task.recovery'] };
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  console.log(JSON.stringify(createWorkerInfo()));
}
