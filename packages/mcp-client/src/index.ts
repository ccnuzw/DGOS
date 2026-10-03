/**
 * MCP Client Implementation
 * Provides comprehensive MCP protocol client with connection management,
 * tool invocation, resource access, and prompt handling.
 */

import type {
  MCPServerConfig,
  MCPConnection,
  Tool,
  ToolCallParams,
  ToolResult,
  Resource,
  ResourceReadParams,
  ResourceContent,
  Prompt,
  PromptGetParams,
  PromptMessage,
  Message,
  SamplingOptions,
  SamplingResult,
  ServerStatus,
  ConnectionState,
  InitializeParams,
  InitializeResult,
} from './types.ts';

export class MCPClient {
  private connections: Map<string, MCPConnection> = new Map();
  private logger?: Console;

  constructor(options?: { logger?: Console }) {
    this.logger = options?.logger;
  }

  /**
   * Connect to an MCP server
   */
  async connect(config: MCPServerConfig): Promise<MCPConnection> {
    const existing = this.connections.get(config.serverId);
    if (existing && (await this.ping(config.serverId))) {
      return existing;
    }

    this.log('info', `Connecting to MCP server: ${config.serverId}`);

    const connection = await this.createConnection(config);
    this.connections.set(config.serverId, connection);

    return connection;
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnect(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`Server not connected: ${serverId}`);
    }

    await connection.disconnect();
    this.connections.delete(serverId);
    this.log('info', `Disconnected from MCP server: ${serverId}`);
  }

  /**
   * List all tools from a connected server
   */
  async listTools(serverId: string): Promise<Tool[]> {
    const connection = this.getConnection(serverId);
    return connection.listTools();
  }

  /**
   * Call a tool on an MCP server
   */
  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const connection = this.getConnection(serverId);
    return connection.callTool({ name: toolName, arguments: args });
  }

  /**
   * List all resources from a connected server
   */
  async listResources(serverId: string): Promise<Resource[]> {
    const connection = this.getConnection(serverId);
    return connection.listResources();
  }

  /**
   * Read a resource from an MCP server
   */
  async readResource(serverId: string, uri: string): Promise<ResourceContent> {
    const connection = this.getConnection(serverId);
    return connection.readResource({ uri });
  }

  /**
   * List all prompts from a connected server
   */
  async listPrompts(serverId: string): Promise<Prompt[]> {
    const connection = this.getConnection(serverId);
    return connection.listPrompts();
  }

  /**
   * Get a prompt from an MCP server
   */
  async getPrompt(
    serverId: string,
    promptName: string,
    args?: Record<string, string>
  ): Promise<PromptMessage[]> {
    const connection = this.getConnection(serverId);
    return connection.getPrompt({ name: promptName, arguments: args });
  }

  /**
   * Request sampling (LLM completion) from an MCP server
   */
  async sample(
    serverId: string,
    messages: Message[],
    options: SamplingOptions
  ): Promise<SamplingResult> {
    const connection = this.getConnection(serverId);
    return connection.sample(messages, options);
  }

  /**
   * Get status of an MCP server
   */
  async getStatus(serverId: string): Promise<ServerStatus> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return {
        serverId,
        state: 'disabled',
        connectionState: 'disconnected',
      };
    }

    const isAlive = await connection.ping().catch(() => false);
    return {
      serverId,
      state: 'enabled',
      connectionState: isAlive ? 'connected' : 'failed',
    };
  }

  /**
   * Ping an MCP server to check if it's alive
   */
  async ping(serverId: string): Promise<boolean> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return false;
    }
    return connection.ping().catch(() => false);
  }

  /**
   * Get all connected server IDs
   */
  getConnectedServers(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Disconnect all servers
   */
  async disconnectAll(): Promise<void> {
    const serverIds = this.getConnectedServers();
    await Promise.allSettled(serverIds.map((id) => this.disconnect(id)));
  }

  // Private helpers

  private getConnection(serverId: string): MCPConnection {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`Server not connected: ${serverId}`);
    }
    return connection;
  }

  private async createConnection(config: MCPServerConfig): Promise<MCPConnection> {
    const { connection: connConfig } = config;

    switch (connConfig.type) {
      case 'stdio':
        return this.createStdioConnection(config);
      case 'sse':
        return this.createSSEConnection(config);
      case 'websocket':
        return this.createWebSocketConnection(config);
      default:
        throw new Error(`Unsupported transport type: ${connConfig.type}`);
    }
  }

  private async createStdioConnection(config: MCPServerConfig): Promise<MCPConnection> {
    // Stdio connection implementation
    // This would use child_process.spawn in Node.js
    return new StdioMCPConnection(config, this.logger);
  }

  private async createSSEConnection(config: MCPServerConfig): Promise<MCPConnection> {
    // SSE connection implementation
    return new SSEMCPConnection(config, this.logger);
  }

  private async createWebSocketConnection(config: MCPServerConfig): Promise<MCPConnection> {
    // WebSocket connection implementation
    return new WebSocketMCPConnection(config, this.logger);
  }

  private log(level: 'info' | 'warn' | 'error', message: string): void {
    if (this.logger) {
      this.logger[level](message);
    }
  }
}

/**
 * Base MCP Connection class
 */
abstract class BaseMCPConnection implements MCPConnection {
  protected initialized = false;
  protected serverInfo?: { name: string; version: string };

