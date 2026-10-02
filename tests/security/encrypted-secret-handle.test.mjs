import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { EncryptedRedisSecretService } from '../../src/security/secret-service.mjs';

class RedisStub {
  records = new Map();
  clock = () => Date.now();
  async hGet(key, field) { return this.records.get(key)?.fields[field] ?? null; }
  async hSet(key, fields) { this.records.set(key, { fields, expiresAt: Infinity }); }
  async pExpire(key, ttl) { this.records.get(key).expiresAt = this.clock() + ttl; }
  async pTTL(key) { const record = this.records.get(key); return record ? Math.max(-1, record.expiresAt - this.clock()) : -2; }
  async hGetAll(key) { return (await this.pTTL(key)) > 0 ? { ...this.records.get(key).fields } : {}; }
  async del(key) { this.records.delete(key); }
}

test('encrypted secret handles fail closed after revoke, version change and handle expiry', async () => {
  let now = 1_000;
  const redis = new RedisStub(); redis.clock = () => now;
  const key = randomBytes(32);
  const service = new EncryptedRedisSecretService(redis, { keyProvider: { getKey: async () => key }, clock: () => now, namespace: 'v1-gov', handleTtlMs: 50 });
  const input = { secretRef: 'test/handle', purpose: 'test', subjectId: 'owner', ttlMs: 500 };
  await service.put({ ...input, value: 'first' });
  const revoked = await service.resolve(input);
  assert.equal(await revoked.read(), 'first');
  await service.revoke(input.secretRef);
  await assert.rejects(revoked.read(), /credential_unavailable/);

  await service.put({ ...input, value: 'second' });
  await assert.rejects(revoked.read(), /credential_unavailable/);
  const rotated = await service.resolve(input);
  assert.equal(await rotated.read(), 'second');
  await service.put({ ...input, value: 'third' });
  await assert.rejects(rotated.read(), /credential_unavailable/);

  const expired = await service.resolve(input);
  now += 51;
  await assert.rejects(expired.read(), /credential_unavailable/);
  const storageExpired = await service.resolve(input);
  now += 501;
  await assert.rejects(storageExpired.read(), /credential_unavailable/);
  assert.equal((await redis.hGetAll('v1-gov:secret:test/handle')).value, undefined);
});
