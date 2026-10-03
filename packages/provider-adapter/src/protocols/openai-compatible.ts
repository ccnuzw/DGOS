// OpenAI-Compatible Adapter Protocol Definition

import { OpenAICompatibleExecutor } from '../executor/openai-compatible.js';
import type { ProviderAdapter } from '../types.js';

export const openaiCompatibleAdapter: ProviderAdapter = {
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
            stream: '{{stream}}',
            temperature: '{{temperature}}',
            max_tokens: '{{max_tokens}}',
            top_p: '{{top_p}}',
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
          name: 'text-chat-sync',
          type: 'sync',
          steps: [{ operation: 'submit' }],
          statusMapping: {
            success: "$.choices[0].finish_reason == 'stop'",
            failure: '$.error != null',
          },
        },
        {
          name: 'text-chat-streaming',
          type: 'streaming',
          steps: [{ operation: 'submit' }],
          statusMapping: {
            success: "[DONE]",
            failure: '$.error != null',
          },
        },
      ],
    },
    {
      capability: 'text.completion',
      operations: {
        submit: {
          method: 'POST',
          path: '/completions',
          bodyTemplate: {
            model: '{{model}}',
            prompt: '{{prompt}}',
            stream: '{{stream}}',
            temperature: '{{temperature}}',
            max_tokens: '{{max_tokens}}',
          },
          responseMapping: {
            taskId: '$.id',
            content: '$.choices[0].text',
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
          name: 'text-completion-sync',
          type: 'sync',
          steps: [{ operation: 'submit' }],
          statusMapping: {
            success: "$.choices[0].finish_reason == 'stop'",
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
      baseUrl: {
        type: 'string',
        format: 'uri',
        description: 'Base URL of the API endpoint',
      },
      credential: {
        type: 'string',
        description: 'API key or bearer token',
      },
    },
  },

  modelCatalogEndpoint: '/models',

  authentication: ['bearer'],

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

  metadata: {
    status: 'active',
    official: true,
  },
};
