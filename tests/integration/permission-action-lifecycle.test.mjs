import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PermissionBroker, createTrustedBuiltinPermissionBroker } from '../../src/permissions/broker.mjs';
import { InMemoryPermissionRepository } from '../../src/permissions/repository.mjs';
import { PostgresPermissionRepository } from '../../src/permissions/postgres-repository.mjs';
import { ActionRegistry } from '../../src/actions/registry.mjs';
import { ActionService } from '../../src/actions/service.mjs';
import { createPackageActionLifecycle, PostgresPackageActionRepository, projectPackageActions } from '../../src/actions/package-actions.mjs';

const isolated = () => {
  try { return /^(?:dgos_v1_actions|dgos_v1_integrated|dgos_v1_verify_[a-f0-9]{32})$/.test(new URL(process.env.DGOS_DATABASE_URL).pathname.slice(1)); }
  catch { return false; }
};
const appId = 'com.example.actiontest';
const capability = 'dgos.file.read';
const declaration = { actionId: `${appId}.file.open`, version: '1.0.0', label: { 'zh-CN': '打开文件', 'en-US': 'Open file' }, inputSchema: { type: 'object', properties: {} }, outputSchema: { type: 'object', properties: {} }, requiredCapabilities: [capability], risk: 'read', sideEffects: 'none', confirmation: 'none', idempotency: 'safe', cancellable: false, handler: 'dgos.file.open' };
const manifest = { appId, permissions: [capability], capabilityAllowlist: [capability], actions: [declaration] };

test('permission ignores caller declared list, deny wins, and failed audit does not publish memory state', async () => {
  const repository = new InMemoryPermissionRepository();
  const audit = { record: async (event) => { if (event.action === 'permission.change' && event.summary.decision === 'deny') throw new Error('audit_unavailable'); } };
  const broker = new PermissionBroker({ repository, audit });
  const input = { subjectId: 'u', appId, capability, declared: [capability] };
  assert.equal((await broker.check(input)).decision, 'deny');
  repository.declare('u', appId, [capability]);
  assert.equal((await broker.check(input)).decision, 'ask');
  const request = await broker.request({ ...input, requestId: 'request-1' });
  assert.equal(request.confirmationRequired, true);
  await assert.rejects(broker.denyRequest({ requestId: 'request-1' }), /audit_unavailable/);
  assert.equal(repository.getRequest('request-1').state, 'pending');
  assert.equal((await broker.check(input)).decision, 'ask');
  const allowed = await broker.approveRequest({ requestId: 'request-1' });
  assert.equal(allowed.decision, 'allow');
  repository.declare('u', appId, []);
  assert.equal((await broker.check(input)).decision, 'deny');
});

test('server-owned system declaration remains available without caller declared input', async () => {
  const repository = new InMemoryPermissionRepository();
  const broker = createTrustedBuiltinPermissionBroker({ repository });
  const publicBroker = new PermissionBroker({ repository });
  for (const capability of ['system.settings.read', 'system.settings.write', 'system.navigate']) {
    const result = await broker.check({ subjectId: 'u', appId: 'dgos.system', capability, declared: [] });
    assert.equal(result.decision, 'ask');
    await broker.decide({ subjectId: 'u', appId: 'dgos.system', capability, decision: 'allow' });
    assert.equal((await broker.check({ subjectId: 'u', appId: 'dgos.system', capability, declared: [] })).decision, 'allow');
  }
  assert.equal((await broker.check({ subjectId: 'u', appId: 'dgos.system', capability: 'arbitrary', declared: ['arbitrary'] })).decision, 'deny');
  assert.equal((await publicBroker.check({ subjectId: 'u', appId: 'dgos.system', capability: 'system.settings.read', declared: ['system.settings.read'] })).decision, 'deny');
  for (const capability of ['skill.read', 'skill.install', 'skill.manage', 'skill.uninstall', 'skill.execute', 'mcp.read', 'mcp.install', 'mcp.manage', 'mcp.uninstall', 'mcp.connect', 'mcp.execute', 'extension.run.read', 'extension.run.cancel']) {
    assert.equal((await broker.check({ subjectId: 'u', appId: 'dgos.extensions', capability, declared: [] })).decision, 'ask');
  }
  assert.equal((await publicBroker.check({ subjectId: 'u', appId: 'dgos.extensions', capability: 'mcp.read', declared: ['mcp.read'] })).decision, 'deny');
});

