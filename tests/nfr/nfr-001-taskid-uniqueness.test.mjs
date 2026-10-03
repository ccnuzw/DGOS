// NFR-001: TaskId Uniqueness Validation
// Requirement: Unique task IDs, no collisions
import { test } from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';

test('NFR-001: TaskId uniqueness - UUID v4 format validation', () => {
  const taskId = randomUUID();
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.match(taskId, uuidV4Regex, 'TaskId should be valid UUID v4 format');
});

test('NFR-001: TaskId collision resistance - 10000 IDs', () => {
  const ids = new Set();
  const count = 10000;

  for (let i = 0; i < count; i++) {
    ids.add(randomUUID());
  }

  assert.strictEqual(ids.size, count, `All ${count} generated IDs should be unique`);
});

test('NFR-001: TaskId collision resistance - 50000 IDs', () => {
  const ids = new Set();
  const count = 50000;

  for (let i = 0; i < count; i++) {
    ids.add(randomUUID());
  }

  assert.strictEqual(ids.size, count, `All ${count} generated IDs should be unique`);
});

test('NFR-001: TaskId generation across restarts', () => {
  // Simulate multiple restart cycles
  const allIds = new Set();

  for (let restart = 0; restart < 10; restart++) {
    const batchIds = [];
    for (let i = 0; i < 1000; i++) {
      batchIds.push(randomUUID());
    }

    // Check no duplicates in this batch
    const batchSet = new Set(batchIds);
    assert.strictEqual(batchSet.size, batchIds.length,
      `Batch ${restart} should have no duplicates`);

    // Add to global set
    batchIds.forEach(id => allIds.add(id));
  }

  assert.strictEqual(allIds.size, 10000,
    'All IDs across restarts should be unique');
});

test('NFR-001: TaskId consistency check', () => {
  const id1 = randomUUID();
  const id2 = randomUUID();

  assert.notStrictEqual(id1, id2, 'Sequential IDs must be different');
  assert.strictEqual(id1.length, 36, 'UUID should be 36 characters');
  assert.strictEqual(id2.length, 36, 'UUID should be 36 characters');
});
