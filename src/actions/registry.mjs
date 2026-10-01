export class ActionRegistry {
  constructor() { this.actions = new Map(); this.version = 1; }
  register(action) { if (!action.actionId || !action.ownerAppId || !action.requiredCapability) throw new Error('invalid_action_manifest'); this.actions.set(action.actionId, { timeout: 30_000, riskLevel: 'low', sideEffects: [], cancellationPolicy: 'cooperative', ...action }); this.version += 1; return this.actions.get(action.actionId); }
  get(actionId) { return this.actions.get(actionId); }
  list() { return [...this.actions.values()]; }
}
