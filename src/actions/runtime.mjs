import { randomUUID } from 'node:crypto';
import { ActionRegistry } from './registry.mjs';
import { ActionService, stableActionDigest } from './service.mjs';
import { ActionWorker } from './worker.mjs';
import { InMemoryActionRepository, PostgresActionRepository } from './repository.mjs';
import { registerSystemActions } from './system-actions.mjs';
import { SystemService } from '../system/service.mjs';
import { InMemorySystemRepository, PostgresSystemRepository } from '../system/repository.mjs';
import { createTrustedBuiltinPermissionBroker } from '../permissions/broker.mjs';
import { InMemoryPermissionRepository } from '../permissions/repository.mjs';
import { PostgresPermissionRepository } from '../permissions/postgres-repository.mjs';
import { createSystemPermissionRules } from '../system/permission-rules.mjs';
import { InMemoryAuditRepository } from '../audit/outbox.mjs';
import { createPackageActionLifecycle, PostgresPackageActionRepository } from './package-actions.mjs';

const permissionFingerprint = (baseVersion, rules) => stableActionDigest({ domain: 'appPermissions', patch: { rules }, baseVersion });

// API and independent workers must register exactly the same definitions and versions.
export function createActionRuntime({ pool, audit, actionRepository, systemRepository, permissionRepository, registry = new ActionRegistry(), handlers = {}, workerId, leaseMs, autoDispatch = !pool } = {}) {
  const effectiveAudit = audit ?? (!pool ? new InMemoryAuditRepository() : undefined);
  const permissions = createTrustedBuiltinPermissionBroker({ repository: permissionRepository ?? (pool ? new PostgresPermissionRepository(pool) : new InMemoryPermissionRepository()), audit: effectiveAudit });
  const system = new SystemService({ audit: effectiveAudit, repository: systemRepository ?? (pool ? new PostgresSystemRepository(pool) : new InMemorySystemRepository()) });
  const actions = new ActionService({ registry, permissions, audit: effectiveAudit, repository: actionRepository ?? (pool ? new PostgresActionRepository(pool) : new InMemoryActionRepository()), workerId, leaseMs, autoDispatch });
  const permissionRules = createSystemPermissionRules({ permissionRepository: permissions.repository, systemRepository: system.repository, audit: effectiveAudit });
  if (!registry.get('system.settings.patch')) actions.register({ actionId: 'system.settings.patch', ownerAppId: 'dgos.system', requiredCapability: 'system.settings.write', riskLevel: 'medium', sideEffects: ['system.settings'], timeout: 10_000, inputSchema: { type: 'object', required: ['baseVersion', 'patch'], properties: { baseVersion: { type: 'string' }, patch: { type: 'object' } } }, description: 'Update a system setting with optimistic concurrency.' }, async (input, context) => {
    if (input.patch?.domain === 'appPermissions') {
      return permissionRules.patch({ subjectId: context.subjectId, actorId: context.subjectId, requestId: context.requestId, baseVersion: input.baseVersion, rules: input.patch.value, fingerprint: permissionFingerprint(input.baseVersion, input.patch.value), system });
    }
    return system.patch({ ...input, actorId: context.subjectId, requestId: context.requestId ?? randomUUID() });
  });
  registerSystemActions(actions, { system, permissionRules });
  for (const [id, handler] of Object.entries(handlers)) if (registry.get(id) && handler) actions.handlers.set(id, handler);
  const packageLifecycle = pool ? createPackageActionLifecycle({ repository: new PostgresPackageActionRepository(pool), registry, handlers, bindHandler: (id, handler) => actions.handlers.set(id, handler) }) : null;
  const worker = new ActionWorker({ service: actions });
  return { actions, registry, permissions, system, worker, packageLifecycle, ready: Promise.all([system.ready, ...actions.registrations]).then(async () => { await packageLifecycle?.hydrate(); }) };
}
