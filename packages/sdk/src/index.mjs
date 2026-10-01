export const apiVersion = '2026-10-01';

export const errorKeys = Object.freeze([
  'authentication_failed',
  'credential_unavailable',
  'endpoint_invalid',
  'policy_blocked',
  'version_conflict',
  'service_unavailable',
]);
export const runtimePaths = Object.freeze({ apps: '/api/v1/apps', actions: '/api/v1/actions', permissions: '/api/v1/permissions', settings: '/api/v1/system/settings', context: '/api/v1/system/context' });

export function createRequestId() {
  return crypto.randomUUID();
}
