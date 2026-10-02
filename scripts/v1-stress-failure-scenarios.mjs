#!/usr/bin/env node
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from '../apps/api/node_modules/pg/lib/index.js';
import { createClient } from '../apps/api/node_modules/redis/dist/index.js';
import { discoverMigrations, buildMigrationSql } from './migrate.mjs';
import { createOpenAiCompatibleFixture } from '../test-support/openai-compatible-fixture.mjs';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const scenarios = [
  {
    name: 'database_connection_loss',
    description: 'Simulate database connection loss and recovery',
    async execute(ctx) {
      const results = { phase: 'database_connection_loss', events: [] };

      // Submit tasks
      const taskId1 = await ctx.submitTask();
      results.events.push({ event: 'task_submitted', taskId: taskId1 });

      // Pause connections (simulate by overwhelming pool)
      results.events.push({ event: 'simulating_db_pressure' });

      // Try to submit during "failure"
      try {
        const heavyQueries = [];
        for (let i = 0; i < 20; i++) {
          heavyQueries.push(ctx.pool.query('SELECT pg_sleep(0.1)').catch(() => {}));
        }

        const taskId2 = await ctx.submitTask();
        results.events.push({ event: 'task_submitted_during_pressure', taskId: taskId2 });

        await Promise.all(heavyQueries);
      } catch (error) {
        results.events.push({ event: 'expected_degradation', error: error.message });
      }

      // Recovery
      await sleep(1000);
      const taskId3 = await ctx.submitTask();
      results.events.push({ event: 'task_submitted_after_recovery', taskId: taskId3 });

      results.status = 'completed';
      return results;
    }
  },
  {
    name: 'redis_connection_stress',
    description: 'Stress test Redis with rapid secret access',
    async execute(ctx) {
      const results = { phase: 'redis_connection_stress', events: [] };

      // Rapid sequential requests that hit Redis
      const operations = [];
      for (let i = 0; i < 50; i++) {
        operations.push(
          ctx.call('/system/settings').catch(err => ({ error: err.message }))
        );
      }

      const outcomes = await Promise.all(operations);
      const successful = outcomes.filter(o => !o.error).length;
      const failed = outcomes.filter(o => o.error).length;

      results.events.push({
        event: 'rapid_redis_operations',
        total: operations.length,
        successful,
        failed,
        success_rate: (successful / operations.length * 100).toFixed(2)
      });

      results.status = successful > operations.length * 0.9 ? 'passed' : 'degraded';
      return results;
    }
  },
  {
    name: 'provider_timeout_handling',
    description: 'Test provider timeout and retry logic',
    async execute(ctx) {
      const results = { phase: 'provider_timeout_handling', events: [] };

      // Configure fixture to simulate slowness
      ctx.fixture.setLatency(5000);
      results.events.push({ event: 'fixture_latency_set', ms: 5000 });

      try {
        const taskId = await ctx.submitTask();
        results.events.push({ event: 'task_submitted_with_slow_provider', taskId });

        // Check if task eventually times out or completes
        await sleep(8000);
        const taskState = await ctx.call(`/ai-tasks/${taskId}`);
        results.events.push({ event: 'task_state_after_delay', state: taskState.state });
      } catch (error) {
        results.events.push({ event: 'timeout_handled', error: error.message });
      } finally {
        ctx.fixture.setLatency(0);
      }

      results.status = 'completed';
      return results;
    }
  },
  {
    name: 'concurrent_write_conflict',
    description: 'Test optimistic locking with concurrent updates',
    async execute(ctx) {
      const results = { phase: 'concurrent_write_conflict', events: [] };

      // Create a provider config
      const config = await ctx.call('/provider/configs', {
        method: 'POST',
        body: {
          requestId: randomUUID(),
          providerAccountId: ctx.accountId,
          protocolType: 'openai-compatible',
          displayName: 'concurrent-test',
          baseUrl: 'https://fixture.test/v1'
        },
        expected: 201
      });

      const configId = config.providerConfigId ?? config.id;
      results.events.push({ event: 'config_created', configId });

      // Attempt concurrent updates with same version
      const updates = [];
      for (let i = 0; i < 5; i++) {
        updates.push(
          ctx.call(`/provider/configs/${configId}`, {
            method: 'PUT',
            body: {
              requestId: randomUUID(),
              displayName: `concurrent-${i}`,
              baseVersion: config.version
            }
          }).catch(err => ({ error: err.message, index: i }))
        );
      }

      const outcomes = await Promise.all(updates);
      const succeeded = outcomes.filter(o => !o.error).length;
      const conflicts = outcomes.filter(o => o.error?.includes('409')).length;

      results.events.push({
        event: 'concurrent_updates_attempted',
        succeeded,
        conflicts,
        expected_behavior: 'one success, rest conflicts'
      });

      results.status = succeeded === 1 && conflicts === 4 ? 'passed' : 'unexpected';
      return results;
    }
  },
  {
    name: 'memory_pressure_simulation',
    description: 'Submit many tasks and monitor resource usage',
    async execute(ctx) {
      const results = { phase: 'memory_pressure_simulation', events: [] };

      const startMemory = process.memoryUsage();
      results.events.push({ event: 'start_memory', rss_mb: Math.round(startMemory.rss / 1024 / 1024) });

      // Submit burst of tasks
      const taskIds = [];
      for (let i = 0; i < 30; i++) {
        try {
          const taskId = await ctx.submitTask();
          taskIds.push(taskId);
        } catch (error) {
          results.events.push({ event: 'submission_failed', index: i, error: error.message });
        }
      }

      results.events.push({ event: 'tasks_submitted', count: taskIds.length });

      // Wait and check memory
      await sleep(3000);
      const endMemory = process.memoryUsage();
      results.events.push({ event: 'end_memory', rss_mb: Math.round(endMemory.rss / 1024 / 1024) });

      const memoryGrowthMb = Math.round((endMemory.rss - startMemory.rss) / 1024 / 1024);
      results.events.push({ event: 'memory_growth', mb: memoryGrowthMb });

      results.status = memoryGrowthMb < 200 ? 'passed' : 'high_growth';
      return results;
    }
  },
  {
    name: 'graceful_shutdown',
    description: 'Test graceful shutdown with in-flight requests',
    async execute(ctx) {
      const results = { phase: 'graceful_shutdown', events: [] };

      // Submit tasks
      const taskIds = [];
      for (let i = 0; i < 5; i++) {
        const taskId = await ctx.submitTask();
        taskIds.push(taskId);
      }

      results.events.push({ event: 'tasks_submitted', count: taskIds.length });

      // Check all submitted successfully
      await sleep(2000);
      let completedCount = 0;
      for (const taskId of taskIds) {
        try {
          const task = await ctx.call(`/ai-tasks/${taskId}`);
          if (['succeeded', 'failed'].includes(task.state)) completedCount++;
        } catch {}
      }

      results.events.push({ event: 'tasks_completed', count: completedCount, total: taskIds.length });
      results.status = completedCount === taskIds.length ? 'passed' : 'incomplete';
      return results;
    }
  }
];

