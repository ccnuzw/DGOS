import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assertDelegatedKeyScopes, authenticateApiKey, IdentityService } from '../../apps/api/src/identity-service.mjs';
import { InMemoryIdentityRepository } from '../../src/identity/repository.mjs';
import { InMemorySecretService } from '../../src/security/secret-service.mjs';

test('key scopes cannot widen an API key caller and owner cannot change', async () => {
  assert.throws(() => assertDelegatedKeyScopes(['*'], ['*']), /invalid_scope/);
  assert.throws(() => assertDelegatedKeyScopes(['provider.account.write'], ['apiKey.manage']), /permission_denied/);
  assert.doesNotThrow(() => assertDelegatedKeyScopes(['audit.read'], ['*']));
  const service = new IdentityService({ repository: new InMemoryIdentityRepository(), secretService: new InMemorySecretService() });
  await assert.rejects(service.createKey({ ownerId: 'other', actorId: 'caller', name: 'bad', scopes: ['audit.read'] }), /permission_denied/);
  const owner = await service.bootstrap({ displayName: 'owner', credential: 'secret', requestId: 'bootstrap' });
  const issued = await service.createKey({ ownerId: owner.principalId, actorId: owner.principalId, name: 'owned', scopes: ['audit.read'], requestId: 'create' });
  await assert.rejects(service.revokeKey({ keyId: issued.key.keyId, actorId: 'other', requestId: 'deny' }), /permission_denied/);
  assert.equal((await service.repository.getKey(issued.key.keyId)).state, 'active');
  assert.equal(service.repository.audits.filter((audit) => audit.action === 'api_key.revoke').length, 0);
});

test('API key expiry and rotation cutoff are checked at authentication time', () => {
  const secret = 'expiry-check';
  const record = { state: 'active', digest: createHash('sha256').update(secret).digest('hex'), expiresAt: new Date(2_000).toISOString() };
  assert.equal(authenticateApiKey(secret, [record], 1_999), record);
  assert.equal(authenticateApiKey(secret, [record], 2_000), undefined);
  record.state = 'rotation_pending'; record.expiresAt = null; record.rotationUntil = new Date(3_000).toISOString();
  assert.equal(authenticateApiKey(secret, [record], 2_999), record);
  assert.equal(authenticateApiKey(secret, [record], 3_000), undefined);
});
