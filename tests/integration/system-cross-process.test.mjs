import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { SystemService } from '../../src/system/service.mjs';
import { InMemorySystemRepository, PostgresSystemRepository } from '../../src/system/repository.mjs';
import { ActionWorker } from '../../src/actions/worker.mjs';

const isolatedDatabase = () => {
  try { return /^(?:dgos_v1_governance|dgos_v1_verify_[0-9a-f]{32})$/.test(new URL(process.env.DGOS_DATABASE_URL).pathname.slice(1)); }
  catch { return false; }
};

test('shared in-memory repository refreshes two services and keeps audit failure invisible', async () => {
  const repository = new InMemorySystemRepository();
  const audit = { record: async (event) => { if (event.summary.domain === 'privacy') throw new Error('audit_unavailable'); } };
  const first = new SystemService({ repository, audit }); const second = new SystemService({ repository, audit });
  await Promise.all([first.ready, second.ready]);
  const changed = await first.patch({ baseVersion: '1', patch: { domain: 'locale', value: { language: 'zh-CN' } } });
  assert.equal(changed.settingsVersion, '2');
  assert.equal((await second.snapshot()).settings.locale.uiLocale, 'zh-CN');
  assert.equal((await second.context()).contextVersion, '2');
  await assert.rejects(second.patch({ baseVersion: '1', patch: { domain: 'grid', value: { enabled: false } } }), (error) => error.statusCode === 409);
  await assert.rejects(second.patch({ baseVersion: '2', patch: { domain: 'privacy', value: { telemetry: true } } }), /audit_unavailable/);
  assert.equal((await first.snapshot()).settingsVersion, '2');
  assert.equal((await first.context()).settings.privacy.telemetry, false);
  assert.equal((await repository.eventsAfter(undefined, 0)).length, 1);
  const attempts = await Promise.allSettled([
    first.patch({ baseVersion: '2', patch: { domain: 'grid', value: { enabled: false } } }),
    second.patch({ baseVersion: '2', patch: { domain: 'appearance', value: { mode: 'dark' } } }),
  ]);
  assert.equal(attempts.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal((await first.snapshot()).settingsVersion, '3');
});

test('ActionWorker serializes polling and drains current tick on stop', async () => {
  let concurrent = 0; let peak = 0; let release;
  const service = { reclaim: async () => {}, processOne: async () => { concurrent += 1; peak = Math.max(peak, concurrent); await new Promise((resolve) => { release = resolve; }); concurrent -= 1; } };
  const worker = new ActionWorker({ service, intervalMs: 1 });
  const first = worker.tick(); await new Promise((resolve) => setImmediate(resolve));
  const second = worker.tick(); assert.equal(peak, 1);
  const stopping = worker.stop(); release(); await Promise.all([first, second, stopping]);
  assert.equal(concurrent, 0); assert.equal(peak, 1);
});

test('PostgreSQL two-instance snapshots refresh and audit failure rolls back', async (t) => {
  if (!isolatedDatabase()) return t.skip('isolated V1 test database required');
  const pg = (await import('../../apps/api/node_modules/pg/lib/index.js')).default;
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL });
  const secondPool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL });
  const scopeId = randomUUID(); const actorId = randomUUID();
  const repositoryA = new PostgresSystemRepository(pool); const repositoryB = new PostgresSystemRepository(secondPool);
  const first = new SystemService({ repository: repositoryA, scopeId }); const second = new SystemService({ repository: repositoryB, scopeId });
  try {
    await Promise.all([first.ready, second.ready]);
    const firstWrite = await first.patch({ baseVersion: '1', patch: { domain: 'appearance', value: { mode: 'dark' } }, actorId, requestId: randomUUID() });
    assert.equal(firstWrite.settingsVersion, '2');
    assert.equal((await second.snapshot()).settings.appearance.appearanceMode, 'dark');
    const secondWrite = await second.patch({ baseVersion: '2', patch: { domain: 'locale', value: { language: 'zh-CN' } }, actorId, requestId: randomUUID() });
    assert.equal(secondWrite.contextVersion, '3');
    assert.equal((await first.context()).settings.locale.uiLocale, 'zh-CN');
    const replayId = randomUUID();
    const beforeReplay = await first.patch({ baseVersion: '3', patch: { domain: 'grid', value: { opacity: 0.5 } }, actorId, requestId: replayId });
    assert.deepEqual(await second.patch({ baseVersion: '3', patch: { domain: 'grid', value: { opacity: 0.5 } }, actorId, requestId: replayId }), beforeReplay);
    assert.equal((await second.snapshot()).settingsVersion, '4');
    await assert.rejects(first.patch({ baseVersion: '2', patch: { domain: 'grid', value: { enabled: false } }, actorId, requestId: randomUUID() }), (error) => error.statusCode === 409 && error.current.settingsVersion === '4' && error.current.settings.locale.uiLocale === 'zh-CN');
    repositoryB.recordAudit = async () => { throw new Error('audit_unavailable'); };
    await assert.rejects(second.patch({ baseVersion: '4', patch: { domain: 'privacy', value: { telemetry: true } }, actorId, requestId: randomUUID() }), /audit_unavailable/);
    const after = await first.snapshot(); assert.equal(after.settingsVersion, '4'); assert.equal(after.settings.privacy.telemetry, false);
    assert.equal((await repositoryA.eventsAfter(scopeId, 0)).length, 3);
    const audits = await pool.query("SELECT count(*)::int AS n FROM audit_events WHERE actor_id=$1 AND action='system.settings.patch'", [actorId]);
    assert.equal(audits.rows[0].n, 3);
    const outbox = await pool.query("SELECT count(*)::int AS n FROM audit_outbox o JOIN audit_events a USING (event_id) WHERE a.actor_id=$1 AND a.action='system.settings.patch'", [actorId]);
    assert.equal(outbox.rows[0].n, 3);
    repositoryB.recordAudit = PostgresSystemRepository.prototype.recordAudit;
    const concurrent = await Promise.allSettled([
      first.patch({ baseVersion: '4', patch: { domain: 'grid', value: { enabled: false } }, actorId, requestId: randomUUID() }),
      second.patch({ baseVersion: '4', patch: { domain: 'appearance', value: { mode: 'light' } }, actorId, requestId: randomUUID() }),
    ]);
    assert.equal(concurrent.filter((item) => item.status === 'fulfilled').length, 1);
    const rejected = concurrent.find((item) => item.status === 'rejected');
    assert.equal(rejected.reason.statusCode, 409);
    assert.equal(rejected.reason.current.settingsVersion, '5');
    assert.equal((await second.snapshot()).settingsVersion, '5');
  } finally {
    await pool.query('DELETE FROM system_setting_events WHERE scope_id=$1', [scopeId]);
    await pool.query('DELETE FROM system_settings WHERE scope_id=$1', [scopeId]);
    await secondPool.end();
    await pool.end();
  }
});

