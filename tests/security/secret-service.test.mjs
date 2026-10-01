import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemorySecretService, generateApiKey, verifyApiKey } from '../../src/security/secret-service.mjs';

test('SecretService scopes and expires short-lived handles', async () => {
  let now = 1000;
  const service = new InMemorySecretService({ clock: () => now });
  await service.put({ secretRef: 'secret/provider/1', value: 'top-secret', purpose: 'provider-test', subjectId: 'admin-1', ttlMs: 10 });
  const handle = await service.resolve({ secretRef: 'secret/provider/1', purpose: 'provider-test', subjectId: 'admin-1' });
  assert.equal(await handle.read(), 'top-secret');
  await assert.rejects(service.resolve({ secretRef: 'secret/provider/1', purpose: 'other', subjectId: 'admin-1' }), /credential_scope_denied/);
  now = 1011;
  await assert.rejects(service.resolve({ secretRef: 'secret/provider/1', purpose: 'provider-test', subjectId: 'admin-1' }), /credential_unavailable/);
});

test('API key verification is digest based and does not require plaintext storage', () => {
  const key = generateApiKey();
  assert.equal(verifyApiKey(key.secret, key.digest), true);
  assert.equal(verifyApiKey(`${key.secret}x`, key.digest), false);
});
