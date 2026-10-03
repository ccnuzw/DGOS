/**
 * Metrics collection for performance monitoring
 */

class MetricsCollector {
  constructor() {
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.timings = new Map();
  }

  /**
   * Increment a counter
   * @param {string} name - Metric name
   * @param {number} value - Value to add (default: 1)
   * @param {Record<string, string>} tags - Metric tags
   */
  counter(name, value = 1, tags = {}) {
    const key = this._key(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  /**
   * Set a gauge value
   * @param {string} name - Metric name
   * @param {number} value - Current value
   * @param {Record<string, string>} tags - Metric tags
   */
  gauge(name, value, tags = {}) {
    const key = this._key(name, tags);
    this.gauges.set(key, value);
  }

  /**
   * Record a histogram value
   * @param {string} name - Metric name
   * @param {number} value - Value to record
   * @param {Record<string, string>} tags - Metric tags
   */
  histogram(name, value, tags = {}) {
    const key = this._key(name, tags);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    this.histograms.get(key).push(value);
  }

  /**
   * Record a timing/duration
   * @param {string} name - Metric name
   * @param {number} duration - Duration in milliseconds
   * @param {Record<string, string>} tags - Metric tags
   */
  timing(name, duration, tags = {}) {
    const key = this._key(name, tags);
    if (!this.timings.has(key)) {
      this.timings.set(key, {
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        values: []
      });
    }

    const stats = this.timings.get(key);
    stats.count++;
    stats.sum += duration;
    stats.min = Math.min(stats.min, duration);
    stats.max = Math.max(stats.max, duration);
    stats.values.push(duration);

    // Keep only last 1000 values for percentile calculation
    if (stats.values.length > 1000) {
      stats.values.shift();
    }
  }

  /**
   * Get all metrics snapshot
   */
  snapshot() {
    const timingStats = {};
    for (const [key, stats] of this.timings.entries()) {
      const sorted = [...stats.values].sort((a, b) => a - b);
      const p50 = this._percentile(sorted, 0.50);
      const p95 = this._percentile(sorted, 0.95);
      const p99 = this._percentile(sorted, 0.99);

      timingStats[key] = {
        count: stats.count,
        sum: stats.sum,
        avg: stats.count > 0 ? stats.sum / stats.count : 0,
        min: stats.min === Infinity ? 0 : stats.min,
        max: stats.max === -Infinity ? 0 : stats.max,
        p50,
        p95,
        p99
      };
    }

    const histogramStats = {};
    for (const [key, values] of this.histograms.entries()) {
      const sorted = [...values].sort((a, b) => a - b);
      histogramStats[key] = {
        count: values.length,
        sum: values.reduce((a, b) => a + b, 0),
        p50: this._percentile(sorted, 0.50),
        p95: this._percentile(sorted, 0.95),
        p99: this._percentile(sorted, 0.99)
      };
    }

    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: histogramStats,
      timings: timingStats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.timings.clear();
  }

  /**
   * Generate Prometheus-compatible output
   */
  toPrometheus() {
    const lines = [];

    // Counters
    for (const [key, value] of this.counters.entries()) {
      const { name, tags } = this._parseKey(key);
      const tagStr = this._formatPrometheusTags(tags);
      lines.push(`${name}_total${tagStr} ${value}`);
    }

    // Gauges
    for (const [key, value] of this.gauges.entries()) {
      const { name, tags } = this._parseKey(key);
      const tagStr = this._formatPrometheusTags(tags);
      lines.push(`${name}${tagStr} ${value}`);
    }

    // Timings as histograms
    for (const [key, stats] of this.timings.entries()) {
      const { name, tags } = this._parseKey(key);
      const metricName = `${name}_seconds`;
      const tagStr = this._formatPrometheusTags(tags);

      // Histogram buckets
      const buckets = [0.001, 0.01, 0.05, 0.1, 0.5, 1, 5, 10];
      let count = 0;
      for (const bucket of buckets) {
        const bucketCount = stats.values.filter(v => v / 1000 <= bucket).length;
        count += bucketCount;
        lines.push(`${metricName}_bucket${this._formatPrometheusTags({ ...tags, le: bucket })} ${count}`);
      }
      lines.push(`${metricName}_bucket${this._formatPrometheusTags({ ...tags, le: '+Inf' })} ${stats.count}`);
      lines.push(`${metricName}_sum${tagStr} ${stats.sum / 1000}`);
      lines.push(`${metricName}_count${tagStr} ${stats.count}`);
    }

    return lines.join('\n');
  }

  _key(name, tags) {
    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    return tagStr ? `${name}{${tagStr}}` : name;
  }

  _parseKey(key) {
    const match = key.match(/^([^{]+)(?:\{(.+)\})?$/);
    if (!match) return { name: key, tags: {} };

    const name = match[1];
    const tagsStr = match[2];
    const tags = {};

    if (tagsStr) {
      for (const part of tagsStr.split(',')) {
        const [k, v] = part.split(':');
        tags[k] = v;
      }
    }

    return { name, tags };
  }

  _formatPrometheusTags(tags) {
    const entries = Object.entries(tags);
    if (entries.length === 0) return '';
    return '{' + entries.map(([k, v]) => `${k}="${v}"`).join(',') + '}';
  }

  _percentile(sortedValues, p) {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil(sortedValues.length * p) - 1;
    return sortedValues[Math.max(0, index)];
  }
}

// Global metrics instance
const globalMetrics = new MetricsCollector();

export const metrics = {
  counter: (name, value, tags) => globalMetrics.counter(name, value, tags),
  gauge: (name, value, tags) => globalMetrics.gauge(name, value, tags),
  histogram: (name, value, tags) => globalMetrics.histogram(name, value, tags),
  timing: (name, duration, tags) => globalMetrics.timing(name, duration, tags),
  snapshot: () => globalMetrics.snapshot(),
  reset: () => globalMetrics.reset(),
  toPrometheus: () => globalMetrics.toPrometheus()
};

/**
 * Measure execution time of a function
 */
export async function withTiming(name, fn, tags = {}) {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    metrics.timing(name, duration, tags);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    metrics.timing(name, duration, { ...tags, status: 'error' });
    throw error;
  }
}

/**
 * Create a timer that can be stopped manually
 */
export function startTimer(name, tags = {}) {
  const start = Date.now();
  return {
    stop() {
      const duration = Date.now() - start;
      metrics.timing(name, duration, tags);
      return duration;
    }
  };
}

/**
 * Decorator for timing function calls
 */
export function timed(metricName, tags = {}) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function(...args) {
      return withTiming(metricName, () => originalMethod.apply(this, args), tags);
    };
    return descriptor;
  };
}
