# Quick Integration Guide: Adding Observability to server.mjs

This guide shows how to integrate the observability foundation into the existing `apps/api/src/server.mjs`.

## Step 1: Import Observability Components

Add at the top of `server.mjs`:

```javascript
import { createLogger, runWithContext } from '@dgos/logger';
import { metrics, withTiming } from '@dgos/logger/metrics';
import { healthCheck, createDatabaseCheck, createRedisCheck, createMemoryCheck } from '@dgos/logger/health';
import { tracer, extractTraceContext } from '@dgos/logger/tracing';
import { errorAggregator } from '@dgos/logger/errors';
```

## Step 2: Create Logger

Replace or supplement the existing logger setup:

```javascript
const logger = createLogger('api-server');

// Keep Fastify's logger for request logs if needed, or replace with:
const safeLogger = false; // We'll use our custom logger

const app = Fastify({ 
  logger: safeLogger,
  // ... rest of config
});
```

## Step 3: Add Request Observability Hook

Add after app creation, before routes:

```javascript
// Request observability
app.addHook('onRequest', async (request, reply) => {
  request.observability = {
    startTime: Date.now(),
    requestId: request.headers['x-request-id'] || randomUUID()
  };

  // Trace context
  const traceContext = extractTraceContext(request.headers) || tracer.startTrace();
  request.observability.traceContext = traceContext;

  // Set headers
  reply.header('x-request-id', request.observability.requestId);
  reply.header('x-trace-id', traceContext.traceId);

  // Log with context
  await runWithContext({
    requestId: request.observability.requestId,
    traceId: traceContext.traceId,
    component: 'api-server'
  }, async () => {
    logger.info('Request started', {
      method: request.method,
      path: request.url,
      ip: request.ip
    });
  });
});
```

## Step 4: Add Response Metrics Hook

```javascript
// Response metrics and logging
app.addHook('onResponse', async (request, reply) => {
  const duration = Date.now() - request.observability.startTime;
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

  // Log completion
  await runWithContext({
    requestId: request.observability.requestId
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
      logger.warn('Request error', logData);
    } else {
      logger.info('Request completed', logData);
    }

    if (duration > 1000) {
      logger.warn('Slow request', { ...logData, threshold: 1000 });
    }
  });
});
```

## Step 5: Enhance Error Handler

Replace or enhance existing error handler:

```javascript
app.setErrorHandler((error, request, reply) => {
  const statusCode = error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
  const requestId = request.observability?.requestId || request.requestId;

  // Record error
  errorAggregator.record(error, {
    operation: `${request.method} ${request.url}`,
    requestId
  });

  // Log error
  runWithContext({ requestId }, () => {
    if (statusCode >= 500) {
      logger.error('Request error', error, {
        method: request.method,
        path: request.url,
        statusCode,
        errorCode: error.code,
        errorType: error.name,
        databaseCode: /^[0-9A-Z]{5}$/.test(error.code ?? '') ? error.code : undefined
      });
    } else if (statusCode >= 400) {
      logger.warn('Client error', {
        method: request.method,
        path: request.url,
        statusCode,
        errorCode: error.code,
        message: error.message
      });
    }
  });

  // Keep existing error response logic
  const messages = { /* ... existing messages ... */ };
  reply.code(statusCode).send({
    errorKey: error.message in messages ? error.message : 'internal_error',
    message: messages[error.message] ?? 'Request failed',
    requestId,
    retryable: statusCode >= 500,
    ...(error.retryAfter ? { details: { retryAfter: error.retryAfter } } : {})
  });
});
```

## Step 6: Register Health Checks

Add health checks for all pools and Redis:

```javascript
// Register health checks
for (const pool of pools) {
  const check = createDatabaseCheck(pool, `database-${pools.indexOf(pool)}`);
  healthCheck.register(check.name, check.check);
}

if (redis) {
  const check = createRedisCheck(redis);
  healthCheck.register(check.name, check.check);
}

const memCheck = createMemoryCheck(1024); // 1GB threshold
healthCheck.register(memCheck.name, memCheck.check);

logger.info('Health checks registered', {
  checks: ['database', redis ? 'redis' : null, 'memory'].filter(Boolean)
});
```

## Step 7: Add Observability Endpoints

Add before existing routes:

