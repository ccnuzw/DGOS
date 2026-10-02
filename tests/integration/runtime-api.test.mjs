import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { buildServer } from '../../apps/api/src/server.mjs';
import { InMemoryIdentityRepository } from '../../src/identity/repository.mjs';
import { InMemoryPermissionRepository } from '../../src/permissions/repository.mjs';
import { InMemoryActionRepository } from '../../src/actions/repository.mjs';
import { InMemorySystemRepository } from '../../src/system/repository.mjs';
import { InMemoryAuditRepository } from '../../src/audit/outbox.mjs';
import { DiskPackageStore, canonicalJson } from '../../src/apps/package-service.mjs';
import { discoverMigrations, buildMigrationSql } from '../../scripts/migrate.mjs';

const digest = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const fixture = () => {
  const appId = `com.example.runtime${randomUUID().replaceAll('-', '')}`;
  const keyId = `runtime-${randomUUID()}`;
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const manifest = {
    format: 'dgos-app/v1', appId, version: '1.0.0', build: 1,
    releaseChannel: 'stable', minRuntimeVersion: '1.0.0', dataVersion: 1,
    name: { 'zh-CN': '运行时测试', 'en-US': 'Runtime test' },
    description: { 'zh-CN': '运行时测试', 'en-US': 'Runtime test' },
    category: 'productivity', icon: 'icon.svg', defaultWindow: { width: 800, height: 600 },
    entrypoints: { web: 'index.html' }, permissions: ['settings.write'],
    capabilityAllowlist: ['settings.write'], trustLevel: 'standard',
    uninstallPolicy: 'user-removable', backgroundPolicy: 'release',
  };
  const resources = { 'index.html': Buffer.from('<html>Runtime</html>'), 'icon.svg': Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') };
  const files = Object.fromEntries(Object.entries(resources).map(([path, bytes]) => [path, bytes.toString('base64')]));
  const resourceDigests = Object.fromEntries(Object.entries(resources).map(([path, bytes]) => [path, digest(bytes)]));
  const envelope = { manifest, files, resourceDigests, keyId, signature: sign(null, Buffer.from(canonicalJson({ manifest, resourceDigests })), privateKey).toString('base64') };
  return { appId, envelope, trustRoots: new Map([[keyId, { source: 'developer', publicKey }]]) };
};

const auth = async (app) => {
  const response = await app.inject({ method: 'POST', url: '/api/v1/identity/admin/bootstrap', payload: { displayName: 'Runtime', credential: 'runtime-secret' } });
  assert.equal(response.statusCode, 201, response.body);
  return response.json().sessionId;
};
const sessionHeaders = (session) => ({ authorization: `Bearer ${session}`, cookie: `dgos_session=${session}` });
const buildInMemoryServer = (options) => {
  const databaseUrl = process.env.DGOS_DATABASE_URL;
  delete process.env.DGOS_DATABASE_URL;
  try { return buildServer(options); }
  finally { if (databaseUrl === undefined) delete process.env.DGOS_DATABASE_URL; else process.env.DGOS_DATABASE_URL = databaseUrl; }
};
const reviewAndInstall = async (app, appId, headers) => {
  const release = { version: '1.0.0', build: 1, releaseChannel: 'stable' };
  const review = await app.inject({ method: 'POST', url: `/api/v1/apps/${appId}/approve`, headers, payload: { ...release, baseVersion: 1 } });
  assert.equal(review.statusCode, 200, review.body);
  const install = await app.inject({ method: 'POST', url: `/api/v1/apps/${appId}/install`, headers, payload: release });
  assert.equal(install.statusCode, 200, install.body);
};

test('Fastify runtime API enforces CSRF, catalog visibility and settings concurrency', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-runtime-api-'));
  const signed = fixture();
  const permissionRepository = new InMemoryPermissionRepository();
  const app = buildInMemoryServer({
    logger: false, repository: new InMemoryIdentityRepository(), auditRepository: new InMemoryAuditRepository(),
    permissionRepository, actionRepository: new InMemoryActionRepository(), systemRepository: new InMemorySystemRepository(),
    packageOptions: { store: new DiskPackageStore(dir), trustRoots: signed.trustRoots },
  });
  permissionRepository.declaredCapabilities = async ({ subjectId, appId }) => {
    const deployment = await app.packages.repository.getDeployment(subjectId, appId);
    if (deployment?.state !== 'active') return [];
    const release = await app.packages.repository.getPackageById(deployment.packageId);
    if (!release || !['official', 'approved'].includes(release.catalogState)) return [];
    return release.manifest.permissions.filter((capability) => release.manifest.capabilityAllowlist.includes(capability));
  };
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const session = await auth(app);
  const headers = sessionHeaders(session);
  const writeHeaders = { ...headers, 'x-dgos-csrf': 'test' };
  const submit = await app.inject({ method: 'POST', url: '/api/v1/apps', headers, payload: signed.envelope });
  assert.equal(submit.statusCode, 403);
  const submitted = await app.inject({ method: 'POST', url: '/api/v1/apps', headers: writeHeaders, payload: signed.envelope });
  assert.equal(submitted.statusCode, 201, submitted.body);
  const listed = await app.inject({ method: 'GET', url: '/api/v1/apps', headers });
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.json().items.length, 0);
  const beforeInstall = await app.inject({ method: 'POST', url: '/api/v1/permissions/check', headers, payload: { appId: signed.appId, capability: 'settings.write', declared: ['settings.write'] } });
  assert.equal(beforeInstall.statusCode, 200);
  assert.equal(beforeInstall.json().decision, 'deny');
  await reviewAndInstall(app, signed.appId, writeHeaders);
  const publicList = await app.inject({ method: 'GET', url: '/api/v1/apps', headers });
  assert.equal(publicList.json().items.length, 1);
  const settings = await app.inject({ method: 'GET', url: '/api/v1/system/settings', headers });
  assert.equal(settings.statusCode, 200);
  assert.equal(settings.json().appearance.appearanceMode, 'system');
  const context = await app.inject({ method: 'GET', url: '/api/v1/system/context', headers });
  assert.equal(context.statusCode, 200);
  assert.equal(context.json().appId, 'dgos.system');
  const stale = await app.inject({ method: 'PATCH', url: '/api/v1/system/settings', headers: writeHeaders, payload: { requestId: randomUUID(), baseVersion: '999', domain: 'locale', patch: { uiLocale: 'zh-CN' } } });
  assert.equal(stale.statusCode, 409);
  const invalid = await app.inject({ method: 'PATCH', url: '/api/v1/system/settings', headers: writeHeaders, payload: { requestId: randomUUID(), baseVersion: settings.json().settingsVersion, domain: 'locale', patch: { uiLocale: 3 } } });
  assert.equal(invalid.statusCode, 422);
  const undeclared = await app.inject({ method: 'POST', url: '/api/v1/permissions/check', headers, payload: { appId: signed.appId, capability: 'files.write', declared: ['files.write'] } });
  assert.equal(undeclared.statusCode, 200);
  assert.equal(undeclared.json().decision, 'deny');
  const ask = await app.inject({ method: 'POST', url: '/api/v1/permissions/request', headers: writeHeaders, payload: { appId: signed.appId, capability: 'settings.write', declared: ['settings.write'], requestId: randomUUID() } });
  assert.equal(ask.statusCode, 202, ask.body);
  assert.equal(ask.json().decision, 'ask');
  assert.equal(ask.json().confirmationRequired, true);
  const denied = await app.inject({ method: 'PATCH', url: '/api/v1/permissions', headers: writeHeaders, payload: { requestId: ask.json().requestId, decision: 'deny' } });
  assert.equal(denied.statusCode, 200, denied.body);
  assert.equal(denied.json().decision, 'deny');
  const actions = await app.inject({ method: 'GET', url: '/api/v1/actions', headers });
  assert.equal(actions.statusCode, 200);
  assert.ok(Array.isArray(actions.json().items));
});

