import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { PostgresAuditRepository } from '../../src/audit/outbox.mjs';
import { PostgresIdentityRepository } from '../../src/identity/repository.mjs';

test('PostgreSQL audit outbox publisher claim and idempotent publish', async (t) => {
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL ?? 'postgres://dgos:dgos@127.0.0.1:5432/dgos' });
  try { await pool.query('SELECT 1'); } catch (error) { await pool.end(); t.skip(`PostgreSQL unavailable: ${error.message}`); return; }
  const audit = new PostgresAuditRepository(pool);
  const eventId = randomUUID();
  await pool.query('INSERT INTO audit_events (event_id, request_id, actor_type, actor_id, action, target_type, target_id, result, summary) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [eventId, randomUUID(), 'system', null, 'audit.fixture', 'fixture', eventId, 'succeeded', JSON.stringify({ safe: true })]);
  await pool.query('DELETE FROM audit_outbox WHERE event_id <> $1', [eventId]);
  await pool.query('INSERT INTO audit_outbox (event_id) VALUES ($1)', [eventId]);
  const [first, second] = await Promise.all([audit.claim('audit-a'), audit.claim('audit-b')]);
  assert.equal([first, second].filter(Boolean).length, 1);
  const owner = first ? 'audit-a' : 'audit-b';
  assert.equal((await audit.markPublished(eventId, owner)).event_id, eventId);
  assert.equal(await audit.markPublished(eventId, owner), undefined);
  await pool.query('DELETE FROM audit_outbox WHERE event_id = $1', [eventId]);
  await pool.query('DELETE FROM audit_events WHERE event_id = $1', [eventId]);
  await pool.end();
});

test('identity renew audit commits with the session update', async (t) => {
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL ?? 'postgres://dgos:dgos@127.0.0.1:5432/dgos' });
  try { await pool.query('SELECT 1'); } catch (error) { await pool.end(); t.skip(`PostgreSQL unavailable: ${error.message}`); return; }
  const repo = new PostgresIdentityRepository(pool);
  const principalId = randomUUID();
  await pool.query("UPDATE admin_principals SET status = 'revoked' WHERE status = 'active'");
  await repo.createPrincipal({ principalId, credentialRef: `fixture:${principalId}` });
  const session = await repo.createSession({ principalId, expiresAt: new Date(Date.now() + 60_000) });
  const renewed = await repo.renewSessionWithAudit(session.sessionId, 1, new Date(Date.now() + 120_000), (value) => ({ requestId: randomUUID(), actorId: principalId, action: 'fixture.renew', targetType: 'admin_session', targetId: value.sessionId }));
  assert.equal(renewed.sessionVersion, 2);
  const count = await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE action = 'fixture.renew' AND target_id = $1", [session.sessionId]);
  assert.equal(count.rows[0].count, 1);
  await pool.query('DELETE FROM audit_outbox WHERE event_id IN (SELECT event_id FROM audit_events WHERE target_id = $1)', [session.sessionId]);
  await pool.query('DELETE FROM audit_events WHERE target_id = $1', [session.sessionId]);
  await pool.query('DELETE FROM admin_sessions WHERE session_id = $1', [session.sessionId]);
  await pool.query('DELETE FROM admin_principals WHERE principal_id = $1', [principalId]);
  await pool.end();
});
