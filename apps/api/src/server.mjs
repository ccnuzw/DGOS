import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { apiVersion } from '@dgos/sdk';
import { InMemorySecretService } from '../../../src/security/secret-service.mjs';
import { createRateLimiter } from '../../../src/security/rate-limiter.mjs';
import { InMemoryIdentityRepository, PostgresIdentityRepository } from '../../../src/identity/repository.mjs';
import { IdentityService } from './identity-service.mjs';
import pg from 'pg';
import { createClient } from 'redis';
import { InMemoryProviderRepository, PostgresProviderRepository } from '../../../src/provider/repository.mjs';
import { ProviderEgress } from '../../../src/security/provider-egress.mjs';
import { ProviderService, createOpenAiCompatibleAdapter } from './provider-service.mjs';
import { PostgresAuditRepository, InMemoryAuditRepository } from '../../../src/audit/outbox.mjs';
import { PostgresRetentionRepository, InMemoryRetentionRepository } from '../../../src/audit/retention.mjs';
import { GovernanceService } from './governance-service.mjs';
let quotaModules;
try { quotaModules = await Promise.all([import('../../../src/quota/repository.mjs'), import('../../../src/quota/service.mjs')]); } catch { quotaModules = null; }
import { InMemoryAppRepository } from '../../../src/apps/repository.mjs';
import { PostgresAppRepository } from '../../../src/apps/postgres-repository.mjs';
import { CatalogService } from '../../../src/apps/catalog-service.mjs';
import { AppRuntimeService } from '../../../src/apps/runtime-service.mjs';
import { InMemoryPermissionRepository } from '../../../src/permissions/repository.mjs';
import { PostgresPermissionRepository } from '../../../src/permissions/postgres-repository.mjs';
import { PermissionBroker } from '../../../src/permissions/broker.mjs';
import { ActionRegistry } from '../../../src/actions/registry.mjs';
import { ActionService } from '../../../src/actions/service.mjs';
import { InMemoryActionRepository, PostgresActionRepository } from '../../../src/actions/repository.mjs';
import { SystemService } from '../../../src/system/service.mjs';
import { InMemorySystemRepository, PostgresSystemRepository } from '../../../src/system/repository.mjs';
import { ProtocolAdapterRegistry } from '../../../src/provider-adapters/registry.mjs';
import { createOpenAiCompatibleAdapter as createConfiguredAdapter } from '../../../src/provider-adapters/openai-compatible.mjs';
import { InMemoryProviderConfigRepository, PostgresProviderConfigRepository } from '../../../src/provider-config/repository.mjs';
import { ProviderConfigService } from '../../../src/provider-config/service.mjs';
import { InMemoryAiTaskRepository, PostgresAiTaskRepository } from '../../../src/ai-task/repository.mjs';
import { AiTaskService } from '../../../src/ai-task/service.mjs';