test('Fastify runtime API isolates API key subject fields', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-runtime-key-'));
  const app = buildInMemoryServer({ logger: false, repository: new InMemoryIdentityRepository(), auditRepository: new InMemoryAuditRepository(), permissionRepository: new InMemoryPermissionRepository(), actionRepository: new InMemoryActionRepository(), systemRepository: new InMemorySystemRepository(), packageOptions: { store: new DiskPackageStore(dir), trustRoots: new Map() } });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const session = await auth(app);
  const headers = { ...sessionHeaders(session), 'x-dgos-csrf': 'test' };
  const key = await app.inject({ method: 'POST', url: '/api/v1/secret/api-keys', headers, payload: { name: 'runtime', scopes: ['permission.read'] } });
  assert.equal(key.statusCode, 201, key.body);
  const denied = await app.inject({ method: 'POST', url: '/api/v1/permissions/check', headers: { authorization: `ApiKey ${key.json().secret}` }, payload: { subjectId: 'other', appId: 'com.example.api', capability: 'settings.write', declared: ['settings.write'] } });
  assert.equal(denied.statusCode, 403);
});

const allowedParentDatabase = () => {
  try { return /^(?:dgos_v1_actions|dgos_v1_integrated|dgos_v1_verify_[0-9a-f]{32})$/.test(new URL(process.env.DGOS_DATABASE_URL).pathname.slice(1)); }
  catch { return false; }
};

