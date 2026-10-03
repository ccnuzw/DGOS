// Testing utilities for adapters

import type {
  ProviderAdapter,
  AdapterRequest,
  ConnectionConfig,
  TestResult,
} from '../types.js';

/**
 * Contract test suite for adapter validation
 */
export class AdapterContractTests {
  constructor(private adapter: ProviderAdapter) {}

  /**
   * Run all contract tests
   */
  async runAll(connection: ConnectionConfig): Promise<ContractTestResults> {
    const results: ContractTestResults = {
      adapter: this.adapter.adapterId,
      passed: 0,
      failed: 0,
      tests: [],
    };

    // Test 1: Connection test
    try {
      const testResult = await this.adapter.executor.test(connection);
      results.tests.push({
        name: 'Connection Test',
        passed: testResult.success,
        message: testResult.message,
        details: testResult.details,
      });
      if (testResult.success) results.passed++;
      else results.failed++;
    } catch (error: any) {
      results.tests.push({
        name: 'Connection Test',
        passed: false,
        message: error.message,
      });
      results.failed++;
    }

    // Test 2: Execute capability test
    for (const capability of this.adapter.capabilities) {
      const testName = `Execute ${capability.capability}`;
      try {
        // Create a simple test request
        const request = this.createTestRequest(capability.capability, connection);
        const response = await this.adapter.executor.execute(request);

        const passed = response.content !== undefined || response.taskId !== undefined;
        results.tests.push({
          name: testName,
          passed,
          message: passed ? 'Capability executed successfully' : 'No content or taskId returned',
          details: { response },
        });
        if (passed) results.passed++;
        else results.failed++;
      } catch (error: any) {
        results.tests.push({
          name: testName,
          passed: false,
          message: error.message,
        });
        results.failed++;
      }
    }

    // Test 3: Streaming test (if supported)
    if (this.adapter.executor.stream) {
      try {
        const streamCapability = this.adapter.capabilities.find(c =>
          c.workflows.some(w => w.type === 'streaming')
        );
        if (streamCapability) {
          const request = this.createTestRequest(streamCapability.capability, connection);
          const events: any[] = [];

          for await (const event of this.adapter.executor.stream(request)) {
            events.push(event);
            if (events.length > 5) break; // Limit test events
          }

          const passed = events.length > 0;
          results.tests.push({
            name: 'Streaming Test',
            passed,
            message: passed ? `Received ${events.length} events` : 'No events received',
            details: { eventCount: events.length },
          });
          if (passed) results.passed++;
          else results.failed++;
        }
      } catch (error: any) {
        results.tests.push({
          name: 'Streaming Test',
          passed: false,
          message: error.message,
        });
        results.failed++;
      }
    }

    return results;
  }

  /**
   * Create a test request for a capability
   */
  private createTestRequest(capability: string, connection: ConnectionConfig): AdapterRequest {
    const testMessages = [
      { role: 'user', content: 'Hello, this is a test message.' },
    ];

    return {
      capability,
      model: 'test-model',
      connection,
      parameters: {
        messages: testMessages,
        prompt: 'Test prompt',
        max_tokens: 10,
      },
      timeoutMs: 30000,
    };
  }
}

export interface ContractTestResults {
  adapter: string;
  passed: number;
  failed: number;
  tests: ContractTestResult[];
}

export interface ContractTestResult {
  name: string;
  passed: boolean;
  message?: string;
  details?: any;
}

/**
 * Mock connection config for testing
 */
export function createMockConnection(overrides?: Partial<ConnectionConfig>): ConnectionConfig {
  return {
    baseUrl: 'https://api.example.com/v1',
    credential: 'test-api-key',
    ...overrides,
  };
}

/**
 * Validate adapter against schema
 */
export async function validateAdapter(adapter: ProviderAdapter): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // Basic validation
  if (!adapter.adapterId) errors.push('adapterId is required');
  if (!adapter.name?.en) errors.push('name.en is required');
  if (!adapter.version) errors.push('version is required');
  if (!adapter.protocol) errors.push('protocol is required');
  if (!adapter.capabilities?.length) errors.push('At least one capability is required');
  if (!adapter.executor) errors.push('executor is required');

  // Validate executor interface
  if (adapter.executor) {
    if (typeof adapter.executor.execute !== 'function') {
      errors.push('executor.execute must be a function');
    }
    if (typeof adapter.executor.test !== 'function') {
      errors.push('executor.test must be a function');
    }
  }

  // Validate capabilities
  adapter.capabilities?.forEach((cap, idx) => {
    if (!cap.capability) {
      errors.push(`capabilities[${idx}].capability is required`);
    }
    if (!cap.operations || Object.keys(cap.operations).length === 0) {
      errors.push(`capabilities[${idx}].operations must have at least one operation`);
    }
    if (!cap.workflows || cap.workflows.length === 0) {
      errors.push(`capabilities[${idx}].workflows must have at least one workflow`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
