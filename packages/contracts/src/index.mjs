export const governanceOperations = Object.freeze([
  'bootstrapAdmin',
  'adminLogin',
  'createApiKey',
  'rotateApiKey',
  'createProviderAccount',
  'startProviderConnectionTest',
  'queryAuditEvents',
  'reserveQuota',
  'settleUsage',
]);
export const runtimeOperations = Object.freeze(['listApps', 'getApp', 'installApp', 'updateApp', 'uninstallApp', 'launchApp', 'checkAppHealth', 'checkPermission', 'requestPermission', 'listActions', 'planAction', 'executeAction', 'getActionRun', 'cancelActionRun', 'readSystemSettings', 'writeSystemSettings', 'readSystemContext']);
export const runtimeScopes = Object.freeze(['app.catalog.read', 'app.catalog.manage', 'app.install', 'app.lifecycle', 'permission.read', 'permission.manage', 'action.read', 'action.plan', 'action.execute', 'system.settings.read', 'system.settings.write']);
export const providerConfigStatuses = Object.freeze(['draft', 'validating', 'ready', 'error', 'disabled', 'revoked']);
export const aiTaskStatuses = Object.freeze(['accepted', 'queued', 'running', 'succeeded', 'failed', 'cancel_requested', 'cancelled', 'timed_out']);
export const aiTaskEventTypes = Object.freeze(['task.accepted', 'task.progress', 'text.delta', 'task.completed', 'task.failed', 'task.cancelled', 'stream.reset']);
