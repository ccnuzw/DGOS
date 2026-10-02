import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from '../apps/api/node_modules/pg/esm/index.mjs';
import { createClient } from '../apps/api/node_modules/redis/dist/index.js';
import { buildServer } from '../apps/api/src/server.mjs';
import { IdentityService } from '../apps/api/src/identity-service.mjs';
import { PostgresIdentityRepository } from '../src/identity/repository.mjs';
import { DiskPackageStore } from '../src/apps/package-service.mjs';
import { RedisSecretService } from '../src/security/secret-service.mjs';
import { createLoginBackoff, createRateLimiter } from '../src/security/rate-limiter.mjs';
import { discoverMigrations, buildMigrationSql } from './migrate.mjs';
import { selectedMigrations } from './v1-performance.mjs';

const runId = randomUUID().replaceAll('-', '');
const databaseName = `dgos_v1_identity_${runId}`;
const databaseRoot = new URL(process.env.DGOS_IDENTITY_ADMIN_DATABASE_URL ?? 'postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_governance');
if (databaseRoot.hostname !== '127.0.0.1' || databaseRoot.port !== '5432' || databaseRoot.pathname !== '/dgos_v1_governance') throw new Error('dedicated_governance_admin_database_required');
const childUrl = new URL(databaseRoot); childUrl.pathname = `/${databaseName}`;
const redisUrl = process.env.DGOS_IDENTITY_REDIS_URL ?? 'redis://127.0.0.1:6379/3';
if (new URL(redisUrl).pathname !== '/3') throw new Error('redis_db3_required');
const namespace = `v1-gov-r12:${runId}`;
const packageRoot = await mkdtemp(join(tmpdir(), 'dgos-identity-r12-'));
const admin = new pg.Pool({ connectionString: databaseRoot.href });
const redis = createClient({ url: redisUrl }); redis.on('error', () => {});
const cases = [];
const recorded = (name, detail = {}) => cases.push({ name, result: 'passed', ...detail });
const expectStatus = (response, status, name) => assert.equal(response.status, status, `${name}: status=${response.status}, errorKey=${response.body?.errorKey ?? 'none'}, requestId=${response.requestId}`);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let pool, first, second, created = false;
let originalDatabaseUrl = process.env.DGOS_DATABASE_URL;
let originalNodeEnv = process.env.NODE_ENV;
const request = async (port, route, { method = 'GET', body, session, key, cookie, csrf = true, requestId = randomUUID() } = {}) => {
  const headers = { 'x-request-id': requestId, ...(body ? { 'content-type': 'application/json' } : {}), ...(session ? { authorization: `Bearer ${session}`, ...(csrf ? { 'x-dgos-csrf': 'r12' } : {}) } : {}), ...(cookie ? { cookie: `dgos_session=${cookie}` } : {}), ...(key ? { authorization: `ApiKey ${key}` } : {}) };
  const response = await fetch(`http://127.0.0.1:${port}/api/v1${route}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10_000) });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null, requestId, cacheControl: response.headers.get('cache-control'), setCookie: Boolean(response.headers.get('set-cookie')) };
};
const auditCount = async (actorId, action) => Number((await pool.query('SELECT count(*)::int AS n FROM audit_events WHERE actor_id=$1 AND action=$2', [actorId, action])).rows[0].n);

try {
  await admin.query(`CREATE DATABASE "${databaseName}"`); created = true;
  pool = new pg.Pool({ connectionString: childUrl.href });
  const { selected: migrations, actualSetSha } = selectedMigrations(await discoverMigrations());
  await pool.query(buildMigrationSql(migrations));
  recorded('isolated_frozen_schema', { migrationCount: migrations.length, migrationSetSha256: actualSetSha });

  await redis.connect();
  process.env.DGOS_DATABASE_URL = childUrl.href; process.env.NODE_ENV = 'test';
  const firstBackoff = createLoginBackoff({ redis, prefix: `${namespace}:backoff:` });
  const secondBackoff = createLoginBackoff({ redis, prefix: `${namespace}:backoff:` });
  let backoffIndex = 0;
  const bootstrapRefs = new Set();
  const options = () => { const backend = new RedisSecretService(redis, { keyPrefix: `${namespace}:secret:` }); return ({ logger: false, closeDatabasePools: true,
    secretService: {
      put: (input) => { if (input.purpose === 'admin-login') bootstrapRefs.add(input.secretRef); return backend.put(input); },
      resolve: (input) => backend.resolve(input),
      revoke: (ref) => backend.revoke(ref),
      inspect: (ref) => backend.inspect(ref),
    },
    rateLimiter: createRateLimiter({ redis, prefix: `${namespace}:rate:` }),
    loginBackoff: backoffIndex++ === 0 ? firstBackoff : secondBackoff,
    packageOptions: { store: new DiskPackageStore(packageRoot), trustRoots: new Map() },
  }); };
  first = buildServer(options()); second = buildServer(options());
  await Promise.all([first.listen({ host: '127.0.0.1', port: 15121 }), second.listen({ host: '127.0.0.1', port: 15122 })]);
  recorded('two_independent_http_instances', { ports: [15121, 15122] });

  const credential = `r12-${randomUUID()}-${randomUUID()}`;
  const boot = await Promise.all([request(15121, '/identity/admin/bootstrap', { method: 'POST', body: { displayName: 'R12', credential } }), request(15122, '/identity/admin/bootstrap', { method: 'POST', body: { displayName: 'R12', credential } })]);
  assert.deepEqual(boot.map((item) => item.status).sort(), [201, 409]);
  const owner = boot.find((item) => item.status === 201).body;
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM admin_principals')).rows[0].n, 1);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM admin_sessions')).rows[0].n, 1);
  assert.equal(await auditCount(owner.principalId, 'admin.session.create'), 1);
  const secretPrefix = `${namespace}:secret:`;
  const secretService = new RedisSecretService(redis, { keyPrefix: secretPrefix });
  const winnerRef = `admin-credential:${owner.principalId}`;
  const winnerKey = `${secretPrefix}${winnerRef}`;
  assert.equal(bootstrapRefs.size, 2, 'both bootstrap attempts must write a distinct credential reference');
  assert.ok(bootstrapRefs.has(winnerRef));
  const keys = new Set();
  for await (const key of redis.scanIterator({ MATCH: `${secretPrefix}*` })) keys.add(key);
  assert.ok(keys.has(winnerKey), 'winning bootstrap credential must exist');
  for (const key of keys) if (key.startsWith(`${secretPrefix}admin-credential:`)) assert.ok(bootstrapRefs.has(key.slice(secretPrefix.length)), 'unexpected bootstrap credential key');
  let activeBootstrapCredentials = 0;
  for (const ref of bootstrapRefs) {
    const key = `${secretPrefix}${ref}`;
    const record = await redis.hGetAll(key);
    const subjectId = ref.slice('admin-credential:'.length);
    if (key === winnerKey) {
      assert.equal(record.purpose, 'admin-login');
      assert.equal(record.subjectId, owner.principalId);
      assert.equal((await secretService.inspect(ref)).credentialState, 'available');
      const handle = await secretService.resolve({ secretRef: ref, purpose: 'admin-login', subjectId: owner.principalId });
      assert.ok((await handle.read()) === credential, 'winning bootstrap credential must remain usable');
      activeBootstrapCredentials += 1;
    } else {
      assert.equal(record.value, undefined, 'losing bootstrap credential must contain no readable value');
      assert.notEqual((await secretService.inspect(ref)).credentialState, 'available', 'losing bootstrap credential must be unavailable');
      await assert.rejects(secretService.resolve({ secretRef: ref, purpose: 'admin-login', subjectId }), /credential_unavailable/);
    }
  }
  assert.equal(activeBootstrapCredentials, 1);
  recorded('concurrent_bootstrap_single_principal_and_loser_secret_compensation', { activeBootstrapCredentials: 1 });

  const bad = await request(15121, '/identity/admin/login', { method: 'POST', body: { principalHint: owner.principalId, credential: 'wrong' } });
  assert.equal(bad.status, 401); assert.equal(bad.body.errorKey, 'invalid_credentials');
  assert.equal((await secondBackoff.check({ subject: owner.principalId, source: 'another-source' })).allowed, false);
  assert.equal((await secondBackoff.check({ subject: randomUUID(), source: '127.0.0.1' })).allowed, false);
  const blocked = await request(15122, '/identity/admin/login', { method: 'POST', body: { principalHint: randomUUID(), credential: 'wrong' } });
  assert.equal(blocked.status, 429); assert.equal(blocked.body.errorKey, 'rate_limited');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM admin_sessions')).rows[0].n, 1);
  recorded('shared_subject_and_source_backoff_no_failed_session');
  await pause(350);
  const deviceB = await request(15122, '/identity/admin/login', { method: 'POST', body: { principalHint: owner.principalId, credential } });
  expectStatus(deviceB, 200, 'second_device_login');
  const deviceC = await request(15121, '/identity/admin/login', { method: 'POST', body: { principalHint: owner.principalId, credential } });
  expectStatus(deviceC, 200, 'third_device_login');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM admin_principals')).rows[0].n, 1);
  recorded('one_principal_multiple_independent_sessions');

  const identityRepository = new PostgresIdentityRepository(pool);
  const managedIdentity = new IdentityService({ repository: identityRepository });
  const firstPage = await managedIdentity.listSessions({ actorId: owner.principalId, currentSessionId: owner.sessionId, requestId: randomUUID(), limit: 2 });
  assert.equal(firstPage.items.length, 2);
  assert.ok(firstPage.nextCursor);
  const secondPage = await managedIdentity.listSessions({ actorId: owner.principalId, currentSessionId: owner.sessionId, requestId: randomUUID(), limit: 2, cursor: firstPage.nextCursor });
  assert.equal(secondPage.items.length, 1);
  const devices = [...firstPage.items, ...secondPage.items];
  assert.equal(new Set(devices.map((item) => item.sessionManagementId)).size, 3);
  assert.ok(devices.every((item) => /^sm_[A-Za-z0-9_-]{32,128}$/.test(item.sessionManagementId) && item.deviceSummary.host === 'unknown'));
  assert.ok(!JSON.stringify(devices).includes(owner.sessionId) && !JSON.stringify(devices).includes(deviceB.body.sessionId));
  assert.equal((await request(15122, '/identity/admin/session', { session: devices[0].sessionManagementId })).status, 401);
  assert.equal(await auditCount(owner.principalId, 'admin.session.list'), 2);
  recorded('management_projection_pagination_redaction_and_non_authentication_domain');

  const httpPage = await request(15122, '/identity/admin/sessions?limit=2', { session: owner.sessionId });
  expectStatus(httpPage, 200, 'management_http_list');
  assert.equal(httpPage.cacheControl, 'no-store');
  assert.equal(httpPage.body.items.length, 2);
  assert.ok(httpPage.body.nextCursor);
  const httpPage2 = await request(15121, `/identity/admin/sessions?limit=2&cursor=${httpPage.body.nextCursor}`, { session: owner.sessionId });
  expectStatus(httpPage2, 200, 'management_http_next_page');
  const httpDevices = [...httpPage.body.items, ...httpPage2.body.items];
  assert.equal(httpDevices.length, 3);
  assert.ok(httpDevices.every((item) => item.deviceSummary.host === 'unknown' && !Object.hasOwn(item, 'sessionId')));
  assert.ok(!JSON.stringify(httpDevices).includes(owner.sessionId) && !JSON.stringify(httpDevices).includes(credential));
  expectStatus(await request(15122, '/identity/admin/sessions', { key: 'dgos_invalid' }), 401, 'management_key_denied');
  recorded('management_http_list_no_store_redaction_and_pagination');

  const deviceBManagementId = (await identityRepository.getSession(deviceB.body.sessionId)).sessionManagementId;
  assert.ok(devices.some((item) => item.sessionManagementId === deviceBManagementId));
  const legacyBearerTarget = await request(15121, `/identity/admin/sessions/${deviceB.body.sessionId}`, { method: 'DELETE', session: owner.sessionId, body: { requestId: randomUUID() } });
  expectStatus(legacyBearerTarget, 404, 'bearer_management_target_rejected');
  assert.equal((await identityRepository.getSession(deviceB.body.sessionId)).state, 'active');
  assert.ok(deviceBManagementId);
  const crossActor = randomUUID();
  const beforeCrossActor = (await identityRepository.getSession(deviceB.body.sessionId)).sessionVersion;
  await assert.rejects(managedIdentity.revokeManagedSession({ managementId: deviceBManagementId, actorId: crossActor, requestId: randomUUID() }), (error) => error.statusCode === 404);
  assert.equal((await identityRepository.getSession(deviceB.body.sessionId)).sessionVersion, beforeCrossActor);
  assert.equal(await auditCount(crossActor, 'admin.session.revoke'), 0);
  recorded('management_cross_owner_404_without_side_effect');

  const staleTarget = (await identityRepository.getSession(deviceC.body.sessionId)).sessionManagementId;
  const staleVersion = (await identityRepository.getSession(deviceC.body.sessionId)).sessionVersion;
  await pool.query("UPDATE admin_sessions SET auth_fresh_until = now() - interval '1 second' WHERE session_id=$1", [owner.sessionId]);
  const stale = await request(15122, `/identity/admin/sessions/${staleTarget}`, { method: 'DELETE', session: owner.sessionId, body: { requestId: randomUUID() } });
  expectStatus(stale, 403, 'stale_management_revoke');
  assert.equal(stale.body.errorKey, 'step_up_required');
  assert.equal((await identityRepository.getSession(deviceC.body.sessionId)).sessionVersion, staleVersion);
  assert.equal((await request(15121, '/identity/admin/session', { session: deviceC.body.sessionId })).status, 200);
  await pool.query("UPDATE admin_sessions SET auth_fresh_until = now() + interval '10 minutes' WHERE session_id=$1", [owner.sessionId]);
  const csrfRejected = await request(15121, `/identity/admin/sessions/${staleTarget}`, { method: 'DELETE', session: owner.sessionId, cookie: owner.sessionId, csrf: false, body: { requestId: randomUUID() } });
  expectStatus(csrfRejected, 403, 'management_csrf');
  assert.equal((await identityRepository.getSession(deviceC.body.sessionId)).sessionVersion, staleVersion);
  recorded('management_stale_freshness_and_csrf_no_target_mutation');

  const beforeSystem = await request(15121, '/system/settings', { session: owner.sessionId });
  expectStatus(beforeSystem, 200, 'system_settings_before_stale');
  await pool.query("UPDATE admin_sessions SET auth_fresh_until = now() - interval '1 second' WHERE session_id=$1", [owner.sessionId]);
  const staleSystem = await request(15122, '/system/settings', { method: 'PATCH', session: owner.sessionId, body: { requestId: randomUUID(), baseVersion: beforeSystem.body.settingsVersion, domain: 'privacy', patch: { telemetry: true } } });
  expectStatus(staleSystem, 403, 'stale_system_patch');
  assert.equal(staleSystem.body.errorKey, 'step_up_required');
  const afterSystem = await request(15121, '/system/settings', { session: owner.sessionId });
  assert.equal(afterSystem.body.settingsVersion, beforeSystem.body.settingsVersion);
  assert.equal(afterSystem.body.privacy.telemetry, beforeSystem.body.privacy.telemetry);
  const actionId = 'system.settings.privacy.patch';
  const actionInput = { baseVersion: beforeSystem.body.settingsVersion, value: { telemetry: true } };
  const proposed = await request(15121, `/actions/${actionId}/plan`, { method: 'POST', session: owner.sessionId, body: { input: actionInput } });
  expectStatus(proposed, 200, 'stale_action_plan');
  const staleAction = await request(15122, `/actions/${actionId}/execute`, { method: 'POST', session: owner.sessionId, body: { planId: proposed.body.planId, input: actionInput, confirmed: true } });
  expectStatus(staleAction, 403, 'stale_action_execute');
  assert.equal(staleAction.body.errorKey, 'step_up_required');
  assert.equal((await request(15121, '/system/settings', { session: owner.sessionId })).body.settingsVersion, beforeSystem.body.settingsVersion);
  await pool.query("UPDATE admin_sessions SET auth_fresh_until = now() + interval '10 minutes' WHERE session_id=$1", [owner.sessionId]);
  recorded('stale_system_and_action_public_http_pg_no_state_change');

  const managementRequestId = randomUUID();
  const beforeRevokeAudit = await auditCount(owner.principalId, 'admin.session.revoke');
  const otherDevice = await request(15121, `/identity/admin/sessions/${deviceBManagementId}`, { method: 'DELETE', session: owner.sessionId, body: { requestId: managementRequestId } });
  expectStatus(otherDevice, 200, 'same_owner_other_device_revoke');
  expectStatus(await request(15122, '/identity/admin/session', { session: deviceB.body.sessionId }), 401, 'revoked_device');
  expectStatus(await request(15122, '/identity/admin/session', { session: deviceC.body.sessionId }), 200, 'untouched_device');
  assert.equal(otherDevice.cacheControl, 'no-store');
  assert.equal(otherDevice.body.sessionManagementId, deviceBManagementId);
  assert.ok(!JSON.stringify(otherDevice.body).includes(deviceB.body.sessionId));
  const replay = await request(15122, `/identity/admin/sessions/${deviceBManagementId}`, { method: 'DELETE', session: owner.sessionId, body: { requestId: managementRequestId } });
  expectStatus(replay, 200, 'management_replay');
  assert.deepEqual(replay.body, otherDevice.body);
  assert.equal(await auditCount(owner.principalId, 'admin.session.revoke'), beforeRevokeAudit + 1);
  recorded('same_owner_other_device_revoke_does_not_touch_unrelated_session');

  const deviceCManagementId = (await identityRepository.getSession(deviceC.body.sessionId)).sessionManagementId;
  const race = await Promise.all([request(15121, '/identity/admin/session', { method: 'POST', session: deviceC.body.sessionId, body: { baseVersion: deviceC.body.sessionVersion } }), request(15122, `/identity/admin/sessions/${deviceCManagementId}`, { method: 'DELETE', session: owner.sessionId, body: { requestId: randomUUID() } })]);
  expectStatus(race[1], 200, 'revoke_race');
  assert.ok([200, 401, 409].includes(race[0].status));
  expectStatus(await request(15121, '/identity/admin/session', { session: deviceC.body.sessionId }), 401, 'race_final_state');
  recorded('renew_revoke_race_finally_revoked');

  const rollbackDevice = await request(15121, '/identity/admin/login', { method: 'POST', body: { principalHint: owner.principalId, credential } });
  expectStatus(rollbackDevice, 200, 'rollback_device_login');
  const rollbackManagementId = (await identityRepository.getSession(rollbackDevice.body.sessionId)).sessionManagementId;
  const previousAudit = identityRepository.audit;
  identityRepository.audit = { record: async () => { throw new Error('audit_unavailable'); } };
  await assert.rejects(managedIdentity.revokeManagedSession({ managementId: rollbackManagementId, actorId: owner.principalId, requestId: randomUUID() }), /audit_unavailable/);
  identityRepository.audit = previousAudit;
  assert.equal((await identityRepository.getSession(rollbackDevice.body.sessionId)).state, 'active');
  recorded('managed_revoke_audit_failure_transaction_rollback');
  await pool.query("UPDATE admin_sessions SET expires_at = now() - interval '1 second' WHERE session_id=$1", [rollbackDevice.body.sessionId]);
  expectStatus(await request(15122, '/identity/admin/session', { session: rollbackDevice.body.sessionId }), 401, 'expired_session_access');
  expectStatus(await request(15122, '/identity/admin/session', { method: 'POST', session: rollbackDevice.body.sessionId, body: { baseVersion: rollbackDevice.body.sessionVersion } }), 401, 'expired_session_renew');
  assert.equal((await identityRepository.getSession(rollbackDevice.body.sessionId)).sessionVersion, 1);
  recorded('expired_session_cannot_renew_or_regain_access');

  const headers = { session: owner.sessionId };
  const keyCreated = await request(15121, '/secret/api-keys', { method: 'POST', ...headers, body: { name: 'r12', scopes: ['audit.read', 'apiKey.read'] } });
  expectStatus(keyCreated, 201, 'key_create');
  const keyId = keyCreated.body.key.keyId; const secret = keyCreated.body.secret;
  const list = await request(15122, '/secret/api-keys', headers);
  assert.equal(list.status, 200); assert.equal(list.body.items.length, 1); assert.equal(list.body.items[0].secret, undefined);
  assert.equal((await request(15122, '/audit/events', { key: secret })).status, 200);
  assert.equal((await request(15122, '/secret/api-keys', { key: secret })).status, 200);
  expectStatus(await request(15122, '/identity/admin/sessions', { key: secret }), 401, 'valid_key_device_list_denied');
  assert.equal((await request(15122, '/admin/governance/policy', { key: secret })).status, 403);
  const stored = await pool.query('SELECT digest,scope FROM api_key_records WHERE key_id=$1', [keyId]);
  assert.ok(!JSON.stringify(stored.rows[0]).includes(secret));
  recorded('key_once_scope_and_cross_instance_authentication');

  const until = new Date(Date.now() + 1500).toISOString();
  const rotated = await request(15122, `/secret/api-keys/${keyId}/rotate`, { method: 'POST', ...headers, body: { baseVersion: keyCreated.body.key.version, overlapUntil: until } });
  expectStatus(rotated, 200, 'key_rotate');
  assert.equal((await request(15121, '/audit/events', { key: secret })).status, 200);
  assert.equal((await request(15121, '/audit/events', { key: rotated.body.secret })).status, 200);
  await pause(1800);
  assert.equal((await request(15122, '/audit/events', { key: secret })).status, 401);
  assert.equal((await request(15122, '/audit/events', { key: rotated.body.secret })).status, 200);
  recorded('cross_instance_finite_rotation_overlap');

  const expiring = await request(15121, '/secret/api-keys', { method: 'POST', ...headers, body: { name: 'r12-expiry', scopes: ['audit.read'], expiresAt: new Date(Date.now() + 1100).toISOString() } });
  expectStatus(expiring, 201, 'expiring_key_create');
  assert.equal((await request(15122, '/audit/events', { key: expiring.body.secret })).status, 200);
  await pause(1300);
  assert.equal((await request(15122, '/audit/events', { key: expiring.body.secret })).status, 401);
  const revoked = await request(15121, `/secret/api-keys/${rotated.body.key.keyId}`, { method: 'DELETE', ...headers });
  expectStatus(revoked, 200, 'key_revoke');
  assert.equal((await request(15122, '/audit/events', { key: rotated.body.secret })).status, 401);
  recorded('cross_instance_expiry_and_revoke');

  const persisted = await pool.query('SELECT action,summary::text FROM audit_events WHERE actor_id=$1', [owner.principalId]);
  assert.ok(!JSON.stringify(persisted.rows).includes(credential));
  assert.ok(!JSON.stringify(persisted.rows).includes(secret));
  assert.ok(!JSON.stringify(persisted.rows).includes(rotated.body.secret));
  assert.ok(!JSON.stringify(persisted.rows).includes(expiring.body.secret));
  recorded('audit_store_contains_no_login_or_key_secret');
  const sessionsBeforeUnknown = Number((await pool.query('SELECT count(*)::int AS n FROM admin_sessions')).rows[0].n);
  const unknown = await request(15121, '/identity/admin/login', { method: 'POST', body: { principalHint: randomUUID(), credential: 'wrong' } });
  expectStatus(unknown, 401, 'unknown_subject_public_response');
  assert.equal(unknown.body.errorKey, bad.body.errorKey);
  assert.equal(Number((await pool.query('SELECT count(*)::int AS n FROM admin_sessions')).rows[0].n), sessionsBeforeUnknown);
  recorded('unknown_subject_matches_bad_credential_without_session');
  await pool.query("UPDATE admin_sessions SET auth_fresh_until = now() - interval '1 second' WHERE session_id=$1", [owner.sessionId]);
  const logout = await request(15122, '/identity/admin/session', { method: 'DELETE', session: owner.sessionId, cookie: owner.sessionId });
  expectStatus(logout, 204, 'current_session_logout');
  assert.equal(logout.setCookie, true);
  expectStatus(await request(15121, '/identity/admin/session', { session: owner.sessionId }), 401, 'logout_cross_instance');
  recorded('stale_current_session_logout_csrf_cookie_and_cross_instance_rejection');
  console.log(JSON.stringify({ workPackage: 'V1-IDENTITY-r12', result: 'passed', databaseName, redisDb: 3, namespace, cases }, null, 2));
} finally {
  await Promise.allSettled([first?.close(), second?.close()]);
  if (originalDatabaseUrl === undefined) delete process.env.DGOS_DATABASE_URL; else process.env.DGOS_DATABASE_URL = originalDatabaseUrl;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalNodeEnv;
  if (pool) await pool.end();
  if (redis.isOpen) { for await (const key of redis.scanIterator({ MATCH: `${namespace}:*` })) await redis.del(key); let remaining = 0; for await (const key of redis.scanIterator({ MATCH: `${namespace}:*` })) remaining += 1; assert.equal(remaining, 0); await redis.quit(); }
  if (created) { await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`); assert.equal(Number((await admin.query('SELECT count(*)::int AS n FROM pg_database WHERE datname=$1', [databaseName])).rows[0].n), 0); }
  await admin.end();
  await rm(packageRoot, { recursive: true, force: true });
  await assert.rejects(stat(packageRoot), { code: 'ENOENT' });
  console.log(JSON.stringify({ workPackage: 'V1-IDENTITY-r12', cleanup: 'passed', databaseDropped: created, redisPrefixRemoved: true, packageRootRemoved: true }));
}
