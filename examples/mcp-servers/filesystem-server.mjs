#!/usr/bin/env node

/**
 * Example MCP Server: Filesystem
 * Demonstrates how to build an MCP server using @dgos/mcp-server-sdk
 */

import { MCPServer, createTextResult, createErrorResult } from '@dgos/mcp-server-sdk';
import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join, resolve } from 'path';

const server = new MCPServer({
  name: 'Filesystem MCP Server',
  version: '1.0.0',
  capabilities: {
    tools: true,
    resources: true,
  },
});

// Tool: List directory contents
server.addTool(
  {
    name: 'list_directory',
    description: 'List contents of a directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to list',
        },
      },
      required: ['path'],
    },
  },
  async (args) => {
    try {
      const dirPath = resolve(args.path as string);
      const entries = await readdir(dirPath, { withFileTypes: true });

      const items = entries.map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
      }));

      return createTextResult(JSON.stringify(items, null, 2));
    } catch (error: any) {
      return createErrorResult(`Failed to list directory: ${error.message}`);
    }
  }
);

// Tool: Read file
server.addTool(
  {
    name: 'read_file',
    description: 'Read contents of a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path to read',
        },
      },
      required: ['path'],
    },
  },
  async (args) => {
    try {
      const filePath = resolve(args.path as string);
      const content = await readFile(filePath, 'utf-8');
      return createTextResult(content);
    } catch (error: any) {
      return createErrorResult(`Failed to read file: ${error.message}`);
    }
  }
);

// Tool: Write file
server.addTool(
  {
    name: 'write_file',
    description: 'Write content to a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path to write',
        },
        content: {
          type: 'string',
          description: 'Content to write',
        },
      },
      required: ['path', 'content'],
    },
  },
  async (args) => {
    try {
      const filePath = resolve(args.path as string);
      await writeFile(filePath, args.content as string, 'utf-8');
      return createTextResult(`File written successfully: ${filePath}`);
    } catch (error: any) {
      return createErrorResult(`Failed to write file: ${error.message}`);
    }
  }
);

// Tool: Get file info
server.addTool(
  {
    name: 'file_info',
    description: 'Get information about a file or directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to file or directory',
        },
      },
      required: ['path'],
    },
  },
  async (args) => {
    try {
      const filePath = resolve(args.path as string);
      const stats = await stat(filePath);

      const info = {
        path: filePath,
        size: stats.size,
        type: stats.isDirectory() ? 'directory' : 'file',
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        permissions: stats.mode.toString(8),
      };

      return createTextResult(JSON.stringify(info, null, 2));
    } catch (error: any) {
      return createErrorResult(`Failed to get file info: ${error.message}`);
    }
  }
);

// Resource: Project files
server.addResource(
  {
    uri: 'file://project',
    name: 'Project Files',
    description: 'Access to project directory files',
    mimeType: 'application/json',
  },
  async () => {
    const projectPath = process.cwd();
    const entries = await readdir(projectPath, { withFileTypes: true });

    const files = entries
      .filter((e) => e.isFile())
      .map((e) => e.name);

    return {
      contents: [
        {
          uri: 'file://project',
          mimeType: 'application/json',
          text: JSON.stringify({ files }, null, 2),
        },
      ],
    };
  }
);

// Start the server
console.error('Filesystem MCP Server starting...');
await server.start();
console.error('Filesystem MCP Server ready');
