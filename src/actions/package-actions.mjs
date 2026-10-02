const fail = (message, statusCode = 422) => Object.assign(new Error(message), { statusCode });
const actionIdPattern = /^[a-z][a-z0-9_.-]{0,127}$/;
const semver = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const riskValues = new Set(['read', 'write', 'external', 'destructive']);
const effectValues = new Set(['none', 'local-write', 'external-call', 'model-call', 'secret-use', 'destructive']);
const confirmationValues = new Set(['none', 'required', 'elevated']);
const idempotencyValues = new Set(['safe', 'required', 'unsupported']);
const declarationKeys = new Set(['actionId', 'version', 'label', 'inputSchema', 'outputSchema', 'requiredCapabilities', 'risk', 'sideEffects', 'confirmation', 'idempotency', 'cancellable', 'handler']);

export function projectPackageActions(manifest, handlers) {
  if (!manifest || !Array.isArray(manifest.actions)) return [];
  const declared = new Set(manifest.permissions ?? []);
  const allowed = new Set(manifest.capabilityAllowlist ?? []);
  const seen = new Set();
  return manifest.actions.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some((key) => !declarationKeys.has(key)) || !actionIdPattern.test(item.actionId) || !item.actionId.startsWith(`${manifest.appId}.`) || seen.has(item.actionId) || !semver.test(item.version ?? '') || item.inputSchema?.type !== 'object' || item.outputSchema?.type !== 'object' || !item.label || ['zh-CN', 'en-US'].some((locale) => typeof item.label[locale] !== 'string' || !item.label[locale]) || !Array.isArray(item.requiredCapabilities) || item.requiredCapabilities.length === 0 || new Set(item.requiredCapabilities).size !== item.requiredCapabilities.length || item.requiredCapabilities.some((capability) => !actionIdPattern.test(capability) || !declared.has(capability) || !allowed.has(capability)) || !riskValues.has(item.risk) || !effectValues.has(item.sideEffects) || !confirmationValues.has(item.confirmation) || (item.sideEffects !== 'none' && item.confirmation === 'none') || !idempotencyValues.has(item.idempotency) || typeof item.cancellable !== 'boolean' || !actionIdPattern.test(item.handler) || !handlers.has(item.handler)) throw fail('invalid_action_manifest');
    seen.add(item.actionId);
    return {
      actionId: item.actionId, ownerAppId: manifest.appId, declarationVersion: item.version, handlerId: item.handler,
      requiredCapability: item.requiredCapabilities[0], requiredCapabilities: [...item.requiredCapabilities], riskLevel: item.risk === 'read' ? 'low' : item.risk === 'write' ? 'medium' : 'high', risk: item.risk,
      sideEffects: item.sideEffects === 'none' ? [] : [item.sideEffects], publicSideEffects: item.sideEffects, cancellationPolicy: item.cancellable ? 'cooperative' : 'none',
      confirmation: item.confirmation, idempotency: item.idempotency, cancellable: item.cancellable, inputSchema: item.inputSchema, outputSchema: item.outputSchema,
      label: item.label, timeout: 30_000,
    };
  });
}

