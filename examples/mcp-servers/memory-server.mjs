#!/usr/bin/env node

/**
 * Example MCP Server: Memory
 * Simple persistent memory storage for AI context
 */

import { MCPServer, createTextResult, createErrorResult } from '@dgos/mcp-server-sdk';

const server = new MCPServer({
  name: 'Memory MCP Server',
  version: '1.0.0',
  capabilities: {
    tools: true,
    resources: true,
  },
});

// In-memory storage
const memory = new Map<string, { content: string; timestamp: string; tags: string[] }>();

// Tool: Store memory
server.addTool(
  {
    name: 'store_memory',
    description: 'Store information in memory',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Memory key/identifier',
        },
        content: {
          type: 'string',
          description: 'Content to store',
        },
        tags: {
          type: 'array',
          description: 'Tags for categorization',
          items: { type: 'string' },
        },
      },
      required: ['key', 'content'],
    },
  },
  async (args) => {
    const key = args.key as string;
    const content = args.content as string;
    const tags = (args.tags as string[]) || [];

    memory.set(key, {
      content,
      timestamp: new Date().toISOString(),
      tags,
    });

    server.notifyResourcesChanged();

    return createTextResult(`Memory stored: ${key}`);
  }
);

// Tool: Retrieve memory
server.addTool(
  {
    name: 'retrieve_memory',
    description: 'Retrieve information from memory',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Memory key to retrieve',
        },
      },
      required: ['key'],
    },
  },
  async (args) => {
    const key = args.key as string;
    const item = memory.get(key);

    if (!item) {
      return createErrorResult(`Memory not found: ${key}`);
    }

    return createTextResult(JSON.stringify(item, null, 2));
  }
);

// Tool: Search memory
server.addTool(
  {
    name: 'search_memory',
    description: 'Search memory by content or tags',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        tag: {
          type: 'string',
          description: 'Filter by tag',
        },
      },
    },
  },
  async (args) => {
    const query = (args.query as string)?.toLowerCase() || '';
    const tag = (args.tag as string)?.toLowerCase();

    const results: Array<{ key: string; item: any }> = [];

    for (const [key, item] of memory.entries()) {
      const matchesQuery = !query || item.content.toLowerCase().includes(query);
      const matchesTag = !tag || item.tags.some((t) => t.toLowerCase().includes(tag));

      if (matchesQuery && matchesTag) {
        results.push({ key, item });
      }
    }

    return createTextResult(JSON.stringify(results, null, 2));
  }
);

// Tool: List all memories
server.addTool(
  {
    name: 'list_memories',
    description: 'List all stored memories',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  async () => {
    const items = Array.from(memory.entries()).map(([key, item]) => ({
      key,
      preview: item.content.substring(0, 100),
      timestamp: item.timestamp,
      tags: item.tags,
    }));

    return createTextResult(JSON.stringify(items, null, 2));
  }
);

// Tool: Delete memory
server.addTool(
  {
    name: 'delete_memory',
    description: 'Delete a memory',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Memory key to delete',
        },
      },
      required: ['key'],
    },
  },
  async (args) => {
    const key = args.key as string;

    if (!memory.has(key)) {
      return createErrorResult(`Memory not found: ${key}`);
    }

    memory.delete(key);
    server.notifyResourcesChanged();

    return createTextResult(`Memory deleted: ${key}`);
  }
);

// Resource: All memories
server.addResource(
  {
    uri: 'memory://all',
    name: 'All Memories',
    description: 'Access to all stored memories',
    mimeType: 'application/json',
  },
  async () => {
    const items = Array.from(memory.entries()).map(([key, item]) => ({
      key,
      ...item,
    }));

    return {
      contents: [
        {
          uri: 'memory://all',
          mimeType: 'application/json',
          text: JSON.stringify(items, null, 2),
        },
      ],
    };
  }
);

// Start the server
console.error('Memory MCP Server starting...');
await server.start();
console.error('Memory MCP Server ready');
