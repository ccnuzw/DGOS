# DGOS SDK and CLI Documentation

Complete documentation for DGOS TypeScript SDK and Command Line Interface.

## Table of Contents

1. [Getting Started](#getting-started)
2. [SDK Documentation](#sdk-documentation)
3. [CLI Documentation](#cli-documentation)
4. [API Reference](#api-reference)
5. [Examples](#examples)
6. [Best Practices](#best-practices)

## Getting Started

### Prerequisites

- Node.js 18 or later
- DGOS instance running (default: http://localhost:5000)
- API key or session token

### Installation

#### SDK

```bash
npm install @dgos/sdk
```

#### CLI

```bash
npm install -g @dgos/cli
```

### Quick Start

#### SDK

```typescript
import { DGOSClient } from '@dgos/sdk';

const client = DGOSClient.withApiKey(
  'http://localhost:5000',
  'your-api-key'
);

const task = await client.tasks.create({
  prompt: 'Hello, world!',
});
```

#### CLI

```bash
dgos auth login
dgos tasks create "Hello, world!"
```

## SDK Documentation

### Authentication

Three authentication methods are supported:

#### 1. API Key (Recommended for applications)

```typescript
const client = DGOSClient.withApiKey(
  'http://localhost:5000',
  'sk-your-api-key'
);
```

#### 2. Session (For web applications)

```typescript
const client = DGOSClient.withSession(
  'http://localhost:5000',
  'session-token'
);
```

#### 3. Anonymous (Public endpoints only)

```typescript
const client = DGOSClient.anonymous('http://localhost:5000');
```

### Configuration Options

```typescript
const client = new DGOSClient({
  baseUrl: 'http://localhost:5000',
  apiKey: 'your-api-key',
  timeout: 30000,        // Request timeout in ms
  maxRetries: 3,         // Number of retries
  retryDelay: 1000,      // Initial retry delay in ms
});
```

### Tasks API

#### Create Task

```typescript
const task = await client.tasks.create({
  prompt: 'Your prompt here',
  model: 'gpt-4',              // Optional
  providerId: 'provider-id',    // Optional
  parameters: {                 // Optional
    temperature: 0.7,
    maxTokens: 1000,
  },
});
```

#### Get Task Status

```typescript
const task = await client.tasks.get(taskId);
console.log(task.status); // pending, running, completed, failed, cancelled
```

#### List Tasks

```typescript
const tasks = await client.tasks.list({
  status: 'completed',
  page: 1,
  pageSize: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc',
});
```

#### Stream Events

```typescript
for await (const event of client.tasks.stream(taskId)) {
  console.log(event.type, event.data);
}
```

#### Wait for Completion

```typescript
const result = await client.tasks.waitFor(taskId, 60000);
```

#### Cancel Task

```typescript
await client.tasks.cancel(taskId);
```

### Providers API

#### List Provider Configurations

```typescript
const providers = await client.providers.listConfigs();
```

#### Create Provider

```typescript
const provider = await client.providers.createConfig({
  displayName: 'OpenAI',
  protocolType: 'openai-compatible',
  credential: { apiKey: 'sk-...' },
  scope: { endpoint: 'https://api.openai.com/v1' },
  defaultForProtocol: true,
});
```

#### Test Connection

```typescript
const test = await client.providers.testConnection({
  protocolType: 'openai-compatible',
  displayName: 'Test',
  credential: { apiKey: 'sk-...' },
});
```

#### Refresh Model Catalog

```typescript
const models = await client.providers.refreshCatalog(providerId);
```

#### Update Model Policy

```typescript
await client.providers.updatePolicy(providerId, {
  modelId: 'gpt-4',
  allowed: true,
  capabilities: ['text-generation'],
});
```

### Packages API

#### List Packages

```typescript
const packages = await client.packages.list();
```

#### Install Package

```typescript
const installation = await client.packages.install('ai-workbench', '1.0.0');
```

#### Uninstall Package

```typescript
await client.packages.uninstall('ai-workbench');
```

### Identity API

#### Login

```typescript
const session = await client.identity.login('username', 'password');
```

#### Create API Key

```typescript
const apiKey = await client.identity.createApiKey({
  label: 'My Application',
  scopes: ['ai_task.submit', 'ai_task.read'],
});

console.log('API Key:', apiKey.secret);
```

#### List API Keys

```typescript
const keys = await client.identity.listApiKeys();
```

#### Revoke API Key

```typescript
await client.identity.revokeApiKey(keyId);
```

### Error Handling

```typescript
import {
  AuthenticationError,
  ValidationError,
  RateLimitError,
  NotFoundError,
} from '@dgos/sdk';

try {
  await client.tasks.create({ prompt: 'test' });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Auth failed');
  } else if (error instanceof RateLimitError) {
    console.error('Rate limited, retry after:', error.retryAfter);
  } else if (error instanceof ValidationError) {
    console.error('Invalid request:', error.details);
  }
}
```

## CLI Documentation

### Configuration

```bash
# Set base URL
dgos config set baseUrl http://localhost:5000

# Set default output format
dgos config set outputFormat table

# View configuration
dgos config list
```

### Authentication

```bash
# Login with username/password
dgos auth login

# Create API key
dgos auth create-key

# Check authentication status
dgos auth status

# Logout
dgos auth logout
```

### Tasks

```bash
# Create task
dgos tasks create "Your prompt here"

# Create with options
dgos tasks create "Write a poem" --model gpt-4 --wait

# Get task
dgos tasks get <task-id>

# List tasks
dgos tasks list --status completed --format table

# Stream events
dgos tasks stream <task-id>

# Cancel task
dgos tasks cancel <task-id>
```

### Providers

```bash
# List providers
dgos providers list

# Configure provider interactively
dgos providers configure

# Test connection
dgos providers test <provider-id>

# List models
dgos providers models <provider-id>

# Refresh catalog
dgos providers models <provider-id> --refresh
```

### Packages

```bash
# List packages
dgos packages list

# Install package
dgos packages install <package-id>

# Uninstall package
dgos packages uninstall <package-id>
```

## API Reference

### Task Object

```typescript
interface Task {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  request: TaskRequest;
  result?: TaskResult;
  error?: TaskError;
  ownerId: string;
  createdAt: string;
  updatedAt?: string;
}
```

### Provider Object

```typescript
interface Provider {
  providerId: string;
  protocolType: string;
  displayName: string;
  state: 'active' | 'disabled' | 'error';
  version: number;
  createdAt: string;
}
```

### Model Object

```typescript
interface Model {
  modelId: string;
  providerId: string;
  displayName: string;
  capabilities: string[];
  contextWindow?: number;
  maxOutputTokens?: number;
}
```

## Examples

### Basic Task Creation

```typescript
const task = await client.tasks.create({
  prompt: 'Explain quantum computing',
});

const result = await client.tasks.waitFor(task.taskId);
console.log(result.result?.text);
```

### Streaming Task Events

```typescript
for await (const event of client.tasks.stream(taskId)) {
  if (event.type === 'task.chunk') {
    process.stdout.write(event.data.text);
  }
}
```

### Batch Operations

```typescript
const prompts = ['Prompt 1', 'Prompt 2', 'Prompt 3'];

const tasks = await Promise.all(
  prompts.map(prompt => client.tasks.create({ prompt }))
);

const results = await Promise.all(
  tasks.map(task => client.tasks.waitFor(task.taskId))
);
```

### Provider Setup

```typescript
const provider = await client.providers.createConfig({
  displayName: 'OpenAI',
  protocolType: 'openai-compatible',
  credential: { apiKey: process.env.OPENAI_API_KEY },
});

await client.providers.refreshCatalog(provider.providerId);
```

## Best Practices

### 1. Error Handling

Always handle errors appropriately:

```typescript
try {
  const task = await client.tasks.create({ prompt });
} catch (error) {
  if (error instanceof RateLimitError) {
    // Wait and retry
  } else if (error instanceof ValidationError) {
    // Fix input and retry
  } else {
    // Log and report
  }
}
```

### 2. Resource Management

Clean up resources when done:

```typescript
try {
  // Create and use resources
} finally {
  // Clean up if needed
}
```

### 3. Timeout Configuration

Set appropriate timeouts:

```typescript
const client = new DGOSClient({
  baseUrl: 'http://localhost:5000',
  apiKey: 'your-key',
  timeout: 60000, // 60 seconds for long-running tasks
});
```

### 4. Retry Logic

Implement retry logic for transient failures:

```typescript
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await sleep(1000 * Math.pow(2, i));
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 5. Rate Limiting

Respect rate limits:

```typescript
const tasks = [];
for (let i = 0; i < prompts.length; i += 5) {
  const batch = prompts.slice(i, i + 5);
  const batchTasks = await Promise.all(
    batch.map(p => client.tasks.create({ prompt: p }))
  );
  tasks.push(...batchTasks);
  await sleep(1000); // Rate limit
}
```

### 6. Sensitive Data

Never log API keys or secrets:

```typescript
// Bad
console.log('API Key:', apiKey);

// Good
console.log('API Key prefix:', apiKey.substring(0, 8) + '...');
```

### 7. Type Safety

Use TypeScript types:

```typescript
import type { Task, TaskRequest } from '@dgos/sdk';

function processTask(task: Task) {
  // Full type safety
}
```

## Troubleshooting

### Connection Issues

```bash
# Test connectivity
dgos system health

# Verify configuration
dgos config list
```

### Authentication Issues

```bash
# Check authentication
dgos auth status

# Re-authenticate
dgos auth logout
dgos auth login
```

### Debug Mode

```bash
# Enable verbose output
dgos --verbose tasks list
```

## Support

- Documentation: https://docs.dgos.dev
- GitHub: https://github.com/dgos/dgos
- Issues: https://github.com/dgos/dgos/issues
