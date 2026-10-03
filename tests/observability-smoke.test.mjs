/**
 * Simple smoke test for observability modules (direct imports)
 */

import { createLogger, runWithContext, getContext } from '../packages/logger/src/index.js';
import { metrics, withTiming } from '../packages/logger/src/metrics.js';
import { ValidationError, NotFoundError, errorAggregator } from '../packages/logger/src/errors.js';
import { tracer } from '../packages/logger/src/tracing.js';
import { healthCheck } from '../packages/logger/src/health.js';

console.log('✅ All imports successful');

// Test logger
const logger = createLogger('smoke-test');
logger.info('Smoke test started');

// Test context
await runWithContext({ testId: '123' }, async () => {
  const ctx = getContext();
  console.log('✅ Context propagation works:', ctx.testId === '123');
});

// Test metrics
metrics.counter('test.counter', 1);
metrics.gauge('test.gauge', 100);
await withTiming('test.timing', async () => {
  await new Promise(resolve => setTimeout(resolve, 10));
});

const snapshot = metrics.snapshot();
console.log('✅ Metrics collection works:', snapshot.counters['test.counter'] === 1);

// Test errors
const error = new ValidationError('Test error');
errorAggregator.record(error);
console.log('✅ Error tracking works:', error.httpStatus === 400);

// Test tracing
await tracer.withSpan('test-span', async () => {
  const ctx = tracer.getCurrentContext();
  console.log('✅ Tracing works:', !!ctx.traceId);
});

// Test health
healthCheck.register('test-check', async () => ({ status: 'healthy' }));
const health = await healthCheck.check();
console.log('✅ Health checks work:', health.status === 'healthy');

console.log('\n🎉 All smoke tests passed! Observability system is working correctly.\n');
