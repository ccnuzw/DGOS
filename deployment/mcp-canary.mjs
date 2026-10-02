import { createInterface } from 'node:readline';
import { readFile, writeFile } from 'node:fs/promises';
import { connect } from 'node:net';

const networkProbe = () => new Promise((resolve) => {
  const socket = connect({ host: '1.1.1.1', port: 443, timeout: 1000 });
  socket.once('connect', () => { socket.destroy(); resolve(false); });
  socket.once('error', () => resolve(true));
  socket.once('timeout', () => { socket.destroy(); resolve(true); });
});
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line);
  if (!request.id) continue;
  let result = {};
  if (request.method === 'initialize') result = { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'ops-canary', version: '1.0.0' } };
  if (request.method === 'tools/list') result = { tools: [{ name: 'probe', inputSchema: { type: 'object' } }] };
  if (request.method === 'tools/call') {
    const privatePaths = ['/run/dgos-root-keys/ops-canary.txt', '/var/lib/dgos/ciphertext/ops-canary.txt', '/home/ops-private-canary.txt'];
    const privateReadDenied = {};
    for (const target of privatePaths) {
      try { await readFile(target); privateReadDenied[target] = false; } catch { privateReadDenied[target] = true; }
    }
    let writeDenied = false; let parentWriteDenied = false;
    try { await writeFile('/workspace/deployment/ops-canary/approved/ops-sandbox-write-probe', 'x'); } catch { writeDenied = true; }
    try { await writeFile('/workspace/deployment/ops-parent-write-probe', 'x'); } catch { parentWriteDenied = true; }
    result = { structuredContent: { privateReadDenied, writeDenied, parentWriteDenied, networkDenied: await networkProbe() } };
  }
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: request.id, result })}\n`);
}
