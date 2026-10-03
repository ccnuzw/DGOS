# Skill Development Guide

Complete guide to developing skills for DGOS V1.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Skill Manifest](#skill-manifest)
3. [Skill Handler](#skill-handler)
4. [Skill API](#skill-api)
5. [Testing](#testing)
6. [Best Practices](#best-practices)
7. [Publishing](#publishing)

## Getting Started

### Prerequisites

- DGOS V1 installed
- Node.js >= 22
- Basic TypeScript knowledge

### Create Your First Skill

```bash
# Create a new skill from template
dgos skill create my-first-skill --template basic-skill

# Navigate to skill directory
cd my-first-skill

# Start development mode
dgos skill dev
```

## Skill Manifest

The manifest (`skill.json`) defines your skill's metadata and capabilities.

### Required Fields

```json
{
  "skillId": "my-skill",
  "version": "1.0.0",
  "name": {
    "en": "My Skill",
    "zh": "我的技能"
  },
  "description": {
    "en": "Description in English",
    "zh": "中文描述"
  },
  "author": {
    "name": "Your Name"
  },
  "triggers": [...],
  "parameters": [...],
  "permissions": [...],
  "execution": {...},
  "category": "productivity",
  "tags": []
}
```

### Skill ID Format

- Lowercase letters, numbers, hyphens, dots, underscores
- Must start with letter or underscore
- Pattern: `^[a-z0-9_][a-z0-9_.-]*$`
- Examples: `weather`, `file-search`, `my_skill`

### Triggers

Define how users invoke your skill:

```json
{
  "triggers": [
    {
      "type": "keyword",
      "value": "weather",
      "examples": ["weather in Tokyo", "show weather"]
    },
    {
      "type": "pattern",
      "value": "weather in (.+)",
      "examples": ["weather in London"]
    },
    {
      "type": "intent",
      "value": "get_weather"
    },
    {
      "type": "schedule",
      "value": "0 9 * * *"
    },
    {
      "type": "event",
      "value": "file.created"
    }
  ]
}
```

**Trigger Types:**
- `keyword`: Simple text matching
- `pattern`: Regular expression matching
- `intent`: NLU-based intent matching
- `schedule`: Cron-based scheduling
- `event`: System event triggers

### Parameters

Define input parameters:

```json
{
  "parameters": [
    {
      "name": "location",
      "type": "string",
      "required": true,
      "description": "City name",
      "validation": {
        "pattern": "^[A-Za-z\\s]+$"
      }
    },
    {
      "name": "units",
      "type": "enum",
      "required": false,
      "default": "celsius",
      "options": ["celsius", "fahrenheit"],
      "description": "Temperature unit"
    },
    {
      "name": "days",
      "type": "number",
      "required": false,
      "default": 1,
      "validation": {
        "min": 1,
        "max": 7
      },
      "description": "Number of forecast days"
    }
  ]
}
```

**Parameter Types:**
- `string`: Text input
- `number`: Numeric input
- `boolean`: True/false
- `file`: File input
- `enum`: Select from options

**Validation:**
- `min`/`max`: Numeric bounds
- `pattern`: Regex validation
- `required`: Whether parameter is mandatory

### Permissions

Declare required capabilities:

```json
{
  "permissions": [
    {
      "capability": "network:fetch",
      "reason": "Fetch weather data from API"
    },
    {
      "capability": "file:read",
      "reason": "Read configuration files"
    },
    {
      "capability": "notification:send",
      "reason": "Send weather alerts"
    }
  ]
}
```

**Common Capabilities:**
- `network:fetch`: HTTP requests
- `file:read`: Read files
- `file:write`: Write files
- `storage:read`: Read skill storage
- `storage:write`: Write skill storage
- `ai:tasks`: Create AI tasks
- `notification:send`: Send notifications
- `clipboard:read`: Read clipboard
- `clipboard:write`: Write clipboard
- `system:read`: Read system info
- `process:spawn`: Execute commands

### Execution Configuration

```json
{
  "execution": {
    "timeout": 30000,
    "retryable": true,
    "async": true
  }
}
```

- `timeout`: Maximum execution time (ms)
- `retryable`: Whether execution can be retried
- `async`: Whether execution is asynchronous

## Skill Handler

Implement your skill logic in `src/index.ts`:

```typescript
import { defineSkill } from '@dgos/skill-sdk';
import manifest from '../skill.json';

export default defineSkill({
  manifest,

  async handler(context, api) {
    // Access parameters
    const { location, units = 'celsius' } = context.parameters;

    // Log activity
    api.log.info('Fetching weather', { location, units });

    try {
      // Make API call
      const data = await api.http.get(
        `https://api.weather.com?location=${location}&units=${units}`
      );

      // Process data
      const result = {
        location,
        temperature: data.temp,
        condition: data.condition,
        units,
      };

      // Return success
      return {
        success: true,
        output: result,
      };
    } catch (error: any) {
      // Handle errors
      api.log.error('Weather fetch failed', { error: error.message });

      return {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: error.message,
        },
      };
    }
  },
});
```

### Context Object

```typescript
interface SkillContext {
  skillId: string;        // Your skill ID
  requestId: string;      // Unique request ID
  userId: string;         // User ID
  sessionId: string;      // Session ID
  parameters: Record<string, any>;  // Input parameters
  environment: Record<string, any>; // Environment variables
}
```

## Skill API

The `api` object provides access to DGOS capabilities:

### System API

```typescript
// Get system information
const version = await api.system.getVersion();
const platform = await api.system.getPlatform();
const env = await api.system.getEnvironment('NODE_ENV');
```

### Storage API

```typescript
// Persistent key-value storage
await api.storage.set('key', { data: 'value' });
const data = await api.storage.get('key');
await api.storage.delete('key');
const keys = await api.storage.list('prefix:');
await api.storage.clear();
```

### Tasks API

```typescript
// Create AI tasks
const task = await api.tasks.create({
  prompt: 'Translate this text to Spanish',
  model: 'claude-3-sonnet',
  parameters: {
    temperature: 0.3,
  },
});

