// Tasks API implementation

import { HttpClient } from '../http-client.js';
import { Task, TaskRequest, TaskFilters, TaskEvent } from '../types/index.js';

export class TasksAPI {
  constructor(private client: HttpClient) {}

  /**
   * Create a new AI task
   */
  async create(request: TaskRequest): Promise<Task> {
    return this.client.post<Task>('/api/v1/ai-tasks', request);
  }

  /**
   * Get a task by ID
   */
  async get(taskId: string): Promise<Task> {
    return this.client.get<Task>(`/api/v1/ai-tasks/${taskId}`);
  }

  /**
   * List tasks with optional filters
   */
  async list(filters?: TaskFilters): Promise<Task[]> {
    const query = new URLSearchParams();

    if (filters?.status) query.append('status', filters.status);
    if (filters?.page) query.append('page', filters.page.toString());
    if (filters?.pageSize) query.append('pageSize', filters.pageSize.toString());
    if (filters?.sortBy) query.append('sortBy', filters.sortBy);
    if (filters?.sortOrder) query.append('sortOrder', filters.sortOrder);

    const queryString = query.toString();
    const path = queryString ? `/api/v1/ai-tasks?${queryString}` : '/api/v1/ai-tasks';

    return this.client.get<Task[]>(path);
  }

  /**
   * Cancel a running task
   */
  async cancel(taskId: string): Promise<void> {
    await this.client.delete(`/api/v1/ai-tasks/${taskId}`);
  }

  /**
   * Stream task events (Server-Sent Events)
   */
  async *stream(taskId: string): AsyncGenerator<TaskEvent> {
    const response = await fetch(`${this.getBaseUrl()}/api/v1/ai-tasks/${taskId}/events`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to stream events: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventData: Partial<TaskEvent> = {};

        for (const line of lines) {
          if (line.startsWith('id:')) {
            eventData.sequence = parseInt(line.slice(3).trim());
          } else if (line.startsWith('event:')) {
            eventData.type = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            try {
              const parsed = JSON.parse(data);
              eventData = { ...eventData, ...parsed };
            } catch {
              // Ignore parse errors
            }
          } else if (line === '') {
            // Empty line signals end of event
            if (eventData.type && eventData.sequence !== undefined) {
              yield eventData as TaskEvent;
              eventData = {};
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Wait for a task to complete
   */
  async waitFor(taskId: string, timeout: number = 60000): Promise<Task> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const task = await this.get(taskId);

      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        return task;
      }

      // Poll every 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Task ${taskId} did not complete within ${timeout}ms`);
  }

  private getBaseUrl(): string {
    // Access baseUrl through the client (we'll need to expose this)
    return (this.client as any).baseUrl;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    const apiKey = (this.client as any).apiKey;
    const session = (this.client as any).session;

    if (apiKey) {
      headers['authorization'] = `ApiKey ${apiKey}`;
    } else if (session) {
      headers['cookie'] = `dgos_session=${session}`;
    }

    return headers;
  }
}
