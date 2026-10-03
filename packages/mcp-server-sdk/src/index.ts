/**
 * MCP Server SDK
 * Toolkit for building Model Context Protocol servers
 */

import type {
  Tool,
  ToolCallParams,
  ToolResult,
  Resource,
  ResourceReadParams,
  ResourceContent,
  Prompt,
  PromptGetParams,
  PromptMessage,
  InitializeParams,
  InitializeResult,
} from '@dgos/mcp-client/types';

export interface ToolHandler {
  (args: Record<string, unknown>): Promise<ToolResult>;
}

export interface ResourceHandler {
  (): Promise<ResourceContent>;
}

export interface PromptHandler {
  (args?: Record<string, string>): Promise<PromptMessage[]>;
}

export interface MCPServerOptions {
  name: string;
  version: string;
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
    logging?: boolean;
  };
}

export class MCPServer {
  private tools = new Map<string, { definition: Tool; handler: ToolHandler }>();
  private resources = new Map<string, { definition: Resource; handler: ResourceHandler }>();
  private prompts = new Map<string, { definition: Prompt; handler: PromptHandler }>();
  private messageId = 0;

  constructor(private options: MCPServerOptions) {}

  /**
   * Add a tool to the server
   */
  addTool(definition: Tool, handler: ToolHandler): void {
    this.tools.set(definition.name, { definition, handler });
  }

  /**
   * Add a resource to the server
   */
  addResource(definition: Resource, handler: ResourceHandler): void {
    this.resources.set(definition.uri, { definition, handler });
  }

  /**
   * Add a prompt to the server
   */
  addPrompt(definition: Prompt, handler: PromptHandler): void {
    this.prompts.set(definition.name, { definition, handler });
  }

  /**
   * Start the server (stdio mode)
   */
  async start(): Promise<void> {
    // Set up stdio communication
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (data) => {
      const lines = data.toString().split('\n').filter((line) => line.trim());
      for (const line of lines) {
        this.handleMessage(line).catch((error) => {
          this.sendError(null, -32603, error.message);
        });
      }
    });

    // Keep process alive
    process.stdin.resume();
  }

  /**
   * Handle incoming JSON-RPC message
   */
  private async handleMessage(data: string): Promise<void> {
    let message: any;
    try {
      message = JSON.parse(data);
    } catch {
      return this.sendError(null, -32700, 'Parse error');
    }

    const { id, method, params } = message;

    try {
      let result: unknown;

      switch (method) {
        case 'initialize':
          result = await this.handleInitialize(params);
          break;

        case 'tools/list':
          result = await this.handleListTools();
          break;

        case 'tools/call':
          result = await this.handleCallTool(params);
          break;

        case 'resources/list':
          result = await this.handleListResources();
          break;

        case 'resources/read':
          result = await this.handleReadResource(params);
          break;

        case 'prompts/list':
          result = await this.handleListPrompts();
          break;

        case 'prompts/get':
          result = await this.handleGetPrompt(params);
          break;

        case 'ping':
          result = { status: 'ok' };
          break;

        default:
          return this.sendError(id, -32601, `Method not found: ${method}`);
      }

      this.sendResponse(id, result);
    } catch (error: any) {
      this.sendError(id, -32603, error.message || 'Internal error');
    }
  }

  /**
   * Handle initialize request
   */
  private async handleInitialize(params: InitializeParams): Promise<InitializeResult> {
    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: this.options.capabilities?.tools !== false && this.tools.size > 0 ? {} : undefined,
        resources:
          this.options.capabilities?.resources !== false && this.resources.size > 0
            ? { subscribe: false, listChanged: true }
            : undefined,
        prompts:
          this.options.capabilities?.prompts !== false && this.prompts.size > 0
            ? { listChanged: true }
            : undefined,
        logging: this.options.capabilities?.logging ? {} : undefined,
      },
      serverInfo: {
        name: this.options.name,
        version: this.options.version,
      },
    };
  }

  /**
   * Handle tools/list request
   */
  private async handleListTools(): Promise<{ tools: Tool[] }> {
    const tools = Array.from(this.tools.values()).map((t) => t.definition);
    return { tools };
  }

  /**
   * Handle tools/call request
   */
  private async handleCallTool(params: ToolCallParams): Promise<ToolResult> {
    const tool = this.tools.get(params.name);
    if (!tool) {
      throw new Error(`Tool not found: ${params.name}`);
    }

    return tool.handler(params.arguments);
  }

  /**
   * Handle resources/list request
   */
  private async handleListResources(): Promise<{ resources: Resource[] }> {
    const resources = Array.from(this.resources.values()).map((r) => r.definition);
    return { resources };
  }

  /**
   * Handle resources/read request
   */
  private async handleReadResource(params: ResourceReadParams): Promise<ResourceContent> {
    const resource = this.resources.get(params.uri);
    if (!resource) {
      throw new Error(`Resource not found: ${params.uri}`);
    }

    return resource.handler();
  }

  /**
   * Handle prompts/list request
   */
  private async handleListPrompts(): Promise<{ prompts: Prompt[] }> {
    const prompts = Array.from(this.prompts.values()).map((p) => p.definition);
    return { prompts };
  }

  /**
   * Handle prompts/get request
   */
  private async handleGetPrompt(params: PromptGetParams): Promise<{ messages: PromptMessage[] }> {
    const prompt = this.prompts.get(params.name);
    if (!prompt) {
      throw new Error(`Prompt not found: ${params.name}`);
    }

    const messages = await prompt.handler(params.arguments);
    return { messages };
  }

  /**
   * Send JSON-RPC response
   */
  private sendResponse(id: number | string | null, result: unknown): void {
    const response = {
      jsonrpc: '2.0',
      id,
      result,
    };
    process.stdout.write(JSON.stringify(response) + '\n');
  }

  /**
   * Send JSON-RPC error
   */
  private sendError(id: number | string | null, code: number, message: string): void {
    const response = {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
      },
    };
    process.stdout.write(JSON.stringify(response) + '\n');
  }

  /**
   * Send notification (no response expected)
   */
  sendNotification(method: string, params?: unknown): void {
    const notification = {
      jsonrpc: '2.0',
      method,
      params,
    };
    process.stdout.write(JSON.stringify(notification) + '\n');
  }

  /**
   * Notify that tools list changed
   */
  notifyToolsChanged(): void {
    this.sendNotification('notifications/tools/listChanged');
  }

  /**
   * Notify that resources list changed
   */
  notifyResourcesChanged(): void {
    this.sendNotification('notifications/resources/listChanged');
  }

  /**
   * Notify that prompts list changed
   */
  notifyPromptsChanged(): void {
    this.sendNotification('notifications/prompts/listChanged');
  }

  /**
   * Notify that a resource was updated
   */
  notifyResourceUpdated(uri: string): void {
    this.sendNotification('notifications/resources/updated', { uri });
  }
}

/**
 * Helper to create simple text tool results
 */
export function createTextResult(text: string): ToolResult {
  return {
    content: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

/**
 * Helper to create error tool results
 */
export function createErrorResult(message: string): ToolResult {
  return {
    content: [
      {
        type: 'text',
        text: message,
      },
    ],
    isError: true,
  };
}

/**
 * Helper to create image tool results
 */
export function createImageResult(data: string, mimeType: string): ToolResult {
  return {
    content: [
      {
        type: 'image',
        data,
        mimeType,
      },
    ],
  };
}

export { MCPServer as default };
