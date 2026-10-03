# Adapter Development Guide

Learn how to create custom provider adapters for DGOS V1.

## Architecture Overview

```
┌─────────────────┐
│  DGOS Core      │
├─────────────────┤
│ Adapter Registry│◄─── Register adapters
├─────────────────┤
│ Executor Engine │◄─── Execute requests
├─────────────────┤
│ Protocol Parser │◄─── Parse definitions
└────────┬────────┘
         │
    ┌────▼────────────────────┐
    │  Provider Adapter       │
    ├─────────────────────────┤
    │ - Capability Definitions│
    │ - Operations Mapping    │
    │ - Response Parsing      │
    │ - Executor Logic        │
    └────────┬────────────────┘
             │
        ┌────▼─────┐
        │ Provider │
        │   API    │
        └──────────┘
```

## Creating a Simple Adapter

### Step 1: Define the Adapter Structure

```typescript
import { ProviderAdapter, BaseAdapterExecutor } from '@dgos/provider-adapter';

const myAdapter: ProviderAdapter = {
  adapterId: 'my-provider',
  name: { en: 'My Provider', zh: '我的提供商' },
  version: '1.0.0',
  protocol: 'custom',
  
  capabilities: [
    {
      capability: 'text.chat',
      operations: {
        submit: {
          method: 'POST',
          path: '/chat',
          bodyTemplate: {
            model: '{{model}}',
            messages: '{{messages}}',
          },
          responseMapping: {
            content: '$.response.text',
            finishReason: '$.response.stop_reason',
          },
        },
      },
      workflows: [
        {
          name: 'chat-sync',
          type: 'sync',
          steps: [{ operation: 'submit' }],
          statusMapping: {
            success: '$.response.stop_reason == "complete"',
            failure: '$.error != null',
          },
        },
      ],
    },
  ],
  
  connectionSchema: {
    type: 'object',
    required: ['baseUrl', 'credential'],
    properties: {
      baseUrl: { type: 'string', format: 'uri' },
      credential: { type: 'string' },
    },
  },
  
  authentication: ['bearer'],
  
  executor: new MyCustomExecutor(),
};
```

### Step 2: Implement the Executor

```typescript
import { BaseAdapterExecutor, AdapterRequest, AdapterResponse, ConnectionConfig, TestResult } from '@dgos/provider-adapter';

class MyCustomExecutor extends BaseAdapterExecutor {
  async execute(request: AdapterRequest): Promise<AdapterResponse> {
    // Get the operation definition
    const operation = request.parameters.operation || 'submit';
    
    // Build request body
    const body = this.renderTemplate({
      model: '{{model}}',
      messages: '{{messages}}',
    }, {
      model: request.model,
      messages: request.parameters.messages,
    });
    
    // Build URL
    const url = this.buildUrl(request.connection.baseUrl, '/chat');
    
    // Execute HTTP request
    const response = await this.executeRequest(
      url,
      {
        method: 'POST',
        headers: this.buildHeaders(request.connection),
        body: JSON.stringify(body),
      },
      request.timeoutMs || 60000
    );
    
    if (!response.ok) {
      throw await this.parseError(response);
    }
    
    const rawResponse = await response.json();
    
    // Map response
    const mapped = this.mapResponse(rawResponse, {
      content: '$.response.text',
      finishReason: '$.response.stop_reason',
    });
    
    return {
      ...mapped,
      rawResponse,
    };
  }
  
  async test(connection: ConnectionConfig): Promise<TestResult> {
    try {
      const url = this.buildUrl(connection.baseUrl, '/health');
      const response = await this.executeRequest(
        url,
        {
          method: 'GET',
          headers: this.buildHeaders(connection),
        },
        10000
      );
      
      if (!response.ok) {
        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
      
      return {
        success: true,
        message: 'Connection successful',
        details: {
          responseTime: Date.now(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
```

### Step 3: Register the Adapter

```typescript
import { globalRegistry } from '@dgos/provider-adapter';

await globalRegistry.register(myAdapter);
```

### Step 4: Use the Adapter

```typescript
const adapter = await globalRegistry.get('my-provider');

const response = await adapter.executor.execute({
  capability: 'text.chat',
  model: 'my-model',
  connection: {
    baseUrl: 'https://api.example.com',
    credential: 'my-api-key',
  },
  parameters: {
    messages: [{ role: 'user', content: 'Hello!' }],
  },
});

console.log(response.content);
```

## Advanced Features

### Streaming Support

```typescript
class StreamingExecutor extends BaseAdapterExecutor {
  async *stream(request: AdapterRequest): AsyncGenerator<AdapterEvent> {
    const url = this.buildUrl(request.connection.baseUrl, '/stream');
    
    const response = await this.executeRequest(url, {
      method: 'POST',
      headers: this.buildHeaders(request.connection),
      body: JSON.stringify({ ...request.parameters, stream: true }),
    });
    
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const text = decoder.decode(value);
      const lines = text.split('\n').filter(Boolean);
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          
          yield {
            type: 'delta',
            data: { content: data.text },
            timestamp: new Date().toISOString(),
          };
        }
      }
    }
    
    yield {
      type: 'done',
      data: null,
      timestamp: new Date().toISOString(),
    };
  }
}
```

