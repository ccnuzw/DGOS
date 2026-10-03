// Core types for DGOS SDK

export interface DGOSClientOptions {
  baseUrl: string;
  apiKey?: string;
  session?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

// Task types
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskRequest {
  prompt: string;
  model?: string;
  providerId?: string;
  parameters?: Record<string, any>;
  requestId?: string;
}

export interface Task {
  taskId: string;
  status: TaskStatus;
  request: TaskRequest;
  result?: TaskResult;
  error?: TaskError;
  ownerId: string;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

export interface TaskResult {
  text?: string;
  artifacts?: Artifact[];
  usage?: UsageInfo;
  metadata?: Record<string, any>;
}

export interface TaskError {
  code: string;
  message: string;
  details?: any;
}

export interface TaskEvent {
  sequence: number;
  type: string;
  data: any;
  timestamp: string;
}

export interface TaskFilters {
  status?: TaskStatus;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Artifact types
export interface Artifact {
  artifactId: string;
  type: string;
  mimeType: string;
  size: number;
  url?: string;
  metadata?: Record<string, any>;
}

// Usage types
export interface UsageInfo {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cost?: number;
}

// Provider types
export interface Provider {
  providerId: string;
  protocolType: string;
  displayName: string;
  state: 'active' | 'disabled' | 'error';
  ownerId: string;
  version: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ProviderAccount {
  accountId: string;
  protocolType: string;
  displayName: string;
  state: 'active' | 'disabled';
  ownerId: string;
  version: number;
  createdAt: string;
}

export interface ProviderConfig {
  protocolType: string;
  displayName: string;
  credential?: any;
  scope?: {
    endpoint?: string;
    [key: string]: any;
  };
  defaultForProtocol?: boolean;
  requestId?: string;
}

export interface ConnectionTest {
  testId: string;
  status: 'pending' | 'passed' | 'failed';
  result?: {
    success: boolean;
    message?: string;
    details?: any;
  };
  createdAt: string;
  completedAt?: string;
}

// Model types
export interface Model {
  modelId: string;
  providerId: string;
  displayName: string;
  capabilities: string[];
  contextWindow?: number;
  maxOutputTokens?: number;
  pricing?: {
    promptTokenCost?: number;
    completionTokenCost?: number;
  };
  metadata?: Record<string, any>;
}

export interface ModelPolicy {
  modelId: string;
  allowed: boolean;
  capabilities?: string[];
}

// Package types
export interface Package {
  packageId: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  repository?: string;
  homepage?: string;
  installed: boolean;
  installVersion?: string;
}

export interface Installation {
  installId: string;
  packageId: string;
  version: string;
  status: 'installing' | 'installed' | 'failed';
  installedAt?: string;
}

// Action types
export interface Action {
  actionId: string;
  name: string;
  description?: string;
  parameters?: ActionParameter[];
  scope?: string;
}

export interface ActionParameter {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  default?: any;
}

export interface ActionResult {
  success: boolean;
  result?: any;
  error?: string;
}

export interface ActionRun {
  runId: string;
  actionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

// Identity types
export interface Session {
  sessionId: string;
  principalId: string;
  createdAt: string;
  expiresAt: string;
  lastActivity?: string;
}

export interface ApiKey {
  keyId: string;
  label?: string;
  prefix: string;
  scopes: string[];
  ownerId: string;
  createdAt: string;
  expiresAt?: string;
  lastUsed?: string;
}

export interface CreateApiKeyRequest {
  label?: string;
  scopes: string[];
  expiresAt?: string;
}

export interface CreateApiKeyResult extends ApiKey {
  secret: string;
}

// Audit types
export interface AuditEvent {
  eventId: string;
  timestamp: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  result: 'success' | 'denied' | 'error';
  summary?: Record<string, any>;
}

export interface AuditFilters {
  actorId?: string;
  action?: string;
  targetType?: string;
  startTime?: string;
  endTime?: string;
  page?: number;
  pageSize?: number;
}

// System types
export interface SystemInfo {
  version: string;
  apiVersion: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: string;
}

export interface SystemSettings {
  [key: string]: any;
}

// Pagination types
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CursorResult<T> {
  items: T[];
  cursor?: string;
  hasMore: boolean;
}

// Webhook types
export interface Webhook {
  webhookId: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: string;
}

export interface WebhookConfig {
  url: string;
  events: string[];
  secret: string;
}

// Batch types
export interface BatchOptions {
  concurrency?: number;
  onProgress?: (completed: number, total: number) => void;
}

// Retry types
export interface RetryOptions {
  maxRetries: number;
  retryDelay: number;
  retryableStatuses: number[];
}
