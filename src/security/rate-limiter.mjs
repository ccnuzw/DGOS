import { createHash } from 'node:crypto';

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
  constructor(redis, { namespace = 'dgos', prefix } = {}) { this.redis = redis; this.prefix = prefix ?? `${namespace}:ratelimit:`; }
  async consume(key, { limit, windowMs }) {
    const result = await this.redis.eval(LUA_INCREMENT, { keys: [`${this.prefix}${key}`], arguments: [String(windowMs)] });
    const count = Number(result[0]);
    const ttl = Math.max(0, Number(result[1]));
    return { allowed: count <= limit, count, retryAfterMs: ttl };
  }
  async reset(key) { await this.redis.del(`${this.prefix}${key}`); }
}

export function createRateLimiter({ redis, clock, namespace, prefix } = {}) {
  return redis ? new RedisRateLimiter(redis, { namespace, prefix }) : new InMemoryRateLimiter({ clock });
}

const LUA_FAILURE_BACKOFF = `
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local base = tonumber(ARGV[3])
local maxDelay = tonumber(ARGV[4])
local subjectCount = tonumber(redis.call('HGET', KEYS[1], 'count') or '0')
local sourceCount = tonumber(redis.call('HGET', KEYS[2], 'count') or '0')
local subjectUntil = tonumber(redis.call('HGET', KEYS[1], 'blockedUntil') or '0')
local sourceUntil = tonumber(redis.call('HGET', KEYS[2], 'blockedUntil') or '0')
if ARGV[5] == 'check' then return {math.max(subjectUntil, sourceUntil) - now, subjectCount, sourceCount} end
for i=1,2 do
  local count = redis.call('HINCRBY', KEYS[i], 'count', 1)
  local delay = math.min(maxDelay, base * (2 ^ math.min(count - 1, 16)))
  redis.call('HSET', KEYS[i], 'blockedUntil', now + delay)
  redis.call('PEXPIRE', KEYS[i], window)
end
return {math.max(tonumber(redis.call('HGET', KEYS[1], 'blockedUntil')), tonumber(redis.call('HGET', KEYS[2], 'blockedUntil'))) - now, subjectCount + 1, sourceCount + 1}
`;

function fingerprint(value) { return createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex'); }

export class InMemoryLoginBackoff {
  #entries = new Map();
  constructor({ clock = () => Date.now(), windowMs = 15 * 60_000, baseDelayMs = 250, maxDelayMs = 60_000 } = {}) { Object.assign(this, { clock, windowMs, baseDelayMs, maxDelayMs }); }
  #key(type, value) { return `${type}:${fingerprint(value)}`; }
  async check({ subject, source }) { const now = this.clock(); const entries = [this.#entries.get(this.#key('subject', subject)), this.#entries.get(this.#key('source', source))].filter((entry) => entry && entry.expiresAt > now); const retryAfterMs = Math.max(0, ...entries.map((entry) => entry.blockedUntil - now)); return { allowed: retryAfterMs === 0, retryAfterMs }; }
  async failure({ subject, source }) { const now = this.clock(); const keys = [this.#key('subject', subject), this.#key('source', source)]; let retryAfterMs = 0; for (const key of keys) { const prior = this.#entries.get(key); const count = prior?.expiresAt > now ? prior.count + 1 : 1; const delay = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** Math.min(count - 1, 16)); this.#entries.set(key, { count, blockedUntil: now + delay, expiresAt: now + this.windowMs }); retryAfterMs = Math.max(retryAfterMs, delay); } return { allowed: false, retryAfterMs }; }
  async success({ subject }) { this.#entries.delete(this.#key('subject', subject)); }
}

export class RedisLoginBackoff {
  constructor(redis, { clock = () => Date.now(), namespace = 'dgos', prefix, windowMs = 15 * 60_000, baseDelayMs = 250, maxDelayMs = 60_000 } = {}) { Object.assign(this, { redis, clock, windowMs, baseDelayMs, maxDelayMs }); this.prefix = prefix ?? `${namespace}:login-backoff:`; }
  #keys(subject, source) { return [`${this.prefix}subject:${fingerprint(subject)}`, `${this.prefix}source:${fingerprint(source)}`]; }
  async #evaluate(input, action) { const result = await this.redis.eval(LUA_FAILURE_BACKOFF, { keys: this.#keys(input.subject, input.source), arguments: [String(this.clock()), String(this.windowMs), String(this.baseDelayMs), String(this.maxDelayMs), action] }); const retryAfterMs = Math.max(0, Number(result[0])); return { allowed: retryAfterMs === 0, retryAfterMs }; }
  async check(input) { return this.#evaluate(input, 'check'); }
  async failure(input) { return this.#evaluate(input, 'failure'); }
  async success({ subject }) { await this.redis.del(`${this.prefix}subject:${fingerprint(subject)}`); }
}

export function createLoginBackoff({ redis, ...options } = {}) { return redis ? new RedisLoginBackoff(redis, options) : new InMemoryLoginBackoff(options); }
