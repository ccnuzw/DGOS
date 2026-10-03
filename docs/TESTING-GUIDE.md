# DGOS Testing Guide

Complete guide to testing DGOS applications with best practices, examples, and tooling.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Unit Testing](#unit-testing)
3. [Integration Testing](#integration-testing)
4. [E2E Testing](#e2e-testing)
5. [Performance Testing](#performance-testing)
6. [Accessibility Testing](#accessibility-testing)
7. [Visual Regression Testing](#visual-regression-testing)
8. [Best Practices](#best-practices)
9. [CI/CD Integration](#cicd-integration)

## Getting Started

### Installation

All testing dependencies are already included in the DGOS monorepo:

```bash
pnpm install
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run unit tests only
pnpm test tests/unit

# Run integration tests
pnpm test:integration

# Run E2E tests
pnpm test:web:e2e

# Run security tests
pnpm test:security
```

## Unit Testing

Unit tests verify individual components and functions in isolation.

### Basic Unit Test

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '@dgos/sdk/testing';

test('basic app functionality', async () => {
  const testApp = createTestApp({
    context: {
      appId: 'test.myapp',
      version: '1.0.0',
    },
  });

  // Test storage
  await testApp.api.storage.kv.set('key', 'value');
  const value = await testApp.api.storage.kv.get('key');
  assert.equal(value, 'value');
});
```

### Testing with Mocks

```typescript
import { createTestApp, MockPermissions, MockStorage } from '@dgos/sdk/testing';

test('permission-gated feature', async () => {
  const permissions = new MockPermissions();
  permissions.grant('storage.write');

  const testApp = createTestApp({ permissions });

  const hasPermission = await testApp.api.permissions.has('storage.write');
  assert.ok(hasPermission);
});
```

### Custom Assertions

```typescript
import { assertPermission, assertStorageValue } from '@dgos/sdk/testing';

test('custom assertions', async () => {
  const testApp = createTestApp();

  // Assert permission status
  const status = await testApp.api.permissions.status('storage.write');
  assertPermission(status, 'granted');

  // Assert storage value
  await testApp.api.storage.kv.set('key', { foo: 'bar' });
  assertStorageValue(testApp.storage.kvStore, 'key', { foo: 'bar' });
});
```

## Integration Testing

Integration tests verify that multiple components work together correctly.

### API Integration Test

```typescript
test('API data flow', async () => {
  const testApp = createTestApp();

  // Grant network permission
  testApp.permissions.grant('network.fetch');

  // Fetch data (mocked)
  const data = await fetchUserData();

  // Store in cache
  await testApp.api.storage.kv.set('user-cache', data);

  // Retrieve from cache
  const cached = await testApp.api.storage.kv.get('user-cache');
  assert.deepEqual(cached, data);
});
```

### Lifecycle Integration

```typescript
test('app lifecycle', async () => {
  const testApp = createTestApp();
  const events = [];

  // Simulate lifecycle
  await app.onInit();
  events.push('init');

  await app.onStart();
  events.push('start');

  await app.onPause();
  events.push('pause');

  await app.onResume();
  events.push('resume');

  await app.onStop();
  events.push('stop');

  assert.deepEqual(events, ['init', 'start', 'pause', 'resume', 'stop']);
});
```

## E2E Testing

End-to-end tests verify complete user workflows using Playwright.

### Basic E2E Test

```typescript
import { test, expect } from '@playwright/test';
import { createE2EHelper } from '@dgos/sdk/testing';

test('install and launch app', async ({ page }) => {
  const helper = createE2EHelper(page);

  await helper.navigateHome();

  await helper.installApp({
    appId: 'test.myapp',
    name: 'My App',
    version: '1.0.0',
  });

  await helper.launchApp('test.myapp');
  await helper.waitForAppReady('test.myapp');

  const visible = await helper.elementExists('[data-testid="app-window-test.myapp"]');
  expect(visible).toBe(true);
});
```

### Permission Flow Test

```typescript
test('permission request flow', async ({ page }) => {
  const helper = createE2EHelper(page);

  await helper.launchApp('test.myapp');

  // Grant permission when requested
  await helper.grantPermission('geolocation.read');

  // Verify app received permission
  await helper.waitForAppReady('test.myapp');
});
```

### User Interaction Test

```typescript
test('form submission', async ({ page }) => {
  const helper = createE2EHelper(page);

  await helper.launchApp('test.myapp');

  // Fill form
  await helper.interact('[data-testid="name-input"]', 'fill', 'John Doe');
  await helper.interact('[data-testid="email-input"]', 'fill', 'john@example.com');

  // Submit
  await helper.interact('[data-testid="submit-button"]', 'click');

  // Verify success
  const success = await helper.getText('[data-testid="success-message"]');
  expect(success).toBe('Form submitted successfully');
});
```

## Performance Testing

Measure and track performance metrics.

### Using PerformanceMonitor

```typescript
import { PerformanceMonitor } from '@dgos/sdk/testing';

test('measure performance', async () => {
  const monitor = new PerformanceMonitor();

  // Measure startup time
  const startupTime = await monitor.measureStartup(() => {
    initializeApp();
  });

  assert.ok(startupTime < 1000, 'Startup should be under 1 second');

  // Measure API call
  const { result, duration } = await monitor.measure('fetch-user', async () => {
    return await fetchUser('123');
  });

  assert.ok(duration < 100, 'API call should be under 100ms');

  // Get statistics
  const stats = monitor.getStats('fetch-user');
  console.log(`Avg: ${stats.avg}ms, P95: ${stats.p95}ms`);
});
```

### Benchmarking

```typescript
import { benchmark } from '@dgos/sdk/testing';

test('benchmark operation', async () => {
  const results = await benchmark(async () => {
    await heavyOperation();
  }, 100);

  console.log(`Average: ${results.avg}ms`);
  console.log(`P95: ${results.p95}ms`);
  
  assert.ok(results.p95 < 50, 'P95 should be under 50ms');
});
```

## Accessibility Testing

Ensure your app is accessible to all users.

### Color Contrast

```typescript
import { AccessibilityChecker } from '@dgos/sdk/testing';

test('color contrast', () => {
  const checker = new AccessibilityChecker();

  const issue = checker.checkColorContrast(
    '#ffffff', // foreground
    '#cccccc', // background
    16,        // font size
    'AA'       // WCAG level
  );

  assert.ok(!issue, 'Should pass color contrast check');
});
```

### ARIA Labels

```typescript
test('aria labels', () => {
  const checker = new AccessibilityChecker();

  const button = {
    role: 'button',
    ariaLabel: 'Submit form',
  };

  const issue = checker.checkAriaLabels(button);
  assert.ok(!issue, 'Button should have proper ARIA label');
});
```

### Keyboard Navigation

```typescript
test('keyboard navigation', async ({ page }) => {
  const helper = createE2EHelper(page);

  const canNavigate = await helper.testKeyboardNavigation([
    '[data-testid="button-1"]',
    '[data-testid="button-2"]',
    '[data-testid="button-3"]',
  ]);

  expect(canNavigate).toBe(true);
});
```

## Visual Regression Testing

Catch unintended visual changes.

### Snapshot Testing

```typescript
import { SnapshotManager } from '@dgos/sdk/testing';

test('component snapshot', async () => {
  const snapshots = new SnapshotManager('./snapshots');
  await snapshots.initialize();

  const component = renderComponent();

  const result = snapshots.match('my-component', component);
  assert.ok(result.pass, result.message);

  await snapshots.save();
});
```

### Screenshot Comparison

```typescript
test('visual regression', async ({ page }) => {
  const helper = createE2EHelper(page);

  await helper.navigateHome();
  await helper.launchApp('test.myapp');

  // Compare screenshot with baseline
  await expect(page).toHaveScreenshot('app-home.png');
});
```

## Best Practices

### 1. Test Isolation

Each test should be independent and not rely on other tests:

```typescript
test('isolated test', async () => {
  // Create fresh test environment
  const testApp = createTestApp();

  // Run test
  await testApp.api.storage.kv.set('key', 'value');

  // Verify
  assert.equal(await testApp.api.storage.kv.get('key'), 'value');
});
```

### 2. Use Meaningful Test Names

```typescript
// Good
test('should save user preferences to storage');

// Bad
test('test1');
```

### 3. Test Error Cases

```typescript
test('handles missing data gracefully', async () => {
  const testApp = createTestApp();

  const value = await testApp.api.storage.kv.get('nonexistent');
  assert.equal(value, null);
});
```

### 4. Mock External Dependencies

```typescript
test('API error handling', async () => {
  const mockAPI = {
    fetch: async () => {
      throw new Error('Network error');
    },
  };

  try {
    await fetchWithRetry(mockAPI);
    assert.fail('Should have thrown error');
  } catch (err) {
    assert.ok(err.message.includes('Network error'));
  }
});
```

### 5. Use Test Templates

Use the provided templates in `tests/templates/` as starting points for common test scenarios.

## CI/CD Integration

### GitHub Actions

Tests run automatically on every PR:

- **Unit Tests**: Fast feedback on code changes
- **Integration Tests**: Verify component interactions
- **E2E Tests**: Validate user workflows
- **Performance Tests**: Track performance regressions
- **Visual Tests**: Catch UI changes

### Local CI Testing

Run the full CI suite locally:

```bash
# Run all test types
pnpm test && pnpm test:integration && pnpm test:web:e2e
```

### Coverage Reports

Generate coverage reports:

```bash
pnpm test --experimental-test-coverage
```

## Templates

Pre-built test templates are available in `tests/templates/`:

- `basic-app.test.mjs` - Basic app functionality
- `form-validation.test.mjs` - Form validation
- `permission-flow.test.mjs` - Permission requests
- `api-integration.test.mjs` - API integration
- `lifecycle.test.mjs` - App lifecycle
- `e2e-app-catalog.spec.mjs` - E2E app catalog

Copy and customize these templates for your needs.

## Troubleshooting

### Tests Timing Out

Increase timeout in test configuration:

```typescript
test('slow operation', { timeout: 10000 }, async () => {
  await slowOperation();
});
```

### Playwright Browser Issues

Reinstall browsers:

```bash
pnpm exec playwright install --with-deps
```

### Mock Data Not Working

Ensure mocks are properly initialized:

```typescript
const storage = new MockStorage();
storage.setKV('key', 'value');
const testApp = createTestApp({ storage });
```

## Resources

- [Node.js Test Runner](https://nodejs.org/api/test.html)
- [Playwright Documentation](https://playwright.dev/)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Testing Best Practices](https://testingjavascript.com/)

## Support

For questions or issues with testing:

1. Check existing tests for examples
2. Review test templates
3. Check the troubleshooting section
4. Open an issue on GitHub