export function buildServer({ logger = true, repository, providerRepository, providerService, providerConfigRepository, aiTaskRepository, providerRunner, providerAdapters, providerEgress, quotaAdapter, secretService = new InMemorySecretService(), rateLimiter, clock, appRepository: injectedAppRepository, permissionRepository: injectedPermissionRepository, actionRepository: injectedActionRepository, systemRepository: injectedSystemRepository, actionRegistry: injectedActionRegistry, auditRepository: injectedAuditRepository } = {}) {
  const resolvedRepository = repository ?? (process.env.DGOS_DATABASE_URL ? new PostgresIdentityRepository(new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL })) : new InMemoryIdentityRepository());
  const app = Fastify({ logger });
  const identity = new IdentityService({ repository: resolvedRepository, secretService, clock });
  const providers = providerService ?? new ProviderService({ repository: providerRepository ?? (process.env.DGOS_DATABASE_URL ? new PostgresProviderRepository(new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL })) : new InMemoryProviderRepository()), secretService, egress: new ProviderEgress(), adapters: { 'openai-compatible': createOpenAiCompatibleAdapter() } });
  const audit = injectedAuditRepository ?? (process.env.DGOS_DATABASE_URL ? new PostgresAuditRepository(new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL })) : new InMemoryAuditRepository());
  const runtimePool = process.env.DGOS_DATABASE_URL ? new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL }) : null;
  const governance = new GovernanceService({ retentionRepository: process.env.DGOS_DATABASE_URL ? new PostgresRetentionRepository(new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL })) : new InMemoryRetentionRepository(audit), auditRepository: audit });
  const quotaPool = process.env.DGOS_DATABASE_URL ? new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL }) : null;
  const quota = quotaModules ? new quotaModules[1].QuotaService({ repository: quotaPool ? new quotaModules[0].PostgresQuotaRepository(quotaPool, { audit }) : new quotaModules[0].InMemoryQuotaRepository(), audit, clock }) : { preflightQuota: async () => { throw Object.assign(new Error('quota_unavailable'), { statusCode: 503 }); } };
  const appRepository = injectedAppRepository ?? (runtimePool ? new PostgresAppRepository(runtimePool) : new InMemoryAppRepository({ audit }));
  const catalog = new CatalogService({ repository: appRepository, audit });
  const runtime = new AppRuntimeService({ repository: appRepository, audit });
  const permissions = new PermissionBroker({ repository: injectedPermissionRepository ?? (runtimePool ? new PostgresPermissionRepository(runtimePool) : new InMemoryPermissionRepository()), audit });
  const actionRegistry = injectedActionRegistry ?? new ActionRegistry();
  const actions = new ActionService({ registry: actionRegistry, permissions, audit, repository: injectedActionRepository ?? (runtimePool ? new PostgresActionRepository(runtimePool) : new InMemoryActionRepository()) });
  const system = new SystemService({ audit, repository: injectedSystemRepository ?? (runtimePool ? new PostgresSystemRepository(runtimePool) : new InMemorySystemRepository()) });
  const providerRegistry = new ProtocolAdapterRegistry(providerAdapters ?? [createConfiguredAdapter()]);
  const configuredEgress = providerEgress ?? new ProviderEgress();
  const providerConfigs = new ProviderConfigService({ repository: providerConfigRepository ?? (process.env.DGOS_DATABASE_URL ? new PostgresProviderConfigRepository(new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL })) : new InMemoryProviderConfigRepository()), accountRepository: providers.repository, secretService, registry: providerRegistry, egress: configuredEgress, audit });
  const defaultQuotaAdapter = quotaModules?.[1]?.createQuotaAdapter ? quotaModules[1].createQuotaAdapter(quota) : { preflight: (input) => quota.preflight(input), reserve: (input) => quota.reserveQuota(input), settle: (input) => quota.settleUsage(input), release: (input) => quota.releaseQuota(input) };
  const aiTasks = new AiTaskService({ repository: aiTaskRepository ?? (process.env.DGOS_DATABASE_URL ? new PostgresAiTaskRepository(new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL })) : new InMemoryAiTaskRepository()), configService: providerConfigs, accountRepository: providers.repository, secretService, registry: providerRegistry, egress: configuredEgress, quota: quotaAdapter ?? defaultQuotaAdapter, audit, providerRunner });
  const loginLimiter = rateLimiter ?? createRateLimiter({ clock });
  const maxLoginAttempts = 5;
  const loginWindowMs = 60_000;

  app.addHook('onRequest', async (request, reply) => {
    request.requestId = request.headers['x-request-id'] || randomUUID();
    reply.header('x-request-id', request.requestId);
  });
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    const messages = { invalid_request: 'Request is invalid', bootstrap_already_completed: 'Bootstrap is unavailable', invalid_credentials: 'Authentication failed', authentication_required: 'Authentication required', insufficient_scope: 'Required capability is missing', rate_limited: 'Too many authentication attempts', csrf_failed: 'Request origin validation failed', session_invalid: 'Session is invalid', session_conflict: 'Session changed; retry with a fresh session', session_not_found: 'Session not found', api_key_not_found: 'API key not found', protocol_unavailable: 'Provider protocol is unavailable', provider_account_not_found: 'Provider account not found', provider_account_conflict: 'Provider account changed; retry with a fresh version', provider_config_not_found: 'Provider configuration not found', model_not_found: 'Model is not in the catalog', model_not_allowed: 'Model is not enabled for text tasks', capability_mismatch: 'Model capability does not match the task', task_not_found: 'Task not found', artifact_not_found: 'Artifact not found', connection_test_not_found: 'Connection test not found', retention_preview_conflict: 'Retention preview changed; refresh before executing', retention_job_not_found: 'Retention job not found', quota_exceeded: 'Quota exceeded', quota_unavailable: 'Quota service unavailable', reservation_conflict: 'Reservation conflict', reservation_not_found: 'Reservation not found', policy_version_conflict: 'Quota policy version conflict', manifest_invalid: 'App manifest is invalid', app_not_available: 'App is not available in this catalog', app_install_conflict: 'App install is already in progress', health_check_failed: 'App health check failed and was rolled back', app_not_installed: 'App is not installed', app_uninstall_forbidden: 'App cannot be uninstalled', permission_denied: 'Permission denied', confirmation_required: 'Confirmation is required', action_not_found: 'Action not found', action_run_not_found: 'Action run not found', version_conflict: 'Version conflict' };
    reply.code(statusCode).send({ errorKey: error.message in messages ? error.message : 'internal_error', message: messages[error.message] ?? 'Request failed', requestId: request.requestId, retryable: statusCode >= 500, ...(error.retryAfter ? { details: { retryAfter: error.retryAfter } } : {}) });
  });

  async function currentSession(request) {
    const cookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('dgos_session='))?.slice('dgos_session='.length);
    const token = request.headers.authorization?.startsWith('Bearer ') ? request.headers.authorization.slice(7) : cookie;
    if (!token) throw Object.assign(new Error('session_invalid'), { statusCode: 401 });
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
    request.auth = { subjectId: session.principalId, scopes: ['*'], authMethod: 'session' };
    return request.auth;
  }
  async function validateCsrf(request) {
    const cookie = request.headers.cookie?.includes('dgos_session=');
    if (cookie && !request.headers['x-dgos-csrf']) throw Object.assign(new Error('csrf_failed'), { statusCode: 403 });
  }
  const runtimeWrite = async (request, scope) => { await validateCsrf(request); return requireScope(request, scope); };
  const scopedBody = (request, auth) => { const body=request.body ?? {}; if (body.subjectId && body.subjectId !== auth.subjectId) throw Object.assign(new Error('insufficient_scope'),{statusCode:403}); return body; };

  app.post('/api/v1/identity/admin/bootstrap', async (request, reply) => { const result = await identity.bootstrap({ ...request.body, requestId: request.requestId }); receiptCookie(reply, result); return reply.code(201).send(result); });
  app.post('/api/v1/identity/admin/login', async (request, reply) => { const source = request.ip; const attempts = await loginLimiter.consume(source, { limit: maxLoginAttempts, windowMs: loginWindowMs }); if (!attempts.allowed) throw Object.assign(new Error('rate_limited'), { statusCode: 429, retryAfter: Math.ceil(attempts.retryAfterMs / 1000) }); try { const result = await identity.login({ ...request.body, requestId: request.requestId }); await loginLimiter.reset(source); receiptCookie(reply, result); return result; } catch (error) { throw error; } });
  app.get('/api/v1/identity/admin/session', async (request) => { const session = await currentSession(request); return { ...session, requestId: request.requestId }; });
  app.post('/api/v1/identity/admin/session', async (request, reply) => { await validateCsrf(request); const session = await currentSession(request); const result = await identity.renewSession({ sessionId: session.sessionId, version: request.body?.baseVersion ?? session.sessionVersion, requestId: request.requestId }); receiptCookie(reply, result); return result; });
  app.delete('/api/v1/identity/admin/sessions/:sessionId', async (request) => { await validateCsrf(request); const session = await currentSession(request); return identity.revokeSession({ sessionId: request.params.sessionId, actorId: session.principalId, requestId: request.requestId }); });
  app.get('/api/v1/secret/api-keys', async (request) => { const auth = await requireScope(request, 'apiKey.read'); return identity.listKeys(auth.subjectId); });
  app.post('/api/v1/secret/api-keys', async (request, reply) => { await validateCsrf(request); const auth = await requireScope(request, 'apiKey.manage'); const body = { ...request.body, ownerId: request.body?.ownerId ?? auth.subjectId }; if (body.ownerId !== auth.subjectId && auth.authMethod !== 'session') throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 }); const result = await identity.createKey({ ...body, actorId: auth.subjectId, requestId: request.requestId }); return reply.code(201).send(result); });
  app.post('/api/v1/secret/api-keys/:keyId/rotate', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'apiKey.manage'); return identity.rotateKey({ keyId: request.params.keyId, actorId: auth.subjectId, requestId: request.requestId }); });
  app.delete('/api/v1/secret/api-keys/:keyId', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'apiKey.manage'); return identity.revokeKey({ keyId: request.params.keyId, actorId: auth.subjectId, requestId: request.requestId }); });
  app.get('/api/v1/provider/accounts', async (request) => { const auth = await requireScope(request, 'provider.account.read'); return providers.listAccounts(auth.subjectId); });
  app.post('/api/v1/provider/accounts', async (request, reply) => { await validateCsrf(request); const auth = await requireScope(request, 'provider.account.write'); const body = { ...request.body, ownerId: request.body?.ownerId ?? auth.subjectId }; if (body.ownerId !== auth.subjectId && auth.authMethod !== 'session') throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 }); return reply.code(201).send(await providers.createAccount({ ...body, requestId: request.requestId })); });
  app.post('/api/v1/provider/accounts/:accountId/bindings', async (request, reply) => { await validateCsrf(request); const auth = await requireScope(request, 'provider.account.write'); return reply.code(201).send(await providers.bindAccount({ accountId: request.params.accountId, ...request.body, requestId: request.requestId, actorId: auth.subjectId })); });
  app.post('/api/v1/provider/accounts/:accountId/state', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'provider.account.write'); return providers.setState({ accountId: request.params.accountId, ...request.body, requestId: request.requestId, actorId: auth.subjectId }); });
  app.delete('/api/v1/provider/accounts/:accountId', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'provider.account.delete'); return providers.deleteAccount({ accountId: request.params.accountId, version: request.body?.baseVersion, requestId: request.requestId, actorId: auth.subjectId }); });
  app.post('/api/v1/provider/connection-tests', async (request, reply) => { await validateCsrf(request); const auth = await requireScope(request, 'provider.connection_test'); const result = await providers.startConnectionTest({ ...request.body, requestId: request.requestId }); const account = await providers.repository?.getAccount?.(result.accountId); if (account && account.ownerId !== auth.subjectId && auth.authMethod !== 'session') throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 }); return reply.code(202).send(result); });
  app.get('/api/v1/provider/connection-tests/:testId', async (request) => { await requireScope(request, 'provider.connection_test'); return providers.getConnectionTest(request.params.testId); });
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
  app.get('/api/v1/audit/events', async (request) => { const auth = await requireScope(request, 'audit.read'); const query = request.query ?? {}; const isApiKey = auth.authMethod === 'api_key'; return audit.query({ ...query, restrictActorId: isApiKey ? auth.subjectId : undefined }); });
  app.post('/api/v1/admin/governance/retention-sweeps', async (request, reply) => { await validateCsrf(request); const auth = await requireScope(request, 'retention.write'); return reply.code(202).send(await governance.startRetention({ ...request.body, requestId: request.requestId, actorId: auth.subjectId })); });
  app.get('/api/v1/admin/governance/retention-sweeps/:jobId', async (request) => { await requireScope(request, 'retention.read'); return governance.getRetention(request.params.jobId); });
  app.post('/api/v1/admin/governance/retention-sweeps/:jobId/run', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'retention.write'); return governance.runRetention(request.params.jobId, request.requestId, auth.subjectId); });
  const quotaTarget = (auth, body, { write = false } = {}) => { const target = body.target ?? {}; const requestedSubject = target.subjectId ?? body.subjectId ?? auth.subjectId; const scopeType = target.scopeType ?? 'subject'; const scopeId = target.scopeId ?? requestedSubject; const adminScope = auth.scopes.includes('*') || auth.scopes.includes('quota.admin'); if ((!adminScope && requestedSubject !== auth.subjectId) || (!adminScope && (scopeType !== 'subject' || String(scopeId) !== String(auth.subjectId)))) throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 }); if (write && !body.requestId) body.requestId = auth.requestId; return { ...target, ...body, subjectId: requestedSubject, scopeType, scopeId }; };
  app.post('/api/v1/quota/preflight', async (request) => { const auth = await requireScope(request, 'quota.read'); const input = quotaTarget(auth, request.body ?? {}); return quota.preflightQuota({ ...input, requestId: input.requestId ?? request.requestId }); });
  app.post('/api/v1/quota/reservations', async (request, reply) => { await validateCsrf(request); const auth = await requireScope(request, 'quota.manage'); const input = quotaTarget(auth, request.body ?? {}, { write: true }); return reply.code(201).send(await quota.reserveQuota({ ...input, requestId: input.requestId ?? request.requestId })); });
  app.post('/api/v1/quota/reservations/:reservationId/settle', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'quota.manage'); const body = request.body ?? {}; return quota.settleUsage({ ...body, reservationId: request.params.reservationId, requestId: body.requestId ?? request.requestId, actorId: auth.subjectId, usageStatus: body.usage?.status ?? body.usageStatus, amount: body.usage?.totalTokens ?? body.amount ?? 1, estimated: body.usage?.status === 'estimated', sourceDigest: body.usage?.sourceDigest }); });
  app.get('/api/v1/usage', async (request) => { const auth = await requireScope(request, 'usage.read'); const subjectId = request.query?.subjectId ?? auth.subjectId; const adminScope = auth.scopes.includes('*') || auth.scopes.includes('usage.admin'); if (!adminScope && subjectId !== auth.subjectId) throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 }); return quota.queryUsage({ ...request.query, subjectId }); });
  app.get('/api/v1/quota/policies', async (request) => { const auth = await requireScope(request, 'quota.read'); const subjectId = request.query?.subjectId ?? auth.subjectId; const adminScope = auth.scopes.includes('*') || auth.scopes.includes('quota.admin'); if (!adminScope && subjectId !== auth.subjectId) throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 }); return quota.listPolicies({ subjectId }); });
  app.put('/api/v1/quota/policies', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'quota.manage'); const body = request.body ?? {}; const scope = body.scope ?? {}; const scopeType = body.scopeType ?? scope.type ?? 'subject'; const scopeId = body.scopeId ?? scope.id ?? auth.subjectId; const adminScope = auth.scopes.includes('*') || auth.scopes.includes('quota.admin'); if (!adminScope && (scopeType !== 'subject' || String(scopeId) !== String(auth.subjectId))) throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 }); return quota.updatePolicy({ ...body, scopeType, scopeId, hardLimit: body.hardLimit ?? body.limit, windowSeconds: body.windowSeconds ?? ({ hour: 3600, day: 86400, month: 2592000, rolling: 3600 }[body.window] ?? 3600), requestId: body.requestId ?? request.requestId, actorId: auth.subjectId }); });

  const appAuth = async (request, scope) => requireScope(request, scope);
  app.get('/api/v1/apps', async (request) => { await appAuth(request, 'app.catalog.read'); return catalog.list({ publicOnly: true }); });
  app.get('/api/v1/apps/:appId', async (request) => { await appAuth(request, 'app.catalog.read'); const item = await appRepository.getApp(request.params.appId, request.query?.version, request.query?.build); if (!item || !['official', 'approved'].includes(item.catalogState)) throw Object.assign(new Error('app_not_available'), { statusCode: 404 }); return item; });
  app.post('/api/v1/apps', async (request, reply) => { const auth = await runtimeWrite(request,'app.catalog.manage'); return reply.code(201).send(await catalog.submit({ ...request.body, actorId: auth.subjectId, requestId:request.requestId })); });
  app.post('/api/v1/apps/:appId/approve', async (request) => { const auth = await runtimeWrite(request,'app.catalog.manage'); return catalog.approve({ ...request.body, appId: request.params.appId, actorId: auth.subjectId,requestId:request.requestId }); });
  app.post('/api/v1/apps/:appId/reject', async (request) => { const auth = await runtimeWrite(request,'app.catalog.manage'); return catalog.reject({ ...request.body, appId: request.params.appId, actorId: auth.subjectId,requestId:request.requestId }); });
  app.post('/api/v1/apps/:appId/withdraw', async (request) => { const auth = await runtimeWrite(request,'app.catalog.manage'); return catalog.withdraw({ ...request.body, appId: request.params.appId, actorId: auth.subjectId,requestId:request.requestId }); });
  app.post('/api/v1/apps/:appId/test-install', async (request) => { const auth = await runtimeWrite(request,'app.install'); return runtime.install({ ...request.body, appId: request.params.appId, subjectId: auth.subjectId, developerTest: true, actorId: auth.subjectId,requestId:request.requestId }); });
  app.post('/api/v1/apps/:appId/install', async (request) => { const auth = await runtimeWrite(request,'app.install'); return runtime.install({ ...request.body, appId: request.params.appId, subjectId: auth.subjectId, actorId: auth.subjectId,requestId:request.requestId }); });
  app.post('/api/v1/apps/:appId/launch', async (request) => { const auth = await runtimeWrite(request,'app.lifecycle'); return runtime.launch({ appId: request.params.appId, subjectId: auth.subjectId }); });
  app.post('/api/v1/apps/:appId/update', async (request) => { const auth = await runtimeWrite(request,'app.lifecycle'); return runtime.update({ ...request.body, appId: request.params.appId, subjectId: auth.subjectId, actorId: auth.subjectId,requestId:request.requestId }); });
  app.post('/api/v1/apps/:appId/uninstall', async (request) => { const auth = await runtimeWrite(request,'app.lifecycle'); return runtime.uninstall({ ...request.body, appId: request.params.appId, subjectId: auth.subjectId, actorId: auth.subjectId,requestId:request.requestId }); });
  app.get('/api/v1/apps/:appId/health', async (request) => { const auth = await appAuth(request, 'app.lifecycle'); return runtime.health({ appId: request.params.appId, subjectId: auth.subjectId }); });

  app.post('/api/v1/permissions/check', async (request) => { const auth = await appAuth(request, 'permission.read'); return permissions.check({ ...scopedBody(request,auth), requestId: request.requestId }); });
  app.post('/api/v1/permissions/request', async (request, reply) => { const auth = await appAuth(request, 'permission.read'); return reply.code(202).send(await permissions.request({ ...scopedBody(request,auth), requestId: request.requestId })); });
  app.patch('/api/v1/permissions', async (request) => { const auth = await runtimeWrite(request,'permission.manage'); return permissions.decide({ ...scopedBody(request,auth), requestId: request.requestId }); });

  app.get('/api/v1/actions', async (request) => { await appAuth(request, 'action.read'); return actions.list(); });
  app.post('/api/v1/actions/:actionId/plan', async (request) => { const auth = await appAuth(request, 'action.plan'); return actions.plan({ ...scopedBody(request,auth), actionId: request.params.actionId, subjectId: auth.subjectId, requestId: request.requestId }); });
  app.post('/api/v1/actions/:actionId/execute', async (request, reply) => { const auth = await runtimeWrite(request,'action.execute'); return reply.code(202).send(await actions.execute({ ...scopedBody(request,auth), actionId: request.params.actionId, subjectId: auth.subjectId, requestId: request.requestId })); });
  app.get('/api/v1/action-runs/:runId', async (request) => { const auth = await appAuth(request, 'action.read'); return actions.get(request.params.runId, auth.subjectId); });
  app.delete('/api/v1/action-runs/:runId', async (request) => { const auth = await runtimeWrite(request,'action.execute'); return actions.cancel(request.params.runId, auth.subjectId, request.requestId); });

  app.get('/api/v1/system/settings', async (request) => { await appAuth(request, 'system.settings.read'); return await system.snapshot(); });
  app.patch('/api/v1/system/settings', async (request) => { const auth = await runtimeWrite(request,'system.settings.write'); return system.patch({ ...request.body, actorId: auth.subjectId, requestId: request.requestId }); });
  app.get('/api/v1/system/context', async (request) => { await appAuth(request, 'system.settings.read'); return await system.context(); });
  app.get('/api/v1/system/context/events', async (request) => { await appAuth(request, 'system.settings.read'); return { items: system.repository?.eventsAfter ? await system.repository.eventsAfter(system.scopeId,request.query?.afterVersion ?? 0) : system.getEvents(request.query?.afterVersion ?? 0) }; });

  app.get('/health', async () => ({ status: 'ok', service: 'dgos-api' }));
  app.get('/ready', async () => ({ status: 'ready', apiVersion }));
  app.get('/api/v1/system/info', async () => ({
    product: 'DGOS',
    version: 'v1',
    apiVersion,
    implementationStatus: 'foundation',
  }));

  return app;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const redis = process.env.REDIS_URL ? createClient({ url: process.env.REDIS_URL }) : null;
  if (redis) await redis.connect();
  const app = buildServer({ rateLimiter: createRateLimiter({ redis }) });
  if (redis) app.addHook('onClose', async () => redis.quit());
  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ host, port });
}
