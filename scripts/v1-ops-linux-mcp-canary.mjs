import assert from 'node:assert/strict';
import { IsolatedExtensionRunner } from '../apps/extension-runner/src/runner.mjs';

const runner = new IsolatedExtensionRunner({ runnerProfiles: { canary: {
  command: process.execPath, allowedCommand: process.execPath,
  args: ['/workspace/deployment/ops-canary/approved/mcp-canary.mjs'], cwd: '/workspace/deployment/ops-canary/approved', allowedCwdRoot: '/workspace/deployment/ops-canary/approved',
  sandbox: 'linux-bwrap', timeoutMs: 5000,
} } });
const binding = { subjectId: 'ops-canary', kind: 'mcp', extensionId: 'canary', version: '1.0.0', config: { transport: 'stdio', runnerProfileId: 'canary' } };
try {
  const tools = await runner.connect(binding);
  assert.deepEqual(tools.map((tool) => tool.name), ['probe']);
  const result = await runner.invoke({ ...binding, operationId: 'probe', input: {} });
  assert.deepEqual(result, {
    privateReadDenied: {
      '/run/dgos-root-keys/ops-canary.txt': true,
      '/var/lib/dgos/ciphertext/ops-canary.txt': true,
      '/home/ops-private-canary.txt': true,
    },
    writeDenied: true, parentWriteDenied: true, networkDenied: true,
  });
  console.log(JSON.stringify({ status: 'linux_mcp_canary_pass', uid: process.getuid(), tools: tools.map((tool) => tool.name), result }));
} finally {
  await runner.disconnect(binding);
  await runner.close();
}
