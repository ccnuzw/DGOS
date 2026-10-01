import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../../apps/api/src/server.mjs';

test('V1-E2E-15 usage scope rejects API key cross-subject query', async () => {
  const app = buildServer({ logger: false });
  const bootstrap = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'Scope owner', credential: 'scope-password' } });
  const auth = { authorization: `Bearer ${bootstrap.json().sessionId}` };
  const key = await app.inject({ method: 'POST', url: '/api/v1/secret/api-keys', headers: auth, payload: { name: 'usage-reader', scopes: ['usage.read'] } });
  const denied = await app.inject({ method: 'GET', url: '/api/v1/usage?subjectId=00000000-0000-4000-8000-000000000099', headers: { authorization: `ApiKey ${key.json().secret}` } });
  assert.equal(denied.statusCode, 403);
  await app.close();
});
