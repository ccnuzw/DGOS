import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { PostgresProviderRepository } from '../../src/provider/repository.mjs';

test('PostgreSQL provider repository persists account and connection test snapshots', async (t) => {
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL ?? 'postgres://dgos:dgos@127.0.0.1:5432/dgos' });
  try { await pool.query('SELECT 1'); } catch (error) { await pool.end(); t.skip(`PostgreSQL unavailable: ${error.message}`); return; }
  const repo = new PostgresProviderRepository(pool);
  const ownerId = randomUUID();
  const account = await repo.createAccount({ ownerId, protocolType: 'openai-compatible', displayName: `provider-${Date.now()}`, credentialRef: `provider-credential:${ownerId}`, scope: { endpoint: 'https://api.example.com' } });
  assert.equal(account.credentialState, 'configured');
  assert.equal(account.credentialRef, undefined);
  const requestId = randomUUID();
  const connection = await repo.createConnectionTest({ requestId, accountId: account.accountId, accountVersion: account.version, configVersion: '1', protocolVersion: 'v1' });
  assert.equal(connection.status, 'queued');
  const finished = await repo.finishConnectionTest(connection.testId, 'failed', 'policy_blocked', 3);
  assert.equal(finished.status, 'failed');
  assert.equal((await repo.finishConnectionTest(connection.testId, 'succeeded', undefined, 4)), undefined);
  await pool.query('DELETE FROM connection_tests WHERE account_id = $1', [account.accountId]);
  await pool.query('DELETE FROM provider_accounts WHERE account_id = $1', [account.accountId]);
  await pool.end();
});
