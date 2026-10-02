import { createRequire } from 'node:module';
import { buildServer } from '../apps/api/src/server.mjs';
import { createLoginBackoff, createRateLimiter } from '../src/security/rate-limiter.mjs';
import { createRuntimeEgress } from '../src/security/runtime-egress.mjs';
import { createProductionSecretAuditAccess, createProductionSecretService, validateProductionConfig } from '../src/security/runtime-config.mjs';

validateProductionConfig();
const requireApiDependency = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { createClient } = requireApiDependency('redis');
const { Pool } = requireApiDependency('pg');
const database = new Pool({ connectionString: process.env.DGOS_DATABASE_URL, max: 2, connectionTimeoutMillis: 3000 });
database.on('error', () => {});
await database.query('SELECT 1');
const secretService = await createProductionSecretService({ auditAccess: createProductionSecretAuditAccess(database) });
const redis = createClient({ url: process.env.REDIS_URL, disableOfflineQueue: true, socket: { reconnectStrategy: (retries) => Math.min(1000, 100 * 2 ** Math.min(retries, 4)) } });
redis.on('error', () => {});
await redis.connect();
const namespace = process.env.DGOS_REDIS_NAMESPACE ?? 'dgos';
const app = buildServer({ closeDatabasePools: true, secretService, rateLimiter: createRateLimiter({ redis, namespace }), loginBackoff: createLoginBackoff({ redis, namespace }), providerEgress: createRuntimeEgress() });
app.addHook('onRequest', async (request) => {
  if (request.url === '/ready') {
    try {
      await secretService.checkReady();
      await secretService.verifyCiphertext();
      await database.query('SELECT 1');
      if (!redis.isReady || await redis.ping() !== 'PONG') throw new Error('dependency_unavailable');
    } catch { throw Object.assign(new Error('dependency_unavailable'), { statusCode: 503 }); }
  }
});
app.addHook('onClose', async () => { await database.end(); await redis.quit(); });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => app.close().catch(() => { process.exitCode = 1; }));
await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 3000) });
