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
import { createNetworkRouteFactory } from '../../../src/security/network-route.mjs';
import { createSystemProxyProvider } from '../../../src/security/system-proxy.mjs';
import { PostgresProxyProvisioning } from '../../../src/security/proxy-provisioning.mjs';
import { ProtocolAdapterRegistry } from '../../../src/provider-adapters/registry.mjs';
import { createOpenAiCompatibleAdapter } from '../../../src/provider-adapters/openai-compatible.mjs';
import { AiTaskWorker } from './ai-task-worker.mjs';
import { createActionRuntime } from '../../../src/actions/runtime.mjs';
import { createTaskAdmission } from '../../../src/provider-config/task-admission.mjs';
import { ProviderTestWorker } from './provider-test-worker.mjs';
import { runProviderTestLoop } from './provider-test-loop.mjs';
import { ProviderService, createOpenAiCompatibleAdapter as createProbeAdapter } from '../../api/src/provider-service.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import { ExtensionService } from '../../../src/extensions/service.mjs';
import { PostgresExtensionRepository } from '../../../src/extensions/repository.mjs';
import { ExtensionRunDaemon } from '../../extension-runner/src/daemon.mjs';
import { loadExtensionRuntime } from '../../../src/extensions/runtime.mjs';
import { PostgresPackageRepository } from '../../../src/apps/postgres-package-repository.mjs';
import { PostgresTextProfileDirectory } from '../../../src/provider-config/text-profile-directory.mjs';
import { PostgresExtensionManagementRepository } from '../../../src/extensions/management-repository.mjs';
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

export function createPostgresWorker({ pool, env = process.env, secretService, networkOptions = {} } = {}) {
  const config = validateWorkerEnvironment(env);
  if (!secretService) throw new Error('worker_configuration_invalid: shared secret service is required');
  const egress = networkOptions.route ?? createNetworkRouteFactory({ egress: createRuntimeEgress(env), secretService, systemProxyProvider: networkOptions.systemProxyProvider ?? createSystemProxyProvider({ env, secretService }), proxyLookup: networkOptions.proxyLookup, ca: networkOptions.ca, proxyCa: networkOptions.proxyCa, allowLocalFixture: networkOptions.allowLocalFixture, fixtureLookup: networkOptions.fixtureLookup, fixtureCa: networkOptions.ca });
  egress.requireLease?.();
  const databasePool = pool ?? new pg.Pool({ connectionString: env.DGOS_DATABASE_URL, max: Number(env.DGOS_WORKER_POOL_MAX ?? 10) });
  if (!pool) databasePool.on('error', () => console.error(JSON.stringify({ service: 'dgos-worker', error: 'database_connection_unavailable' })));
  const repository = new PostgresAiTaskRepository(databasePool);
  const audit = new PostgresAuditRepository(databasePool);
  const quota = createQuotaAdapter(new QuotaService({ repository: new PostgresQuotaRepository(databasePool, { audit }), audit }));
  const providerRepository = new PostgresProviderRepository(databasePool);
  const configRepository = new PostgresProviderConfigRepository(databasePool);
  const credentials = secretService;
  const profileDirectory = new PostgresTextProfileDirectory(databasePool, audit);
  const registry = new ProtocolAdapterRegistry([createOpenAiCompatibleAdapter({ profileDirectory })]);
  const taskService = new AiTaskService({ repository, configService: { repository: configRepository }, accountRepository: providerRepository, secretService: credentials, registry, egress, quota, audit, admission: createTaskAdmission({ configRepository, accountRepository: providerRepository, registry, profileDirectory }) });
  const worker = new AiTaskWorker({ repository, taskService, workerId: config.workerId ?? randomUUID(), leaseMs: config.leaseMs, heartbeatMs: config.heartbeatMs, pollIntervalMs: config.pollIntervalMs, idleBackoffMs: config.idleBackoffMs, errorBackoffMs: config.errorBackoffMs });
  const actionRuntime = createActionRuntime({ pool: databasePool, audit, workerId: `${worker.workerId}:actions`, autoDispatch: false });
  const proxyProvisioning = new PostgresProxyProvisioning({ pool: databasePool, secretService: credentials });
  actionRuntime.system.networkProxyValidator = async (ref) => { await proxyProvisioning.assertCommittedRef(ref); await egress.validateProxyReference(ref); };
  const providerTestWorker = new ProviderTestWorker({ repository: providerRepository, configRepository, secretService: credentials, egress, adapters: { 'openai-compatible': createProbeAdapter() }, workerId: `${worker.workerId}:connections` });
  const providerService = new ProviderService({ repository: providerRepository, configRepository, secretService: credentials, egress, adapters: { 'openai-compatible': createProbeAdapter() } });
  return { pool: databasePool, repository, taskService, worker, config, actionRuntime, providerTestWorker, providerService, networkRoute: egress };
}

