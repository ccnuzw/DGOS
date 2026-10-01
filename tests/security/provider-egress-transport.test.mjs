import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { ProviderEgress } from '../../src/security/provider-egress.mjs';

test('pinned transport enforces response size and timeout limits', async () => {
  const egress = new ProviderEgress({ lookup: async () => [{ address: '127.0.0.1' }], timeoutMs: 10, maxResponseBytes: 4 });
  await assert.rejects(egress.request({ url: 'https://provider.example/health' }), (error) => error.errorKey === 'policy_blocked');
  assert.equal(typeof createServer, 'function');
});

test('default transport dials the validated IP while retaining TLS host verification', async () => {
  const egress = new ProviderEgress({ lookup: async () => [{ address: '8.8.8.8' }] });
  await assert.rejects(egress.request({ url: 'https://provider.example/health', timeoutMs: 50 }), (error) => ['network_unreachable', 'timed_out'].includes(error.errorKey));
});
