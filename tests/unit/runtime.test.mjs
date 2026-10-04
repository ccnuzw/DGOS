import test from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, manifestDigest } from '../../src/apps/manifest-validator.mjs';
import { InMemoryAppRepository } from '../../src/apps/repository.mjs';
import { CatalogService } from '../../src/apps/catalog-service.mjs';
import { AppRuntimeService } from '../../src/apps/runtime-service.mjs';
import { InMemoryPermissionRepository } from '../../src/permissions/repository.mjs';
import { PermissionBroker } from '../../src/permissions/broker.mjs';
import { ActionRegistry } from '../../src/actions/registry.mjs';
import { ActionService } from '../../src/actions/service.mjs';
import { SystemService } from '../../src/system/service.mjs';
import { InMemorySystemRepository } from '../../src/system/repository.mjs';

const manifest = (overrides = {}) => ({ format: 'dgos-app/v1', appId: 'com.example.demo', version: '1.0.0', build: 1, releaseChannel: 'stable', minRuntimeVersion: '1.0.0', dataVersion: 1, name: { 'zh-CN': '示例', 'en-US': 'Example' }, description: { 'zh-CN': '测试应用', 'en-US': 'Test app' }, category: 'utilities', icon: 'icon.png', defaultWindow: { width: 800, height: 600 }, entrypoints: { web: 'index.html' }, permissions: ['settings.read'], capabilityAllowlist: ['settings.read'], trustLevel: 'standard', uninstallPolicy: 'user-removable', backgroundPolicy: 'release', ...overrides });
async function installedPermissions(capabilities) {
  const apps = new InMemoryAppRepository();
  const appId = 'com.example.demo'; const subjectId = 'u';
  await new CatalogService({ repository: apps }).submit({ manifest: manifest({ permissions: capabilities, capabilityAllowlist: capabilities }), catalogState: 'official' });
  await new AppRuntimeService({ repository: apps }).install({ subjectId, appId, version: '1.0.0', build: '1' });
  return { broker: new PermissionBroker({ repository: new InMemoryPermissionRepository({ appRepository: apps }) }), appId, subjectId };
}
test('manifest validation and digest', () => { assert.equal(validateManifest(manifest()).valid, true); assert.equal(validateManifest(manifest({ entrypoints: { web: '/tmp/x' } })).valid, false); assert.match(manifestDigest(manifest()), /^sha256:/); });
test('catalog visibility and developer test install', async () => { const repo = new InMemoryAppRepository(); const catalog = new CatalogService({ repository: repo }); await catalog.submit({ manifest: manifest(), catalogState: 'pending_review' }); assert.equal((await catalog.list()).items.length, 0); const runtime = new AppRuntimeService({ repository: repo }); const installed = await runtime.install({ subjectId: 'u', appId: 'com.example.demo', version: '1.0.0', build: '1', developerTest: true }); assert.equal(installed.state, 'active'); });
test('health failure rolls back to the active version and preserves data', async () => { const repo = new InMemoryAppRepository(); const catalog = new CatalogService({ repository: repo }); await catalog.submit({ manifest: manifest(), catalogState: 'official' }); await catalog.submit({ manifest: manifest({ version: '1.0.1', build: 2 }), catalogState: 'official' }); let healthy = true; const runtime = new AppRuntimeService({ repository: repo, healthCheck: async () => healthy }); await runtime.install({ subjectId: 'u', appId: 'com.example.demo', version: '1.0.0', build: '1' }); healthy = false; await assert.rejects(runtime.update({ subjectId: 'u', appId: 'com.example.demo', version: '1.0.1', build: '2' }), (error) => error.message === 'health_check_failed' && error.rollback?.activeVersion === '1.0.0'); const current = await repo.getInstall('u', 'com.example.demo'); assert.equal(current.state, 'rolled_back'); assert.equal(current.version, '1.0.0'); assert.equal(current.build, '1'); assert.equal(current.dataRetained, true); });
test('repeated install is idempotent and protected preinstall cannot be removed', async () => { const repo = new InMemoryAppRepository(); const catalog = new CatalogService({ repository: repo }); await catalog.submit({ manifest: manifest({ uninstallPolicy: 'protected-preinstall' }), catalogState: 'official' }); const runtime = new AppRuntimeService({ repository: repo }); const first = await runtime.install({ subjectId: 'u', appId: 'com.example.demo', version: '1.0.0', build: '1', requestId: 'install-1' }); const replay = await runtime.install({ subjectId: 'u', appId: 'com.example.demo', version: '1.0.0', build: '1', requestId: 'install-2' }); assert.equal(replay.version, first.version); assert.equal(replay.build, first.build); assert.equal(replay.state, first.state); assert.equal(replay.dataRetained, first.dataRetained); assert.equal((await repo.listInstalls('u')).length, 1); await assert.rejects(runtime.uninstall({ subjectId: 'u', appId: 'com.example.demo', requestId: 'uninstall-1' }), (error) => error.message === 'app_uninstall_forbidden'); assert.equal((await repo.getInstall('u', 'com.example.demo')).state, 'active'); });
test('permission deny precedence and revoke', async () => { const { broker, appId, subjectId } = await installedPermissions(['files.read']); await broker.decide({ subjectId, appId, capability: 'files.read', decision: 'allow' }); assert.equal((await broker.check({ subjectId, appId, capability: 'files.read' })).decision, 'allow'); await broker.decide({ subjectId, appId, capability: 'files.read', decision: 'deny' }); assert.equal((await broker.check({ subjectId, appId, capability: 'files.read' })).decision, 'deny'); });
test('permission request transitions are expiring, idempotent and race-safe', async () => {
  const { broker, appId, subjectId } = await installedPermissions(['files.read', 'files.write', 'network.read']);
  const base = { subjectId, appId, capability: 'files.read', requestId: 'req-1', ttlMs: 60_000 };
  await broker.request(base);
  const approved = await broker.approveRequest({ requestId: 'req-1' });
  assert.equal(approved.decision, 'allow');
  await assert.rejects(broker.denyRequest({ requestId: 'req-1' }), (error) => error.statusCode === 409);
  const expired = await broker.request({ ...base, capability: 'files.write', requestId: 'req-2', ttlMs: -1 });
  assert.equal(expired.confirmationRequired, true);
  await assert.rejects(broker.approveRequest({ requestId: 'req-2' }), (error) => error.statusCode === 409);
  await broker.request({ ...base, capability: 'network.read', requestId: 'req-3' });
  const results = await Promise.allSettled([broker.approveRequest({ requestId: 'req-3' }), broker.denyRequest({ requestId: 'req-3' })]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected' && result.reason.statusCode === 409).length, 1);
});
test('action plan has no handler side effect and executes once', async () => { const { broker: permissions, appId, subjectId } = await installedPermissions(['settings.write']); await permissions.decide({ subjectId, appId, capability: 'settings.write', decision: 'allow' }); const registry = new ActionRegistry(); const service = new ActionService({ registry, permissions }); let calls = 0; service.register({ actionId: 'settings.open', ownerAppId: appId, requiredCapability: 'settings.write', riskLevel: 'low' }, async () => { calls += 1; }); const plan = await service.plan({ actionId: 'settings.open', subjectId, input: {} }); assert.equal(calls, 0); const run = await service.execute({ actionId: 'settings.open', planId: plan.planId, subjectId, confirmed: true, requestId: 'r' }); await new Promise((resolve) => setImmediate(resolve)); assert.equal(calls, 1); assert.equal((await service.get(run.runId, subjectId)).handlerCalls, 1); });
test('action run lease heartbeat and reclaim preserve exactly-once execution', async () => { const { broker: permissions, appId, subjectId } = await installedPermissions(['settings.write']); await permissions.decide({ subjectId, appId, capability: 'settings.write', decision: 'allow' }); const registry = new ActionRegistry(); const repository = new (await import('../../src/actions/repository.mjs')).InMemoryActionRepository(); let calls = 0; const service = new ActionService({ registry, permissions, repository, workerId: 'worker-a', leaseMs: 20 }); service.register({ actionId: 'settings.recover', ownerAppId: appId, requiredCapability: 'settings.write', riskLevel: 'low', timeout: 200 }, async () => { calls += 1; await new Promise((resolve) => setTimeout(resolve, 40)); }); const plan = await service.plan({ actionId: 'settings.recover', subjectId, input: {} }); const run = await service.execute({ actionId: 'settings.recover', planId: plan.planId, subjectId, confirmed: true, requestId: 'recovery-1' }); await new Promise((resolve) => setTimeout(resolve, 10)); const leased = await repository.getRun(run.runId); assert.equal(leased.state, 'running'); assert.ok(Date.parse(leased.leaseUntil) > Date.now()); await new Promise((resolve) => setTimeout(resolve, 70)); await new Promise((resolve) => setImmediate(resolve)); const finished = await repository.getRun(run.runId); assert.equal(finished.state, 'succeeded'); assert.equal(finished.handlerCalls, 1); assert.equal(calls, 1); });
test('settings optimistic concurrency and context redaction', async () => {
  const events = [];
  const repository = new InMemorySystemRepository();
  const system = new SystemService({ repository, audit: { record: async (event) => { events.push(event); } } });
  const first = await system.patch({ baseVersion: '1', patch: { domain: 'network', value: { proxyMode: 'manual', manualProxyRef: 'secret-ref-1' } } });
  assert.equal(first.contextVersion, '2');
  assert.equal(first.settingsVersion, '2');
  assert.equal(events.length, 1);
  assert.equal(events[0].action, 'system.settings.patch');
  assert.equal(events[0].summary.domain, 'network');
  assert.equal(JSON.stringify(events[0]).includes('secret-ref-1'), false);
  Object.assign(repository.settings.settings.network, { proxySecretRef: 'legacy-secret-ref', proxySecret: 'legacy-secret', token: 'legacy-token', proxyUrl: 'https://private.example' });
  const context = await system.context();
  assert.equal(context.settings.network.proxyMode, 'manual');
  assert.equal(context.settings.network.manualProxyRef, 'secret-ref-1');
  assert.equal(Object.hasOwn(context.settings.network, 'proxySecretRef'), false);
  assert.equal(Object.hasOwn(context.settings.network, 'proxySecret'), false);
  assert.equal(Object.hasOwn(context.settings.network, 'token'), false);
  assert.equal(Object.hasOwn(context.settings.network, 'proxyUrl'), false);
  await assert.rejects(system.patch({ baseVersion: '1', patch: { domain: 'locale', value: { uiLocale: 'zh-CN' } } }), (error) => error.statusCode === 409 && error.current.settingsVersion === '2');
  const concurrent = await Promise.allSettled([
    system.patch({ baseVersion: '2', patch: { domain: 'locale', value: { uiLocale: 'zh-CN' } } }),
    system.patch({ baseVersion: '2', patch: { domain: 'appearance', value: { appearanceMode: 'dark' } } }),
  ]);
  assert.equal(concurrent.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(concurrent.filter((result) => result.status === 'rejected' && result.reason.statusCode === 409).length, 1);
  assert.equal((await system.snapshot()).settingsVersion, '3');
  assert.equal(events.length, 2);
});
