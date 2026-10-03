// Core types for Provider Adapter system

export type JSONSchema = Record<string, any>;

// Adapter types
export interface ProviderAdapter {
  adapterId: string;
  name: { en: string; zh: string };
  version: string;
  protocol: string; // 'openai-compatible', 'anthropic', 'gemini', 'custom'
  capabilities: AdapterCapability[];
  connectionSchema: JSONSchema;
  modelCatalogEndpoint?: string;
  authentication: AuthMethod[];
  executor: AdapterExecutor;
  metadata?: Record<string, any>;
}

export interface AdapterCapability {
  capability: string; // 'text.chat', 'image.generate', 'text.completion', etc.
  operations: Record<string, Operation>;
  workflows: Workflow[];
  modelProfiles?: ModelProfile[];
}

export interface Operation {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  bodyTemplate?: Record<string, any>;
  queryParams?: Record<string, any>;
  headers?: Record<string, string>;
  responseMapping: ResponseMapping;
  errorMapping?: ErrorMapping;
}

export interface ResponseMapping {
  taskId?: string; // JSONPath expression
  content?: string;
  finishReason?: string;
  usage?: UsageMapping;
  artifacts?: string;
  metadata?: string;
}

export interface UsageMapping {
  promptTokens?: string;
  completionTokens?: string;
  totalTokens?: string;
}

export interface ErrorMapping {
  code?: string;
  message?: string;
  retryable?: string;
}

export interface Workflow {
  name: string;
  type: 'sync' | 'async' | 'streaming';
  steps: WorkflowStep[];
  statusMapping: StatusMapping;
}

export interface WorkflowStep {
  operation: string;
  condition?: string;
  retryPolicy?: RetryPolicy;
}

export interface StatusMapping {
  pending?: string;
  running?: string;
  success?: string;
  failure?: string;
  cancelled?: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  retryableErrors?: string[];
}

export interface ModelProfile {
  modelId: string;
  capabilities: string[];
  limits: ModelLimits;
  pricing?: ModelPricing;
  features?: string[];
}

export interface ModelLimits {
  maxTokens?: number;
  contextWindow?: number;
  maxImages?: number;
  maxVideoDuration?: number;
  maxAudioDuration?: number;
}

export interface ModelPricing {
  inputTokenCost?: number;
  outputTokenCost?: number;
  imageCost?: number;
  videoCost?: number;
  audioCost?: number;
  currency?: string;
}

export type AuthMethod = 'bearer' | 'api-key' | 'oauth' | 'basic' | 'custom';

// Adapter Executor types
export interface AdapterExecutor {
  execute(request: AdapterRequest): Promise<AdapterResponse>;
  stream?(request: AdapterRequest): AsyncGenerator<AdapterEvent>;
  cancel?(taskId: string): Promise<void>;
  test(connection: ConnectionConfig): Promise<TestResult>;
}

export interface AdapterRequest {
  capability: string;
  operation?: string; // defaults to workflow's first operation
  model: string;
  connection: ConnectionConfig;
  parameters: Record<string, any>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ConnectionConfig {
  baseUrl: string;
  credential: any;
  headers?: Record<string, string>;
  scope?: Record<string, any>;
}

export interface AdapterResponse {
  taskId?: string;
  content?: string;
  finishReason?: string;
  usage?: UsageInfo;
  artifacts?: Artifact[];
  metadata?: Record<string, any>;
  rawResponse?: any;
}

export interface AdapterEvent {
  type: 'start' | 'delta' | 'usage' | 'artifact' | 'done' | 'error';
  data: any;
  timestamp: string;
}

export interface UsageInfo {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cost?: number;
}

export interface Artifact {
  artifactId: string;
  type: string;
  mimeType: string;
  size: number;
  url?: string;
  metadata?: Record<string, any>;
}

export interface TestResult {
  success: boolean;
  message?: string;
  details?: {
    responseTime?: number;
    modelsFound?: number;
    capabilities?: string[];
    errors?: string[];
  };
}

// Registry types
export interface AdapterFilters {
  protocol?: string;
  capability?: string;
  status?: AdapterStatus;
}

export type AdapterStatus = 'active' | 'deprecated' | 'disabled';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
}

// Provider Preset types
export interface ProviderPreset {
  presetId: string;
  name: { en: string; zh: string };
  logo?: string;
  adapterId: string;
  defaultBaseUrl: string;
  documentation?: string;
  authMethod: AuthMethod;
  popularModels?: string[];
  capabilities?: string[];
  tags?: string[];
  official?: boolean;
}

// Capability Protocol Declaration (JSON format)
export interface CapabilityProtocolDeclaration {
  schemaVersion: string; // 'dgos-capability/v1'
  kind: 'capability-protocol';
  adapterId: string;
  version: string;
  name: { en: string; zh: string };
  description?: { en: string; zh: string };
  capabilities: CapabilityDefinition[];
  authentication: AuthMethod[];
  connectionSchema: JSONSchema;
  modelProfiles?: ModelProfile[];
  metadata?: Record<string, any>;
}

export interface CapabilityDefinition {
  capability: string;
  operations: Record<string, Operation>;
  workflows: Workflow[];
}
