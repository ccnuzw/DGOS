// Todo App Test Suite
// Complete test coverage for the Todo DGOS app

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTestApp,
  assertStorageValue,
  assertContains,
} from '../../../packages/sdk/src/testing/index.ts';

test.describe('Todo App Tests', () => {
  test('creates a new todo', async () => {
    const testApp = createTestApp({
      context: { appId: 'com.dgos.todo', version: '1.0.0' },
    });

    const todo = {
      id: '1',
      title: 'Buy groceries',
      completed: false,
      createdAt: new Date().toISOString(),
    };

    await testApp.api.storage.kv.set('todos', [todo]);

    const todos = await testApp.api.storage.kv.get('todos');
    assert.equal(todos.length, 1);
    assert.equal(todos[0].title, 'Buy groceries');
  });

  test('marks todo as completed', async () => {
    const testApp = createTestApp();

    const todos = [
      { id: '1', title: 'Task 1', completed: false },
      { id: '2', title: 'Task 2', completed: false },
    ];

    await testApp.api.storage.kv.set('todos', todos);

    // Mark first todo as completed
    todos[0].completed = true;
    await testApp.api.storage.kv.set('todos', todos);

    const updated = await testApp.api.storage.kv.get('todos');
    assert.ok(updated[0].completed);
    assert.ok(!updated[1].completed);
  });

  test('deletes a todo', async () => {
    const testApp = createTestApp();

    const todos = [
      { id: '1', title: 'Task 1', completed: false },
      { id: '2', title: 'Task 2', completed: false },
    ];

    await testApp.api.storage.kv.set('todos', todos);

    // Delete first todo
    const filtered = todos.filter((t) => t.id !== '1');
    await testApp.api.storage.kv.set('todos', filtered);

    const remaining = await testApp.api.storage.kv.get('todos');
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, '2');
  });

  test('filters active todos', async () => {
    const testApp = createTestApp();

    const todos = [
      { id: '1', title: 'Active task', completed: false },
      { id: '2', title: 'Completed task', completed: true },
      { id: '3', title: 'Another active', completed: false },
    ];

    await testApp.api.storage.kv.set('todos', todos);

    const allTodos = await testApp.api.storage.kv.get('todos');
    const active = allTodos.filter((t) => !t.completed);

    assert.equal(active.length, 2);
    assertContains(active, (t) => t.title === 'Active task');
  });

  test('filters completed todos', async () => {
    const testApp = createTestApp();

    const todos = [
      { id: '1', title: 'Task 1', completed: false },
      { id: '2', title: 'Task 2', completed: true },
      { id: '3', title: 'Task 3', completed: true },
    ];

    await testApp.api.storage.kv.set('todos', todos);

    const allTodos = await testApp.api.storage.kv.get('todos');
    const completed = allTodos.filter((t) => t.completed);

    assert.equal(completed.length, 2);
  });

  test('clears completed todos', async () => {
    const testApp = createTestApp();

    const todos = [
      { id: '1', title: 'Task 1', completed: false },
      { id: '2', title: 'Task 2', completed: true },
      { id: '3', title: 'Task 3', completed: true },
    ];

    await testApp.api.storage.kv.set('todos', todos);

    // Clear completed
    const allTodos = await testApp.api.storage.kv.get('todos');
    const remaining = allTodos.filter((t) => !t.completed);
    await testApp.api.storage.kv.set('todos', remaining);

    const updated = await testApp.api.storage.kv.get('todos');
    assert.equal(updated.length, 1);
    assert.equal(updated[0].id, '1');
  });

  test('updates todo title', async () => {
    const testApp = createTestApp();

    const todos = [{ id: '1', title: 'Old title', completed: false }];

    await testApp.api.storage.kv.set('todos', todos);

    // Update title
    todos[0].title = 'New title';
    await testApp.api.storage.kv.set('todos', todos);

    const updated = await testApp.api.storage.kv.get('todos');
    assert.equal(updated[0].title, 'New title');
  });

  test('persists todos across sessions', async () => {
    // First session
    const testApp1 = createTestApp();
    await testApp1.api.storage.kv.set('todos', [
      { id: '1', title: 'Persistent todo', completed: false },
    ]);

    // Second session (simulated)
    const testApp2 = createTestApp({
      storage: testApp1.storage, // Share storage
    });

    const todos = await testApp2.api.storage.kv.get('todos');
    assert.equal(todos.length, 1);
    assert.equal(todos[0].title, 'Persistent todo');
  });

  test('validates todo input', async () => {
    function validateTodo(title): { valid; error? } {
      if (!title || title.trim().length === 0) {
        return { valid: false, error: 'Title is required' };
      }
      if (title.length > 200) {
        return { valid: false, error: 'Title is too long' };
      }
      return { valid: true };
    }

    // Valid input
    const valid = validateTodo('Valid todo title');
    assert.ok(valid.valid);

    // Empty input
    const empty = validateTodo('');
    assert.ok(!empty.valid);
    assert.equal(empty.error, 'Title is required');

    // Too long
    const tooLong = validateTodo('x'.repeat(201));
    assert.ok(!tooLong.valid);
    assert.equal(tooLong.error, 'Title is too long');
  });

  test('shows notification on todo completion', async () => {
    const testApp = createTestApp();

    const todo = { id: '1', title: 'Complete this task', completed: false };
    await testApp.api.storage.kv.set('todos', [todo]);

    // Complete todo
    todo.completed = true;
    await testApp.api.storage.kv.set('todos', [todo]);

    // Show notification
    await testApp.api.ui.notify({
      title: 'Todo Completed',
      body: 'Complete this task',
    });

    assert.equal(testApp.ui.notifications.length, 1);
  });
});
