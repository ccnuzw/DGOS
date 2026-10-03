/**
 * Health check and readiness utilities
 */

/**
 * @typedef {Object} HealthCheckResult
 * @property {'healthy' | 'degraded' | 'unhealthy'} status
 * @property {number} [latency] - Check latency in ms
 * @property {string} [error] - Error message if unhealthy
 * @property {Record<string, any>} [details] - Additional details
 */

class HealthChecker {
  constructor() {
    this.checks = new Map();
    this.startTime = Date.now();
  }

  /**
   * Register a health check
   * @param {string} name - Check name
   * @param {() => Promise<HealthCheckResult>} checkFn - Check function
   */
  register(name, checkFn) {
    this.checks.set(name, checkFn);
  }

  /**
   * Run all health checks
   */
  async check() {
    const results = {};
    let overallStatus = 'healthy';

    for (const [name, checkFn] of this.checks) {
      const startTime = Date.now();
      try {
        const result = await Promise.race([
          checkFn(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Check timeout')), 5000)
          )
        ]);

        results[name] = {
          status: result.status || 'healthy',
          latency: Date.now() - startTime,
          ...result
        };

        if (result.status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          latency: Date.now() - startTime,
          error: error.message
        };
        overallStatus = 'unhealthy';
      }
    }

    return {
      status: overallStatus,
      checks: results,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Run readiness checks (subset of health checks)
   */
  async ready() {
    const health = await this.check();
    return health.status !== 'unhealthy';
  }

  /**
   * Simple alive check (no dependencies)
   */
  async alive() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

// Global health checker
const globalHealthChecker = new HealthChecker();

export const healthCheck = {
  register: (name, fn) => globalHealthChecker.register(name, fn),
  check: () => globalHealthChecker.check(),
  ready: () => globalHealthChecker.ready(),
  alive: () => globalHealthChecker.alive()
};

/**
 * Create health check routes for Fastify
 */
export function registerHealthRoutes(app, options = {}) {
  const {
    healthPath = '/health',
    readyPath = '/ready',
    alivePath = '/alive',
    version = '1.0.0'
  } = options;

  // Health endpoint
  app.get(healthPath, async (request, reply) => {
    const health = await healthCheck.check();
    const statusCode = health.status === 'unhealthy' ? 503 : 200;

    return reply.code(statusCode).send({
      ...health,
      version
    });
  });

  // Readiness endpoint
  app.get(readyPath, async (request, reply) => {
    try {
      const isReady = await healthCheck.ready();
      if (isReady) {
        return { status: 'ready', version };
      } else {
        return reply.code(503).send({ status: 'not_ready' });
      }
    } catch (error) {
      return reply.code(503).send({
        status: 'not_ready',
        error: error.message
      });
    }
  });

  // Liveness endpoint
  app.get(alivePath, async () => {
    return healthCheck.alive();
  });
}

/**
 * Common health check implementations
 */

/**
 * Database health check
 */
export function createDatabaseCheck(pool, name = 'database') {
  return {
    name,
    check: async () => {
      const start = Date.now();
      try {
        await pool.query('SELECT 1');
        return {
          status: 'healthy',
          latency: Date.now() - start
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message,
          latency: Date.now() - start
        };
      }
    }
  };
}

/**
 * Redis health check
 */
export function createRedisCheck(client, name = 'redis') {
  return {
    name,
    check: async () => {
      const start = Date.now();
      try {
        await client.ping();
        return {
          status: 'healthy',
          latency: Date.now() - start
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message,
          latency: Date.now() - start
        };
      }
    }
  };
}

/**
 * Generic HTTP endpoint health check
 */
export function createHttpCheck(url, name) {
  return {
    name,
    check: async () => {
      const start = Date.now();
      try {
        const response = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });

        return {
          status: response.ok ? 'healthy' : 'degraded',
          latency: Date.now() - start,
          statusCode: response.status
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message,
          latency: Date.now() - start
        };
      }
    }
  };
}

/**
 * Memory usage check
 */
export function createMemoryCheck(thresholdMB = 1024, name = 'memory') {
  return {
    name,
    check: async () => {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / 1024 / 1024;
      const heapTotalMB = usage.heapTotal / 1024 / 1024;

      const status = heapUsedMB > thresholdMB ? 'degraded' : 'healthy';

      return {
        status,
        details: {
          heapUsedMB: Math.round(heapUsedMB),
          heapTotalMB: Math.round(heapTotalMB),
          rssMB: Math.round(usage.rss / 1024 / 1024)
        }
      };
    }
  };
}
