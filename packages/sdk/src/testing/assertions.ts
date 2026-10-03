// DGOS Testing Assertions
// Custom assertion helpers for DGOS app testing

import assert from 'node:assert/strict';
import type { TaskSnapshot, PermissionStatus } from '../app-runtime.js';

/**
 * Assert that a permission has the expected status
 */
export function assertPermission(
  actual: PermissionStatus,
  expected: PermissionStatus,
  message?: string
): void {
  assert.equal(actual, expected, message || `Expected permission status to be ${expected}, got ${actual}`);
}

/**
 * Assert that a task has reached a specific status
 */
export function assertTaskStatus(
  task: TaskSnapshot,
  expectedStatus: TaskSnapshot['status'],
  message?: string
): void {
  assert.equal(
    task.status,
    expectedStatus,
    message || `Expected task status to be ${expectedStatus}, got ${task.status}`
  );
}

/**
 * Assert that storage contains a specific key
 */
export function assertStorageHasKey(
  storage: Map<string, any>,
  key: string,
  message?: string
): void {
  assert.ok(storage.has(key), message || `Expected storage to contain key: ${key}`);
}

/**
 * Assert that storage has a specific value
 */
export function assertStorageValue(
  storage: Map<string, any>,
  key: string,
  expectedValue: any,
  message?: string
): void {
  assertStorageHasKey(storage, key, message);
  assert.deepEqual(
    storage.get(key),
    expectedValue,
    message || `Expected storage[${key}] to equal ${JSON.stringify(expectedValue)}`
  );
}

/**
 * Assert that UI was notified
 */
export function assertNotified(
  notifications: Array<any>,
  predicate: (notification: any) => boolean,
  message?: string
): void {
  const found = notifications.some(predicate);
  assert.ok(found, message || 'Expected to find matching notification');
}

/**
 * Assert that a dialog was shown
 */
export function assertDialogShown(
  dialogs: Array<any>,
  type: 'alert' | 'confirm' | 'prompt',
  message?: string
): void {
  const found = dialogs.some(d => d.type === type);
  assert.ok(found, message || `Expected ${type} dialog to be shown`);
}

/**
 * Assert that an error matches expected pattern
 */
export function assertError(
  fn: () => any | Promise<any>,
  expectedMessage?: string | RegExp,
  message?: string
): void | Promise<void> {
  const result = fn();
  if (result instanceof Promise) {
    return assert.rejects(result, (err: Error) => {
      if (expectedMessage) {
        if (typeof expectedMessage === 'string') {
          return err.message.includes(expectedMessage);
        } else {
          return expectedMessage.test(err.message);
        }
      }
      return true;
    }, message);
  } else {
    assert.throws(() => fn(), (err: Error) => {
      if (expectedMessage) {
        if (typeof expectedMessage === 'string') {
          return err.message.includes(expectedMessage);
        } else {
          return expectedMessage.test(err.message);
        }
      }
      return true;
    }, message);
  }
}

/**
 * Assert that a value matches a snapshot (for snapshot testing)
 */
export function assertSnapshot(
  actual: any,
  snapshotId: string,
  snapshots: Map<string, any>
): void {
  if (!snapshots.has(snapshotId)) {
    snapshots.set(snapshotId, actual);
    return;
  }

  const expected = snapshots.get(snapshotId);
  assert.deepEqual(actual, expected, `Snapshot ${snapshotId} does not match`);
}

/**
 * Assert that an array contains a specific item
 */
export function assertContains<T>(
  array: T[],
  predicate: (item: T) => boolean,
  message?: string
): void {
  const found = array.some(predicate);
  assert.ok(found, message || 'Expected array to contain matching item');
}

/**
 * Assert that a response time is within acceptable bounds
 */
export function assertResponseTime(
  actualMs: number,
  maxMs: number,
  message?: string
): void {
  assert.ok(
    actualMs <= maxMs,
    message || `Response time ${actualMs}ms exceeded maximum ${maxMs}ms`
  );
}
