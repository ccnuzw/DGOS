import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../../apps/api/src/server.mjs';
import { InMemoryIdentityRepository } from '../../src/identity/repository.mjs';
import { InMemoryAuditRepository } from '../../src/audit/outbox.mjs';
import { InMemoryRetentionRepository } from '../../src/audit/retention.mjs';

test('retention sweep requires scope and returns a preview digest', async () => {
  const auditRepository = new InMemoryAuditRepository();
  const app = buildServer({ logger: false, repository: new InMemoryIdentityRepository(), auditRepository, retentionRepository: new InMemoryRetentionRepository(auditRepository) });
  const bootstrap = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'Governance', credential: 'governance-password' } });
  const sessionId = bootstrap.json().sessionId;
  const headers = { authorization: `Bearer ${sessionId}` };
  const preview = await app.inject({ method: 'GET', url: '/api/v1/admin/governance/retention-preview', headers });
  assert.equal(preview.statusCode, 200);
  const start = await app.inject({ method: 'POST', url: '/api/v1/admin/governance/retention-sweeps', headers, payload: { previewDigest: preview.json().previewDigest } });
  assert.equal(start.statusCode, 202);
  const job = start.json();
  assert.match(job.preview.previewDigest, /^[a-f0-9]{64}$/);
  assert.equal(job.preview.previewDigest, preview.json().previewDigest);
  const status = await app.inject({ method: 'GET', url: `/api/v1/admin/governance/retention-sweeps/${job.jobId}`, headers: { authorization: `Bearer ${sessionId}` } });
  assert.equal(status.statusCode, 200);
  const run = await app.inject({ method: 'POST', url: `/api/v1/admin/governance/retention-sweeps/${job.jobId}/run`, headers, payload: {} });
  assert.equal(run.statusCode, 200);
  await app.close();
});
