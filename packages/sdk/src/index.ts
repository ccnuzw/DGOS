// Main SDK exports

export { DGOSClient } from './client.js';

// API exports
export { TasksAPI } from './api/tasks.js';
export { ProvidersAPI } from './api/providers.js';
export { PackagesAPI } from './api/packages.js';
export { IdentityAPI } from './api/identity.js';
export { ActionsAPI } from './api/actions.js';
export { SystemAPI } from './api/system.js';
export { ArtifactsAPI } from './api/artifacts.js';
export { AuditAPI } from './api/audit.js';

// App SDK exports
export * from './app-runtime.js';
export { DGOSAppClient } from './app-client.js';
export { BridgeClient, getBridgeClient } from './bridge-client.js';

// Error exports
export {
  DGOSSDKError,
  NetworkError,
  AuthenticationError,
  ValidationError,
  RateLimitError,
  NotFoundError,
  ConflictError,
  PermissionError,
  ServerError,
  TimeoutError,
} from './errors.js';

// Type exports
export type {
  DGOSClientOptions,
  TaskStatus,
  TaskRequest,
  Task,
  TaskResult,
  TaskError,
  TaskEvent,
  TaskFilters,
  Artifact,
  UsageInfo,
  Provider,
  ProviderAccount,
  ProviderConfig,
  ConnectionTest,
  Model,
  ModelPolicy,
  Package,
  Installation,
  Action,
  ActionParameter,
  ActionResult,
  ActionRun,
  Session,
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResult,
  AuditEvent,
  AuditFilters,
  SystemInfo,
  SystemSettings,
  PaginatedResult,
  CursorResult,
  Webhook,
  WebhookConfig,
  BatchOptions,
  RetryOptions,
} from './types/index.js';

// Legacy exports for backward compatibility
export const apiVersion = '2026-10-01';
export const errorKeys = Object.freeze([
  'authentication_failed',
  'credential_unavailable',
  'endpoint_invalid',
  'policy_blocked',
  'version_conflict',
  'service_unavailable',
]);

export const runtimePaths = Object.freeze({
  apps: '/api/v1/apps',
  actions: '/api/v1/actions',
  permissions: '/api/v1/permissions',
  settings: '/api/v1/system/settings',
  context: '/api/v1/system/context',
});

export const dgosProvider = Object.freeze({
  configs: '/api/v1/provider/configs',
  models: (id: string) => `/api/v1/provider/configs/${id}/models`,
  policies: (id: string) => `/api/v1/provider/configs/${id}/model-policies`,
});

export const dgosAiTask = Object.freeze({
  submit: '/api/v1/ai-tasks',
  get: (id: string) => `/api/v1/ai-tasks/${id}`,
  events: (id: string) => `/api/v1/ai-tasks/${id}/events`,
  cancel: (id: string) => `/api/v1/ai-tasks/${id}`,
});

export const dgosArtifact = Object.freeze({
  read: (id: string) => `/api/v1/artifacts/${id}`,
});

export function createRequestId(): string {
  return crypto.randomUUID();
}
