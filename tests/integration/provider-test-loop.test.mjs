import test from 'node:test';
import assert from 'node:assert/strict';
import { runProviderTestLoop } from '../../apps/worker/src/provider-test-loop.mjs';

test('provider test loop polls independently until stopped', async () => {
  const controller = new AbortController(); let calls = 0;
  await runProviderTestLoop({ worker: { async runOnce() { calls += 1; if (calls === 3) controller.abort(); return undefined; } }, signal: controller.signal, pollIntervalMs: 1 });
  assert.equal(calls, 3);
});
