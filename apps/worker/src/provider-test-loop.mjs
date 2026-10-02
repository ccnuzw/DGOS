import { setTimeout as delay } from 'node:timers/promises';

export async function runProviderTestLoop({ worker, signal, pollIntervalMs = 250, onError = () => {} }) {
  while (!signal?.aborted) {
    try {
      if (await worker.runOnce()) continue;
    } catch (error) {
      onError(error);
    }
    try { await delay(pollIntervalMs, undefined, { signal }); } catch { break; }
  }
}
