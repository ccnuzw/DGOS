// Identity API implementation

import { HttpClient } from '../http-client.js';
import { Session, ApiKey, CreateApiKeyRequest, CreateApiKeyResult } from '../types/index.js';

export class IdentityAPI {
  constructor(private client: HttpClient) {}

  /**
   * Get current session
   */
  async getCurrentSession(): Promise<Session> {
    return this.client.get<Session>('/api/v1/identity/session');
  }

  /**
   * Login with username and password
   */
  async login(username: string, password: string): Promise<Session> {
    return this.client.post<Session>('/api/v1/identity/login', {
      username,
      password,
    });
  }

  /**
   * Logout current session
   */
  async logout(): Promise<void> {
    await this.client.post('/api/v1/identity/logout');
  }

  /**
   * List API keys
   */
  async listApiKeys(): Promise<ApiKey[]> {
    return this.client.get<ApiKey[]>('/api/v1/secret/api-keys');
  }

  /**
   * Create a new API key
   */
  async createApiKey(request: CreateApiKeyRequest): Promise<CreateApiKeyResult> {
    return this.client.post<CreateApiKeyResult>('/api/v1/secret/api-keys', request);
  }

  /**
   * Rotate an API key
   */
  async rotateApiKey(
    keyId: string,
    options?: { baseVersion?: number; overlapUntil?: string }
  ): Promise<CreateApiKeyResult> {
    return this.client.post<CreateApiKeyResult>(`/api/v1/secret/api-keys/${keyId}/rotate`, options);
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string): Promise<void> {
    await this.client.delete(`/api/v1/secret/api-keys/${keyId}`);
  }
}
