import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from '../apps/api/node_modules/pg/lib/index.js';
import { buildServer } from '../apps/api/src/server.mjs';
import { createPostgresWorker } from '../apps/worker/src/worker.mjs';
import { browserHealthProbe } from '../src/apps/browser-health-probe.mjs';
import { canonicalJson, DiskPackageStore } from '../src/apps/package-service.mjs';
import { InMemorySecretService } from '../src/security/secret-service.mjs';
import { createRuntimeEgress } from '../src/security/runtime-egress.mjs';
import { createOpenAiCompatibleFixture } from '../test-support/openai-compatible-fixture.mjs';
import { buildMigrationSql, discoverMigrations } from './migrate.mjs';
import { sourceIdentity } from './verify-release.mjs';

const adminUrl = new URL(process.env.DGOS_PACKAGE_HTTP_ADMIN_DATABASE_URL ?? 'postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_packages');
if (adminUrl.hostname !== '127.0.0.1' || adminUrl.port !== '5432' || adminUrl.pathname !== '/dgos_v1_packages') throw new Error('dedicated_packages_admin_database_required');
const suffix = randomUUID().replaceAll('-', '');
const database = `dgos_v1_package_http_${suffix}`;
const childUrl = new URL(adminUrl); childUrl.pathname = `/${database}`;
const port = Number(process.env.DGOS_PACKAGE_HTTP_PORT ?? 15161);
if (!Number.isInteger(port) || port < 15161 || port > 15169) throw new Error('package_http_port_out_of_range');
const root = await mkdtemp(join(tmpdir(), 'dgos-package-http-'));
const runId = `V1-package-http-${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${suffix.slice(0, 8)}`;
const evidenceDir = join('.herdr', 'state', 'package-http-evidence', runId);
const store = new DiskPackageStore(root);
const admin = new pg.Pool({ connectionString: adminUrl.href });
const fixture = createOpenAiCompatibleFixture({ responseText: 'retained artifact content' });
const secretService = new InMemorySecretService();
const sha = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const cases = [];
const mark = (name, detail = {}) => { cases.push({ name, result: 'passed', ...detail }); record('case_passed', { name, ...detail }); console.log(`PASS ${name}`); };
const keys = Object.fromEntries(['official', 'admin', 'developer'].map((source) => [source, generateKeyPairSync('ed25519')]));
const trustRoots = new Map(Object.entries(keys).map(([source, pair]) => [source, { source, publicKey: pair.publicKey, allowProtectedPreinstall: source === 'official' }]));
const id = (kind) => `com.example.http${kind}${suffix.slice(0, 12)}`;
const apps = { official: id('official'), protected: id('protected'), approved: id('approved'), pending: id('pending'), rejected: id('rejected'), context: id('context') };
let pool, api, workerRuntime, created = false, priorDatabaseUrl, priorFixtureUrl, priorFixtureFlag;
let phase = 'preflight';
let subjectId, sessionId;
let sourceBefore, sourceAfter, failure, migrationCount;
const cleanup = { api: 'not_started', worker: 'not_started', pool: 'not_started', database: 'not_created', root: 'pending', fixture: 'not_started' };
const startedAt = new Date().toISOString();
const assetPaths = ['scripts/v1-package-http.mjs', 'apps/api/src/server.mjs', 'apps/worker/src/worker.mjs', 'src/apps/package-service.mjs', 'src/ai-task/service.mjs', 'src/ai-task/repository.mjs', 'test-support/openai-compatible-fixture.mjs'];
const assetHashes = async () => Object.fromEntries(await Promise.all(assetPaths.map(async (path) => [path, sha(await readFile(path))])));
const frozenNewMigrations = new Map([
  ['0049-extension-management', 'ba0bc80a0ccc74e05a5244b50e52e6a26df39ad854995ba038020b7d5d954f1b'],
  ['0050-session-management', '8802fe3a02b0bf7364aeac96215da09454d0c53b48c06d2cb76c6f3d6b455d85'],
  ['0051-proxy-provisioning', '778fddef654d67bc3ecfc01e11fd91f826f91d68a5b6c5c72568b5e35cca1939'],
]);
const log = [];
const record = (event, detail = {}) => log.push({ at: new Date().toISOString(), event, ...detail });

