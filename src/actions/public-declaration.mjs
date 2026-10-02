const risk = (action) => action.risk ?? (action.riskLevel === 'low' ? 'read' : 'write');
const sideEffects = (action) => action.publicSideEffects ?? (action.sideEffects?.length ? 'local-write' : 'none');

export function publicActionDeclaration(action, { state = 'ready' } = {}) {
  return {
    actionId: action.actionId,
    actionVersion: String(action.actionVersion),
    appId: action.ownerAppId,
    label: action.label ?? { 'zh-CN': action.description ?? action.actionId, 'en-US': action.description ?? action.actionId },
    inputSchema: action.inputSchema ?? { type: 'object', properties: {} },
    outputSchema: action.outputSchema ?? { type: 'object', properties: {} },
    requiredCapabilities: action.requiredCapabilities ?? [action.requiredCapability],
    risk: risk(action),
    sideEffects: sideEffects(action),
    confirmation: action.confirmation ?? (sideEffects(action) === 'none' ? 'none' : 'required'),
    idempotency: action.idempotency ?? 'required',
    cancellable: action.cancellable ?? action.cancellationPolicy !== 'none',
    state,
  };
}
