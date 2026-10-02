import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { PostgresAuditRepository } from '../../src/audit/outbox.mjs';
import { PostgresTextProfileDirectory } from '../../src/provider-config/text-profile-directory.mjs';
import { PostgresProviderProtocolConfirmations, protocolDigest } from '../../src/provider-config/protocol-confirmations.mjs';
import { isIsolatedProviderDatabase } from './isolated-provider-database.mjs';

test('text profile directory persists only validated active declarations', async (t) => {
  if (!isIsolatedProviderDatabase(process.env.DGOS_DATABASE_URL)) { t.skip('requires isolated provider or Verify database'); return; }
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL });
  const ownerId = randomUUID(); const directory = new PostgresTextProfileDirectory(pool, new PostgresAuditRepository(pool));
  const confirmations = new PostgresProviderProtocolConfirmations(pool); const sessionId = randomUUID();
  const profile = { id: `fixture.${ownerId}`, version: '1.0.0', kind: 'model', schemaVersion: 'dgos-capability/v1', executor: { type: 'declarative', engine: 'dgos-text-v1' }, capabilities: ['text.chat'], modelProfiles: { text: { modelNames: ['fixture-text'], workflow: 'text.chat' } }, operations: { submit: { profile: 'chat.completions', method: 'POST', path: '/chat/completions' } }, workflows: { 'text.chat': { submit: 'submit' } }, assets: {} };
  try {
    await pool.query('INSERT INTO admin_principals(principal_id,status,credential_ref) VALUES($1,$2,$3)', [ownerId, 'invited', `fixture:${ownerId}`]);
    const publish = async (declaration, requestId) => { const input = { subjectId: ownerId, sessionId, operation: 'provider.protocol.publish', resourceId: declaration.id, version: declaration.version, digest: protocolDigest(declaration), requestId }; const ticket = await confirmations.issue(input); return directory.publish({ ownerId, protocolType: 'openai-compatible', profile: declaration, requestId, confirmation: { store: confirmations, input: { ...input, confirmationId: ticket.confirmationId } } }); };
    const state = async (baseVersion, next, requestId) => { const input = { subjectId: ownerId, sessionId, operation: 'provider.protocol.state', resourceId: profile.id, version: profile.version, digest: protocolDigest({ protocolId: profile.id, version: profile.version, baseVersion, state: next }), requestId }; const ticket = await confirmations.issue(input); return directory.setState({ ownerId, protocolId: profile.id, version: profile.version, baseVersion, state: next, requestId, confirmation: { store: confirmations, input: { ...input, confirmationId: ticket.confirmationId } } }); };
    const created = await publish(profile, randomUUID());
    assert.equal(created.status, 'active');
    assert.equal((await directory.list(ownerId)).items[0].modelProfiles.text.modelNames[0], 'fixture-text');
    const disabled = await state(1, 'disabled', randomUUID());
    assert.equal(disabled.registryVersion, 2);
    assert.equal(disabled.version, profile.version);
    assert.equal((await directory.list(ownerId)).items.length, 0);
    await assert.rejects(state(1, 'active', randomUUID()), (error) => error.message === 'version_conflict');
    const active = await state(2, 'active', randomUUID());
    assert.equal(active.registryVersion, 3);
    await assert.rejects(publish({ ...profile, operations: { submit: { ...profile.operations.submit, script: 'bad' } } }, randomUUID()), (error) => error.errorKey === 'protocol_mismatch');
    assert.equal((await directory.list(ownerId)).items.length, 1);
  } finally {
    await pool.query('DELETE FROM provider_protocol_receipts WHERE subject_id=$1', [ownerId]);
    await pool.query('DELETE FROM provider_protocol_confirmations WHERE subject_id=$1', [ownerId]);
    await pool.query('DELETE FROM provider_text_profiles WHERE owner_id=$1', [ownerId]);
    await pool.query('DELETE FROM admin_principals WHERE principal_id=$1', [ownerId]);
    await pool.end();
  }
});

test('same protocol id from two owners retains isolated active declarations', async (t) => {
  if (!isIsolatedProviderDatabase(process.env.DGOS_DATABASE_URL)) { t.skip('requires isolated provider or Verify database'); return; }
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL });
  const owners = [randomUUID(), randomUUID()]; const profileId = `fixture.shared.${randomUUID()}`;
  const directory = new PostgresTextProfileDirectory(pool, new PostgresAuditRepository(pool));
  const store = new PostgresProviderProtocolConfirmations(pool);
  const profile = { id: profileId, version: '1.0.0', kind: 'model', schemaVersion: 'dgos-capability/v1', executor: { type: 'declarative', engine: 'dgos-text-v1' }, capabilities: ['text.chat'], modelProfiles: { text: { modelNames: ['fixture-text'], workflow: 'text.chat' } }, operations: { submit: { profile: 'chat.completions', method: 'POST', path: '/chat/completions' } }, workflows: { 'text.chat': { submit: 'submit' } }, assets: {} };
  try {
    for (const ownerId of owners) await pool.query('INSERT INTO admin_principals(principal_id,status,credential_ref) VALUES($1,$2,$3)', [ownerId, 'invited', `fixture:${ownerId}`]);
    const issue = async (ownerId) => { const input = { subjectId: ownerId, sessionId: randomUUID(), operation: 'provider.protocol.publish', resourceId: profileId, version: profile.version, digest: protocolDigest(profile), requestId: randomUUID() }; const ticket = await store.issue(input); return directory.publish({ ownerId, protocolType: 'openai-compatible', profile, requestId: input.requestId, confirmation: { store, input: { ...input, confirmationId: ticket.confirmationId } } }); };
    const results = await Promise.all(owners.map(issue));
    assert.deepEqual(results.map((row) => row.status), ['active', 'active']);
    for (const ownerId of owners) assert.equal((await directory.list(ownerId)).items.length, 1);
    const { rows } = await pool.query('SELECT version FROM provider_text_profiles WHERE profile_id=$1 ORDER BY version', [profileId]);
    assert.deepEqual(rows.map((row) => Number(row.version)), [1, 2]);
  } finally {
    for (const ownerId of owners) { await pool.query('DELETE FROM provider_protocol_receipts WHERE subject_id=$1', [ownerId]); await pool.query('DELETE FROM provider_protocol_confirmations WHERE subject_id=$1', [ownerId]); }
    await pool.query('DELETE FROM provider_text_profiles WHERE profile_id=$1', [profileId]);
    for (const ownerId of owners) await pool.query('DELETE FROM admin_principals WHERE principal_id=$1', [ownerId]);
    await pool.end();
  }
});
