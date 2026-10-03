import pino from 'pino';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * @typedef {Object} LogContext
 * @property {string} [requestId]
 * @property {string} [userId]
 * @property {string} [sessionId]
 * @property {string} component
 * @property {string} [operation]
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string, context?: LogContext) => void} debug
 * @property {(message: string, context?: LogContext) => void} info
 * @property {(message: string, context?: LogContext) => void} warn
 * @property {(message: string, error?: Error, context?: LogContext) => void} error
 * @property {(childContext: LogContext) => Logger} child
 */

const contextStorage = new AsyncLocalStorage();

/**
 * Redact sensitive fields from log context
 */
const SENSITIVE_FIELDS = [
  'password', 'secret', 'token', 'apiKey', 'api_key',
  'credential', 'authorization', 'cookie', 'sessionId'
];

function sanitizeContext(context) {
  if (!context || typeof context !== 'object') return context;

  const sanitized = { ...context };
  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeContext(sanitized[key]);
    }
  }
  return sanitized;
}

/**
 * Get current async context
 */
export function getContext() {
  return contextStorage.getStore() || {};
}

/**
 * Set context for the current async operation
 */
export function runWithContext(context, fn) {
  const existing = getContext();
  return contextStorage.run({ ...existing, ...context }, fn);
}

/**
 * Create a logger instance
 * @param {string} component - Component name
 * @param {Object} [options] - Logger options
 * @returns {Logger}
 */
export function createLogger(component, options = {}) {
  const isDev = process.env.NODE_ENV !== 'production';
  const level = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

  const pinoOptions = {
    level,
    base: {
      component,
      pid: process.pid,
      hostname: process.env.HOSTNAME || 'unknown'
    },
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({
        component: bindings.component,
        pid: bindings.pid,
        hostname: bindings.hostname
      })
    },
    ...(isDev && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
          singleLine: false
        }
      }
    }),
    ...options
  };

  const pinoLogger = pino(pinoOptions);

  /**
   * Merge contexts: async storage + explicit context
   */
  function mergeContext(explicitContext) {
    const asyncContext = getContext();
    const merged = { ...asyncContext, ...explicitContext };
    return sanitizeContext(merged);
  }

  return {
    debug(message, context = {}) {
      pinoLogger.debug(mergeContext(context), message);
    },

    info(message, context = {}) {
      pinoLogger.info(mergeContext(context), message);
    },

    warn(message, context = {}) {
      pinoLogger.warn(mergeContext(context), message);
    },

    error(message, error, context = {}) {
      const errorContext = error ? {
        error: {
          message: error.message,
          name: error.name,
          code: error.code,
          stack: error.stack?.split('\n').slice(0, 10)
        }
      } : {};

      pinoLogger.error(
        mergeContext({ ...errorContext, ...context }),
        message
      );
    },

    child(childContext) {
      return createLogger(component, {
        ...options,
        base: { ...pinoOptions.base, ...sanitizeContext(childContext) }
      });
    },

    // Expose raw pino instance for advanced use cases
    _pino: pinoLogger
  };
}

/**
 * Create request logger middleware (for Fastify/Express-like frameworks)
 */
export function createRequestLogger(component = 'http') {
  const logger = createLogger(component);

  return function requestLogger(req, res, next) {
    const requestId = req.id || req.headers['x-request-id'] || crypto.randomUUID();
    const startTime = Date.now();

    const context = {
      requestId,
      method: req.method,
      path: req.path || req.url,
      component
    };

    // Run request handling in async context
    runWithContext(context, () => {
      logger.info('Request started', context);

      // Hook into response finish
      const originalEnd = res.end;
      res.end = function(...args) {
        const duration = Date.now() - startTime;
        logger.info('Request completed', {
          ...context,
          statusCode: res.statusCode,
          duration
        });
        return originalEnd.apply(res, args);
      };

      if (next) next();
    });
  };
}

/**
 * Log duration of an async operation
 */
export async function withLogging(logger, operation, fn, context = {}) {
  const startTime = Date.now();
  logger.debug(`Starting ${operation}`, context);

  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    logger.debug(`Completed ${operation}`, { ...context, duration });
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed ${operation}`, error, { ...context, duration });
    throw error;
  }
}
