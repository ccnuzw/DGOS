import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { VaultKMSProvider } from '../packages/secret-service/src/vault-client.ts';
import { DevKMSProvider } from '../packages/secret-service/src/dev-kms-provider.ts';
import { KMSSecretService } from '../packages/secret-service/src/kms-secret-service.ts';

describe('KMS Provider Interface', () => {
  describe('DevKMSProvider', () => {
    let provider;

    before(async () => {
      provider = new DevKMSProvider();
      await provider.init();
    });

    after(async () => {
      await provider.close();
    });

    it('should encrypt and decrypt data', async () => {
      const plaintext = 'test-secret-value';
      const context = { purpose: 'test', subjectId: 'user-123' };

      const encrypted = await provider.encrypt(plaintext, context);
      assert.ok(encrypted.ciphertext);
      assert.ok(encrypted.iv);
      assert.ok(encrypted.tag);
      assert.strictEqual(encrypted.algorithm, 'aes-256-gcm');

      const decrypted = await provider.decrypt(encrypted, context);
      assert.strictEqual(decrypted, plaintext);
    });

    it('should fail to decrypt with wrong context', async () => {
      const plaintext = 'test-secret-value';
      const context1 = { purpose: 'test', subjectId: 'user-123' };
      const context2 = { purpose: 'test', subjectId: 'user-456' };

      const encrypted = await provider.encrypt(plaintext, context1);

      await assert.rejects(
        async () => provider.decrypt(encrypted, context2),
        /Decryption failed/
      );
    });

    it('should generate data key', async () => {
      const dataKey = await provider.generateDataKey();
      assert.ok(Buffer.isBuffer(dataKey.plaintext));
      assert.strictEqual(dataKey.plaintext.length, 32);
      assert.ok(dataKey.ciphertext);
      assert.strictEqual(dataKey.keyId, 'dev-master-key');
    });

    it('should store and retrieve secrets', async () => {
      const key = 'test-secret-1';
      const value = 'my-secret-value';
      const metadata = {
        purpose: 'test',
        subjectId: 'user-123',
        ttlSeconds: 3600,
      };

      const ref = await provider.storeSecret(key, value, metadata);
      assert.strictEqual(ref.path, key);
      assert.strictEqual(ref.version, 1);

      const retrieved = await provider.retrieveSecret(ref);
      assert.strictEqual(retrieved.value, value);
      assert.strictEqual(retrieved.version, 1);
      assert.strictEqual(retrieved.metadata.purpose, metadata.purpose);
    });

    it('should support secret versioning', async () => {
      const key = 'versioned-secret';
      const value1 = 'version-1';
      const value2 = 'version-2';

      const ref1 = await provider.storeSecret(key, value1);
      assert.strictEqual(ref1.version, 1);

      const ref2 = await provider.storeSecret(key, value2);
      assert.strictEqual(ref2.version, 2);

      const retrieved1 = await provider.retrieveSecret({ path: key, version: 1 });
      assert.strictEqual(retrieved1.value, value1);

      const retrieved2 = await provider.retrieveSecret({ path: key, version: 2 });
      assert.strictEqual(retrieved2.value, value2);

      const retrievedLatest = await provider.retrieveSecret({ path: key });
      assert.strictEqual(retrievedLatest.value, value2);
    });

    it('should rotate secrets', async () => {
      const key = 'rotate-test';
      const value1 = 'original-value';

      const ref1 = await provider.storeSecret(key, value1);
      const ref2 = await provider.rotateSecret(ref1, 'rotated-value');

      assert.strictEqual(ref2.version, 2);

      const retrieved = await provider.retrieveSecret(ref2);
      assert.strictEqual(retrieved.value, 'rotated-value');
    });

    it('should delete secrets', async () => {
      const key = 'delete-test';
      const value = 'to-be-deleted';

      const ref = await provider.storeSecret(key, value);
      await provider.deleteSecret(ref, true);

      await assert.rejects(
        async () => provider.retrieveSecret(ref),
        /Secret not found/
      );
    });

    it('should list secrets', async () => {
      await provider.storeSecret('list-test-1', 'value1');
      await provider.storeSecret('list-test-2', 'value2');
      await provider.storeSecret('other-secret', 'value3');

      const allSecrets = await provider.listSecrets();
      assert.ok(allSecrets.length >= 3);

      const filtered = await provider.listSecrets('list-test');
      assert.ok(filtered.length >= 2);
    });

    it('should check health', async () => {
      const health = await provider.healthCheck();
      assert.strictEqual(health.available, true);
      assert.ok(health.keyId);
    });

    it('should handle secret expiration', async () => {
      const key = 'expired-secret';
      const value = 'will-expire';
      const metadata = {
        purpose: 'test',
        subjectId: 'user-123',
        ttlSeconds: 0, // Expire immediately
      };

      const ref = await provider.storeSecret(key, value, metadata);

      // Wait a bit to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      await assert.rejects(
        async () => provider.retrieveSecret(ref),
        /Secret expired/
      );
    });
  });
});

