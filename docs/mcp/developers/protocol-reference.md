# MCP Protocol Reference

## Overview

The Model Context Protocol (MCP) is a JSON-RPC 2.0 based protocol that enables communication between AI assistants and external tools/services.

## Protocol Version

Current version: `2024-11-05`

## Transport Types

### Stdio (Standard Input/Output)

The most common transport for local MCP servers.

**Process Communication:**
- Messages sent via stdin
- Responses received via stdout
- Logs should use stderr

**Message Format:**
```
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}\n
```

### SSE (Server-Sent Events)

HTTP-based transport for remote servers.

**Endpoint:** `POST /sse`

### WebSocket

Bidirectional communication for real-time updates.

**Endpoint:** `ws://server/mcp`

## Message Format

All messages follow JSON-RPC 2.0 specification.

### Request

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search",
    "arguments": {
      "query": "MCP protocol"
    }
  }
}
```

### Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Search results..."
      }
    ]
  }
}
```

### Error

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Internal error"
  }
}
```

### Notification

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/tools/listChanged",
  "params": {}
}
```

## Methods

### Initialization

#### `initialize`

Establish connection and exchange capabilities.

**Request:**
```json
{
  "protocolVersion": "2024-11-05",
  "capabilities": {
    "roots": {
      "listChanged": true
    },
    "sampling": {}
  },
  "clientInfo": {
    "name": "DGOS",
    "version": "1.0.0"
  }
}
```

**Response:**
```json
{
  "protocolVersion": "2024-11-05",
  "capabilities": {
    "tools": {},
    "resources": {
      "subscribe": true,
      "listChanged": true
    },
    "prompts": {
      "listChanged": true
    },
    "logging": {}
  },
  "serverInfo": {
    "name": "Example MCP Server",
    "version": "1.0.0"
  }
}
```

### Tools

#### `tools/list`

List all available tools.

**Request:**
```json
{
  "method": "tools/list",
  "params": {}
}
```

**Response:**
```json
{
  "tools": [
    {
      "name": "search",
      "description": "Search the web",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "Search query"
          }
        },
        "required": ["query"]
      }
    }
  ]
}
```

#### `tools/call`

Execute a tool.

**Request:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "search",
    "arguments": {
      "query": "MCP protocol"
    }
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Found 10 results for 'MCP protocol'"
    }
  ],
  "isError": false
}
```

### Resources

#### `resources/list`

List all available resources.

**Request:**
```json
{
  "method": "resources/list",
  "params": {}
}
```

**Response:**
```json
{
  "resources": [
    {
      "uri": "file://docs/readme.md",
      "name": "README",
      "description": "Project documentation",
      "mimeType": "text/markdown"
    }
  ]
}
```

#### `resources/read`

Read a resource.

**Request:**
```json
{
  "method": "resources/read",
  "params": {
    "uri": "file://docs/readme.md"
  }
}
```

**Response:**
```json
{
  "contents": [
    {
      "uri": "file://docs/readme.md",
      "mimeType": "text/markdown",
      "text": "# Project Documentation\n..."
    }
  ]
}
```

#### `resources/subscribe`

Subscribe to resource updates (if supported).

**Request:**
```json
{
  "method": "resources/subscribe",
  "params": {
    "uri": "file://docs/readme.md"
  }
}
```

#### `resources/unsubscribe`

Unsubscribe from resource updates.

**Request:**
```json
{
  "method": "resources/unsubscribe",
  "params": {
    "uri": "file://docs/readme.md"
  }
}
```

### Prompts

#### `prompts/list`

List all available prompts.

**Request:**
```json
{
  "method": "prompts/list",
  "params": {}
}
```

**Response:**
```json
{
  "prompts": [
    {
      "name": "code_review",
      "description": "Review code for best practices",
      "arguments": [
        {
          "name": "language",
          "description": "Programming language",
          "required": true
        },
        {
          "name": "code",
          "description": "Code to review",
          "required": true
        }
      ]
    }
  ]
}
```

#### `prompts/get`

Get a prompt with arguments.

**Request:**
```json
{
  "method": "prompts/get",
  "params": {
    "name": "code_review",
    "arguments": {
      "language": "javascript",
      "code": "function add(a, b) { return a + b; }"
    }
  }
}
```

**Response:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": {
        "type": "text",
        "text": "Please review this javascript code:\n\nfunction add(a, b) { return a + b; }"
      }
    }
  ]
}
```

