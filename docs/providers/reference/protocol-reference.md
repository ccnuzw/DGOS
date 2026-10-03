# Protocol Reference

DGOS Provider Adapter Protocol Specification v1.0

## Overview

The DGOS Provider Adapter Protocol is a declarative system for defining how to interact with AI provider APIs. It uses JSONPath-based mapping to transform between DGOS's unified interface and provider-specific formats.

## Protocol Structure

### Adapter Definition

```typescript
interface ProviderAdapter {
  adapterId: string;              // Unique identifier
  name: {                         // Localized names
    en: string;
    zh: string;
  };
  version: string;                // Semantic version
  protocol: string;               // Protocol type
  capabilities: Capability[];     // Supported capabilities
  connectionSchema: JSONSchema;   // Connection config schema
  modelCatalogEndpoint?: string;  // Model discovery endpoint
  authentication: AuthMethod[];   // Supported auth methods
  executor: AdapterExecutor;      // Executor implementation
  metadata?: Record<string, any>; // Additional metadata
}
```

## Capabilities

### Capability Definition

```typescript
interface Capability {
  capability: string;              // Capability identifier
  operations: Record<string, Operation>; // Named operations
  workflows: Workflow[];           // Execution workflows
  modelProfiles?: ModelProfile[];  // Model configurations
}
```

### Standard Capabilities

| Capability | Description | Parameters |
|------------|-------------|------------|
| `text.chat` | Conversational text generation | `messages`, `model` |
| `text.completion` | Text completion | `prompt`, `model` |
| `text.embedding` | Text embeddings | `text`, `model` |
| `image.generate` | Image generation | `prompt`, `model` |
| `image.understand` | Image understanding | `image`, `prompt`, `model` |
| `video.generate` | Video generation | `prompt`, `model` |
| `video.understand` | Video understanding | `video`, `prompt`, `model` |
| `audio.generate` | Audio synthesis | `text`, `model` |
| `audio.understand` | Audio transcription | `audio`, `model` |

## Operations

### Operation Definition

```typescript
interface Operation {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;                    // URL path
  bodyTemplate?: Record<string, any>;  // Request body template
  queryParams?: Record<string, any>;   // Query parameters
  headers?: Record<string, string>;    // HTTP headers
  responseMapping: ResponseMapping;    // Response mapping
  errorMapping?: ErrorMapping;         // Error mapping
}
```

### Template Variables

Use `{{variable}}` syntax in templates:

```typescript
bodyTemplate: {
  model: '{{model}}',
  messages: '{{messages}}',
  temperature: '{{temperature}}',
  max_tokens: '{{max_tokens}}',
}
```

Variables are resolved from `AdapterRequest.parameters`.

## Response Mapping

### JSONPath Expressions

Use JSONPath to extract values from responses:

```typescript
interface ResponseMapping {
  taskId?: string;        // $.id
  content?: string;       // $.choices[0].message.content
  finishReason?: string;  // $.choices[0].finish_reason
  usage?: UsageMapping;   // Nested mapping
  artifacts?: string;     // $.artifacts[*]
  metadata?: string;      // $.metadata
}
```

### JSONPath Syntax

| Pattern | Description | Example |
|---------|-------------|---------|
| `$.field` | Root field access | `$.id` → `response.id` |
| `$.nested.field` | Nested field | `$.data.text` → `response.data.text` |
| `$.array[0]` | Array index | `$.choices[0]` → `response.choices[0]` |
| `$.array[*]` | All array items | `$.items[*]` → all items |

### Usage Mapping

```typescript
interface UsageMapping {
  promptTokens?: string;      // $.usage.prompt_tokens
  completionTokens?: string;  // $.usage.completion_tokens
  totalTokens?: string;       // $.usage.total_tokens
}
```

## Workflows

### Workflow Types

```typescript
interface Workflow {
  name: string;           // Workflow identifier
  type: 'sync' | 'async' | 'streaming';
  steps: WorkflowStep[];  // Execution steps
  statusMapping: StatusMapping;
}
```

### Synchronous Workflow

Single request-response:

```typescript
{
  name: 'text-chat-sync',
  type: 'sync',
  steps: [
    { operation: 'submit' }
  ],
  statusMapping: {
    success: '$.choices[0].finish_reason == "stop"',
    failure: '$.error != null',
  },
}
```

### Asynchronous Workflow

Submit, then poll:

```typescript
{
  name: 'image-generate-async',
  type: 'async',
  steps: [
    { operation: 'submit' },
    {
      operation: 'poll',
      retryPolicy: {
        maxAttempts: 30,
        backoffMs: 2000,
        retryableErrors: ['pending', 'processing'],
      },
    },
  ],
  statusMapping: {
    pending: '$.status == "pending"',
    running: '$.status == "processing"',
    success: '$.status == "completed"',
    failure: '$.status == "failed"',
  },
}
```

### Streaming Workflow

Server-sent events:

```typescript
{
  name: 'text-chat-streaming',
  type: 'streaming',
  steps: [
    { operation: 'submit' }
  ],
  statusMapping: {
    success: '[DONE]',
    failure: '$.error != null',
  },
}
```

## Authentication

### Supported Methods

```typescript
type AuthMethod = 'bearer' | 'api-key' | 'oauth' | 'basic' | 'custom';
```

### Bearer Token

```typescript
authentication: ['bearer']

// Results in header:
// Authorization: Bearer <credential>
```

### API Key

```typescript
authentication: ['api-key']

// Credential format:
credential: {
  type: 'api-key',
  key: 'your-key',
  headerName: 'X-API-Key',  // Optional, default: 'X-API-Key'
}
```

### OAuth

