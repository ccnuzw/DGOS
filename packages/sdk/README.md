# @dgos/sdk

Official TypeScript SDK for DGOS (Distributed Governance Operating System).

## Installation

```bash
npm install @dgos/sdk
```

## Quick Start

### Using API Key

```typescript
import { DGOSClient } from '@dgos/sdk';

const client = DGOSClient.withApiKey(
  'http://localhost:5000',
  'your-api-key'
);

// Create and run a task
const task = await client.tasks.create({
  prompt: 'Generate an image of a cat',
  model: 'gpt-4',
});

console.log('Task created:', task.taskId);

// Wait for completion
const completed = await client.tasks.waitFor(task.taskId);
console.log('Result:', completed.result);
```

### Using Session

```typescript
const client = DGOSClient.withSession(
  'http://localhost:5000',
  'session-token'
);
```

## API Reference

### Tasks API

Create and manage AI tasks:

```typescript
// Create a task
const task = await client.tasks.create({
  prompt: 'Write a poem about AI',
  model: 'gpt-4',
  providerId: 'openai-provider-id',
});

// Get task status
const status = await client.tasks.get(taskId);

// List tasks
const tasks = await client.tasks.list({
  status: 'completed',
  page: 1,
  pageSize: 20,
});

// Cancel a task
await client.tasks.cancel(taskId);

// Stream task events
for await (const event of client.tasks.stream(taskId)) {
  console.log(event.type, event.data);
}

// Wait for completion
const result = await client.tasks.waitFor(taskId, 60000);
```

### Providers API

Manage AI provider configurations:

```typescript
// List providers
const providers = await client.providers.listConfigs();

// Create provider configuration
const provider = await client.providers.createConfig({
  displayName: 'OpenAI',
  protocolType: 'openai-compatible',
  credential: { apiKey: 'sk-...' },
  defaultForProtocol: true,
});

// Test connection
const test = await client.providers.testConnection({
  protocolType: 'openai-compatible',
  displayName: 'Test Provider',
  credential: { apiKey: 'sk-...' },
});

// List models
const models = await client.providers.listModels(providerId);

// Refresh model catalog
const refreshed = await client.providers.refreshCatalog(providerId);

// Delete provider
await client.providers.deleteConfig(providerId);
```

### Packages API

Install and manage DGOS packages:

```typescript
// List packages
const packages = await client.packages.list();

// Get package details
const pkg = await client.packages.get('ai-workbench');

// Install package
const installation = await client.packages.install('ai-workbench');

// Update package
await client.packages.update('ai-workbench', '2.0.0');

// Uninstall package
await client.packages.uninstall('ai-workbench');
```

### Identity API

Manage authentication and API keys:

```typescript
// Login
const session = await client.identity.login('username', 'password');

// Get current session
const currentSession = await client.identity.getCurrentSession();

// Create API key
const apiKey = await client.identity.createApiKey({
  label: 'My API Key',
  scopes: ['ai_task.submit', 'ai_task.read'],
});

// List API keys
const keys = await client.identity.listApiKeys();

// Rotate API key
const rotated = await client.identity.rotateApiKey(keyId);

// Revoke API key
await client.identity.revokeApiKey(keyId);

// Logout
await client.identity.logout();
```

### Actions API

Execute system actions:

```typescript
// List actions
const actions = await client.actions.list();

// Execute action
const run = await client.actions.execute('action-id', {
  parameter1: 'value1',
});

// Get action run status
const status = await client.actions.getRun(run.runId);
```

### System API

Get system information:

```typescript
// System info
const info = await client.system.info();

// Health check
const health = await client.system.health();

// Get settings
const settings = await client.system.getSettings();

// Update settings
await client.system.updateSettings({
  setting1: 'value1',
});
```

### Artifacts API

Download task artifacts:

```typescript
// Get artifact metadata
const artifact = await client.artifacts.get(artifactId);

// Download artifact
const blob = await client.artifacts.download(artifactId);
```

### Audit API

Query audit logs:

```typescript
// List audit events
const events = await client.audit.list({
  actorId: 'user-id',
  action: 'task.submit',
  startTime: '2024-01-01T00:00:00Z',
  endTime: '2024-12-31T23:59:59Z',
  page: 1,
  pageSize: 50,
});

// Get specific event
const event = await client.audit.get(eventId);

// Export audit logs
const exportBlob = await client.audit.export({
  startTime: '2024-01-01T00:00:00Z',
});
```

## Error Handling

The SDK provides typed error classes:

```typescript
import {
  DGOSSDKError,
  AuthenticationError,
  ValidationError,
  RateLimitError,
  NotFoundError,
} from '@dgos/sdk';

try {
  await client.tasks.create({ prompt: 'test' });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Authentication failed:', error.message);
  } else if (error instanceof RateLimitError) {
    console.error('Rate limited. Retry after:', error.retryAfter);
  } else if (error instanceof ValidationError) {
    console.error('Invalid request:', error.details);
  } else if (error instanceof NotFoundError) {
    console.error('Resource not found');
  }
}
```

## Configuration

### Retry Options

```typescript
const client = new DGOSClient({
  baseUrl: 'http://localhost:5000',
  apiKey: 'your-key',
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 30000,
});
```

### Environment Variables

```bash
DGOS_BASE_URL=http://localhost:5000
DGOS_API_KEY=your-api-key
```

## TypeScript Types

All types are exported for use in your applications:

```typescript
import type {
  Task,
  TaskRequest,
  Provider,
  Model,
  Package,
  Action,
} from '@dgos/sdk';

function processTask(task: Task) {
  // Your code with full type safety
}
```

## Examples

See the `examples/` directory for complete examples:

- `basic-task.ts` - Create and run a simple task
- `streaming-task.ts` - Stream task events in real-time
- `batch-operations.ts` - Run multiple tasks in parallel
- `error-handling.ts` - Comprehensive error handling

## License

MIT
