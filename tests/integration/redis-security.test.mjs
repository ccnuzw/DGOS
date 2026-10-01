import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '../../apps/api/node_modules/redis/dist/index.js';
import { RedisRateLimiter } from '../../src/security/rate-limiter.mjs';
import { RedisSecretService } from '../../src/security/secret-service.mjs';

test('Redis rate limiter and secret backend work against local Redis', async (t) => {
  const redis = createClient({ url: process.env.DGOS_REDIS_URL ?? 'redis://127.0.0.1:6379' });
  try { await redis.connect(); } catch (error) { t.skip(`Redis unavailable: ${error.message}`); return; }
  const suffix = Date.now().toString();
  const limiter = new RedisRateLimiter(redis);
  assert.equal((await limiter.consume(`integration-${suffix}`, { limit: 1, windowMs: 1000 })).allowed, true);
  assert.equal((await limiter.consume(`integration-${suffix}`, { limit: 1, windowMs: 1000 })).allowed, false);
  const secrets = new RedisSecretService(redis);
  const ref = `integration/${suffix}`;
  await secrets.put({ secretRef: ref, value: 'redis-secret', purpose: 'test', subjectId: 'integration', ttlMs: 1000 });
  const handle = await secrets.resolve({ secretRef: ref, purpose: 'test', subjectId: 'integration' });
  assert.equal(await handle.read(), 'redis-secret');
  await secrets.revoke(ref);
  await limiter.reset(`integration-${suffix}`);
  await redis.quit();
});
