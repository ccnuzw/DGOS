# DGOS V1 Logging Best Practices

## General Principles

### 1. Use Appropriate Log Levels

**DEBUG**: Detailed information for diagnosing problems
```javascript
logger.debug('Cache lookup', { key, found: !!value });
logger.debug('Token validation started', { tokenPrefix: token.slice(0, 8) });
```

**INFO**: Significant events in normal operation
```javascript
logger.info('Service started', { port, environment });
logger.info('User authenticated', { userId, method: 'password' });
logger.info('Task completed', { taskId, duration });
```

**WARN**: Unexpected but handled conditions
```javascript
logger.warn('Rate limit approaching', { userId, current: 95, limit: 100 });
logger.warn('Deprecated API called', { endpoint, caller });
logger.warn('Slow operation', { operation, duration, threshold });
```

**ERROR**: Error conditions requiring attention
```javascript
logger.error('Database connection failed', error, { retries, maxRetries });
logger.error('Payment processing failed', error, { orderId, amount });
logger.error('Authentication failed', error, { userId, reason: 'invalid_token' });
```

### 2. Include Context

Always include relevant context for traceability:

```javascript
// ✅ Good - Rich context
logger.info('Order processed', {
  requestId,
  orderId,
  userId,
  amount,
  currency,
  paymentMethod,
  duration
});

// ❌ Bad - No context
logger.info('Order processed');
```

### 3. Use Structured Fields

Use structured data instead of string concatenation:

```javascript
// ✅ Good - Structured
logger.info('User login', {
  userId: user.id,
  email: user.email,
  loginMethod: 'oauth',
  provider: 'google'
});

// ❌ Bad - String concatenation
logger.info(`User ${user.email} logged in via Google OAuth`);
```

### 4. Never Log Sensitive Data

```javascript
// ✅ Good - Redacted
logger.info('Password reset requested', {
  userId,
  email: user.email.replace(/(.{3}).*(@.*)/, '$1***$2')
});

// ❌ Bad - Sensitive data
logger.info('Password reset', { userId, password: newPassword });
```

Automatically redacted fields:
- password, secret, token
- apiKey, api_key, credential
- authorization, cookie
- sessionId (in some contexts)

### 5. Log at Boundaries

Log at system boundaries (entry/exit points):

```javascript
// API endpoint entry
logger.info('Request started', { method, path, requestId });

// External service call
logger.info('Calling payment provider', { provider, amount });

// Database query
logger.debug('Executing query', { table, operation });

// Response
logger.info('Request completed', { statusCode, duration });
```

## Specific Patterns

### Request Lifecycle

```javascript
// Start of request
app.addHook('onRequest', async (request, reply) => {
  request.startTime = Date.now();
  
  logger.info('Request started', {
    requestId: request.id,
    method: request.method,
    path: request.url,
    ip: request.ip
  });
});

// End of request
app.addHook('onResponse', async (request, reply) => {
  const duration = Date.now() - request.startTime;
  
  logger.info('Request completed', {
    requestId: request.id,
    statusCode: reply.statusCode,
    duration
  });
});
```

### Error Handling

```javascript
try {
  await processPayment(orderId);
} catch (error) {
  logger.error('Payment processing failed', error, {
    requestId,
    orderId,
    userId,
    retryCount,
    errorCode: error.code
  });
  
  // Re-throw or handle
  throw new PaymentError('Payment failed', { cause: error });
}
```

### Database Operations

```javascript
// Query with timing
const timer = startTimer('db.query');
try {
  const results = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  const duration = timer.stop();
  
  if (duration > 100) {
    logger.warn('Slow query detected', {
      query: 'users.findById',
      duration,
      rowCount: results.length
    });
  }
  
  return results;
} catch (error) {
  logger.error('Database query failed', error, {
    query: 'users.findById',
    userId,
    code: error.code
  });
  throw error;
}
```

### External API Calls

```javascript
async function callExternalAPI(endpoint, options) {
  logger.info('External API call started', {
    service: 'payment-gateway',
    endpoint,
    method: options.method
  });
  
  try {
    const response = await fetch(endpoint, options);
    
    logger.info('External API call completed', {
      service: 'payment-gateway',
      endpoint,
      statusCode: response.status,
      duration: response.duration
    });
    
    return response;
  } catch (error) {
    logger.error('External API call failed', error, {
      service: 'payment-gateway',
      endpoint,
      errorType: error.name
    });
    throw error;
  }
}
```

### Background Tasks

```javascript
async function processTaskQueue() {
  logger.info('Task processor started', { workerId, pollInterval });
  
  while (running) {
    try {
      const task = await fetchNextTask();
      
      if (task) {
        logger.info('Processing task', {
          taskId: task.id,
          taskType: task.type,
          attempt: task.attempts
        });
        
        await processTask(task);
        
        logger.info('Task completed', {
          taskId: task.id,
          duration: task.duration
        });
      }
    } catch (error) {
      logger.error('Task processing failed', error, {
        taskId: task?.id,
        taskType: task?.type
      });
    }
  }
  
  logger.info('Task processor stopped', { workerId });
}
```

### Authentication Events

