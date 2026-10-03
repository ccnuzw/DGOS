# DGOS Testing Framework - Quick Start

## Overview

The DGOS testing framework provides everything you need to test your DGOS applications thoroughly:

- **Unit Testing** - Test individual components in isolation
- **Integration Testing** - Test component interactions
- **E2E Testing** - Test complete user workflows
- **Performance Testing** - Measure and track performance
- **Accessibility Testing** - Ensure WCAG compliance
- **Visual Regression** - Catch unintended UI changes

## Quick Start

### 1. Install Dependencies

All dependencies are included:

```bash
pnpm install
```

### 2. Run Tests

```bash
# All tests
pnpm test

# Specific test types
pnpm test:integration
pnpm test:web:e2e
pnpm test:security
```

### 3. Write Your First Test

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '@dgos/sdk/testing';

test('my first test', async () => {
  const testApp = createTestApp();
  
  await testApp.api.storage.kv.set('key', 'value');
  const value = await testApp.api.storage.kv.get('key');
  
  assert.equal(value, 'value');
});
```

## Testing Utilities

### Mock DGOS Environment

```typescript
import { createTestApp } from '@dgos/sdk/testing';

const testApp = createTestApp({
  context: {
    appId: 'test.myapp',
    version: '1.0.0',
  },
});

// Access mocked APIs
testApp.api.storage
testApp.api.permissions
testApp.api.ui
testApp.api.system
testApp.api.tasks
```

### Mock Permissions

```typescript
import { MockPermissions } from '@dgos/sdk/testing';

const permissions = new MockPermissions();
permissions.grant('storage.write');
permissions.deny('network.fetch');

const testApp = createTestApp({ permissions });
```

### Performance Testing

```typescript
import { PerformanceMonitor, benchmark } from '@dgos/sdk/testing';

const monitor = new PerformanceMonitor();

const { duration } = await monitor.measure('operation', async () => {
  await doSomething();
});

console.log(`Operation took ${duration}ms`);
```

### Accessibility Testing

```typescript
import { AccessibilityChecker } from '@dgos/sdk/testing';

const checker = new AccessibilityChecker();

// Check color contrast
checker.checkColorContrast('#000000', '#ffffff', 16, 'AA');

// Check ARIA labels
checker.checkAriaLabels({ role: 'button', ariaLabel: 'Submit' });

// Get report
console.log(checker.report());
```

### E2E Testing

```typescript
import { test } from '@playwright/test';
import { createE2EHelper } from '@dgos/sdk/testing';

test('app workflow', async ({ page }) => {
  const helper = createE2EHelper(page);
  
  await helper.navigateHome();
  await helper.installApp({
    appId: 'test.myapp',
    name: 'My App',
    version: '1.0.0',
  });
  
  await helper.launchApp('test.myapp');
  await helper.waitForAppReady('test.myapp');
});
```

## Test Templates

Ready-to-use templates in `tests/templates/`:

- `basic-app.test.mjs` - Basic app functionality
- `form-validation.test.mjs` - Form validation
- `permission-flow.test.mjs` - Permission requests
- `api-integration.test.mjs` - API integration
- `lifecycle.test.mjs` - App lifecycle
- `e2e-app-catalog.spec.mjs` - E2E workflows

## Example Test Suites

Complete test suites in `tests/examples/`:

- `todo-app.test.mjs` - Todo app tests
- `weather-app.test.mjs` - Weather app tests
- `notes-app.test.mjs` - Notes app tests

## CI/CD Integration

Tests run automatically on every PR:

- Unit & integration tests
- E2E tests with Playwright
- Performance benchmarks
- Visual regression tests
- Code coverage reports

## Documentation

See the full [Testing Guide](./TESTING-GUIDE.md) for:

- Detailed API documentation
- Best practices
- Troubleshooting
- Advanced usage

## File Structure

```
DGOS/
├── packages/sdk/src/testing/
│   ├── index.ts              # Main testing utilities
│   ├── assertions.ts         # Custom assertions
│   ├── performance.ts        # Performance monitoring
│   ├── accessibility.ts      # A11y testing
│   ├── snapshot.ts          # Snapshot testing
│   └── e2e-helpers.ts       # E2E helpers
├── tests/
│   ├── templates/           # Test templates
│   ├── examples/            # Example test suites
│   ├── e2e/                # E2E tests
│   ├── visual/             # Visual regression tests
│   └── performance/        # Performance tests
├── .github/workflows/
│   ├── tests.yml           # Main test workflow
│   ├── performance.yml     # Performance benchmarks
│   └── visual-regression.yml # Visual tests
├── playwright.config.ts     # Playwright config
└── playwright.visual.config.ts # Visual test config
```

## Next Steps

1. Explore the test templates
2. Run the example test suites
3. Write tests for your app
4. Set up CI/CD integration
5. Read the full testing guide

## Support

- Check the [Testing Guide](./TESTING-GUIDE.md) for detailed documentation
- Review example tests for patterns
- Open an issue on GitHub for questions
