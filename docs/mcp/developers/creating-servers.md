# Building MCP Servers for DGOS

## Introduction

This guide will walk you through creating your own MCP (Model Context Protocol) server for DGOS using the `@dgos/mcp-server-sdk`.

## Prerequisites

- Node.js 22 or higher
- Basic understanding of JavaScript/TypeScript
- Familiarity with async/await

## Quick Start

### 1. Create a New Project

```bash
mkdir my-mcp-server
cd my-mcp-server
npm init -y
npm install @dgos/mcp-server-sdk
```

### 2. Create Your Server

Create `server.mjs`:

```javascript
#!/usr/bin/env node
import { MCPServer, createTextResult } from '@dgos/mcp-server-sdk';

const server = new MCPServer({
  name: 'My First MCP Server',
  version: '1.0.0',
  capabilities: {
    tools: true,
  },
});

// Add a simple tool
server.addTool(
  {
    name: 'greet',
    description: 'Greet a user by name',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the person to greet',
        },
      },
      required: ['name'],
    },
  },
  async (args) => {
    const name = args.name;
    return createTextResult(`Hello, ${name}! Welcome to MCP.`);
  }
);

// Start the server
await server.start();
```

### 3. Make It Executable

```bash
chmod +x server.mjs
```

### 4. Test Your Server

Add to DGOS:
- Server ID: `my-first-server`
- Command: `node`
- Arguments: `/path/to/server.mjs`

## Core Concepts

### Tools

Tools are functions that the AI can call. Each tool has:
- **Name**: Unique identifier
- **Description**: What the tool does
- **Input Schema**: JSON Schema defining parameters
- **Handler**: Async function that executes the tool

```javascript
server.addTool(
  {
    name: 'calculate',
    description: 'Perform basic arithmetic',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['add', 'subtract', 'multiply', 'divide'],
        },
        a: { type: 'number' },
        b: { type: 'number' },
      },
      required: ['operation', 'a', 'b'],
    },
  },
  async (args) => {
    const { operation, a, b } = args;
    let result;
    
    switch (operation) {
      case 'add': result = a + b; break;
      case 'subtract': result = a - b; break;
      case 'multiply': result = a * b; break;
      case 'divide': result = a / b; break;
    }
    
    return createTextResult(`${a} ${operation} ${b} = ${result}`);
  }
);
```

### Resources

Resources provide access to data:

```javascript
server.addResource(
  {
    uri: 'config://settings',
    name: 'Application Settings',
    description: 'Current application configuration',
    mimeType: 'application/json',
  },
  async () => {
    const settings = {
      theme: 'dark',
      language: 'en',
      notifications: true,
    };
    
    return {
      contents: [
        {
          uri: 'config://settings',
          mimeType: 'application/json',
          text: JSON.stringify(settings, null, 2),
        },
      ],
    };
  }
);
```

### Prompts

Prompts are reusable conversation templates:

```javascript
server.addPrompt(
  {
    name: 'code_review',
    description: 'Review code for best practices',
    arguments: [
      {
        name: 'language',
        description: 'Programming language',
        required: true,
      },
      {
        name: 'code',
        description: 'Code to review',
        required: true,
      },
    ],
  },
  async (args) => {
    return [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Please review this ${args.language} code:\n\n${args.code}`,
        },
      },
    ];
  }
);
```

## Result Types

### Text Results

```javascript
import { createTextResult } from '@dgos/mcp-server-sdk';

return createTextResult('Simple text response');
```

### Error Results

```javascript
import { createErrorResult } from '@dgos/mcp-server-sdk';

return createErrorResult('Something went wrong');
```

### Image Results

```javascript
import { createImageResult } from '@dgos/mcp-server-sdk';

const base64Image = '...'; // Base64 encoded image
return createImageResult(base64Image, 'image/png');
```

### Custom Results

```javascript
return {
  content: [
    {
      type: 'text',
      text: 'Here is the result',
    },
    {
      type: 'resource',
      uri: 'file://output.json',
    },
  ],
};
```

## Notifications

Notify DGOS of changes:

```javascript
// When tools change
server.notifyToolsChanged();

// When resources change
server.notifyResourcesChanged();

// When a specific resource updates
server.notifyResourceUpdated('config://settings');

