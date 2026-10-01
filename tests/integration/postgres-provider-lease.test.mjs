import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { PostgresProviderRepository } from '../../src/provider/repository.mjs';

test('PostgreSQL connection test lease is claimed by one worker and finished once', async (t) => {
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL ?? 'postgres://dgos:dgos@127.0.0.1:5432/dgos' });
  try { await pool.query('SELECT 1'); } catch (error) { await pool.end(); t.skip(`PostgreSQL unavailable: ${error.message}`); return; }
  const repo = new PostgresProviderRepository(pool);
  const accountId = randomUUID();
  await pool.query('DELETE FROM connection_tests');
  await repo.createAccount({ accountId, ownerId: randomUUID(), protocolType: 'fixture', displayName: `lease-${Date.now()}`, credentialRef: `lease-secret:${accountId}` });
  const testRecord = await repo.createConnectionTest({ requestId: randomUUID(), accountId, accountVersion: '1', configVersion: '1', protocolVersion: 'v1' });
  const [first, second] = await Promise.all([
    repo.claimConnectionTest('worker-a', 60_000),
    repo.claimConnectionTest('worker-b', 60_000),
  ]);
  assert.equal([first, second].filter(Boolean).length, 1);
  const owner = first ? 'worker-a' : 'worker-b';
  const claimed = first ?? second;
  assert.equal(claimed.testId, testRecord.testId);
  assert.equal((await repo.finishConnectionTest(testRecord.testId, 'succeeded', undefined, 5, owner)).status, 'succeeded');
  assert.equal(await repo.finishConnectionTest(testRecord.testId, 'failed', 'upstream_unavailable', 5, owner), undefined);
  await pool.query('DELETE FROM connection_tests WHERE test_id = $1', [testRecord.testId]);
  await pool.query('DELETE FROM provider_accounts WHERE account_id = $1', [accountId]);
  await pool.end();
});
