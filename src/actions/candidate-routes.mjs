import { resolveNaturalLanguageCandidates } from './system-actions.mjs';
import { publicActionDeclaration } from './public-declaration.mjs';

const aliases = {
  'system.navigate.system.settings': ['open settings', '打开设置', '系统设置'],
  'system.navigate.provider.settings': ['open providers', '模型设置', 'provider设置'],
  'system.navigate.skill.management': ['open skills', 'skill管理'],
  'system.navigate.mcp.management': ['open mcp', 'mcp管理'],
  'system.navigate.app.catalog': ['open app catalog', '打开应用目录', '应用商店'],
};

export function registerCandidateRoutes(app, { actions, permissions, requireScope, validateCsrf }) {
  app.post('/api/v1/actions/resolve', async (request) => {
    await validateCsrf(request);
    const auth = await requireScope(request, 'action.read');
    const body = request.body;
    if (!body || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 4096 || Object.keys(body).some((key) => !['text', 'requestId'].includes(key))) {
      throw Object.assign(new Error('invalid_request'), { statusCode: 422 });
    }
    // Deterministic resolution is local and never incurs an unconfirmed model call.
    const result = await resolveNaturalLanguageCandidates(body.text.slice(0, 2000), { registry: actions.registry, permissions, subjectId: auth.subjectId, requestId: request.requestId, aliases });
    const candidates = [];
    for (const candidate of result.candidates) {
      const action = actions.registry.get(candidate.actionId);
      const input = candidate.input ?? {};
      try { actions.validateInput(action, input); } catch { continue; }
      const decisions = await actions.checkActionPermissions(action, auth.subjectId, request.requestId);
      if (!decisions.length || decisions.some((permission) => permission.decision === 'deny')) continue;
      candidates.push({ actionId: action.actionId, actionVersion: String(action.actionVersion), input, risk: publicActionDeclaration(action).risk, permission: decisions.every((permission) => permission.decision === 'allow') ? 'allow' : 'ask', executable: false });
    }
    return { requestId: body.requestId ?? request.requestId, candidates };
  });
}
