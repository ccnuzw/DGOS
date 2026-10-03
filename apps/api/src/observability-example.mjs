/**
 * Example: Integrating observability into existing API server
 *
 * This example shows how to add comprehensive observability to server.mjs
 */

import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createClient } from 'redis';

// Import observability components
import { createLogger, runWithContext } from '@dgos/logger';
import { metrics, withTiming } from '@dgos/logger/metrics';
import {
  healthCheck,
  createDatabaseCheck,
  createRedisCheck,
  createMemoryCheck
} from '@dgos/logger/health';
import { tracer, extractTraceContext } from '@dgos/logger/tracing';
import { errorAggregator } from '@dgos/logger/errors';

// Create logger
const logger = createLogger('api-server');

/**
 * Build server with observability
 */
export function buildServerWithObservability() {
  const app = Fastify({
    logger: false, // We'll use our custom logger
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    genReqId: () => randomUUID()
  });

  const pools = [];
  const makePool = () => {
    const pool = new pg.Pool({
      connectionString: process.env.DGOS_DATABASE_URL
    });

    // Wrap pool.query with observability
    const originalQuery = pool.query.bind(pool);
    pool.query = async function(sql, params) {
      return withTiming('db.query.time', async () => {
        const start = Date.now();

        try {
          const result = await originalQuery(sql, params);
          const duration = Date.now() - start;

          metrics.counter('db.queries.total', 1);

          if (duration > 100) {
            logger.warn('Slow query detected', {
              duration,
              command: result.command,
              rowCount: result.rows?.length
            });
          }

          return result;
        } catch (error) {
          metrics.counter('db.errors.total', 1, {
            code: error.code
          });

          logger.error('Database query failed', error, {
            code: error.code
          });

          throw error;
        }
      });
    };

    pools.push(pool);
    return pool;
  };

  // Setup Redis with health check
  const redis = process.env.REDIS_URL ? createClient({
    url: process.env.REDIS_URL
  }) : null;

  // Register health checks
  if (pools.length > 0) {
    const dbCheck = createDatabaseCheck(pools[0]);
    healthCheck.register(dbCheck.name, dbCheck.check);
  }

  if (redis) {
    const redisCheck = createRedisCheck(redis);
    healthCheck.register(redisCheck.name, redisCheck.check);
  }

  const memCheck = createMemoryCheck();
  healthCheck.register(memCheck.name, memCheck.check);

  // Request logging middleware
  app.addHook('onRequest', async (request, reply) => {
    request.startTime = Date.now();
    request.requestId = request.id;

    // Extract or create trace context
    const traceContext = extractTraceContext(request.headers) || tracer.startTrace();
    request.traceContext = traceContext;

    // Set headers
    reply.header('x-request-id', request.requestId);
    reply.header('x-trace-id', traceContext.traceId);

    // Log request start
    await runWithContext({
      requestId: request.requestId,
      traceId: traceContext.traceId,
      component: 'api-server'
    }, async () => {
      logger.info('Request started', {
        method: request.method,
        path: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });
    });
  });

  // Response logging and metrics
  app.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - request.startTime;
    const statusCode = reply.statusCode;

    // Record metrics
    metrics.timing('api.response.time', duration, {
      method: request.method,
      route: request.routerPath || 'unknown',
      status: String(statusCode)
    });

    metrics.counter('api.requests.total', 1, {
      method: request.method,
      status: String(statusCode)
    });

    if (statusCode >= 400) {
      metrics.counter('api.errors.total', 1, {
        method: request.method,
        status: String(statusCode)
      });
    }

    // Log response
    await runWithContext({
      requestId: request.requestId,
      component: 'api-server'
    }, async () => {
      const logData = {
        method: request.method,
        path: request.url,
        statusCode,
        duration
      };

      if (statusCode >= 500) {
        logger.error('Request failed', null, logData);
      } else if (statusCode >= 400) {
        logger.warn('Request completed with error', logData);
      } else {
        logger.info('Request completed', logData);
      }

      if (duration > 1000) {
        logger.warn('Slow request detected', {
          ...logData,
          threshold: 1000
        });
      }
    });
  });

  // Error handler with observability
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;

    // Record error
    errorAggregator.record(error, {
      operation: `${request.method} ${request.url}`,
      requestId: request.requestId
    });

    // Log error
    runWithContext({ requestId: request.requestId }, () => {
      if (statusCode >= 500) {
        logger.error('Request error', error, {
          method: request.method,
          path: request.url,
          statusCode,
          errorCode: error.code
        });
      }
    });

    // Send response
    reply.code(statusCode).send({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: statusCode >= 500 ? 'Internal server error' : error.message
      },
      requestId: request.requestId
    });
  });

  // Health endpoints
  app.get('/api/v1/health', async (request, reply) => {
    const health = await healthCheck.check();
    const statusCode = health.status === 'unhealthy' ? 503 : 200;
    return reply.code(statusCode).send({
      ...health,
      version: '1.0.0'
    });
  });

  app.get('/api/v1/ready', async (request, reply) => {
    const isReady = await healthCheck.ready();
    if (isReady) {
      return { status: 'ready' };
    } else {
      return reply.code(503).send({ status: 'not_ready' });
    }
  });

  app.get('/api/v1/alive', async () => {
    return {
      status: 'alive',
      uptime: process.uptime()
    };
  });

  // Metrics endpoints
  app.get('/api/v1/metrics', async (request, reply) => {
    reply.header('content-type', 'text/plain; charset=utf-8');
    return metrics.toPrometheus();
  });

  app.get('/api/v1/metrics/snapshot', async () => {
    return {
      ...metrics.snapshot(),
      errors: errorAggregator.stats(),
      errorRate: errorAggregator.errorRate(60000)
    };
  });

  // Example API route with observability
  app.get('/api/v1/tasks', async (request, reply) => {
    // Simulate database query with timing
    const tasks = await withTiming('db.query.tasks', async () => {
      // Simulate query
      await new Promise(resolve => setTimeout(resolve, 50));
      return [
        { id: '1', title: 'Task 1' },
        { id: '2', title: 'Task 2' }
      ];
    });

    return { tasks };
  });

  // Cleanup
  app.addHook('onClose', async () => {
    logger.info('Server shutting down');

    if (redis) await redis.quit();
    await Promise.all(pools.map(pool => pool.end()));
  });

  logger.info('Server initialized with observability', {
    healthChecks: Array.from(healthCheck._checks?.keys() || []),
    metricsEnabled: true,
    tracingEnabled: true
  });

  return app;
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = buildServerWithObservability();

  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 3000);

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      logger.info('Shutdown signal received', { signal });
      app.close().catch(() => { process.exitCode = 1; });
    });
  }

  await app.listen({ host, port });
  logger.info('Server started', { host, port });
}
