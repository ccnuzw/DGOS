import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function requireText(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

export class SecretBackend {
  async put() { throw new Error('secret_backend_not_implemented'); }
  async resolve() { throw new Error('secret_backend_not_implemented'); }
  async revoke() { throw new Error('secret_backend_not_implemented'); }
  async inspect() { throw new Error('secret_backend_not_implemented'); }
}

export class InMemorySecretService {
  #records = new Map();
  #clock;

  constructor({ clock = () => Date.now() } = {}) {
    this.#clock = clock;
  }

  async put({ secretRef, value, purpose, subjectId, ttlMs = 60_000 }) {
    requireText(secretRef, 'secretRef');
    requireText(value, 'value');
    requireText(purpose, 'purpose');
    requireText(subjectId, 'subjectId');
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
      throw new RangeError('ttlMs must be a positive safe integer');
    }

    const version = (this.#records.get(secretRef)?.version ?? 0) + 1;
    this.#records.set(secretRef, {
      digest: digest(value),
      value,
      purpose,
      subjectId,
      version,
      expiresAt: this.#clock() + ttlMs,
      revoked: false,
    });
    return { secretRef, version, credentialState: 'available' };
  }

  async resolve({ secretRef, purpose, subjectId }) {
    requireText(secretRef, 'secretRef');
    requireText(purpose, 'purpose');
    requireText(subjectId, 'subjectId');
    const record = this.#records.get(secretRef);
    if (!record || record.revoked || record.expiresAt <= this.#clock()) {
      throw new Error('credential_unavailable');
    }
    if (record.purpose !== purpose || record.subjectId !== subjectId) {
      throw new Error('credential_scope_denied');
    }
    return {
      secretRef,
      version: record.version,
      expiresAt: record.expiresAt,
      async read() {
        return record.value;
      },
    };
  }

  async revoke(secretRef) {
    const record = this.#records.get(secretRef);
    if (record) record.revoked = true;
  }

  async inspect(secretRef) {
    const record = this.#records.get(secretRef);
    if (!record) return { credentialState: 'missing' };
    return {
      credentialState: record.revoked || record.expiresAt <= this.#clock() ? 'unavailable' : 'available',
      version: record.version,
      digest: record.digest,
    };
  }
}

export class RedisSecretService {
  constructor(redis, { clock = () => Date.now(), keyPrefix, prefix, namespace = 'dgos' } = {}) { if (process.env.NODE_ENV === 'production') throw new Error('production_secret_backend_required'); this.redis = redis; this.clock = clock; this.keyPrefix = keyPrefix ?? prefix ?? `${namespace}:secret:`; }
  key(secretRef) { return `${this.keyPrefix}${secretRef}`; }
  async put({ secretRef, value, purpose, subjectId, ttlMs = 60_000 }) {
    requireText(secretRef, 'secretRef'); requireText(value, 'value'); requireText(purpose, 'purpose'); requireText(subjectId, 'subjectId');
    const key = this.key(secretRef); const previous = await this.redis.hGet(key, 'version'); const version = Number(previous ?? 0) + 1;
    await this.redis.hSet(key, { value, purpose, subjectId, version: String(version), digest: digest(value) }); await this.redis.pExpire(key, ttlMs);
    return { secretRef, version, credentialState: 'available' };
  }
  async resolve({ secretRef, purpose, subjectId }) {
    requireText(secretRef, 'secretRef'); requireText(purpose, 'purpose'); requireText(subjectId, 'subjectId');
    const record = await this.redis.hGetAll(this.key(secretRef));
    if (!record.value) throw new Error('credential_unavailable');
    if (record.purpose !== purpose || record.subjectId !== subjectId) throw new Error('credential_scope_denied');
    const expiresAt = this.clock() + Math.max(0, await this.redis.pTTL(this.key(secretRef)));
    return { secretRef, version: Number(record.version), expiresAt, async read() { return record.value; } };
  }
  async revoke(secretRef) { await this.redis.del(this.key(secretRef)); }
  async inspect(secretRef) { const key = this.key(secretRef); const record = await this.redis.hGetAll(key); if (!record.value) return { credentialState: 'missing' }; return { credentialState: 'available', version: Number(record.version), digest: record.digest }; }
}