describe('KMSSecretService', () => {
  let provider;
  let service;

  before(async () => {
    provider = new DevKMSProvider();
    service = new KMSSecretService({ kmsProvider: provider });
    await service.init();
  });

  after(async () => {
    await service.close();
  });

  it('should put and resolve secrets', async () => {
    const secretRef = 'provider-credential:test-123';
    const value = 'my-api-key';
    const purpose = 'provider-account';
    const subjectId = 'user-456';

    const result = await service.put({
      secretRef,
      value,
      purpose,
      subjectId,
      ttlMs: 60_000,
    });

    assert.strictEqual(result.secretRef, secretRef);
    assert.strictEqual(result.credentialState, 'available');
    assert.strictEqual(result.version, 1);

    const resolved = await service.resolve({
      secretRef,
      purpose,
      subjectId,
    });

    assert.strictEqual(resolved.secretRef, secretRef);
    assert.strictEqual(resolved.version, 1);
    assert.ok(resolved.expiresAt > Date.now());

    const retrievedValue = await resolved.read();
    assert.strictEqual(retrievedValue, value);
  });

  it('should enforce scope validation', async () => {
    const secretRef = 'provider-credential:scope-test';
    const value = 'secret-value';

    await service.put({
      secretRef,
      value,
      purpose: 'provider-account',
      subjectId: 'user-123',
      ttlMs: 60_000,
    });

    await assert.rejects(
      async () => service.resolve({
        secretRef,
        purpose: 'provider-account',
        subjectId: 'user-456', // Wrong subject
      }),
      /credential_scope_denied/
    );

    await assert.rejects(
      async () => service.resolve({
        secretRef,
        purpose: 'wrong-purpose',
        subjectId: 'user-123',
      }),
      /credential_scope_denied/
    );
  });

  it('should revoke secrets', async () => {
    const secretRef = 'provider-credential:revoke-test';
    const value = 'to-be-revoked';

    await service.put({
      secretRef,
      value,
      purpose: 'provider-account',
      subjectId: 'user-123',
      ttlMs: 60_000,
    });

    await service.revoke(secretRef);

    await assert.rejects(
      async () => service.resolve({
        secretRef,
        purpose: 'provider-account',
        subjectId: 'user-123',
      }),
      /credential_unavailable/
    );
  });

  it('should inspect secret state', async () => {
    const secretRef = 'provider-credential:inspect-test';
    const value = 'inspect-value';

    // Not yet created
    let state = await service.inspect(secretRef);
    assert.strictEqual(state.credentialState, 'missing');

    // After creation
    await service.put({
      secretRef,
      value,
      purpose: 'provider-account',
      subjectId: 'user-123',
      ttlMs: 60_000,
    });

    state = await service.inspect(secretRef);
    assert.strictEqual(state.credentialState, 'available');
    assert.strictEqual(state.version, 1);
    assert.ok(state.digest);

    // After revocation
    await service.revoke(secretRef);

    state = await service.inspect(secretRef);
    assert.strictEqual(state.credentialState, 'unavailable');
  });

  it('should check health', async () => {
    const health = await service.healthCheck();
    assert.strictEqual(health.available, true);
  });

  it('should handle expired credentials', async () => {
    const secretRef = 'provider-credential:expired-test';
    const value = 'will-expire';

    await service.put({
      secretRef,
      value,
      purpose: 'provider-account',
      subjectId: 'user-123',
      ttlMs: 1, // Expire in 1ms
    });

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 10));

    await assert.rejects(
      async () => service.resolve({
        secretRef,
        purpose: 'provider-account',
        subjectId: 'user-123',
      }),
      /credential_unavailable/
    );
  });

  it('should validate input parameters', async () => {
    await assert.rejects(
      async () => service.put({
        secretRef: '',
        value: 'test',
        purpose: 'test',
        subjectId: 'test',
      }),
      /must be a non-empty string/
    );

    await assert.rejects(
      async () => service.put({
        secretRef: 'test',
        value: '',
        purpose: 'test',
        subjectId: 'test',
      }),
      /must be a non-empty string/
    );

    await assert.rejects(
      async () => service.put({
        secretRef: 'test',
        value: 'test',
        purpose: 'test',
        subjectId: 'test',
        ttlMs: -1,
      }),
      /must be a positive safe integer/
    );
  });
});
