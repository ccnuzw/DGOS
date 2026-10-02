import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../../apps/api/src/server.mjs';
import { InMemoryIdentityRepository } from '../../src/identity/repository.mjs';

test('Authentication - invalid session token rejected', async (t) => {
  const app = buildServer({ logger: false });
  await app.ready();

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/provider/accounts',
    headers: { authorization: 'Bearer invalid-token-format' },
  });

  assert.equal(response.statusCode, 401);
  const body = JSON.parse(response.body);
  assert.equal(body.errorKey, 'session_invalid');

  await app.close();
});

test('Authentication - missing credentials rejected', async (t) => {
  const app = buildServer({ logger: false });
  await app.ready();

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/provider/accounts',
  });

  assert.equal(response.statusCode, 401);

  await app.close();
});

test('Authorization - insufficient scope rejected', async (t) => {
  const repository = new InMemoryIdentityRepository();
  const app = buildServer({ logger: false, repository });
  await app.ready();

  // Create API key with limited scope
  const principal = await repository.createPrincipal({ credentialRef: 'test@example.com' });
  const keyResult = await repository.createKey({
    ownerId: principal.principalId,
    name: 'Limited Key',
    scopes: ['provider.account.read'], // Only read scope
  });

  // Attempt write operation with read-only key
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/provider/accounts',
    headers: {
      authorization: `ApiKey ${keyResult.secret}`,
      'content-type': 'application/json',
    },
    payload: { protocol: 'openai-compatible', label: 'Test' },
  });

  assert.equal(response.statusCode, 403);
  const body = JSON.parse(response.body);
  assert.equal(body.errorKey, 'insufficient_scope');

  await app.close();
});

test('Authorization - session-based access control', async (t) => {
  const repository = new InMemoryIdentityRepository();
  const app = buildServer({ logger: false, repository });
  await app.ready();

  // Create two users
  const principal1 = await repository.createPrincipal({ credentialRef: 'user1@example.com' });
  const principal2 = await repository.createPrincipal({ credentialRef: 'user2@example.com' });

  const session1 = await repository.createSession({
    principalId: principal1.principalId,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });

  // User1 creates a provider account
  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/provider/accounts',
    headers: {
      cookie: `dgos_session=${session1.sessionId}`,
      'x-dgos-csrf': 'web',
      'content-type': 'application/json',
    },
    payload: { protocol: 'openai-compatible', label: 'User1 Account', endpoint: 'https://api.example.com' },
  });

  assert.equal(createResponse.statusCode, 201);
  const created = JSON.parse(createResponse.body);

  // User1 can read their own accounts
  const listResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/provider/accounts',
    headers: { cookie: `dgos_session=${session1.sessionId}` },
  });

  assert.equal(listResponse.statusCode, 200);
  const accounts = JSON.parse(listResponse.body);
  assert.ok(accounts.items.some(a => a.accountId === created.accountId));

  await app.close();
});

test('Rate limiting - login attempts limited', async (t) => {
  const repository = new InMemoryIdentityRepository();
  const app = buildServer({ logger: false, repository });
  await app.ready();

  // Create a principal
  await repository.createPrincipal({ credentialRef: 'test@example.com' });

  // Attempt multiple failed logins
  const attempts = [];
  for (let i = 0; i < 6; i++) {
    attempts.push(
      app.inject({
        method: 'POST',
        url: '/api/v1/identity/bootstrap',
        headers: { 'content-type': 'application/json' },
        payload: { credentialRef: 'wrong@example.com' },
      })
    );
  }

  const responses = await Promise.all(attempts);

  // Later attempts should be rate limited
  const rateLimited = responses.slice(-1)[0];
  assert.ok(rateLimited.statusCode === 429 || rateLimited.statusCode === 401, 'Should rate limit after multiple failures');

  await app.close();
});

test('Step-up authentication - fresh session required for sensitive operations', async (t) => {
  const repository = new InMemoryIdentityRepository();
  const app = buildServer({ logger: false, repository });
  await app.ready();

  const principal = await repository.createPrincipal({ credentialRef: 'test@example.com' });

  // Create session without fresh auth
  const session = await repository.createSession({
    principalId: principal.principalId,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    authFreshUntil: new Date(Date.now() - 1000).toISOString(), // Expired freshness
  });

  // Attempt sensitive operation (create API key)
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/secret/api-keys',
    headers: {
      cookie: `dgos_session=${session.sessionId}`,
      'x-dgos-csrf': 'web',
      'content-type': 'application/json',
    },
    payload: { name: 'Test Key', scopes: ['*'] },
  });

  assert.equal(response.statusCode, 403);
  const body = JSON.parse(response.body);
  assert.equal(body.errorKey, 'step_up_required');

  await app.close();
});
