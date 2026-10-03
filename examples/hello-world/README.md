# Hello World - DGOS Example

The simplest possible DGOS application.

## What This Example Demonstrates

- Basic application structure
- Application manifest (`dgos.json`)
- Lifecycle hooks (`onActivate`, `onDeactivate`)
- Showing notifications with `ui.notify()`

## Running This Example

```bash
# From the hello-world directory
pnpm install

# Test the application
dgos app validate
dgos app build
dgos app test-install
```

## Code Walkthrough

### Manifest (dgos.json)

The manifest declares the application metadata and required permissions:

```json
{
  "appId": "dev.dgos.example.hello-world",
  "version": "1.0.0",
  "permissions": [],
  "capabilityAllowlist": ["dgos.ui.notify"]
}
```

### Application Entry (app.js)

```javascript
import { defineApp } from '@dgos/sdk/app';

defineApp({
  async onActivate() {
    // Called when app starts
    await this.ui.notify({
      title: 'Hello DGOS!',
      message: 'Your first DGOS application is running.',
    });
  }
});
```

## Key Concepts

1. **defineApp()** - Registers your application with DGOS runtime
2. **onActivate()** - Lifecycle hook called when app launches
3. **this.ui** - Access to UI APIs like notifications
4. **Async/await** - All SDK APIs are promise-based

## Next Steps

After understanding this example, try:

1. **Todo App** - Learn about storage and state management
2. **Chat Assistant** - Work with AI tasks
3. Create your own application with `dgos app create`

## Learn More

- [Getting Started Guide](../../docs/developers/getting-started.md)
- [API Reference](../../docs/developers/api-reference.md)
- [DGOS SDK Documentation](../../packages/sdk/README.md)
