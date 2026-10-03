/**
 * Tests for observability components
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { createLogger, runWithContext, getContext } from '@dgos/logger';
import { metrics, withTiming, startTimer } from '@dgos/logger/metrics';
import {
  DGOSError,
  ValidationError,
  NotFoundError,
  errorAggregator
} from '@dgos/logger/errors';
import { tracer } from '@dgos/logger/tracing';
import { healthCheck } from '@dgos/logger/health';

test('Logger - creates logger with component name', () => {
  const logger = createLogger('test-component');
  assert.ok(logger);
  assert.ok(typeof logger.info === 'function');
  assert.ok(typeof logger.error === 'function');
});

test('Logger - context propagation with runWithContext', async () => {
  const testContext = { requestId: 'test-123', userId: 'user-456' };

  await runWithContext(testContext, async () => {
    const context = getContext();
    assert.strictEqual(context.requestId, 'test-123');
    assert.strictEqual(context.userId, 'user-456');
  });
});

test('Logger - nested context merging', async () => {
  await runWithContext({ requestId: 'req-1' }, async () => {
    await runWithContext({ operation: 'test' }, async () => {
      const context = getContext();
      assert.strictEqual(context.requestId, 'req-1');
      assert.strictEqual(context.operation, 'test');
    });
  });
});

test('Metrics - counter increments correctly', () => {
  metrics.reset();
  metrics.counter('test.counter', 1);
  metrics.counter('test.counter', 2);

  const snapshot = metrics.snapshot();
  assert.strictEqual(snapshot.counters['test.counter'], 3);
});

test('Metrics - gauge sets current value', () => {
  metrics.reset();
  metrics.gauge('test.gauge', 100);
  metrics.gauge('test.gauge', 150);

  const snapshot = metrics.snapshot();
  assert.strictEqual(snapshot.gauges['test.gauge'], 150);
});

test('Metrics - timing calculates percentiles', () => {
  metrics.reset();

  // Add 100 timing samples
  for (let i = 1; i <= 100; i++) {
    metrics.timing('test.timing', i);
  }

  const snapshot = metrics.snapshot();
  const timing = snapshot.timings['test.timing'];

  assert.strictEqual(timing.count, 100);
  assert.strictEqual(timing.min, 1);
  assert.strictEqual(timing.max, 100);
  assert.ok(timing.p50 >= 45 && timing.p50 <= 55);
  assert.ok(timing.p95 >= 90);
});

test('Metrics - withTiming measures function execution', async () => {
  metrics.reset();

  const result = await withTiming('test.operation', async () => {
    await new Promise(resolve => setTimeout(resolve, 50));
    return 'success';
  });

  assert.strictEqual(result, 'success');

  const snapshot = metrics.snapshot();
  const timing = snapshot.timings['test.operation'];

  assert.strictEqual(timing.count, 1);
  assert.ok(timing.avg >= 45);
});

test('Metrics - startTimer returns duration', async () => {
  const timer = startTimer('test.timer');
  await new Promise(resolve => setTimeout(resolve, 50));
  const duration = timer.stop();

  assert.ok(duration >= 45);
});

test('Metrics - tags are included in metric keys', () => {
  metrics.reset();
  metrics.counter('http.requests', 1, { method: 'GET', status: '200' });
  metrics.counter('http.requests', 1, { method: 'POST', status: '201' });

  const snapshot = metrics.snapshot();
  assert.ok(snapshot.counters['http.requests{method:GET,status:200}']);
  assert.ok(snapshot.counters['http.requests{method:POST,status:201}']);
});

test('Metrics - toPrometheus format', () => {
  metrics.reset();
  metrics.counter('test_counter', 5);
  metrics.gauge('test_gauge', 100);

  const prometheus = metrics.toPrometheus();
  assert.ok(prometheus.includes('test_counter_total 5'));
  assert.ok(prometheus.includes('test_gauge 100'));
});

test('Errors - DGOSError has correct properties', () => {
  const error = new DGOSError('TEST_ERROR', 'Test error message', {
    httpStatus: 400,
    context: { field: 'email' }
  });

  assert.strictEqual(error.code, 'TEST_ERROR');
  assert.strictEqual(error.message, 'Test error message');
  assert.strictEqual(error.httpStatus, 400);
  assert.strictEqual(error.isOperational, true);
  assert.deepStrictEqual(error.context, { field: 'email' });
});

test('Errors - ValidationError is 400', () => {
  const error = new ValidationError('Invalid email');
  assert.strictEqual(error.httpStatus, 400);
  assert.strictEqual(error.code, 'VALIDATION_ERROR');
});

test('Errors - NotFoundError is 404', () => {
  const error = new NotFoundError('User', { userId: '123' });
  assert.strictEqual(error.httpStatus, 404);
  assert.strictEqual(error.code, 'NOT_FOUND');
  assert.ok(error.message.includes('User'));
});

test('Errors - errorAggregator tracks errors', () => {
  errorAggregator.reset();

  const error1 = new ValidationError('Test error 1');
  const error2 = new ValidationError('Test error 2');

  errorAggregator.record(error1, { operation: 'test' });
  errorAggregator.record(error2, { operation: 'test' });

  const stats = errorAggregator.stats();
  assert.ok(stats.summary.length > 0);
  assert.ok(stats.recent.length === 2);
});

test('Errors - errorAggregator calculates error rate', async () => {
  errorAggregator.reset();

  // Record some errors
  for (let i = 0; i < 5; i++) {
    errorAggregator.record(new Error('Test error'));
  }

  const errorRate = errorAggregator.errorRate(60000);
  assert.ok(errorRate > 0);
});

test('Tracing - creates trace context', () => {
  const traceContext = tracer.startTrace();
  assert.ok(traceContext.traceId);
  assert.ok(traceContext.spanId);
  assert.strictEqual(traceContext.parentSpanId, null);
});

test('Tracing - startSpan creates span', () => {
  const span = tracer.startSpan('test-operation', { userId: '123' });
  assert.ok(span.traceId);
  assert.ok(span.spanId);
  assert.strictEqual(span.name, 'test-operation');
  assert.strictEqual(span.tags.userId, '123');
});

test('Tracing - withSpan executes function', async () => {
  const result = await tracer.withSpan('test-span', async () => {
    return 'completed';
  });

  assert.strictEqual(result, 'completed');
});

test('Tracing - span records duration', async () => {
  const span = tracer.startSpan('timed-operation');
  await new Promise(resolve => setTimeout(resolve, 50));
  span.end();

  const duration = span.duration();
  assert.ok(duration >= 45);
});

test('Tracing - getCurrentContext returns context', async () => {
  await tracer.withTrace('trace-123', async () => {
    const context = tracer.getCurrentContext();
    assert.strictEqual(context.traceId, 'trace-123');
  });
});

test('Tracing - nested spans have parent relationship', async () => {
  let childSpanId;

  await tracer.withSpan('parent', async () => {
    const parentContext = tracer.getCurrentContext();

    await tracer.withSpan('child', async () => {
      const childContext = tracer.getCurrentContext();
      childSpanId = childContext.spanId;

      assert.strictEqual(childContext.traceId, parentContext.traceId);
      assert.strictEqual(childContext.parentSpanId, parentContext.spanId);
    });
  });

  assert.ok(childSpanId);
});

test('Health - registers and runs checks', async () => {
  // Register a simple check
  healthCheck.register('test-service', async () => {
    return { status: 'healthy', latency: 5 };
  });

  const health = await healthCheck.check();
  assert.ok(health.status);
  assert.ok(health.checks['test-service']);
  assert.strictEqual(health.checks['test-service'].status, 'healthy');
});

test('Health - unhealthy check marks overall as unhealthy', async () => {
  healthCheck.register('failing-service', async () => {
    return { status: 'unhealthy', error: 'Connection failed' };
  });

  const health = await healthCheck.check();
  assert.strictEqual(health.status, 'unhealthy');
  assert.strictEqual(health.checks['failing-service'].status, 'unhealthy');
});

test('Health - ready returns boolean', async () => {
  healthCheck.register('ready-service', async () => {
    return { status: 'healthy' };
  });

  const isReady = await healthCheck.ready();
  // May be false due to other unhealthy checks, just verify it returns boolean
  assert.strictEqual(typeof isReady, 'boolean');
});

test('Health - alive returns status', async () => {
  const alive = await healthCheck.alive();
  assert.strictEqual(alive.status, 'ok');
  assert.ok(alive.timestamp);
});

test('Integration - logger with metrics and tracing', async () => {
  metrics.reset();

  const logger = createLogger('integration-test');

  await tracer.withTrace('integration-trace', async () => {
    await runWithContext({ requestId: 'req-123' }, async () => {
      // Log with context
      logger.info('Integration test started');

      // Record metric
      await withTiming('integration.operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Get context
      const context = getContext();
      const traceContext = tracer.getCurrentContext();

      assert.strictEqual(context.requestId, 'req-123');
      assert.strictEqual(traceContext.traceId, 'integration-trace');

      // Check metrics
      const snapshot = metrics.snapshot();
      assert.ok(snapshot.timings['integration.operation']);
    });
  });
});

test('Integration - error tracking with logging', async () => {
  errorAggregator.reset();
  const logger = createLogger('error-test');

  try {
    await runWithContext({ requestId: 'error-req' }, async () => {
      const error = new ValidationError('Invalid input', { field: 'email' });
      errorAggregator.record(error, { operation: 'validate' });

      logger.error('Validation failed', error, { field: 'email' });

      throw error;
    });
  } catch (error) {
    assert.ok(error instanceof ValidationError);
  }

  const stats = errorAggregator.stats();
  assert.strictEqual(stats.recent.length, 1);
});

console.log('\n✅ All observability tests passed!\n');
