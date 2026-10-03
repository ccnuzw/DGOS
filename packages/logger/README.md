# @dgos/logger

Comprehensive logging and observability package for DGOS V1.

## Features

- **Structured Logging**: JSON-formatted logs with context propagation
- **Performance Metrics**: Counter, gauge, histogram, and timing metrics
- **Error Tracking**: Structured error handling with aggregation
- **Distributed Tracing**: Trace ID propagation and span tracking
- **Health Checks**: Readiness and liveness probes
- **Alerting**: Rule-based alerting system

## Installation

```bash
pnpm install
```

## Usage

### Basic Logging

```javascript
import { createLogger } from '@dgos/logger';

const logger = createLogger('my-service');

logger.info('Service started', { port: 3000 });
logger.error('Operation failed', error, { operation: 'fetch-data' });
```

### With Async Context

```javascript
import { createLogger, runWithContext } from '@dgos/logger';

const logger = createLogger('api');

await runWithContext({ requestId: 'abc-123', userId: 'user-1' }, async () => {
  logger.info('Processing request'); // Automatically includes requestId and userId
});
```

### Metrics

```javascript
import { metrics, withTiming } from '@dgos/logger/metrics';

// Increment counter
metrics.counter('api.requests', 1, { endpoint: '/users', method: 'GET' });

// Set gauge
metrics.gauge('db.pool.size', 10);

// Record timing
const result = await withTiming('db.query', async () => {
  return await db.query('SELECT * FROM users');
}, { table: 'users' });

// Get metrics snapshot
const snapshot = metrics.snapshot();
console.log(snapshot.timings['db.query']);
// { count: 100, avg: 45, p50: 42, p95: 89, p99: 120 }
```

### Error Handling

```javascript
import { 
  ValidationError, 
  NotFoundError,
  createErrorHandler 
} from '@dgos/logger/errors';

// Throw structured errors
if (!user) {
  throw new NotFoundError('User', { userId });
}

if (!isValid(input)) {
  throw new ValidationError('Invalid input', { field: 'email' });
}

// Use error handler middleware (Fastify)
app.setErrorHandler(createErrorHandler(logger));
```

### Distributed Tracing

```javascript
import { tracer } from '@dgos/logger/tracing';

// Start a trace
await tracer.withTrace('request-123', async () => {
  // Create spans
  await tracer.withSpan('database-query', async () => {
    return await db.query('SELECT * FROM users');
  }, { table: 'users' });
});

// Manual span management
const span = tracer.startSpan('operation-name');
span.setTag('userId', '123');
span.log('Processing started');
// ... do work ...
span.end();
```

### Health Checks

```javascript
import { 
  healthCheck, 
  registerHealthRoutes,
  createDatabaseCheck,
  createRedisCheck 
} from '@dgos/logger/health';

// Register checks
const dbCheck = createDatabaseCheck(pgPool);
healthCheck.register(dbCheck.name, dbCheck.check);

const redisCheck = createRedisCheck(redisClient);
healthCheck.register(redisCheck.name, redisCheck.check);

// Add routes to Fastify
registerHealthRoutes(app, {
  healthPath: '/health',
  readyPath: '/ready',
  alivePath: '/alive',
  version: '1.0.0'
});
```

### Alerting

```javascript
import { alertManager, createLogAlertHandler } from '@dgos/logger/alerts';

// Register alert rules
alertManager.registerRule({
  name: 'high_error_rate',
  condition: 'error_rate > 0.05',
  duration: 5 * 60 * 1000, // 5 minutes
  severity: 'critical',
  message: 'Error rate exceeds 5%'
});

// Register alert handler
alertManager.onAlert(createLogAlertHandler(logger));

// Evaluate rules periodically
setInterval(() => {
  const metrics = getMetrics(); // Your metrics object
  alertManager.evaluate(metrics);
}, 60000); // Every minute
```

## Environment Variables

- `LOG_LEVEL`: Log level (debug, info, warn, error). Default: `debug` in dev, `info` in production
- `NODE_ENV`: Environment (development, production)

## Log Format

### Development
Pretty-printed with colors for easy reading.

### Production
JSON Lines format for log aggregation:

```json
{
  "level": "info",
  "timestamp": "2024-10-02T12:34:56.789Z",
  "component": "api-server",
  "message": "Request completed",
  "requestId": "abc-123",
  "method": "GET",
  "path": "/api/v1/tasks",
  "statusCode": 200,
  "duration": 45
}
```

## Sensitive Data Redaction

The following fields are automatically redacted from logs:
- password
- secret
- token
- apiKey
- credential
- authorization
- cookie
- sessionId

## Best Practices

1. **Always include context**: Use `requestId`, `userId`, `operation` for traceability
2. **Use appropriate log levels**:
   - `debug`: Detailed information for debugging
   - `info`: Normal operation events
   - `warn`: Warning conditions (e.g., deprecated API usage)
   - `error`: Error conditions requiring attention

3. **Structure your errors**: Use error classes instead of plain Error objects
4. **Tag your metrics**: Add relevant tags for filtering and aggregation
5. **Keep spans focused**: One span per logical operation
6. **Don't log sensitive data**: The library redacts common fields, but be careful

## Integration Examples

### Fastify Middleware

```javascript
import Fastify from 'fastify';
import { createLogger, runWithContext } from '@dgos/logger';
import { metrics } from '@dgos/logger/metrics';

const app = Fastify();
const logger = createLogger('api-server');

app.addHook('onRequest', async (request, reply) => {
  request.startTime = Date.now();
  request.requestId = request.headers['x-request-id'] || crypto.randomUUID();
  
  await runWithContext({ requestId: request.requestId }, async () => {
    logger.info('Request started', {
      method: request.method,
      path: request.url
    });
  });
});

app.addHook('onResponse', async (request, reply) => {
  const duration = Date.now() - request.startTime;
  
  metrics.timing('api.response.time', duration, {
    method: request.method,
    path: request.routerPath,
    status: reply.statusCode
  });
  
  metrics.counter('api.requests', 1, {
    method: request.method,
    status: reply.statusCode
  });
});
```

### Database Query Wrapper

```javascript
import { createLogger, withTiming } from '@dgos/logger';

const logger = createLogger('database');

export async function query(sql, params) {
  return withTiming('db.query', async () => {
    const result = await pool.query(sql, params);
    
    if (result.duration > 100) {
      logger.warn('Slow query detected', {
        duration: result.duration,
        rowCount: result.rows.length
      });
    }
    
    return result;
  }, { table: extractTable(sql) });
}
```

## License

Private - DGOS V1
