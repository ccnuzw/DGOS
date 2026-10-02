import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Fastify from '../../apps/api/node_modules/fastify/fastify.js';
import pg from '../../apps/api/node_modules/pg/esm/index.mjs';
import { buildServer } from '../../apps/api/src/server.mjs';
import { registerAuditRoutes } from '../../apps/api/src/audit-routes.mjs';
import { InMemoryAuditRepository, PostgresAuditRepository } from '../../src/audit/outbox.mjs';
import { InMemoryIdentityRepository } from '../../src/identity/repository.mjs';
import { PostgresRetentionRepository } from '../../src/audit/retention.mjs';

const databaseUrl = process.env.DGOS_DATABASE_URL;
const dedicated = (() => { try { return /^\/(?:dgos_v1_governance|dgos_v1_verify_[0-9a-f]{32})$/.test(new URL(databaseUrl).pathname); } catch { return false; } })();

test('audit query records access, redacts summaries and scopes cursor pages', async () => {
  const audit = new InMemoryAuditRepository();
  const owner = randomUUID(); const other = randomUUID();
  const app = Fastify();
  registerAuditRoutes(app, { audit, requireScope: async (request, scope) => {
    if (scope !== 'audit.read' || request.headers.authorization !== 'ApiKey permitted') throw Object.assign(new Error('insufficient_scope'), { statusCode: 403 });
    return { subjectId: owner, authMethod: 'api_key' };
  } });
  const own = []; const taskId = randomUUID();
  for (let i = 0; i < 3; i++) own.push(await audit.record({ requestId: randomUUID(), actorId: owner, action: 'fixture.query', targetType: 'fixture', summary: { state: 'ready', taskId, count: 3, reasonCode: 'approved', credential: 'secret-value', path: '/private/data', nested: { token: 'hidden' } }, createdAt: new Date(Date.now() - 60000 - i).toISOString() }));
  await audit.record({ requestId: randomUUID(), actorId: other, action: 'fixture.query', targetType: 'fixture', summary: { state: 'other' } });
  try {
    const denied = await app.inject({ url: '/api/v1/audit/events' }); assert.equal(denied.statusCode, 403);
    const headers = { authorization: 'ApiKey permitted' };
    const first = await app.inject({ url: '/api/v1/audit/events?action=fixture.query&limit=2', headers });
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(first.json().items.length, 2); assert.ok(first.json().nextCursor);
    assert.deepEqual(first.json().items[0].summary, { state: 'ready', taskId, count: 3, reasonCode: 'approved' });
    assert.ok(first.json().items.every((item) => item.actor.id === owner));
    const second = await app.inject({ url: `/api/v1/audit/events?action=fixture.query&limit=2&cursor=${first.json().nextCursor}`, headers });
    assert.equal(second.statusCode, 200, second.body);
    assert.equal(second.json().items.length, 1); assert.equal(second.json().nextCursor, null);
    assert.deepEqual(new Set([...first.json().items, ...second.json().items].map((item) => item.eventId)), new Set(own));
    assert.equal((await app.inject({ url: `/api/v1/audit/events?actorId=${other}`, headers })).statusCode, 403);
    for (const query of ['limit=0', 'limit=101', 'limit=1.5', 'cursor=bad', 'from=tomorrow', 'unknown=1']) assert.equal((await app.inject({ url: `/api/v1/audit/events?${query}`, headers })).statusCode, 422);
    const accesses = [...audit.events.values()].filter((item) => item.action === 'audit.query');
    assert.equal(accesses.length, 2);
    assert.ok(accesses.every((item) => item.actorId === owner && Object.keys(item.summary).length === 0));
    const before = accesses.length;
    const original = audit.record.bind(audit);
    audit.record = async () => { throw Object.assign(new Error('audit_unavailable'), { statusCode: 503 }); };
    const blocked = await app.inject({ url: '/api/v1/audit/events', headers });
    assert.equal(blocked.statusCode, 503); assert.equal((await audit.query({ action: 'audit.query' })).items.length, before);
    audit.record = original;
  } finally { await app.close(); }
});

