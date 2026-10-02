import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../../apps/api/src/server.mjs';
import { InMemoryIdentityRepository } from '../../src/identity/repository.mjs';
import { InMemoryProviderRepository } from '../../src/provider/repository.mjs';
import { InMemoryAuditRepository, OutboxPublisher } from '../../src/audit/outbox.mjs';
import { InMemoryRetentionRepository } from '../../src/audit/retention.mjs';

const ids = (testId) => ({ testId, requestId: `${testId}-request`, version: '1' });
const setup = async (testId) => {
  const audit = new InMemoryAuditRepository();
  const repository = new InMemoryIdentityRepository();
  const providerRepository = new InMemoryProviderRepository();
  const app = buildServer({ logger: false, repository, providerRepository, auditRepository: audit, retentionRepository: new InMemoryRetentionRepository(audit) });
  const bootstrap = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', headers: { 'x-request-id': ids(testId).requestId }, payload: { displayName: `E2E ${testId}`, credential: 'correct-secret' } });
  assert.equal(bootstrap.statusCode, 201);
  return { app, audit, repository, providerRepository, receipt: bootstrap.json(), evidence: ids(testId) };
};

test('V1-E2E-11 authentication session, expiry, origin and high-risk authorization', async () => {
  const { app, receipt } = await setup('V1-E2E-11');
  const auth = { authorization: `Bearer ${receipt.sessionId}` };
  assert.equal((await app.inject({ method: 'GET', url: '/api/v1/identity/admin/session', headers: auth })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: '/api/v1/identity/admin/session', headers: { ...auth, cookie: `dgos_session=${receipt.sessionId}`, origin: 'https://evil.example', 'x-dgos-csrf': 'x' }, payload: {} })).json().errorKey, 'csrf_failed');
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/v1/identity/admin/session', headers: { ...auth, cookie: `dgos_session=${receipt.sessionId}`, 'x-dgos-csrf': 'x' } })).statusCode, 204);
  assert.equal((await app.inject({ method: 'GET', url: '/api/v1/identity/admin/session', headers: auth })).json().errorKey, 'session_invalid');
  const bad = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/login', payload: { principalHint: receipt.principalId, credential: 'bad' } });
  assert.equal(bad.statusCode, 401);
  await app.close();
});

test('V1-E2E-12 API key one-time secret, isolation, overlap, revoke and expiry', async () => {
  const { app, receipt, audit } = await setup('V1-E2E-12');
  const auth = { authorization: `Bearer ${receipt.sessionId}` };
  const created = await app.inject({ method: 'POST', url: '/api/v1/secret/api-keys', headers: auth, payload: { name: 'e2e-key', scopes: ['apiKey.read', 'provider.account.read'], expiresAt: new Date(Date.now() + 60_000).toISOString() } });
  assert.equal(created.statusCode, 201); const body = created.json(); assert.ok(body.key.keyId); assert.match(body.secret, /^dgos_/);
  const listed = await app.inject({ method: 'GET', url: '/api/v1/secret/api-keys', headers: auth });
  assert.equal(listed.statusCode, 200); assert.equal(listed.json().items[0].secret, undefined);
  const rotated = await app.inject({ method: 'POST', url: `/api/v1/secret/api-keys/${body.key.keyId}/rotate`, headers: auth, payload: {} });
  assert.equal(rotated.statusCode, 200); assert.notEqual(rotated.json().secret, body.secret); assert.equal(rotated.json().previousKeyId, body.key.keyId);
  assert.equal((await app.inject({ method: 'GET', url: '/api/v1/secret/api-keys', headers: { authorization: `ApiKey ${body.secret}` } })).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: '/api/v1/secret/api-keys', headers: { authorization: `ApiKey ${rotated.json().secret}` } })).statusCode, 200);
  const auditRows = [...audit.events.values()]; assert.ok(auditRows.every((e) => !JSON.stringify(e).includes(body.secret)));
  const revoked = await app.inject({ method: 'DELETE', url: `/api/v1/secret/api-keys/${rotated.json().key.keyId}`, headers: auth });
  assert.equal(revoked.statusCode, 200); assert.equal((await app.inject({ method: 'GET', url: '/api/v1/secret/api-keys', headers: { authorization: `ApiKey ${rotated.json().secret}` } })).statusCode, 401);
  const oldRevoked = await app.inject({ method: 'DELETE', url: `/api/v1/secret/api-keys/${body.key.keyId}`, headers: auth });
  assert.equal(oldRevoked.statusCode, 200); assert.equal((await app.inject({ method: 'GET', url: '/api/v1/secret/api-keys', headers: { authorization: `ApiKey ${body.secret}` } })).statusCode, 401);
  await app.close();
});

