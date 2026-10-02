import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../../apps/api/src/server.mjs';
import { InMemoryIdentityRepository } from '../../src/identity/repository.mjs';
import { InMemoryAuditRepository } from '../../src/audit/outbox.mjs';
import { InMemoryRetentionRepository } from '../../src/audit/retention.mjs';

test('stale session cannot mutate governance; renewal does not bypass fresh authentication', async (t) => {
  let now = Date.now();
  const audit = new InMemoryAuditRepository();
  const app = buildServer({ logger: false, repository: new InMemoryIdentityRepository(), auditRepository: audit, retentionRepository: new InMemoryRetentionRepository(audit), clock: () => now });
  t.after(() => app.close());
  const boot = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'Admin', credential: 'local-governance-wiring' } });
  assert.equal(boot.statusCode, 201);
  const session = boot.json();
  const headers = { authorization: `Bearer ${session.sessionId}` };
  const policy = (await app.inject({ url: '/api/v1/admin/governance/policy', headers })).json();
  now += 11 * 60_000;
  const renewed = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/session', headers, payload: { baseVersion: session.sessionVersion } });
  assert.equal(renewed.statusCode, 200);
  const input = { baseVersion: policy.version, auditRetentionDays: 181, reason: 'test retention policy' };
  const denied = await app.inject({ method: 'PUT', url: '/api/v1/admin/governance/policy', headers, payload: input });
  assert.equal(denied.statusCode, 403); assert.equal(denied.json().errorKey, 'step_up_required');
  assert.equal((await app.inject({ url: '/api/v1/admin/governance/policy', headers })).json().version, policy.version);
  const events = await app.inject({ url: '/api/v1/audit/events?action=admin.step_up.reject', headers });
  assert.equal(events.statusCode, 200); assert.ok(events.json().items.length);
  const login = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/login', payload: { principalHint: session.principalId, credential: 'local-governance-wiring' } });
  assert.equal(login.statusCode, 200);
  const updated = await app.inject({ method: 'PUT', url: '/api/v1/admin/governance/policy', headers: { authorization: `Bearer ${login.json().sessionId}` }, payload: input });
  assert.equal(updated.statusCode, 200); assert.equal(updated.json().auditRetentionDays, 181);
});

test('API key management capability cannot delegate a broader scope', async (t) => {
  const audit = new InMemoryAuditRepository();
  const app = buildServer({ logger: false, repository: new InMemoryIdentityRepository(), auditRepository: audit, retentionRepository: new InMemoryRetentionRepository(audit) });
  t.after(() => app.close());
  const session = (await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'Admin', credential: 'local-key-wiring' } })).json();
  const headers = { authorization: `Bearer ${session.sessionId}` };
  const key = await app.inject({ method: 'POST', url: '/api/v1/secret/api-keys', headers, payload: { name: 'limited manager', scopes: ['apiKey.manage', 'apiKey.read'] } });
  assert.equal(key.statusCode, 201);
  const denied = await app.inject({ method: 'POST', url: '/api/v1/secret/api-keys', headers: { authorization: `ApiKey ${key.json().secret}` }, payload: { name: 'escalated', scopes: ['governance.write'], actorScopes: ['*'] } });
  assert.equal(denied.statusCode, 403);
  assert.equal((await app.inject({ url: '/api/v1/secret/api-keys', headers })).json().items.length, 1);
});
