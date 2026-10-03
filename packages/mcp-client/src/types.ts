/**
 * MCP (Model Context Protocol) Type Definitions
 * Based on MCP specification and FR-003 requirements
 */

export type TransportType = 'stdio' | 'sse' | 'websocket';
export type AuthenticationType = 'none' | 'bearer' | 'api-key';
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'failed'
  | 'stopped'
  | 'needs-credentials';

export interface LocalizedString {
  en: string;
  zh: string;
}

export interface MCPServerConfig {
  serverId: string;
  name: LocalizedString;
  description: LocalizedString;
  version: string;

  // Connection configuration
  connection: {
    type: TransportType;
    command?: string; // for stdio
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
    url?: string; // for sse/websocket
  };

  // Authentication
  authentication?: {
    type: AuthenticationType;
    credentialsRef?: string; // Reference to secret, not the secret itself
  };

  // Capabilities declaration
  capabilities: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
    sampling?: boolean;
  };

  // Permissions required
  permissions: string[];

  // Configuration parameters
  parameters?: Record<string, unknown>;

  // Metadata
  icon?: string;
  author?: string;
  homepage?: string;
  tags?: string[];

  // State tracking
  state?: 'enabled' | 'disabled';
  connectionState?: ConnectionState;
  stateVersion?: number;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

export interface JSONSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

export interface ToolCallParams {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  content: ContentItem[];
  isError?: boolean;
}

export interface ContentItem {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
}

export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface ResourceReadParams {
  uri: string;
}

export interface ResourceContent {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
}

export interface Prompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface PromptGetParams {
  name: string;
  arguments?: Record<string, string>;
}

export interface PromptMessage {
  role: 'user' | 'assistant';
  content: ContentItem;
}

export interface SamplingOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  metadata?: Record<string, unknown>;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: ContentItem;
}

export interface SamplingResult {
  role: 'assistant';
  content: ContentItem;
  model?: string;
  stopReason?: string;
}

export interface ServerStatus {
  serverId: string;
  state: 'enabled' | 'disabled';
  connectionState: ConnectionState;
  toolCount?: number;
  lastConnected?: string;
  error?: string;
}

export interface InitializeParams {
  protocolVersion: string;
  capabilities: {
    roots?: { listChanged?: boolean };
    sampling?: object;
  };
  clientInfo: {
    name: string;
    version: string;
  };
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: {
    tools?: object;
    resources?: { subscribe?: boolean; listChanged?: boolean };
    prompts?: { listChanged?: boolean };
    logging?: object;
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface SubscribeParams {
  uri: string;
}

export interface UnsubscribeParams {
  uri: string;
}

export interface UpdatedParams {
  uri: string;
}

export interface CreateMessageParams {
  messages: Message[];
  modelPreferences?: {
    hints?: Array<{ name?: string }>;
    costPriority?: number;
    speedPriority?: number;
    intelligencePriority?: number;
  };
  systemPrompt?: string;
  includeContext?: 'none' | 'thisServer' | 'allServers';
  temperature?: number;
  maxTokens: number;
  stopSequences?: string[];
  metadata?: Record<string, unknown>;
}

export interface CreateMessageResult {
  role: 'assistant';
  content: ContentItem;
  model: string;
  stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens';
}

export interface MCPConnection {
  serverId: string;
  status: ConnectionState;
  disconnect(): Promise<void>;
  listTools(): Promise<Tool[]>;
  callTool(params: ToolCallParams): Promise<ToolResult>;
  listResources(): Promise<Resource[]>;
  readResource(params: ResourceReadParams): Promise<ResourceContent>;
  listPrompts(): Promise<Prompt[]>;
  getPrompt(params: PromptGetParams): Promise<PromptMessage[]>;
  sample(messages: Message[], options: SamplingOptions): Promise<SamplingResult>;
  ping(): Promise<boolean>;
}

export interface MCPCallLog {
  timestamp: string;
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  result: unknown;
  duration: number;
  success: boolean;
  error?: string;
  requestId: string;
}

export interface MCPServerPreset {
  id: string;
  name: LocalizedString;
  description: LocalizedString;
  category: string;
  config: Omit<MCPServerConfig, 'serverId'>;
  requiresCredentials: boolean;
  credentialFields?: Array<{
    key: string;
    label: LocalizedString;
    type: 'text' | 'password' | 'url';
    required: boolean;
    placeholder?: string;
  }>;
}
