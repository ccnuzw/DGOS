import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('V1 governance migration contains required idempotency and safety constraints', async () => {
  const sql = await readFile(new URL('../../migrations/0001-v1-governance.sql', import.meta.url), 'utf8');
  for (const fragment of [
    'CREATE TABLE IF NOT EXISTS dgos_schema_migrations',
    'UNIQUE (request_id, account_id, account_version, config_version)',
    'UNIQUE (task_id, attempt_id, metric)',
    'CREATE TABLE IF NOT EXISTS audit_outbox',
    'CHECK (state IN (\'reserved\', \'settled\', \'released\', \'needs_review\'))',
  ]) assert.match(sql, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(sql, /password|authorization|api[_ -]?key\s+text\b/i);
});
