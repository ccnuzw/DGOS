import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../../apps/api/src/server.mjs';
import { InMemoryProviderRepository } from '../../src/provider/repository.mjs';
import { ProviderEgress } from '../../src/security/provider-egress.mjs';
import { InMemoryIdentityRepository } from '../../src/identity/repository.mjs';
import { InMemoryAuditRepository } from '../../src/audit/outbox.mjs';

test('provider account and controlled connection test lifecycle', async () => {
  const providerRepository = new InMemoryProviderRepository();
  const app = buildServer({ logger: false, repository: new InMemoryIdentityRepository(), auditRepository: new InMemoryAuditRepository(), providerRepository });
  const bootstrap = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'Provider Admin', credential: 'provider-password' } });
  const sessionId = bootstrap.json().sessionId;
  const account = await app.inject({ method: 'POST', url: '/api/v1/provider/accounts', headers: { authorization: `Bearer ${sessionId}` }, payload: { protocolType: 'openai-compatible', displayName: 'Local Provider', credential: 'provider-secret', scope: { endpoint: 'https://api.example.com' } } });
  assert.equal(account.statusCode, 201);
  assert.equal(account.json().credential, undefined);
  assert.equal(account.json().credentialRef, undefined);
  const list = await app.inject({ method: 'GET', url: '/api/v1/provider/accounts', headers: { authorization: `Bearer ${sessionId}` } });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().items.length, 1);
  const disabled = await app.inject({ method: 'POST', url: `/api/v1/provider/accounts/${account.json().accountId}/state`, headers: { authorization: `Bearer ${sessionId}` }, payload: { state: 'disabled', baseVersion: '1' } });
  assert.equal(disabled.statusCode, 200);
  const queued = await app.inject({ method: 'POST', url: '/api/v1/provider/connection-tests', headers: { authorization: `Bearer ${sessionId}` }, payload: { accountId: account.json().accountId, protocolVersion: 'v1' } });
  assert.equal(queued.statusCode, 202);
  assert.equal(queued.json().status, 'queued');
  await app.close();
});

test('ProviderEgress rejects private and non-HTTPS targets before adapter fetch', async () => {
  let called = false;
  const egress = new ProviderEgress({ fetchImpl: async () => { called = true; } });
  await assert.rejects(egress.request({ url: 'http://127.0.0.1/models' }), /endpoint_invalid/);
  await assert.rejects(egress.request({ url: 'https://127.0.0.1/models' }), /policy_blocked/);
  assert.equal(called, false);
});
