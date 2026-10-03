// Audit API implementation

import { HttpClient } from '../http-client.js';
import { AuditEvent, AuditFilters, PaginatedResult } from '../types/index.js';

export class AuditAPI {
  constructor(private client: HttpClient) {}

  /**
   * List audit events with filters
   */
  async list(filters?: AuditFilters): Promise<PaginatedResult<AuditEvent>> {
    const query = new URLSearchParams();

    if (filters?.actorId) query.append('actorId', filters.actorId);
    if (filters?.action) query.append('action', filters.action);
    if (filters?.targetType) query.append('targetType', filters.targetType);
    if (filters?.startTime) query.append('startTime', filters.startTime);
    if (filters?.endTime) query.append('endTime', filters.endTime);
    if (filters?.page) query.append('page', filters.page.toString());
    if (filters?.pageSize) query.append('pageSize', filters.pageSize.toString());

    const queryString = query.toString();
    const path = queryString ? `/api/v1/audit/events?${queryString}` : '/api/v1/audit/events';

    return this.client.get<PaginatedResult<AuditEvent>>(path);
  }

  /**
   * Get a specific audit event
   */
  async get(eventId: string): Promise<AuditEvent> {
    return this.client.get<AuditEvent>(`/api/v1/audit/events/${eventId}`);
  }

  /**
   * Export audit events
   */
  async export(filters?: AuditFilters): Promise<Blob> {
    const query = new URLSearchParams();

    if (filters?.actorId) query.append('actorId', filters.actorId);
    if (filters?.action) query.append('action', filters.action);
    if (filters?.targetType) query.append('targetType', filters.targetType);
    if (filters?.startTime) query.append('startTime', filters.startTime);
    if (filters?.endTime) query.append('endTime', filters.endTime);

    const queryString = query.toString();
    const path = queryString ? `/api/v1/audit/export?${queryString}` : '/api/v1/audit/export';

    const response = await fetch(`${this.getBaseUrl()}${path}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to export audit events: ${response.statusText}`);
    }

    return response.blob();
  }

  private getBaseUrl(): string {
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