test('0044 upgrades stored legacy settings without changing versions', async (t) => {
  if (!isolatedDatabase()) return t.skip('dedicated governance database required');
  const pg = (await import('../../apps/api/node_modules/pg/lib/index.js')).default;
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE TEMP TABLE system_settings (LIKE public.system_settings INCLUDING ALL) ON COMMIT DROP');
    const scopeId = randomUUID();
    await client.query('INSERT INTO system_settings(scope_id,settings_version,context_version,settings) VALUES($1,7,9,$2)', [scopeId, JSON.stringify({ appearance: { mode: 'dark' }, locale: { language: 'zh-CN' }, network: { proxyMode: 'system', proxySecretRef: 'old-internal' }, grid: { enabled: true } })]);
    const migration = await readFile(new URL('../../migrations/0044-system-projection.sql', import.meta.url), 'utf8');
    await client.query(migration);
    const { rows } = await client.query('SELECT settings_version,context_version,settings FROM system_settings WHERE scope_id=$1', [scopeId]);
    assert.equal(Number(rows[0].settings_version), 7); assert.equal(Number(rows[0].context_version), 9);
    assert.equal(rows[0].settings.appearance.appearanceMode, 'dark'); assert.equal(rows[0].settings.appearance.mode, undefined);
    assert.equal(rows[0].settings.locale.uiLocale, 'zh-CN'); assert.equal(rows[0].settings.locale.projectContentLanguage, 'en-US');
    assert.equal(rows[0].settings.network.proxySecretRef, undefined); assert.equal(rows[0].settings.grid.spacing, 24);
  } finally { await client.query('ROLLBACK'); client.release(); await pool.end(); }
});