  constructor(
    public readonly serverId: string,
    public status: ConnectionState,
    protected logger?: Console
  ) {}

  abstract disconnect(): Promise<void>;
  abstract listTools(): Promise<Tool[]>;
  abstract callTool(params: ToolCallParams): Promise<ToolResult>;
  abstract listResources(): Promise<Resource[]>;
  abstract readResource(params: ResourceReadParams): Promise<ResourceContent>;
  abstract listPrompts(): Promise<Prompt[]>;
  abstract getPrompt(params: PromptGetParams): Promise<PromptMessage[]>;
  abstract sample(messages: Message[], options: SamplingOptions): Promise<SamplingResult>;
  abstract ping(): Promise<boolean>;

  protected async initialize(params: InitializeParams): Promise<InitializeResult> {
    throw new Error('initialize must be implemented by subclass');
  }

  protected log(level: 'info' | 'warn' | 'error', message: string): void {
    if (this.logger) {
      this.logger[level](`[${this.serverId}] ${message}`);
    }
  }
}

/**
 * Stdio MCP Connection
 */
class StdioMCPConnection extends BaseMCPConnection {
  private process?: unknown; // Would be ChildProcess
  private messageId = 0;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();

  constructor(private config: MCPServerConfig, logger?: Console) {
    super(config.serverId, 'connecting', logger);
    this.initializeProcess();
  }

  private async initializeProcess(): Promise<void> {
    // Implementation would spawn the process and set up stdio communication
    // For now, this is a placeholder
    this.status = 'connected';
    this.initialized = true;
  }

  async disconnect(): Promise<void> {
    // Kill process and cleanup
    this.status = 'disconnected';
  }

  async listTools(): Promise<Tool[]> {
    return this.sendRequest('tools/list', {});
  }

  async callTool(params: ToolCallParams): Promise<ToolResult> {
    return this.sendRequest('tools/call', params);
  }

  async listResources(): Promise<Resource[]> {
    return this.sendRequest('resources/list', {});
  }

  async readResource(params: ResourceReadParams): Promise<ResourceContent> {
    return this.sendRequest('resources/read', params);
  }

  async listPrompts(): Promise<Prompt[]> {
    return this.sendRequest('prompts/list', {});
  }

  async getPrompt(params: PromptGetParams): Promise<PromptMessage[]> {
    return this.sendRequest('prompts/get', params);
  }

  async sample(messages: Message[], options: SamplingOptions): Promise<SamplingResult> {
    return this.sendRequest('sampling/createMessage', { messages, ...options });
  }

  async ping(): Promise<boolean> {
    try {
      await this.sendRequest('ping', {}, 5000);
      return true;
    } catch {
      return false;
    }
  }

  private async sendRequest(method: string, params: unknown, timeout = 30000): Promise<any> {
    const id = ++this.messageId;
    const request = { jsonrpc: '2.0', id, method, params };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, timeout);

      this.pendingRequests.set(id, {
        resolve: (result: unknown) => {
          clearTimeout(timer);
          resolve(result);
        },
        reject: (error: Error) => {
          clearTimeout(timer);
          reject(error);
        },
      });

      // Would write to process stdin
      // this.process.stdin.write(JSON.stringify(request) + '\n');
    });
  }
}

/**
 * SSE MCP Connection
 */
class SSEMCPConnection extends BaseMCPConnection {
  constructor(private config: MCPServerConfig, logger?: Console) {
    super(config.serverId, 'connecting', logger);
  }

  async disconnect(): Promise<void> {
    this.status = 'disconnected';
  }

  async listTools(): Promise<Tool[]> {
    return [];
  }

  async callTool(params: ToolCallParams): Promise<ToolResult> {
    throw new Error('Not implemented');
  }

  async listResources(): Promise<Resource[]> {
    return [];
  }

  async readResource(params: ResourceReadParams): Promise<ResourceContent> {
    throw new Error('Not implemented');
  }

  async listPrompts(): Promise<Prompt[]> {
    return [];
  }

  async getPrompt(params: PromptGetParams): Promise<PromptMessage[]> {
    throw new Error('Not implemented');
  }

  async sample(messages: Message[], options: SamplingOptions): Promise<SamplingResult> {
    throw new Error('Not implemented');
  }

  async ping(): Promise<boolean> {
    return false;
  }
}

/**
 * WebSocket MCP Connection
 */
class WebSocketMCPConnection extends BaseMCPConnection {
  constructor(private config: MCPServerConfig, logger?: Console) {
    super(config.serverId, 'connecting', logger);
  }

  async disconnect(): Promise<void> {
    this.status = 'disconnected';
  }

  async listTools(): Promise<Tool[]> {
    return [];
  }

  async callTool(params: ToolCallParams): Promise<ToolResult> {
    throw new Error('Not implemented');
  }

  async listResources(): Promise<Resource[]> {
    return [];
  }

  async readResource(params: ResourceReadParams): Promise<ResourceContent> {
    throw new Error('Not implemented');
  }

  async listPrompts(): Promise<Prompt[]> {
    return [];
  }

  async getPrompt(params: PromptGetParams): Promise<PromptMessage[]> {
    throw new Error('Not implemented');
  }

  async sample(messages: Message[], options: SamplingOptions): Promise<SamplingResult> {
    throw new Error('Not implemented');
  }

  async ping(): Promise<boolean> {
    return false;
  }
}

export { MCPClient as default };
export * from './types.ts';