// The key provider is a deployment-owned KMS/Secret backend adapter. Its key never enters Redis.
export class EncryptedRedisSecretService {
  constructor(redis, { keyProvider, clock = () => Date.now(), keyPrefix, prefix, namespace = 'dgos', handleTtlMs = 30_000 } = {}) {
    if (process.env.NODE_ENV === 'production') throw new Error('production_secret_backend_required');
    if (!keyProvider?.getKey) throw new Error('production_secret_backend_required');
    if (!Number.isSafeInteger(handleTtlMs) || handleTtlMs <= 0 || handleTtlMs > 60_000) throw new RangeError('handleTtlMs must be between 1 and 60000');
    this.redis = redis; this.keyProvider = keyProvider; this.clock = clock; this.keyPrefix = keyPrefix ?? prefix ?? `${namespace}:secret:`; this.handleTtlMs = handleTtlMs;
  }
  key(ref) { return `${this.keyPrefix}${ref}`; }
  async encryptionKey() {
    const key = await this.keyProvider.getKey();
    if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('secret_key_unavailable');
    return key;
  }
  async put({ secretRef, value, purpose, subjectId, ttlMs = 60_000 }) {
    [secretRef, value, purpose, subjectId].forEach((item, index) => requireText(item, ['secretRef', 'value', 'purpose', 'subjectId'][index]));
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) throw new RangeError('ttlMs must be a positive safe integer');
    const key = this.key(secretRef);
    const version = Number(await this.redis.hGet(key, 'version') ?? 0) + 1;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', await this.encryptionKey(), iv);
    cipher.setAAD(Buffer.from(`${secretRef}|${purpose}|${subjectId}|${version}`));
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    await this.redis.hSet(key, { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), purpose, subjectId, version: String(version), generation: randomUUID(), digest: digest(value) });
    await this.redis.pExpire(key, ttlMs);
    return { secretRef, version, credentialState: 'available' };
  }
  async resolve({ secretRef, purpose, subjectId }) {
    [secretRef, purpose, subjectId].forEach((item, index) => requireText(item, ['secretRef', 'purpose', 'subjectId'][index]));
    const record = await this.redis.hGetAll(this.key(secretRef));
    if (!record.ciphertext) throw new Error('credential_unavailable');
    if (record.purpose !== purpose || record.subjectId !== subjectId) throw new Error('credential_scope_denied');
    const ttl = await this.redis.pTTL(this.key(secretRef));
    if (ttl <= 0) throw new Error('credential_unavailable');
    const version = Number(record.version);
    const handleExpiresAt = this.clock() + Math.min(ttl, this.handleTtlMs);
    const service = this;
    return { secretRef, version, expiresAt: handleExpiresAt, async read() {
      if (service.clock() >= handleExpiresAt) throw new Error('credential_unavailable');
      const current = await service.redis.hGetAll(service.key(secretRef));
      const currentTtl = await service.redis.pTTL(service.key(secretRef));
      if (currentTtl <= 0 || !current.ciphertext || Number(current.version) !== version || current.generation !== record.generation || current.purpose !== purpose || current.subjectId !== subjectId) throw new Error('credential_unavailable');
      const key = await service.encryptionKey();
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(current.iv, 'base64'));
      decipher.setAAD(Buffer.from(`${secretRef}|${purpose}|${subjectId}|${version}`));
      decipher.setAuthTag(Buffer.from(current.tag, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(current.ciphertext, 'base64')), decipher.final()]).toString('utf8');
    } };
  }
  async revoke(secretRef) { await this.redis.del(this.key(secretRef)); }
  async inspect(secretRef) { const record = await this.redis.hGetAll(this.key(secretRef)); return record.ciphertext ? { credentialState: 'available', version: Number(record.version), digest: record.digest } : { credentialState: 'missing' }; }
}

export function generateApiKey() {
  const secret = `dgos_${randomBytes(32).toString('base64url')}`;
  return { secret, prefix: secret.slice(0, 12), digest: digest(secret) };
}

export function verifyApiKey(secret, expectedDigest) {
  requireText(secret, 'secret');
  requireText(expectedDigest, 'expectedDigest');
  const actual = Buffer.from(digest(secret), 'utf8');
  const expected = Buffer.from(expectedDigest, 'utf8');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