const manifest = (appId, { version = '1.0.0', build = 1, channel = 'stable', protectedPreinstall = false, capabilities = [] } = {}) => ({
  format: 'dgos-app/v1', appId, version, build, releaseChannel: channel, minRuntimeVersion: '1.0.0', dataVersion: 1,
  name: { 'zh-CN': 'HTTP 验证', 'en-US': 'HTTP fixture' }, description: { 'zh-CN': '包生命周期验证', 'en-US': 'Package lifecycle fixture' },
  category: 'productivity', icon: 'icon.svg', defaultWindow: { width: 800, height: 600 }, entrypoints: { web: 'index.html' },
  permissions: capabilities, capabilityAllowlist: capabilities, trustLevel: 'standard', uninstallPolicy: protectedPreinstall ? 'protected-preinstall' : 'user-removable', backgroundPolicy: 'release',
});
const envelope = (app, source, { healthy = true, ...options } = {}) => {
  const html = Buffer.from(`<html><body><output id="status">${healthy ? 'Ready' : 'Broken'}</output></body></html>`);
  const icon = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
  const files = { 'index.html': html.toString('base64'), 'icon.svg': icon.toString('base64') };
  const resourceDigests = { 'index.html': sha(html), 'icon.svg': sha(icon) };
  const m = manifest(app, options);
  return { requestId: randomUUID(), manifest: m, files, resourceDigests, keyId: source, signature: sign(null, Buffer.from(canonicalJson({ manifest: m, resourceDigests })), keys[source].privateKey).toString('base64') };
};
const http = async (path, { method = 'GET', body, status = 200, auth = sessionId } = {}) => {
  const response = await fetch(`http://127.0.0.1:${port}/api/v1${path}`, { method, headers: { 'x-request-id': randomUUID(), ...(auth ? { authorization: `Bearer ${auth}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20_000) });
  const raw = await response.text();
  let value; try { value = raw ? JSON.parse(raw) : null; } catch { value = raw; }
  assert.equal(response.status, status, `${method} ${path}: HTTP ${response.status}, expected ${status}, errorKey=${value?.errorKey ?? 'none'}`);
  return value;
};
const submit = (env) => http('/apps', { method: 'POST', body: env, status: 201 });
const lifecycle = (appId, action, body, status = 200) => http(`/apps/${appId}/${action}`, { method: 'POST', body: { requestId: randomUUID(), ...body }, status });
const deployment = (appId) => http(`/apps/${appId}/deployment`);
const auditRows = (action, appId) => pool.query("SELECT e.event_id,o.published_at,e.summary FROM audit_events e JOIN audit_outbox o ON o.event_id=e.event_id WHERE e.action=$1 AND e.summary->>'appId'=$2", [action, appId]);
const contextCaps = ['dgos.system.context.read', 'dgos.system.context.events'];
const decide = (appId, capability, decision) => http('/permissions', { method: 'PATCH', body: { requestId: randomUUID(), appId, capability, scope: '*', decision } });
const bridge = (appId, instanceId, capability, input, status = 200, requestId = randomUUID()) => http(`/apps/${appId}/bridge`, { method: 'POST', body: { instanceId, requestId, capability, input }, status });
const artifactReceipt = async (artifactId, taskId, expected, label) => {
  const artifact = await http(`/artifacts/${artifactId}`);
  assert.ok(artifact.artifactId === expected.artifactId && artifact.mimeType === expected.mimeType && artifact.content === expected.content, 'artifact_public_projection_changed');
  const stored = (await pool.query('SELECT owner_id,task_id,content FROM artifacts WHERE artifact_id=$1', [artifactId])).rows[0];
  assert.ok(stored?.owner_id === subjectId && stored.task_id === taskId && stored.content === expected.content, 'artifact_owner_task_or_content_changed');
  assert.equal((await http(`/artifacts/${artifactId}`, { auth: null, status: 401 })).errorKey, 'session_invalid');
  record('artifact_unchanged', { label, artifactId, contentSha256: sha(artifact.content) });
};

try {
  sourceBefore = await sourceIdentity();
  record('source_before', sourceBefore);
  await admin.query(`CREATE DATABASE "${database}"`); created = true;
  pool = new pg.Pool({ connectionString: childUrl.href });
  const discovered = await discoverMigrations();
  for (const [version, checksum] of frozenNewMigrations) assert.equal(discovered.find((item) => item.version === version)?.checksum, checksum, `migration_not_frozen:${version}`);
  assert.ok(discovered.every(({ version }) => Number(version.slice(0, 4)) < 49 || Number(version.slice(0, 4)) > 51 || frozenNewMigrations.has(version)), 'unexpected_migration_0049_0051');
  const migrations = discovered.filter(({ version }) => Number(version.slice(0, 4)) <= 48 || frozenNewMigrations.has(version));
  migrationCount = migrations.length;
  await pool.query(buildMigrationSql(migrations));
  mark('isolated_database_frozen_migrations', { database, migrationCount: migrations.length, frozenNewMigrations: Object.fromEntries(frozenNewMigrations) });

  priorDatabaseUrl = process.env.DGOS_DATABASE_URL;
  priorFixtureUrl = process.env.DGOS_FIXTURE_BASE_URL;
  priorFixtureFlag = process.env.DGOS_ALLOW_INSECURE_FIXTURE;
  process.env.DGOS_DATABASE_URL = childUrl.href;
  const upstream = await fixture.start();
  process.env.DGOS_FIXTURE_BASE_URL = upstream.baseUrl;
  process.env.DGOS_ALLOW_INSECURE_FIXTURE = '1';
  api = buildServer({ logger: false, closeDatabasePools: true, secretService, providerEgress: createRuntimeEgress(), packageOptions: { store, trustRoots, healthProbe: browserHealthProbe } });
  await api.listen({ host: '127.0.0.1', port });
  workerRuntime = createPostgresWorker({ pool, secretService });
  await workerRuntime.actionRuntime.ready;
  await workerRuntime.actionRuntime.system.activateNetworkRoute(workerRuntime.networkRoute, { role: 'worker', instanceId: workerRuntime.worker.workerId });
  assert.equal((await fetch(`http://127.0.0.1:${port}/ready`)).status, 200);
  mark('public_api_ready', { port });

  phase = 'catalog';
  const boot = await http('/identity/admin/bootstrap', { method: 'POST', body: { displayName: 'Package HTTP', credential: `fixture-${randomUUID()}` }, status: 201, auth: null });
  subjectId = boot.principalId; sessionId = boot.sessionId;
  const official = await submit(envelope(apps.official, 'official'));
  const protectedRelease = await submit(envelope(apps.protected, 'official', { protectedPreinstall: true }));
  const approved = await submit(envelope(apps.approved, 'admin'));
  const pending = await submit(envelope(apps.pending, 'developer'));
  const rejected = await submit(envelope(apps.rejected, 'developer'));
  assert.equal(official.source, 'official'); assert.equal(protectedRelease.uninstallPolicy, 'protected-preinstall');
  assert.equal(approved.catalogState, 'pending_review'); assert.equal(pending.catalogState, 'pending_review');
  await lifecycle(apps.approved, 'approve', { version: '1.0.0', build: 1, releaseChannel: 'stable', baseVersion: 1, reason: 'fixture approval' });
  await lifecycle(apps.rejected, 'reject', { version: '1.0.0', build: 1, releaseChannel: 'stable', baseVersion: 1, reason: 'fixture rejection' });
  const publicCatalog = await http('/apps');
  const ids = new Set(publicCatalog.items.map((item) => item.appId));
  for (const appId of [apps.official, apps.protected, apps.approved]) assert.ok(ids.has(appId));
  for (const appId of [apps.pending, apps.rejected]) assert.ok(!ids.has(appId));
  mark('five_catalog_origins_and_review_visibility');

  phase = 'input_boundary';
  const deniedApp = id('denied');
  const catalogBefore = (await pool.query('SELECT count(*)::int AS n FROM app_package_releases')).rows[0].n;
  const stageBefore = (await pool.query('SELECT count(*)::int AS n FROM app_package_stage_candidates')).rows[0].n;
  for (const override of [{ locked: true }, { actorId: randomUUID() }, { subjectId: randomUUID() }, { developerTest: true }, { source: 'official' }]) {
    assert.equal((await http('/apps', { method: 'POST', body: { ...envelope(deniedApp, 'official'), ...override }, status: 422 })).errorKey, 'invalid_request');
  }
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM app_package_releases')).rows[0].n, catalogBefore);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM app_package_stage_candidates')).rows[0].n, stageBefore);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM app_package_releases WHERE app_id=$1', [deniedApp])).rows[0].n, 0);
  assert.equal((await auditRows('app.package.submit', deniedApp)).rowCount, 0);
  const deniedOperationBefore = (await pool.query('SELECT count(*)::int AS n FROM app_package_operations WHERE app_id=$1', [apps.pending])).rows[0].n;
  for (const action of ['install', 'test-install', 'update']) {
    for (const override of [{ locked: true }, { actorId: randomUUID() }, { subjectId: randomUUID() }, { developerTest: true }]) {
      assert.equal((await lifecycle(apps.pending, action, { version: '1.0.0', build: 1, releaseChannel: 'stable', ...override }, 422)).errorKey, 'invalid_request');
    }
  }
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM app_package_operations WHERE app_id=$1', [apps.pending])).rows[0].n, deniedOperationBefore);
  assert.equal((await http(`/apps/${apps.pending}/deployment`, { status: 404 })).errorKey, 'app_not_installed');
  mark('public_input_overrides_denied_without_side_effects');

  phase = 'lifecycle';
  assert.equal((await lifecycle(apps.pending, 'install', { version: '1.0.0', build: 1, releaseChannel: 'stable' }, 404)).errorKey, 'app_not_available');
  assert.equal((await lifecycle(apps.rejected, 'install', { version: '1.0.0', build: 1, releaseChannel: 'stable' }, 404)).errorKey, 'app_not_available');
  assert.equal((await http(`/apps/${apps.pending}/deployment`, { status: 404 })).errorKey, 'app_not_installed');
  const testInstall = await lifecycle(apps.pending, 'test-install', { version: '1.0.0', build: 1, releaseChannel: 'stable' });
  assert.equal(testInstall.state, 'active');
  for (const appId of [apps.official, apps.protected, apps.approved]) assert.equal((await lifecycle(appId, 'install', { version: '1.0.0', build: 1, releaseChannel: 'stable' })).state, 'active');
  const first = await deployment(apps.official);
  assert.equal(first.activeRelease.digest, official.digest);
  const launch = await lifecycle(apps.official, 'launch');
  const resource = await fetch(`http://127.0.0.1:${port}${launch.entrypoint}`, { signal: AbortSignal.timeout(10000) });
  assert.equal(resource.status, 200); assert.match(await resource.text(), /Ready/);
  assert.equal((await http(`/apps/${apps.official}/health`)).healthy, true);
  const rejectedUninstall = await lifecycle(apps.protected, 'uninstall', { baseVersion: (await deployment(apps.protected)).versionNumber }, 403);
  assert.equal(rejectedUninstall.errorKey, 'app_uninstall_forbidden');
  assert.equal((await deployment(apps.protected)).state, 'active');
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM app_package_operations WHERE app_id=$1 AND action='uninstall' AND state='rejected'", [apps.protected])).rows[0].n, 1);
  assert.equal((await auditRows('app.uninstall.rejected', apps.protected)).rowCount, 1);
  assert.equal((await auditRows('app.install.rejected', apps.pending)).rowCount, 1);
  assert.equal((await auditRows('app.install', apps.official)).rowCount, 1);
  assert.equal((await auditRows('app.catalog.approved', apps.approved)).rowCount, 1);
  mark('public_install_test_install_launch_health_and_protected_uninstall');

  phase = 'artifact_fixture';
  const account = await http('/provider/accounts', { method: 'POST', status: 201, body: { requestId: randomUUID(), protocolType: 'openai-compatible', displayName: 'Package artifact fixture', credential: fixture.token, scope: { endpoint: 'https://fixture.test/v1' } } });
  const probe = await http('/provider/connection-tests', { method: 'POST', status: 202, body: { requestId: randomUUID(), accountId: account.accountId, accountVersion: account.version, protocolVersion: 'v1' } });
  await workerRuntime.providerTestWorker.runOnce();
  assert.equal((await http(`/provider/connection-tests/${probe.testId}`)).status, 'succeeded');
  const readyAccount = await http(`/provider/accounts/${account.accountId}/state`, { method: 'POST', body: { requestId: randomUUID(), baseVersion: account.version, connectionTestId: probe.testId, state: 'ready' } });
  assert.equal(readyAccount.status, 'ready');
  const config = await http('/provider/configs', { method: 'POST', status: 201, body: { requestId: randomUUID(), providerAccountId: account.accountId, protocolType: 'openai-compatible', displayName: 'Package artifact fixture', baseUrl: 'https://fixture.test/v1' } });
  const configId = config.providerConfigId;
  assert.equal((await http(`/provider/configs/${configId}/validate`, { method: 'POST', body: { requestId: randomUUID() } })).provider.status, 'ready');
  const catalog = await http(`/provider/configs/${configId}/models`, { method: 'POST', body: { requestId: randomUUID() } });
  assert.ok(catalog.items.some((item) => item.modelId === fixture.model));
  assert.equal((await http(`/provider/configs/${configId}/model-policies`, { method: 'POST', body: { requestId: randomUUID(), modelId: fixture.model, enabled: true, assignedCapabilities: ['text'], defaultFor: [], baseVersion: '0' } })).enabled, true);
  const quotaPolicy = await http('/quota/policies', { method: 'PUT', body: { requestId: randomUUID(), metric: 'requests', scopeType: 'subject', scopeId: subjectId, hardLimit: 10, softLimit: 9, windowSeconds: 3600, effectiveAt: new Date().toISOString() } });
  assert.ok(quotaPolicy.version);
  assert.equal((await http('/quota/preflight', { method: 'POST', body: { requestId: randomUUID(), subjectId, intent: 'text.chat', metric: 'requests', amount: 1 } })).decision, 'allow');
  const task = await http('/ai-tasks', { method: 'POST', status: 202, body: { requestId: randomUUID(), target: 'text', intent: 'text.chat', input: { text: 'package artifact retention' }, options: { providerConfigId: configId, modelId: fixture.model } } });
  await workerRuntime.worker.runOnce();
  const completed = await http(`/ai-tasks/${task.taskId}`);
  assert.equal(completed.status, 'succeeded');
  assert.equal(completed.artifactIds.length, 1);
  const artifactId = completed.artifactIds[0];
  const artifact = await http(`/artifacts/${artifactId}`);
  assert.equal(artifact.content, 'retained artifact content');
  await artifactReceipt(artifactId, task.taskId, artifact, 'installed');
  mark('public_provider_task_artifact_fixture', { artifactId, taskId: task.taskId, contentSha256: sha(artifact.content) });

  phase = 'update';
  const data = { project: { text: 'retained' } };
  await store.writeData(subjectId, apps.official, data);
  const v2 = await submit(envelope(apps.official, 'official', { version: '1.0.1', build: 2 }));
  const beta = await submit(envelope(apps.official, 'official', { version: '1.0.1', build: 2, channel: 'beta' }));
  assert.notEqual(beta.digest, v2.digest);
  assert.equal((await http(`/apps/${apps.official}?version=1.0.1&build=2&releaseChannel=beta`)).digest, beta.digest);
  assert.notEqual(v2.digest, official.digest);
  const originalWithAppLock = api.packages.repository.withAppLock.bind(api.packages.repository);
  let activeAppLocks = 0; let maxAppLocks = 0; let acquiredAppLocks = 0;
  api.packages.repository.withAppLock = (appId, work) => originalWithAppLock(appId, async () => {
    acquiredAppLocks += 1; activeAppLocks += 1; maxAppLocks = Math.max(maxAppLocks, activeAppLocks);
    try { await new Promise((resolve) => setTimeout(resolve, 25)); return await work(); }
    finally { activeAppLocks -= 1; }
  });
  let updated;
  try {
    const concurrent = await Promise.all([1, 2].map(() => lifecycle(apps.official, 'update', { version: '1.0.1', build: 2, releaseChannel: 'stable', baseVersion: first.versionNumber })));
    assert.equal(concurrent[0].digest, v2.digest);
    assert.equal(concurrent[1].digest, v2.digest);
    assert.equal(concurrent[0].versionNumber, concurrent[1].versionNumber);
    assert.equal(acquiredAppLocks, 2);
    assert.equal(maxAppLocks, 1);
    updated = concurrent[0];
  } finally { api.packages.repository.withAppLock = originalWithAppLock; }
  assert.equal((await deployment(apps.official)).versionNumber, first.versionNumber + 1);
  assert.equal((await pool.query("SELECT count(DISTINCT request_id)::int AS n FROM app_package_operations WHERE app_id=$1 AND action='install' AND state='active' AND package_digest=$2", [apps.official, v2.digest])).rows[0].n, 1);
  assert.equal(updated.digest, v2.digest);
  assert.deepEqual(await store.readData(subjectId, apps.official), data);
  await artifactReceipt(artifactId, task.taskId, artifact, 'updated');
  const damaged = await submit(envelope(apps.official, 'official', { version: '1.0.2', build: 3, healthy: false }));
  const failedUpdate = await lifecycle(apps.official, 'update', { version: '1.0.2', build: 3, releaseChannel: 'stable', baseVersion: updated.versionNumber }, 422);
  assert.equal(failedUpdate.errorKey, 'rollback_required');
  const after = await deployment(apps.official);
  assert.equal(after.activeRelease.digest, v2.digest); assert.equal(after.versionNumber, updated.versionNumber);
  assert.deepEqual(await store.readData(subjectId, apps.official), data);
  await artifactReceipt(artifactId, task.taskId, artifact, 'health_rollback');
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM app_package_operations WHERE app_id=$1 AND state='rolled_back' AND package_digest=$2", [apps.official, damaged.digest])).rows[0].n, 1);
  assert.equal((await auditRows('app.install.rollback', apps.official)).rowCount, 1);
  assert.equal((await http('/apps', { method: 'POST', body: envelope(apps.official, 'official', { version: '1.0.1', build: 2 }), status: 409 })).errorKey, 'version_conflict');
  mark('immutable_channel_update_and_browser_health_rollback', { oldDigest: v2.digest, rejectedDigest: damaged.digest });

  phase = 'recovery';
  const pointerPath = store.pointerFor(subjectId, apps.official);
  await rm(pointerPath);
  await api.close(); api = null;
  api = buildServer({ logger: false, closeDatabasePools: true, secretService, providerEgress: createRuntimeEgress(), packageOptions: { store, trustRoots, healthProbe: browserHealthProbe } });
  await api.listen({ host: '127.0.0.1', port });
  assert.equal((await deployment(apps.official)).activeRelease.digest, v2.digest);
  assert.equal((await store.current(subjectId, apps.official)).digest, v2.digest);
  await artifactReceipt(artifactId, task.taskId, artifact, 'restart_recovery');
  mark('restart_repairs_pointer_from_durable_deployment');

  phase = 'retention';
  const stagedAppId = id('staged');
  const stagedEnvelope = envelope(stagedAppId, 'developer');
  const originalAuditEvent = api.packages.repository.auditEvent.bind(api.packages.repository);
  api.packages.repository.auditEvent = async (event) => { if (event.action === 'app.package.submit' && event.appId === stagedAppId) throw new Error('staging_audit_fault'); return originalAuditEvent(event); };
  try { assert.equal((await http('/apps', { method: 'POST', body: stagedEnvelope, status: 500 })).errorKey, 'internal_error'); }
  finally { api.packages.repository.auditEvent = originalAuditEvent; }
  const stagedCandidate = (await pool.query("SELECT candidate_id,package_digest,manifest FROM app_package_stage_candidates WHERE app_id=$1 AND state='failed'", [stagedAppId])).rows[0];
  assert.ok(stagedCandidate);
  const stagedPath = store.pathFor(stagedCandidate.manifest, stagedCandidate.package_digest);
  assert.match(await readFile(join(stagedPath, 'index.html'), 'utf8'), /Ready/);
  assert.equal((await pool.query('SELECT 1 FROM app_package_releases WHERE app_id=$1', [stagedAppId])).rowCount, 0);
  await pool.query("UPDATE app_package_stage_candidates SET terminal_at=now()-interval '31 days' WHERE candidate_id=$1", [stagedCandidate.candidate_id]);
  const failedOperation = (await pool.query("SELECT operation_id FROM app_package_operations WHERE app_id=$1 AND state='rolled_back' AND package_digest=$2 ORDER BY occurred_at DESC LIMIT 1", [apps.official, damaged.digest])).rows[0].operation_id;
  await lifecycle(apps.official, 'launch');
  await pool.query("UPDATE app_package_operations SET occurred_at=now()-interval '31 days' WHERE operation_id=$1", [failedOperation]);
  const failureRequestId = (await pool.query('SELECT request_id FROM app_package_operations WHERE operation_id=$1', [failedOperation])).rows[0].request_id;
  await pool.query('UPDATE audit_outbox SET published_at=now() WHERE event_id IN (SELECT event_id FROM audit_events WHERE request_id=$1)', [failureRequestId]);
  const oldPreview = await http('/admin/governance/retention-preview');
  const driftJob = await http('/admin/governance/retention-sweeps', { method: 'POST', body: { requestId: randomUUID(), previewDigest: oldPreview.previewDigest }, status: 202 });
  const driftOperationId = randomUUID();
  await pool.query("INSERT INTO app_package_operations(operation_id,app_id,request_id,action,state,package_digest,occurred_at) VALUES($1,$2,$3,'install','rolled_back',$4,now()-interval '31 days')", [driftOperationId, id('drift'), randomUUID(), sha('drift')]);
  const drift = await http(`/admin/governance/retention-sweeps/${driftJob.jobId}/run`, { method: 'POST', body: { requestId: randomUUID(), previewDigest: oldPreview.previewDigest }, status: 409 });
  assert.equal(drift.errorKey, 'retention_preview_conflict');
  assert.equal((await pool.query('SELECT 1 FROM app_package_operations WHERE operation_id=$1', [failedOperation])).rowCount, 1);
  await pool.query('DELETE FROM app_package_operations WHERE operation_id=$1', [driftOperationId]);
  const preview = await http('/admin/governance/retention-preview');
  assert.ok(preview.packageRetention.failedInstall.eligibleCount >= 1, JSON.stringify(preview.packageRetention));
  assert.ok(preview.packageRetention.stagedPackage.eligibleCount >= 1, JSON.stringify(preview.packageRetention));
  assert.equal(typeof preview.previewDigest, 'string');
  const sweep = await http('/admin/governance/retention-sweeps', { method: 'POST', body: { requestId: randomUUID(), previewDigest: preview.previewDigest }, status: 202 });
  const result = await http(`/admin/governance/retention-sweeps/${sweep.jobId}/run`, { method: 'POST', body: { requestId: randomUUID(), previewDigest: preview.previewDigest } });
  assert.ok(result.deletedCount >= 1);
  assert.equal((await pool.query('SELECT 1 FROM app_package_operations WHERE operation_id=$1', [failedOperation])).rowCount, 0);
  assert.equal((await pool.query("SELECT state FROM app_package_stage_candidates WHERE candidate_id=$1", [stagedCandidate.candidate_id])).rows[0].state, 'cleaned');
  await assert.rejects(readFile(join(stagedPath, 'index.html')), { code: 'ENOENT' });
  mark('public_retention_drift_confirm_run_and_physical_stage_cleanup', { state: result.state, deletedCount: result.deletedCount });

  phase = 'uninstall';
  for (const appId of [apps.official, apps.approved, apps.pending]) {
    const current = await deployment(appId);
    const removed = await lifecycle(appId, 'uninstall', { baseVersion: current.versionNumber });
    assert.equal(removed.state, 'uninstalled'); assert.equal(removed.dataRetained, true);
  }
  assert.deepEqual(await store.readData(subjectId, apps.official), data);
  assert.equal((await deployment(apps.official)).activeRelease, null);
  await artifactReceipt(artifactId, task.taskId, artifact, 'uninstalled');
  mark('public_uninstall_keeps_data_and_history');

  phase = 'context_bridge';
  await submit(envelope(apps.context, 'official', { capabilities: contextCaps }));
  const contextInstall = await lifecycle(apps.context, 'install', { version: '1.0.0', build: 1, releaseChannel: 'stable' });
  for (const capability of contextCaps) assert.equal((await decide(apps.context, capability, 'allow')).decision, 'allow');
  const contextLaunch = await lifecycle(apps.context, 'launch');
  assert.deepEqual(contextLaunch.declaredCapabilities, contextCaps);
  const contextRow = await pool.query("SELECT scope_id,context_version,settings FROM system_settings ORDER BY scope_id LIMIT 1");
  assert.equal(contextRow.rowCount, 1);
  const scopeId = contextRow.rows[0].scope_id;
  const currentContextVersion = Number(contextRow.rows[0].context_version);
  assert.ok(Number.isSafeInteger(currentContextVersion) && currentContextVersion <= 10);
  await pool.query("UPDATE system_settings SET context_version=10,settings=jsonb_set(jsonb_set(settings,'{network,manualProxyRef}',to_jsonb('private-context-ref'::text),true),'{appPermissions}', $2::jsonb,true) WHERE scope_id=$1", [scopeId, JSON.stringify([{ appId: id('other'), subjectId: randomUUID(), decision: 'deny' }])]);
  const readRequestId = randomUUID();
  const read = await bridge(apps.context, contextLaunch.instanceId, contextCaps[0], {}, 200, readRequestId);
  assert.deepEqual(await bridge(apps.context, contextLaunch.instanceId, contextCaps[0], {}, 200, readRequestId), read);
  assert.equal(read.contextVersion, '10'); assert.equal(read.appId, apps.context); assert.equal(read.instanceId, contextLaunch.instanceId);
  assert.equal(read.appPermissions, undefined); assert.equal(read.networkSummary.manualProxyRef, undefined);
  assert.equal(JSON.stringify(read).includes('private-context-ref'), false);
  assert.equal(JSON.stringify(read).includes(id('other')), false);
  const afterNine = await bridge(apps.context, contextLaunch.instanceId, contextCaps[1], { cursor: '9' });
  assert.equal(afterNine.cursor, '10'); assert.equal(afterNine.reset, false); assert.equal(afterNine.items.length, 1);
  assert.equal(afterNine.items[0].instanceId, contextLaunch.instanceId);
  const atTen = await bridge(apps.context, contextLaunch.instanceId, contextCaps[1], { cursor: '10' });
  assert.equal(atTen.cursor, '10'); assert.deepEqual(atTen.items, []); assert.equal(atTen.reset, false);
  assert.equal((await bridge(apps.context, contextLaunch.instanceId, contextCaps[1], { cursor: '11' })).reset, true);
  assert.equal((await bridge(apps.context, contextLaunch.instanceId, contextCaps[0], { ownerId: randomUUID() }, 422)).errorKey, 'invalid_request');
  assert.equal((await bridge(apps.context, contextLaunch.instanceId, contextCaps[1], { cursor: '9', sessionId }, 422)).errorKey, 'invalid_request');
  mark('signed_context_bridge_projection_and_numeric_cursor');
  await decide(apps.context, contextCaps[0], 'deny');
  assert.equal((await bridge(apps.context, contextLaunch.instanceId, contextCaps[1], { cursor: '9' }, 403)).errorKey, 'permission_denied');
  await decide(apps.context, contextCaps[0], 'allow');
  const noRead = await submit(envelope(apps.context, 'official', { version: '1.0.1', build: 2, capabilities: [contextCaps[1]] }));
  const noReadInstall = await lifecycle(apps.context, 'update', { version: '1.0.1', build: 2, releaseChannel: 'stable', baseVersion: contextInstall.versionNumber });
  assert.equal(noReadInstall.digest, noRead.digest);
  assert.equal((await pool.query("SELECT decision FROM permission_decisions WHERE subject_id=$1 AND app_id=$2 AND capability=$3", [subjectId, apps.context, contextCaps[0]])).rows[0].decision, 'allow');
  const noReadLaunch = await lifecycle(apps.context, 'launch');
  assert.equal((await bridge(apps.context, noReadLaunch.instanceId, contextCaps[1], { cursor: '9' }, 403)).errorKey, 'permission_denied');
  assert.equal((await bridge(apps.context, noReadLaunch.instanceId, contextCaps[0], {}, 403)).errorKey, 'permission_denied');
  mark('events_requires_live_read_grant_and_signed_declaration');
} catch (error) {
  failure = { phase, name: error.name, message: String(error.message).replaceAll(/(?:https?:\/\/|postgresql?:\/\/)[^\s"']+/g, '<redacted-url>').slice(0, 500) };
  process.exitCode = 1;
} finally {
  const clean = async (name, action) => { try { await action(); cleanup[name] = 'completed'; } catch (error) { cleanup[name] = `failed:${error.code ?? error.name}`; process.exitCode = 1; } };
  if (api) await clean('api', () => api.close());
  if (workerRuntime) await clean('worker', async () => { await workerRuntime.actionRuntime.system.releaseNetworkRoute(workerRuntime.worker.workerId); workerRuntime.networkRoute.suspendLease?.(); });
  if (pool) await clean('pool', () => pool.end());
  if (created) await clean('database', () => admin.query(`DROP DATABASE "${database}"`));
  await admin.end().catch(() => { process.exitCode = 1; });
  await clean('fixture', () => fixture.close());
  await clean('root', () => rm(root, { recursive: true, force: true }));
  if (priorDatabaseUrl === undefined) delete process.env.DGOS_DATABASE_URL; else process.env.DGOS_DATABASE_URL = priorDatabaseUrl;
  if (priorFixtureUrl === undefined) delete process.env.DGOS_FIXTURE_BASE_URL; else process.env.DGOS_FIXTURE_BASE_URL = priorFixtureUrl;
  if (priorFixtureFlag === undefined) delete process.env.DGOS_ALLOW_INSECURE_FIXTURE; else process.env.DGOS_ALLOW_INSECURE_FIXTURE = priorFixtureFlag;
  try { sourceAfter = await sourceIdentity(); }
  catch (error) { failure ??= { phase: 'source_after', name: error.name, message: error.message }; process.exitCode = 1; }
  const sourceDrift = sourceBefore && sourceAfter ? JSON.stringify(sourceBefore) !== JSON.stringify(sourceAfter) : null;
  if (sourceDrift) process.exitCode = 1;
  const exitCode = process.exitCode ?? 0;
  record('cleanup', cleanup);
  const manifest = {
    schema: 'dgos/v1-package-http-evidence/v1', run_id: runId, command: 'node scripts/v1-package-http.mjs',
    environment: 'local random PostgreSQL database, 15161, temporary signed package root and local Provider fixture',
    started_at: startedAt, finished_at: new Date().toISOString(), working_directory: process.cwd(),
    source_identity_before: sourceBefore ?? null, source_identity_after: sourceAfter ?? null, source_drift: sourceDrift,
    asset_sha256: await assetHashes(), migrations: { count: migrationCount ?? null, maximum: '0051', frozenNewMigrations: Object.fromEntries(frozenNewMigrations) },
    exit_code: exitCode, result: exitCode === 0 ? 'passed' : 'failed', failure: failure ?? null,
    database: { name: database, cleanup: cleanup.database }, package_root_cleanup: cleanup.root, fixture_cleanup: cleanup.fixture,
    cleanup, cases, sanitization: 'No credentials, session tokens, private signing keys, ticket URLs, request bodies, or artifact text are logged.',
    limitations: ['Disposable local Provider fixture and Chromium package health probe; no production Provider/TLS guarantee.', 'Dirty concurrent main worktree is bound by before/after identity and asset hashes.'],
  };
  const reportPath = `${evidenceDir}.md`;
  const logPath = `${evidenceDir}.log.json`;
  const manifestPath = `${evidenceDir}-manifest.json`;
  const report = [`# ${runId}`, '', `- result: ${manifest.result}`, `- command: \`${manifest.command}\``, `- exit_code: ${exitCode}`, `- started_at: ${startedAt}`, `- finished_at: ${manifest.finished_at}`, `- source_before: \`${JSON.stringify(sourceBefore ?? null)}\``, `- source_after: \`${JSON.stringify(sourceAfter ?? null)}\``, `- source_drift: ${sourceDrift}`, `- database: ${database} (${cleanup.database})`, `- package_root_cleanup: ${cleanup.root}`, `- fixture_cleanup: ${cleanup.fixture}`, `- phases: ${cases.map((item) => item.name).join(', ')}`, `- artifact_checkpoints: ${log.filter((item) => item.event === 'artifact_unchanged').map((item) => item.label).join(', ')}`, `- failure: ${failure ? `${failure.phase}: ${failure.name} ${failure.message}` : 'none'}`, '', 'The signed package, Provider, Task and Artifact were created using public HTTP routes. Direct SQL was limited to the documented age/fault fixtures and ownership readback. Logs omit secrets, tickets, HTTP bodies and artifact text.', ''].join('\n');
  try {
    await mkdir(join('.herdr', 'state', 'package-http-evidence'), { recursive: true });
    await writeFile(reportPath, report);
    await writeFile(logPath, `${JSON.stringify(log, null, 2)}\n`);
    manifest.report_sha256 = sha(await readFile(reportPath));
    manifest.log_sha256 = sha(await readFile(logPath));
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(JSON.stringify({ result: manifest.result, exitCode, reportPath, manifestPath, logPath, database, cases: cases.length }));
  } catch (error) { console.error(JSON.stringify({ result: 'evidence_write_failed', error: error.code ?? error.name })); process.exitCode = 1; }
}
