import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { PostgresAuditRepository } from '../../src/audit/outbox.mjs';
import { PostgresTextProfileDirectory } from '../../src/provider-config/text-profile-directory.mjs';
import { PostgresProviderProtocolConfirmations, protocolDigest } from '../../src/provider-config/protocol-confirmations.mjs';
import { isIsolatedProviderDatabase } from './isolated-provider-database.mjs';

test('protocol confirmation is bound to session and consumed with publication', async (t) => {
  if (!isIsolatedProviderDatabase(process.env.DGOS_DATABASE_URL)) { t.skip('requires isolated provider or Verify database'); return; }
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL });
  const ownerId = randomUUID();
  const sessionId = randomUUID();
  const profile = { id: `fixture.${ownerId}`, version: '1.0.0', kind: 'model', schemaVersion: 'dgos-capability/v1', executor: { type: 'declarative', engine: 'dgos-text-v1' }, capabilities: ['text.chat'], modelProfiles: { text: { modelNames: ['fixture-text'], workflow: 'text.chat' } }, operations: { submit: { profile: 'chat.completions', method: 'POST', path: '/chat/completions' } }, workflows: { 'text.chat': { submit: 'submit' } }, assets: {} };
  const store = new PostgresProviderProtocolConfirmations(pool);
  const directory = new PostgresTextProfileDirectory(pool, new PostgresAuditRepository(pool));
  try {
    await pool.query('INSERT INTO admin_principals(principal_id,status,credential_ref) VALUES($1,$2,$3)', [ownerId, 'invited', `fixture:${ownerId}`]);
    const input = { subjectId: ownerId, sessionId, operation: 'provider.protocol.publish', resourceId: profile.id, version: profile.version, digest: protocolDigest(profile), requestId: randomUUID() };
    const ticket = await store.issue(input);
    await assert.rejects(directory.publish({ ownerId, protocolType: 'openai-compatible', profile, requestId: input.requestId, confirmation: { store, input: { ...input, sessionId: randomUUID(), confirmationId: ticket.confirmationId } } }), (error) => error.message === 'confirmation_required');
    assert.equal((await directory.list(ownerId)).items.length, 0);
    const confirmation = { store, input: { ...input, confirmationId: ticket.confirmationId } };
    const published = await directory.publish({ ownerId, protocolType: 'openai-compatible', profile, requestId: input.requestId, confirmation });
    assert.equal(published.registryVersion, 1);
    assert.deepEqual(await directory.publish({ ownerId, protocolType: 'openai-compatible', profile, requestId: input.requestId, confirmation }), published);
    await assert.rejects(directory.publish({ ownerId, protocolType: 'openai-compatible', profile: { ...profile, label: 'changed' }, requestId: input.requestId, confirmation }), (error) => error.message === 'version_conflict');
    await assert.rejects(store.consume(confirmation.input, pool), (error) => error.message === 'confirmation_required');
    const stateInput = { subjectId: ownerId, sessionId, operation: 'provider.protocol.state', resourceId: profile.id, version: profile.version, digest: protocolDigest({ protocolId: profile.id, version: profile.version, baseVersion: 1, state: 'disabled' }), requestId: randomUUID() };
    const stateTicket = await store.issue(stateInput);
    const disabled = await directory.setState({ ownerId, protocolId: profile.id, version: profile.version, baseVersion: 1, state: 'disabled', requestId: stateInput.requestId, confirmation: { store, input: { ...stateInput, confirmationId: stateTicket.confirmationId } } });
    assert.equal(disabled.registryVersion, 2);
    assert.deepEqual(await directory.setState({ ownerId, protocolId: profile.id, version: profile.version, baseVersion: 1, state: 'disabled', requestId: stateInput.requestId, confirmation: { store, input: { ...stateInput, confirmationId: stateTicket.confirmationId } } }), disabled);
    await assert.rejects(directory.setState({ ownerId, protocolId: profile.id, version: profile.version, baseVersion: 1, state: 'active', requestId: stateInput.requestId, confirmation: { store, input: { ...stateInput, confirmationId: stateTicket.confirmationId } } }), (error) => error.message === 'version_conflict');
    const { rows } = await pool.query('SELECT version,state_version FROM provider_text_profiles WHERE owner_id=$1', [ownerId]);
    assert.equal(String(rows[0].version), '1');
    assert.equal(String(rows[0].state_version), '2');
  } finally {
    await pool.query('DELETE FROM provider_protocol_receipts WHERE subject_id=$1', [ownerId]);
    await pool.query('DELETE FROM provider_protocol_confirmations WHERE subject_id=$1', [ownerId]);
    await pool.query('DELETE FROM provider_text_profiles WHERE owner_id=$1', [ownerId]);
    await pool.query('DELETE FROM admin_principals WHERE principal_id=$1', [ownerId]);
    await pool.end();
  }
});
