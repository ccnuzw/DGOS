import { createHash } from 'node:crypto';

const required = ['appId', 'version', 'build', 'releaseChannel', 'minRuntimeVersion', 'entrypoints', 'permissions', 'capabilityAllowlist', 'trustLevel', 'uninstallPolicy', 'backgroundPolicy'];
const channels = new Set(['stable', 'beta', 'dev']);
const trustLevels = new Set(['official', 'admin_approved', 'developer']);

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
  if (!manifest || typeof manifest !== 'object') return { valid: false, errors: ['manifest must be an object'] };
  for (const key of required) if (manifest[key] === undefined) errors.push(`missing ${key}`);
  if (manifest.appId && !/^[a-z][a-z0-9.-]{1,63}$/.test(manifest.appId)) errors.push('appId must be a stable lowercase identifier');
  if (manifest.version && !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)) errors.push('version must be semver');
  if (manifest.build !== undefined && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(String(manifest.build))) errors.push('build is invalid');
  if (manifest.releaseChannel && !channels.has(manifest.releaseChannel)) errors.push('releaseChannel is invalid');
  if (manifest.trustLevel && !trustLevels.has(manifest.trustLevel)) errors.push('trustLevel is invalid');
  if (manifest.entrypoints && typeof manifest.entrypoints !== 'object') errors.push('entrypoints must be an object');
  for (const key of ['permissions', 'capabilityAllowlist']) if (manifest[key] && !Array.isArray(manifest[key])) errors.push(`${key} must be an array`);
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
