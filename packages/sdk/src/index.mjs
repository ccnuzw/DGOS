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
export const dgosProvider = Object.freeze({ configs: '/api/v1/provider/configs', models: (id) => `/api/v1/provider/configs/${id}/models`, policies: (id) => `/api/v1/provider/configs/${id}/model-policies` });
export const dgosAiTask = Object.freeze({ submit: '/api/v1/ai-tasks', get: (id) => `/api/v1/ai-tasks/${id}`, events: (id) => `/api/v1/ai-tasks/${id}/events`, cancel: (id) => `/api/v1/ai-tasks/${id}` });
export const dgosArtifact = Object.freeze({ read: (id) => `/api/v1/artifacts/${id}` });

export function createRequestId() {
  return crypto.randomUUID();
}
