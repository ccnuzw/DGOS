import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { apiVersion } from '@dgos/sdk';
import { InMemorySecretService, RedisSecretService } from '../../../src/security/secret-service.mjs';
import { createRuntimeEgress } from '../../../src/security/runtime-egress.mjs';
import { createNetworkRouteFactory } from '../../../src/security/network-route.mjs';
import { createSystemProxyProvider } from '../../../src/security/system-proxy.mjs';
import { createRequestTransportPolicy } from '../../../src/security/request-transport.mjs';
import { registerProxyProvisioningRoutes } from './proxy-provisioning-routes.mjs';
import { createExtensionCredentialFingerprint } from '../../../src/extensions/credential-fingerprint.mjs';
import { createRateLimiter, createLoginBackoff } from '../../../src/security/rate-limiter.mjs';
import { InMemoryIdentityRepository, PostgresIdentityRepository } from '../../../src/identity/repository.mjs';
import { IdentityService } from './identity-service.mjs';
import { registerIdentityRoutes } from './identity-routes.mjs';
import pg from 'pg';
import { createClient } from 'redis';
import { InMemoryProviderRepository, PostgresProviderRepository } from '../../../src/provider/repository.mjs';
import { ProviderEgress } from '../../../src/security/provider-egress.mjs';
import { ProviderService, createOpenAiCompatibleAdapter } from './provider-service.mjs';
import { PostgresAuditRepository, InMemoryAuditRepository } from '../../../src/audit/outbox.mjs';
import { PostgresRetentionRepository, InMemoryRetentionRepository } from '../../../src/audit/retention.mjs';
import { GovernanceService } from './governance-service.mjs';
import { registerGovernanceRoutes } from './governance-routes.mjs';
import { registerAuditRoutes } from './audit-routes.mjs';
import { requireFreshAdminSession } from './governance-auth.mjs';
import { publicErrorMessages } from './public-errors.mjs';
import { createAppCapabilities } from './app-capabilities.mjs';
import { registerSystemRoutes } from './system-routes.mjs';
import { createSystemPermissionRules } from '../../../src/system/permission-rules.mjs';
let quotaModules;
try { quotaModules = await Promise.all([import('../../../src/quota/repository.mjs'), import('../../../src/quota/service.mjs')]); } catch { quotaModules = null; }
import { registerPackageRoutes } from './package-routes.mjs';
import { packageRuntimeConfig } from '../../../src/apps/runtime-config.mjs';
import { PostgresPackageRetention } from '../../../src/apps/package-retention.mjs';
import { registerExtensionRoutes } from './extension-routes.mjs';
import { ExtensionSourceResolver } from '../../../src/extensions/source-resolver.mjs';
import { IsolatedExtensionRunner } from '../../extension-runner/src/runner.mjs';
import { createDeploymentAppAccess, loadIntoExtensionRuntime } from '../../../src/extensions/runtime.mjs';
import { createActionRuntime } from '../../../src/actions/runtime.mjs';
import { registerActionRoutes } from '../../../src/actions/routes.mjs';
import { registerCandidateRoutes } from '../../../src/actions/candidate-routes.mjs';
import { ProtocolAdapterRegistry } from '../../../src/provider-adapters/registry.mjs';
import { createOpenAiCompatibleAdapter as createConfiguredAdapter } from '../../../src/provider-adapters/openai-compatible.mjs';
import { InMemoryProviderConfigRepository, PostgresProviderConfigRepository } from '../../../src/provider-config/repository.mjs';
import { ProviderConfigService } from '../../../src/provider-config/service.mjs';
import { createTaskAdmission, createModelResolver } from '../../../src/provider-config/task-admission.mjs';
import { InMemoryTextProfileDirectory, PostgresTextProfileDirectory } from '../../../src/provider-config/text-profile-directory.mjs';
import { registerProviderProtocolRoutes } from './provider-protocol-routes.mjs';
import { InMemoryProviderProtocolConfirmations, PostgresProviderProtocolConfirmations } from '../../../src/provider-config/protocol-confirmations.mjs';
import { InMemoryAiTaskRepository, PostgresAiTaskRepository } from '../../../src/ai-task/repository.mjs';
import { AiTaskService } from '../../../src/ai-task/service.mjs';
import { AiTaskWorker } from '../../worker/src/ai-task-worker.mjs';

