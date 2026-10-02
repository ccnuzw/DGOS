import { stableActionDigest } from './service.mjs';

const settingsDomains = ['appearance', 'locale', 'network', 'grid', 'privacy', 'appPermissions'];
const navigationTargets = ['system.settings', 'provider.settings', 'skill.management', 'mcp.management', 'app.catalog'];

export function registerSystemActions(service, { system, navigation, permissionRules } = {}) {
  for (const domain of settingsDomains) {
    service.register({
      actionId: `system.settings.${domain}.patch`, ownerAppId: 'dgos.system', requiredCapability: 'system.settings.write',
      ...(domain === 'appPermissions' ? { requiredCapabilities: ['system.settings.write', 'permission.manage'] } : {}),
      riskLevel: ['network', 'privacy', 'appPermissions'].includes(domain) ? 'high' : 'medium', sideEffects: [`system.settings.${domain}`], timeout: 10_000,
      inputSchema: { type: 'object', required: ['baseVersion', 'value'], properties: { baseVersion: { type: 'string' }, value: { type: domain === 'appPermissions' ? 'array' : 'object' } } },
      description: `Update ${domain} system settings with a version check.`,
    }, async (input, context) => {
      if (context.signal?.aborted) throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
      if (domain === 'appPermissions') {
        if (!permissionRules) throw Object.assign(new Error('permission_unavailable'), { statusCode: 503 });
        const fingerprint = stableActionDigest({ domain: 'appPermissions', patch: { rules: input.value }, baseVersion: input.baseVersion });
        return permissionRules.patch({ subjectId: context.subjectId, actorId: context.subjectId, requestId: context.requestId, baseVersion: input.baseVersion, rules: input.value, fingerprint, system });
      }
      return system.patch({ patch: { domain, value: input.value }, baseVersion: input.baseVersion, actorId: context.subjectId, requestId: context.requestId });
    });
  }
  service.register({ actionId: 'system.settings.read', ownerAppId: 'dgos.system', requiredCapability: 'system.settings.read', riskLevel: 'low', sideEffects: [], inputSchema: { type: 'object', properties: {} }, description: 'Read the current system settings.' }, async () => system.snapshot());
  for (const target of navigationTargets) service.register({
    actionId: `system.navigate.${target}`, ownerAppId: 'dgos.system', requiredCapability: 'system.navigate', riskLevel: 'low', sideEffects: [],
    inputSchema: { type: 'object', properties: {} }, description: `Open ${target}.`,
  }, async (_input, context) => {
    if (context.signal?.aborted) throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
    return navigation?.open ? navigation.open(target, context) : { ok: true, target };
  });
}

export function resolveActionCandidates(text, { registry, aliases = {} } = {}) {
  if (typeof text !== 'string' || text.length === 0 || text.length > 2000) throw Object.assign(new Error('invalid_request'), { statusCode: 422 });
  const query = text.trim().toLocaleLowerCase();
  const candidates = registry.list().filter((action) => {
    const names = [action.actionId, ...(aliases[action.actionId] ?? [])];
    return names.some((name) => query.includes(String(name).toLocaleLowerCase()));
  }).map((action) => ({ actionId: action.actionId, actionVersion: String(action.actionVersion), riskLevel: action.riskLevel, requiredCapability: action.requiredCapability, inputSchema: action.inputSchema }));
  return { candidates, requiresClarification: candidates.length !== 1, executable: false };
}

function matchesInputSchema(action, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  if (JSON.stringify(input).length > 16_384) return false;
  const properties = action.inputSchema?.properties ?? {};
  if (Object.keys(input).some((name) => !(name in properties))) return false;
  if ((action.inputSchema?.required ?? []).some((name) => !(name in input))) return false;
  return Object.entries(input).every(([name, value]) => {
    const type = properties[name]?.type;
    return type === 'object' ? value && typeof value === 'object' && !Array.isArray(value)
      : type === 'array' ? Array.isArray(value)
        : type === 'integer' ? Number.isInteger(value)
          : !type || typeof value === type;
  });
}

export async function resolveNaturalLanguageCandidates(text, { registry, permissions, subjectId, requestId, provider, aliases = {} } = {}) {
  const fallback = resolveActionCandidates(text, { registry, aliases });
  const visible = [];
  for (const action of registry.list()) {
    const permission = await permissions.check({ subjectId, appId: action.ownerAppId, capability: action.requiredCapability, requestId, declared: [action.requiredCapability] });
    if (permission.decision !== 'deny') visible.push(action);
  }
  const visibleIds = new Set(visible.map((action) => action.actionId));
  fallback.candidates = fallback.candidates.filter((item) => visibleIds.has(item.actionId));
  fallback.requiresClarification = fallback.candidates.length !== 1;
  if (!provider) return { ...fallback, source: 'deterministic' };
  const summaries = visible.map(({ actionId, actionVersion, description, inputSchema }) => ({ actionId, actionVersion: String(actionVersion), description, inputSchema }));
  let proposed;
  try { proposed = await provider.resolve({ text, actions: summaries }); }
  catch { return { ...fallback, source: 'deterministic', providerUnavailable: true }; }
  if (!Array.isArray(proposed) || proposed.length > 8) throw Object.assign(new Error('invalid_request'), { statusCode: 422 });
  const candidates = [];
  for (const item of proposed) {
    const action = registry.get(item?.actionId);
    if (!action || !visibleIds.has(action.actionId) || String(action.actionVersion) !== String(item.actionVersion) || !matchesInputSchema(action, item.input ?? {})) continue;
    const permission = await permissions.check({ subjectId, appId: action.ownerAppId, capability: action.requiredCapability, requestId, declared: [action.requiredCapability] });
    if (permission.decision === 'deny') continue;
    candidates.push({ actionId: action.actionId, actionVersion: String(action.actionVersion), input: item.input ?? {}, riskLevel: action.riskLevel, permission: permission.decision });
  }
  return { candidates, requiresClarification: candidates.length !== 1, executable: false, source: 'provider' };
}
