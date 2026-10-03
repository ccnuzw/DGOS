# Skill Best Practices

Guidelines and best practices for developing high-quality DGOS skills.

## Design Principles

### 1. Single Responsibility
Each skill should do one thing well. Don't create "kitchen sink" skills.

**Good:**
```
skill: translator - translates text between languages
skill: weather - gets weather information
```

**Bad:**
```
skill: utilities - translates, gets weather, converts units, etc.
```

### 2. Clear Naming
Use descriptive, memorable skill IDs and trigger phrases.

**Good:**
```
skillId: "file-search"
triggers: ["search files", "find file"]
```

**Bad:**
```
skillId: "fs2"
triggers: ["sf", "fnd"]
```

### 3. User-Friendly Parameters
Provide sensible defaults and clear descriptions.

**Good:**
```json
{
  "name": "maxResults",
  "type": "number",
  "required": false,
  "default": 10,
  "description": "Maximum number of results to return",
  "validation": { "min": 1, "max": 100 }
}
```

## Performance

### Keep It Fast
- Target < 3 seconds for synchronous operations
- Use `async: true` for operations > 5 seconds
- Cache frequently accessed data
- Avoid unnecessary API calls

**Example: Caching**
```typescript
async handler(context, api) {
  // Check cache first
  const cached = await api.storage.get(`cache:${context.parameters.query}`);
  if (cached && Date.now() - cached.timestamp < 3600000) {
    return cached.data;
  }

  // Fetch fresh data
  const data = await fetchData();

  // Store in cache
  await api.storage.set(`cache:${context.parameters.query}`, {
    data,
    timestamp: Date.now(),
  });

  return data;
}
```

### Resource Management
- Close connections when done
- Cancel pending operations on error
- Use streaming for large data
- Implement pagination

## Error Handling

### Always Catch Errors
Never let errors bubble uncaught.

**Good:**
```typescript
try {
  const result = await riskyOperation();
  return { success: true, output: result };
} catch (error: any) {
  api.log.error('Operation failed', { error: error.message });
  return {
    success: false,
    error: {
      code: 'OPERATION_FAILED',
      message: 'Unable to complete operation',
      details: error.message,
    },
  };
}
```

### User-Friendly Messages
Don't expose internal errors to users.

**Good:**
```typescript
return {
  success: false,
  error: {
    code: 'NETWORK_ERROR',
    message: 'Unable to connect to the weather service',
  },
};
```

**Bad:**
```typescript
return {
  success: false,
  error: {
    code: 'ECONNREFUSED',
    message: 'connect ECONNREFUSED 192.168.1.1:8080',
  },
};
```

### Error Codes
Use consistent, descriptive error codes.

**Standard Codes:**
- `INVALID_PARAMETER` - Invalid input
- `NETWORK_ERROR` - Network failure
- `API_ERROR` - External API error
- `TIMEOUT` - Operation timeout
- `PERMISSION_DENIED` - Missing permission
- `NOT_FOUND` - Resource not found
- `RATE_LIMIT` - Rate limit exceeded

## Security

### Input Validation
Always validate user input, even if marked required.

```typescript
async handler(context, api) {
  const { url } = context.parameters;

  // Validate URL
  try {
    new URL(url);
  } catch {
    return {
      success: false,
      error: {
        code: 'INVALID_PARAMETER',
        message: 'Invalid URL format',
      },
    };
  }

  // Sanitize before external use
  const sanitized = url.replace(/[<>]/g, '');
  
  // Continue...
}
```

### Sensitive Data
- Never log passwords or tokens
- Use environment variables for secrets
- Don't include API keys in code
- Clear sensitive data from storage

```typescript
// Good
const apiKey = await api.system.getEnvironment('WEATHER_API_KEY');

// Bad
const apiKey = 'sk-1234567890abcdef';
```

### Permission Requests
Request minimal necessary permissions with clear reasons.

```json
{
  "permissions": [
    {
      "capability": "network:fetch",
      "reason": "Fetch weather data from weather.com API"
    }
  ]
}
```

## Logging

### Use Appropriate Levels
- `debug()` - Detailed debugging info
- `info()` - Normal operations
- `warn()` - Potential issues
- `error()` - Errors and failures

```typescript
api.log.debug('Processing started', { itemCount: items.length });
api.log.info('User authenticated', { userId });
api.log.warn('Rate limit approaching', { remaining: 5 });
api.log.error('API call failed', { error: err.message });
```

### Include Context
Add relevant context to log messages.

**Good:**
```typescript
api.log.error('Failed to fetch data', {
  url,
  statusCode: response.status,
  error: error.message,
});
```

