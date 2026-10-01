import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

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
  constructor(redis, { clock = () => Date.now(), keyPrefix = 'dgos:secret:' } = {}) { this.redis = redis; this.clock = clock; this.keyPrefix = keyPrefix; }
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
