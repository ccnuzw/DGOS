// DGOS Performance Testing Utilities
// Tools for measuring and tracking performance metrics

export interface PerformanceMetrics {
  startupTime?: number;
  memoryUsage?: NodeJS.MemoryUsage;
  apiLatencies: Map<string, number[]>;
  renderTimes: Map<string, number[]>;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    apiLatencies: new Map(),
    renderTimes: new Map(),
  };

  private timers = new Map<string, number>();

  /**
   * Measure startup time
   */
  measureStartup(fn: () => void | Promise<void>): Promise<number> {
    const start = performance.now();
    const result = fn();

    if (result instanceof Promise) {
      return result.then(() => {
        const duration = performance.now() - start;
        this.metrics.startupTime = duration;
        return duration;
      });
    } else {
      const duration = performance.now() - start;
      this.metrics.startupTime = duration;
      return Promise.resolve(duration);
    }
  }

  /**
   * Start a performance timer
   */
  startTimer(label: string): void {
    this.timers.set(label, performance.now());
  }

  /**
   * End a performance timer and record the result
   */
  endTimer(label: string, category: 'api' | 'render' = 'api'): number {
    const start = this.timers.get(label);
    if (!start) {
      throw new Error(`Timer ${label} not found`);
    }

    const duration = performance.now() - start;
    this.timers.delete(label);

    const collection = category === 'api' ? this.metrics.apiLatencies : this.metrics.renderTimes;
    if (!collection.has(label)) {
      collection.set(label, []);
    }
    collection.get(label)!.push(duration);

    return duration;
  }

  /**
   * Measure a function's execution time
   */
  async measure<T>(
    label: string,
    fn: () => T | Promise<T>,
    category: 'api' | 'render' = 'api'
  ): Promise<{ result: T; duration: number }> {
    this.startTimer(label);
    const result = await fn();
    const duration = this.endTimer(label, category);
    return { result, duration };
  }

  /**
   * Take a memory snapshot
   */
  measureMemory(): NodeJS.MemoryUsage {
    const memory = process.memoryUsage();
    this.metrics.memoryUsage = memory;
    return memory;
  }

  /**
   * Get performance statistics for a metric
   */
  getStats(label: string, category: 'api' | 'render' = 'api'): {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    count: number;
  } | null {
    const collection = category === 'api' ? this.metrics.apiLatencies : this.metrics.renderTimes;
    const values = collection.get(label);

    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      count: sorted.length,
    };
  }

  /**
   * Get all metrics
   */
  getMetrics(): PerformanceMetrics {
    return this.metrics;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = {
      apiLatencies: new Map(),
      renderTimes: new Map(),
    };
    this.timers.clear();
  }

  /**
   * Generate a performance report
   */
  report(): string {
    const lines: string[] = ['Performance Report', '='.repeat(50)];

    if (this.metrics.startupTime) {
      lines.push(`\nStartup Time: ${this.metrics.startupTime.toFixed(2)}ms`);
    }

    if (this.metrics.memoryUsage) {
      const mem = this.metrics.memoryUsage;
      lines.push(`\nMemory Usage:`);
      lines.push(`  RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);
      lines.push(`  Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      lines.push(`  Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    }

    if (this.metrics.apiLatencies.size > 0) {
      lines.push(`\nAPI Latencies:`);
      for (const [label, _] of this.metrics.apiLatencies) {
        const stats = this.getStats(label, 'api');
        if (stats) {
          lines.push(`  ${label}:`);
          lines.push(`    Avg: ${stats.avg.toFixed(2)}ms, P95: ${stats.p95.toFixed(2)}ms, Count: ${stats.count}`);
        }
      }
    }

    if (this.metrics.renderTimes.size > 0) {
      lines.push(`\nRender Times:`);
      for (const [label, _] of this.metrics.renderTimes) {
        const stats = this.getStats(label, 'render');
        if (stats) {
          lines.push(`  ${label}:`);
          lines.push(`    Avg: ${stats.avg.toFixed(2)}ms, P95: ${stats.p95.toFixed(2)}ms, Count: ${stats.count}`);
        }
      }
    }

    return lines.join('\n');
  }
}

/**
 * Benchmark a function by running it multiple times
 */
export async function benchmark(
  fn: () => void | Promise<void>,
  iterations: number = 100
): Promise<{
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}> {
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }

  const sorted = times.sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
}
