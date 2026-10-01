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
import { InMemoryQuotaRepository, PostgresQuotaRepository } from '../../../src/quota/repository.mjs';
import { QuotaService } from '../../../src/quota/service.mjs';
import { InMemoryAppRepository } from '../../../src/apps/repository.mjs';
import { CatalogService } from '../../../src/apps/catalog-service.mjs';
import { AppRuntimeService } from '../../../src/apps/runtime-service.mjs';
import { InMemoryPermissionRepository } from '../../../src/permissions/repository.mjs';
import { PermissionBroker } from '../../../src/permissions/broker.mjs';
import { ActionRegistry } from '../../../src/actions/registry.mjs';
import { ActionService } from '../../../src/actions/service.mjs';
import { SystemService } from '../../../src/system/service.mjs';

export function buildServer({ logger = true, repository, providerRepository, providerService, secretService = new InMemorySecretService(), rateLimiter, clock } = {}) {
  const resolvedRepository = repository ?? (process.env.DGOS_DATABASE_URL ? new PostgresIdentityRepository(new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL })) : new InMemoryIdentityRepository());
  const app = Fastify({ logger });
  const identity = new IdentityService({ repository: resolvedRepository, secretService, clock });
  const providers = providerService ?? new ProviderService({ repository: providerRepository ?? (process.env.DGOS_DATABASE_URL ? new PostgresProviderRepository(new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL })) : new InMemoryProviderRepository()), secretService, egress: new ProviderEgress(), adapters: { 'openai-compatible': createOpenAiCompatibleAdapter() } });
  const audit = process.env.DGOS_DATABASE_URL ? new PostgresAuditRepository(new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL })) : new InMemoryAuditRepository();
  const governance = new GovernanceService({ retentionRepository: process.env.DGOS_DATABASE_URL ? new PostgresRetentionRepository(new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL })) : new InMemoryRetentionRepository(audit), auditRepository: audit });
  const quotaPool = process.env.DGOS_DATABASE_URL ? new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL }) : null;
  const quota = new QuotaService({ repository: quotaPool ? new PostgresQuotaRepository(quotaPool) : new InMemoryQuotaRepository(), audit, clock });
  const appRepository = new InMemoryAppRepository({ audit });
  const catalog = new CatalogService({ repository: appRepository, audit });
  const runtime = new AppRuntimeService({ repository: appRepository, audit });
  const permissions = new PermissionBroker({ repository: new InMemoryPermissionRepository(), audit });
  const actionRegistry = new ActionRegistry();
  const actions = new ActionService({ registry: actionRegistry, permissions, audit });
  const system = new SystemService({ audit });
  const loginLimiter = rateLimiter ?? createRateLimiter({ clock });
  const maxLoginAttempts = 5;
  const loginWindowMs = 60_000;

  app.addHook('onRequest', async (request, reply) => {
    request.requestId = request.headers['x-request-id'] || randomUUID();
    reply.header('x-request-id', request.requestId);
  });
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    const messages = { invalid_request: 'Request is invalid', bootstrap_already_completed: 'Bootstrap is unavailable', invalid_credentials: 'Authentication failed', authentication_required: 'Authentication required', insufficient_scope: 'Required capability is missing', rate_limited: 'Too many authentication attempts', csrf_failed: 'Request origin validation failed', session_invalid: 'Session is invalid', session_conflict: 'Session changed; retry with a fresh session', session_not_found: 'Session not found', api_key_not_found: 'API key not found', protocol_unavailable: 'Provider protocol is unavailable', provider_account_not_found: 'Provider account not found', provider_account_conflict: 'Provider account changed; retry with a fresh version', connection_test_not_found: 'Connection test not found', retention_preview_conflict: 'Retention preview changed; refresh before executing', retention_job_not_found: 'Retention job not found', quota_exceeded: 'Quota exceeded', quota_unavailable: 'Quota service unavailable', reservation_conflict: 'Reservation conflict', reservation_not_found: 'Reservation not found', policy_version_conflict: 'Quota policy version conflict', manifest_invalid: 'App manifest is invalid', app_not_available: 'App is not available in this catalog', app_install_conflict: 'App install is already in progress', health_check_failed: 'App health check failed and was rolled back', app_not_installed: 'App is not installed', app_uninstall_forbidden: 'App cannot be uninstalled', permission_denied: 'Permission denied', confirmation_required: 'Confirmation is required', action_not_found: 'Action not found', action_run_not_found: 'Action run not found', version_conflict: 'Version conflict' };
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
  app.get('/api/v1/audit/events', async (request) => { const auth = await requireScope(request, 'audit.read'); const query = request.query ?? {}; const isApiKey = auth.authMethod === 'api_key'; return audit.query({ ...query, restrictActorId: isApiKey ? auth.subjectId : undefined }); });
  app.post('/api/v1/admin/governance/retention-sweeps', async (request, reply) => { await validateCsrf(request); const auth = await requireScope(request, 'retention.write'); return reply.code(202).send(await governance.startRetention({ ...request.body, requestId: request.requestId, actorId: auth.subjectId })); });
  app.get('/api/v1/admin/governance/retention-sweeps/:jobId', async (request) => { await requireScope(request, 'retention.read'); return governance.getRetention(request.params.jobId); });
  app.post('/api/v1/admin/governance/retention-sweeps/:jobId/run', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'retention.write'); return governance.runRetention(request.params.jobId, request.requestId, auth.subjectId); });
  app.post('/api/v1/quota/preflight', async (request) => { const auth = await requireScope(request, 'quota.read'); const body = request.body ?? {}; const target = body.target ?? {}; return quota.preflightQuota({ ...target, ...body, requestId: body.requestId ?? request.requestId, subjectId: target.subjectId ?? body.subjectId ?? auth.subjectId, scopeType: target.scopeType ?? 'subject', scopeId: target.scopeId ?? target.subjectId ?? body.subjectId ?? auth.subjectId }); });
  app.post('/api/v1/quota/reservations', async (request, reply) => { await validateCsrf(request); const auth = await requireScope(request, 'quota.manage'); const body = request.body ?? {}; const target = body.target ?? {}; return reply.code(201).send(await quota.reserveQuota({ ...target, ...body, requestId: body.requestId ?? request.requestId, subjectId: target.subjectId ?? body.subjectId ?? auth.subjectId, scopeType: target.scopeType ?? 'subject', scopeId: target.scopeId ?? target.subjectId ?? body.subjectId ?? auth.subjectId })); });
  app.post('/api/v1/quota/reservations/:reservationId/settle', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'quota.manage'); const body = request.body ?? {}; return quota.settleUsage({ ...body, reservationId: request.params.reservationId, requestId: body.requestId ?? request.requestId, actorId: auth.subjectId, usageStatus: body.usage?.status ?? body.usageStatus, amount: body.usage?.totalTokens ?? body.amount ?? 1, estimated: body.usage?.status === 'estimated', sourceDigest: body.usage?.sourceDigest }); });
  app.get('/api/v1/usage', async (request) => { const auth = await requireScope(request, 'usage.read'); const subjectId = auth.authMethod === 'session' && request.query?.subjectId ? request.query.subjectId : auth.subjectId; if (auth.authMethod === 'api_key' && request.query?.subjectId && request.query.subjectId !== auth.subjectId) throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 }); return quota.queryUsage({ ...request.query, subjectId }); });
  app.get('/api/v1/quota/policies', async (request) => { const auth = await requireScope(request, 'quota.read'); return quota.listPolicies({ subjectId: auth.subjectId }); });
  app.put('/api/v1/quota/policies', async (request) => { await validateCsrf(request); const auth = await requireScope(request, 'quota.manage'); const body = request.body ?? {}; const scope = body.scope ?? {}; return quota.updatePolicy({ ...body, scopeType: body.scopeType ?? scope.type, scopeId: body.scopeId ?? scope.id, hardLimit: body.hardLimit ?? body.limit, windowSeconds: body.windowSeconds ?? ({ hour: 3600, day: 86400, month: 2592000, rolling: 3600 }[body.window] ?? 3600), requestId: body.requestId ?? request.requestId, actorId: auth.subjectId }); });

  const appAuth = async (request, scope) => requireScope(request, scope);
  app.get('/api/v1/apps', async (request) => { await appAuth(request, 'app.catalog.read'); return catalog.list({ publicOnly: true }); });
  app.get('/api/v1/apps/:appId', async (request) => { await appAuth(request, 'app.catalog.read'); const item = await appRepository.getApp(request.params.appId, request.query?.version, request.query?.build); if (!item || !['official', 'approved'].includes(item.catalogState)) throw Object.assign(new Error('app_not_available'), { statusCode: 404 }); return item; });
  app.post('/api/v1/apps', async (request, reply) => { const auth = await appAuth(request, 'app.catalog.manage'); return reply.code(201).send(await catalog.submit({ ...request.body, actorId: auth.subjectId })); });
  app.post('/api/v1/apps/:appId/approve', async (request) => { const auth = await appAuth(request, 'app.catalog.manage'); return catalog.approve({ ...request.body, appId: request.params.appId, actorId: auth.subjectId }); });
  app.post('/api/v1/apps/:appId/reject', async (request) => { const auth = await appAuth(request, 'app.catalog.manage'); return catalog.reject({ ...request.body, appId: request.params.appId, actorId: auth.subjectId }); });
  app.post('/api/v1/apps/:appId/withdraw', async (request) => { const auth = await appAuth(request, 'app.catalog.manage'); return catalog.withdraw({ ...request.body, appId: request.params.appId, actorId: auth.subjectId }); });
  app.post('/api/v1/apps/:appId/test-install', async (request) => { const auth = await appAuth(request, 'app.install'); return runtime.install({ ...request.body, appId: request.params.appId, subjectId: auth.subjectId, developerTest: true, actorId: auth.subjectId }); });
  app.post('/api/v1/apps/:appId/install', async (request) => { const auth = await appAuth(request, 'app.install'); return runtime.install({ ...request.body, appId: request.params.appId, subjectId: auth.subjectId, actorId: auth.subjectId }); });
  app.post('/api/v1/apps/:appId/launch', async (request) => { const auth = await appAuth(request, 'app.lifecycle'); return runtime.launch({ appId: request.params.appId, subjectId: auth.subjectId }); });
  app.post('/api/v1/apps/:appId/update', async (request) => { const auth = await appAuth(request, 'app.lifecycle'); return runtime.update({ ...request.body, appId: request.params.appId, subjectId: auth.subjectId, actorId: auth.subjectId }); });
  app.post('/api/v1/apps/:appId/uninstall', async (request) => { const auth = await appAuth(request, 'app.lifecycle'); return runtime.uninstall({ appId: request.params.appId, subjectId: auth.subjectId, actorId: auth.subjectId }); });
  app.get('/api/v1/apps/:appId/health', async (request) => { const auth = await appAuth(request, 'app.lifecycle'); return runtime.health({ appId: request.params.appId, subjectId: auth.subjectId }); });

  app.post('/api/v1/permissions/check', async (request) => { const auth = await appAuth(request, 'permission.read'); return permissions.check({ ...request.body, subjectId: request.body?.subjectId ?? auth.subjectId, requestId: request.requestId }); });
  app.post('/api/v1/permissions/request', async (request, reply) => { const auth = await appAuth(request, 'permission.read'); return reply.code(202).send(await permissions.request({ ...request.body, subjectId: request.body?.subjectId ?? auth.subjectId, requestId: request.requestId })); });
  app.patch('/api/v1/permissions', async (request) => { const auth = await appAuth(request, 'permission.manage'); return permissions.decide({ ...request.body, subjectId: request.body?.subjectId ?? auth.subjectId, requestId: request.requestId }); });

  app.get('/api/v1/actions', async (request) => { await appAuth(request, 'action.read'); return actions.list(); });
  app.post('/api/v1/actions/:actionId/plan', async (request) => { const auth = await appAuth(request, 'action.plan'); return actions.plan({ ...request.body, actionId: request.params.actionId, subjectId: auth.subjectId, requestId: request.requestId }); });
  app.post('/api/v1/actions/:actionId/execute', async (request, reply) => { const auth = await appAuth(request, 'action.execute'); return reply.code(202).send(await actions.execute({ ...request.body, actionId: request.params.actionId, subjectId: auth.subjectId, requestId: request.requestId })); });
  app.get('/api/v1/action-runs/:runId', async (request) => { const auth = await appAuth(request, 'action.read'); return actions.get(request.params.runId, auth.subjectId); });
  app.delete('/api/v1/action-runs/:runId', async (request) => { const auth = await appAuth(request, 'action.execute'); return actions.cancel(request.params.runId, auth.subjectId, request.requestId); });

  app.get('/api/v1/system/settings', async (request) => { await appAuth(request, 'system.settings.read'); return system.snapshot(); });
  app.patch('/api/v1/system/settings', async (request) => { const auth = await appAuth(request, 'system.settings.write'); return system.patch({ ...request.body, actorId: auth.subjectId, requestId: request.requestId }); });
  app.get('/api/v1/system/context', async (request) => { await appAuth(request, 'system.settings.read'); return system.context(); });
  app.get('/api/v1/system/context/events', async (request) => { await appAuth(request, 'system.settings.read'); return { items: system.getEvents(request.query?.afterVersion ?? 0) }; });

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