test('Fastify runtime API uses PostgreSQL repositories across server restart', { skip: !process.env.DGOS_DATABASE_URL }, async (t) => {
  if (!allowedParentDatabase()) throw new Error('runtime_test_requires_isolated_v1_database');
  const parentUrl = process.env.DGOS_DATABASE_URL;
  const name = `dgos_v1_runtime_${randomUUID().replaceAll('-', '')}`;
  const childUrl = new URL(parentUrl);
  childUrl.pathname = `/${name}`;
  const admin = new pg.Pool({ connectionString: parentUrl });
  const dir = await mkdtemp(join(tmpdir(), 'dgos-runtime-pg-'));
  const signed = fixture();
  let created = false;
  let app1;
  let app2;
  t.after(async () => {
    await app2?.close();
    await app1?.close();
    process.env.DGOS_DATABASE_URL = parentUrl;
    if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
    await rm(dir, { recursive: true, force: true });
  });
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  const setup = new pg.Pool({ connectionString: childUrl.toString() });
  try { await setup.query(buildMigrationSql(await discoverMigrations())); }
  finally { await setup.end(); }
  process.env.DGOS_DATABASE_URL = childUrl.toString();
  const packageOptions = { store: new DiskPackageStore(dir), trustRoots: signed.trustRoots };
  app1 = buildServer({ logger: false, closeDatabasePools: true, packageOptions });
  const session = await auth(app1);
  const headers = { ...sessionHeaders(session), 'x-dgos-csrf': 'test' };
  const submit = await app1.inject({ method: 'POST', url: '/api/v1/apps', headers, payload: signed.envelope });
  assert.equal(submit.statusCode, 201, submit.body);
  await reviewAndInstall(app1, signed.appId, headers);
  const ask = await app1.inject({ method: 'POST', url: '/api/v1/permissions/request', headers, payload: { appId: signed.appId, capability: 'settings.write', requestId: randomUUID() } });
  assert.equal(ask.statusCode, 202, ask.body);
  assert.equal(ask.json().decision, 'ask');
  const settings = await app1.inject({ method: 'GET', url: '/api/v1/system/settings', headers });
  assert.equal(settings.statusCode, 200, settings.body);
  const patched = await app1.inject({ method: 'PATCH', url: '/api/v1/system/settings', headers, payload: { requestId: randomUUID(), baseVersion: settings.json().settingsVersion, domain: 'locale', patch: { uiLocale: 'zh-CN' } } });
  assert.equal(patched.statusCode, 200, patched.body);
  await app1.close();
  app1 = null;
  app2 = buildServer({ logger: false, closeDatabasePools: true, packageOptions });
  const list = await app2.inject({ method: 'GET', url: '/api/v1/apps', headers });
  assert.equal(list.statusCode, 200, list.body);
  assert.ok(list.json().items.some((item) => item.appId === signed.appId));
  const deployment = await app2.inject({ method: 'GET', url: `/api/v1/apps/${signed.appId}/deployment`, headers });
  assert.equal(deployment.statusCode, 200, deployment.body);
  assert.equal(deployment.json().state, 'active');
  const context = await app2.inject({ method: 'GET', url: '/api/v1/system/context', headers });
  assert.equal(context.statusCode, 200, context.body);
  assert.equal(context.json().locale.uiLocale, 'zh-CN');
});