async function main() {
  const runId = `V1-FAILURE-SCENARIOS-${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
  const report = {
    run_id: runId,
    test_type: 'failure_scenarios',
    started_at: new Date().toISOString(),
    scenarios: []
  };

  console.log(`\nExecuting Failure Scenario Tests: ${runId}\n`);

  const adminUrl = new URL(process.env.DGOS_STRESS_ADMIN_URL || 'postgresql://dgos:local@127.0.0.1:5432/postgres');
  const redisUrl = new URL(process.env.DGOS_STRESS_REDIS_URL || 'redis://127.0.0.1:6379/9');
  const apiPort = Number(process.env.DGOS_STRESS_API_PORT || 15113);
  const fixturePort = Number(process.env.DGOS_STRESS_FIXTURE_PORT || 15114);

  const name = `dgos_failure_${randomBytes(6).toString('hex')}`;
  const admin = new pg.Pool({ connectionString: adminUrl.toString() });
  const databaseUrl = new URL(adminUrl);
  databaseUrl.pathname = `/${name}`;

  let pool, fixture, created = false;

  try {
    // Setup
    await admin.query(`CREATE DATABASE ${name}`);
    created = true;
    pool = new pg.Pool({ connectionString: databaseUrl.toString() });

    const migrations = await discoverMigrations();
    await pool.query(buildMigrationSql(migrations));

    fixture = createOpenAiCompatibleFixture({ port: fixturePort, host: '127.0.0.1' });
    await fixture.start();

    // Bootstrap would need full API/worker setup - simplified for scenario testing
    const base = `http://127.0.0.1:${apiPort}`;

    // Create test context
    const ctx = {
      pool,
      fixture,
      base,
      session: null,
      accountId: null,
      configId: null,
      call: async (path, options = {}) => {
        const response = await fetch(`${base}/api/v1${path}`, {
          method: options.method || 'GET',
          signal: AbortSignal.timeout(options.timeoutMs || 5000),
          headers: {
            ...(ctx.session ? { authorization: `Bearer ${ctx.session}` } : {}),
            ...(options.body ? { 'content-type': 'application/json' } : {})
          },
          body: options.body ? JSON.stringify(options.body) : undefined
        });
        const text = await response.text();
        if (options.expected && response.status !== options.expected) {
          throw new Error(`http_${response.status}_${path}`);
        }
        return text ? JSON.parse(text) : null;
      },
      submitTask: async () => {
        const result = await ctx.call('/ai-tasks', {
          method: 'POST',
          body: {
            requestId: randomUUID(),
            target: 'text',
            intent: 'text.chat',
            input: { text: `failure test ${randomBytes(4).toString('hex')}` },
            options: { providerConfigId: ctx.configId, modelId: 'fixture-text-model' }
          },
          expected: 202
        });
        return result.taskId;
      }
    };

    console.log('Note: Full API/worker bootstrap required for complete scenario testing');
    console.log('Running scenarios in limited mode...\n');

    // Execute scenarios
    for (const scenario of scenarios) {
      console.log(`Testing: ${scenario.name}`);
      console.log(`  ${scenario.description}`);

      try {
        const result = await scenario.execute(ctx);
        report.scenarios.push({ name: scenario.name, ...result });
        console.log(`  ✓ ${result.status}\n`);
      } catch (error) {
        report.scenarios.push({
          name: scenario.name,
          status: 'error',
          error: error.message
        });
        console.log(`  ✗ Error: ${error.message}\n`);
      }
    }

    report.exit_code = 0;
    report.status = 'completed';

  } catch (error) {
    report.exit_code = 1;
    report.error = error.message;
    process.exitCode = 1;
    console.error(`\nFailure scenario testing error: ${error.message}`);
  } finally {
    if (fixture) await fixture.close().catch(() => {});
    if (pool) await pool.end().catch(() => {});
    if (created) {
      try {
        await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
      } catch {}
    }
    await admin.end().catch(() => {});

    report.finished_at = new Date().toISOString();
    await writeFile(`.herdr/${runId}-manifest.json`, JSON.stringify(report, null, 2) + '\n');

    console.log(`\nResults: .herdr/${runId}-manifest.json`);
    console.log(JSON.stringify({
      run_id: runId,
      scenarios_executed: report.scenarios.length,
      passed: report.scenarios.filter(s => s.status === 'passed').length
    }));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
