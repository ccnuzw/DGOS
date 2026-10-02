import { DiskPackageStore, PackageService } from '../../../src/apps/package-service.mjs';
import { InMemoryPackageRepository } from '../../../src/apps/package-repository.mjs';
import { PostgresPackageRepository } from '../../../src/apps/postgres-package-repository.mjs';

const publicBody = (value, allowed) => {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !allowed.includes(key))) throw Object.assign(new Error('invalid_request'), { statusCode: 422 });
  return value;
};
const envelopeFields = ['requestId', 'manifest', 'files', 'resourceDigests', 'keyId', 'signature'];
const releaseFields = ['requestId', 'version', 'build', 'releaseChannel', 'baseVersion', 'reason'];
const mutationFields = ['requestId', 'baseVersion'];

// The host owns authentication, CSRF and key provisioning. No request may supply a trust root.
export function registerPackageRoutes(app, { pool, repository = pool ? new PostgresPackageRepository(pool) : new InMemoryPackageRepository(), store = new DiskPackageStore(process.env.DGOS_PACKAGE_ROOT), trustRoots, audit, requireScope, validateCsrf, validateLaunchSession, onActionsChanged, packageLimits, healthProbe, bridgeHandlers, bridgeAuthorize } = {}) {
  if (!trustRoots || !requireScope || !validateCsrf) throw new Error('package_routes_dependencies_required');
  const service = new PackageService({ repository, store, trustRoots, audit, onActionsChanged, packageLimits, healthProbe, bridgeHandlers, bridgeAuthorize });
  // Lead attaches app.addHook('onReady', () => service.ready()) after combining routes.
  const write = async (request, scope) => { await validateCsrf(request); return requireScope(request, scope); };
  app.get('/api/v1/apps', async (request) => { await requireScope(request, 'app.catalog.read'); return { items: await repository.listPackages({ publicOnly: true }) }; });
  app.get('/api/v1/apps/:appId/deployment', async (request) => { const actor = await requireScope(request, 'app.catalog.read'); return service.getAppDeployment(actor.subjectId, request.params.appId); });
  app.get('/api/v1/apps/:appId', async (request) => { await requireScope(request, 'app.catalog.read'); const record = await repository.getPackage(request.params.appId, request.query?.version, request.query?.build, request.query?.releaseChannel); if (!record || !['official', 'approved'].includes(record.catalogState)) throw Object.assign(new Error('app_not_available'), { statusCode: 404 }); return record; });
  app.post('/api/v1/apps', async (request, reply) => { const actor = await write(request, 'app.catalog.manage'); const { manifest, files, resourceDigests, keyId, signature } = publicBody(request.body, envelopeFields); return reply.code(201).send(await service.submit({ manifest, files, resourceDigests, keyId, signature, actorId: actor.subjectId, requestId: request.requestId })); });
  for (const [action, decision] of [['approve', 'approved'], ['reject', 'rejected'], ['withdraw', 'withdrawn']]) app.post(`/api/v1/apps/:appId/${action}`, async (request) => {
    const actor = await write(request, 'app.catalog.manage');
    const roles = Array.isArray(actor.roles) ? actor.roles : [];
    const wildcardAdmin = Array.isArray(actor.scopes) && actor.scopes.includes('*');
    if (actor.authMethod !== 'session' || !(wildcardAdmin || actor.isAdmin === true || roles.includes('admin') || roles.includes('catalog-admin'))) throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 });
    const { version, build, releaseChannel, baseVersion, reason } = publicBody(request.body, releaseFields);
    return service.review({ version, build, releaseChannel, baseVersion, reason, appId: request.params.appId, decision, actorId: actor.subjectId, requestId: request.requestId });
  });
  app.post('/api/v1/apps/:appId/test-install', async (request) => { const actor = await write(request, 'app.package.test_install'); const { version, build, releaseChannel, baseVersion } = publicBody(request.body, releaseFields); return service.install({ version, build, releaseChannel, baseVersion, appId: request.params.appId, subjectId: actor.subjectId, actorId: actor.subjectId, requestId: request.requestId, developerTest: true }); });
  app.post('/api/v1/apps/:appId/install', async (request) => { const actor = await write(request, 'app.install'); const { version, build, releaseChannel, baseVersion } = publicBody(request.body, releaseFields); return service.install({ version, build, releaseChannel, baseVersion, appId: request.params.appId, subjectId: actor.subjectId, actorId: actor.subjectId, requestId: request.requestId }); });
  app.post('/api/v1/apps/:appId/update', async (request) => { const actor = await write(request, 'app.lifecycle'); const { version, build, releaseChannel, baseVersion } = publicBody(request.body, releaseFields); return service.install({ version, build, releaseChannel, baseVersion, appId: request.params.appId, subjectId: actor.subjectId, actorId: actor.subjectId, requestId: request.requestId }); });
  app.post('/api/v1/apps/:appId/launch', async (request) => { const actor = await write(request, 'app.lifecycle'); publicBody(request.body, mutationFields); return service.launch({ appId: request.params.appId, subjectId: actor.subjectId, sessionId: actor.sessionId }); });
  app.post('/api/v1/apps/:appId/bridge', async (request) => { const actor = await write(request, 'app.lifecycle'); const { instanceId, requestId, capability, input } = publicBody(request.body, ['instanceId', 'requestId', 'capability', 'input']); return service.bridge({ instanceId, requestId, capability, input, appId: request.params.appId, subjectId: actor.subjectId, sessionId: actor.sessionId }); });
  app.post('/api/v1/apps/:appId/uninstall', async (request) => { const actor = await write(request, 'app.lifecycle'); const { baseVersion } = publicBody(request.body, mutationFields); return service.uninstall({ appId: request.params.appId, subjectId: actor.subjectId, actorId: actor.subjectId, requestId: request.requestId, baseVersion }); });
  app.get('/api/v1/apps/:appId/health', async (request) => { const actor = await requireScope(request, 'app.lifecycle'); return service.health({ appId: request.params.appId, subjectId: actor.subjectId }); });
  app.get('/api/v1/apps/:appId/resources/*', async (request, reply) => {
    const ticket = request.query?.launchTicket;
    const path = request.params['*'];
    let actor;
    if (ticket) {
      if (!validateLaunchSession) throw Object.assign(new Error('capability_unavailable'), { statusCode: 503 });
      const launch = service.resolveLaunch(ticket, request.params.appId, path);
      const valid = await validateLaunchSession({ sessionId: launch.sessionId, subjectId: launch.subjectId });
      if (valid !== true) throw Object.assign(new Error('launch_ticket_invalid'), { statusCode: 403 });
      actor = { subjectId: launch.subjectId, sessionId: launch.sessionId };
    } else actor = await requireScope(request, 'app.lifecycle');
    const content = await service.resource({ subjectId: actor.subjectId, sessionId: actor.sessionId, appId: request.params.appId, path, launchTicket: ticket });
    reply.header('cache-control', 'no-store').header('x-content-type-options', 'nosniff').header('referrer-policy', 'no-referrer').header('cross-origin-resource-policy', ticket ? 'cross-origin' : 'same-origin');
    if (ticket) reply.header('access-control-allow-origin', 'null').header('vary', 'Origin');
    if (path.endsWith('.html')) reply.header('content-type', 'text/html; charset=utf-8').header('content-security-policy', "sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'");
    else if (path.endsWith('.css')) reply.header('content-type', 'text/css; charset=utf-8');
    else if (path.endsWith('.js')) reply.header('content-type', 'text/javascript; charset=utf-8');
    else reply.header('content-type', 'application/octet-stream');
    return reply.send(path.endsWith('.html') && ticket ? Buffer.from(content.toString('utf8').replaceAll('__DGOS_LAUNCH_TICKET__', encodeURIComponent(ticket))) : content);
  });
  return service;
}
