export function createControlledProviderRunner({ delayMs = 0, chunks = ['ok'], failure, timeoutMs } = {}) {
  return async function* controlledProviderRunner({ signal }) {
    const deadline = timeoutMs ? setTimeout(() => signal.dispatchEvent(new Event('timeout')), timeoutMs) : undefined;
    try {
      for (const chunk of chunks) {
        if (signal.aborted) throw Object.assign(new Error('cancelled'), { errorKey: 'cancelled' });
        if (failure) throw Object.assign(new Error(failure), { errorKey: failure });
        if (delayMs) await new Promise((resolve, reject) => { const timer = setTimeout(resolve, delayMs); signal.addEventListener('abort', () => { clearTimeout(timer); reject(Object.assign(new Error('cancelled'), { errorKey: 'cancelled' })); }, { once: true }); });
        yield chunk;
      }
    } finally { if (deadline) clearTimeout(deadline); }
  };
}