```javascript
// Enhanced health check
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
      return { status: 'ready', timestamp: new Date().toISOString() };
    } else {
      return reply.code(503).send({ status: 'not_ready' });
    }
  } catch (error) {
    return reply.code(503).send({ status: 'not_ready', error: error.message });
  }
});

// Liveness probe  
app.get('/api/v1/alive', async () => {
  return { status: 'alive', uptime: process.uptime(), timestamp: new Date().toISOString() };
});

// Prometheus metrics
app.get('/api/v1/metrics', async (request, reply) => {
  reply.header('content-type', 'text/plain; charset=utf-8');
  return metrics.toPrometheus();
});

// Metrics snapshot (JSON)
app.get('/api/v1/metrics/snapshot', async () => {
  return {
    ...metrics.snapshot(),
    errors: errorAggregator.stats(),
    errorRate: errorAggregator.errorRate(60000)
  };
});

// Debug traces (development only)
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/v1/debug/traces', async (request) => {
    const traceId = request.query.traceId;
    if (traceId) {
      return { traces: tracer.getTrace(traceId) };
    }
    return { traces: tracer.getRecentSpans(50) };
  });
}
```

## Step 8: Wrap Database Queries (Optional but Recommended)

Add database query observability:

```javascript
// After creating pool
pools.forEach(pool => {
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
        metrics.counter('db.errors.total', 1, { code: error.code });
        logger.error('Database query failed', error, { code: error.code });
        throw error;
      }
    });
  };
});
```

## Step 9: Add Startup Logging

Add after server initialization:

```javascript
logger.info('API server initialized', {
  environment: process.env.NODE_ENV,
  databaseUrl: process.env.DGOS_DATABASE_URL ? 'configured' : 'not_configured',
  redisUrl: process.env.REDIS_URL ? 'configured' : 'not_configured',
  healthChecks: Array.from(healthCheck._checks?.keys() || [])
});
```

## Step 10: Add Shutdown Logging

Add to shutdown handler:

```javascript
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    logger.info('Shutdown signal received', { signal });
    app.close().catch(() => { process.exitCode = 1; });
  });
}

app.addHook('onClose', async () => {
  logger.info('Server shutting down');
  // ... existing cleanup
});
```

## Verification

After integration, verify:

1. **Server starts**: `pnpm dev`
2. **Health check works**: `curl http://localhost:3000/api/v1/health`
3. **Metrics available**: `curl http://localhost:3000/api/v1/metrics`
4. **Logs appear**: Check console for structured JSON logs
5. **Request tracking**: Each request has a unique requestId in logs

## Environment Variables

Set these for optimal production configuration:

```bash
# Logging
LOG_LEVEL=info              # Use 'debug' in development
NODE_ENV=production         # Enables JSON logging

# Application
DGOS_DATABASE_URL=...
REDIS_URL=...
```

## Testing

Test the observability:

```bash
# Make a request
curl http://localhost:3000/api/v1/tasks

# Check logs
pnpm logs:query --since=1m

# Check metrics
curl http://localhost:3000/api/v1/metrics/snapshot | jq

# Check health
curl http://localhost:3000/api/v1/health | jq
```

## Minimal Integration (Quick Start)

If you want a minimal integration first:

```javascript
import { createLogger } from '@dgos/logger';
import { healthCheck, createDatabaseCheck } from '@dgos/logger/health';

const logger = createLogger('api-server');

// Add health check
const dbCheck = createDatabaseCheck(pool);
healthCheck.register(dbCheck.name, dbCheck.check);

// Add health endpoint
app.get('/api/v1/health', async (req, reply) => {
  const health = await healthCheck.check();
  return reply.code(health.status === 'unhealthy' ? 503 : 200).send(health);
});

// Use logger
logger.info('Server started', { port: 3000 });
```

Then gradually add metrics, tracing, and error tracking as needed.

## Next Steps After Integration

1. Set up log rotation (logrotate)
2. Configure Prometheus scraping
3. Create Grafana dashboards
4. Set up alerting rules
5. Configure log aggregation (ELK, Loki, etc.)
6. Add custom business metrics
7. Create runbooks for common alerts

## Support

- See: `.herdr/OBSERVABILITY-GUIDE.md` for complete guide
- See: `.herdr/LOGGING-BEST-PRACTICES.md` for best practices
- See: `packages/logger/README.md` for API reference
- See: `apps/api/src/observability-example.mjs` for complete example
