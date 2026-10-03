// DGOS Basic App Test Template
// Use this template to test basic app functionality

import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../../packages/sdk/src/testing/index.ts';

test('basic app test template', async () => {
  // Create test app environment
  const testApp = createTestApp({
    context: {
      appId: 'test.basic-app',
      version: '1.0.0',
    },
  });

  // Test 1: App context is properly initialized
  assert.equal(testApp.context.appId, 'test.basic-app');
  assert.equal(testApp.context.version, '1.0.0');

  // Test 2: Storage API works
  await testApp.api.storage.kv.set('test-key', 'test-value');
  const value = await testApp.api.storage.kv.get('test-key');
  assert.equal(value, 'test-value');

  // Test 3: Permission API works
  const result = await testApp.api.permissions.request('storage.write', 'Test storage');
  assert.ok(result.granted);

  // Test 4: UI API works
  await testApp.api.ui.notify({ title: 'Test', body: 'Notification test' });
  assert.equal(testApp.ui.notifications.length, 1);

  // Test 5: System API works
  const info = await testApp.api.system.getInfo();
  assert.ok(info.version);
  assert.ok(info.platform);

  console.log('✓ All basic app tests passed');
});
