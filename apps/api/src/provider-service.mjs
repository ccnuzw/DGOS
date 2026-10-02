import { createHash, randomUUID } from 'node:crypto';

const digest = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const publicAccount = ({ _secretRef, ...account }) => account;

export class ProviderService {
  constructor({ repository, configRepository, secretService, egress, adapters = {} }) { if (typeof egress?.validateTarget !== 'function') throw new TypeError('ProviderEgress.validateTarget required'); this.repository = repository; this.configRepository = configRepository; this.secretService = secretService; this.egress = egress; this.adapters = adapters; }
  async listAccounts(ownerId) { return { items: (await this.repository.listAccounts(ownerId)).map(publicAccount) }; }
  async createAccount({ ownerId, protocolType, displayName, credential, scope, defaultForProtocol, requestId }) {
    if (!ownerId || !protocolType || !displayName || !credential) throw Object.assign(new Error('invalid_request'), { statusCode: 422 });
    if (!this.adapters[protocolType]) throw Object.assign(new Error('protocol_unavailable'), { statusCode: 422 });
    const accountId = randomUUID(); const credentialRef = `provider-credential:${accountId}`;
    await this.secretService.put({ secretRef: credentialRef, value: credential, purpose: 'provider-account', subjectId: ownerId, ttlMs: 365 * 24 * 60 * 60 * 1000 });
    const account = await (this.repository.createAccountWithAudit ? this.repository.createAccountWithAudit({ accountId, ownerId, protocolType, displayName, credentialRef, scope, defaultForProtocol, state: 'credential_pending' }, (value) => ({ requestId, actorId: ownerId, action: 'provider.account.create', targetType: 'provider_account', targetId: value.accountId, summary: { protocolType, displayName } })) : this.repository.createAccount({ accountId, ownerId, protocolType, displayName, credentialRef, scope, defaultForProtocol, state: 'credential_pending' }));
    return publicAccount(account);
  }
  async bindAccount({ accountId, providerConfigId, policyVersion, requestId, actorId }) { const account = await this.repository.getAccount(accountId); if (!account || account.ownerId !== actorId || account.status === 'revoked') throw Object.assign(new Error('provider_account_not_found'), { statusCode: 404 }); const config = await this.configRepository?.get(providerConfigId); if (!config || config.ownerId !== actorId) throw Object.assign(new Error('provider_config_not_found'), { statusCode: 404 }); if (config.protocolType !== account.protocolType || config.providerAccountId !== accountId) throw Object.assign(new Error('protocol_mismatch'), { statusCode: 422 }); return this.repository.createBindingWithAudit ? this.repository.createBindingWithAudit({ accountId, providerConfigId, policyVersion }, (value) => ({ requestId, actorId, action: 'provider.account.bind', targetType: 'provider_account', targetId: accountId, summary: { providerConfigId: value.providerConfigId } })) : this.repository.createBinding({ accountId, providerConfigId, policyVersion }); }
  async setState({ accountId, version, baseVersion, state, connectionTestId, requestId, actorId }) { if (!['ready', 'disabled'].includes(state)) throw Object.assign(new Error('invalid_request'), { statusCode: 422 }); const existing = await this.repository.getAccount(accountId); if (!existing || existing.ownerId !== actorId) throw Object.assign(new Error('provider_account_not_found'), { statusCode: 404 }); const account = await this.repository.setAccountStateWithAudit({ accountId, ownerId: actorId, expectedVersion: version ?? baseVersion ?? '1', state, connectionTestId, requirePassedTest: state === 'ready' && existing.status === 'credential_pending', audit: () => ({ requestId, actorId, action: 'provider.account.state', targetType: 'provider_account', targetId: accountId, summary: { state, connectionTestId: state === 'ready' ? connectionTestId : undefined } }) }); if (!account) throw Object.assign(new Error('provider_account_conflict'), { statusCode: 409 }); return publicAccount(account); }
  async deleteAccount({ accountId, version, requestId, actorId }) { const existing = await this.repository.getAccount(accountId); if (!existing || existing.ownerId !== actorId) throw Object.assign(new Error('provider_account_not_found'), { statusCode: 404 }); const account = await this.repository.deleteAccountWithAudit({ accountId, ownerId: actorId, expectedVersion: version, audit: () => ({ requestId, actorId, action: 'provider.account.delete', targetType: 'provider_account', targetId: accountId }) }); if (!account) throw Object.assign(new Error('provider_account_conflict'), { statusCode: 409 }); return publicAccount(account); }
  async reconcileSecretRevocations() { const pending = await this.repository.listPendingSecretRevocations(); const results = []; for (const intent of pending) { await this.secretService.revoke(intent.secretRef); await this.repository.completeSecretRevocation(intent.intentId); results.push(intent.accountId); } return results; }
  async startConnectionTest({ accountId, providerConfigId, accountVersion, configVersion, protocolVersion, requestId, ownerId }) {
    const account = await this.repository.getAccount(accountId); if (!account) throw Object.assign(new Error('provider_account_not_found'), { statusCode: 404 });
    if (ownerId && account.ownerId !== ownerId) throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 });
    if (!['ready','credential_pending'].includes(account.status)) throw Object.assign(new Error('provider_account_disabled'), { statusCode: 422 });
    if (accountVersion && account.version !== String(accountVersion)) throw Object.assign(new Error('provider_account_conflict'), { statusCode: 409 });
    const adapter = this.adapters[account.protocolType];
    if (!adapter || adapter.protocolVersion && adapter.protocolVersion !== protocolVersion) throw Object.assign(new Error('protocol_unavailable'), { statusCode: 422 });
    const config = providerConfigId ? await this.configRepository?.get(providerConfigId) : undefined;
    if (providerConfigId && (!config || config.ownerId !== account.ownerId || config.providerAccountId !== accountId)) throw Object.assign(new Error('provider_config_not_found'), { statusCode: 404 });
    if (config && config.protocolType !== account.protocolType) throw Object.assign(new Error('protocol_mismatch'), { statusCode: 422 });
    if (configVersion && config && config.version !== String(configVersion)) throw Object.assign(new Error('version_conflict'), { statusCode: 409 });
    await this.egress.validateTarget(config?.baseUrl ?? account.scope?.endpoint);
    const input = { testId: randomUUID(), requestId, accountId, providerConfigId, accountVersion: account.version, configVersion: config?.version ?? '1', protocolVersion };
    const test = await (this.repository.createConnectionTestWithAudit ? this.repository.createConnectionTestWithAudit(input, (value) => ({ requestId, action: 'provider.connection_test.create', targetType: 'connection_test', targetId: value.testId, summary: { accountId, protocolVersion } })) : this.repository.createConnectionTest(input));
    return test;
  }
  async getConnectionTest(testId, ownerId) { const test = await this.repository.getConnectionTestForOwner(testId, ownerId); if (!test) throw Object.assign(new Error('connection_test_not_found'), { statusCode: 404 }); return test; }
  async cancelConnectionTest(testId, requestId, actorId) { await this.getConnectionTest(testId, actorId); const test = await this.repository.cancelConnectionTest(testId); await this.repository.writeAudit({ requestId, actorId, action: 'provider.connection_test.cancel', targetType: 'connection_test', targetId: testId }); return test; }
}

export function createOpenAiCompatibleAdapter() { return { async probe({ account, credential, egress, signal, timeoutMs = 12_000 }) {
  const fail = (key) => { throw Object.assign(new Error(key), { errorKey: key }); };
  const endpoint = account.scope?.endpoint;
  if (!endpoint) fail('endpoint_invalid');
  if (signal?.aborted) fail('cancelled');
  const response = await egress.request({ url: `${endpoint.replace(/\/$/, '')}/models`, headers: { authorization: `Bearer ${credential}` }, signal, timeoutMs, maxResponseBytes: 64 * 1024 });
  if (response.status === 401 || response.status === 403) fail('authentication_failed');
  if (response.status === 429) fail('rate_limited');
  if (!response.ok) fail('upstream_unavailable');
  let body;
  try { body = await response.json(); } catch { fail('protocol_mismatch'); }
  if (signal?.aborted) fail('cancelled');
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Array.isArray(body.data) || body.data.some((item) => !item || typeof item !== 'object' || Array.isArray(item) || typeof item.id !== 'string' || !item.id.trim())) fail('protocol_mismatch');
  return { status: 'ok' };
} }; }
