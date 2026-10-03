// DGOS Lifecycle Test Template
// Template for testing app lifecycle hooks and state management

import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../../packages/sdk/src/testing/index.ts';

test('app lifecycle test template', async () => {
  const testApp = createTestApp({
    context: {
      appId: 'test.lifecycle-app',
      version: '1.0.0',
    },
  });

  // Track lifecycle events
  const lifecycleEvents[] = [];

  // Mock app with lifecycle hooks
  class MockApp {
    private state: 'uninitialized' | 'initialized' | 'running' | 'paused' | 'stopped' = 'uninitialized';

    async onInit() {
      lifecycleEvents.push('init');
      this.state = 'initialized';

      // Load saved state from storage
      const savedState = await testApp.api.storage.kv.get('app-state');
      if (savedState) {
        console.log('Restored state:', savedState);
      }
    }

    async onStart() {
      lifecycleEvents.push('start');
      this.state = 'running';

      // Request necessary permissions
      await testApp.api.permissions.request('storage.write', 'Save app data');
    }

    async onPause() {
      lifecycleEvents.push('pause');
      this.state = 'paused';

      // Save current state
      await testApp.api.storage.kv.set('app-state', {
        timestamp: Date.now(),
        data: 'paused-state',
      });
    }

    async onResume() {
      lifecycleEvents.push('resume');
      this.state = 'running';
    }

    async onStop() {
      lifecycleEvents.push('stop');
      this.state = 'stopped';

      // Cleanup and save final state
      await testApp.api.storage.kv.set('app-state', {
        timestamp: Date.now(),
        data: 'final-state',
      });
    }

    getState() {
      return this.state;
    }
  }

  const app = new MockApp();

  // Test 1: Initialize app
  await app.onInit();
  assert.equal(app.getState(), 'initialized');
  assert.ok(lifecycleEvents.includes('init'));

  // Test 2: Start app
  await app.onStart();
  assert.equal(app.getState(), 'running');
  assert.ok(lifecycleEvents.includes('start'));

  // Test 3: Verify permissions were requested
  const hasPermission = await testApp.api.permissions.has('storage.write');
  assert.ok(hasPermission);

  // Test 4: Pause app
  await app.onPause();
  assert.equal(app.getState(), 'paused');
  assert.ok(lifecycleEvents.includes('pause'));

  // Test 5: Verify state was saved
  const pausedState = await testApp.api.storage.kv.get('app-state');
  assert.ok(pausedState);
  assert.equal(pausedState.data, 'paused-state');

  // Test 6: Resume app
  await app.onResume();
  assert.equal(app.getState(), 'running');
  assert.ok(lifecycleEvents.includes('resume'));

  // Test 7: Stop app
  await app.onStop();
  assert.equal(app.getState(), 'stopped');
  assert.ok(lifecycleEvents.includes('stop'));

  // Test 8: Verify final state was saved
  const finalState = await testApp.api.storage.kv.get('app-state');
  assert.ok(finalState);
  assert.equal(finalState.data, 'final-state');

  // Test 9: Verify lifecycle order
  assert.deepEqual(lifecycleEvents, ['init', 'start', 'pause', 'resume', 'stop']);

  // Test 10: Test state restoration on restart
  const app2 = new MockApp();
  await app2.onInit();
  const restoredState = await testApp.api.storage.kv.get('app-state');
  assert.ok(restoredState);
  assert.equal(restoredState.data, 'final-state');

  console.log('✓ All lifecycle tests passed');
});
