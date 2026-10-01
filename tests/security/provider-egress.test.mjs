import test from 'node:test';
import assert from 'node:assert/strict';
import { ProviderEgress } from '../../src/security/provider-egress.mjs';

const noopFetch = async () => ({ status: 200 });

test('ProviderEgress blocks private and metadata targets before fetch', async () => {
  let calls = 0;
  const egress = new ProviderEgress({ fetchImpl: async () => { calls += 1; return noopFetch(); }, lookup: async () => [{ address: '127.0.0.1' }] });
  await assert.rejects(egress.request({ url: 'https://provider.example/v1/health' }), (error) => error.errorKey === 'policy_blocked');
  assert.equal(calls, 0);
  await assert.rejects(egress.request({ url: 'https://169.254.169.254/latest/meta-data' }), (error) => error.errorKey === 'policy_blocked');
});

test('ProviderEgress requires HTTPS and rejects redirects', async () => {
  const egress = new ProviderEgress({ fetchImpl: noopFetch, lookup: async () => [{ address: '8.8.8.8' }] });
  await assert.rejects(egress.request({ url: 'http://provider.example/health' }), (error) => error.errorKey === 'endpoint_invalid');
  const response = await egress.request({ url: 'https://provider.example/health' });
  assert.equal(response.status, 200);
});
