// OpenAI Compatible Adapter Executor

import { BaseAdapterExecutor } from './base.js';
import type {
  AdapterRequest,
  AdapterResponse,
  AdapterEvent,
  ConnectionConfig,
  TestResult,
  Operation,
} from '../types.js';

export class OpenAICompatibleExecutor extends BaseAdapterExecutor {
  constructor(private operations: Record<string, Operation>) {
    super();
  }

  async execute(request: AdapterRequest): Promise<AdapterResponse> {
    const operation = this.getOperation(request);

    // Build request body from template
    const body = this.renderTemplate(operation.bodyTemplate || {}, {
      model: request.model,
      messages: request.parameters.messages,
      prompt: request.parameters.prompt,
      stream: false,
      ...request.parameters,
    });

    // Build URL
    const url = this.buildUrl(
      request.connection.baseUrl,
      operation.path,
      operation.queryParams
    );

    // Execute request
    const response = await this.executeRequest(
      url,
      {
        method: operation.method,
        headers: this.buildHeaders(request.connection, operation.headers),
        body: JSON.stringify(body),
      },
      request.timeoutMs
    );

    if (!response.ok) {
      throw await this.parseError(response);
    }

    const rawResponse = await response.json();
    const mapped = this.mapResponse(rawResponse, operation.responseMapping);

    return {
      ...mapped,
      rawResponse,
    };
  }

  async *stream(request: AdapterRequest): AsyncGenerator<AdapterEvent> {
    const operation = this.getOperation(request);

    const body = this.renderTemplate(operation.bodyTemplate || {}, {
      model: request.model,
      messages: request.parameters.messages,
      stream: true,
      ...request.parameters,
    });

    const url = this.buildUrl(
      request.connection.baseUrl,
      operation.path,
      operation.queryParams
    );

    const response = await this.executeRequest(
      url,
      {
        method: operation.method,
        headers: this.buildHeaders(request.connection, operation.headers),
        body: JSON.stringify(body),
      },
      request.timeoutMs
    );

    if (!response.ok) {
      throw await this.parseError(response);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();

            if (data === '[DONE]') {
              yield {
                type: 'done',
                data: null,
                timestamp: new Date().toISOString(),
              };
              return;
            }

            try {
              const parsed = JSON.parse(data);

              // Map to AdapterEvent
              if (parsed.choices?.[0]?.delta?.content) {
                yield {
                  type: 'delta',
                  data: { content: parsed.choices[0].delta.content },
                  timestamp: new Date().toISOString(),
                };
              }

              if (parsed.usage) {
                yield {
                  type: 'usage',
                  data: parsed.usage,
                  timestamp: new Date().toISOString(),
                };
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async test(connection: ConnectionConfig): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Try to list models
      const url = this.buildUrl(connection.baseUrl, '/models');
      const response = await this.executeRequest(
        url,
        {
          method: 'GET',
          headers: this.buildHeaders(connection),
        },
        10000 // 10 second timeout for tests
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            message: 'Authentication failed. Please check your API key.',
            details: { errors: ['AUTHENTICATION_FAILED'] },
          };
        }

        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`,
          details: { errors: [`HTTP_${response.status}`] },
        };
      }

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      // Validate response structure
      if (!data.data || !Array.isArray(data.data)) {
        return {
          success: false,
          message: 'Invalid response format - expected OpenAI-compatible API',
          details: { errors: ['INVALID_RESPONSE_FORMAT'] },
        };
      }

      const models = data.data.map((m: any) => m.id).filter(Boolean);

      return {
        success: true,
        message: `Connected successfully. Found ${models.length} models.`,
        details: {
          responseTime,
          modelsFound: models.length,
          capabilities: ['text.chat', 'text.completion'],
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Connection failed',
        details: {
          errors: [error.code || 'UNKNOWN_ERROR'],
        },
      };
    }
  }

  private getOperation(request: AdapterRequest): Operation {
    const operationName = request.operation || 'submit';
    const operation = this.operations[operationName];

    if (!operation) {
      throw new Error(`Operation '${operationName}' not found`);
    }

    return operation;
  }
}
