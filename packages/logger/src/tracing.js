/**
 * Distributed tracing support (preparation for OpenTelemetry)
 */

import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

const traceStorage = new AsyncLocalStorage();

/**
 * @typedef {Object} TraceContext
 * @property {string} traceId
 * @property {string} spanId
 * @property {string} [parentSpanId]
 */

/**
 * @typedef {Object} Span
 * @property {string} name
 * @property {string} traceId
 * @property {string} spanId
 * @property {string} [parentSpanId]
 * @property {number} startTime
 * @property {number} [endTime]
 * @property {Record<string, any>} tags
 * @property {Array<{timestamp: number, message: string, level?: string}>} logs
 * @property {string} [status]
 */

class SimpleSpan {
  constructor(name, traceContext, tags = {}) {
    this.name = name;
    this.traceId = traceContext.traceId;
    this.spanId = traceContext.spanId;
    this.parentSpanId = traceContext.parentSpanId;
    this.startTime = Date.now();
    this.endTime = null;
    this.tags = { ...tags };
    this.logs = [];
    this.status = 'ok';
  }

  /**
   * Set a tag on the span
   */
  setTag(key, value) {
    this.tags[key] = value;
    return this;
  }

  /**
   * Log an event
   */
  log(message, level = 'info') {
    this.logs.push({
      timestamp: Date.now(),
      message,
      level
    });
    return this;
  }

  /**
   * Mark span as error
   */
  setError(error) {
    this.status = 'error';
    this.tags.error = true;
    this.tags.errorMessage = error.message;
    this.tags.errorType = error.name;
    return this;
  }

  /**
   * End the span
   */
  end() {
    this.endTime = Date.now();
    return this;
  }

  /**
   * Get span duration
   */
  duration() {
    if (!this.endTime) return null;
    return this.endTime - this.startTime;
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      name: this.name,
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration(),
      tags: this.tags,
      logs: this.logs,
      status: this.status
    };
  }
}

/**
 * Tracer for managing spans
 */
class Tracer {
  constructor() {
    this.spans = [];
    this.maxSpans = 1000;
  }

  /**
   * Get current trace context
   */
  getCurrentContext() {
    return traceStorage.getStore() || null;
  }

  /**
   * Start a new trace
   */
  startTrace(traceId = null) {
    return {
      traceId: traceId || randomUUID(),
      spanId: randomUUID(),
      parentSpanId: null
    };
  }

  /**
   * Start a new span
   */
  startSpan(name, tags = {}) {
    const currentContext = this.getCurrentContext();

    const traceContext = currentContext
      ? {
          traceId: currentContext.traceId,
          spanId: randomUUID(),
          parentSpanId: currentContext.spanId
        }
      : this.startTrace();

    const span = new SimpleSpan(name, traceContext, tags);

    // Store span
    this.spans.push(span);
    if (this.spans.length > this.maxSpans) {
      this.spans.shift();
    }

    return span;
  }

  /**
   * Run function with trace context
   */
  async withTrace(traceId, fn) {
    const context = this.startTrace(traceId);
    return traceStorage.run(context, fn);
  }

  /**
   * Run function with a new span
   */
  async withSpan(name, fn, tags = {}) {
    const span = this.startSpan(name, tags);
    const currentContext = this.getCurrentContext();

    const spanContext = {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId
    };

    try {
      const result = await traceStorage.run(spanContext, fn);
      span.end();
      return result;
    } catch (error) {
      span.setError(error);
      span.end();
      throw error;
    }
  }

  /**
   * Get all spans for a trace
   */
  getTrace(traceId) {
    return this.spans.filter(s => s.traceId === traceId);
  }

  /**
   * Get recent spans
   */
  getRecentSpans(limit = 100) {
    return this.spans.slice(-limit);
  }

  /**
   * Clear stored spans
   */
  clear() {
    this.spans = [];
  }
}

// Global tracer instance
const globalTracer = new Tracer();

export const tracer = {
  startTrace: (traceId) => globalTracer.startTrace(traceId),
  startSpan: (name, tags) => globalTracer.startSpan(name, tags),
  withTrace: (traceId, fn) => globalTracer.withTrace(traceId, fn),
  withSpan: (name, fn, tags) => globalTracer.withSpan(name, fn, tags),
  getCurrentContext: () => globalTracer.getCurrentContext(),
  getTrace: (traceId) => globalTracer.getTrace(traceId),
  getRecentSpans: (limit) => globalTracer.getRecentSpans(limit),
  clear: () => globalTracer.clear()
};

/**
 * Extract trace context from HTTP headers
 */
export function extractTraceContext(headers) {
  const traceId = headers['x-trace-id'];
  const spanId = headers['x-span-id'];
  const parentSpanId = headers['x-parent-span-id'];

  if (traceId && spanId) {
    return { traceId, spanId, parentSpanId };
  }

  // Try W3C Trace Context format
  const traceparent = headers['traceparent'];
  if (traceparent) {
    const match = traceparent.match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/);
    if (match) {
      return {
        traceId: match[1],
        spanId: randomUUID(),
        parentSpanId: match[2]
      };
    }
  }

  return null;
}

/**
 * Inject trace context into HTTP headers
 */
export function injectTraceContext(headers, traceContext) {
  if (!traceContext) return headers;

  return {
    ...headers,
    'x-trace-id': traceContext.traceId,
    'x-span-id': traceContext.spanId,
    ...(traceContext.parentSpanId && {
      'x-parent-span-id': traceContext.parentSpanId
    })
  };
}

/**
 * Create middleware for trace propagation
 */
export function createTracingMiddleware(logger) {
  return async function tracingMiddleware(req, reply) {
    const extractedContext = extractTraceContext(req.headers);
    const traceContext = extractedContext || globalTracer.startTrace();

    // Set response headers
    reply.header('x-trace-id', traceContext.traceId);

    // Store in async context
    await traceStorage.run(traceContext, async () => {
      const span = globalTracer.startSpan(`HTTP ${req.method} ${req.url}`, {
        'http.method': req.method,
        'http.url': req.url,
        'http.route': req.routerPath
      });

      try {
        await req.server.routing(req, reply);
        span.setTag('http.status_code', reply.statusCode);
        span.end();
      } catch (error) {
        span.setError(error);
        span.setTag('http.status_code', reply.statusCode || 500);
        span.end();
        throw error;
      }
    });
  };
}