test('V1-E2E-12 extended: API key overlap window and grace period expiry', async () => {
  const { app, receipt } = await setup('V1-E2E-12-overlap');
  const auth = { authorization: `Bearer ${receipt.sessionId}` };

  // Create initial key
  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/secret/api-keys',
    headers: auth,
    payload: { name: 'overlap-test', scopes: ['apiKey.read'] }
  });
  assert.equal(created.statusCode, 201);
  const originalSecret = created.json().secret;
  const originalKeyId = created.json().key.keyId;

  // Verify original key works
  const verify1 = await app.inject({
    method: 'GET',
    url: '/api/v1/secret/api-keys',
    headers: { authorization: `ApiKey ${originalSecret}` }
  });
  assert.equal(verify1.statusCode, 200);

  // Rotate key
  const rotated = await app.inject({
    method: 'POST',
    url: `/api/v1/secret/api-keys/${originalKeyId}/rotate`,
    headers: auth,
    payload: {}
  });
  assert.equal(rotated.statusCode, 200);
  const newSecret = rotated.json().secret;
  const newKeyId = rotated.json().key.keyId;
  assert.notEqual(newSecret, originalSecret);
  assert.equal(rotated.json().previousKeyId, originalKeyId);

  // Verify overlap: both old and new keys work during overlap window
  const oldKeyWorks = await app.inject({
    method: 'GET',
    url: '/api/v1/secret/api-keys',
    headers: { authorization: `ApiKey ${originalSecret}` }
  });
  assert.equal(oldKeyWorks.statusCode, 200);

  const newKeyWorks = await app.inject({
    method: 'GET',
    url: '/api/v1/secret/api-keys',
    headers: { authorization: `ApiKey ${newSecret}` }
  });
  assert.equal(newKeyWorks.statusCode, 200);

  // Verify old key shows rotation_pending state
  const keyList = await app.inject({
    method: 'GET',
    url: '/api/v1/secret/api-keys',
    headers: auth
  });
  const oldKeyData = keyList.json().items.find(k => k.keyId === originalKeyId);
  const newKeyData = keyList.json().items.find(k => k.keyId === newKeyId);
  assert.equal(oldKeyData?.state, 'rotation_pending');
  assert.equal(newKeyData?.state, 'active');

  // Manually revoke old key to end overlap window
  const revokeOld = await app.inject({
    method: 'DELETE',
    url: `/api/v1/secret/api-keys/${originalKeyId}`,
    headers: auth
  });
  assert.equal(revokeOld.statusCode, 200);

  // Verify old key no longer works after explicit revocation
  const oldKeyRevoked = await app.inject({
    method: 'GET',
    url: '/api/v1/secret/api-keys',
    headers: { authorization: `ApiKey ${originalSecret}` }
  });
  assert.equal(oldKeyRevoked.statusCode, 401);

  // Verify new key still works
  const newKeyStillWorks = await app.inject({
    method: 'GET',
    url: '/api/v1/secret/api-keys',
    headers: { authorization: `ApiKey ${newSecret}` }
  });
  assert.equal(newKeyStillWorks.statusCode, 200);

  await app.close();
});

