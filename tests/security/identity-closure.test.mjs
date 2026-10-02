import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryIdentityRepository } from '../../src/identity/repository.mjs';
import { InMemoryAuditRepository } from '../../src/audit/outbox.mjs';
import { IdentityService } from '../../apps/api/src/identity-service.mjs';
import { InMemorySecretService } from '../../src/security/secret-service.mjs';

test('identity audit failures leave session state unchanged and never retain secret values', async () => {
  const repository = new InMemoryIdentityRepository();
  const service = new IdentityService({ repository, secretService: new InMemorySecretService() });
  const bootstrap = await service.bootstrap({ displayName: 'Admin', credential: 'one-time-credential', requestId: 'bootstrap-1' });
  assert.equal(repository.audits.some((event) => JSON.stringify(event).includes('one-time-credential')), false);
  const session = await repository.getSession(bootstrap.sessionId);
  const original = repository.writeAudit;
  repository.writeAudit = async () => { throw new Error('audit_unavailable'); };
  await assert.rejects(repository.revokeManagedSession({ managementId: session.sessionManagementId, actorId: bootstrap.principalId, requestId: 'revoke-1' }), /audit_unavailable/);
  assert.equal((await repository.getSession(bootstrap.sessionId)).state, 'active');
  repository.writeAudit = original;
});