test('main API audit query records itself and rejects unauthorized disclosure', async () => {
  const audit = new InMemoryAuditRepository();
  const savedUrl = process.env.DGOS_DATABASE_URL;
  delete process.env.DGOS_DATABASE_URL;
  let app;
  try { app = buildServer({ logger: false, repository: new InMemoryIdentityRepository(), auditRepository: audit }); }
  finally { if (savedUrl === undefined) delete process.env.DGOS_DATABASE_URL; else process.env.DGOS_DATABASE_URL = savedUrl; }
  try {
    const boot = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'Audit r11', credential: 'fixture-only' } });
    assert.equal(boot.statusCode, 201, boot.body);
    const subjectId = boot.json().principalId;
    const sessionHeaders = { authorization: `Bearer ${boot.json().sessionId}` };
    await audit.record({ requestId: randomUUID(), actorId: subjectId, action: 'ai.task.submit', targetType: 'ai_task', summary: { taskId: randomUUID(), count: 2, token: 'private', path: '/Users/private' } });
    const denied = await app.inject({ url: '/api/v1/audit/events' }); assert.equal(denied.statusCode, 401);
    const read = await app.inject({ url: '/api/v1/audit/events?action=ai.task.submit', headers: sessionHeaders });
    assert.equal(read.statusCode, 200, read.body); assert.equal(read.json().items.length, 1);
    assert.ok(read.json().items[0].summary.taskId); assert.equal(read.json().items[0].summary.count, 2);
    assert.ok(!JSON.stringify(read.json()).includes('/Users/private'));
    const readEvents = [...audit.events.values()].filter((event) => event.action === 'audit.query');
    assert.equal(readEvents.length, 1); assert.equal(readEvents[0].actorId, subjectId);
    const self = await app.inject({ url: '/api/v1/audit/events?action=audit.query', headers: sessionHeaders });
    assert.equal(self.statusCode, 200, self.body); assert.equal(self.json().items.length, 2);
    assert.equal([...audit.events.values()].filter((event) => event.action === 'audit.query').length, 2);
    const key = await app.inject({ method: 'POST', url: '/api/v1/secret/api-keys', headers: sessionHeaders, payload: { name: 'audit-reader', scopes: ['audit.read'] } });
    assert.equal(key.statusCode, 201, key.body);
    const keyHeaders = { authorization: `ApiKey ${key.json().secret}` };
    const keyRead = await app.inject({ url: '/api/v1/audit/events', headers: keyHeaders });
    assert.equal(keyRead.statusCode, 200, keyRead.body);
    assert.ok(keyRead.json().items.every((item) => item.actor.id === subjectId));
    const cross = await app.inject({ url: `/api/v1/audit/events?actorId=${randomUUID()}`, headers: keyHeaders });
    assert.equal(cross.statusCode, 403); assert.equal(cross.json().errorKey, 'insufficient_scope');
    const invalid = await app.inject({ url: '/api/v1/audit/events?cursor=bad', headers: sessionHeaders });
    assert.equal(invalid.statusCode, 422);
    const before = audit.events.size;
    const originalRecord = audit.record.bind(audit);
    audit.record = async (event) => { if (event.action === 'audit.query') throw Object.assign(new Error('audit_unavailable'), { statusCode: 503 }); return originalRecord(event); };
    const blocked = await app.inject({ url: '/api/v1/audit/events', headers: sessionHeaders });
    assert.equal(blocked.statusCode, 503); assert.equal(blocked.json().items, undefined);
    assert.equal(audit.events.size, before);
  } finally { await app.close(); }
});

