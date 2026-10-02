import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryIdentityRepository } from '../../src/identity/repository.mjs';
import { InMemorySecretService } from '../../src/security/secret-service.mjs';
import { IdentityService } from '../../apps/api/src/identity-service.mjs';
import { InMemoryAuditRepository } from '../../src/audit/outbox.mjs';
import { InMemoryRetentionRepository } from '../../src/audit/retention.mjs';
import { GovernanceService } from '../../apps/api/src/governance-service.mjs';
import { InMemoryLoginBackoff } from '../../src/security/rate-limiter.mjs';

test('login audit failure leaves no session and failed bootstrap revokes its secret', async () => {
  const repository = new InMemoryIdentityRepository();
  const secretService = new InMemorySecretService();
  const service = new IdentityService({ repository, secretService });
  const boot = await service.bootstrap({ displayName: 'Admin', credential: 'pass', requestId: 'boot' });
  const before = repository.sessions.size;
  repository.audit = { record: async () => { throw new Error('audit_unavailable'); } };
  await assert.rejects(service.login({ principalHint: boot.principalId, credential: 'pass', requestId: 'login' }), /audit_unavailable/);
  assert.equal(repository.sessions.size, before);
  const tracked = [];
  const secrets = { put: async (input) => { tracked.push(input.secretRef); }, revoke: async (ref) => { tracked.push(`revoked:${ref}`); } };
  const rejected = new IdentityService({ repository, secretService: secrets });
  await assert.rejects(rejected.bootstrap({ displayName: 'Duplicate', credential: 'pass', requestId: 'duplicate' }), /bootstrap_already_completed/);
  assert.equal(tracked.length, 2);
  assert.equal(tracked[1], `revoked:${tracked[0]}`);
});

test('subject/source backoff grows and source remains blocked after subject success', async () => {
  let now = 1000;
  const limiter = new InMemoryLoginBackoff({ clock: () => now, baseDelayMs: 100, windowMs: 10000 });
  const input = { subject: 'admin', source: 'private-source' };
  assert.equal((await limiter.check(input)).allowed, true);
  assert.equal((await limiter.failure(input)).retryAfterMs, 100);
  now += 100;
  assert.equal((await limiter.failure(input)).retryAfterMs, 200);
  await limiter.success({ subject: input.subject });
  assert.equal((await limiter.check(input)).allowed, false);
  now += 200;
  assert.equal((await limiter.check(input)).allowed, true);
});

test('retention plan without preview confirmation cannot execute', async () => {
  const audit = new InMemoryAuditRepository();
  const retention = new InMemoryRetentionRepository(audit);
  const governance = new GovernanceService({ retentionRepository: retention, auditRepository: audit });
  const plan = await governance.startRetention({ requestId: 'plan', actorId: 'admin' });
  await assert.rejects(governance.runRetention(plan.jobId, 'run', 'admin'), /retention_preview_conflict/);
  assert.equal((await governance.getRetention(plan.jobId)).state, 'planned');
  const confirmed = await governance.startRetention({ requestId: 'confirmed', actorId: 'admin', previewDigest: plan.preview.previewDigest });
  assert.equal((await governance.runRetention(confirmed.jobId, 'run', 'admin')).state, 'completed');
});
