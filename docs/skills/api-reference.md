# Skill API Reference

Complete API reference for DGOS Skill SDK.

## SkillAPI

The main API object passed to skill handlers.

```typescript
interface SkillAPI {
  system: SystemAPI;
  storage: StorageAPI;
  tasks: TasksAPI;
  ui: UIAPI;
  http: HttpAPI;
  tools: ToolsAPI;
  log: LogAPI;
  skills: SkillsAPI;
}
```

---

## SystemAPI

Access system information.

### `getVersion(): Promise<string>`

Get DGOS version.

```typescript
const version = await api.system.getVersion();
// Returns: "1.0.0"
```

### `getPlatform(): Promise<string>`

Get platform information.

```typescript
const platform = await api.system.getPlatform();
// Returns: "darwin", "linux", "win32"
```

### `getEnvironment(key: string): Promise<string | undefined>`

Get environment variable.

```typescript
const nodeEnv = await api.system.getEnvironment('NODE_ENV');
// Returns: "production" or undefined
```

---

## StorageAPI

Persistent key-value storage scoped to your skill.

### `get(key: string): Promise<any>`

Retrieve value by key.

```typescript
const config = await api.storage.get('config');
```

### `set(key: string, value: any): Promise<void>`

Store value with key.

```typescript
await api.storage.set('config', { theme: 'dark' });
```

### `delete(key: string): Promise<void>`

Delete value by key.

```typescript
await api.storage.delete('config');
```

### `list(prefix?: string): Promise<string[]>`

List all keys, optionally filtered by prefix.

```typescript
const keys = await api.storage.list('user:');
// Returns: ["user:1", "user:2", "user:3"]
```

### `clear(): Promise<void>`

Clear all storage for this skill.

```typescript
await api.storage.clear();
```

---

## TasksAPI

Create and manage AI tasks.

### `create(request): Promise<{ taskId: string }>`

Create a new AI task.

**Parameters:**
- `prompt` (string): Task prompt
- `model` (string, optional): Model to use
- `parameters` (object, optional): Model parameters

```typescript
const task = await api.tasks.create({
  prompt: 'Summarize this article...',
  model: 'claude-3-sonnet',
  parameters: {
    temperature: 0.5,
    max_tokens: 1000,
  },
});
```

### `getStatus(taskId: string): Promise<TaskStatus>`

Get task status and result.

**Returns:**
- `status`: "pending" | "running" | "succeeded" | "failed" | "cancelled"
- `result`: Task result (if succeeded)
- `error`: Error message (if failed)

```typescript
const status = await api.tasks.getStatus(task.taskId);
if (status.status === 'succeeded') {
  console.log(status.result);
}
```

### `cancel(taskId: string): Promise<void>`

Cancel a running task.

```typescript
await api.tasks.cancel(task.taskId);
```

---

## UIAPI

User interface interactions.

### `showNotification(message: string, type?: string): Promise<void>`

Show a notification to the user.

**Types:** `"info"` | `"success"` | `"warning"` | `"error"`

```typescript
await api.ui.showNotification('Task completed!', 'success');
```

### `showDialog(options): Promise<string>`

Show a dialog with buttons.

**Parameters:**
- `title` (string): Dialog title
- `message` (string): Dialog message
- `buttons` (string[]): Button labels

**Returns:** Label of clicked button

```typescript
const choice = await api.ui.showDialog({
  title: 'Confirm Action',
  message: 'Are you sure you want to proceed?',
  buttons: ['Yes', 'No', 'Cancel'],
});

if (choice === 'Yes') {
  // Proceed
}
```

### `prompt(message: string, defaultValue?: string): Promise<string | null>`

Prompt user for text input.

```typescript
const name = await api.ui.prompt('Enter your name:', 'John');
if (name) {
  console.log(`Hello, ${name}!`);
}
```

---

## HttpAPI

Make HTTP requests.

### `get(url: string, options?: RequestInit): Promise<any>`

Make a GET request.

```typescript
const data = await api.http.get('https://api.example.com/data');
```

### `post(url: string, body: any, options?: RequestInit): Promise<any>`

Make a POST request.

```typescript
const result = await api.http.post('https://api.example.com/submit', {
  name: 'John',
  email: 'john@example.com',
});
```

### `put(url: string, body: any, options?: RequestInit): Promise<any>`

Make a PUT request.

```typescript
await api.http.put('https://api.example.com/update/123', {
  status: 'completed',
});
```

### `delete(url: string, options?: RequestInit): Promise<any>`

Make a DELETE request.

```typescript
await api.http.delete('https://api.example.com/items/123');
```

### `fetch(url: string, options?: RequestInit): Promise<Response>`

