// DGOS Performance Benchmark Runner
// Runs performance benchmarks and generates reports

import { PerformanceMonitor, benchmark } from '../../packages/sdk/src/testing/performance.ts';
import { createTestApp } from '../../packages/sdk/src/testing/index.ts';
import { writeFile } from 'node:fs/promises';

async function runBenchmarks() {
  const results = {
    name: 'DGOS Performance Benchmarks',
    timestamp: new Date().toISOString(),
    benchmarks: [] as Array<{
      name: string;
      value: number;
      unit: string;
      range?: string;
    }>,
  };

  console.log('Running DGOS Performance Benchmarks...\n');

  // Benchmark 1: App initialization
  console.log('1. App initialization...');
  const initBenchmark = await benchmark(() => {
    createTestApp({
      context: { appId: 'test.perf', version: '1.0.0' },
    });
  }, 100);

  results.benchmarks.push({
    name: 'App Initialization',
    value: initBenchmark.avg,
    unit: 'ms',
    range: `${initBenchmark.min.toFixed(2)}-${initBenchmark.max.toFixed(2)}`,
  });
  console.log(`   Avg: ${initBenchmark.avg.toFixed(2)}ms (P95: ${initBenchmark.p95.toFixed(2)}ms)\n`);

  // Benchmark 2: Storage operations
  console.log('2. Storage operations...');
  const testApp = createTestApp();
  const storageBenchmark = await benchmark(async () => {
    await testApp.api.storage.kv.set('key', { data: 'value' });
    await testApp.api.storage.kv.get('key');
  }, 100);

  results.benchmarks.push({
    name: 'Storage Operations',
    value: storageBenchmark.avg,
    unit: 'ms',
    range: `${storageBenchmark.min.toFixed(2)}-${storageBenchmark.max.toFixed(2)}`,
  });
  console.log(`   Avg: ${storageBenchmark.avg.toFixed(2)}ms (P95: ${storageBenchmark.p95.toFixed(2)}ms)\n`);

  // Benchmark 3: Permission checks
  console.log('3. Permission checks...');
  testApp.permissions.grant('test.permission');
  const permissionBenchmark = await benchmark(async () => {
    await testApp.api.permissions.has('test.permission');
  }, 100);

  results.benchmarks.push({
    name: 'Permission Checks',
    value: permissionBenchmark.avg,
    unit: 'ms',
    range: `${permissionBenchmark.min.toFixed(2)}-${permissionBenchmark.max.toFixed(2)}`,
  });
  console.log(`   Avg: ${permissionBenchmark.avg.toFixed(2)}ms (P95: ${permissionBenchmark.p95.toFixed(2)}ms)\n`);

  // Benchmark 4: Task submission
  console.log('4. Task submission...');
  const taskBenchmark = await benchmark(async () => {
    await testApp.api.tasks.submit({
      model: 'test-model',
      messages: [{ role: 'user', content: 'test' }],
    });
  }, 50);

  results.benchmarks.push({
    name: 'Task Submission',
    value: taskBenchmark.avg,
    unit: 'ms',
    range: `${taskBenchmark.min.toFixed(2)}-${taskBenchmark.max.toFixed(2)}`,
  });
  console.log(`   Avg: ${taskBenchmark.avg.toFixed(2)}ms (P95: ${taskBenchmark.p95.toFixed(2)}ms)\n`);

  // Benchmark 5: UI notifications
  console.log('5. UI notifications...');
  const uiBenchmark = await benchmark(async () => {
    await testApp.api.ui.notify({ title: 'Test', body: 'Message' });
  }, 100);

  results.benchmarks.push({
    name: 'UI Notifications',
    value: uiBenchmark.avg,
    unit: 'ms',
    range: `${uiBenchmark.min.toFixed(2)}-${uiBenchmark.max.toFixed(2)}`,
  });
  console.log(`   Avg: ${uiBenchmark.avg.toFixed(2)}ms (P95: ${uiBenchmark.p95.toFixed(2)}ms)\n`);

  // Memory usage
  console.log('6. Memory usage...');
  const monitor = new PerformanceMonitor();
  const memory = monitor.measureMemory();

  results.benchmarks.push({
    name: 'Memory Usage (RSS)',
    value: memory.rss / 1024 / 1024,
    unit: 'MB',
  });
  results.benchmarks.push({
    name: 'Memory Usage (Heap)',
    value: memory.heapUsed / 1024 / 1024,
    unit: 'MB',
  });
  console.log(`   RSS: ${(memory.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Heap: ${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB\n`);

  // Save results
  await writeFile(
    'performance-results.json',
    JSON.stringify(results, null, 2),
    'utf-8'
  );

  console.log('✓ Benchmarks complete. Results saved to performance-results.json');
}

runBenchmarks().catch(console.error);