```typescript
authentication: ['oauth']

// Credential format:
credential: {
  type: 'oauth',
  accessToken: 'token',
  refreshToken: 'refresh',
  expiresAt: 1234567890,
}
```

## Model Profiles

### Model Definition

```typescript
interface ModelProfile {
  modelId: string;           // Model identifier
  capabilities: string[];    // Supported capabilities
  limits: ModelLimits;       // Resource limits
  pricing?: ModelPricing;    // Cost information
  features?: string[];       // Special features
}
```

### Model Limits

```typescript
interface ModelLimits {
  maxTokens?: number;        // Max output tokens
  contextWindow?: number;    // Context window size
  maxImages?: number;        // Max images per request
  maxVideoDuration?: number; // Max video length (seconds)
  maxAudioDuration?: number; // Max audio length (seconds)
}
```

### Model Pricing

```typescript
interface ModelPricing {
  inputTokenCost?: number;   // Cost per input token
  outputTokenCost?: number;  // Cost per output token
  imageCost?: number;        // Cost per image
  videoCost?: number;        // Cost per video second
  audioCost?: number;        // Cost per audio second
  currency?: string;         // Currency code (USD, CNY, etc.)
}
```

## Connection Schema

Define required connection parameters using JSON Schema:

```typescript
connectionSchema: {
  type: 'object',
  required: ['baseUrl', 'credential'],
  properties: {
    baseUrl: {
      type: 'string',
      format: 'uri',
      description: 'Base URL of the API endpoint',
      examples: ['https://api.openai.com/v1'],
    },
    credential: {
      type: 'string',
      description: 'API key or bearer token',
    },
    organization: {
      type: 'string',
      description: 'Organization ID (optional)',
    },
  },
}
```

## Complete Example

### OpenAI-Compatible Adapter

```json
{
  "schemaVersion": "dgos-capability/v1",
  "kind": "capability-protocol",
  "adapterId": "openai-compatible",
  "version": "1.0.0",
  "name": {
    "en": "OpenAI-Compatible API",
    "zh": "OpenAI 兼容 API"
  },
  "capabilities": [
    {
      "capability": "text.chat",
      "operations": {
        "submit": {
          "method": "POST",
          "path": "/chat/completions",
          "bodyTemplate": {
            "model": "{{model}}",
            "messages": "{{messages}}",
            "stream": "{{stream}}",
            "temperature": "{{temperature}}",
            "max_tokens": "{{max_tokens}}"
          },
          "responseMapping": {
            "taskId": "$.id",
            "content": "$.choices[0].message.content",
            "finishReason": "$.choices[0].finish_reason",
            "usage": {
              "promptTokens": "$.usage.prompt_tokens",
              "completionTokens": "$.usage.completion_tokens",
              "totalTokens": "$.usage.total_tokens"
            }
          }
        }
      },
      "workflows": [
        {
          "name": "text-chat-sync",
          "type": "sync",
          "steps": [
            { "operation": "submit" }
          ],
          "statusMapping": {
            "success": "$.choices[0].finish_reason == 'stop'",
            "failure": "$.error != null"
          }
        }
      ]
    }
  ],
  "connectionSchema": {
    "type": "object",
    "required": ["baseUrl", "credential"],
    "properties": {
      "baseUrl": {
        "type": "string",
        "format": "uri"
      },
      "credential": {
        "type": "string"
      }
    }
  },
  "authentication": ["bearer"],
  "modelCatalogEndpoint": "/models"
}
```

## Error Handling

### Error Mapping

```typescript
errorMapping: {
  code: '$.error.code',
  message: '$.error.message',
  retryable: '$.error.type == "rate_limit_error"',
}
```

### Standard Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| `AUTHENTICATION_FAILED` | Invalid credentials | No |
| `RATE_LIMITED` | Rate limit exceeded | Yes |
| `UPSTREAM_UNAVAILABLE` | Provider service down | Yes |
| `INVALID_REQUEST` | Malformed request | No |
| `MODEL_NOT_FOUND` | Model doesn't exist | No |
| `CONTEXT_LENGTH_EXCEEDED` | Input too long | No |
| `TIMEOUT` | Request timed out | Yes |

## Versioning

### Semantic Versioning

Adapters use semver: `MAJOR.MINOR.PATCH`

- **MAJOR**: Incompatible API changes
- **MINOR**: Backward-compatible functionality
- **PATCH**: Backward-compatible bug fixes

### Schema Version

```typescript
schemaVersion: "dgos-capability/v1"
```

Current schema version: **v1**

## Validation

Adapters are validated against:

1. **Schema validation**: JSON Schema compliance
2. **Structure validation**: Required fields present
3. **Reference validation**: Operations referenced in workflows exist
4. **Contract validation**: Executor implements required methods

## Extension Points

### Custom Metadata

```typescript
metadata: {
  status: 'active' | 'deprecated' | 'beta',
  official: boolean,
  vendor: string,
  homepage: string,
  support: string,
  tags: string[],
}
```

### Custom Headers

```typescript
operations: {
  submit: {
    headers: {
      'X-Custom-Header': 'value',
      'X-Request-ID': '{{requestId}}',
    }
  }
}
```

## Best Practices

1. **Use descriptive IDs**: `vendor-product-version`
2. **Provide localization**: English and Chinese names
3. **Document limitations**: Include in metadata
4. **Version carefully**: Follow semver strictly
5. **Test thoroughly**: Use contract tests
6. **Handle errors**: Map all error scenarios
7. **Set timeouts**: Reasonable defaults
8. **Support streaming**: When provider supports it

## See Also

- [Adapter Development Guide](../development/adapter-development.md)
- [Capability System](../README.md)
- [API Reference](../../skills/api-reference.md)
