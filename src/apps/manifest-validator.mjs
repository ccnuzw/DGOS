import { createHash } from 'node:crypto';

const required = ['format', 'appId', 'version', 'build', 'releaseChannel', 'minRuntimeVersion', 'dataVersion', 'name', 'description', 'category', 'icon', 'defaultWindow', 'entrypoints', 'permissions', 'capabilityAllowlist', 'trustLevel', 'uninstallPolicy', 'backgroundPolicy'];
const channels = new Set(['stable', 'beta', 'dev']);
const trustLevels = new Set(['standard', 'trusted', 'system']);

function containsForbidden(value, path = '') {
  if (typeof value === 'string') {
    if (/-----BEGIN|secret|password|token/i.test(value) || value.startsWith('/') || /(^|\s)(sh|bash|zsh|cmd|powershell)(\s|$)/i.test(value)) return `${path || 'manifest'} contains forbidden secret/path/shell content`;
  }
  if (Array.isArray(value)) for (const [i, item] of value.entries()) { const issue = containsForbidden(item, `${path}[${i}]`); if (issue) return issue; }
  if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) { const issue = containsForbidden(item, path ? `${path}.${key}` : key); if (issue) return issue; }
  return null;
}

export function validateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return { valid: false, errors: ['manifest must be an object'] };
  if (manifest.format !== 'dgos-app/v1') errors.push('format is incompatible');
  const allowed = new Set([...required, 'networkAllowlist', 'dependencies', 'actions', 'agent', 'dataMigration', 'displayName', 'accentColor', 'preferredWindow', 'minWindowSize', 'routes', 'deepLinks', 'supportedLocales', 'commands', 'settingsSections', 'uiCapabilities']);
  for (const key of Object.keys(manifest)) if (!allowed.has(key)) errors.push(`unknown ${key}`);
  for (const key of required) if (manifest[key] === undefined) errors.push(`missing ${key}`);
  if (manifest.appId && !/^[a-z][a-z0-9.-]{1,63}$/.test(manifest.appId)) errors.push('appId must be a stable lowercase identifier');
  if (manifest.version && !/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(manifest.version)) errors.push('version must be semver');
  for (const key of ['build', 'dataVersion']) if (!Number.isSafeInteger(manifest[key]) || manifest[key] < 0) errors.push(`${key} must be a nonnegative safe integer`);
  if (manifest.releaseChannel && !channels.has(manifest.releaseChannel)) errors.push('releaseChannel is invalid');
  if (manifest.trustLevel && !trustLevels.has(manifest.trustLevel)) errors.push('trustLevel is invalid');
  if (!['user-removable', 'protected-preinstall'].includes(manifest.uninstallPolicy)) errors.push('uninstallPolicy is invalid');
  if (!['release', 'keep-alive'].includes(manifest.backgroundPolicy)) errors.push('backgroundPolicy is invalid');
  const relative = (path) => typeof path === 'string' && path.length > 0 && path.length < 512 && !path.includes('\\') && !path.includes('\0') && !path.startsWith('/') && !/^[A-Za-z]:/.test(path) && path.split('/').every((part) => part && part !== '.' && part !== '..');
  if (!manifest.entrypoints || typeof manifest.entrypoints !== 'object' || Array.isArray(manifest.entrypoints) || !Object.values(manifest.entrypoints).length || Object.values(manifest.entrypoints).some((path) => !relative(path))) errors.push('entrypoints must be package-relative paths');
  for (const path of [manifest.icon, manifest.dataMigration?.entry].filter((value) => value !== undefined)) if (!relative(path)) errors.push('resource path is invalid');
  for (const key of ['name', 'description', 'displayName']) if (manifest[key] !== undefined && (!manifest[key] || typeof manifest[key] !== 'object' || Array.isArray(manifest[key]) || ['zh-CN', 'en-US'].some((locale) => typeof manifest[key][locale] !== 'string' || !manifest[key][locale]))) errors.push(`${key} must include zh-CN and en-US`);
  if (typeof manifest.category !== 'string' || !manifest.category) errors.push('category is invalid');
  if (!manifest.defaultWindow || typeof manifest.defaultWindow !== 'object' || Array.isArray(manifest.defaultWindow) || Object.entries(manifest.defaultWindow).some(([key, value]) => !['width', 'height', 'minWidth', 'minHeight', 'resizable', 'maximizable'].includes(key) || (['resizable', 'maximizable'].includes(key) ? typeof value !== 'boolean' : !Number.isSafeInteger(value) || value < 1))) errors.push('defaultWindow is invalid');
  for (const key of ['permissions', 'capabilityAllowlist']) if (!Array.isArray(manifest[key]) || manifest[key].some((value) => typeof value !== 'string' || !value) || new Set(manifest[key]).size !== manifest[key].length) errors.push(`${key} must be a unique nonempty string array`);
  if (manifest.actions && (!Array.isArray(manifest.actions) || manifest.actions.some((action) => !action?.actionId || action.version === undefined))) errors.push('actions must declare actionId and version');
  if (manifest.dataMigration && (!Array.isArray(manifest.dataMigration.from) || !manifest.dataMigration.from.every((value) => Number.isSafeInteger(value) && value >= 0) || !relative(manifest.dataMigration.entry))) errors.push('dataMigration is invalid');
  const forbidden = containsForbidden(manifest);
  if (forbidden) errors.push(forbidden);
  const network = (manifest.capabilityAllowlist ?? []).filter((x) => String(x).startsWith('network.'));
  const declaredNetwork = manifest.networkAllowlist ?? [];
  if (network.length && !Array.isArray(declaredNetwork)) errors.push('networkAllowlist must be declared for network capabilities');
  return { valid: errors.length === 0, errors };
}

export function manifestDigest(manifest) {
  const canonical = JSON.stringify(manifest, Object.keys(manifest ?? {}).sort());
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}
