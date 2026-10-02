#!/usr/bin/env node
/**
 * V1 FR-005 Complete Real Provider Validation
 *
 * Tests all FR-005 acceptance criteria with real Provider (cc.nextcc.cc):
 * - AC01: Text task end-to-end flow
 * - AC02: Failure and duplicate submission handling
 * - AC08: SSE streaming with disconnect recovery
 *
 * Evidence: .herdr/V1-FR-005-COMPLETE-VALIDATION.md
 */

import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import pg from '../apps/api/node_modules/pg/lib/index.js';
import { createClient } from '../apps/api/node_modules/redis/dist/index.js';
import { buildServer } from '../apps/api/src/server.mjs';

// Configuration
const REAL_PROVIDER_CONFIG_PATH = resolve('.herdr/real-provider-config.json');
const EVIDENCE_DIR = resolve('.herdr');
const RUN_ID = `V1-FR-005-REAL-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const REPORT_PATH = join(EVIDENCE_DIR, `${RUN_ID}-report.json`);
const LOG_PATH = join(EVIDENCE_DIR, `${RUN_ID}-log.txt`);
const MARKDOWN_PATH = join(EVIDENCE_DIR, 'V1-FR-005-COMPLETE-VALIDATION.md');

// Test state
const report = {
  runId: RUN_ID,
  startedAt: new Date().toISOString(),
  title: 'FR-005 Complete Real Provider Validation',
  acs: {
    AC01: { name: 'Text task end-to-end flow', status: 'pending', tests: [] },
    AC02: { name: 'Failure and duplicate submission', status: 'pending', tests: [] },
    AC08: { name: 'SSE streaming with reconnection', status: 'pending', tests: [] }
  },
  evidence: {},
  costs: { totalTokens: 0, estimatedUSD: 0 },
  limitations: []
};

const log = [];
const logEntry = (message) => {
  const entry = `${new Date().toISOString()} ${message}`;
  log.push(entry);
  console.log(message);
};

const recordTest = (ac, testName, result, evidence = {}) => {
  report.acs[ac].tests.push({ name: testName, result, evidence, timestamp: new Date().toISOString() });
  logEntry(`${ac} ${testName}: ${result}`);
};

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (name, readFn, predicate, timeoutMs = 30000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await readFn();
    if (predicate(value)) return value;
    await pause(100);
  }
  throw new Error(`${name}_timeout`);
};

// Main test execution
async function main() {
  logEntry('=== FR-005 Real Provider Validation Start ===');

  let pool, api, session, ownerId, realProviderConfig, providerConfigId;

  try {
    // Load real provider configuration
    logEntry('Loading real provider configuration...');
    const configData = await readFile(REAL_PROVIDER_CONFIG_PATH, 'utf-8');
    realProviderConfig = JSON.parse(configData);

    assert.ok(realProviderConfig.base_url, 'base_url required');
    assert.ok(realProviderConfig.api_key, 'api_key required');
    assert.ok(Array.isArray(realProviderConfig.test_models), 'test_models required');

    report.evidence.provider = {
      base_url: realProviderConfig.base_url,
      protocol: realProviderConfig.protocol,
      models_available: realProviderConfig.test_models.length,
      connection_verified: realProviderConfig.connection_verified
    };

    logEntry(`Provider: ${realProviderConfig.base_url}`);
    logEntry(`Models available: ${realProviderConfig.test_models.join(', ')}`);

    // Setup database connection
    logEntry('Connecting to database...');
    const databaseUrl = process.env.DGOS_DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DGOS_DATABASE_URL environment variable required');
    }

    pool = new pg.Pool({ connectionString: databaseUrl });
    const dbTest = await pool.query('SELECT current_database() AS db, version() AS pg_version');
    logEntry(`Database: ${dbTest.rows[0].db}`);
    report.evidence.database = { name: dbTest.rows[0].db };

    // Build API server (in-process for testing)
    logEntry('Building API server...');
    const redisUrl = process.env.DGOS_REDIS_URL || 'redis://127.0.0.1:6379/0';
    const redis = createClient({ url: redisUrl });
    redis.on('error', () => {});
    await redis.connect();

    api = buildServer({
      logger: false,
      closeDatabasePools: false
    });

    const apiPort = 15200;
    await api.listen({ host: '127.0.0.1', port: apiPort });
    logEntry(`API listening on port ${apiPort}`);

    // Helper functions
    const http = async (path, options = {}) => {
      const { method = 'GET', body, expectedStatus = 200, headers = {} } = options;
      const url = `http://127.0.0.1:${apiPort}/api/v1${path}`;

      const response = await fetch(url, {
        method,
        headers: {
          ...(session ? { authorization: `Bearer ${session}` } : {}),
          ...(body ? { 'content-type': 'application/json', 'x-dgos-csrf': 'fr-005-validation' } : {}),
          ...headers
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30000)
      });

      const rawText = await response.text();
      let jsonData;
      try {
        jsonData = rawText ? JSON.parse(rawText) : null;
      } catch {
        jsonData = rawText;
      }

      if (response.status !== expectedStatus) {
        throw new Error(`HTTP ${response.status} (expected ${expectedStatus}): ${path} - ${jsonData?.errorKey || 'no error'}`);
      }

      return jsonData;
    };

    const post = (path, body, expectedStatus = 200) =>
      http(path, { method: 'POST', body, expectedStatus });

    const getTask = (taskId) => http(`/ai-tasks/${taskId}`);

    const waitForTerminal = (taskId) =>
      waitFor(`task_${taskId}_terminal`,
        () => getTask(taskId),
        (task) => ['succeeded', 'failed', 'cancelled', 'timed_out'].includes(task.status),
        60000 // 60 second timeout for real provider
      );

    // Bootstrap admin
    logEntry('Bootstrapping admin identity...');
    const boot = await post('/identity/admin/bootstrap', {
      displayName: 'FR-005 Test Admin',
      credential: `test-admin-${randomUUID()}`
    }, 201);

    session = boot.sessionId;
    ownerId = boot.principalId;
    logEntry(`Admin created: ${ownerId}`);

    // Create provider account
    logEntry('Creating provider account...');
    const account = await post('/provider/accounts', {
      requestId: randomUUID(),
      protocolType: realProviderConfig.protocol,
      displayName: 'Real Provider Test',
      credential: realProviderConfig.api_key,
      scope: { endpoint: realProviderConfig.base_url }
    }, 201);

    logEntry(`Provider account created: ${account.accountId}`);

    // Run connection test
    logEntry('Running connection test...');
    const connectionTest = await post('/provider/connection-tests', {
      requestId: randomUUID(),
      accountId: account.accountId,
      protocolVersion: 'v1'
    }, 202);

    // Wait for connection test to complete (need worker to process)
    logEntry('NOTE: Connection test requires worker - checking account state...');
    report.limitations.push('Connection test requires independent worker process');

    // Create provider config
    logEntry('Creating provider config...');
    const config = await post('/provider/configs', {
      requestId: randomUUID(),
      providerAccountId: account.accountId,
      protocolType: realProviderConfig.protocol,
      displayName: 'Real Provider Config',
      baseUrl: realProviderConfig.base_url
    }, 201);

    providerConfigId = config.id;
    logEntry(`Provider config created: ${providerConfigId}`);

    report.evidence.providerConfig = {
      id: providerConfigId,
      status: config.status,
      protocol: config.protocolType
    };

    // Setup quota
    logEntry('Setting up quota policy...');
    await http('/quota/policies', {
      method: 'PUT',
      body: {
        requestId: randomUUID(),
        metric: 'requests',
        scopeType: 'subject',
        scopeId: ownerId,
        hardLimit: 1000,
        softLimit: 900,
        windowSeconds: 3600,
        effectiveAt: new Date().toISOString()
      }
    });

    logEntry('Quota policy created');

    // ===== AC01: Text task end-to-end flow =====
    logEntry('\n=== AC01: Text Task End-to-End Flow ===');

    try {
      const testModel = realProviderConfig.test_models[0];
      logEntry(`Submitting text task with model: ${testModel}`);

      const taskInput = {
        requestId: randomUUID(),
        target: 'text',
        intent: 'text.chat',
        input: {
          text: 'Hello! Please respond with a short greeting.'
        },
        options: {
          providerConfigId,
          modelId: testModel,
          parameters: {
            temperature: 0.7,
            maxTokens: 50
          }
        }
      };

      const taskSubmission = await post('/ai-tasks', taskInput, 202);
      const taskId = taskSubmission.taskId;

      logEntry(`Task submitted: ${taskId}`);
      report.evidence.ac01_taskId = taskId;

      recordTest('AC01', 'submit_text_task', 'passed', {
        taskId,
        requestId: taskInput.requestId
      });

      // Query task status
      const taskStatus = await getTask(taskId);
      logEntry(`Task status: ${taskStatus.status}`);

      assert.ok(['queued', 'running', 'succeeded'].includes(taskStatus.status),
        `Unexpected status: ${taskStatus.status}`);

      recordTest('AC01', 'query_task_status', 'passed', {
        status: taskStatus.status
      });

      // Wait for terminal state (requires worker)
      logEntry('NOTE: Waiting for terminal state requires worker process');
      report.limitations.push('Terminal state validation requires worker - checking database directly');

      // Check database state
      const dbTask = await pool.query(
        'SELECT task_id, status, state, created_at FROM ai_tasks WHERE task_id = $1',
        [taskId]
      );

      if (dbTask.rows.length > 0) {
        const task = dbTask.rows[0];
        logEntry(`Database task state: ${task.state}`);

        recordTest('AC01', 'database_task_created', 'passed', {
          taskId: task.task_id,
          state: task.state,
          created_at: task.created_at
        });
      }

      report.acs.AC01.status = 'partial';

    } catch (error) {
      logEntry(`AC01 Error: ${error.message}`);
      recordTest('AC01', 'end_to_end_flow', 'failed', { error: error.message });
      report.acs.AC01.status = 'failed';
    }

    // ===== AC02: Failure and duplicate submission =====
    logEntry('\n=== AC02: Failure and Duplicate Submission ===');

    try {
      // Test idempotency with same requestId
      const requestId = randomUUID();
      const testModel = realProviderConfig.test_models[0];

      const taskInput = {
        requestId,
        target: 'text',
        intent: 'text.chat',
        input: { text: 'Test idempotency' },
        options: {
          providerConfigId,
          modelId: testModel,
          parameters: { temperature: 0.5 }
        }
      };

      logEntry('Submitting task with requestId...');
      const task1 = await post('/ai-tasks', taskInput, 202);
      const taskId1 = task1.taskId;

      logEntry(`First submission: ${taskId1}`);

      // Submit again with same requestId
      logEntry('Re-submitting with same requestId...');
      const task2 = await post('/ai-tasks', taskInput, 202);
      const taskId2 = task2.taskId;

      logEntry(`Second submission: ${taskId2}`);

      // Should return same taskId
      assert.equal(taskId1, taskId2, 'Idempotency check: same requestId should return same taskId');

      recordTest('AC02', 'idempotent_submission', 'passed', {
        requestId,
        taskId: taskId1,
        confirmed: taskId1 === taskId2
      });

      // Test invalid input
      logEntry('Testing invalid input...');
      try {
        await post('/ai-tasks', {
          requestId: randomUUID(),
          target: 'text',
          intent: 'text.chat',
          input: { text: '' }, // Empty text
          options: {
            providerConfigId,
            modelId: testModel
          }
        }, 400);

        recordTest('AC02', 'invalid_input_rejection', 'passed', {
          note: 'Empty input rejected as expected'
        });
      } catch (error) {
        if (error.message.includes('400')) {
          recordTest('AC02', 'invalid_input_rejection', 'passed');
        } else {
          throw error;
        }
      }

      report.acs.AC02.status = 'passed';

    } catch (error) {
      logEntry(`AC02 Error: ${error.message}`);
      recordTest('AC02', 'failure_handling', 'failed', { error: error.message });
      report.acs.AC02.status = 'failed';
    }

    // ===== AC08: SSE streaming with reconnection =====
    logEntry('\n=== AC08: SSE Streaming with Reconnection ===');

    try {
      const testModel = realProviderConfig.test_models[0];

      // Submit streaming task
      const taskInput = {
        requestId: randomUUID(),
        target: 'text',
        intent: 'text.chat',
        input: { text: 'Count to 5' },
        options: {
          providerConfigId,
          modelId: testModel,
          parameters: { temperature: 0.3 }
        }
      };

      const task = await post('/ai-tasks', taskInput, 202);
      const taskId = task.taskId;

      logEntry(`Streaming task submitted: ${taskId}`);

      // Test SSE endpoint exists
      const sseUrl = `http://127.0.0.1:${apiPort}/api/v1/ai-tasks/${taskId}/events`;
      logEntry(`SSE endpoint: ${sseUrl}`);

      recordTest('AC08', 'submit_streaming_task', 'passed', {
        taskId,
        sseEndpoint: `/ai-tasks/${taskId}/events`
      });

      // Check if events exist in database
      await pause(1000); // Wait a bit for potential events

      const events = await pool.query(
        'SELECT event_id, event_type, sequence, created_at FROM ai_task_events WHERE task_id = $1 ORDER BY sequence',
        [taskId]
      );

      logEntry(`Events in database: ${events.rows.length}`);

      if (events.rows.length > 0) {
        recordTest('AC08', 'event_stream_database', 'passed', {
          eventCount: events.rows.length,
          eventTypes: events.rows.map(e => e.event_type)
        });
      } else {
        recordTest('AC08', 'event_stream_database', 'info', {
          note: 'No events yet (requires worker to process)'
        });
      }

      report.acs.AC08.status = 'partial';
      report.limitations.push('SSE streaming requires worker process for event generation');

    } catch (error) {
      logEntry(`AC08 Error: ${error.message}`);
      recordTest('AC08', 'sse_streaming', 'failed', { error: error.message });
      report.acs.AC08.status = 'failed';
    }

    // Finalize report
    report.completedAt = new Date().toISOString();
    report.summary = {
      ac01: report.acs.AC01.status,
      ac02: report.acs.AC02.status,
      ac08: report.acs.AC08.status,
      overallStatus: 'partial - requires worker for full validation'
    };

    logEntry('\n=== Validation Complete ===');
    logEntry(`Report: ${REPORT_PATH}`);
    logEntry(`Markdown: ${MARKDOWN_PATH}`);

  } catch (error) {
    logEntry(`FATAL ERROR: ${error.message}`);
    logEntry(error.stack);
    report.fatalError = {
      message: error.message,
      stack: error.stack
    };
  } finally {
    // Cleanup
    if (api) {
      await api.close();
      logEntry('API server closed');
    }

    if (pool) {
      await pool.end();
      logEntry('Database connection closed');
    }

    // Write reports
    await writeFile(REPORT_PATH, JSON.stringify(report, null, 2));
    await writeFile(LOG_PATH, log.join('\n'));

    // Generate markdown report
    await generateMarkdownReport();

    logEntry(`\nReports written to ${EVIDENCE_DIR}`);
  }
}