test('standalone PostgreSQL audit record and outbox commit or roll back together', { skip: !dedicated }, async () => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const actorId = randomUUID(); const eventId = randomUUID(); const requestId = randomUUID(); const moreIds = [randomUUID(), randomUUID()];
  const audit = new PostgresAuditRepository(pool);
  try {
    await audit.record({ eventId, requestId, actorId, action: 'fixture.audit', targetType: 'fixture', summary: { state: 'ready', secret: 'hidden' } });
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM audit_outbox WHERE event_id=$1', [eventId])).rows[0].n, 1);
    const explicitlyPooledId = randomUUID();
    await audit.record({ eventId: explicitlyPooledId, requestId: randomUUID(), actorId, action: 'fixture.pool', targetType: 'fixture' }, pool);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM audit_outbox WHERE event_id=$1', [explicitlyPooledId])).rows[0].n, 1);
    const page = await audit.query({ actorId, action: 'fixture.audit', limit: 1 });
    assert.equal(page.items[0].eventId, eventId); assert.deepEqual(page.items[0].summary, { state: 'ready' });
    for (const id of moreIds) await audit.record({ eventId: id, requestId: randomUUID(), actorId, action: 'fixture.audit', targetType: 'fixture', summary: { state: 'ready' } });
    const firstPage = await audit.query({ actorId, action: 'fixture.audit', limit: 2 });
    assert.equal(firstPage.items.length, 2); assert.ok(firstPage.nextCursor);
    const nextPage = await audit.query({ actorId, action: 'fixture.audit', limit: 2, cursor: firstPage.nextCursor });
    assert.equal(nextPage.items.length, 1); assert.equal(nextPage.nextCursor, null);
    assert.deepEqual(new Set([...firstPage.items, ...nextPage.items].map((item) => item.eventId)), new Set([eventId, ...moreIds]));
    await assert.rejects(audit.query({ actorId, cursor: 'bad' }), /invalid_request/);
    const app = Fastify();
    app.addHook('onRequest', async (request) => { request.requestId = request.headers['x-request-id'] ?? randomUUID(); });
    registerAuditRoutes(app, { audit, requireScope: async () => ({ subjectId: actorId, authMethod: 'session' }) });
    try {
      const response = await app.inject({ url: '/api/v1/audit/events?action=fixture.audit&limit=2', headers: { 'x-request-id': randomUUID() } });
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.json().items.length, 2);
      assert.ok(response.json().items.every((item) => !JSON.stringify(item).includes('hidden')));
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_events e JOIN audit_outbox o USING(event_id) WHERE e.actor_id=$1 AND e.action='audit.query'", [actorId])).rows[0].n, 1);
    } finally { await app.close(); }
    const failedId = randomUUID();
    const failingPool = { connect: async () => { const client = await pool.connect(); return { query: (sql, values) => sql.startsWith('INSERT INTO audit_outbox') ? Promise.reject(new Error('outbox_unavailable')) : client.query(sql, values), release: () => client.release() }; } };
    await assert.rejects(new PostgresAuditRepository(failingPool).record({ eventId: failedId, requestId: randomUUID(), actorId, action: 'fixture.audit', targetType: 'fixture' }), /outbox_unavailable/);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM audit_events WHERE event_id=$1', [failedId])).rows[0].n, 0);
    const rolledBackId = randomUUID(); const client = await pool.connect();
    try { await client.query('BEGIN'); await audit.record({ eventId: rolledBackId, requestId: randomUUID(), actorId, action: 'fixture.audit', targetType: 'fixture' }, client); await client.query('ROLLBACK'); }
    finally { client.release(); }
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM audit_events WHERE event_id=$1', [rolledBackId])).rows[0].n, 0);
  } finally {
    await pool.query('DELETE FROM audit_outbox WHERE event_id IN (SELECT event_id FROM audit_events WHERE actor_id=$1)', [actorId]);
    await pool.query('DELETE FROM audit_events WHERE actor_id=$1', [actorId]);
    await pool.end();
  }
});

test('main API with PostgreSQL persists the audit query before disclosure', { skip: !dedicated }, async () => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const audit = new PostgresAuditRepository(pool);
  const savedUrl = process.env.DGOS_DATABASE_URL;
  delete process.env.DGOS_DATABASE_URL;
  let app;
  try { app = buildServer({ logger: false, repository: new InMemoryIdentityRepository(), auditRepository: audit }); }
  finally { process.env.DGOS_DATABASE_URL = savedUrl; }
  let actorId;
  try {
    const boot = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'Audit PG', credential: 'fixture-only' } });
    assert.equal(boot.statusCode, 201, boot.body);
    actorId = boot.json().principalId;
    const headers = { authorization: `Bearer ${boot.json().sessionId}` };
    const eventId = await audit.record({ requestId: randomUUID(), actorId, action: 'ai.task.submit', targetType: 'ai_task', targetId: randomUUID(), summary: { taskId: randomUUID(), modelId: 'provider/model', count: 3, credential: 'private' } });
    const response = await app.inject({ url: '/api/v1/audit/events?action=ai.task.submit', headers });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().items[0].eventId, eventId);
    assert.equal(response.json().items[0].summary.modelId, 'provider/model');
    assert.equal(response.json().items[0].summary.count, 3);
    assert.equal(response.json().items[0].summary.credential, undefined);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_events e JOIN audit_outbox o USING(event_id) WHERE e.actor_id=$1 AND e.action='audit.query'", [actorId])).rows[0].n, 1);
    assert.equal((await app.inject({ url: '/api/v1/audit/events?limit=0', headers })).statusCode, 422);
  } finally {
    await app.close();
    if (actorId) {
      await pool.query('DELETE FROM audit_outbox WHERE event_id IN (SELECT event_id FROM audit_events WHERE actor_id=$1)', [actorId]);
      await pool.query('DELETE FROM audit_events WHERE actor_id=$1', [actorId]);
    }
    await pool.end();
  }
});