### Sampling

#### `sampling/createMessage`

Request LLM sampling (if supported by server).

**Request:**
```json
{
  "method": "sampling/createMessage",
  "params": {
    "messages": [
      {
        "role": "user",
        "content": {
          "type": "text",
          "text": "What is MCP?"
        }
      }
    ],
    "maxTokens": 1000,
    "temperature": 0.7
  }
}
```

**Response:**
```json
{
  "role": "assistant",
  "content": {
    "type": "text",
    "text": "MCP stands for Model Context Protocol..."
  },
  "model": "claude-3-sonnet",
  "stopReason": "endTurn"
}
```

## Notifications

Servers can send notifications to inform clients of changes.

### `notifications/tools/listChanged`

Tools list has changed.

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/tools/listChanged",
  "params": {}
}
```

### `notifications/resources/listChanged`

Resources list has changed.

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/resources/listChanged",
  "params": {}
}
```

### `notifications/resources/updated`

A specific resource has been updated.

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/resources/updated",
  "params": {
    "uri": "file://docs/readme.md"
  }
}
```

### `notifications/prompts/listChanged`

Prompts list has changed.

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/prompts/listChanged",
  "params": {}
}
```

## Content Types

### Text Content

```json
{
  "type": "text",
  "text": "Hello, world!"
}
```

### Image Content

```json
{
  "type": "image",
  "data": "base64EncodedImageData",
  "mimeType": "image/png"
}
```

### Resource Content

```json
{
  "type": "resource",
  "uri": "file://output.json"
}
```

## Error Codes

Standard JSON-RPC error codes:

- `-32700`: Parse error
- `-32600`: Invalid request
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error
- `-32000` to `-32099`: Server-defined errors

## Input Schema

Tools use JSON Schema to define input parameters:

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Search query",
      "minLength": 1,
      "maxLength": 100
    },
    "limit": {
      "type": "number",
      "description": "Maximum results",
      "minimum": 1,
      "maximum": 100,
      "default": 10
    },
    "filters": {
      "type": "object",
      "properties": {
        "date": { "type": "string", "format": "date" },
        "category": { "type": "string", "enum": ["news", "blogs", "docs"] }
      }
    }
  },
  "required": ["query"]
}
```

## Best Practices

### 1. Handle All Methods

Implement error responses for unsupported methods:

```json
{
  "error": {
    "code": -32601,
    "message": "Method not found: unknown/method"
  }
}
```

### 2. Validate Parameters

Always validate input against schema before execution.

### 3. Use Appropriate Content Types

Choose the right content type for responses (text, image, resource).

### 4. Send Notifications

Keep clients informed of changes with notifications.

### 5. Implement Ping/Health Checks

Respond to ping requests to indicate server health.

### 6. Clean Shutdown

Handle termination signals gracefully:

```javascript
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
```

### 7. Log to stderr

Never write logs to stdout (reserved for protocol messages).

## Security Considerations

### 1. Input Validation

Always validate and sanitize inputs to prevent injection attacks.

### 2. Access Control

Implement proper authorization for sensitive operations.

### 3. Credential Handling

Never log or expose credentials in error messages or responses.

### 4. Resource Limits

Implement timeouts and resource limits to prevent abuse.

### 5. URI Validation

Validate resource URIs to prevent path traversal attacks.

## Examples

See the [examples directory](../README.md) for complete implementations:

- `memory-server.mjs`: Simple memory storage
- `filesystem-server.mjs`: File system access
- `weather-server.mjs`: External API integration

## References

- [Official MCP Specification](https://modelcontextprotocol.io)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [JSON Schema](https://json-schema.org/)
