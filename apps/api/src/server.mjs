import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { apiVersion } from '@dgos/sdk';
import { InMemorySecretService } from '../../../src/security/secret-service.mjs';
import { InMemoryIdentityRepository, PostgresIdentityRepository } from '../../../src/identity/repository.mjs';
import { IdentityService } from './identity-service.mjs';
import pg from 'pg';

export function buildServer({ logger = true, repository, secretService = new InMemorySecretService(), clock } = {}) {
  const resolvedRepository = repository ?? (process.env.DGOS_DATABASE_URL ? new PostgresIdentityRepository(new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL })) : new InMemoryIdentityRepository());
  const app = Fastify({ logger });
  const identity = new IdentityService({ repository: resolvedRepository, secretService, clock });

  app.addHook('onRequest', async (request, reply) => {
    request.requestId = request.headers['x-request-id'] || randomUUID();
    reply.header('x-request-id', request.requestId);
  });
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    const messages = { invalid_request: 'Request is invalid', bootstrap_already_completed: 'Bootstrap is unavailable', invalid_credentials: 'Authentication failed', session_invalid: 'Session is invalid', session_conflict: 'Session changed; retry with a fresh session', session_not_found: 'Session not found', api_key_not_found: 'API key not found' };
    reply.code(statusCode).send({ errorKey: error.message in messages ? error.message : 'internal_error', message: messages[error.message] ?? 'Request failed', requestId: request.requestId, retryable: statusCode >= 500 });
  });

  async function currentSession(request) {
    const cookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('dgos_session='))?.slice('dgos_session='.length);
    const token = request.headers.authorization?.startsWith('Bearer ') ? request.headers.authorization.slice(7) : cookie;
    if (!token) throw Object.assign(new Error('session_invalid'), { statusCode: 401 });
    return identity.getSession(token);
  }
  function receiptCookie(reply, receipt) { reply.header('set-cookie', `dgos_session=${receipt.sessionId}; HttpOnly; Path=/; SameSite=Strict`); }

  app.post('/api/v1/identity/admin/bootstrap', async (request, reply) => { const result = await identity.bootstrap({ ...request.body, requestId: request.requestId }); receiptCookie(reply, result); return reply.code(201).send(result); });
  app.post('/api/v1/identity/admin/login', async (request, reply) => { const result = await identity.login({ ...request.body, requestId: request.requestId }); receiptCookie(reply, result); return result; });
  app.get('/api/v1/identity/admin/session', async (request) => { const session = await currentSession(request); return { ...session, requestId: request.requestId }; });
  app.post('/api/v1/identity/admin/session', async (request, reply) => { const session = await currentSession(request); const result = await identity.renewSession({ sessionId: session.sessionId, version: request.body?.baseVersion ?? session.sessionVersion, requestId: request.requestId }); receiptCookie(reply, result); return result; });
  app.delete('/api/v1/identity/admin/sessions/:sessionId', async (request) => { const session = await currentSession(request); return identity.revokeSession({ sessionId: request.params.sessionId, actorId: session.principalId, requestId: request.requestId }); });
  app.get('/api/v1/secret/api-keys', async (request) => { const session = await currentSession(request); return identity.listKeys(session.principalId); });
  app.post('/api/v1/secret/api-keys', async (request, reply) => { const session = await currentSession(request); const body = { ...request.body, ownerId: request.body?.ownerId ?? session.principalId }; const result = await identity.createKey({ ...body, actorId: session.principalId, requestId: request.requestId }); return reply.code(201).send(result); });
  app.post('/api/v1/secret/api-keys/:keyId/rotate', async (request) => { const session = await currentSession(request); return identity.rotateKey({ keyId: request.params.keyId, actorId: session.principalId, requestId: request.requestId }); });
  app.delete('/api/v1/secret/api-keys/:keyId', async (request) => { const session = await currentSession(request); return identity.revokeKey({ keyId: request.params.keyId, actorId: session.principalId, requestId: request.requestId }); });

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
  const app = buildServer();
  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ host, port });
}