// Check status
const status = await api.tasks.getStatus(task.taskId);

// Cancel task
await api.tasks.cancel(task.taskId);
```

### UI API

```typescript
// Show notifications
await api.ui.showNotification('Task completed!', 'success');

// Show dialog
const choice = await api.ui.showDialog({
  title: 'Confirm',
  message: 'Are you sure?',
  buttons: ['Yes', 'No'],
});

// Prompt for input
const input = await api.ui.prompt('Enter your name:');
```

### HTTP API

```typescript
// Make HTTP requests
const data = await api.http.get('https://api.example.com/data');

const result = await api.http.post('https://api.example.com/submit', {
  data: 'value',
});

// Raw fetch
const response = await api.http.fetch('https://example.com');
```

### Tools API

```typescript
// Invoke other tools
const result = await api.tools.invoke('search', {
  query: 'test',
});

// List available tools
const tools = await api.tools.list();
```

### Log API

```typescript
// Logging
api.log.debug('Debug message', { data: 'value' });
api.log.info('Info message');
api.log.warn('Warning message');
api.log.error('Error message', { error });
```

### Skills API

```typescript
// Invoke other skills
const result = await api.skills.invoke('translator', {
  text: 'Hello',
  targetLanguage: 'es',
});

// Check skill existence
const exists = await api.skills.exists('calculator');

// List skills
const skills = await api.skills.list();
```

## Testing

### Unit Testing

```typescript
import { createMockAPI } from '@dgos/skill-sdk';
import skill from './src/index';

const mockAPI = createMockAPI();
const context = {
  skillId: 'my-skill',
  requestId: 'test-123',
  userId: 'user-1',
  sessionId: 'session-1',
  parameters: { input: 'test' },
  environment: {},
};

const result = await skill.handler(context, mockAPI);
console.assert(result.success === true);
```

### Integration Testing

```bash
# Test skill in development mode
dgos skill test

# Run specific test case
dgos skill test --case "basic input"

# Test with parameters
dgos skill test --params '{"input": "test"}'
```

## Best Practices

### 1. Error Handling

Always handle errors gracefully:

```typescript
try {
  // Risky operation
} catch (error: any) {
  api.log.error('Operation failed', { error: error.message });
  return {
    success: false,
    error: {
      code: 'OPERATION_ERROR',
      message: 'User-friendly error message',
      details: error.message,
    },
  };
}
```

### 2. Logging

Use appropriate log levels:

```typescript
api.log.debug('Detailed debug info');  // Development
api.log.info('Normal operation');      // Informational
api.log.warn('Potential issue');       // Warnings
api.log.error('Error occurred');       // Errors
```

### 3. Parameter Validation

Validate inputs even if marked required:

```typescript
const { url } = context.parameters;

if (!url || typeof url !== 'string') {
  return {
    success: false,
    error: {
      code: 'INVALID_PARAMETER',
      message: 'URL parameter is required and must be a string',
    },
  };
}
```

### 4. Performance

- Keep execution time under 5 seconds for synchronous skills
- Use async: true for long-running operations
- Cache frequently used data in storage
- Avoid unnecessary API calls

### 5. Security

- Validate all inputs
- Never expose API keys in code
- Use environment variables for secrets
- Sanitize user input before external calls

## Publishing

### Package Your Skill

```bash
# Validate manifest
dgos skill validate

# Run tests
dgos skill test

# Package skill
dgos skill package
```

### Local Installation

```bash
# Install from directory
dgos skill install ./my-skill

# Install from package
dgos skill install ./my-skill.dgos
```

### Publish to Marketplace

```bash
# Login to marketplace
dgos login

# Publish skill
dgos skill publish

# Update published skill
dgos skill publish --version 1.1.0
```

## Resources

- [API Reference](./api-reference.md)
- [Examples](./examples/)
- [Manifest Reference](./manifest-reference.md)
- [Triggers Reference](./triggers.md)
- [Best Practices](./best-practices.md)
