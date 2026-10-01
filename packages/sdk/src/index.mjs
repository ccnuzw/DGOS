export const apiVersion = '2026-10-01';

export const errorKeys = Object.freeze([
  'authentication_failed',
  'credential_unavailable',
  'endpoint_invalid',
  'policy_blocked',
  'version_conflict',
  'service_unavailable',
]);

export function createRequestId() {
  return crypto.randomUUID();
}
