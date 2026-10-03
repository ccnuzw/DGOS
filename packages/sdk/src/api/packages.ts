// Packages API implementation

import { HttpClient } from '../http-client.js';
import { Package, Installation } from '../types/index.js';

export class PackagesAPI {
  constructor(private client: HttpClient) {}

  /**
   * List all available packages
   */
  async list(): Promise<Package[]> {
    return this.client.get<Package[]>('/api/v1/apps');
  }

  /**
   * Get a specific package
   */
  async get(packageId: string): Promise<Package> {
    return this.client.get<Package>(`/api/v1/apps/${packageId}`);
  }

  /**
   * Install a package
   */
  async install(packageId: string, version?: string): Promise<Installation> {
    return this.client.post<Installation>(`/api/v1/apps/${packageId}/install`, {
      version,
    });
  }

  /**
   * Uninstall a package
   */
  async uninstall(packageId: string): Promise<void> {
    await this.client.delete(`/api/v1/apps/${packageId}/install`);
  }

  /**
   * Update a package to a specific version
   */
  async update(packageId: string, version: string): Promise<Installation> {
    return this.client.post<Installation>(`/api/v1/apps/${packageId}/install`, {
      version,
    });
  }

  /**
   * Get installation status
   */
  async getInstallation(packageId: string): Promise<Installation> {
    return this.client.get<Installation>(`/api/v1/apps/${packageId}/install`);
  }
}
