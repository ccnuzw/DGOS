import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../../apps/api/src/server.mjs';
import { InMemoryIdentityRepository } from '../../src/identity/repository.mjs';

test('XSS - API error responses do not reflect unsanitized input', async (t) => {
  const app = buildServer({ logger: false });
  await app.ready();

  const xssPayload = '<script>alert("XSS")</script>';
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/provider/accounts/${xssPayload}`,
    headers: { authorization: 'Bearer invalid' },
  });

  // Response should be JSON, not HTML that could execute script
  assert.equal(response.headers['content-type'], 'application/json; charset=utf-8');

  const body = JSON.parse(response.body);
  // Ensure the XSS payload is not reflected in the response body
  assert.ok(!response.body.includes('<script>'), 'Response should not contain script tags');
  assert.ok(!response.body.includes('alert('), 'Response should not contain alert function');

  await app.close();
});

test('CSRF - POST requires x-dgos-csrf header with session cookie', async (t) => {
  const repository = new InMemoryIdentityRepository();
  const app = buildServer({ logger: false, repository });
  await app.ready();

  // Bootstrap admin
  const principal = await repository.createPrincipal({ credentialRef: 'test@example.com' });
  const session = await repository.createSession({
    principalId: principal.principalId,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });

  // Attempt POST without CSRF header (simulating CSRF attack)
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/provider/accounts',
    headers: {
      cookie: `dgos_session=${session.sessionId}`,
      'content-type': 'application/json',
    },
    payload: { protocol: 'openai-compatible', label: 'Test' },
  });

  assert.equal(response.statusCode, 403, 'Should reject request without CSRF header');
  const body = JSON.parse(response.body);
  assert.equal(body.errorKey, 'csrf_failed');

  await app.close();
});

test('CSRF - POST succeeds with x-dgos-csrf header', async (t) => {
  const repository = new InMemoryIdentityRepository();
  const app = buildServer({ logger: false, repository });
  await app.ready();

  const principal = await repository.createPrincipal({ credentialRef: 'test@example.com' });
  const session = await repository.createSession({
    principalId: principal.principalId,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });

  // POST with CSRF header
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/provider/accounts',
    headers: {
      cookie: `dgos_session=${session.sessionId}`,
      'x-dgos-csrf': 'web',
      'content-type': 'application/json',
    },
    payload: { protocol: 'openai-compatible', label: 'Test', endpoint: 'https://api.example.com', credential: 'sk-test-key' },
  });

  assert.equal(response.statusCode, 201, 'Should accept request with CSRF header');

  await app.close();
});

test('CSRF - Origin validation rejects cross-origin requests', async (t) => {
  const repository = new InMemoryIdentityRepository();
  const app = buildServer({ logger: false, repository });
  await app.ready();

  const principal = await repository.createPrincipal({ credentialRef: 'test@example.com' });
  const session = await repository.createSession({
    principalId: principal.principalId,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });

  // Attempt POST with malicious origin
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/provider/accounts',
    headers: {
      cookie: `dgos_session=${session.sessionId}`,
      'x-dgos-csrf': 'web',
      origin: 'https://evil.com',
      host: 'localhost',
      'content-type': 'application/json',
    },
    payload: { protocol: 'openai-compatible', label: 'Test' },
  });

  assert.equal(response.statusCode, 403, 'Should reject cross-origin request');
  const body = JSON.parse(response.body);
  assert.equal(body.errorKey, 'csrf_failed');

  await app.close();
});