export async function startWorkerProcess({ env = process.env, secretService, networkOptions = {} } = {}) {
  validateWorkerEnvironment(env);
  if (!secretService && !env.REDIS_URL) throw new Error('worker_configuration_invalid: REDIS_URL is required');
  const redis = !secretService ? createClient({ url: env.REDIS_URL }) : null;
  let runtime;
  try {
    if (redis) await redis.connect();
    runtime = createPostgresWorker({ env, secretService: secretService ?? new RedisSecretService(redis), networkOptions });
    await runtime.pool.query('SELECT 1');
    await runtime.actionRuntime.ready;
    await runtime.actionRuntime.system.activateNetworkRoute(runtime.networkRoute, { role: 'worker', instanceId: networkOptions.instanceId ?? runtime.worker.workerId, leaseMs: networkOptions.leaseMs ?? 15_000 });
    if (env.DGOS_EXTENSION_CONFIG_FILE) {
      const options = await loadExtensionRuntime({ configPath: env.DGOS_EXTENSION_CONFIG_FILE, packageRepository: new PostgresPackageRepository(runtime.pool), pool: runtime.pool, audit: new PostgresAuditRepository(runtime.pool), permissions: runtime.actionRuntime.permissions, secretService: secretService ?? new RedisSecretService(redis), networkRoute: runtime.networkRoute, networkFixtureHosts: networkOptions.fixtureHosts });
      runtime.extensions = new ExtensionService({ ...options, repository: new PostgresExtensionRepository(runtime.pool), managementRepository: new PostgresExtensionManagementRepository(runtime.pool, options.audit), aiTasks: runtime.taskService });
      runtime.extensionDaemon = new ExtensionRunDaemon({ service: runtime.extensions, workerId: `${runtime.worker.workerId}:extensions` });
    }
  } catch (error) {
    await runtime?.pool.end();
    if (redis?.isOpen) await redis.quit();
    throw error;
  }
  let stopping;
  const loopController = new AbortController();
  let connectionLoop;
  let maintenanceLoop;
  const networkInstanceId = networkOptions.instanceId ?? runtime.worker.workerId;
  const networkHeartbeat = setInterval(() => runtime.actionRuntime.system.renewNetworkRoute(runtime.networkRoute, { role: 'worker', instanceId: networkInstanceId, leaseMs: networkOptions.leaseMs ?? 15_000 }).catch(() => {}), Math.max(500, Math.floor((networkOptions.leaseMs ?? 15_000) / 3)));
  networkHeartbeat.unref();
  const stop = async () => {
    if (!stopping) {
      loopController.abort();
      clearInterval(networkHeartbeat);
      stopping = Promise.all([runtime.worker.stop(), runtime.actionRuntime.worker.stop(), runtime.extensionDaemon?.stop(), connectionLoop, maintenanceLoop]).then(async () => { await runtime.actionRuntime.system.releaseNetworkRoute(networkInstanceId); await runtime.pool.end(); if (redis) await redis.quit(); });
    }
    return stopping;
  };
  const onSignal = () => { stop().then(() => process.exit(0), () => process.exit(1)); };
  process.once('SIGINT', onSignal); process.once('SIGTERM', onSignal);
  runtime.worker.start();
  runtime.actionRuntime.worker.start();
  runtime.extensionDaemon?.start();
  connectionLoop = runProviderTestLoop({ worker: runtime.providerTestWorker, signal: loopController.signal, onError: () => console.error(JSON.stringify({ service: 'dgos-worker', loop: 'connection-tests', error: 'connection_loop_failed' })) });
  maintenanceLoop = (async () => {
    while (!loopController.signal.aborted) {
      try { await runtime.providerService.reconcileSecretRevocations(); await runtime.actionRuntime.packageLifecycle?.hydrate(); }
      catch { console.error(JSON.stringify({ service: 'dgos-worker', loop: 'secret-revocations', error: 'secret_reconciliation_failed' })); }
      try { await delay(1000, undefined, { signal: loopController.signal }); } catch { break; }
    }
  })();
  console.log(JSON.stringify({ service: 'dgos-worker', status: 'ready', workerId: runtime.worker.workerId }));
  return { ...runtime, stop };
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  startWorkerProcess().catch((error) => { console.error(JSON.stringify({ ...createWorkerInfo(), status: 'failed', error: error.message })); process.exitCode = 1; });
}
