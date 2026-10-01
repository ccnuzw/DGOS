import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryRateLimiter } from '../../src/security/rate-limiter.mjs';

test('in-memory rate limiter resets after its window', async () => {
  let now = 1000;
  const limiter = new InMemoryRateLimiter({ clock: () => now });
  assert.equal((await limiter.consume('client', { limit: 2, windowMs: 100 })).allowed, true);
  assert.equal((await limiter.consume('client', { limit: 2, windowMs: 100 })).allowed, true);
  assert.equal((await limiter.consume('client', { limit: 2, windowMs: 100 })).allowed, false);
  now = 1101;
  assert.equal((await limiter.consume('client', { limit: 2, windowMs: 100 })).allowed, true);
});
