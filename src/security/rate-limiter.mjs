const LUA_INCREMENT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return { count, redis.call('PTTL', KEYS[1]) }
`;

export class InMemoryRateLimiter {
  #entries = new Map();
  constructor({ clock = () => Date.now() } = {}) { this.clock = clock; }
  async consume(key, { limit, windowMs }) {
    const now = this.clock();
    const current = this.#entries.get(key);
    const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    entry.count += 1;
    this.#entries.set(key, entry);
    return { allowed: entry.count <= limit, count: entry.count, retryAfterMs: Math.max(0, entry.resetAt - now) };
  }
  async reset(key) { this.#entries.delete(key); }
}

export class RedisRateLimiter {
  constructor(redis) { this.redis = redis; }
  async consume(key, { limit, windowMs }) {
    const result = await this.redis.eval(LUA_INCREMENT, { keys: [`dgos:ratelimit:${key}`], arguments: [String(windowMs)] });
    const count = Number(result[0]);
    const ttl = Math.max(0, Number(result[1]));
    return { allowed: count <= limit, count, retryAfterMs: ttl };
  }
  async reset(key) { await this.redis.del(`dgos:ratelimit:${key}`); }
}

export function createRateLimiter({ redis, clock } = {}) {
  return redis ? new RedisRateLimiter(redis) : new InMemoryRateLimiter({ clock });
}
