/**
 * Enhanced API server with comprehensive observability
 *
 * This module extends the existing server.mjs with logging, metrics, and health checks
 */

import { createLogger, runWithContext } from '@dgos/logger';
import { metrics, withTiming } from '@dgos/logger/metrics';
import { healthCheck, createDatabaseCheck, createRedisCheck, createMemoryCheck } from '@dgos/logger/health';
import { tracer, extractTraceContext, injectTraceContext } from '@dgos/logger/tracing';
import { errorAggregator } from '@dgos/logger/errors';

const logger = createLogger('api-server');

/**
 * Create observability middleware for Fastify
 */
export function createObservabilityPlugin(app, options = {}) {
  const {
    enableMetrics = true,
    enableTracing = true,
    enableHealthChecks = true,
    pools = [],
    redis = null
  } = options;

  // Request logging and metrics middleware
  app.addHook('onRequest', async (request, reply) => {
    request.observability = {
      startTime: Date.now(),
      requestId: request.headers['x-request-id'] || crypto.randomUUID()
    };

    // Set request ID header
    reply.header('x-request-id', request.observability.requestId);

    // Extract or create trace context
    if (enableTracing) {
      const traceContext = extractTraceContext(request.headers) || tracer.startTrace();
      request.observability.traceContext = traceContext;
      reply.header('x-trace-id', traceContext.traceId);
    }

    // Start async context for logging
    const context = {
      requestId: request.observability.requestId,
      component: 'api-server',
      operation: `${request.method} ${request.url}`
    };

    await runWithContext(context, async () => {
      logger.info('Request started', {
        method: request.method,
        path: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });
    });
  });

  // Response timing and metrics
  app.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - request.observability.startTime;
    const statusCode = reply.statusCode;

    // Record metrics
    if (enableMetrics) {
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
    }

    // Log completion
    const context = {
      requestId: request.observability.requestId,
      component: 'api-server'
    };

    await runWithContext(context, async () => {
      const logData = {
        method: request.method,
        path: request.url,
        statusCode,
        duration
      };

      if (statusCode >= 500) {
        logger.error('Request failed', null, logData);
      } else if (statusCode >= 400) {
        logger.warn('Request completed with client error', logData);
      } else {
        logger.info('Request completed', logData);
      }

      // Warn on slow requests
      if (duration > 1000) {
        logger.warn('Slow request detected', { ...logData, threshold: 1000 });
      }
    });
  });

  // Enhanced error handler with observability
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || error.httpStatus || 500;
    const requestId = request.observability?.requestId || request.id;

    // Record error
    errorAggregator.record(error, {
      operation: `${request.method} ${request.url}`,
      requestId
    });

    // Log error with context
    runWithContext({ requestId }, () => {
      if (statusCode >= 500) {
        logger.error('Request error', error, {
          method: request.method,
          path: request.url,
          statusCode,
          errorCode: error.code,
          isOperational: error.isOperational
        });
      } else {
        logger.warn('Client error', {
          method: request.method,
          path: request.url,
          statusCode,
          errorCode: error.code,
          message: error.message
        });
      }
    });

    // Send error response
    const response = {
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: statusCode >= 500 ? 'Internal server error' : error.message
      },
      requestId
    };

    if (statusCode >= 500) {
      response.retryable = true;
    }

    reply.code(statusCode).send(response);
  });

  // Health check routes
  if (enableHealthChecks) {
    // Register database health checks
    for (const pool of pools) {
      const check = createDatabaseCheck(pool);
      healthCheck.register(check.name, check.check);
    }

    // Register Redis health check
    if (redis) {
      const check = createRedisCheck(redis);
      healthCheck.register(check.name, check.check);
    }

    // Register memory check
    const memCheck = createMemoryCheck();
    healthCheck.register(memCheck.name, memCheck.check);

    // Health endpoint
    app.get('/api/v1/health', async (request, reply) => {
      const health = await healthCheck.check();
      const statusCode = health.status === 'unhealthy' ? 503 : 200;

      return reply.code(statusCode).send({
        ...health,
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // Readiness probe
    app.get('/api/v1/ready', async (request, reply) => {
      try {
        const isReady = await healthCheck.ready();
        if (isReady) {
          return {
            status: 'ready',
            timestamp: new Date().toISOString()
          };
        } else {
          return reply.code(503).send({
            status: 'not_ready',
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        return reply.code(503).send({
          status: 'not_ready',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Liveness probe
    app.get('/api/v1/alive', async () => {
      return {
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      };
    });

    // Metrics endpoint (Prometheus format)
    app.get('/api/v1/metrics', async (request, reply) => {
      reply.header('content-type', 'text/plain; charset=utf-8');
      return metrics.toPrometheus();
    });

    // Metrics snapshot (JSON format)
    app.get('/api/v1/metrics/snapshot', async () => {
      return {
        ...metrics.snapshot(),
        errors: errorAggregator.stats(),
        errorRate: errorAggregator.errorRate(60000) // Last minute
      };
    });

    // Trace endpoint (for debugging)
    app.get('/api/v1/debug/traces', async (request) => {
      const traceId = request.query.traceId;
      if (traceId) {
        return { traces: tracer.getTrace(traceId) };
      }
      return { traces: tracer.getRecentSpans(50) };
    });
  }

  logger.info('Observability plugin initialized', {
    enableMetrics,
    enableTracing,
    enableHealthChecks
  });

  return {
    logger,
    metrics,
    healthCheck,
    tracer
  };
}

/**
 * Create database query wrapper with observability
 */
export function createObservableDatabase(pool, name = 'database') {
  const dbLogger = createLogger(`db-${name}`);

  // Wrap query method
  const originalQuery = pool.query.bind(pool);

  pool.query = async function(sql, params) {
    return withTiming('db.query.time', async () => {
      const queryStart = Date.now();

      try {
        const result = await originalQuery(sql, params);
        const duration = Date.now() - queryStart;

        // Record metrics
        metrics.counter('db.queries.total', 1, { database: name });

        // Warn on slow queries
        if (duration > 100) {
          dbLogger.warn('Slow query detected', {
            duration,
            rowCount: result.rows?.length,
            command: result.command
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - queryStart;

        metrics.counter('db.errors.total', 1, {
          database: name,
          code: error.code
        });

        dbLogger.error('Query failed', error, {
          duration,
          code: error.code
        });

        throw error;
      }
    }, { database: name });
  };

  return pool;
}

/**
 * Create HTTP client wrapper with observability
 */
export function createObservableHttpClient(baseLogger) {
  const httpLogger = baseLogger || createLogger('http-client');

  return async function observableFetch(url, options = {}) {
    return withTiming('http.request.time', async () => {
      const requestStart = Date.now();
      const method = options.method || 'GET';

      // Inject trace context
      const traceContext = tracer.getCurrentContext();
      if (traceContext) {
        options.headers = injectTraceContext(options.headers || {}, traceContext);
      }

      httpLogger.debug('HTTP request started', {
        method,
        url: typeof url === 'string' ? url : url.toString()
      });

      try {
        const response = await fetch(url, options);
        const duration = Date.now() - requestStart;

        metrics.counter('http.requests.total', 1, {
          method,
          status: String(response.status)
        });

        if (!response.ok) {
          httpLogger.warn('HTTP request failed', {
            method,
            url: typeof url === 'string' ? url : url.toString(),
            status: response.status,
            duration
          });
        }

        return response;
      } catch (error) {
        const duration = Date.now() - requestStart;

        metrics.counter('http.errors.total', 1, { method });

        httpLogger.error('HTTP request error', error, {
          method,
          url: typeof url === 'string' ? url : url.toString(),
          duration
        });

        throw error;
      }
    }, { method, host: new URL(url).hostname });
  };
}

export { logger };
