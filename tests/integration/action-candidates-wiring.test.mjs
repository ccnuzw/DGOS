import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../../apps/api/src/server.mjs';
import { InMemoryIdentityRepository } from '../../src/identity/repository.mjs';
import { InMemoryAuditRepository } from '../../src/audit/outbox.mjs';

test('local assistant resolve yields only authorized registered candidates and never executes', async (t) => {
  const app = buildServer({ logger: false, repository: new InMemoryIdentityRepository(), auditRepository: new InMemoryAuditRepository() });
  t.after(() => app.close());
  const session = (await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'Assistant', credential: 'local-candidate-wiring' } })).json();
  const headers = { authorization: `Bearer ${session.sessionId}` };
  const resolve = () => app.inject({ method: 'POST', url: '/api/v1/actions/resolve', headers, payload: { requestId: 'candidate-test', text: '打开设置' } });
  const result = await resolve();
  assert.equal(result.statusCode, 200);
  assert.equal(result.json().candidates.length, 1);
  assert.deepEqual(result.json().candidates[0], { actionId: 'system.navigate.system.settings', actionVersion: '1', input: {}, risk: 'read', permission: 'ask', executable: false });
  assert.equal((await app.actions.repository.listRuns()).length, 0);
  await app.permissions.decide({ subjectId: session.principalId, appId: 'dgos.system', capability: 'system.navigate', decision: 'deny' });
  assert.deepEqual((await resolve()).json().candidates, []);
  assert.equal((await app.actions.repository.listRuns()).length, 0);
});
