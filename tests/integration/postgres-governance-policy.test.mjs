import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { PostgresRetentionRepository } from '../../src/audit/retention.mjs';

const databaseUrl = process.env.DGOS_DATABASE_URL;
const dedicated = (() => { try { return /^\/(?:dgos_v1_governance|dgos_v1_verify_[0-9a-f]{32})$/.test(new URL(databaseUrl).pathname); } catch { return false; } })();

test('governance policy rejects stale version and rolls back on audit failure', { skip: !dedicated }, async () => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const repository = new PostgresRetentionRepository(pool);
  let before; let updated; let requestId;
  try {
    before = await repository.policy();
    requestId = randomUUID();
    const input = { baseVersion: before.version, auditRetentionDays: 180, cacheRetentionDays: 30, revokedSessionRetentionDays: 30, reason: 'integration check', requestId };
    repository.audit = { record: async () => { throw new Error('audit_unavailable'); } };
    await assert.rejects(repository.updatePolicy(input), /audit_unavailable/);
    assert.equal((await repository.policy()).version, before.version);
    repository.audit = new (await import('../../src/audit/outbox.mjs')).PostgresAuditRepository(pool);
    updated = await repository.updatePolicy(input);
    assert.equal(Number(updated.version), Number(before.version) + 1);
    await assert.rejects(repository.updatePolicy(input), /version_conflict/);
  } finally {
    if (updated) {
      const restored = await pool.query('UPDATE governance_policy SET policy_version=$1,audit_retention_days=$2,cache_retention_days=$3,revoked_session_retention_days=$4,updated_at=$5 WHERE singleton=true AND policy_version=$6 RETURNING policy_version', [before.version, before.auditRetentionDays, before.cacheRetentionDays, before.revokedSessionRetentionDays, before.updatedAt, updated.version]);
      assert.equal(restored.rowCount, 1);
      await pool.query('DELETE FROM audit_outbox WHERE event_id IN (SELECT event_id FROM audit_events WHERE request_id=$1)', [requestId]);
      await pool.query('DELETE FROM audit_events WHERE request_id=$1', [requestId]);
    }
    await pool.end();
  }
});
