# DGOS V1 Developer Guide

**Version**: V1.0.0  
**Last Updated**: 2026-10-02  
**Audience**: Developers, Contributors

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Development Setup](#development-setup)
3. [Extension Development](#extension-development)
4. [MCP Integration](#mcp-integration)
5. [Skills Development](#skills-development)
6. [Testing Guide](#testing-guide)
7. [API Integration](#api-integration)
8. [Contribution Guide](#contribution-guide)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────┐
│           Desktop (Tauri + macOS)           │
│  ┌────────────────────────────────────┐    │
│  │      Web Frontend (React/Vite)     │    │
│  └────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────┐
│         API Server (Fastify/Node.js)        │
│  ┌────────────┐  ┌──────────┐  ┌────────┐  │
│  │ Identity   │  │ Provider │  │  Task  │  │
│  │ Management │  │ Adapter  │  │ Engine │  │
│  └────────────┘  └──────────┘  └────────┘  │
└─────────────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ↓           ↓           ↓
    PostgreSQL    Redis      Worker
    (Storage)    (Cache)   (Background)
```

### Technology Stack

**Frontend**:
- React 18 with TypeScript
- Vite for build tooling
- Design tokens for theming
- i18n support (en/zh)

**Backend**:
- Node.js v22+
- Fastify web framework
- PostgreSQL 16 for data
- Redis 7 for cache/sessions

**Desktop**:
- Tauri 2 framework
- Native macOS integration
- Secure IPC bridge

**Infrastructure**:
- Docker Compose for local dev
- pnpm workspaces
- ESM modules

### Directory Structure

```
DGOS/
├── apps/
│   ├── api/              # API server
│   ├── worker/           # Background worker
│   ├── web/              # Web frontend
│   └── desktop/          # Desktop app (Tauri)
├── packages/
│   ├── sdk/              # Shared SDK
│   ├── contracts/        # Contracts & constants
│   ├── design-tokens/    # UI tokens
│   └── app-shell/        # Application shell
├── src/
│   ├── identity/         # Identity management
│   ├── provider/         # Provider adapters
│   ├── task/             # Task engine
│   ├── security/         # Security modules
│   └── permissions/      # Permission system
├── migrations/           # Database migrations
├── tests/               # Test suites
│   ├── integration/     # Integration tests
│   ├── security/        # Security tests
│   └── e2e/             # End-to-end tests
└── docs/                # Documentation
```

---

## Development Setup

### Prerequisites

1. **Install Node.js v22**:
   ```bash
   nvm install 22
   nvm use 22
   ```

2. **Install pnpm**:
   ```bash
   npm install -g pnpm@9.0.0
   ```

3. **Install Docker**:
   - Docker Desktop for macOS
   - Or Docker Engine on Linux

4. **Clone Repository**:
   ```bash
   git clone <repository-url>
   cd DGOS
   ```

### Initial Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Start infrastructure**:
   ```bash
   docker compose up -d
   ```

4. **Run migrations**:
   ```bash
   pnpm migrate:plan
   ```

5. **Verify setup**:
   ```bash
   pnpm test
   pnpm run check
   ```

### Development Workflow

**Start API server**:
```bash
pnpm --filter @dgos/api dev
```

**Start worker**:
```bash
pnpm --filter @dgos/worker dev
```

**Start web frontend**:
```bash
pnpm --filter @dgos/web dev
```

**Start desktop app**:
```bash
cd apps/desktop
pnpm tauri dev
```

**Run all in parallel**:
```bash
pnpm dev
```

### Environment Variables

**Required**:
```env
# Database
DATABASE_URL=postgres://dgos:dgos@localhost:5432/dgos

# Redis
REDIS_URL=redis://localhost:6379

# API
API_PORT=3000
API_HOST=0.0.0.0

# Security
SECRET_KEY=<generate-secure-key>
SESSION_SECRET=<generate-secure-key>
```

**Optional**:
```env
# Logging
LOG_LEVEL=info

# Development
NODE_ENV=development

# Provider Fixture
DGOS_FIXTURE_PORT=3100
DGOS_FIXTURE_TOKEN=test-token
```

### Database Management

**Create migration**:
```bash
# Migrations are frozen in V1
# New migrations for V2+
```

**Run migrations**:
```bash
pnpm migrate:plan
```

**Check migration status**:
```bash
pnpm migrate:check
```

**View SQL**:
```bash
pnpm migrate:sql
```

---

## Extension Development

### Extension Package Structure

```
my-extension/
├── manifest.json         # Extension metadata
├── index.js             # Entry point
├── skills/              # Skill definitions
│   └── my-skill.json
├── credentials/         # Credential templates
│   └── api-key.json
└── README.md           # Documentation
```

### Extension Manifest

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "displayName": "My Extension",
  "description": "Does something useful",
  "author": "Your Name",
  "permissions": [
    "network:outbound",
    "storage:read",
    "storage:write"
  ],
  "capabilities": ["skill", "mcp"],
  "entrypoint": "./index.js",
  "icon": "./icon.png"
}
```

### Extension API

**Initialize Extension**:
```javascript
export async function initialize(context) {
  const { logger, storage, network } = context;
  
  logger.info('Extension initializing');
  
  // Setup
  await storage.set('initialized', true);
  
  return {
    skills: loadSkills(),
    credentials: loadCredentials()
  };
}
```

**Cleanup**:
```javascript
export async function cleanup(context) {
  const { logger, storage } = context;
  
  logger.info('Extension cleaning up');
  
  // Cleanup resources
  await storage.clear();
}
```

### Context API

**Logger**:
```javascript
context.logger.debug('Debug message');
context.logger.info('Info message');
context.logger.warn('Warning message');
context.logger.error('Error message');
```

**Storage**:
```javascript
// Key-value storage
await context.storage.set('key', value);
const value = await context.storage.get('key');
await context.storage.delete('key');
await context.storage.clear();
```

**Network**:
```javascript
// HTTP requests (with permission)
const response = await context.network.fetch('https://api.example.com', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer token' },
  body: JSON.stringify({ data: 'value' })
});
```

### Permissions

**Available Permissions**:
- `network:outbound`: Make HTTP requests
- `storage:read`: Read from extension storage
- `storage:write`: Write to extension storage
- `filesystem:read`: Read files (with user approval)
- `filesystem:write`: Write files (with user approval)
- `system:info`: Read system information
- `clipboard:read`: Read clipboard
- `clipboard:write`: Write clipboard

**Requesting Permissions**:
```json
{
  "permissions": [
    "network:outbound",
    "storage:read",
    "storage:write"
  ]
}
```

---

## MCP Integration

### MCP Protocol Support

DGOS V1 supports the Model Context Protocol for exposing tools and resources to AI models.

### MCP Server Structure

```javascript
export const mcpServer = {
  name: 'my-mcp-server',
  version: '1.0.0',
  
  tools: [
    {
      name: 'fetch_data',
      description: 'Fetch data from API',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          params: { type: 'object' }
        },
        required: ['url']
      }
    }
  ],
  
  resources: [
    {
      uri: 'data://my-resource',
      name: 'My Resource',
      mimeType: 'application/json'
    }
  ]
};
```

### Implementing Tool Handlers

```javascript
export async function handleToolCall(toolName, args, context) {
  switch (toolName) {
    case 'fetch_data':
      return await fetchData(args.url, args.params, context);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

async function fetchData(url, params, context) {
  const response = await context.network.fetch(url, {
    method: 'GET',
    params
  });
  
  return {
    content: await response.json(),
    mimeType: 'application/json'
  };
}
```

### Resource Handlers

```javascript
export async function handleResourceRequest(uri, context) {
  if (uri === 'data://my-resource') {
    const data = await context.storage.get('resource-data');
    return {
      content: JSON.stringify(data),
      mimeType: 'application/json'
    };
  }
  throw new Error(`Unknown resource: ${uri}`);
}
```

---

## Skills Development

### Skill Definition

```json
{
  "name": "weather-lookup",
  "displayName": "Weather Lookup",
  "description": "Get current weather for a location",
  "category": "information",
  "parameters": {
    "type": "object",
    "properties": {
      "location": {
        "type": "string",
        "description": "City name or coordinates"
      },
      "units": {
        "type": "string",
        "enum": ["metric", "imperial"],
        "default": "metric"
      }
    },
    "required": ["location"]
  },
  "returns": {
    "type": "object",
    "properties": {
      "temperature": { "type": "number" },
      "conditions": { "type": "string" },
      "humidity": { "type": "number" }
    }
  }
}
```

### Skill Implementation

```javascript
export async function executeSkill(skillName, params, context) {
  switch (skillName) {
    case 'weather-lookup':
      return await getWeather(params, context);
    default:
      throw new Error(`Unknown skill: ${skillName}`);
  }
}

async function getWeather(params, context) {
  const { location, units = 'metric' } = params;
  
  // Get API key from credentials
  const apiKey = await context.credentials.get('weather-api-key');
  
  // Fetch weather data
  const response = await context.network.fetch(
    `https://api.weather.com/v1/current`,
    {
      params: { location, units, apiKey }
    }
  );
  
  const data = await response.json();
  
  return {
    temperature: data.temp,
    conditions: data.conditions,
    humidity: data.humidity
  };
}
```

### Credential Templates

```json
{
  "name": "weather-api-key",
  "displayName": "Weather API Key",
  "description": "API key for weather service",
  "type": "api-key",
  "fields": [
    {
      "key": "apiKey",
      "label": "API Key",
      "type": "password",
      "required": true
    }
  ],
  "testEndpoint": "https://api.weather.com/v1/test"
}
```

---

## Testing Guide

### Running Tests

**All tests**:
```bash
pnpm test
```

**Integration tests**:
```bash
pnpm test:integration
```

**Security tests**:
```bash
pnpm test:security
```

**E2E tests**:
```bash
pnpm test:web:e2e
```

**Specific test file**:
```bash
node --test tests/integration/provider-api.test.mjs
```

### Writing Tests

**Integration Test Example**:
```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

describe('Provider API', () => {
  let db, redis;
  
  before(async () => {
    // Setup test database
    db = await createTestDatabase();
    redis = await createTestRedis();
  });
  
  after(async () => {
    // Cleanup
    await db.close();
    await redis.close();
  });
  
  it('should create provider config', async () => {
    const config = await createProviderConfig({
      name: 'Test Provider',
      protocol: 'openai-compatible',
      baseUrl: 'https://api.test.com'
    });
    
    assert.ok(config.id);
    assert.strictEqual(config.name, 'Test Provider');
  });
});
```

### Test Utilities

**Database Helpers**:
```javascript
import { createTestDatabase } from './test-utils.mjs';

const db = await createTestDatabase();
// Isolated test database
// Auto-cleanup after test
```

**Provider Fixture**:
```javascript
import { startProviderFixture } from './test-utils.mjs';

const fixture = await startProviderFixture({
  scenario: 'success',
  model: 'gpt-4-test',
  delay: 100
});

// Use fixture.baseUrl and fixture.token
await fixture.stop();
```

---

## API Integration

### Authentication

**Session-based** (Web UI):
```javascript
// Login
const response = await fetch('/api/v1/identity/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'password'
  }),
  credentials: 'include'
});
```

**API Key** (Programmatic):
```javascript
const response = await fetch('/api/v1/tasks', {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
});
```

### Common Endpoints

**List Providers**:
```javascript
GET /api/v1/provider/configs
```

**Create Provider**:
```javascript
POST /api/v1/provider/configs
Content-Type: application/json

{
  "name": "OpenAI",
  "protocol": "openai-compatible",
  "baseUrl": "https://api.openai.com/v1",
  "credentials": {
    "apiKey": "sk-..."
  }
}
```

**Submit Task**:
```javascript
POST /api/v1/tasks
Content-Type: application/json

{
  "modelId": "gpt-4",
  "providerId": "provider-123",
  "prompt": "Hello, world!",
  "parameters": {
    "temperature": 0.7,
    "maxTokens": 1000
  }
}
```

**Stream Task Results** (SSE):
```javascript
const eventSource = new EventSource(
  `/api/v1/tasks/${taskId}/stream`
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.type, data.content);
};
```

### Error Handling

**Error Response Format**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid model ID",
    "details": {
      "field": "modelId",
      "reason": "Model not found"
    }
  }
}
```

**Error Codes**:
- `VALIDATION_ERROR`: Invalid request
- `AUTHENTICATION_ERROR`: Auth failed
- `AUTHORIZATION_ERROR`: Permission denied
- `NOT_FOUND`: Resource not found
- `CONFLICT`: Resource conflict
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Server error

---

## Contribution Guide

### Code Style

**TypeScript/JavaScript**:
- ESM modules (`.mjs` or `type: "module"`)
- 2-space indentation
- Single quotes
- Semicolons
- Trailing commas

**React**:
- Functional components
- Hooks for state
- TypeScript types
- PropTypes for validation

### Commit Messages

**Format**:
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style
- `refactor`: Code refactor
- `test`: Tests
- `chore`: Maintenance

**Example**:
```
feat(provider): add connection retry logic

Implement exponential backoff for provider connection
failures to improve reliability.

Closes #123
```

### Pull Request Process

1. **Create branch**:
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes**:
   - Write code
   - Add tests
   - Update docs

3. **Run checks**:
   ```bash
   pnpm test
   pnpm run check
   ```

4. **Commit**:
   ```bash
   git add .
   git commit -m "feat: my feature"
   ```

5. **Push**:
   ```bash
   git push origin feature/my-feature
   ```

6. **Create PR**:
   - Clear description
   - Link related issues
   - Add screenshots (if UI change)

### Code Review Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No secrets in code
- [ ] Error handling complete
- [ ] TypeScript types correct
- [ ] No console.log (use logger)
- [ ] Accessibility considered
- [ ] i18n labels added

---

**For more information:**
- [User Guide](./V1-User-Guide.md)
- [API Reference](../04-技术架构/V1-API-Reference.md)
- [Architecture Docs](../04-技术架构/)
