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

export function buildServer({ logger = true, repository, providerRepository, providerService, secretService = new InMemorySecretService(), rateLimiter, clock } = {}) {
  const resolvedRepository = repository ?? (process.env.DGOS_DATABASE_URL ? new PostgresIdentityRepository(new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL })) : new InMemoryIdentityRepository());
  const app = Fastify({ logger });
  const identity = new IdentityService({ repository: resolvedRepository, secretService, clock });
  const providers = providerService ?? new ProviderService({ repository: providerRepository ?? (process.env.DGOS_DATABASE_URL ? new PostgresProviderRepository(new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL })) : new InMemoryProviderRepository()), secretService, egress: new ProviderEgress(), adapters: { 'openai-compatible': createOpenAiCompatibleAdapter() } });
  const loginLimiter = rateLimiter ?? createRateLimiter({ clock });
  const maxLoginAttempts = 5;
  const loginWindowMs = 60_000;

  app.addHook('onRequest', async (request, reply) => {
    request.requestId = request.headers['x-request-id'] || randomUUID();
    reply.header('x-request-id', request.requestId);
  });
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    const messages = { invalid_request: 'Request is invalid', bootstrap_already_completed: 'Bootstrap is unavailable', invalid_credentials: 'Authentication failed', authentication_required: 'Authentication required', insufficient_scope: 'Required capability is missing', rate_limited: 'Too many authentication attempts', csrf_failed: 'Request origin validation failed', session_invalid: 'Session is invalid', session_conflict: 'Session changed; retry with a fresh session', session_not_found: 'Session not found', api_key_not_found: 'API key not found', protocol_unavailable: 'Provider protocol is unavailable', provider_account_not_found: 'Provider account not found', provider_account_conflict: 'Provider account changed; retry with a fresh version', connection_test_not_found: 'Connection test not found' };
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
  app.post('/api/v1/provider/accounts/:accountId/bindings', async (request, reply) => { await validateCsrf(request); await requireScope(request, 'provider.account.write'); return reply.code(201).send(await providers.bindAccount({ accountId: request.params.accountId, ...request.body })); });
  app.post('/api/v1/provider/accounts/:accountId/state', async (request) => { await validateCsrf(request); await requireScope(request, 'provider.account.write'); return providers.setState({ accountId: request.params.accountId, ...request.body }); });
  app.delete('/api/v1/provider/accounts/:accountId', async (request) => { await validateCsrf(request); await requireScope(request, 'provider.account.delete'); return providers.deleteAccount({ accountId: request.params.accountId, version: request.body?.baseVersion }); });
  app.post('/api/v1/provider/connection-tests', async (request, reply) => { await validateCsrf(request); const auth = await requireScope(request, 'provider.connection_test'); const result = await providers.startConnectionTest({ ...request.body, requestId: request.requestId }); const account = await providers.repository?.getAccount?.(result.accountId); if (account && account.ownerId !== auth.subjectId && auth.authMethod !== 'session') throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 }); return reply.code(202).send(result); });
  app.get('/api/v1/provider/connection-tests/:testId', async (request) => { await requireScope(request, 'provider.connection_test'); return providers.getConnectionTest(request.params.testId); });
  app.delete('/api/v1/provider/connection-tests/:testId', async (request) => { await validateCsrf(request); await requireScope(request, 'provider.connection_test'); return providers.cancelConnectionTest(request.params.testId); });

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
