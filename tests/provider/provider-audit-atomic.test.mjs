import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { PostgresProviderRepository } from '../../src/provider/repository.mjs';
import { PostgresProviderConfigRepository } from '../../src/provider-config/repository.mjs';
import { ProviderService } from '../../apps/api/src/provider-service.mjs';
import { ProviderConfigService } from '../../src/provider-config/service.mjs';
import { isIsolatedProviderDatabase } from './isolated-provider-database.mjs';

test('provider account and config audit failure rolls back state and revoke intent', async (t) => {
  if (!isIsolatedProviderDatabase(process.env.DGOS_DATABASE_URL)) { t.skip('requires isolated provider or Verify database'); return; }
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL });
  const ownerId = randomUUID(); const accountId = randomUUID(); const requestId = randomUUID();
  const accounts = new PostgresProviderRepository(pool);
  const configs = new PostgresProviderConfigRepository(pool);
  const revoked = [];
  const secret = { async revoke(ref) { revoked.push(ref); } };
  const egress = { async validateTarget() {} };
  const provider = new ProviderService({ repository: accounts, configRepository: configs, secretService: secret, egress });
  const configService = new ProviderConfigService({ repository: configs, accountRepository: accounts, registry: { get: () => ({ protocolVersion: 'v1' }) }, egress, audit: { async record() {} } });
  const originalAccountAudit = accounts.writeAudit.bind(accounts);
  const originalConfigAudit = configs.audit.record.bind(configs.audit);
  try {
    await pool.query('INSERT INTO admin_principals(principal_id,status,credential_ref) VALUES($1,$2,$3)', [ownerId, 'invited', `fixture:${ownerId}`]);
    await accounts.createAccount({ accountId, ownerId, protocolType: 'fixture', displayName: `atomic-${accountId}`, credentialRef: `fixture:${accountId}` });
    accounts.writeAudit = async () => { throw new Error('audit_unavailable'); };
    await assert.rejects(provider.setState({ accountId, version: '1', state: 'disabled', actorId: ownerId, requestId }), /audit_unavailable/);
    assert.equal((await accounts.getAccount(accountId)).status, 'credential_pending');
    await assert.rejects(provider.deleteAccount({ accountId, version: '1', actorId: ownerId, requestId }), /audit_unavailable/);
    assert.equal((await accounts.getAccount(accountId)).status, 'credential_pending');
    assert.equal((await accounts.listPendingSecretRevocations()).length, 0);
    accounts.writeAudit = originalAccountAudit;
    const config = await configService.create({ ownerId, providerAccountId: accountId, protocolType: 'fixture', displayName: 'Config', baseUrl: 'https://provider.fixture.test', requestId: randomUUID() });
    configs.audit.record = async () => { throw new Error('audit_unavailable'); };
    await assert.rejects(configService.remove(config.id, ownerId, randomUUID()), /audit_unavailable/);
    assert.equal((await configs.get(config.id)).status, 'draft');
    await assert.rejects(configService.update(config.id, { baseVersion: '1', displayName: 'Changed', requestId: randomUUID() }, ownerId), /audit_unavailable/);
    assert.equal((await configs.get(config.id)).displayName, 'Config');
    await assert.rejects(configService.policy(config.id, ownerId, { modelId: 'missing', enabled: true, requestId: randomUUID() }), (error) => error.message === 'model_not_found');
    configs.audit.record = originalConfigAudit;
    await configService.remove(config.id, ownerId, randomUUID());
    const deleted = await provider.deleteAccount({ accountId, version: '1', actorId: ownerId, requestId: randomUUID() });
    assert.equal(deleted.status, 'revoked');
    assert.deepEqual(revoked, []);
    assert.equal((await accounts.listPendingSecretRevocations()).length, 1);
    await provider.reconcileSecretRevocations();
    assert.deepEqual(revoked, [`fixture:${accountId}`]);
    assert.equal((await accounts.listPendingSecretRevocations()).length, 0);
  } finally {
    accounts.writeAudit = originalAccountAudit; configs.audit.record = originalConfigAudit;
    await pool.query('DELETE FROM provider_text_profiles WHERE owner_id=$1', [ownerId]);
    await pool.query('DELETE FROM provider_secret_revoke_intents WHERE account_id=$1', [accountId]);
    await pool.query('DELETE FROM provider_configs WHERE owner_id=$1', [ownerId]);
    await pool.query('DELETE FROM provider_accounts WHERE account_id=$1', [accountId]);
    await pool.query('DELETE FROM admin_principals WHERE principal_id=$1', [ownerId]);
    await pool.end();
  }
});
