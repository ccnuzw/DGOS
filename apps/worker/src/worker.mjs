import { apiVersion } from '@dgos/sdk';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { PostgresAiTaskRepository } from '../../../src/ai-task/repository.mjs';
import { AiTaskService } from '../../../src/ai-task/service.mjs';
import { PostgresProviderConfigRepository } from '../../../src/provider-config/repository.mjs';
import { PostgresProviderRepository } from '../../../src/provider/repository.mjs';
import { PostgresAuditRepository } from '../../../src/audit/outbox.mjs';
import { PostgresQuotaRepository } from '../../../src/quota/repository.mjs';
import { QuotaService, createQuotaAdapter } from '../../../src/quota/service.mjs';
import { RedisSecretService } from '../../../src/security/secret-service.mjs';
import { createClient } from 'redis';
import { createRuntimeEgress } from '../../../src/security/runtime-egress.mjs';
import { ProtocolAdapterRegistry } from '../../../src/provider-adapters/registry.mjs';
import { createOpenAiCompatibleAdapter } from '../../../src/provider-adapters/openai-compatible.mjs';
import { AiTaskWorker } from './ai-task-worker.mjs';
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
  return { service: 'dgos-worker', apiVersion, status: 'idle', capabilities: ['ai_task.claim', 'ai_task.recovery'] };
}

export function validateWorkerEnvironment(env = process.env) {
  if (!env.DGOS_DATABASE_URL) throw new Error('worker_configuration_invalid: DGOS_DATABASE_URL is required');
  const config = workerConfig(env);
  for (const [name, value] of Object.entries(config)) {
    if (name !== 'workerId' && (!Number.isFinite(value) || value <= 0)) throw new Error(`worker_configuration_invalid: ${name}`);
  }
  return config;
}

export function createPostgresWorker({ pool, env = process.env, secretService } = {}) {
  const config = validateWorkerEnvironment(env);
  if (!secretService) throw new Error('worker_configuration_invalid: shared secret service is required');
  const egress = createRuntimeEgress(env);
  const databasePool = pool ?? new pg.Pool({ connectionString: env.DGOS_DATABASE_URL, max: Number(env.DGOS_WORKER_POOL_MAX ?? 10) });
  const repository = new PostgresAiTaskRepository(databasePool);
  const audit = new PostgresAuditRepository(databasePool);
  const quota = createQuotaAdapter(new QuotaService({ repository: new PostgresQuotaRepository(databasePool, { audit }), audit }));
  const providerRepository = new PostgresProviderRepository(databasePool);
  const configRepository = new PostgresProviderConfigRepository(databasePool);
  const credentials = secretService;
  const registry = new ProtocolAdapterRegistry([createOpenAiCompatibleAdapter()]);
  const taskService = new AiTaskService({ repository, configService: { repository: configRepository }, accountRepository: providerRepository, secretService: credentials, registry, egress, quota, audit });
  const worker = new AiTaskWorker({ repository, taskService, workerId: config.workerId ?? randomUUID(), leaseMs: config.leaseMs, heartbeatMs: config.heartbeatMs, pollIntervalMs: config.pollIntervalMs, idleBackoffMs: config.idleBackoffMs, errorBackoffMs: config.errorBackoffMs });
  return { pool: databasePool, repository, taskService, worker, config };
}

export async function startWorkerProcess({ env = process.env, secretService } = {}) {
  validateWorkerEnvironment(env);
  if (!secretService && !env.REDIS_URL) throw new Error('worker_configuration_invalid: REDIS_URL is required');
  const redis = !secretService ? createClient({ url: env.REDIS_URL }) : null;
  let runtime;
  try {
    if (redis) await redis.connect();
    runtime = createPostgresWorker({ env, secretService: secretService ?? new RedisSecretService(redis) });
    await runtime.pool.query('SELECT 1');
  } catch (error) {
    await runtime?.pool.end();
    if (redis?.isOpen) await redis.quit();
    throw error;
  }
  let stopping;
  const stop = async () => { if (!stopping) stopping = runtime.worker.stop().then(async () => { await runtime.pool.end(); if (redis) await redis.quit(); }); return stopping; };
  const onSignal = () => { stop().then(() => process.exit(0), () => process.exit(1)); };
  process.once('SIGINT', onSignal); process.once('SIGTERM', onSignal);
  runtime.worker.start();
  console.log(JSON.stringify({ service: 'dgos-worker', status: 'ready', workerId: runtime.worker.workerId }));
  return { ...runtime, stop };
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  startWorkerProcess().catch((error) => { console.error(JSON.stringify({ ...createWorkerInfo(), status: 'failed', error: error.message })); process.exitCode = 1; });
}