export function buildServer({ logger = true, repository, providerRepository, providerService, providerConfigRepository, aiTaskRepository, providerRunner, dispatchTask, providerAdapters, providerEgress, networkOptions = {}, transportOptions = {}, quotaAdapter, secretService = new InMemorySecretService(), rateLimiter, loginBackoff, clock, closeDatabasePools = false, packageOptions = {}, extensionOptions = {}, protocolOptions = {}, permissionRepository: injectedPermissionRepository, actionRepository: injectedActionRepository, systemRepository: injectedSystemRepository, actionRegistry: injectedActionRegistry, actionHandlers = {}, auditRepository: injectedAuditRepository, retentionRepository: injectedRetentionRepository } = {}) {
  const pools = [];
  const makePool = () => { const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL }); pool.on('error', () => { if (logger) console.error(JSON.stringify({ service: 'dgos-api', error: 'database_connection_unavailable' })); }); pools.push(pool); return pool; };
  const resolvedRepository = repository ?? (process.env.DGOS_DATABASE_URL ? new PostgresIdentityRepository(makePool()) : new InMemoryIdentityRepository());
  const safeLogger = logger === false ? false : {
    ...(typeof logger === 'object' ? logger : {}),
    redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    serializers: {
      req: (request) => ({ method: request.method, url: String(request.url ?? '').split('?')[0] }),
      res: (reply) => ({ statusCode: reply.statusCode }),
    },
  };
  const transport = createRequestTransportPolicy({ publicOrigin: process.env.DGOS_PUBLIC_ORIGIN, trustedProxyCidrs: process.env.DGOS_TRUSTED_PROXY_CIDRS?.split(',').filter(Boolean) ?? [], nativeLocalOrigin: process.env.DGOS_NATIVE_LOCAL_ORIGIN, ...transportOptions, nodeEnv: process.env.NODE_ENV });
  const app = Fastify({ logger: safeLogger, bodyLimit: 48 * 1024 * 1024, trustProxy: transport.trustProxy });
  const identity = new IdentityService({ repository: resolvedRepository, secretService, clock });
  const baseEgress = providerEgress ?? new ProviderEgress();
  const configuredEgress = networkOptions.route ?? createNetworkRouteFactory({ egress: baseEgress.request ? baseEgress : { ...baseEgress, validateTarget: (url) => baseEgress.validateTarget(url), request: async () => { throw new Error('route_unavailable'); } }, secretService, systemProxyProvider: networkOptions.systemProxyProvider ?? createSystemProxyProvider({ secretService }), proxyLookup: networkOptions.proxyLookup, ca: networkOptions.ca, proxyCa: networkOptions.proxyCa, allowLocalFixture: networkOptions.allowLocalFixture, fixtureLookup: networkOptions.fixtureLookup, fixtureCa: networkOptions.ca });
  const configRepository = providerConfigRepository ?? (process.env.DGOS_DATABASE_URL ? new PostgresProviderConfigRepository(makePool()) : new InMemoryProviderConfigRepository());
  const providers = providerService ?? new ProviderService({ repository: providerRepository ?? (process.env.DGOS_DATABASE_URL ? new PostgresProviderRepository(makePool()) : new InMemoryProviderRepository()), configRepository, secretService, egress: configuredEgress, adapters: { 'openai-compatible': createOpenAiCompatibleAdapter() } });
  const audit = injectedAuditRepository ?? (process.env.DGOS_DATABASE_URL ? new PostgresAuditRepository(makePool()) : new InMemoryAuditRepository());
  if (!resolvedRepository.audit) resolvedRepository.audit = audit;
  const runtimePool = process.env.DGOS_DATABASE_URL ? makePool() : null;
  const governance = new GovernanceService({ retentionRepository: injectedRetentionRepository ?? (process.env.DGOS_DATABASE_URL ? new PostgresRetentionRepository(makePool(), { audit, clock }) : new InMemoryRetentionRepository(audit)), auditRepository: audit });
  const quotaPool = process.env.DGOS_DATABASE_URL ? makePool() : null;
  const quota = quotaModules ? new quotaModules[1].QuotaService({ repository: quotaPool ? new quotaModules[0].PostgresQuotaRepository(quotaPool, { audit }) : new quotaModules[0].InMemoryQuotaRepository(), audit, clock }) : { preflightQuota: async () => { throw Object.assign(new Error('quota_unavailable'), { statusCode: 503 }); } };
  const actionRuntime = createActionRuntime({ pool: runtimePool, audit, registry: injectedActionRegistry, handlers: actionHandlers, actionRepository: injectedActionRepository, systemRepository: injectedSystemRepository, permissionRepository: injectedPermissionRepository });
  const { actions, permissions, system } = actionRuntime;
  system.networkProxyValidator = (ref) => configuredEgress.validateProxyReference(ref);
  app.addHook('onReady', async () => { await actionRuntime.ready; });
  const networkInstanceId = networkOptions.instanceId ?? randomUUID();
  const networkLeaseMs = networkOptions.leaseMs ?? 15_000;
  configuredEgress.requireLease?.();
  let networkHeartbeat;
  app.addHook('onReady', async () => {
    await system.activateNetworkRoute(configuredEgress, { role: 'api', instanceId: networkInstanceId, leaseMs: networkLeaseMs });
    networkHeartbeat = setInterval(() => system.renewNetworkRoute(configuredEgress, { role: 'api', instanceId: networkInstanceId, leaseMs: networkLeaseMs }).catch(() => {}), Math.max(500, Math.floor(networkLeaseMs / 3)));
    networkHeartbeat.unref();
  });
  const profileDirectory = protocolOptions.directory ?? (runtimePool ? new PostgresTextProfileDirectory(runtimePool, audit) : new InMemoryTextProfileDirectory());
  const providerRegistry = new ProtocolAdapterRegistry(providerAdapters ?? [createConfiguredAdapter({ profileDirectory })]);
  const modelDependencies = { configRepository, accountRepository: providers.repository, registry: providerRegistry, profileDirectory };
  const providerConfigs = new ProviderConfigService({ repository: configRepository, accountRepository: providers.repository, secretService, registry: providerRegistry, egress: configuredEgress, audit, profileDirectory });
  const defaultQuotaAdapter = quotaModules?.[1]?.createQuotaAdapter ? quotaModules[1].createQuotaAdapter(quota) : { preflight: (input) => quota.preflight(input), reserve: (input) => quota.reserveQuota(input), settle: (input) => quota.settleUsage(input), release: (input) => quota.releaseQuota(input) };
  const taskRepository = aiTaskRepository ?? (process.env.DGOS_DATABASE_URL ? new PostgresAiTaskRepository(makePool()) : new InMemoryAiTaskRepository());
  const embeddedWorkerEnabled = !dispatchTask && taskRepository instanceof InMemoryAiTaskRepository && providerRunner;
  const aiTasks = new AiTaskService({ repository: taskRepository, configService: providerConfigs, accountRepository: providers.repository, secretService, registry: providerRegistry, egress: configuredEgress, quota: quotaAdapter ?? defaultQuotaAdapter, audit, providerRunner, admission: createTaskAdmission(modelDependencies), dispatch: dispatchTask ?? (embeddedWorkerEnabled || taskRepository instanceof PostgresAiTaskRepository ? async () => {} : undefined) });
  const embeddedWorker = embeddedWorkerEnabled ? new AiTaskWorker({ repository: taskRepository, taskService: aiTasks, workerId: 'embedded-api-worker', pollIntervalMs: 1, idleBackoffMs: 5 }) : null;
  embeddedWorker?.start();
  if (embeddedWorker) app.addHook('onClose', async () => embeddedWorker.stop());
  if (pools.length) app.addHook('onClose', async () => { await Promise.allSettled([system.ready, ...actions.registrations]); await Promise.all(pools.map((pool) => pool.end())); });
  app.addHook('onClose', async () => { clearInterval(networkHeartbeat); configuredEgress.suspendLease?.(); await system.releaseNetworkRoute(networkInstanceId); });
  const loginLimiter = rateLimiter ?? createRateLimiter({ clock });
  const authenticationBackoff = loginBackoff ?? createLoginBackoff({ clock });
  const maxLoginAttempts = 5;
  const loginWindowMs = 60_000;

  app.addHook('onRequest', async (request, reply) => {
    request.requestId = request.headers['x-request-id'] || randomUUID();
    reply.header('x-request-id', request.requestId);
  });
  app.setErrorHandler((error, request, reply) => {
    const errorKey = error.errorKey ?? error.message;
    const publicStatus = { provider_config_not_found: 404, provider_account_not_found: 404, model_not_found: 422, model_not_allowed: 422, task_not_found: 404, artifact_not_found: 404, connection_test_not_found: 404, provider_config_disabled: 422, provider_account_disabled: 422, model_catalog_stale: 422, capability_mismatch: 422, protocol_unavailable: 422, protocol_mismatch: 422, invalid_request: 422 };
    const statusCode = error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : publicStatus[errorKey] ?? 500;
    if (statusCode >= 500) request.log.error({ requestId: request.requestId, errorType: error.name, databaseCode: /^[0-9A-Z]{5}$/.test(error.code ?? '') ? error.code : undefined, frames: String(error.stack ?? '').split('\n').filter((line) => /^\s+at /.test(line)).slice(0, 8) }, 'request_failed');
    const messages = { invalid_request: 'Request is invalid', bootstrap_already_completed: 'Bootstrap is unavailable', invalid_credentials: 'Authentication failed', authentication_required: 'Authentication required', insufficient_scope: 'Required capability is missing', rate_limited: 'Too many authentication attempts', csrf_failed: 'Request origin validation failed', session_invalid: 'Session is invalid', session_conflict: 'Session changed; retry with a fresh session', session_not_found: 'Session not found', api_key_not_found: 'API key not found', protocol_unavailable: 'Provider protocol is unavailable', provider_account_not_found: 'Provider account not found', provider_account_conflict: 'Provider account changed; retry with a fresh version', provider_config_not_found: 'Provider configuration not found', model_not_found: 'Model is not in the catalog', model_not_allowed: 'Model is not enabled for text tasks', capability_mismatch: 'Model capability does not match the task', task_not_found: 'Task not found', artifact_not_found: 'Artifact not found', connection_test_not_found: 'Connection test not found', retention_preview_conflict: 'Retention preview changed; refresh before executing', retention_job_not_found: 'Retention job not found', quota_exceeded: 'Quota exceeded', quota_unavailable: 'Quota service unavailable', reservation_conflict: 'Reservation conflict', reservation_not_found: 'Reservation not found', policy_version_conflict: 'Quota policy version conflict', manifest_invalid: 'App manifest is invalid', app_not_available: 'App is not available in this catalog', app_install_conflict: 'App install is already in progress', health_check_failed: 'App health check failed and was rolled back', app_not_installed: 'App is not installed', app_uninstall_forbidden: 'App cannot be uninstalled', permission_denied: 'Permission denied', confirmation_required: 'Confirmation is required', action_not_found: 'Action not found', action_run_not_found: 'Action run not found', version_conflict: 'Version conflict' };
    Object.assign(messages, { step_up_required: 'Sign in again to confirm this operation', invalid_scope: 'Requested scope is invalid', invalid_retention_policy: 'Retention policy is invalid', governance_policy_unavailable: 'Governance policy is unavailable', provider_config_disabled: 'Provider configuration is not ready', provider_account_disabled: 'Provider account is not ready', model_catalog_stale: 'Explicitly refresh the model catalog', provider_account_in_use: 'Provider account still has active references', protocol_mismatch: 'Provider protocol does not match', upstream_outcome_unknown: 'Upstream outcome requires reconciliation', credential_unavailable: 'Credential is unavailable', endpoint_invalid: 'Provider endpoint is invalid', endpoint_forbidden: 'Provider endpoint is forbidden', upstream_unavailable: 'Upstream service is unavailable', authentication_failed: 'Authentication failed' });
    Object.assign(messages, publicErrorMessages);
    reply.code(statusCode).send({ errorKey: errorKey in messages ? errorKey : 'internal_error', message: messages[errorKey] ?? 'Request failed', requestId: request.requestId, retryable: statusCode >= 500, ...(error.retryAfter ? { details: { retryAfter: error.retryAfter } } : {}) });
  });

  async function currentSession(request) {
    const cookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('dgos_session='))?.slice('dgos_session='.length);
    const token = request.headers.authorization?.startsWith('Bearer ') ? request.headers.authorization.slice(7) : cookie;
    if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) throw Object.assign(new Error('session_invalid'), { statusCode: 401 });
    return identity.getSession(token);
  }
  function receiptCookie(reply, receipt) { reply.header('set-cookie', `dgos_session=${receipt.sessionId}; HttpOnly; Path=/; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`); }
  async function requireScope(request, scope) {
    const authorization = request.headers.authorization;
    if (authorization?.startsWith('ApiKey ')) {
      const subject = await identity.authenticateApiKey(authorization.slice(7));
      if (!subject.scopes.includes(scope) && !subject.scopes.includes('*')) throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 });
      request.auth = subject;
      return subject;
    }
    const session = await currentSession(request);
    request.auth = { subjectId: session.principalId, sessionId: session.sessionId, scopes: ['*'], authMethod: 'session' };
    return request.auth;
  }
  async function validateCsrf(request) {
    const cookie = request.headers.cookie?.includes('dgos_session=');
    if (!cookie) return;
    const origin = request.headers.origin;
    if (origin) {
      let parsed; try { parsed = new URL(origin); } catch { throw Object.assign(new Error('csrf_failed'), { statusCode: 403 }); }
      const allowed = (process.env.DGOS_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean);
      if (parsed.host !== request.headers.host && !allowed.includes(parsed.origin)) throw Object.assign(new Error('csrf_failed'), { statusCode: 403 });
    }
    if (!request.headers['x-dgos-csrf']) throw Object.assign(new Error('csrf_failed'), { statusCode: 403 });
  }
  const runtimeWrite = async (request, scope) => { await validateCsrf(request); return requireScope(request, scope); };
  const requireFreshSession = async (request, auth) => {
    try { return await requireFreshAdminSession(request, auth, { identity, clock }); }
    catch (error) {
      await audit.record({ requestId: request.requestId, actorId: auth.subjectId, action: 'admin.step_up.reject', targetType: 'admin_session', targetId: auth.sessionId, result: 'denied', summary: { errorKey: error.message } });
      throw error;
    }
  };
  registerGovernanceRoutes(app, { governance, requireScope, validateCsrf, requireFreshSession });
  if (runtimePool) {
    const proxyProvisioning = registerProxyProvisioningRoutes(app, { pool: runtimePool, secretService, writeAuth: runtimeWrite, requireFreshSession, trustedTransport: transport.trustedTransport, lookup: networkOptions.proxyLookup, allowLocalFixture: networkOptions.allowLocalFixture });
    app.addHook('onReady', async () => { await proxyProvisioning.ready; });
    system.networkProxyValidator = async (ref) => { await proxyProvisioning.assertCommittedRef(ref); await configuredEgress.validateProxyReference(ref); };
  }
  registerProviderProtocolRoutes(app, { directory: profileDirectory, adapterRegistry: providerRegistry, audit, requireScope, validateCsrf, requireFreshSession, confirmations: protocolOptions.confirmations ?? (runtimePool ? new PostgresProviderProtocolConfirmations(runtimePool) : new InMemoryProviderProtocolConfirmations()) });
  const scopedBody = (request, auth) => { const body=request.body ?? {}; if (body.subjectId && body.subjectId !== auth.subjectId) throw Object.assign(new Error('insufficient_scope'),{statusCode:403}); return { ...body, subjectId: auth.subjectId }; };

  registerIdentityRoutes(app, { identity, currentSession, validateCsrf, requireFreshSession, receiptCookie, authenticationBackoff, loginLimiter, maxLoginAttempts, loginWindowMs });
  app.get('/api/v1/secret/api-keys', async (request) => { const auth = await requireScope(request, 'apiKey.read'); return identity.listKeys(auth.subjectId); });
  app.post('/api/v1/secret/api-keys', async (request, reply) => { await validateCsrf(request); const auth = await requireScope(request, 'apiKey.manage'); await requireFreshSession(request, auth); const body = { ...request.body, ownerId: request.body?.ownerId ?? auth.subjectId }; if (body.ownerId !== auth.subjectId) throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 }); const result = await identity.createKey({ ...body, actorId: auth.subjectId, actorScopes: auth.scopes, requestId: request.requestId }); return reply.code(201).send(result); });
  app.post('/api/v1/secret/api-keys/:keyId/rotate', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'apiKey.manage'); await requireFreshSession(request, auth); return identity.rotateKey({ keyId: request.params.keyId, baseVersion: request.body?.baseVersion, overlapUntil: request.body?.overlapUntil, actorId: auth.subjectId, requestId: request.requestId }); });
  app.delete('/api/v1/secret/api-keys/:keyId', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'apiKey.manage'); await requireFreshSession(request, auth); return identity.revokeKey({ keyId: request.params.keyId, actorId: auth.subjectId, requestId: request.requestId }); });
  app.get('/api/v1/provider/accounts', async (request) => { const auth = await requireScope(request, 'provider.account.read'); return providers.listAccounts(auth.subjectId); });
  app.post('/api/v1/provider/accounts', async (request, reply) => { await validateCsrf(request); const auth = await requireScope(request, 'provider.account.write'); const body = { ...request.body, ownerId: request.body?.ownerId ?? auth.subjectId }; if (body.ownerId !== auth.subjectId && auth.authMethod !== 'session') throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 }); const normalized = { protocolType: body.protocolType ?? body.protocol, displayName: body.displayName ?? body.label, credential: body.credential, scope: body.scope ?? (body.endpoint ? { endpoint: body.endpoint } : undefined), defaultForProtocol: body.defaultForProtocol, ownerId: body.ownerId, requestId: request.requestId }; return reply.code(201).send(await providers.createAccount(normalized)); });
  app.post('/api/v1/provider/accounts/:accountId/bindings', async (request, reply) => { await validateCsrf(request); const auth = await requireScope(request, 'provider.account.write'); return reply.code(201).send(await providers.bindAccount({ accountId: request.params.accountId, ...request.body, requestId: request.requestId, actorId: auth.subjectId })); });
  app.post('/api/v1/provider/accounts/:accountId/state', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'provider.account.write'); return providers.setState({ accountId: request.params.accountId, ...request.body, requestId: request.requestId, actorId: auth.subjectId }); });
  app.delete('/api/v1/provider/accounts/:accountId', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'provider.account.delete'); return providers.deleteAccount({ accountId: request.params.accountId, version: request.body?.baseVersion, requestId: request.requestId, actorId: auth.subjectId }); });
  app.post('/api/v1/provider/connection-tests', async (request, reply) => { await validateCsrf(request); const auth = await requireScope(request, 'provider.connection_test'); const result = await providers.startConnectionTest({ ...request.body, ownerId: auth.subjectId, requestId: request.requestId }); return reply.code(202).send(result); });
  app.get('/api/v1/provider/connection-tests/:testId', async (request) => { const auth = await requireScope(request, 'provider.connection_test'); return providers.getConnectionTest(request.params.testId, auth.subjectId); });
  app.delete('/api/v1/provider/connection-tests/:testId', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'provider.connection_test'); return providers.cancelConnectionTest(request.params.testId, request.requestId, auth.subjectId); });
  app.get('/api/v1/provider/configs', async (request) => { const auth = await requireScope(request, 'provider.config.read'); return providerConfigs.list(auth.subjectId); });
  app.post('/api/v1/provider/configs', async (request, reply) => { await validateCsrf(request); const auth = await requireScope(request, 'provider.config.manage'); return reply.code(201).send(await providerConfigs.create({ ...request.body, ownerId: auth.subjectId, requestId: request.body?.requestId ?? request.requestId })); });
  app.put('/api/v1/provider/configs/:providerId', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'provider.config.manage'); return providerConfigs.update(request.params.providerId, { ...request.body, baseVersion: request.body?.baseVersion }, auth.subjectId); });
  app.delete('/api/v1/provider/configs/:providerId', async (request, reply) => { await validateCsrf(request); const auth = await requireScope(request, 'provider.config.manage'); await providerConfigs.remove(request.params.providerId, auth.subjectId, request.body?.requestId ?? request.requestId); return reply.code(204).send(); });
  app.post('/api/v1/provider/configs/:providerId/validate', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'provider.config.manage'); return providerConfigs.validate(request.params.providerId, auth.subjectId, request.body?.requestId ?? request.requestId); });
  app.get('/api/v1/provider/configs/:providerId/models', async (request) => { const auth = await requireScope(request, 'provider.model.read'); return providerConfigs.models(request.params.providerId, auth.subjectId); });
  app.post('/api/v1/provider/configs/:providerId/models', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'provider.model.manage'); return providerConfigs.refresh(request.params.providerId, auth.subjectId, request.body?.requestId ?? request.requestId); });
  app.get('/api/v1/provider/configs/:providerId/model-policies', async (request) => { const auth = await requireScope(request, 'provider.model.read'); return providerConfigs.policies(request.params.providerId, auth.subjectId); });
  app.post('/api/v1/provider/configs/:providerId/model-policies', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'provider.model.manage'); return providerConfigs.policy(request.params.providerId, auth.subjectId, { ...request.body, requestId: request.body?.requestId ?? request.requestId }); });
  app.post('/api/v1/ai-tasks', async (request, reply) => { await validateCsrf(request); const auth = await requireScope(request, 'ai_task.submit'); const receipt = await aiTasks.submit({ ...request.body, ownerId: auth.subjectId, requestId: request.body?.requestId ?? request.requestId }); return reply.code(202).send(receipt); });
  app.get('/api/v1/ai-tasks/:taskId', async (request) => { const auth = await requireScope(request, 'ai_task.read'); return aiTasks.get(request.params.taskId, auth.subjectId); });
  app.get('/api/v1/ai-tasks/:taskId/events', async (request, reply) => { const auth = await requireScope(request, 'ai_task.read'); const after = request.headers['last-event-id'] ?? request.query?.cursor ?? 0; const events = await aiTasks.events(request.params.taskId, auth.subjectId, after); reply.header('content-type', 'text/event-stream; charset=utf-8').header('cache-control', 'no-cache').header('connection', 'keep-alive'); return events.map((event) => `id: ${event.sequence}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''); });
  app.delete('/api/v1/ai-tasks/:taskId', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'ai_task.cancel'); return aiTasks.cancel(request.params.taskId, auth.subjectId, request.body?.requestId ?? request.requestId); });
  app.get('/api/v1/artifacts/:artifactId', async (request) => { const auth = await requireScope(request, 'artifact.read'); const artifact = await aiTasks.artifact(request.params.artifactId, auth.subjectId); await audit.record({ requestId: request.requestId, actorId: auth.subjectId, action: 'artifact.read', targetType: 'artifact', targetId: request.params.artifactId, summary: {} }); return artifact; });
  registerAuditRoutes(app, { audit, requireScope });
  app.post('/api/v1/admin/governance/retention-sweeps', async (request, reply) => { await validateCsrf(request); const auth = await requireScope(request, 'retention.write'); await requireFreshSession(request, auth); return reply.code(202).send(await governance.startRetention({ ...request.body, requestId: request.requestId, actorId: auth.subjectId })); });
  app.get('/api/v1/admin/governance/retention-sweeps/:jobId', async (request) => { await requireScope(request, 'retention.read'); return governance.getRetention(request.params.jobId); });
  app.post('/api/v1/admin/governance/retention-sweeps/:jobId/run', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'retention.write'); await requireFreshSession(request, auth); return governance.runRetention(request.params.jobId, request.requestId, auth.subjectId, request.body?.previewDigest); });
  const quotaTarget = (auth, body, { write = false } = {}) => { const target = body.target ?? {}; const requestedSubject = target.subjectId ?? body.subjectId ?? auth.subjectId; const scopeType = target.scopeType ?? 'subject'; const scopeId = target.scopeId ?? requestedSubject; const adminScope = auth.scopes.includes('*') || auth.scopes.includes('quota.admin'); if ((!adminScope && requestedSubject !== auth.subjectId) || (!adminScope && (scopeType !== 'subject' || String(scopeId) !== String(auth.subjectId)))) throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 }); if (write && !body.requestId) body.requestId = auth.requestId; return { ...target, ...body, subjectId: requestedSubject, scopeType, scopeId }; };
  app.post('/api/v1/quota/preflight', async (request) => { const auth = await requireScope(request, 'quota.read'); const input = quotaTarget(auth, request.body ?? {}); return quota.preflightQuota({ ...input, requestId: input.requestId ?? request.requestId }); });
  app.post('/api/v1/quota/reservations', async (request, reply) => { await validateCsrf(request); const auth = await requireScope(request, 'quota.manage'); const input = quotaTarget(auth, request.body ?? {}, { write: true }); return reply.code(201).send(await quota.reserveQuota({ ...input, requestId: input.requestId ?? request.requestId })); });
  app.post('/api/v1/quota/reservations/:reservationId/settle', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'quota.manage'); const body = request.body ?? {}; const reservation = await quota.repository.getReservation(request.params.reservationId); if (!reservation) throw Object.assign(new Error('reservation_not_found'), { statusCode: 404 }); const admin = auth.scopes.includes('*') || auth.scopes.includes('quota.admin'); return quota.settleUsage({ ...body, reservationId: request.params.reservationId, requestId: body.requestId ?? request.requestId, actorId: auth.subjectId, usageStatus: body.usage?.status ?? body.usageStatus, amount: body.usage?.totalTokens ?? body.amount ?? 1, estimated: body.usage?.status === 'estimated', sourceDigest: body.usage?.sourceDigest }, { actorId: auth.subjectId, subjectId: reservation.subjectId, admin }); });
  app.get('/api/v1/usage', async (request) => { const auth = await requireScope(request, 'usage.read'); const subjectId = request.query?.subjectId ?? auth.subjectId; const adminScope = auth.scopes.includes('*') || auth.scopes.includes('usage.admin'); if (!adminScope && subjectId !== auth.subjectId) throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 }); return quota.queryUsage({ ...request.query, subjectId }, { actorId: auth.subjectId, subjectId, admin: adminScope }); });
  app.get('/api/v1/quota/policies', async (request) => { const auth = await requireScope(request, 'quota.read'); const subjectId = request.query?.subjectId ?? auth.subjectId; const adminScope = auth.scopes.includes('*') || auth.scopes.includes('quota.admin'); if (!adminScope && subjectId !== auth.subjectId) throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 }); return quota.listPolicies({ subjectId }); });
  app.put('/api/v1/quota/policies', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'quota.manage'); const body = request.body ?? {}; const scope = body.scope ?? {}; const scopeType = body.scopeType ?? scope.type ?? 'subject'; const scopeId = body.scopeId ?? scope.id ?? auth.subjectId; const adminScope = auth.scopes.includes('*') || auth.scopes.includes('quota.admin'); if (!adminScope && (scopeType !== 'subject' || String(scopeId) !== String(auth.subjectId))) throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 }); return quota.updatePolicy({ ...body, scopeType, scopeId, hardLimit: body.hardLimit ?? body.limit, windowSeconds: body.windowSeconds ?? ({ hour: 3600, day: 86400, month: 2592000, rolling: 3600 }[body.window] ?? 3600), requestId: body.requestId ?? request.requestId, actorId: auth.subjectId }); });

  const appAuth = async (request, scope) => requireScope(request, scope);
  const packageConfig = packageRuntimeConfig(packageOptions);
  const appCapabilities = createAppCapabilities({ permissionRepository: permissions.repository, audit, aiTasks, providerConfigs, resolveModel: createModelResolver(modelDependencies), system });
  const validateLaunchSession = async ({ sessionId, subjectId }) => {
    const session = await identity.getSession(sessionId);
    if (session.principalId !== subjectId) throw Object.assign(new Error('session_invalid'), { statusCode: 401 });
    return true;
  };
  const packages = registerPackageRoutes(app, { pool: runtimePool, ...appCapabilities, onActionsChanged: actionRuntime.packageLifecycle?.onActionsChanged, ...packageOptions, ...packageConfig, audit, requireScope, validateCsrf, validateLaunchSession });
  app.addHook('onReady', async () => { await packages.ready(); });
  if (runtimePool) {
    const packageRetention = new PostgresPackageRetention({ pool: runtimePool, store: packages.store, audit, clock });
    governance.attachPackageRetention(packageRetention);
    app.addHook('onReady', async () => { await packageRetention.ready(); });
  }
  if (packageConfig.temporaryRoot) app.addHook('onClose', async () => { await rm(packageConfig.temporaryRoot, { recursive: true, force: true }); });
  app.packages = packages;
  const extensionSourceResolver = extensionOptions.sourceResolver ?? new ExtensionSourceResolver();
  const extensionRunner = extensionOptions.runner ?? new IsolatedExtensionRunner();
  const extensions = registerExtensionRoutes(app, { pool: runtimePool, ...extensionOptions, permissions, audit, secretService, aiTasks, trustedTransport: transport.trustedTransport, sourceResolver: extensionSourceResolver, runner: extensionRunner, appAccess: extensionOptions.appAccess ?? createDeploymentAppAccess(packages.repository), requireScope, validateCsrf });
  if (runtimePool && extensions.management) app.addHook('onReady', async () => {
    extensions.management.credentialFingerprint = await createExtensionCredentialFingerprint({ pool: runtimePool, secretService });
    await extensions.management.repository.recoverSecretWrites(secretService);
  });
  const extensionConfigPath = extensionOptions.configPath ?? process.env.DGOS_EXTENSION_CONFIG_FILE;
  if (extensionConfigPath) app.addHook('onReady', async () => {
    const loaded = await loadIntoExtensionRuntime({ configPath: extensionConfigPath, sourceResolver: extensionSourceResolver, runner: extensionRunner, networkRoute: configuredEgress, networkFixtureHosts: networkOptions.fixtureHosts });
    if (extensions.management) extensions.management.templates = loaded.templates;
  });
  app.extensions = extensions;

  app.post('/api/v1/permissions/check', async (request) => { const auth = await appAuth(request, 'permission.read'); return permissions.check({ ...scopedBody(request,auth), requestId: request.requestId }); });
  app.post('/api/v1/permissions/request', async (request, reply) => { const auth = await runtimeWrite(request, 'permission.read'); return reply.code(202).send(await permissions.request({ ...scopedBody(request,auth), requestId: request.requestId })); });
  app.patch('/api/v1/permissions', async (request) => { const auth = await runtimeWrite(request,'permission.manage'); await requireFreshSession(request, auth); return permissions.decide({ ...scopedBody(request,auth), requestId: request.requestId }); });

  registerActionRoutes(app, { service: actions, readAuth: appAuth, writeAuth: runtimeWrite, scopedBody, requireFreshSession });
  registerCandidateRoutes(app, { actions, permissions, requireScope, validateCsrf });

  registerSystemRoutes(app, { system, readAuth: appAuth, writeAuth: runtimeWrite, requireFreshSession, permissionRules: createSystemPermissionRules({ permissionRepository: permissions.repository, systemRepository: system.repository, audit }) });

  app.get('/health', async () => ({ status: 'ok', service: 'dgos-api' }));
  app.get('/ready', async () => { await Promise.all(pools.map((pool) => pool.query('SELECT 1'))); return { status: 'ready', apiVersion }; });

  app.actions = actions;
  app.permissions = permissions;
  app.system = system;
  app.networkRoute = configuredEgress;

  return app;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const redis = process.env.REDIS_URL ? createClient({ url: process.env.REDIS_URL }) : null;
  if (redis) await redis.connect();
  const app = buildServer({ closeDatabasePools: true, rateLimiter: createRateLimiter({ redis }), loginBackoff: createLoginBackoff({ redis }), secretService: redis ? new RedisSecretService(redis) : undefined, providerEgress: createRuntimeEgress() });
  app.addHook('onClose', async () => { if (redis) await redis.quit(); });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => app.close().catch(() => { process.exitCode = 1; }));
  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ host, port });
}