### Async Workflows

For providers with async task submission and polling:

```typescript
capabilities: [
  {
    capability: 'image.generate',
    operations: {
      submit: {
        method: 'POST',
        path: '/images/generate',
        bodyTemplate: { prompt: '{{prompt}}' },
        responseMapping: { taskId: '$.task_id' },
      },
      poll: {
        method: 'GET',
        path: '/images/{{taskId}}',
        responseMapping: {
          content: '$.image_url',
          finishReason: '$.status',
        },
      },
    },
    workflows: [
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
      },
    ],
  },
]
```

### Custom Authentication

```typescript
class CustomAuthExecutor extends BaseAdapterExecutor {
  protected buildHeaders(connection: ConnectionConfig): Record<string, string> {
    const headers = super.buildHeaders(connection);
    
    // Add custom authentication
    if (connection.credential.type === 'hmac') {
      const signature = this.computeHMAC(connection.credential);
      headers['X-Signature'] = signature;
      headers['X-Timestamp'] = Date.now().toString();
    }
    
    return headers;
  }
  
  private computeHMAC(credential: any): string {
    // Implement HMAC signature
    return 'signature';
  }
}
```

### Model Catalog Integration

```typescript
const myAdapter: ProviderAdapter = {
  // ... other config
  
  modelCatalogEndpoint: '/models',
  
  modelProfiles: [
    {
      modelId: 'my-model-v1',
      capabilities: ['text.chat'],
      limits: {
        maxTokens: 4096,
        contextWindow: 16384,
      },
      pricing: {
        inputTokenCost: 0.0001,
        outputTokenCost: 0.0002,
        currency: 'USD',
      },
      features: ['streaming', 'tools', 'vision'],
    },
  ],
};
```

## Testing Your Adapter

### Unit Tests

```typescript
import { AdapterContractTests, createMockConnection } from '@dgos/provider-adapter/testing';

describe('MyCustomAdapter', () => {
  it('should pass contract tests', async () => {
    const tests = new AdapterContractTests(myAdapter);
    const results = await tests.runAll(createMockConnection({
      baseUrl: 'https://api.example.com',
      credential: 'test-key',
    }));
    
    expect(results.failed).toBe(0);
    expect(results.passed).toBeGreaterThan(0);
  });
  
  it('should execute text.chat capability', async () => {
    const response = await myAdapter.executor.execute({
      capability: 'text.chat',
      model: 'test-model',
      connection: createMockConnection(),
      parameters: {
        messages: [{ role: 'user', content: 'Test' }],
      },
    });
    
    expect(response.content).toBeDefined();
  });
});
```

### Integration Tests

```typescript
describe('MyAdapter Integration', () => {
  const connection = {
    baseUrl: process.env.TEST_API_URL,
    credential: process.env.TEST_API_KEY,
  };
  
  it('should connect to real API', async () => {
    const result = await myAdapter.executor.test(connection);
    expect(result.success).toBe(true);
  });
  
  it('should execute real request', async () => {
    const response = await myAdapter.executor.execute({
      capability: 'text.chat',
      model: 'production-model',
      connection,
      parameters: {
        messages: [{ role: 'user', content: 'Hello' }],
      },
    });
    
    expect(response.content).toBeTruthy();
  });
});
```

## Publishing Your Adapter

### 1. Validate

```bash
npm run validate-adapter ./my-adapter.json
```

### 2. Document

Create README with:
- Supported capabilities
- Configuration requirements
- Model list
- Example usage
- Limitations

### 3. Submit

```bash
# Fork the adapter registry
git clone https://github.com/dgos/adapter-registry
cd adapter-registry

# Add your adapter
cp my-adapter.ts adapters/my-provider/

# Create PR
git add .
git commit -m "Add my-provider adapter"
git push origin add-my-provider
```

## Best Practices

1. **Error Handling**: Always handle API errors gracefully
2. **Timeouts**: Set reasonable timeouts for all operations
3. **Retries**: Implement retry logic for transient failures
4. **Rate Limiting**: Respect provider rate limits
5. **Logging**: Log important events for debugging
6. **Security**: Never log credentials or sensitive data
7. **Testing**: Write comprehensive tests
8. **Documentation**: Document all capabilities and limitations

## Examples

See the [examples directory](../examples/) for complete implementations:

- [OpenAI-Compatible Adapter](../examples/README.md)
- [Async Workflow Adapter](../examples/README.md)
- [Custom REST API Adapter](../examples/README.md)
- [Streaming Adapter](../examples/README.md)

## Next Steps

- [Protocol Reference](../reference/protocol-reference.md)
- [API Reference](../README.md)
- [Capability System](../README.md)
