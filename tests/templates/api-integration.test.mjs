// DGOS API Integration Test Template
// Template for testing API integration and data fetching

import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../../packages/sdk/src/testing/index.ts';

test('api integration test template', async () => {
  const testApp = createTestApp({
    context: {
      appId: 'test.api-app',
      version: '1.0.0',
    },
  });

  // Mock API client
  class MockAPIClient {
    private baseUrl;

    constructor(baseUrl) {
      this.baseUrl = baseUrl;
    }

    async get(endpoint): Promise<any> {
      // Simulate API call
      if (endpoint === '/users/1') {
        return { id: 1, name: 'Test User', email: 'test@example.com' };
      }
      throw new Error('Not found');
    }

    async post(endpoint, data): Promise<any> {
      // Simulate API call
      if (endpoint === '/users') {
        return { id: 2, ...data };
      }
      throw new Error('Bad request');
    }

    async put(endpoint, data): Promise<any> {
      // Simulate API call
      if (endpoint.startsWith('/users/')) {
        return { id: 1, ...data };
      }
      throw new Error('Not found');
    }

    async delete(endpoint): Promise<void> {
      // Simulate API call
      if (!endpoint.startsWith('/users/')) {
        throw new Error('Not found');
      }
    }
  }

  // Test 1: Request network permission
  testApp.permissions.grant('network.fetch');
  const hasPermission = await testApp.api.permissions.has('network.fetch');
  assert.ok(hasPermission, 'Should have network.fetch permission');

  // Test 2: Fetch data from API
  const client = new MockAPIClient('https://api.example.com');
  const user = await client.get('/users/1');
  assert.equal(user.id, 1);
  assert.equal(user.name, 'Test User');

  // Test 3: Cache API response
  await testApp.api.storage.kv.set('cached-user', user);
  const cachedUser = await testApp.api.storage.kv.get('cached-user');
  assert.deepEqual(cachedUser, user);

  // Test 4: Create new resource
  const newUser = await client.post('/users', {
    name: 'New User',
    email: 'new@example.com',
  });
  assert.equal(newUser.id, 2);
  assert.equal(newUser.name, 'New User');

  // Test 5: Update resource
  const updatedUser = await client.put('/users/1', {
    name: 'Updated User',
  });
  assert.equal(updatedUser.name, 'Updated User');

  // Test 6: Delete resource
  await client.delete('/users/1');
  // Should not throw

  // Test 7: Handle API errors
  try {
    await client.get('/users/999');
    assert.fail('Should have thrown an error');
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes('Not found'));
  }

  // Test 8: Notify user of API events
  await testApp.api.ui.notify({
    title: 'Data Loaded',
    body: 'User data has been loaded successfully',
  });
  assert.equal(testApp.ui.notifications.length, 1);

  console.log('✓ All API integration tests passed');
});