// When prompts change
server.notifyPromptsChanged();
```

## Input Validation

Always validate inputs:

```javascript
server.addTool(
  {
    name: 'search',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          minLength: 1,
          maxLength: 100,
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10,
        },
      },
      required: ['query'],
    },
  },
  async (args) => {
    // Input is already validated by schema
    const query = args.query as string;
    const limit = (args.limit as number) || 10;
    
    // Your search logic here
  }
);
```

## Error Handling

Handle errors gracefully:

```javascript
server.addTool(
  {
    name: 'read_file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
      },
      required: ['path'],
    },
  },
  async (args) => {
    try {
      const content = await fs.readFile(args.path, 'utf-8');
      return createTextResult(content);
    } catch (error) {
      return createErrorResult(`Failed to read file: ${error.message}`);
    }
  }
);
```

## Stateful Servers

Maintain state across calls:

```javascript
const cache = new Map();

server.addTool(
  {
    name: 'cache_set',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        value: { type: 'string' },
      },
      required: ['key', 'value'],
    },
  },
  async (args) => {
    cache.set(args.key, args.value);
    return createTextResult(`Cached: ${args.key}`);
  }
);

server.addTool(
  {
    name: 'cache_get',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
      },
      required: ['key'],
    },
  },
  async (args) => {
    const value = cache.get(args.key);
    if (!value) {
      return createErrorResult(`Key not found: ${args.key}`);
    }
    return createTextResult(value);
  }
);
```

## Best Practices

### 1. Clear Tool Names and Descriptions

```javascript
// Good
{
  name: 'search_github_issues',
  description: 'Search for issues in a GitHub repository by query string',
}

// Bad
{
  name: 'search',
  description: 'Search',
}
```

### 2. Comprehensive Input Schemas

```javascript
// Good
{
  type: 'object',
  properties: {
    repository: {
      type: 'string',
      pattern: '^[a-z0-9-]+/[a-z0-9-]+$',
      description: 'Repository in format owner/repo',
    },
    state: {
      type: 'string',
      enum: ['open', 'closed', 'all'],
      default: 'open',
    },
  },
  required: ['repository'],
}
```

### 3. Helpful Error Messages

```javascript
if (!token) {
  return createErrorResult(
    'GitHub token not configured. Please set GITHUB_TOKEN environment variable.'
  );
}
```

### 4. Logging to stderr

```javascript
// stdout is for MCP protocol, use stderr for logs
console.error('Server starting...');
console.error(`Loaded ${tools.length} tools`);
```

### 5. Graceful Shutdown

```javascript
process.on('SIGINT', async () => {
  console.error('Shutting down gracefully...');
  await cleanup();
  process.exit(0);
});
```

## Example: Weather MCP Server

Complete example with multiple tools:

```javascript
#!/usr/bin/env node
import { MCPServer, createTextResult, createErrorResult } from '@dgos/mcp-server-sdk';

const server = new MCPServer({
  name: 'Weather MCP Server',
  version: '1.0.0',
});

// Mock weather data (use real API in production)
const weatherData = {
  'New York': { temp: 72, condition: 'Sunny' },
  'London': { temp: 60, condition: 'Cloudy' },
  'Tokyo': { temp: 68, condition: 'Rainy' },
};

server.addTool(
  {
    name: 'get_weather',
    description: 'Get current weather for a city',
    inputSchema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'City name',
        },
      },
      required: ['city'],
    },
  },
  async (args) => {
    const city = args.city as string;
    const weather = weatherData[city];
    
    if (!weather) {
      return createErrorResult(`Weather data not available for ${city}`);
    }
    
    return createTextResult(
      `Weather in ${city}: ${weather.temp}°F, ${weather.condition}`
    );
  }
);

server.addTool(
  {
    name: 'list_cities',
    description: 'List cities with available weather data',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  async () => {
    const cities = Object.keys(weatherData);
    return createTextResult(`Available cities: ${cities.join(', ')}`);
  }
);

await server.start();
```

## Testing Your Server

### Manual Testing

1. Start your server directly:
```bash
node server.mjs
```

2. Send JSON-RPC messages via stdin:
```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
```

### Integration Testing

Add to DGOS and test through the Tool Invoker UI.

## Publishing Your Server

### 1. Package for npm

```bash
npm publish
```

### 2. Add to MCP Registry

Submit to the official MCP server registry for inclusion in DGOS presets.

### 3. Documentation

Include:
- README with setup instructions
- List of all tools and their parameters
- Required credentials/environment variables
- Example usage

## Next Steps

- Review [MCP Protocol Reference](./protocol-reference.md)
- Study [Example Servers](../README.md)
- Join the [DGOS Community](#)

## Resources

- [MCP Specification](https://modelcontextprotocol.io)
- [DGOS SDK Documentation](../../../packages/sdk/README.md)
- [Community MCP Servers](https://github.com/topics/mcp-server)