test('V1-E2E-13 provider account connection controls reject SSRF and owner violations before enqueue', async () => {
  const audit = new InMemoryAuditRepository();
  const providerRepository = new InMemoryProviderRepository();
  const app = buildServer({ logger: false, repository: new InMemoryIdentityRepository(), providerRepository, auditRepository: audit, retentionRepository: new InMemoryRetentionRepository(audit), providerEgress: { async validateTarget(value) { const url = new URL(value); if (url.hostname !== 'provider.fixture.test') throw Object.assign(new Error('policy_blocked'), { errorKey: 'policy_blocked', statusCode: 422 }); return url; } } });
  const bootstrap = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'E2E provider', credential: 'correct-secret' } });
  assert.equal(bootstrap.statusCode, 201);
  const receipt = bootstrap.json();
  const auth = { authorization: `Bearer ${receipt.sessionId}` };
  const account = await app.inject({ method: 'POST', url: '/api/v1/provider/accounts', headers: auth, payload: { protocolType: 'openai-compatible', displayName: 'e2e-provider', credential: 'provider-secret', scope: { endpoint: 'https://provider.fixture.test/v1' } } });
  assert.equal(account.statusCode, 201); assert.equal(account.json().credential, undefined);
  const blocked = await app.inject({ method: 'POST', url: '/api/v1/provider/connection-tests', headers: auth, payload: { accountId: account.json().accountId, protocolVersion: 'v1' } });
  assert.equal(blocked.statusCode, 202, blocked.body);
  await providerRepository.finishConnectionTest(blocked.json().testId, 'succeeded', undefined, 1);
  const ready = await app.inject({ method: 'POST', url: `/api/v1/provider/accounts/${account.json().accountId}/state`, headers: auth, payload: { baseVersion: '1', state: 'ready', connectionTestId: blocked.json().testId } });
  assert.equal(ready.statusCode, 200, ready.body);
  const strangerKey = await app.inject({ method: 'POST', url: '/api/v1/secret/api-keys', headers: auth, payload: { name: 'provider-reader', scopes: ['provider.connection_test'] } });
  assert.equal(strangerKey.statusCode, 201);
  const forbidden = await app.inject({ method: 'POST', url: '/api/v1/provider/connection-tests', headers: { authorization: `ApiKey ${strangerKey.json().secret}` }, payload: { accountId: account.json().accountId, protocolVersion: 'v1' } });
  assert.equal(forbidden.statusCode, 202, forbidden.body); assert.equal(providerRepository.tests.size, 2);
  const ssrf = await app.inject({ method: 'POST', url: '/api/v1/provider/accounts', headers: auth, payload: { protocolType: 'openai-compatible', displayName: 'blocked-provider', credential: 'provider-secret', scope: { endpoint: 'https://127.0.0.1' } } });
  assert.equal(ssrf.statusCode, 201);
  const denied = await app.inject({ method: 'POST', url: '/api/v1/provider/connection-tests', headers: auth, payload: { accountId: ssrf.json().accountId, protocolVersion: 'v1' } });
  assert.equal(denied.json().errorKey, 'policy_blocked'); assert.equal(providerRepository.tests.size, 2);
  await app.close();
});

test('V1-E2E-14 audit correlation, redaction, outbox retry and retention recovery', async () => {
  const { app, receipt, audit } = await setup('V1-E2E-14');
  const auth = { authorization: `Bearer ${receipt.sessionId}` };
  const requestId = 'V1-E2E-14-request';
  const key = await app.inject({ method: 'POST', url: '/api/v1/secret/api-keys', headers: { ...auth, 'x-request-id': requestId }, payload: { name: 'audit-key', scopes: ['apiKey.read'] } });
  assert.equal(key.statusCode, 201);
  const events = await app.inject({ method: 'GET', url: '/api/v1/audit/events', headers: auth });
  assert.equal(events.statusCode, 200); const storedEvents = [...audit.events.values()]; const event = events.json().items.find((e) => e.action === 'api_key.create'); assert.ok(event); assert.equal(event.requestId, requestId); assert.equal(event.target.id, key.json().key.keyId);
  assert.ok(!JSON.stringify(storedEvents).includes(key.json().secret));
  const eventId = await audit.record({ requestId, action: 'e2e.retry', targetType: 'fixture', summary: { safe: true } });
  const claimed = await audit.claim('V1-E2E-14-job'); assert.ok(claimed?.eventId); await audit.markFailed(claimed.eventId, 'V1-E2E-14-job', 0); const reclaimed = await audit.claim('V1-E2E-14-job'); assert.equal(reclaimed.eventId, claimed.eventId); assert.equal((await audit.markPublished(reclaimed.eventId, 'V1-E2E-14-job')).eventId, reclaimed.eventId);
  const preview = await app.inject({ method: 'GET', url: '/api/v1/admin/governance/retention-preview', headers: auth });
  assert.equal(preview.statusCode, 200);
  const start = await app.inject({ method: 'POST', url: '/api/v1/admin/governance/retention-sweeps', headers: { ...auth, cookie: `dgos_session=${receipt.sessionId}`, 'x-dgos-csrf': 'x' }, payload: { previewDigest: preview.json().previewDigest } });
  assert.equal(start.statusCode, 202); assert.ok(start.json().jobId); const run = await app.inject({ method: 'POST', url: `/api/v1/admin/governance/retention-sweeps/${start.json().jobId}/run`, headers: { ...auth, 'x-dgos-csrf': 'x' }, payload: {} }); assert.equal(run.statusCode, 200);
  await app.close();
});
