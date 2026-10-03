// Artifacts API implementation

import { HttpClient } from '../http-client.js';
import { Artifact } from '../types/index.js';

export class ArtifactsAPI {
  constructor(private client: HttpClient) {}

  /**
   * Get an artifact by ID
   */
  async get(artifactId: string): Promise<Artifact> {
    return this.client.get<Artifact>(`/api/v1/artifacts/${artifactId}`);
  }

  /**
   * Download artifact content
   */
  async download(artifactId: string): Promise<Blob> {
    const artifact = await this.get(artifactId);

    if (!artifact.url) {
      throw new Error('Artifact does not have a download URL');
    }

    const response = await fetch(artifact.url);
    if (!response.ok) {
      throw new Error(`Failed to download artifact: ${response.statusText}`);
    }

    return response.blob();
  }
}
