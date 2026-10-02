import { normalizeSystemSettings, validateSystemDomain } from '../../../src/system/service.mjs';
import { stableActionDigest } from '../../../src/actions/service.mjs';

const invalid = () => Object.assign(new Error('invalid_request'), { statusCode: 422 });
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
const writable = {
  appearance: ['appearanceMode','windowMaterial','interfaceMode','displayScale','lightWallpaperRef','darkWallpaperRef','wallpaperFollowsAppearance'],
  locale: ['uiLocale','regionFormat','assistantLanguage','projectContentLanguage'],
  network: ['proxyMode','manualProxyRef'],
  grid: ['enabled','style','spacing','majorLineEvery','showAxes','snapEnabled','snapTolerance','colorToken','opacity'],
  privacy: ['telemetry'],
  appPermissions: ['rules'],
};
export const settingsProjection = (snapshot, appPermissions) => {
  const settings = normalizeSystemSettings(snapshot.settings);
  return {
    settingsVersion: snapshot.settingsVersion,
    appearance: settings.appearance, locale: settings.locale,
    network: settings.network, grid: settings.grid,
    privacy: settings.privacy, ...(appPermissions === undefined ? {} : { appPermissions }),
    restartRequired: Boolean(settings.network.restartRequired),
    affectedServices: settings.network.affectedServices,
  };
};
const sse = (events) => events.map((event) => `id: ${event.contextVersion}\nevent: system.context.changed\ndata: ${JSON.stringify({ contextVersion: event.contextVersion, domain: event.domain, restartRequired: event.restartRequired })}\n\n`).join('');

export function registerSystemRoutes(app, { system, readAuth, writeAuth, permissionRules, requireFreshSession }) {
  if (!system || !readAuth || !writeAuth) throw new Error('system_routes_dependencies_required');
  app.get('/api/v1/system/settings', async (request) => {
    const auth = await readAuth(request, 'system.settings.read');
    const rules = permissionRules?.list ? await permissionRules.list({ subjectId: auth.subjectId }) : undefined;
    return settingsProjection(await system.snapshot(), rules);
  });
  app.patch('/api/v1/system/settings', async (request) => {
    const auth = await writeAuth(request, 'system.settings.write');
    const body = request.body;
    if (!object(body) || Object.keys(body).some((key) => !['requestId','baseVersion','domain','patch'].includes(key)) || typeof body.requestId !== 'string' || !body.requestId || typeof body.baseVersion !== 'string' || !/^[1-9]\d*$/.test(body.baseVersion) || !Object.hasOwn(writable, body.domain) || !object(body.patch) || Object.keys(body.patch).length === 0 || Object.keys(body.patch).some((key) => !writable[body.domain].includes(key))) throw invalid();
    if (['network', 'privacy', 'appPermissions'].includes(body.domain)) {
      if (!requireFreshSession) throw Object.assign(new Error('step_up_required'), { statusCode: 403 });
      await requireFreshSession(request, auth);
    }
    const fingerprint = stableActionDigest({ domain: body.domain, patch: body.patch, baseVersion: body.baseVersion });
    const replay = await system.replayRequest({ actorId: auth.subjectId, requestId: body.requestId, fingerprint });
    if (body.domain === 'appPermissions') {
      await writeAuth(request, 'permission.manage');
      if (!permissionRules?.patch || !permissionRules?.list) throw Object.assign(new Error('permission_unavailable'), { statusCode: 503 });
      if (!Array.isArray(body.patch.rules)) throw invalid();
      validateSystemDomain('appPermissions', body.patch.rules);
      if (body.patch.rules.some((rule) => rule.subjectId !== auth.subjectId)) throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 });
      const committed = await permissionRules.patch({ subjectId: auth.subjectId, actorId: auth.subjectId, requestId: body.requestId, baseVersion: body.baseVersion, rules: body.patch.rules, fingerprint, system });
      return settingsProjection(committed.snapshot, committed.rules);
    }
    if (replay) return settingsProjection(replay, permissionRules?.list ? await permissionRules.list({ subjectId: auth.subjectId }) : undefined);
    const current = await system.snapshot();
    let merged;
    merged = { ...current.settings[body.domain], ...body.patch };
    if (body.domain === 'locale') { merged.effectiveLocale = ['en-US','zh-CN'].includes(merged.uiLocale) ? merged.uiLocale : 'en-US'; merged.fallbackState = merged.effectiveLocale === merged.uiLocale ? 'none' : 'full'; }
    if (body.domain === 'network') { merged.effectiveRoute = current.settings.network.effectiveRoute; merged.affectedServices = current.settings.network.affectedServices; merged.restartRequired = true; }
    validateSystemDomain(body.domain, merged);
    try {
      const updated = await system.patch({ baseVersion: body.baseVersion, patch: { domain: body.domain, value: merged }, actorId: auth.subjectId, requestId: body.requestId, idempotencyFingerprint: fingerprint });
      return settingsProjection(updated, permissionRules?.list ? await permissionRules.list({ subjectId: auth.subjectId }) : undefined);
    } catch (error) {
      if (error.statusCode === 409 && error.current) error.current = settingsProjection(error.current);
      throw error;
    }
  });
  app.get('/api/v1/system/context', async (request) => {
    await readAuth(request, 'dgos.system.context.read');
    if (request.query && Object.keys(request.query).length) throw invalid();
    const current = await system.context(); const settings = normalizeSystemSettings(current.settings);
    return { contextVersion: current.contextVersion, appId: 'dgos.system', appearance: settings.appearance, locale: settings.locale, networkSummary: { proxyMode: settings.network.proxyMode, effectiveRoute: settings.network.effectiveRoute, affectedServices: settings.network.affectedServices, restartRequired: settings.network.restartRequired }, grid: settings.grid, windowState: { kind: 'none' }, lifecycleState: 'headless', issuedAt: new Date().toISOString() };
  });
  app.get('/api/v1/system/context/events', async (request, reply) => {
    await readAuth(request, 'dgos.system.context.events');
    const after = request.headers['last-event-id'] ?? request.query?.afterVersion ?? '0';
    if (!/^(0|[1-9]\d*)$/.test(String(after))) throw invalid();
    const events = system.repository?.eventsAfter ? await system.repository.eventsAfter(system.scopeId, after) : system.getEvents(after);
    reply.header('content-type', 'text/event-stream; charset=utf-8').header('cache-control', 'no-cache');
    return sse(events);
  });
}
