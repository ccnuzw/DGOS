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