test('two fresh authenticated public policy writes have one winner', { skip: !dedicated }, async () => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const audit = new PostgresAuditRepository(pool);
  const retention = new PostgresRetentionRepository(pool, { audit });
  const prior = await retention.policy();
  const priorReason = `r11-${randomUUID()}`;
  const savedUrl = process.env.DGOS_DATABASE_URL;
  delete process.env.DGOS_DATABASE_URL;
  const app = buildServer({ logger: false, repository: new InMemoryIdentityRepository(), auditRepository: audit, retentionRepository: retention });
  process.env.DGOS_DATABASE_URL = savedUrl;
  let actorId;
  try {
    const boot = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'R11', credential: 'fixture-only' } });
    assert.equal(boot.statusCode, 201, boot.body);
    actorId = boot.json().principalId;
    const headers = { authorization: `Bearer ${boot.json().sessionId}`, 'x-dgos-csrf': 'r11' };
    const login = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/login', payload: { principalHint: actorId, credential: 'fixture-only' } });
    assert.equal(login.statusCode, 200, login.body);
    const secondHeaders = { authorization: `Bearer ${login.json().sessionId}`, 'x-dgos-csrf': 'r11' };
    const input = { baseVersion: prior.version, auditRetentionDays: prior.auditRetentionDays + 1, reason: priorReason };
    const [first, second] = await Promise.all([
      app.inject({ method: 'PUT', url: '/api/v1/admin/governance/policy', headers: { ...headers, 'x-request-id': randomUUID() }, payload: input }),
      app.inject({ method: 'PUT', url: '/api/v1/admin/governance/policy', headers: { ...secondHeaders, 'x-request-id': randomUUID() }, payload: { ...input, auditRetentionDays: prior.auditRetentionDays + 2 } }),
    ]);
    assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 409], `${first.body} ${second.body}`);
    assert.equal(Number((await retention.policy()).version), Number(prior.version) + 1);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_events WHERE actor_id=$1 AND action='governance.policy.update'", [actorId])).rows[0].n, 1);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_outbox o JOIN audit_events e USING(event_id) WHERE e.actor_id=$1 AND e.action='governance.policy.update'", [actorId])).rows[0].n, 1);
    const key = await app.inject({ method: 'POST', url: '/api/v1/secret/api-keys', headers, payload: { name: 'r11-policy', scopes: ['governance.write'] } });
    assert.equal(key.statusCode, 201, key.body);
    const keyDenied = await app.inject({ method: 'PUT', url: '/api/v1/admin/governance/policy', headers: { authorization: `ApiKey ${key.json().secret}`, 'x-request-id': randomUUID() }, payload: { ...input, baseVersion: String(Number(prior.version) + 1) } });
    assert.equal(keyDenied.statusCode, 403); assert.equal(keyDenied.json().errorKey, 'step_up_required');
  } finally {
    await app.close();
    await pool.query('DELETE FROM audit_outbox WHERE event_id IN (SELECT event_id FROM audit_events WHERE actor_id=$1)', [actorId]);
    await pool.query('DELETE FROM audit_events WHERE actor_id=$1', [actorId]);
    await pool.query('UPDATE governance_policy SET policy_version=$1,audit_retention_days=$2,cache_retention_days=$3,revoked_session_retention_days=$4,updated_at=$5 WHERE singleton=true', [prior.version, prior.auditRetentionDays, prior.cacheRetentionDays, prior.revokedSessionRetentionDays, prior.updatedAt]);
    await pool.end();
  }
});
