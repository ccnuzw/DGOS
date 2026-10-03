// Main DGOS Client implementation

import { DGOSClientOptions } from './types/index.js';
import { HttpClient } from './http-client.js';
import { TasksAPI } from './api/tasks.js';
import { ProvidersAPI } from './api/providers.js';
import { PackagesAPI } from './api/packages.js';
import { IdentityAPI } from './api/identity.js';
import { ActionsAPI } from './api/actions.js';
import { SystemAPI } from './api/system.js';
import { ArtifactsAPI } from './api/artifacts.js';
import { AuditAPI } from './api/audit.js';

export class DGOSClient {
  private httpClient: HttpClient;

  public readonly tasks: TasksAPI;
  public readonly providers: ProvidersAPI;
  public readonly packages: PackagesAPI;
  public readonly identity: IdentityAPI;
  public readonly actions: ActionsAPI;
  public readonly system: SystemAPI;
  public readonly artifacts: ArtifactsAPI;
  public readonly audit: AuditAPI;

  constructor(options: DGOSClientOptions) {
    if (!options.baseUrl) {
      throw new Error('baseUrl is required');
    }

    this.httpClient = new HttpClient(options);

    // Initialize all API endpoints
    this.tasks = new TasksAPI(this.httpClient);
    this.providers = new ProvidersAPI(this.httpClient);
    this.packages = new PackagesAPI(this.httpClient);
    this.identity = new IdentityAPI(this.httpClient);
    this.actions = new ActionsAPI(this.httpClient);
    this.system = new SystemAPI(this.httpClient);
    this.artifacts = new ArtifactsAPI(this.httpClient);
    this.audit = new AuditAPI(this.httpClient);
  }

  /**
   * Create a client with API key authentication
   */
  static withApiKey(baseUrl: string, apiKey: string, options?: Partial<DGOSClientOptions>): DGOSClient {
    return new DGOSClient({
      baseUrl,
      apiKey,
      ...options,
    });
  }

  /**
   * Create a client with session authentication
   */
  static withSession(baseUrl: string, session: string, options?: Partial<DGOSClientOptions>): DGOSClient {
    return new DGOSClient({
      baseUrl,
      session,
      ...options,
    });
  }

  /**
   * Create a client without authentication (for public endpoints)
   */
  static anonymous(baseUrl: string, options?: Partial<DGOSClientOptions>): DGOSClient {
    return new DGOSClient({
      baseUrl,
      ...options,
    });
  }
}