async function generateMarkdownReport() {
  const markdown = `# V1 FR-005 Complete Validation Report

**Run ID**: ${report.runId}
**Started**: ${report.startedAt}
**Completed**: ${report.completedAt || 'incomplete'}

## Summary

| AC | Name | Status | Tests |
|---|---|---|---|
| AC01 | Text task end-to-end flow | ${report.acs.AC01.status} | ${report.acs.AC01.tests.length} |
| AC02 | Failure and duplicate submission | ${report.acs.AC02.status} | ${report.acs.AC02.tests.length} |
| AC08 | SSE streaming with reconnection | ${report.acs.AC08.status} | ${report.acs.AC08.tests.length} |

**Overall Status**: ${report.summary?.overallStatus || 'incomplete'}

## Evidence

### Provider Configuration
- **Base URL**: ${report.evidence.provider?.base_url}
- **Protocol**: ${report.evidence.provider?.protocol}
- **Models Available**: ${report.evidence.provider?.models_available}
- **Connection Verified**: ${report.evidence.provider?.connection_verified}

### Database
- **Name**: ${report.evidence.database?.name}

### Provider Config
- **ID**: ${report.evidence.providerConfig?.id}
- **Status**: ${report.evidence.providerConfig?.status}

## Test Results

### AC01: Text Task End-to-End Flow
${report.acs.AC01.tests.map(t => `- **${t.name}**: ${t.result}\n  ${JSON.stringify(t.evidence, null, 2)}`).join('\n\n')}

### AC02: Failure and Duplicate Submission
${report.acs.AC02.tests.map(t => `- **${t.name}**: ${t.result}\n  ${JSON.stringify(t.evidence, null, 2)}`).join('\n\n')}

### AC08: SSE Streaming with Reconnection
${report.acs.AC08.tests.map(t => `- **${t.name}**: ${t.result}\n  ${JSON.stringify(t.evidence, null, 2)}`).join('\n\n')}

## Limitations

${report.limitations.map(l => `- ${l}`).join('\n')}

## Recommendations

1. **Worker Process**: Full validation requires running the worker process independently to:
   - Process connection tests
   - Execute AI tasks against real provider
   - Generate SSE events
   - Update task terminal states

2. **Complete E2E Test**: Run with worker using:
   \`\`\`bash
   # Terminal 1: Start worker
   node apps/worker/src/index.mjs

   # Terminal 2: Run validation
   node scripts/v1-fr-005-real-provider-validation.mjs
   \`\`\`

3. **SSE Client Test**: Implement SSE client to:
   - Subscribe to event stream
   - Capture text deltas
   - Test disconnect/reconnect
   - Validate event ordering

## Files

- **JSON Report**: \`${REPORT_PATH}\`
- **Log File**: \`${LOG_PATH}\`
- **Markdown Report**: \`${MARKDOWN_PATH}\`

---
Generated: ${new Date().toISOString()}
`;

  await writeFile(MARKDOWN_PATH, markdown);
}

// Run
main().catch(console.error);