```javascript
// Successful login
logger.info('User authenticated', {
  userId: user.id,
  method: 'password',
  ip: request.ip,
  userAgent: request.headers['user-agent']
});

// Failed login
logger.warn('Authentication failed', {
  email: email,
  reason: 'invalid_password',
  ip: request.ip,
  attempts: loginAttempts
});

// Account locked
logger.warn('Account locked', {
  userId: user.id,
  reason: 'too_many_attempts',
  lockDuration: '30m'
});
```

### Business Events

```javascript
// Order events
logger.info('Order created', {
  orderId,
  userId,
  total: order.total,
  itemCount: order.items.length
});

logger.info('Order fulfilled', {
  orderId,
  fulfillmentTime: duration,
  carrier: 'UPS'
});

// Subscription events
logger.info('Subscription started', {
  subscriptionId,
  userId,
  plan: 'premium',
  billingCycle: 'monthly'
});

logger.info('Subscription cancelled', {
  subscriptionId,
  userId,
  reason: 'user_requested',
  refundAmount: 0
});
```

## Anti-Patterns

### ❌ Don't: Log Inside Loops

```javascript
// Bad
for (const user of users) {
  logger.debug('Processing user', { userId: user.id });
  await processUser(user);
}

// Good
logger.debug('Processing users batch', { count: users.length });
for (const user of users) {
  await processUser(user);
}
logger.debug('Batch processing complete', { count: users.length });
```

### ❌ Don't: Log Full Objects

```javascript
// Bad
logger.info('User updated', { user });  // May contain sensitive data

// Good
logger.info('User updated', {
  userId: user.id,
  updatedFields: Object.keys(changes)
});
```

### ❌ Don't: Use Logs for Debugging Only

```javascript
// Bad - Only useful in development
logger.debug('x = ' + x);
logger.debug('About to call function');

// Good - Useful in production
logger.debug('Cache miss', { key, ttl });
logger.debug('Fallback provider selected', { provider, reason });
```

### ❌ Don't: Log Without Context

```javascript
// Bad
logger.error('Failed', error);

// Good
logger.error('Payment processing failed', error, {
  requestId,
  orderId,
  userId,
  paymentProvider: 'stripe'
});
```

### ❌ Don't: Log and Throw

```javascript
// Bad - Logs will be duplicated
try {
  throw new Error('Something failed');
} catch (error) {
  logger.error('Error occurred', error);
  throw error;  // Error will be logged again by error handler
}

// Good - Log at one level only
try {
  throw new Error('Something failed');
} catch (error) {
  // Let error handler log it
  throw new PaymentError('Payment failed', { cause: error });
}
```

## Performance Considerations

### 1. Use Appropriate Log Levels

```javascript
// Production: LOG_LEVEL=info (debug logs disabled)
// Development: LOG_LEVEL=debug
logger.debug('Expensive debug info', expensiveOperation());
```

### 2. Lazy Evaluation

```javascript
// Bad - Always computes
logger.debug('State', { state: computeExpensiveState() });

// Good - Only computes if debug enabled
if (logger.level === 'debug') {
  logger.debug('State', { state: computeExpensiveState() });
}
```

### 3. Avoid Large Objects

```javascript
// Bad
logger.info('Processing', { largeArray: items });  // May be MB of data

// Good
logger.info('Processing', { itemCount: items.length });
```

## Testing Logs

### Verify Logs in Tests

```javascript
import { createLogger } from '@dgos/logger';

test('should log user creation', async () => {
  const logs = [];
  const logger = createLogger('test', {
    // Capture logs for testing
    write: (log) => logs.push(JSON.parse(log))
  });
  
  await createUser({ email: 'test@example.com' });
  
  expect(logs).toContainEqual(
    expect.objectContaining({
      level: 'info',
      message: 'User created',
      email: 'test@example.com'
    })
  );
});
```

## Log Aggregation

### Preparing for Centralized Logging

Structure logs for easy parsing:

```javascript
// Good structure for log aggregation
logger.info('API request', {
  requestId: 'uuid',
  userId: 'user-id',
  endpoint: '/api/v1/tasks',
  method: 'POST',
  statusCode: 201,
  duration: 45,
  timestamp: '2024-10-02T...'
});
```

This structure enables queries like:
- All requests by user
- All slow requests (duration > threshold)
- All errors by endpoint
- Request rate over time

## Checklist

Before committing code with logging:

- [ ] Used appropriate log level (debug/info/warn/error)
- [ ] Included relevant context (requestId, userId, etc.)
- [ ] Used structured fields, not string concatenation
- [ ] No sensitive data (passwords, tokens, secrets)
- [ ] Logs at system boundaries (entry/exit)
- [ ] Error logs include error object and context
- [ ] Avoided logging in tight loops
- [ ] Performance impact considered
- [ ] Logs are useful for troubleshooting
- [ ] Logs support operational monitoring

## Quick Reference

```javascript
import { createLogger, runWithContext } from '@dgos/logger';

const logger = createLogger('my-service');

// Set context for async operations
await runWithContext({ requestId, userId }, async () => {
  logger.info('Operation started');  // Includes requestId, userId
  
  try {
    const result = await doSomething();
    logger.info('Operation completed', { result });
  } catch (error) {
    logger.error('Operation failed', error, {
      attemptNumber: 1,
      willRetry: true
    });
  }
});
```
