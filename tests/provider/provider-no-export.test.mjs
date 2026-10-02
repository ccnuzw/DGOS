import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../../apps/api/src/server.mjs';
import { InMemoryIdentityRepository } from '../../src/identity/repository.mjs';

test('provider management has no import/export route and redacts credentials', async () => {
  const app = buildServer({ logger: false, repository: new InMemoryIdentityRepository(), providerEgress: { async validateTarget(url) { return new URL(url); } } });
  try {
    const bootstrap = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'Provider Fixture', credential: 'fixture-admin-credential' } });
    assert.equal(bootstrap.statusCode, 201, bootstrap.body);
    const auth = { authorization: `Bearer ${bootstrap.json().sessionId}` };
    const credential = 'provider-no-export-fixture-secret';
    const account = await app.inject({ method: 'POST', url: '/api/v1/provider/accounts', headers: auth, payload: { protocolType: 'openai-compatible', displayName: 'Fixture Account', credential, scope: { endpoint: 'https://provider.fixture.test/v1' } } });
    assert.equal(account.statusCode, 201, account.body);
    const config = await app.inject({ method: 'POST', url: '/api/v1/provider/configs', headers: auth, payload: { requestId: 'fixture-create', providerAccountId: account.json().accountId, protocolType: 'openai-compatible', displayName: 'Fixture Config', baseUrl: 'https://provider.fixture.test/v1' } });
    assert.equal(config.statusCode, 201, config.body);
    for (const response of [account, config, await app.inject({ method: 'GET', url: '/api/v1/provider/accounts', headers: auth }), await app.inject({ method: 'GET', url: '/api/v1/provider/configs', headers: auth })]) {
      assert.doesNotMatch(response.body, /provider-no-export-fixture-secret|provider-credential:|secretRef|credentialRef|_secretRef/i);
    }
    for (const path of ['/api/v1/provider/configs/import', '/api/v1/provider/configs/export', `/api/v1/provider/configs/${config.json().id}/export`]) {
      for (const method of ['GET', 'POST']) {
        const response = await app.inject({ method, url: path, headers: auth, payload: method === 'POST' ? {} : undefined });
        assert.equal(response.statusCode, 404, `${method} ${path}: ${response.body}`);
      }
    }
    const after = await app.inject({ method: 'GET', url: '/api/v1/provider/configs', headers: auth });
    assert.equal(after.json().items.length, 1);
    assert.equal(after.json().items[0].id, config.json().id);
  } finally { await app.close(); }
});
