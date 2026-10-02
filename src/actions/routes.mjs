// Lead wires this module into the shared Fastify server after the worker and migration land.
export function registerActionRoutes(app, { service, readAuth, writeAuth, scopedBody, requireFreshSession }) {
  app.get('/api/v1/actions', async (request) => { await readAuth(request, 'action.read'); return service.list(); });
  app.post('/api/v1/actions/:actionId/plan', async (request) => { const auth = await readAuth(request, 'action.plan'); return service.plan({ ...scopedBody(request, auth), actionId: request.params.actionId, subjectId: auth.subjectId, requestId: request.requestId }); });
  app.post('/api/v1/actions/:actionId/execute', async (request, reply) => {
    const auth = await writeAuth(request, 'action.execute');
    const input = scopedBody(request, auth);
    const policy = await service.executionPolicy({ actionId: request.params.actionId, planId: input.planId, input: input.input, subjectId: auth.subjectId });
    if (policy.freshSessionRequired) {
      if (!requireFreshSession) throw Object.assign(new Error('step_up_required'), { statusCode: 403 });
      await requireFreshSession(request, auth);
    }
    return reply.code(202).send(await service.execute({ ...input, actionId: request.params.actionId, subjectId: auth.subjectId, requestId: request.requestId, confirmed: request.body?.confirmed === true }));
  });
  app.get('/api/v1/action-runs/:runId', async (request) => { const auth = await readAuth(request, 'action.read'); return service.get(request.params.runId, auth.subjectId); });
  app.delete('/api/v1/action-runs/:runId', async (request) => { const auth = await writeAuth(request, 'action.execute'); return service.cancel(request.params.runId, auth.subjectId, request.requestId); });
}
