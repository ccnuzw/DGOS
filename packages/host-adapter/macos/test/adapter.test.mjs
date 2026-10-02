import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { macosHostAdapter } from '../index.js';

afterEach(() => { delete globalThis.__TAURI_INTERNALS__; });

test('host operations are delegated only to the native bridge', async () => {
  const calls = [];
  globalThis.__TAURI_INTERNALS__ = { invoke: async (command, args) => { calls.push([command, args]); return { version: 1 }; } };
  await macosHostAdapter.windows.open('settings');
  await macosHostAdapter.windows.loadWorkspace();
  await macosHostAdapter.session.forgetLocalBinding();
  assert.deepEqual(calls, [['open_window', { label: 'settings' }], ['load_workspace', undefined], ['forget_desktop_session', undefined]]);
});

test('browser without native bridge reports unavailability', () => {
  assert.throws(() => macosHostAdapter.windows.saveWorkspace(), /unavailable/);
});
