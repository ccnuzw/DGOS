export class ProtocolAdapterRegistry {
  constructor(adapters = []) { this.adapters = new Map(adapters.map((adapter) => [adapter.protocolType, adapter])); }
  register(adapter) { if (!adapter?.protocolType || typeof adapter.validate !== 'function') throw new Error('invalid_adapter'); this.adapters.set(adapter.protocolType, adapter); return adapter; }
  get(protocolType) { const adapter = this.adapters.get(protocolType); if (!adapter) throw Object.assign(new Error('protocol_unavailable'), { statusCode: 422 }); return adapter; }
  list() { return [...this.adapters.values()].map(({ protocolType, protocolVersion, descriptorVersion, taskModes, streamingText, cancellation, modelListing, endpointRules, timeoutMs, responseSizeLimit }) => ({ protocolType, protocolVersion, descriptorVersion, taskModes, streamingText, cancellation, modelListing, endpointRules, timeoutMs, responseSizeLimit, status: 'active' })); }
}