Make a raw fetch request.

```typescript
const response = await api.http.fetch('https://example.com', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: 'value' }),
});

const text = await response.text();
```

---

## ToolsAPI

Invoke other tools.

### `invoke(toolId: string, parameters: Record<string, any>): Promise<any>`

Invoke a tool by ID.

```typescript
const result = await api.tools.invoke('file-search', {
  query: 'README.md',
  maxResults: 5,
});
```

### `list(): Promise<Tool[]>`

List available tools.

```typescript
const tools = await api.tools.list();
tools.forEach(tool => {
  console.log(tool.toolId, tool.name);
});
```

---

## LogAPI

Logging functions.

### `debug(message: string, context?: Record<string, any>): void`

Log debug message.

```typescript
api.log.debug('Processing started', { itemCount: 10 });
```

### `info(message: string, context?: Record<string, any>): void`

Log info message.

```typescript
api.log.info('User logged in', { userId: '123' });
```

### `warn(message: string, context?: Record<string, any>): void`

Log warning message.

```typescript
api.log.warn('Rate limit approaching', { remaining: 5 });
```

### `error(message: string, context?: Record<string, any>): void`

Log error message.

```typescript
api.log.error('API call failed', { error: error.message, url });
```

---

## SkillsAPI

Interact with other skills.

### `invoke(skillId: string, parameters: Record<string, any>): Promise<any>`

Invoke another skill.

```typescript
const result = await api.skills.invoke('translator', {
  text: 'Hello',
  targetLanguage: 'es',
});
console.log(result.translatedText); // "Hola"
```

### `exists(skillId: string): Promise<boolean>`

Check if a skill exists.

```typescript
if (await api.skills.exists('calculator')) {
  // Use calculator skill
}
```

### `list(): Promise<Skill[]>`

List installed skills.

```typescript
const skills = await api.skills.list();
skills.forEach(skill => {
  console.log(skill.skillId, skill.name);
});
```

---

## Types

### SkillContext

Context object passed to skill handler.

```typescript
interface SkillContext {
  skillId: string;              // Your skill ID
  requestId: string;            // Unique request ID
  userId: string;               // User ID
  sessionId: string;            // Session ID
  parameters: Record<string, any>;  // Input parameters
  environment: Record<string, any>; // Environment variables
}
```

### SkillResult

Expected return value from skill handler.

```typescript
interface SkillResult {
  success: boolean;
  output?: any;                 // Output data (if success)
  error?: SkillError;           // Error details (if failure)
  metadata?: {
    duration: number;           // Execution duration (ms)
    tokensUsed?: number;        // AI tokens used (if applicable)
  };
}
```

### SkillError

Error object structure.

```typescript
interface SkillError {
  code: string;                 // Error code (e.g., "NETWORK_ERROR")
  message: string;              // User-friendly error message
  details?: any;                // Additional error details
}
```

---

## Helper Functions

### `defineSkill(definition): SkillDefinition`

Define a skill with manifest and handler.

```typescript
import { defineSkill } from '@dgos/skill-sdk';

export default defineSkill({
  manifest: {
    skillId: 'my-skill',
    version: '1.0.0',
    // ... other manifest fields
  },
  
  async handler(context, api) {
    // Skill implementation
    return {
      success: true,
      output: { result: 'done' },
    };
  },
});
```

### `createMockAPI(): SkillAPI`

Create a mock API for testing.

```typescript
import { createMockAPI } from '@dgos/skill-sdk';

const mockAPI = createMockAPI();
const result = await mySkillHandler(context, mockAPI);
```

---

## Error Codes

Standard error codes used in DGOS skills:

- `INVALID_PARAMETER`: Invalid or missing parameter
- `VALIDATION_ERROR`: Parameter validation failed
- `NETWORK_ERROR`: Network request failed
- `API_ERROR`: External API error
- `TIMEOUT`: Execution timeout
- `PERMISSION_DENIED`: Required permission not granted
- `SKILL_DISABLED`: Skill is disabled
- `NOT_FOUND`: Resource not found
- `RATE_LIMIT`: Rate limit exceeded
- `UNKNOWN_ERROR`: Unknown error

---

## Best Practices

1. **Error Handling**: Always catch errors and return appropriate error objects
2. **Logging**: Use appropriate log levels (debug for development, info for normal operations)
3. **Timeouts**: Keep execution times reasonable, use async for long operations
4. **Storage**: Use storage API for persistent data, not global variables
5. **Security**: Validate all inputs, sanitize data before external calls
6. **Resources**: Clean up resources (close connections, cancel tasks) on error

---

## Examples

See [Examples Directory](./README.md) for complete skill examples.
