export function registerGovernanceRoutes(app, { governance, requireScope, validateCsrf, requireFreshSession }) {
  app.get('/api/v1/admin/governance/policy', async (request) => {
    await requireScope(request, 'governance.read');
    return governance.getPolicy();
  });
  app.put('/api/v1/admin/governance/policy', async (request) => {
    await validateCsrf(request);
    const auth = await requireScope(request, 'governance.write');
    await requireFreshSession(request, auth);
    return governance.updatePolicy({ ...request.body, actorId: auth.subjectId, requestId: request.requestId });
  });
  app.get('/api/v1/admin/governance/retention-preview', async (request) => {
    await requireScope(request, 'retention.read');
    return governance.previewRetention();
  });
}
