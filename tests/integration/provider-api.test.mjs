import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../../apps/api/src/server.mjs';
import { InMemoryProviderRepository } from '../../src/provider/repository.mjs';
import { ProviderEgress } from '../../src/security/provider-egress.mjs';
import { InMemoryIdentityRepository } from '../../src/identity/repository.mjs';
import { InMemoryAuditRepository } from '../../src/audit/outbox.mjs';

test('provider account and controlled connection test lifecycle', async () => {
  const providerRepository = new InMemoryProviderRepository();
  const app = buildServer({ logger: false, repository: new InMemoryIdentityRepository(), auditRepository: new InMemoryAuditRepository(), providerRepository, providerEgress: { async validateTarget(value) { return new URL(value); } } });
  const bootstrap = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'Provider Admin', credential: 'provider-password' } });
  const sessionId = bootstrap.json().sessionId;
  const account = await app.inject({ method: 'POST', url: '/api/v1/provider/accounts', headers: { authorization: `Bearer ${sessionId}` }, payload: { protocolType: 'openai-compatible', displayName: 'Local Provider', credential: 'provider-secret', scope: { endpoint: 'https://api.example.com' } } });
  assert.equal(account.statusCode, 201);
  assert.equal(account.json().credential, undefined);
  assert.equal(account.json().credentialRef, undefined);
  const list = await app.inject({ method: 'GET', url: '/api/v1/provider/accounts', headers: { authorization: `Bearer ${sessionId}` } });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().items.length, 1);
  const queued = await app.inject({ method: 'POST', url: '/api/v1/provider/connection-tests', headers: { authorization: `Bearer ${sessionId}` }, payload: { accountId: account.json().accountId, accountVersion: '1', protocolVersion: 'v1' } });
  assert.equal(queued.statusCode, 202, queued.body);
  assert.equal(queued.json().status, 'queued');
  await providerRepository.finishConnectionTest(queued.json().testId, 'succeeded', undefined, 1);
  const ready = await app.inject({ method: 'POST', url: `/api/v1/provider/accounts/${account.json().accountId}/state`, headers: { authorization: `Bearer ${sessionId}` }, payload: { state: 'ready', baseVersion: '1', connectionTestId: queued.json().testId } });
  assert.equal(ready.statusCode, 200, ready.body);
  const disabled = await app.inject({ method: 'POST', url: `/api/v1/provider/accounts/${account.json().accountId}/state`, headers: { authorization: `Bearer ${sessionId}` }, payload: { state: 'disabled', baseVersion: '2' } });
  assert.equal(disabled.statusCode, 200);
  const rejected = await app.inject({ method: 'POST', url: '/api/v1/provider/connection-tests', headers: { authorization: `Bearer ${sessionId}` }, payload: { accountId: account.json().accountId, protocolVersion: 'v1' } });
  assert.equal(rejected.statusCode, 422);
  await app.close();
});

test('ProviderEgress rejects private and non-HTTPS targets before adapter fetch', async () => {
  let called = false;
  const egress = new ProviderEgress({ fetchImpl: async () => { called = true; } });
  await assert.rejects(egress.request({ url: 'http://127.0.0.1/models' }), /endpoint_invalid/);
  await assert.rejects(egress.request({ url: 'https://127.0.0.1/models' }), /policy_blocked/);
  assert.equal(called, false);
});
