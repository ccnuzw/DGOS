// System API implementation

import { HttpClient } from '../http-client.js';
import { SystemInfo, SystemSettings } from '../types/index.js';

export class SystemAPI {
  constructor(private client: HttpClient) {}

  /**
   * Get system information
   */
  async info(): Promise<SystemInfo> {
    return this.client.get<SystemInfo>('/api/v1/system/info');
  }

  /**
   * Get system health status
   */
  async health(): Promise<{ status: string; checks: Record<string, any> }> {
    return this.client.get<{ status: string; checks: Record<string, any> }>(
      '/api/v1/system/health'
    );
  }

  /**
   * Get system settings
   */
  async getSettings(): Promise<SystemSettings> {
    return this.client.get<SystemSettings>('/api/v1/system/settings');
  }

  /**
   * Update system settings
   */
  async updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    return this.client.put<SystemSettings>('/api/v1/system/settings', settings);
  }

  /**
   * Get system context
   */
  async getContext(): Promise<Record<string, any>> {
    return this.client.get<Record<string, any>>('/api/v1/system/context');
  }
}
