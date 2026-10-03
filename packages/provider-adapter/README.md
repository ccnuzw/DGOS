# @dgos/provider-adapter

Provider Adapter registry, protocol system, and executor framework for DGOS V1.

## Features

- **Adapter Registry**: Register and manage provider adapters
- **Protocol System**: Declarative capability definitions with JSONPath mapping
- **Executor Framework**: Base classes for implementing adapter executors
- **Provider Presets**: Pre-configured popular providers (OpenAI, Anthropic, DeepSeek, etc.)
- **Testing Utilities**: Contract tests and validation tools

## Installation

```bash
npm install @dgos/provider-adapter
```

## Quick Start

### Using a Provider Preset

```typescript
import { getPreset, globalRegistry, openaiCompatibleAdapter } from '@dgos/provider-adapter';

// Register the OpenAI-compatible adapter
await globalRegistry.register(openaiCompatibleAdapter);

// Get a provider preset
const openaiPreset = getPreset('openai');

// Create connection config
const connection = {
  baseUrl: openaiPreset.defaultBaseUrl,
  credential: 'your-api-key',
};

// Execute a request
const adapter = await globalRegistry.get('openai-compatible');
const response = await adapter.executor.execute({
  capability: 'text.chat',
  model: 'gpt-4',
  connection,
  parameters: {
    messages: [{ role: 'user', content: 'Hello!' }],
  },
});

console.log(response.content);
```

### Testing a Connection

```typescript
import { openaiCompatibleAdapter } from '@dgos/provider-adapter';

const result = await openaiCompatibleAdapter.executor.test({
  baseUrl: 'https://api.openai.com/v1',
  credential: 'your-api-key',
});

if (result.success) {
  console.log(`✓ ${result.message}`);
  console.log(`Found ${result.details.modelsFound} models`);
} else {
  console.error(`✗ ${result.message}`);
}
```

### Streaming Responses

```typescript
const adapter = await globalRegistry.get('openai-compatible');

for await (const event of adapter.executor.stream({
  capability: 'text.chat',
  model: 'gpt-4',
  connection,
  parameters: {
    messages: [{ role: 'user', content: 'Tell me a story' }],
  },
})) {
  if (event.type === 'delta') {
    process.stdout.write(event.data.content);
  } else if (event.type === 'done') {
    console.log('\n✓ Complete');
  }
}
```

## Provider Presets

Pre-configured providers available:

- **openai** - OpenAI (GPT-4, GPT-3.5)
- **anthropic** - Anthropic (Claude)
- **deepseek** - DeepSeek
- **zhipu** - Zhipu AI (GLM)
- **moonshot** - Moonshot AI
- **groq** - Groq
- **together** - Together AI

```typescript
import { listPresets } from '@dgos/provider-adapter';

// List all official presets
const official = listPresets({ official: true });

// Search presets
const chinese = listPresets({ tag: 'china' });
```

## Creating Custom Adapters

```typescript
import { BaseAdapterExecutor, ProviderAdapter } from '@dgos/provider-adapter';

class MyCustomExecutor extends BaseAdapterExecutor {
  async execute(request) {
    // Implement your logic
    const response = await fetch(/* ... */);
    return this.mapResponse(response, mapping);
  }

  async test(connection) {
    // Test connection
    return { success: true, message: 'Connected!' };
  }
}

const myAdapter: ProviderAdapter = {
  adapterId: 'my-custom-adapter',
  name: { en: 'My Custom API', zh: '我的自定义API' },
  version: '1.0.0',
  protocol: 'custom',
  capabilities: [/* ... */],
  connectionSchema: {/* ... */},
  authentication: ['bearer'],
  executor: new MyCustomExecutor(),
};

// Register it
await globalRegistry.register(myAdapter);
```

## Testing

```typescript
import { AdapterContractTests, createMockConnection } from '@dgos/provider-adapter/testing';

const tests = new AdapterContractTests(myAdapter);
const results = await tests.runAll(createMockConnection({
  baseUrl: 'https://api.example.com',
  credential: 'test-key',
}));

console.log(`Passed: ${results.passed}, Failed: ${results.failed}`);
```

## License

MIT
