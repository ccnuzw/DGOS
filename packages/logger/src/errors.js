/**
 * Structured error handling and classification
 */

/**
 * Base error class for DGOS operations
 */
export class DGOSError extends Error {
  /**
   * @param {string} code - Error code
   * @param {string} message - Human-readable message
   * @param {Object} options - Additional options
   * @param {number} [options.httpStatus=500] - HTTP status code
   * @param {boolean} [options.isOperational=true] - Whether this is an expected error
   * @param {Object} [options.context={}] - Additional context
   * @param {Error} [options.cause] - Original error
   */
  constructor(code, message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = options.httpStatus || 500;
    this.isOperational = options.isOperational !== false;
    this.context = options.context || {};
    this.cause = options.cause;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
      isOperational: this.isOperational,
      context: this.context
    };
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends DGOSError {
  constructor(message, context = {}) {
    super('VALIDATION_ERROR', message, {
      httpStatus: 400,
      isOperational: true,
      context
    });
  }
}

/**
 * Authentication error (401)
 */
export class UnauthorizedError extends DGOSError {
  constructor(message = 'Authentication required', context = {}) {
    super('UNAUTHORIZED', message, {
      httpStatus: 401,
      isOperational: true,
      context
    });
  }
}

/**
 * Authorization error (403)
 */
export class ForbiddenError extends DGOSError {
  constructor(message = 'Access denied', context = {}) {
    super('FORBIDDEN', message, {
      httpStatus: 403,
      isOperational: true,
      context
    });
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends DGOSError {
  constructor(resource, context = {}) {
    super('NOT_FOUND', `${resource} not found`, {
      httpStatus: 404,
      isOperational: true,
      context: { resource, ...context }
    });
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends DGOSError {
  constructor(message, context = {}) {
    super('CONFLICT', message, {
      httpStatus: 409,
      isOperational: true,
      context
    });
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends DGOSError {
  constructor(retryAfter, context = {}) {
    super('RATE_LIMITED', 'Too many requests', {
      httpStatus: 429,
      isOperational: true,
      context: { retryAfter, ...context }
    });
    this.retryAfter = retryAfter;
  }
}

/**
 * Internal server error (500)
 */
export class InternalError extends DGOSError {
  constructor(message = 'Internal server error', cause, context = {}) {
    super('INTERNAL_ERROR', message, {
      httpStatus: 500,
      isOperational: false,
      context,
      cause
    });
  }
}

/**
 * Service unavailable error (503)
 */
export class ServiceUnavailableError extends DGOSError {
  constructor(service, context = {}) {
    super('SERVICE_UNAVAILABLE', `${service} is unavailable`, {
      httpStatus: 503,
      isOperational: true,
      context: { service, ...context }
    });
  }
}

/**
 * Gateway timeout error (504)
 */
export class GatewayTimeoutError extends DGOSError {
  constructor(upstream, context = {}) {
    super('GATEWAY_TIMEOUT', `Timeout calling ${upstream}`, {
      httpStatus: 504,
      isOperational: true,
      context: { upstream, ...context }
    });
  }
}

/**
 * Error aggregator for tracking error patterns
 */
class ErrorAggregator {
  constructor() {
    this.errors = new Map();
    this.recentErrors = [];
    this.maxRecent = 100;
  }

  /**
   * Record an error occurrence
   */
  record(error, context = {}) {
    const code = error.code || error.name || 'UNKNOWN_ERROR';
    const key = `${code}:${context.operation || 'unknown'}`;

    if (!this.errors.has(key)) {
      this.errors.set(key, {
        code,
        operation: context.operation,
        count: 0,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        samples: []
      });
    }

    const entry = this.errors.get(key);
    entry.count++;
    entry.lastSeen = Date.now();

    // Keep last 5 samples
    if (entry.samples.length < 5) {
      entry.samples.push({
        message: error.message,
        timestamp: Date.now(),
        context
      });
    }

    // Track recent errors
    this.recentErrors.push({
      code,
      message: error.message,
      timestamp: Date.now(),
      operation: context.operation
    });

    if (this.recentErrors.length > this.maxRecent) {
      this.recentErrors.shift();
    }
  }

  /**
   * Get error statistics
   */
  stats() {
    const errorsByCode = new Map();

    for (const [, entry] of this.errors) {
      if (!errorsByCode.has(entry.code)) {
        errorsByCode.set(entry.code, {
          code: entry.code,
          count: 0,
          operations: []
        });
      }

      const codeStats = errorsByCode.get(entry.code);
      codeStats.count += entry.count;
      codeStats.operations.push({
        operation: entry.operation,
        count: entry.count,
        firstSeen: entry.firstSeen,
        lastSeen: entry.lastSeen
      });
    }

    return {
      summary: Array.from(errorsByCode.values()),
      detailed: Array.from(this.errors.values()),
      recent: this.recentErrors.slice(-20)
    };
  }

  /**
   * Get error rate over time window
   */
  errorRate(windowMs = 60000) {
    const cutoff = Date.now() - windowMs;
    const recentCount = this.recentErrors.filter(e => e.timestamp > cutoff).length;
    return recentCount / (windowMs / 1000); // errors per second
  }

  /**
   * Reset statistics
   */
  reset() {
    this.errors.clear();
    this.recentErrors = [];
  }
}

// Global error aggregator
const globalAggregator = new ErrorAggregator();

export const errorAggregator = {
  record: (error, context) => globalAggregator.record(error, context),
  stats: () => globalAggregator.stats(),
  errorRate: (windowMs) => globalAggregator.errorRate(windowMs),
  reset: () => globalAggregator.reset()
};

/**
 * Create error handler middleware for Fastify
 */
export function createErrorHandler(logger) {
  return function errorHandler(error, request, reply) {
    const statusCode = error.httpStatus || error.statusCode || 500;
    const isOperational = error.isOperational !== false;

    // Record error for aggregation
    errorAggregator.record(error, {
      operation: `${request.method} ${request.url}`,
      requestId: request.requestId || request.id
    });

    // Log error appropriately
    if (statusCode >= 500) {
      logger.error('Request failed with server error', error, {
        requestId: request.requestId || request.id,
        method: request.method,
        path: request.url,
        statusCode,
        isOperational
      });
    } else if (statusCode >= 400) {
      logger.warn('Request failed with client error', {
        requestId: request.requestId || request.id,
        method: request.method,
        path: request.url,
        statusCode,
        code: error.code,
        message: error.message
      });
    }

    // Send response
    const response = {
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: isOperational ? error.message : 'Internal server error'
      },
      requestId: request.requestId || request.id
    };

    if (error.retryAfter) {
      response.retryAfter = error.retryAfter;
    }

    if (statusCode >= 500) {
      response.retryable = true;
    }

    reply.code(statusCode).send(response);
  };
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling(fn, context = {}) {
  return async function(...args) {
    try {
      return await fn(...args);
    } catch (error) {
      errorAggregator.record(error, context);
      throw error;
    }
  };
}

/**
 * Check if error is operational (expected) or programmer error
 */
export function isOperationalError(error) {
  if (error instanceof DGOSError) {
    return error.isOperational;
  }
  // System errors are generally operational
  return error.code === 'ECONNREFUSED' ||
         error.code === 'ETIMEDOUT' ||
         error.code === 'ENOTFOUND' ||
         error.code === 'ECONNRESET';
}