test('package declaration requires manifest capability and registered handler', () => {
  const handlers = new Map([['dgos.file.open', () => {}]]);
  assert.equal(projectPackageActions(manifest, handlers)[0].requiredCapability, capability);
  assert.throws(() => projectPackageActions({ ...manifest, permissions: [] }, handlers), /invalid_action_manifest/);
  assert.throws(() => projectPackageActions(manifest, new Map()), /invalid_action_manifest/);
  for (const [field, value] of [['risk', 'high'], ['sideEffects', 'external'], ['confirmation', 'later'], ['idempotency', 'keyed']]) {
    assert.throws(() => projectPackageActions({ ...manifest, actions: [{ ...declaration, [field]: value }] }, handlers), /invalid_action_manifest/);
  }
  assert.throws(() => projectPackageActions({ ...manifest, actions: [{ ...declaration, risk: 'external', sideEffects: 'external-call', confirmation: 'none' }] }, handlers), /invalid_action_manifest/);
});

test('public declaration preserves frozen enums and body appId cannot replace action owner', async () => {
  const extra = 'dgos.file.audit';
  const external = { ...declaration, risk: 'external', sideEffects: 'external-call', confirmation: 'elevated', idempotency: 'unsupported', requiredCapabilities: [capability, extra] };
  const definitions = projectPackageActions({ ...manifest, permissions: [capability, extra], capabilityAllowlist: [capability, extra], actions: [external] }, new Map([['dgos.file.open', () => {}]]));
  const registry = new ActionRegistry();
  registry.hydrate({ ...definitions[0], actionVersion: 1 });
  const calls = [];
  const permissions = { check: async (query) => { calls.push(query); return { decision: query.appId === appId && query.capability === extra ? 'deny' : 'allow' }; } };
  const service = new ActionService({ registry, permissions, autoDispatch: false });
  assert.deepEqual(service.list().items[0], {
    actionId: external.actionId, actionVersion: '1', appId, label: external.label,
    inputSchema: external.inputSchema, outputSchema: external.outputSchema,
    requiredCapabilities: [capability, extra], risk: 'external', sideEffects: 'external-call',
    confirmation: 'elevated', idempotency: 'unsupported', cancellable: false, state: 'ready',
  });
  await assert.rejects(service.plan({ actionId: external.actionId, subjectId: 'u', appId: 'attacker.app', input: {} }), (error) => error.statusCode === 403);
  assert.deepEqual(calls.map(({ appId: checkedOwner, capability: checkedCapability }) => [checkedOwner, checkedCapability]), [[appId, capability], [appId, extra]]);
  permissions.check = async (query) => { calls.push(query); return { decision: 'allow' }; };
  const plan = await service.plan({ actionId: external.actionId, subjectId: 'u', appId: 'attacker.app', input: {} });
  permissions.check = async (query) => { calls.push(query); return { decision: query.appId === appId && query.capability === extra ? 'deny' : 'allow' }; };
  await assert.rejects(service.execute({ actionId: external.actionId, subjectId: 'u', appId: 'attacker.app', planId: plan.planId, input: {}, confirmed: true, requestId: 'spoofed-owner' }), (error) => error.statusCode === 403);
  assert.equal((await service.repository.listRuns()).length, 0);
  assert.ok(calls.every((query) => query.appId === appId));
});

