export function registerIdentityRoutes(app, { identity, currentSession, validateCsrf, requireFreshSession, receiptCookie, authenticationBackoff, loginLimiter, maxLoginAttempts, loginWindowMs }) {
  app.post('/api/v1/identity/admin/bootstrap', async (request, reply) => { const result = await identity.bootstrap({ ...request.body, requestId: request.requestId }); receiptCookie(reply, result); return reply.code(201).send(result); });
  app.post('/api/v1/identity/admin/login', async (request, reply) => {
    const source = request.ip; const subject = request.body?.principalHint;
    const backoff = await authenticationBackoff.check({ subject, source });
    const attempts = await loginLimiter.consume(source, { limit: maxLoginAttempts, windowMs: loginWindowMs });
    if (!backoff.allowed || !attempts.allowed) {
      const retryAfter = Math.max(1, Math.ceil(Math.max(backoff.retryAfterMs, attempts.allowed ? 0 : attempts.retryAfterMs) / 1000));
      reply.header('retry-after', retryAfter);
      throw Object.assign(new Error('rate_limited'), { statusCode: 429, retryAfter });
    }
    try { const result = await identity.login({ ...request.body, requestId: request.requestId }); await authenticationBackoff.success({ subject }); await loginLimiter.reset(source); receiptCookie(reply, result); return result; }
    catch (error) { if (error.statusCode === 401) await authenticationBackoff.failure({ subject, source }); throw error; }
  });
  app.get('/api/v1/identity/admin/session', async (request) => ({ ...await currentSession(request), requestId: request.requestId }));
  app.post('/api/v1/identity/admin/session', async (request, reply) => { await validateCsrf(request); const session = await currentSession(request); const result = await identity.renewSession({ sessionId: session.sessionId, version: request.body?.baseVersion ?? session.sessionVersion, requestId: request.requestId }); receiptCookie(reply, result); return result; });
  app.delete('/api/v1/identity/admin/session', async (request, reply) => {
    await validateCsrf(request);
    try { const session = await currentSession(request); await identity.revokeSession({ sessionId: session.sessionId, actorId: session.principalId, requestId: request.requestId }); }
    catch (error) { if (error.statusCode !== 401) throw error; }
    reply.header('set-cookie', `dgos_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    return reply.code(204).send();
  });
  app.get('/api/v1/identity/admin/sessions', async (request, reply) => {
    const session = await currentSession(request);
    if (Object.keys(request.query ?? {}).some((key) => !['limit', 'cursor'].includes(key))) throw Object.assign(new Error('invalid_request'), { statusCode: 422 });
    const result = await identity.listSessions({ actorId: session.principalId, currentSessionId: session.sessionId, requestId: request.requestId, ...request.query });
    reply.header('cache-control', 'no-store'); return result;
  });
  app.delete('/api/v1/identity/admin/sessions/:sessionId', async (request, reply) => {
    await validateCsrf(request);
    const session = await currentSession(request);
    await requireFreshSession(request, { subjectId: session.principalId, sessionId: session.sessionId, authMethod: 'session', scopes: ['*'] });
    const requestId = request.body?.requestId;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId ?? '')) throw Object.assign(new Error('invalid_request'), { statusCode: 422 });
    const result = await identity.revokeManagedSession({ managementId: request.params.sessionId, actorId: session.principalId, requestId });
    reply.header('cache-control', 'no-store'); return result;
  });
}
