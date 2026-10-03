// Base Adapter Executor - provides common functionality for all executors

import type {
  AdapterExecutor,
  AdapterRequest,
  AdapterResponse,
  AdapterEvent,
  ConnectionConfig,
  TestResult,
  Operation,
  ResponseMapping,
} from '../types.js';

/**
 * Base executor class with common utilities
 */
export abstract class BaseAdapterExecutor implements AdapterExecutor {
  abstract execute(request: AdapterRequest): Promise<AdapterResponse>;
  abstract test(connection: ConnectionConfig): Promise<TestResult>;

  /**
   * Render a template with variables
   */
  protected renderTemplate(
    template: Record<string, any>,
    variables: Record<string, any>
  ): Record<string, any> {
    const rendered: Record<string, any> = {};

    for (const [key, value] of Object.entries(template)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        // Variable substitution
        const varName = value.slice(2, -2).trim();
        rendered[key] = variables[varName];
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursive rendering for nested objects
        rendered[key] = this.renderTemplate(value, variables);
      } else {
        rendered[key] = value;
      }
    }

    return rendered;
  }

  /**
   * Extract value from response using JSONPath-like expression
   */
  protected extractValue(data: any, path?: string): any {
    if (!path) return undefined;

    // Simple JSONPath implementation
    // Supports: $.field, $.nested.field, $.array[0], $.array[*]
    if (!path.startsWith('$.')) {
      return undefined;
    }

    const parts = path.slice(2).split('.');
    let current = data;

    for (const part of parts) {
      if (current == null) return undefined;

      // Handle array access
      const arrayMatch = part.match(/^(\w+)\[(\d+|\*)\]$/);
      if (arrayMatch) {
        const [, field, index] = arrayMatch;
        current = current[field];
        if (!Array.isArray(current)) return undefined;
        if (index === '*') return current;
        current = current[parseInt(index, 10)];
      } else {
        current = current[part];
      }
    }

    return current;
  }

  /**
   * Map API response to AdapterResponse using response mapping
   */
  protected mapResponse(
    rawResponse: any,
    mapping: ResponseMapping
  ): Omit<AdapterResponse, 'rawResponse'> {
    return {
      taskId: this.extractValue(rawResponse, mapping.taskId),
      content: this.extractValue(rawResponse, mapping.content),
      finishReason: this.extractValue(rawResponse, mapping.finishReason),
      usage: mapping.usage ? {
        promptTokens: this.extractValue(rawResponse, mapping.usage.promptTokens),
        completionTokens: this.extractValue(rawResponse, mapping.usage.completionTokens),
        totalTokens: this.extractValue(rawResponse, mapping.usage.totalTokens),
      } : undefined,
      artifacts: this.extractValue(rawResponse, mapping.artifacts),
      metadata: this.extractValue(rawResponse, mapping.metadata),
    };
  }

  /**
   * Build HTTP headers from connection config
   */
  protected buildHeaders(
    connection: ConnectionConfig,
    additionalHeaders?: Record<string, string>
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...connection.headers,
      ...additionalHeaders,
    };

    // Add authentication header based on credential type
    if (connection.credential) {
      if (typeof connection.credential === 'string') {
        headers['Authorization'] = `Bearer ${connection.credential}`;
      } else if (connection.credential.type === 'bearer') {
        headers['Authorization'] = `Bearer ${connection.credential.token}`;
      } else if (connection.credential.type === 'api-key') {
        headers[connection.credential.headerName || 'X-API-Key'] = connection.credential.key;
      }
    }

    return headers;
  }

  /**
   * Build full URL with query parameters
   */
  protected buildUrl(
    baseUrl: string,
    path: string,
    queryParams?: Record<string, any>
  ): string {
    const url = new URL(path, baseUrl.replace(/\/$/, ''));

    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  /**
   * Execute HTTP request with timeout and error handling
   */
  protected async executeRequest(
    url: string,
    options: RequestInit,
    timeoutMs: number = 60000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse error from API response
   */
  protected async parseError(response: Response): Promise<Error> {
    let message = `HTTP ${response.status}: ${response.statusText}`;

    try {
      const body = await response.json();
      if (body.error?.message) {
        message = body.error.message;
      } else if (body.message) {
        message = body.message;
      }
    } catch {
      // Failed to parse error body
    }

    const error = new Error(message);
    (error as any).statusCode = response.status;
    return error;
  }
}