test('PostgreSQL permission transaction and package action lifecycle isolate subjects', async (t) => {
  if (!isolated()) return t.skip('isolated V1 database required');
  const pg = (await import('../../apps/api/node_modules/pg/lib/index.js')).default;
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL });
  const secondPool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL });
  const subjectA = randomUUID(); const subjectB = randomUUID(); const packageId = randomUUID(); const packageRequestId = randomUUID();
  const digest = `sha256:${'a'.repeat(64)}`;
  const permissions = new PostgresPermissionRepository(pool);
  const broker = new PermissionBroker({ repository: permissions });
  const actions = new PostgresPackageActionRepository(pool);
  const handlers = new Map([['dgos.file.open', async () => ({ ok: true })]]);
  const registry = new ActionRegistry(); const bound = new Map();
  const lifecycle = createPackageActionLifecycle({ repository: actions, registry, handlers, bindHandler: (id, handler) => bound.set(id, handler) });
  try {
    await pool.query("INSERT INTO app_package_releases(package_id,app_id,version,build,release_channel,manifest,package_digest,source,key_id,request_id,effective_trust_level,uninstall_policy,catalog_state) VALUES($1,$2,'1.0.0',1,'stable',$3,$4,'official','test-key',$5,'system','user-removable','official')", [packageId, appId, JSON.stringify(manifest), digest, packageRequestId]);
    for (const subject of [subjectA, subjectB]) await pool.query("INSERT INTO app_package_deployments(subject_id,app_id,package_id,version,build,release_channel,package_digest,state) VALUES($1,$2,$3,'1.0.0',1,'stable',$4,'active')", [subject, appId, packageId, digest]);
    assert.equal((await broker.check({ subjectId: subjectA, appId, capability, declared: ['forged'] })).decision, 'ask');
    assert.equal((await broker.check({ subjectId: subjectA, appId, capability: 'forged', declared: ['forged'] })).decision, 'deny');
    const trusted = createTrustedBuiltinPermissionBroker({ repository: permissions });
    assert.equal((await trusted.check({ subjectId: subjectA, appId: 'dgos.system', capability: 'system.settings.read', declared: [] })).decision, 'ask');
    assert.equal((await trusted.check({ subjectId: subjectA, appId: 'dgos.system', capability: 'system.navigate', declared: [] })).decision, 'ask');
    assert.equal((await trusted.check({ subjectId: subjectA, appId: 'dgos.extensions', capability: 'mcp.read', declared: [] })).decision, 'ask');
    assert.equal((await broker.check({ subjectId: subjectA, appId: 'dgos.extensions', capability: 'mcp.read', declared: ['mcp.read'] })).decision, 'deny');
    const input = { subjectId: subjectA, appId, capability, decision: 'allow', requestId: randomUUID() };
    const first = await broker.decide(input);
    assert.deepEqual(await broker.decide(input), first);
    await assert.rejects(broker.decide({ ...input, decision: 'deny' }), (error) => error.statusCode === 409);
    permissions.recordAudit = async () => { throw new Error('audit_unavailable'); };
    const directFailureId = randomUUID();
    await assert.rejects(broker.decide({ subjectId: subjectB, appId, capability, decision: 'deny', requestId: directFailureId }), /audit_unavailable/);
    assert.equal(await permissions.get({ subjectId: subjectB, appId, capability }), undefined);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM permission_change_receipts WHERE request_id=$1', [directFailureId])).rows[0].n, 0);
    const requestId = randomUUID();
    await broker.request({ subjectId: subjectB, appId, capability, requestId });
    await assert.rejects(broker.approveRequest({ requestId }), /audit_unavailable/);
    assert.equal((await permissions.getRequest(requestId)).state, 'pending');
    assert.equal(await permissions.get({ subjectId: subjectB, appId, capability }), undefined);
    permissions.recordAudit = PostgresPermissionRepository.prototype.recordAudit;
    const race = await Promise.allSettled([broker.approveRequest({ requestId }), broker.denyRequest({ requestId })]);
    assert.equal(race.filter((item) => item.status === 'fulfilled').length, 1);
    assert.equal((await permissions.getRequest(requestId)).state, race[0].status === 'fulfilled' ? 'approved' : 'denied');
    const pendingId = randomUUID();
    const pendingScope = 'folder-x';
    await broker.request({ subjectId: subjectB, appId, capability, scope: pendingScope, requestId: pendingId });
    await broker.decide({ subjectId: subjectB, appId, capability, scope: pendingScope, decision: 'deny', requestId: randomUUID() });
    await assert.rejects(broker.approveRequest({ requestId: pendingId }), (error) => error.statusCode === 403);
    assert.equal((await permissions.getRequest(pendingId)).state, 'pending');
    const onActionsChanged = lifecycle.onActionsChanged;
    await onActionsChanged({ subjectId: subjectA, appId, manifest, enabled: true });
    await lifecycle.onActionsChanged({ subjectId: subjectB, appId, manifest, enabled: true });
    const secondRegistry = new ActionRegistry(); const secondBound = new Map();
    const other = createPackageActionLifecycle({ repository: new PostgresPackageActionRepository(secondPool), registry: secondRegistry, handlers, bindHandler: (id, handler) => secondBound.set(id, handler) });
    assert.equal(await other.hydrate(), 1);
    const action = secondRegistry.get(declaration.actionId);
    assert.equal(action.actionVersion, registry.get(declaration.actionId).actionVersion);
    await lifecycle.onActionsChanged({ subjectId: subjectB, appId, manifest, enabled: true });
    assert.equal(registry.get(declaration.actionId).actionVersion, action.actionVersion);
    assert.deepEqual(await secondBound.get(declaration.actionId)({}, { subjectId: subjectB }), { ok: true });
    await pool.query("UPDATE app_package_deployments SET state='uninstalled' WHERE subject_id=$1 AND app_id=$2", [subjectA, appId]);
    await lifecycle.onActionsChanged({ subjectId: subjectA, appId, manifest, enabled: false });
    await assert.rejects(secondBound.get(declaration.actionId)({}, { subjectId: subjectA }), /action_not_found/);
    assert.deepEqual(await secondBound.get(declaration.actionId)({}, { subjectId: subjectB }), { ok: true });
    assert.equal(await other.hydrate(), 1);
  } finally {
    await pool.query('DELETE FROM package_action_bindings WHERE app_id=$1', [appId]);
    await pool.query('DELETE FROM permission_change_receipts WHERE request_id=$1', [packageRequestId]);
    await pool.query('DELETE FROM permission_requests WHERE app_id=$1', [appId]);
    await pool.query('DELETE FROM permission_decisions WHERE app_id=$1', [appId]);
    await pool.query('DELETE FROM app_package_deployments WHERE app_id=$1', [appId]);
    await pool.query('DELETE FROM app_package_releases WHERE package_id=$1', [packageId]);
    await secondPool.end(); await pool.end();
  }
});
