// Actions API implementation

import { HttpClient } from '../http-client.js';
import { Action, ActionResult, ActionRun } from '../types/index.js';

export class ActionsAPI {
  constructor(private client: HttpClient) {}

  /**
   * List all available actions
   */
  async list(): Promise<Action[]> {
    return this.client.get<Action[]>('/api/v1/actions');
  }

  /**
   * Get a specific action
   */
  async get(actionId: string): Promise<Action> {
    return this.client.get<Action>(`/api/v1/actions/${actionId}`);
  }

  /**
   * Execute an action
   */
  async execute(actionId: string, parameters?: Record<string, any>): Promise<ActionRun> {
    return this.client.post<ActionRun>(`/api/v1/actions/${actionId}/execute`, {
      parameters,
    });
  }

  /**
   * Get action run status
   */
  async getRun(runId: string): Promise<ActionRun> {
    return this.client.get<ActionRun>(`/api/v1/actions/runs/${runId}`);
  }

  /**
   * Cancel an action run
   */
  async cancelRun(runId: string): Promise<void> {
    await this.client.delete(`/api/v1/actions/runs/${runId}`);
  }
}
