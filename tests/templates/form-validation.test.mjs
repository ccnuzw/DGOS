// DGOS Form Validation Test Template
// Template for testing form validation and user input

import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../../packages/sdk/src/testing/index.ts';

test('form validation test template', async () => {
  const testApp = createTestApp({
    context: {
      appId: 'test.form-app',
      version: '1.0.0',
    },
  });

  // Mock form validation logic
  function validateForm(data: { name; email; age }) {
    const errors: Record<string, string> = {};

    if (!data.name || data.name.trim().length === 0) {
      errors.name = 'Name is required';
    }

    if (!data.email || !data.email.includes('@')) {
      errors.email = 'Valid email is required';
    }

    if (data.age < 0 || data.age > 150) {
      errors.age = 'Age must be between 0 and 150';
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  // Test 1: Valid form submission
  const validData = { name: 'John Doe', email: 'john@example.com', age: 30 };
  const validResult = validateForm(validData);
  assert.ok(validResult.valid, 'Valid form should pass validation');
  assert.equal(Object.keys(validResult.errors).length, 0);

  // Test 2: Missing name
  const missingName = { name: '', email: 'john@example.com', age: 30 };
  const missingNameResult = validateForm(missingName);
  assert.ok(!missingNameResult.valid);
  assert.ok(missingNameResult.errors.name);

  // Test 3: Invalid email
  const invalidEmail = { name: 'John Doe', email: 'invalid-email', age: 30 };
  const invalidEmailResult = validateForm(invalidEmail);
  assert.ok(!invalidEmailResult.valid);
  assert.ok(invalidEmailResult.errors.email);

  // Test 4: Invalid age
  const invalidAge = { name: 'John Doe', email: 'john@example.com', age: 200 };
  const invalidAgeResult = validateForm(invalidAge);
  assert.ok(!invalidAgeResult.valid);
  assert.ok(invalidAgeResult.errors.age);

  // Test 5: Save validated data to storage
  if (validResult.valid) {
    await testApp.api.storage.kv.set('form-data', validData);
    const saved = await testApp.api.storage.kv.get('form-data');
    assert.deepEqual(saved, validData);
  }

  // Test 6: Show validation errors in UI
  if (!missingNameResult.valid) {
    await testApp.api.ui.toast('Please fix form errors', { type: 'error' });
    assert.equal(testApp.ui.toasts.length, 1);
    assert.equal(testApp.ui.toasts[0].type, 'error');
  }

  console.log('✓ All form validation tests passed');
});
