import { validateAuditQuery } from '../../../src/audit/outbox.mjs';

export function registerAuditRoutes(app, { audit, requireScope }) {
  if (!audit?.query || !audit?.record || !requireScope) throw new Error('audit_routes_dependencies_required');
  app.get('/api/v1/audit/events', async (request) => {
    const auth = await requireScope(request, 'audit.read');
    const query = request.query ?? {};
    if (Object.keys(query).some((key) => !['from', 'to', 'actorId', 'action', 'cursor', 'limit'].includes(key))) throw Object.assign(new Error('invalid_request'), { statusCode: 422 });
    const restricted = auth.authMethod === 'api_key' ? auth.subjectId : undefined;
    validateAuditQuery({ ...query, restrictActorId: restricted });
    if (restricted && query.actorId && query.actorId !== restricted) throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 });
    await audit.record({ requestId: request.requestId, actorId: auth.subjectId, action: 'audit.query', targetType: 'audit_events', summary: {} });
    return audit.query({ ...query, restrictActorId: restricted });
  });
}
