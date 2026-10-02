import { randomUUID } from 'node:crypto';
import { isReservedBuiltinAppId, trustedBuiltinCapabilities } from '../permissions/builtin-declarations.mjs';
import { normalizeSystemSettings, validateSystemDomain } from './service.mjs';

const fail = (key, statusCode) => Object.assign(new Error(key), { statusCode });
const scopeValue = (scope) => {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope) || Object.keys(scope).length !== 1 || typeof scope.value !== 'string' || !scope.value || scope.value.length > 256) throw fail('invalid_request', 422);
  return scope.value;
};
const toPublic = (record) => ({ appId: record.appId, subjectType: 'user', subjectId: record.subjectId, capability: record.capability, scope: { value: record.scope ?? '*' }, decision: record.decision });
const toInternal = (rule, subjectId, requestId) => {
  if (rule.subjectType !== 'user' || rule.subjectId !== subjectId || rule.source !== undefined && rule.source !== 'admin') throw fail('insufficient_scope', 403);
  return { subjectId, appId: rule.appId, capability: rule.capability, scope: scopeValue(rule.scope), decision: rule.decision, requestId };
};
const receiptKey = (actorId, requestId) => `${actorId}:${requestId}`;
const publicSettings = (settings) => {
  const result = normalizeSystemSettings(settings);
  delete result._requestReceipts;
  return result;
};

export function createSystemPermissionRules({ permissionRepository, systemRepository, audit }) {
  if (!permissionRepository?.listForSubject || !systemRepository?.load || !audit?.record) throw new Error('permission_rules_dependencies_required');
  const list = async ({ subjectId }) => (await permissionRepository.listForSubject(subjectId)).map(toPublic);
  const patch = async ({ subjectId, actorId, requestId, baseVersion, rules, fingerprint, system }) => {
    if (!subjectId || actorId !== subjectId || !requestId || !system || system.repository !== systemRepository) throw fail('insufficient_scope', 403);
    validateSystemDomain('appPermissions', rules);
    if (!rules.length) throw fail('invalid_request', 422);
    const changes = rules.map((rule) => toInternal(rule, subjectId, requestId));
    const unique = new Set(changes.map((item) => `${item.appId}:${item.capability}:${item.scope}`));
    if (unique.size !== changes.length) throw fail('invalid_request', 422);
    if (permissionRepository.pool && systemRepository.pool) {
      if (permissionRepository.pool !== systemRepository.pool) throw fail('permission_unavailable', 503);
      return permissionRepository.transaction(async (client) => {
        const locked = await client.query('SELECT settings_version,context_version,settings FROM system_settings WHERE scope_id=$1 FOR UPDATE', [system.scopeId]);
        const current = locked.rows[0]; if (!current) throw fail('system_unavailable', 503);
        const receipt = current.settings?._requestReceipts?.[receiptKey(actorId, requestId)];
        if (receipt) {
          if (receipt.digest !== fingerprint) throw fail('version_conflict', 409);
          return { snapshot: receipt.result, rules: receipt.rules };
        }
        if (String(current.settings_version) !== String(baseVersion)) throw fail('version_conflict', 409);
        for (const change of changes) {
          const declared = isReservedBuiltinAppId(change.appId) ? trustedBuiltinCapabilities(change.appId) : await permissionRepository.declaredCapabilities(change, client);
          if (!declared.includes(change.capability)) throw fail('permission_denied', 403);
        }
        await permissionRepository.writeSystemRules(client, changes);
        const newSettings = normalizeSystemSettings(current.settings);
        const snapshot = { settingsVersion: String(Number(current.settings_version) + 1), contextVersion: String(Number(current.context_version) + 1), settings: publicSettings(newSettings) };
        const authoritative = await permissionRepository.listForSubject(subjectId, client);
        const publicRules = authoritative.map(toPublic);
        newSettings._requestReceipts ??= {};
        newSettings._requestReceipts[receiptKey(actorId, requestId)] = { digest: fingerprint, result: snapshot, rules: publicRules };
        await client.query('UPDATE system_settings SET settings=$2,settings_version=settings_version+1,context_version=context_version+1,updated_at=now() WHERE scope_id=$1', [system.scopeId, JSON.stringify(newSettings)]);
        await client.query('INSERT INTO system_setting_events(event_id,scope_id,context_version,domain,restart_required) VALUES($1,$2,$3,$4,false)', [randomUUID(), system.scopeId, Number(current.context_version) + 1, 'appPermissions']);
        await systemRepository.recordAudit(client, { requestId, actorId, action: 'system.settings.patch', targetType: 'system_settings', summary: { domain: 'appPermissions', settingsVersion: snapshot.settingsVersion, restartRequired: false } });
        return { snapshot, rules: publicRules };
      });
    }
    if (!permissionRepository.decisions || !systemRepository.settings) throw fail('permission_unavailable', 503);
    const lock = systemRepository.permissionRuleCommitting;
    if (lock) throw fail('version_conflict', 409);
    systemRepository.permissionRuleCommitting = true;
    const before = new Map(permissionRepository.decisions); const beforeVersion = permissionRepository.version;
    const beforeAudit = audit.events instanceof Map ? new Map(audit.events) : null;
    const beforeOutbox = audit.outbox instanceof Map ? new Map(audit.outbox) : null;
    try {
      const current = await systemRepository.load(system.scopeId);
      const receipt = current.settings?._requestReceipts?.[receiptKey(actorId, requestId)];
      if (receipt) { if (receipt.digest !== fingerprint) throw fail('version_conflict', 409); return { snapshot: receipt.result, rules: receipt.rules }; }
      if (String(current.settingsVersion) !== String(baseVersion)) throw fail('version_conflict', 409);
      for (const change of changes) {
        const declared = isReservedBuiltinAppId(change.appId) ? trustedBuiltinCapabilities(change.appId) : await permissionRepository.declaredCapabilities(change);
        if (!declared.includes(change.capability)) throw fail('permission_denied', 403);
      }
      for (const change of changes) {
        const key = permissionRepository.key(change);
        permissionRepository.version += 1;
        permissionRepository.decisions.set(key, { ...change, policyVersion: String(permissionRepository.version), updatedAt: new Date().toISOString() });
        await audit.record({ requestId, actorId, action: 'permission.change', targetType: 'permission', summary: { appId: change.appId, capability: change.capability, scope: change.scope, decision: change.decision } });
      }
      const newSettings = normalizeSystemSettings(current.settings);
      const snapshot = { settingsVersion: String(Number(current.settingsVersion) + 1), contextVersion: String(Number(current.contextVersion) + 1), settings: publicSettings(newSettings) };
      const publicRules = await list({ subjectId });
      newSettings._requestReceipts ??= {}; newSettings._requestReceipts[receiptKey(actorId, requestId)] = { digest: fingerprint, result: snapshot, rules: publicRules };
      await systemRepository.save(system.scopeId, { settingsVersion: current.settingsVersion, settings: newSettings }, { eventId: randomUUID(), domain: 'appPermissions', restartRequired: false }, { requestId, actorId, action: 'system.settings.patch', targetType: 'system_settings', summary: { domain: 'appPermissions', settingsVersion: snapshot.settingsVersion } }, audit, { permissionBatch: true });
      return { snapshot, rules: publicRules };
    } catch (error) {
      permissionRepository.decisions = before; permissionRepository.version = beforeVersion;
      if (beforeAudit) audit.events = beforeAudit;
      if (beforeOutbox) audit.outbox = beforeOutbox;
      throw error;
    } finally { systemRepository.permissionRuleCommitting = false; }
  };
  return { list, patch };
}