**Bad:**
```typescript
api.log.error('Failed');
```

### Don't Log Sensitive Data
```typescript
// Bad
api.log.info('User credentials', { password: user.password });

// Good
api.log.info('User authenticated', { userId: user.id });
```

## Testing

### Write Tests
Test main functionality and edge cases.

```typescript
import { createMockAPI } from '@dgos/skill-sdk';
import skill from './src/index';

// Test success case
const mockAPI = createMockAPI();
const result = await skill.handler({
  skillId: 'test',
  requestId: '123',
  userId: 'user1',
  sessionId: 'session1',
  parameters: { input: 'test' },
  environment: {},
}, mockAPI);

console.assert(result.success === true);
console.assert(result.output !== undefined);

// Test error case
const errorResult = await skill.handler({
  // ... context with invalid input
}, mockAPI);

console.assert(errorResult.success === false);
console.assert(errorResult.error?.code === 'INVALID_PARAMETER');
```

### Test Edge Cases
- Empty inputs
- Invalid formats
- Missing optional parameters
- Network failures
- Timeouts

## Documentation

### Clear README
Include usage examples and parameter descriptions.

```markdown
# Weather Skill

Get current weather and forecasts.

## Usage

Trigger: `weather in [city]`

## Parameters

- `location` (string, required): City name
- `units` (enum, optional): celsius or fahrenheit (default: celsius)
- `days` (number, optional): Forecast days 1-7 (default: 1)

## Examples

- "weather in Tokyo"
- "weather in London fahrenheit"
- "weather in Paris 3 days"
```

### Code Comments
Comment complex logic, not obvious code.

**Good:**
```typescript
// Calculate exponential backoff with jitter
const delay = Math.min(1000 * Math.pow(2, attempt), 10000) * (0.5 + Math.random() * 0.5);
```

**Bad:**
```typescript
// Set x to 5
const x = 5;
```

## Internationalization

### Support Multiple Languages
Provide names and descriptions in both English and Chinese.

```json
{
  "name": {
    "en": "Weather",
    "zh": "天气"
  },
  "description": {
    "en": "Get weather information",
    "zh": "获取天气信息"
  }
}
```

### Language-Aware Output
Return localized output when possible.

```typescript
async handler(context, api) {
  const locale = context.environment.locale || 'en';
  
  return {
    success: true,
    output: {
      message: locale === 'zh' ? '完成' : 'Completed',
    },
  };
}
```

## Version Management

### Semantic Versioning
Use semantic versioning: MAJOR.MINOR.PATCH

- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes

### Maintain Compatibility
Don't break existing parameters without major version bump.

**Adding (OK in minor version):**
```json
{
  "parameters": [
    { "name": "existing", "type": "string", "required": true },
    { "name": "new", "type": "string", "required": false }
  ]
}
```

**Breaking (requires major version):**
```json
{
  "parameters": [
    { "name": "existing", "type": "number", "required": true }  // Changed type!
  ]
}
```

## Common Patterns

### Retry Logic
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

// Usage
const data = await withRetry(() => api.http.get(url));
```

### Batch Processing
```typescript
async function processBatch<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  batchSize = 10
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(processor));
  }
}
```

### Rate Limiting
```typescript
class RateLimiter {
  private lastCall = 0;
  private minInterval: number;

  constructor(callsPerSecond: number) {
    this.minInterval = 1000 / callsPerSecond;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCall;
    
    if (elapsed < this.minInterval) {
      await new Promise(resolve => 
        setTimeout(resolve, this.minInterval - elapsed)
      );
    }
    
    this.lastCall = Date.now();
  }
}

const limiter = new RateLimiter(5); // 5 calls per second
await limiter.wait();
await api.http.get(url);
```

## Checklist

Before publishing your skill:

- [ ] Skill ID follows naming convention
- [ ] Version uses semantic versioning
- [ ] Names and descriptions in English and Chinese
- [ ] Clear, user-friendly trigger phrases
- [ ] All parameters documented
- [ ] Sensible defaults for optional parameters
- [ ] Appropriate permissions requested
- [ ] All errors caught and handled
- [ ] User-friendly error messages
- [ ] No sensitive data logged
- [ ] Tests written for main functionality
- [ ] README with examples
- [ ] Performance tested (< 5 seconds)
- [ ] Icon selected (emoji or SVG)
- [ ] Code formatted and linted
- [ ] No hardcoded secrets

## Resources

- [Getting Started Guide](./getting-started.md)
- [API Reference](../skills/api-reference.md)
- [Example Skills](../../built-in-skills/)
- [Templates](../../templates/skills/)
