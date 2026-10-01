import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../../apps/api/src/server.mjs';

test('identity and API key lifecycle exposes redacted contract', async () => {
  const app = buildServer({ logger: false });
  const bootstrap = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'Admin', credential: 'correct horse battery staple' } });
  assert.equal(bootstrap.statusCode, 201);
  const receipt = bootstrap.json();
  assert.ok(receipt.sessionId);
  assert.match(bootstrap.headers['set-cookie'], /HttpOnly/);
  const session = await app.inject({ method: 'GET', url: '/api/v1/identity/admin/session', headers: { authorization: `Bearer ${receipt.sessionId}` } });
  assert.equal(session.statusCode, 200);
  const key = await app.inject({ method: 'POST', url: '/api/v1/secret/api-keys', headers: { authorization: `Bearer ${receipt.sessionId}` }, payload: { name: 'CI', scopes: ['audit.read'] } });
  assert.equal(key.statusCode, 201);
  assert.match(key.json().secret, /^dgos_/);
  const list = await app.inject({ method: 'GET', url: '/api/v1/secret/api-keys', headers: { authorization: `Bearer ${receipt.sessionId}` } });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().items[0].secret, undefined);
  const rotated = await app.inject({ method: 'POST', url: `/api/v1/secret/api-keys/${key.json().key.keyId}/rotate`, headers: { authorization: `Bearer ${receipt.sessionId}` }, payload: { requestId: 'rotate-1', baseVersion: '1' } });
  assert.equal(rotated.statusCode, 200);
  assert.equal(rotated.json().previousKeyId, key.json().key.keyId);
  assert.equal(rotated.json().secret === key.json().secret, false);
  assert.equal((await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'Second', credential: 'second-credential' } })).statusCode, 409);
  const bad = await app.inject({ method: 'GET', url: '/api/v1/identity/admin/session' });
  assert.equal(bad.statusCode, 401);
  assert.equal(bad.json().errorKey, 'session_invalid');
  await app.close();
});
