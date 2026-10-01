import Fastify from 'fastify';
import { apiVersion } from '@dgos/sdk';

export function buildServer({ logger = true } = {}) {
  const app = Fastify({ logger });

  app.get('/health', async () => ({ status: 'ok', service: 'dgos-api' }));
  app.get('/ready', async () => ({ status: 'ready', apiVersion }));
  app.get('/api/v1/system/info', async () => ({
    product: 'DGOS',
    version: 'v1',
    apiVersion,
    implementationStatus: 'foundation',
  }));

  return app;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const app = buildServer();
  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ host, port });
}
