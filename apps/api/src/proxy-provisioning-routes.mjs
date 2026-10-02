import { PostgresProxyProvisioning } from '../../../src/security/proxy-provisioning.mjs';

export function registerProxyProvisioningRoutes(app, { pool, secretService, writeAuth, requireFreshSession, trustedTransport, lookup, allowLocalFixture = false } = {}) {
  if (!pool || !secretService || !writeAuth || !requireFreshSession || !trustedTransport) throw new Error('proxy_provisioning_dependencies_required');
  const provisioning = new PostgresProxyProvisioning({ pool, secretService, lookup, allowLocalFixture });
  const ready = provisioning.initializeKey().then(() => provisioning.recover());
  ready.catch(() => {});
  let closed = false;
  let recoveryTimer;
  ready.then(() => {
    if (closed) return;
    recoveryTimer = setInterval(() => { provisioning.recover().catch(() => {}); }, 15_000);
    recoveryTimer.unref();
  }).catch(() => {});
  app.addHook('onClose', async () => { closed = true; clearInterval(recoveryTimer); });
  app.post('/api/v1/system/network/proxy-configurations', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    if (!await trustedTransport(request) && !(allowLocalFixture && process.env.NODE_ENV !== 'production')) throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 });
    const auth = await writeAuth(request, 'system.settings.write');
    if (auth.authMethod !== 'session') throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 });
    await requireFreshSession(request, auth);
    await ready;
    const result = await provisioning.provision(auth.subjectId, request.body);
    return reply.code(201).send(result);
  });
  return { provisioning, ready, assertCommittedRef: (ref) => provisioning.assertCommittedRef(ref), recover: () => provisioning.recover() };
}
