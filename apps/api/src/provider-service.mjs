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
    const account = await (this.repository.createAccountWithAudit ? this.repository.createAccountWithAudit({ accountId, ownerId, protocolType, displayName, credentialRef, scope, defaultForProtocol, state: 'credential_pending' }, (value) => ({ requestId, actorId: ownerId, action: 'provider.account.create', targetType: 'provider_account', targetId: value.accountId, summary: { protocolType, displayName } })) : this.repository.createAccount({ accountId, ownerId, protocolType, displayName, credentialRef, scope, defaultForProtocol, state: 'credential_pending' }));
    return account;
  }
  async bindAccount({ accountId, providerConfigId, policyVersion, requestId, actorId }) { const account = await this.repository.getAccount(accountId); if (!account) throw Object.assign(new Error('provider_account_not_found'), { statusCode: 404 }); return this.repository.createBindingWithAudit ? this.repository.createBindingWithAudit({ accountId, providerConfigId, policyVersion }, (value) => ({ requestId, actorId, action: 'provider.account.bind', targetType: 'provider_account', targetId: accountId, summary: { providerConfigId: value.providerConfigId } })) : this.repository.createBinding({ accountId, providerConfigId, policyVersion }); }
  async setState({ accountId, version, state, requestId, actorId }) { if (!['ready', 'disabled', 'revoked'].includes(state)) throw Object.assign(new Error('invalid_request'), { statusCode: 422 }); const account = await this.repository.updateAccountState(accountId, version ?? '1', state); if (!account) throw Object.assign(new Error('provider_account_conflict'), { statusCode: 409 }); await this.repository.writeAudit({ requestId, actorId, action: 'provider.account.state', targetType: 'provider_account', targetId: accountId, summary: { state } }); return account; }
  async deleteAccount({ accountId, version, requestId, actorId }) { const account = await this.repository.revokeAccount(accountId, version); if (!account) throw Object.assign(new Error('provider_account_conflict'), { statusCode: 409 }); await this.secretService.revoke(account._secretRef); await this.repository.writeAudit({ requestId, actorId, action: 'provider.account.delete', targetType: 'provider_account', targetId: accountId }); return account; }
  async startConnectionTest({ accountId, providerConfigId, accountVersion = '1', configVersion = '1', protocolVersion, requestId }) {
    const account = await this.repository.getAccount(accountId); if (!account) throw Object.assign(new Error('provider_account_not_found'), { statusCode: 404 });
    if (account.version !== String(accountVersion) && accountVersion !== '1') throw Object.assign(new Error('provider_account_conflict'), { statusCode: 409 });
    if (!this.adapters[account.protocolType]) throw Object.assign(new Error('protocol_unavailable'), { statusCode: 422 });
    const test = await (this.repository.createConnectionTestWithAudit ? this.repository.createConnectionTestWithAudit({ testId: randomUUID(), requestId, accountId, providerConfigId, accountVersion, configVersion, protocolVersion }, (value) => ({ requestId, action: 'provider.connection_test.create', targetType: 'connection_test', targetId: value.testId, summary: { accountId, protocolVersion } })) : this.repository.createConnectionTest({ testId: randomUUID(), requestId, accountId, providerConfigId, accountVersion, configVersion, protocolVersion }));
    return test;
  }
  async getConnectionTest(testId) { const test = await this.repository.getConnectionTest(testId); if (!test) throw Object.assign(new Error('connection_test_not_found'), { statusCode: 404 }); return test; }
  async cancelConnectionTest(testId, requestId, actorId) { const test = await this.repository.cancelConnectionTest(testId); if (!test) throw Object.assign(new Error('connection_test_not_found'), { statusCode: 404 }); await this.repository.writeAudit({ requestId, actorId, action: 'provider.connection_test.cancel', targetType: 'connection_test', targetId: testId }); return test; }
}

export function createOpenAiCompatibleAdapter() { return { async probe({ account, credential, egress }) { const endpoint = account.scope?.endpoint; if (!endpoint) throw Object.assign(new Error('endpoint_invalid'), { errorKey: 'endpoint_invalid' }); const response = await egress.request({ url: `${endpoint.replace(/\/$/, '')}/models`, headers: { authorization: `Bearer ${credential}` } }); if (response.status === 401 || response.status === 403) throw Object.assign(new Error('authentication_failed'), { errorKey: 'authentication_failed' }); if (!response.ok) throw Object.assign(new Error('upstream_unavailable'), { errorKey: 'upstream_unavailable' }); return { status: 'ok' }; } }; }
