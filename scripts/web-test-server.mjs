import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 15133;

export async function findAvailablePort({ host = DEFAULT_HOST, preferredPort = DEFAULT_PORT } = {}) {
  const requestedPort = Number(preferredPort);
  if (Number.isInteger(requestedPort) && requestedPort > 0 && await isPortAvailable(host, requestedPort)) return requestedPort;
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen({ host, port: 0 }, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

export async function isPortAvailable(host, port) {
  return new Promise(resolve => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen({ host, port }, () => server.close(() => resolve(true)));
  });
}

export async function waitForHttp(url, { timeoutMs = 15_000, intervalMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`web_server_start_timeout:${url}`);
}

export function startWebServer({ cwd, host = DEFAULT_HOST, port, env = process.env } = {}) {
  const child = spawn(process.execPath, ['apps/web/scripts/serve.mjs'], {
    cwd,
    env: { ...env, HOST: host, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    if (child.exitCode !== null || child.signalCode) return;
    child.kill('SIGTERM');
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      new Promise(resolve => setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); resolve(); }, 5_000)),
    ]);
  };
  return { child, stop };
}
