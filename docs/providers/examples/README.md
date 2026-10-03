# Provider Adapter Examples

Real-world examples of implementing provider adapters.

## Table of Contents

1. [OpenAI-Compatible Adapter](#openai-compatible-adapter)
2. [Async Workflow Adapter](#async-workflow-adapter)
3. [Streaming Adapter](#streaming-adapter)
4. [Custom REST API Adapter](#custom-rest-api-adapter)
5. [Multi-Modal Adapter](#multi-modal-adapter)

---

## OpenAI-Compatible Adapter

The simplest adapter for OpenAI-compatible APIs.

### Adapter Definition

```typescript
import { ProviderAdapter, OpenAICompatibleExecutor } from '@dgos/provider-adapter';

export const openaiAdapter: ProviderAdapter = {
  adapterId: 'openai-compatible',
  name: { en: 'OpenAI-Compatible API', zh: 'OpenAI 兼容 API' },
  version: '1.0.0',
  protocol: 'openai-compatible',

  capabilities: [
    {
      capability: 'text.chat',
      operations: {
        submit: {
          method: 'POST',
          path: '/chat/completions',
          bodyTemplate: {
            model: '{{model}}',
            messages: '{{messages}}',
            temperature: '{{temperature}}',
            max_tokens: '{{max_tokens}}',
            stream: '{{stream}}',
          },
          responseMapping: {
            taskId: '$.id',
            content: '$.choices[0].message.content',
            finishReason: '$.choices[0].finish_reason',
            usage: {
              promptTokens: '$.usage.prompt_tokens',
              completionTokens: '$.usage.completion_tokens',
              totalTokens: '$.usage.total_tokens',
            },
          },
        },
      },
      workflows: [
        {
          name: 'chat-sync',
          type: 'sync',
          steps: [{ operation: 'submit' }],
          statusMapping: {
            success: '$.choices[0].finish_reason == "stop"',
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
  modelCatalogEndpoint: '/models',

  executor: new OpenAICompatibleExecutor({
    submit: {
      method: 'POST',
      path: '/chat/completions',
      bodyTemplate: {
        model: '{{model}}',
        messages: '{{messages}}',
        stream: '{{stream}}',
      },
      responseMapping: {
        taskId: '$.id',
        content: '$.choices[0].message.content',
        finishReason: '$.choices[0].finish_reason',
        usage: {
          promptTokens: '$.usage.prompt_tokens',
          completionTokens: '$.usage.completion_tokens',
          totalTokens: '$.usage.total_tokens',
        },
      },
    },
  }),
};
```

### Usage

```typescript
import { globalRegistry } from '@dgos/provider-adapter';

await globalRegistry.register(openaiAdapter);

const adapter = await globalRegistry.get('openai-compatible');
const response = await adapter.executor.execute({
  capability: 'text.chat',
  model: 'gpt-4',
  connection: {
    baseUrl: 'https://api.openai.com/v1',
    credential: process.env.OPENAI_API_KEY,
  },
  parameters: {
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'What is the capital of France?' },
    ],
    temperature: 0.7,
    max_tokens: 100,
  },
});

console.log(response.content); // "The capital of France is Paris."
```

---

## Async Workflow Adapter

For APIs that use submit-then-poll pattern (e.g., image generation).

### Executor Implementation

```typescript
import { BaseAdapterExecutor, AdapterRequest, AdapterResponse, TestResult } from '@dgos/provider-adapter';

export class AsyncWorkflowExecutor extends BaseAdapterExecutor {
  async execute(request: AdapterRequest): Promise<AdapterResponse> {
    // Step 1: Submit task
    const submitUrl = this.buildUrl(request.connection.baseUrl, '/tasks');
    const submitResponse = await this.executeRequest(
      submitUrl,
      {
        method: 'POST',
        headers: this.buildHeaders(request.connection),
        body: JSON.stringify({
          prompt: request.parameters.prompt,
          model: request.model,
        }),
      },
      request.timeoutMs
    );

    if (!submitResponse.ok) {
      throw await this.parseError(submitResponse);
    }

    const submitData = await submitResponse.json();
    const taskId = submitData.task_id;

    // Step 2: Poll for completion
    const maxAttempts = 30;
    const pollInterval = 2000; // 2 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const pollUrl = this.buildUrl(request.connection.baseUrl, `/tasks/${taskId}`);
      const pollResponse = await this.executeRequest(
        pollUrl,
        {
          method: 'GET',
          headers: this.buildHeaders(request.connection),
        },
        10000
      );

      if (!pollResponse.ok) {
        throw await this.parseError(pollResponse);
      }

      const pollData = await pollResponse.json();

      if (pollData.status === 'completed') {
        return {
          taskId,
          content: pollData.result_url,
          finishReason: 'completed',
          rawResponse: pollData,
        };
      }

      if (pollData.status === 'failed') {
        throw new Error(pollData.error || 'Task failed');
      }

      // Still pending or processing, continue polling
    }

    throw new Error('Task timed out');
  }

  async test(connection: ConnectionConfig): Promise<TestResult> {
    try {
      const url = this.buildUrl(connection.baseUrl, '/health');
      const response = await this.executeRequest(
        url,
        { method: 'GET', headers: this.buildHeaders(connection) },
        10000
      );

      return {
        success: response.ok,
        message: response.ok ? 'Connection successful' : 'Connection failed',
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}
```

### Adapter Definition

```typescript
export const asyncAdapter: ProviderAdapter = {
  adapterId: 'async-provider',
  name: { en: 'Async Image Provider', zh: '异步图像提供商' },
  version: '1.0.0',
  protocol: 'custom-async',

  capabilities: [
    {
      capability: 'image.generate',
      operations: {
        submit: {
          method: 'POST',
          path: '/tasks',
          bodyTemplate: {
            prompt: '{{prompt}}',
            model: '{{model}}',
          },
          responseMapping: {
            taskId: '$.task_id',
          },
        },
        poll: {
          method: 'GET',
          path: '/tasks/{{taskId}}',
          responseMapping: {
            content: '$.result_url',
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
  ],

  connectionSchema: {
    type: 'object',
    required: ['baseUrl', 'credential'],
    properties: {
      baseUrl: { type: 'string' },
      credential: { type: 'string' },
    },
  },

  authentication: ['api-key'],
  executor: new AsyncWorkflowExecutor(),
};
```

---

## Streaming Adapter

For Server-Sent Events (SSE) streaming responses.

### Executor with Streaming

```typescript
export class StreamingExecutor extends BaseAdapterExecutor {
  async execute(request: AdapterRequest): Promise<AdapterResponse> {
    // Non-streaming version
    const response = await this.executeRequest(
      this.buildUrl(request.connection.baseUrl, '/chat/completions'),
      {
        method: 'POST',
        headers: this.buildHeaders(request.connection),
        body: JSON.stringify({
          model: request.model,
          messages: request.parameters.messages,
          stream: false,
        }),
      },
      request.timeoutMs
    );

    if (!response.ok) throw await this.parseError(response);
    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      finishReason: data.choices[0].finish_reason,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      },
      rawResponse: data,
    };
  }

  async *stream(request: AdapterRequest): AsyncGenerator<AdapterEvent> {
    const response = await this.executeRequest(
      this.buildUrl(request.connection.baseUrl, '/chat/completions'),
      {
        method: 'POST',
        headers: this.buildHeaders(request.connection),
        body: JSON.stringify({
          model: request.model,
          messages: request.parameters.messages,
          stream: true,
        }),
      },
      request.timeoutMs
    );

    if (!response.ok) throw await this.parseError(response);
    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      yield {
        type: 'start',
        data: { model: request.model },
        timestamp: new Date().toISOString(),
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            yield {
              type: 'done',
              data: null,
              timestamp: new Date().toISOString(),
            };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;

            if (delta?.content) {
              yield {
                type: 'delta',
                data: { content: delta.content },
                timestamp: new Date().toISOString(),
              };
            }

            if (parsed.usage) {
              yield {
                type: 'usage',
                data: parsed.usage,
                timestamp: new Date().toISOString(),
              };
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async test(connection: ConnectionConfig): Promise<TestResult> {
    try {
      const response = await this.executeRequest(
        this.buildUrl(connection.baseUrl, '/models'),
        { method: 'GET', headers: this.buildHeaders(connection) },
        10000
      );

      if (!response.ok) {
        return {
          success: false,
          message: `HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        message: `Found ${data.data?.length || 0} models`,
        details: { modelsFound: data.data?.length || 0 },
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}
```

### Usage

```typescript
const adapter = await globalRegistry.get('streaming-adapter');

console.log('Streaming response:');
for await (const event of adapter.executor.stream({
  capability: 'text.chat',
  model: 'gpt-4',
  connection: {
    baseUrl: 'https://api.openai.com/v1',
    credential: process.env.OPENAI_API_KEY,
  },
  parameters: {
    messages: [{ role: 'user', content: 'Tell me a short story' }],
  },
})) {
  if (event.type === 'delta') {
    process.stdout.write(event.data.content);
  } else if (event.type === 'usage') {
    console.log(`\n\nTokens used: ${event.data.total_tokens}`);
  } else if (event.type === 'done') {
    console.log('\n✓ Complete');
  }
}
```

---

## Custom REST API Adapter

For custom APIs with non-standard formats.

```typescript
export class CustomAPIExecutor extends BaseAdapterExecutor {
  async execute(request: AdapterRequest): Promise<AdapterResponse> {
    // Custom API uses different format
    const customBody = {
      input: {
        text: request.parameters.messages[0].content,
        model_name: request.model,
        config: {
          temperature: request.parameters.temperature || 0.7,
        },
      },
    };

    const response = await this.executeRequest(
      this.buildUrl(request.connection.baseUrl, '/api/generate'),
      {
        method: 'POST',
        headers: {
          ...this.buildHeaders(request.connection),
          'X-Custom-Version': '2024-01',
        },
        body: JSON.stringify(customBody),
      },
      request.timeoutMs
    );

    if (!response.ok) throw await this.parseError(response);
    const data = await response.json();

    // Map custom response format to standard format
    return {
      taskId: data.request_id,
      content: data.output.generated_text,
      finishReason: data.output.stop_reason === 'END' ? 'stop' : 'length',
      usage: {
        promptTokens: data.metrics.input_tokens,
        completionTokens: data.metrics.output_tokens,
        totalTokens: data.metrics.total_tokens,
      },
      rawResponse: data,
    };
  }

  async test(connection: ConnectionConfig): Promise<TestResult> {
    try {
      const response = await this.executeRequest(
        this.buildUrl(connection.baseUrl, '/api/status'),
        {
          method: 'GET',
          headers: this.buildHeaders(connection),
        },
        10000
      );

      const data = await response.json();
      return {
        success: data.status === 'operational',
        message: data.message || 'API operational',
        details: data,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}
```

---

## Multi-Modal Adapter

Supporting multiple capabilities (text, image, audio).

```typescript
export const multiModalAdapter: ProviderAdapter = {
  adapterId: 'multi-modal-provider',
  name: { en: 'Multi-Modal Provider', zh: '多模态提供商' },
  version: '1.0.0',
  protocol: 'custom',

  capabilities: [
    {
      capability: 'text.chat',
      operations: {
        submit: {
          method: 'POST',
          path: '/v1/chat',
          bodyTemplate: {
            model: '{{model}}',
            messages: '{{messages}}',
          },
          responseMapping: {
            content: '$.response.text',
            finishReason: '$.response.finish_reason',
          },
        },
      },
      workflows: [
        {
          name: 'chat-sync',
          type: 'sync',
          steps: [{ operation: 'submit' }],
          statusMapping: {
            success: '$.response.finish_reason == "complete"',
          },
        },
      ],
    },
    {
      capability: 'image.generate',
      operations: {
        submit: {
          method: 'POST',
          path: '/v1/images/generate',
          bodyTemplate: {
            prompt: '{{prompt}}',
            model: '{{model}}',
            size: '{{size}}',
          },
          responseMapping: {
            taskId: '$.job_id',
          },
        },
        poll: {
          method: 'GET',
          path: '/v1/images/{{taskId}}',
          responseMapping: {
            content: '$.image_url',
            finishReason: '$.status',
          },
        },
      },
      workflows: [
        {
          name: 'image-async',
          type: 'async',
          steps: [
            { operation: 'submit' },
            {
              operation: 'poll',
              retryPolicy: {
                maxAttempts: 20,
                backoffMs: 3000,
              },
            },
          ],
          statusMapping: {
            pending: '$.status == "queued"',
            running: '$.status == "processing"',
            success: '$.status == "completed"',
            failure: '$.status == "error"',
          },
        },
      ],
    },
    {
      capability: 'audio.understand',
      operations: {
        submit: {
          method: 'POST',
          path: '/v1/audio/transcribe',
          bodyTemplate: {
            audio_url: '{{audioUrl}}',
            model: '{{model}}',
          },
          responseMapping: {
            content: '$.transcription',
            finishReason: '$.status',
          },
        },
      },
      workflows: [
        {
          name: 'transcribe-sync',
          type: 'sync',
          steps: [{ operation: 'submit' }],
          statusMapping: {
            success: '$.status == "completed"',
          },
        },
      ],
    },
  ],

  connectionSchema: {
    type: 'object',
    required: ['baseUrl', 'credential'],
    properties: {
      baseUrl: { type: 'string' },
      credential: { type: 'string' },
    },
  },

  authentication: ['bearer'],
  executor: new MultiModalExecutor(),
};
```

## Testing Examples

```typescript
import { AdapterContractTests, createMockConnection } from '@dgos/provider-adapter/testing';

describe('Adapter Tests', () => {
  const connection = createMockConnection({
    baseUrl: process.env.TEST_API_URL,
    credential: process.env.TEST_API_KEY,
  });

  test('Contract tests', async () => {
    const tests = new AdapterContractTests(openaiAdapter);
    const results = await tests.runAll(connection);

    expect(results.failed).toBe(0);
    console.log(`✓ ${results.passed} tests passed`);
  });

  test('Real API call', async () => {
    const response = await openaiAdapter.executor.execute({
      capability: 'text.chat',
      model: 'gpt-3.5-turbo',
      connection,
      parameters: {
        messages: [{ role: 'user', content: 'Say hello' }],
        max_tokens: 10,
      },
    });

    expect(response.content).toBeTruthy();
    expect(response.usage?.totalTokens).toBeGreaterThan(0);
  });
});
```

## See Also

- [Adapter Development Guide](../development/adapter-development.md)
- [Protocol Reference](../reference/protocol-reference.md)
- [Testing Guide](../development/testing.md)
