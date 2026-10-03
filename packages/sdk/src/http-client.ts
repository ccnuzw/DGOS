// HTTP client with retry logic

import { DGOSClientOptions, RetryOptions } from './types/index.js';
import { createErrorFromResponse, NetworkError, TimeoutError } from './errors.js';

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
}

export class HttpClient {
  private baseUrl: string;
  private apiKey?: string;
  private session?: string;
  private timeout: number;
  private retryOptions: RetryOptions;

  constructor(options: DGOSClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.session = options.session;
    this.timeout = options.timeout ?? 30000;
    this.retryOptions = {
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      retryableStatuses: [429, 503, 504],
    };
  }

  async request<T>(options: RequestOptions): Promise<T> {
    const { method, path, body, headers = {}, timeout = this.timeout } = options;
    const url = `${this.baseUrl}${path}`;

    // Set up headers
    const requestHeaders: Record<string, string> = {
      'content-type': 'application/json',
      ...headers,
    };

    // Add authentication
    if (this.apiKey) {
      requestHeaders['authorization'] = `ApiKey ${this.apiKey}`;
    } else if (this.session) {
      requestHeaders['cookie'] = `dgos_session=${this.session}`;
      requestHeaders['x-dgos-csrf'] = '1';
    }

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= this.retryOptions.maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle response
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error = createErrorFromResponse(errorData, response.status);

          // Retry on retryable status codes
          if (
            attempt < this.retryOptions.maxRetries &&
            this.retryOptions.retryableStatuses.includes(response.status)
          ) {
            lastError = error;
            attempt++;
            await this.sleep(this.retryOptions.retryDelay * attempt);
            continue;
          }

          throw error;
        }

        // Parse response
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return (await response.json()) as T;
        } else if (response.status === 204) {
          return undefined as T;
        } else {
          return (await response.text()) as any as T;
        }
      } catch (error: any) {
        // Handle network errors
        if (error.name === 'AbortError') {
          throw new TimeoutError('Request timed out');
        }

        // If it's already a DGOS error, throw it
        if (error.name?.includes('Error') && error.statusCode) {
          if (
            attempt < this.retryOptions.maxRetries &&
            this.retryOptions.retryableStatuses.includes(error.statusCode)
          ) {
            lastError = error;
            attempt++;
            await this.sleep(this.retryOptions.retryDelay * attempt);
            continue;
          }
          throw error;
        }

        // Network error
        lastError = new NetworkError(error.message || 'Network request failed', { cause: error });
        attempt++;

        if (attempt <= this.retryOptions.maxRetries) {
          await this.sleep(this.retryOptions.retryDelay * attempt);
          continue;
        }

        throw lastError;
      }
    }

    throw lastError || new NetworkError('Request failed after retries');
  }

  async get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ method: 'GET', path, headers });
  }

  async post<T>(path: string, body?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ method: 'POST', path, body, headers });
  }

  async put<T>(path: string, body?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ method: 'PUT', path, body, headers });
  }

  async delete<T>(path: string, body?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ method: 'DELETE', path, body, headers });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
