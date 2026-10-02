const declarations = Object.freeze({
  'dgos.system': Object.freeze(['system.settings.read', 'system.settings.write', 'system.info.read', 'system.navigate', 'permission.manage']),
  'dgos.extensions': Object.freeze([
    'skill.read', 'skill.install', 'skill.manage', 'skill.uninstall', 'skill.execute',
    'mcp.read', 'mcp.install', 'mcp.manage', 'mcp.uninstall', 'mcp.connect', 'mcp.execute',
    'extension.run.read', 'extension.run.cancel',
  ]),
});

export function trustedBuiltinCapabilities(appId) { return declarations[appId] ?? []; }
export function isReservedBuiltinAppId(appId) { return Object.hasOwn(declarations, appId); }