export class PostgresPackageActionRepository {
  constructor(pool) { this.pool = pool; }
  async transaction(work) { const client = await this.pool.connect(); try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }
  async sync({ subjectId, appId, manifest, enabled, definitions }) {
    return this.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`package-actions:${appId}`]);
      const deployment = await client.query('SELECT d.state,d.package_digest,r.manifest,r.package_digest AS release_digest FROM app_package_deployments d JOIN app_package_releases r ON r.package_id=d.package_id WHERE d.subject_id=$1 AND d.app_id=$2 FOR UPDATE OF d', [subjectId, appId]);
      const active = deployment.rows[0]?.state === 'active' && deployment.rows[0].package_digest === deployment.rows[0].release_digest;
      if (enabled && (!active || !isDeepStrictEqual(deployment.rows[0].manifest, manifest))) throw fail('app_not_installed', 409);
      if (!enabled) {
        if (active) throw fail('version_conflict', 409);
        await client.query('UPDATE package_action_bindings SET enabled=false,updated_at=now() WHERE subject_id=$1 AND app_id=$2 AND enabled=true', [subjectId, appId]);
        return [];
      }
      const ids = definitions.map((item) => item.actionId);
      await client.query('UPDATE package_action_bindings SET enabled=false,updated_at=now() WHERE subject_id=$1 AND app_id=$2 AND NOT (action_id=ANY($3::text[])) AND enabled=true', [subjectId, appId, ids]);
      const saved = [];
      for (const definition of definitions) {
        const owners = await client.query('SELECT DISTINCT app_id FROM package_action_bindings WHERE action_id=$1 AND app_id<>$2', [definition.actionId, appId]);
        if (owners.rows.length) throw fail('action_owner_conflict', 409);
        const versions = await client.query('SELECT max(action_version)::int AS max_version FROM package_action_bindings WHERE action_id=$1', [definition.actionId]);
        const matching = await client.query('SELECT action_version FROM package_action_bindings WHERE action_id=$1 AND declaration_version=$2 AND definition - \'actionVersion\'=$3::jsonb ORDER BY action_version DESC LIMIT 1', [definition.actionId, definition.declarationVersion, JSON.stringify(definition)]);
        const version = matching.rows[0] ? Number(matching.rows[0].action_version) : Number(versions.rows[0]?.max_version ?? 0) + 1;
        const value = { ...definition, actionVersion: version };
        await client.query('INSERT INTO package_action_bindings(subject_id,app_id,action_id,action_version,declaration_version,handler_id,package_digest,definition,enabled) VALUES($1,$2,$3,$4,$5,$6,$7,$8,true) ON CONFLICT(subject_id,app_id,action_id) DO UPDATE SET action_version=EXCLUDED.action_version,declaration_version=EXCLUDED.declaration_version,handler_id=EXCLUDED.handler_id,package_digest=EXCLUDED.package_digest,definition=EXCLUDED.definition,enabled=true,updated_at=now()', [subjectId, appId, definition.actionId, version, definition.declarationVersion, definition.handlerId, deployment.rows[0].package_digest, JSON.stringify(value)]);
        saved.push(value);
      }
      return saved;
    });
  }
  async listActive() { const { rows } = await this.pool.query("SELECT DISTINCT ON (b.action_id) b.definition FROM package_action_bindings b JOIN app_package_deployments d ON d.subject_id=b.subject_id AND d.app_id=b.app_id JOIN app_package_releases r ON r.package_id=d.package_id WHERE b.enabled=true AND d.state='active' AND b.package_digest=d.package_digest AND d.package_digest=r.package_digest AND r.catalog_state IN ('official','approved') ORDER BY b.action_id,b.action_version DESC"); return rows.map((item) => item.definition); }
  async isEnabled(subjectId, actionId, version) { const { rows } = await this.pool.query("SELECT 1 FROM package_action_bindings b JOIN app_package_deployments d ON d.subject_id=b.subject_id AND d.app_id=b.app_id JOIN app_package_releases r ON r.package_id=d.package_id WHERE b.subject_id=$1 AND b.action_id=$2 AND b.action_version=$3 AND b.enabled=true AND d.state='active' AND b.package_digest=d.package_digest AND d.package_digest=r.package_digest AND r.catalog_state IN ('official','approved')", [subjectId, actionId, version]); return Boolean(rows[0]); }
}

export function createPackageActionLifecycle({ repository, registry, handlers, bindHandler }) {
  const serverHandlers = handlers instanceof Map ? handlers : new Map(Object.entries(handlers ?? {}));
  const attach = (definition) => {
    registry.hydrate(definition);
    const handler = serverHandlers.get(definition.handlerId);
    if (!handler) throw fail('action_handler_unavailable', 503);
    bindHandler(definition.actionId, async (input, context) => {
      if (!(await repository.isEnabled(context.subjectId, definition.actionId, definition.actionVersion))) throw fail('action_not_found', 404);
      return handler(input, context);
    });
  };
  const lifecycle = {
    onActionsChanged: async ({ subjectId, appId, manifest, enabled }) => {
      if (manifest?.appId !== appId) throw fail('invalid_action_manifest');
      const definitions = enabled ? projectPackageActions(manifest, serverHandlers) : [];
      await repository.sync({ subjectId, appId, manifest, enabled, definitions });
      await lifecycle.hydrate();
    },
    hydrate: async () => {
      const active = await repository.listActive();
      const ids = new Set(active.map((item) => item.actionId));
      for (const current of registry.list()) if (current.packageAction && !ids.has(current.actionId)) registry.disable(current.actionId, current.ownerAppId);
      for (const definition of active) attach({ ...definition, packageAction: true });
      return active.length;
    },
  };
  return lifecycle;
}
import { isDeepStrictEqual } from 'node:util';
