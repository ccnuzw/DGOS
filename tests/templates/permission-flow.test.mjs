// DGOS Permission Test Template
// Template for testing permission flows and access control

import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, MockPermissions } from '../../packages/sdk/src/testing/index.ts';

test('permission flow test template', async () => {
  const permissions = new MockPermissions();
  const testApp = createTestApp({
    context: {
      appId: 'test.permission-app',
      version: '1.0.0',
    },
    permissions,
  });

  // Test 1: Request permission (auto-granted in test)
  const result = await testApp.api.permissions.request(
    'storage.write',
    'Need to save user data'
  );
  assert.ok(result.granted, 'Permission should be granted');
  assert.equal(result.capability, 'storage.write');

  // Test 2: Check permission status
  const hasPermission = await testApp.api.permissions.has('storage.write');
  assert.ok(hasPermission, 'Should have storage.write permission');

  const status = await testApp.api.permissions.status('storage.write');
  assert.equal(status, 'granted');

  // Test 3: Use granted permission
  await testApp.api.storage.kv.set('test-key', 'test-value');
  const value = await testApp.api.storage.kv.get('test-key');
  assert.equal(value, 'test-value');

  // Test 4: Deny permission
  permissions.deny('network.fetch');
  const networkPermission = await testApp.api.permissions.request(
    'network.fetch',
    'Need to fetch data'
  );
  assert.ok(!networkPermission.granted, 'Permission should be denied');

  // Test 5: Check denied permission
  const hasNetwork = await testApp.api.permissions.has('network.fetch');
  assert.ok(!hasNetwork, 'Should not have network.fetch permission');

  // Test 6: Prompt for new permission
  permissions.reset('filesystem.read');
  const filePermission = await testApp.api.permissions.request(
    'filesystem.read',
    'Need to read files'
  );
  assert.ok(filePermission.granted, 'New permission should be auto-granted in test');

  // Test 7: List all permissions
  const allPermissions = await testApp.api.permissions.list();
  assert.ok(allPermissions.length >= 2, 'Should have at least 2 permissions');

  const storagePermission = allPermissions.find(p => p.capability === 'storage.write');
  assert.ok(storagePermission);
  assert.equal(storagePermission.status, 'granted');

  // Test 8: Permission-gated feature
  async function saveData(data) {
    const canWrite = await testApp.api.permissions.has('storage.write');
    if (!canWrite) {
      throw new Error('Permission denied: storage.write required');
    }
    await testApp.api.storage.kv.set('data', data);
  }

  await saveData({ test: 'data' });
  const saved = await testApp.api.storage.kv.get('data');
  assert.deepEqual(saved, { test: 'data' });

  // Test 9: Reset permission and try again
  permissions.reset('storage.write');
  permissions.deny('storage.write');

  try {
    await saveData({ test: 'data2' });
    assert.fail('Should have thrown permission error');
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes('Permission denied'));
  }

  console.log('✓ All permission tests passed');
});
