export class ActionRegistry {
  constructor() { this.actions = new Map(); this.version = 1; }
  register(action) { if (!action.actionId || !action.ownerAppId || !action.requiredCapability || !['low','medium','high'].includes(action.riskLevel ?? 'low') || !Number.isFinite(action.timeout ?? 30_000) || (action.timeout ?? 30_000) < 1) throw new Error('invalid_action_manifest'); const current=this.actions.get(action.actionId); if(current&&JSON.stringify(current)===JSON.stringify({...current,...action})) return current; this.actions.set(action.actionId, { timeout: 30_000, riskLevel: 'low', sideEffects: [], cancellationPolicy: 'cooperative', ...action, actionVersion:(current?.actionVersion??0)+1 }); this.version += 1; return this.actions.get(action.actionId); }
  hydrate(action) {
    if (!action?.actionId || !Number.isSafeInteger(Number(action.actionVersion)) || Number(action.actionVersion) < 1) throw new Error('invalid_action_manifest');
    const current = this.actions.get(action.actionId);
    if (current && current.ownerAppId !== action.ownerAppId) throw new Error('action_owner_conflict');
    if (current && JSON.stringify(current) === JSON.stringify(action)) return current;
    this.actions.set(action.actionId, structuredClone(action)); this.version += 1;
    return this.actions.get(action.actionId);
  }
  disable(actionId, ownerAppId) { const current = this.actions.get(actionId); if (current?.ownerAppId !== ownerAppId) return false; this.actions.delete(actionId); this.version += 1; return true; }
  get(actionId) { return this.actions.get(actionId); }
  list() { return [...this.actions.values()]; }
}
