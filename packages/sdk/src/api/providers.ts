// Providers API implementation

import { HttpClient } from '../http-client.js';
import {
  Provider,
  ProviderAccount,
  ProviderConfig,
  ConnectionTest,
  Model,
  ModelPolicy,
} from '../types/index.js';

export class ProvidersAPI {
  constructor(private client: HttpClient) {}

  /**
   * List all provider accounts
   */
  async listAccounts(): Promise<ProviderAccount[]> {
    return this.client.get<ProviderAccount[]>('/api/v1/provider/accounts');
  }

  /**
   * Create a new provider account
   */
  async createAccount(config: ProviderConfig): Promise<ProviderAccount> {
    return this.client.post<ProviderAccount>('/api/v1/provider/accounts', config);
  }

  /**
   * Update provider account state
   */
  async setAccountState(
    accountId: string,
    state: 'active' | 'disabled',
    baseVersion?: number
  ): Promise<ProviderAccount> {
    return this.client.post<ProviderAccount>(`/api/v1/provider/accounts/${accountId}/state`, {
      state,
      baseVersion,
    });
  }

  /**
   * Delete a provider account
   */
  async deleteAccount(accountId: string, baseVersion?: number): Promise<void> {
    await this.client.delete(`/api/v1/provider/accounts/${accountId}`, { baseVersion });
  }

  /**
   * Start a connection test
   */
  async testConnection(config: ProviderConfig): Promise<ConnectionTest> {
    return this.client.post<ConnectionTest>('/api/v1/provider/connection-tests', config);
  }

  /**
   * Get connection test result
   */
  async getConnectionTest(testId: string): Promise<ConnectionTest> {
    return this.client.get<ConnectionTest>(`/api/v1/provider/connection-tests/${testId}`);
  }

  /**
   * Cancel a connection test
   */
  async cancelConnectionTest(testId: string): Promise<void> {
    await this.client.delete(`/api/v1/provider/connection-tests/${testId}`);
  }

  /**
   * List all provider configurations
   */
  async listConfigs(): Promise<Provider[]> {
    return this.client.get<Provider[]>('/api/v1/provider/configs');
  }

  /**
   * Get a specific provider configuration
   */
  async getConfig(providerId: string): Promise<Provider> {
    return this.client.get<Provider>(`/api/v1/provider/configs/${providerId}`);
  }

  /**
   * Create a new provider configuration
   */
  async createConfig(config: ProviderConfig): Promise<Provider> {
    return this.client.post<Provider>('/api/v1/provider/configs', config);
  }

  /**
   * Update a provider configuration
   */
  async updateConfig(
    providerId: string,
    config: Partial<ProviderConfig> & { baseVersion?: number }
  ): Promise<Provider> {
    return this.client.put<Provider>(`/api/v1/provider/configs/${providerId}`, config);
  }

  /**
   * Delete a provider configuration
   */
  async deleteConfig(providerId: string): Promise<void> {
    await this.client.delete(`/api/v1/provider/configs/${providerId}`);
  }

  /**
   * Validate provider configuration
   */
  async validateConfig(providerId: string): Promise<{ valid: boolean; errors?: string[] }> {
    return this.client.post<{ valid: boolean; errors?: string[] }>(
      `/api/v1/provider/configs/${providerId}/validate`
    );
  }

  /**
   * List models for a provider
   */
  async listModels(providerId: string): Promise<Model[]> {
    return this.client.get<Model[]>(`/api/v1/provider/configs/${providerId}/models`);
  }

  /**
   * Refresh model catalog for a provider
   */
  async refreshCatalog(providerId: string): Promise<Model[]> {
    return this.client.post<Model[]>(`/api/v1/provider/configs/${providerId}/models`);
  }

  /**
   * Get model policies for a provider
   */
  async getPolicies(providerId: string): Promise<ModelPolicy[]> {
    return this.client.get<ModelPolicy[]>(`/api/v1/provider/configs/${providerId}/model-policies`);
  }

  /**
   * Update model policy for a provider
   */
  async updatePolicy(
    providerId: string,
    policy: { modelId: string; allowed: boolean; capabilities?: string[] }
  ): Promise<ModelPolicy> {
    return this.client.post<ModelPolicy>(
      `/api/v1/provider/configs/${providerId}/model-policies`,
      policy
    );
  }
}
