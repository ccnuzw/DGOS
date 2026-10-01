import { createHash, randomUUID } from 'node:crypto';

const digest = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

export class ProviderService {
  constructor({ repository, secretService, egress, adapters = {} }) { this.repository = repository; this.secretService = secretService; this.egress = egress; this.adapters = adapters; }
  async listAccounts(ownerId) { return { items: await this.repository.listAccounts(ownerId) }; }
  async createAccount({ ownerId, protocolType, displayName, credential, scope, defaultForProtocol, requestId }) {
    if (!ownerId || !protocolType || !displayName || !credential) throw Object.assign(new Error('invalid_request'), { statusCode: 422 });
    if (!this.adapters[protocolType]) throw Object.assign(new Error('protocol_unavailable'), { statusCode: 422 });
    const accountId = randomUUID(); const credentialRef = `provider-credential:${accountId}`;
    await this.secretService.put({ secretRef: credentialRef, value: credential, purpose: 'provider-account', subjectId: ownerId, ttlMs: 365 * 24 * 60 * 60 * 1000 });
    return this.repository.createAccount({ accountId, ownerId, protocolType, displayName, credentialRef, scope, defaultForProtocol, state: 'credential_pending' });
  }
  async bindAccount({ accountId, providerConfigId, policyVersion }) { const account = await this.repository.getAccount(accountId); if (!account) throw Object.assign(new Error('provider_account_not_found'), { statusCode: 404 }); return this.repository.createBinding({ accountId, providerConfigId, policyVersion }); }
  async setState({ accountId, version, state }) { if (!['ready', 'disabled', 'revoked'].includes(state)) throw Object.assign(new Error('invalid_request'), { statusCode: 422 }); const account = await this.repository.updateAccountState(accountId, version ?? '1', state); if (!account) throw Object.assign(new Error('provider_account_conflict'), { statusCode: 409 }); return account; }
  async deleteAccount({ accountId, version }) { const account = await this.repository.revokeAccount(accountId, version); if (!account) throw Object.assign(new Error('provider_account_conflict'), { statusCode: 409 }); await this.secretService.revoke(account._secretRef); return account; }
  async startConnectionTest({ accountId, providerConfigId, accountVersion = '1', configVersion = '1', protocolVersion, requestId }) {
    const account = await this.repository.getAccount(accountId); if (!account) throw Object.assign(new Error('provider_account_not_found'), { statusCode: 404 });
    if (account.version !== String(accountVersion) && accountVersion !== '1') throw Object.assign(new Error('provider_account_conflict'), { statusCode: 409 });
    if (!this.adapters[account.protocolType]) throw Object.assign(new Error('protocol_unavailable'), { statusCode: 422 });
    return this.repository.createConnectionTest({ testId: randomUUID(), requestId, accountId, providerConfigId, accountVersion, configVersion, protocolVersion });
  }
  async getConnectionTest(testId) { const test = await this.repository.getConnectionTest(testId); if (!test) throw Object.assign(new Error('connection_test_not_found'), { statusCode: 404 }); return test; }
  async cancelConnectionTest(testId) { const test = await this.repository.cancelConnectionTest(testId); if (!test) throw Object.assign(new Error('connection_test_not_found'), { statusCode: 404 }); return test; }
}

export function createOpenAiCompatibleAdapter() { return { async probe({ account, credential, egress }) { const endpoint = account.scope?.endpoint; if (!endpoint) throw Object.assign(new Error('endpoint_invalid'), { errorKey: 'endpoint_invalid' }); const response = await egress.request({ url: `${endpoint.replace(/\/$/, '')}/models`, headers: { authorization: `Bearer ${credential}` } }); if (response.status === 401 || response.status === 403) throw Object.assign(new Error('authentication_failed'), { errorKey: 'authentication_failed' }); if (!response.ok) throw Object.assign(new Error('upstream_unavailable'), { errorKey: 'upstream_unavailable' }); return { status: 'ok' }; } }; }
