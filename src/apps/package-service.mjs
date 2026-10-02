import { createHash, createPublicKey, randomBytes, randomUUID, verify } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm, lstat, readdir } from 'node:fs/promises';
import { join, resolve, dirname, sep, posix } from 'node:path';
import { validateManifest } from './manifest-validator.mjs';

const fail = (key, statusCode = 422) => Object.assign(new Error(key), { statusCode });
const sha = (value) => createHash('sha256').update(value).digest('hex');
export const canonicalJson = (value) => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') { if (!Number.isSafeInteger(value)) throw fail('invalid_package_json'); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  throw fail('invalid_package_json');
};
export function bridgeJson(value, { maxBytes = 1024 * 1024, maxDepth = 32, maxEntries = 10000 } = {}) {
  const seen = new Set(); let entries = 0;
  const encode = (item, depth) => {
    if (++entries > maxEntries || depth > maxDepth) throw fail('invalid_bridge_json');
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return JSON.stringify(item);
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) throw fail('invalid_bridge_json');
      return JSON.stringify(item);
    }
    if (!item || typeof item !== 'object' || seen.has(item)) throw fail('invalid_bridge_json');
    if (Array.isArray(item)) {
      seen.add(item);
      const parts = [];
      for (let index = 0; index < item.length; index += 1) {
        if (!Object.hasOwn(item, index) || item[index] === undefined) throw fail('invalid_bridge_json');
        parts.push(encode(item[index], depth + 1));
      }
      seen.delete(item);
      return `[${parts.join(',')}]`;
    }
    if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) throw fail('invalid_bridge_json');
    seen.add(item);
    const parts = [];
    for (const key of Object.keys(item).sort()) {
      if (item[key] === undefined) continue;
      parts.push(`${JSON.stringify(key)}:${encode(item[key], depth + 1)}`);
    }
    seen.delete(item);
    return `{${parts.join(',')}}`;
  };
  const serialized = encode(value, 0);
  if (Buffer.byteLength(serialized) > maxBytes) throw fail('bridge_json_too_large', 413);
  return serialized;
}
const stable = canonicalJson;
const safe = (path) => typeof path === 'string' && path.length > 0 && path.length < 512 && !path.includes('\\') && !path.includes('\0') && !path.startsWith('/') && !/^[A-Za-z]:/.test(path) && path.split('/').every((part) => part && part !== '.' && part !== '..') && posix.normalize(path) === path;
const inside = (root, path) => { const target = resolve(root, path); if (!target.startsWith(`${resolve(root)}${sep}`)) throw fail('invalid_package_path'); return target; };
const id = (value) => { if (!/^[a-z][a-z0-9.-]{1,63}$/.test(value ?? '')) throw fail('invalid_app_id'); return value; };
const releaseKey = (app) => `${app.appId}/${app.releaseChannel}/${app.version}/${app.build}`;
const compareVersion = (left, right) => {
  const [a, aPre] = left.split('-'); const [b, bPre] = right.split('-');
  for (let i = 0; i < 3; i += 1) { const diff = BigInt(a.split('.')[i]) - BigInt(b.split('.')[i]); if (diff) return diff > 0n ? 1 : -1; }
  if (!aPre && bPre) return 1;
  if (aPre && !bPre) return -1;
  return (aPre ?? '').localeCompare(bPre ?? '');
};

export function verifyPackage({ manifest, files, signature, keyId, resourceDigests }, trustRoots, { maxFiles = 1000, maxBytes = 32 * 1024 * 1024 } = {}) {
  const validation = validateManifest(manifest);
  if (!validation.valid) throw Object.assign(fail('manifest_invalid'), { details: validation.errors });
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw fail('invalid_package_files');
  const names = Object.keys(files).sort();
  if (!names.length || names.length > maxFiles) throw fail('package_too_large', 413);
  if (names.some((name) => !safe(name))) throw fail('invalid_package_path');
  const buffers = new Map();
  let bytes = 0;
  for (const name of names) {
    const encoded = files[name];
    if (typeof encoded !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw fail('invalid_package_file');
    const buffer = Buffer.from(encoded, 'base64'); bytes += buffer.length;
    if (bytes > maxBytes) throw fail('package_too_large', 413);
    buffers.set(name, buffer);
  }
  for (const path of [...Object.values(manifest.entrypoints ?? {}), manifest.icon, manifest.dataMigration?.entry].filter(Boolean)) if (!safe(path) || !buffers.has(path)) throw fail('missing_package_resource');
  const computed = Object.fromEntries(names.map((name) => [name, `sha256:${sha(buffers.get(name))}`]));
  if (!resourceDigests || stable(resourceDigests) !== stable(computed)) throw fail('integrity_error');
  const canonical = stable({ manifest, resourceDigests: computed });
  const digest = `sha256:${sha(canonical)}`;
  const root = trustRoots?.get(keyId);
  if (!root || root.revoked || !['official', 'admin', 'developer'].includes(root.source)) throw fail('untrusted_package', 403);
  let valid = false;
  try { valid = typeof signature === 'string' && /^(?:[A-Za-z0-9+/]{4}){21}[A-Za-z0-9+/]{2}==$/.test(signature) && verify(null, Buffer.from(canonical), root.publicKey.type === 'public' ? root.publicKey : createPublicKey(root.publicKey), Buffer.from(signature, 'base64')); } catch { /* invalid signature */ }
  if (!valid) throw fail('integrity_error');
  return { digest, files: buffers, source: root.source, keyId, resourceDigests: computed };
}

export class DiskPackageStore {
  constructor(root) { if (!root) throw new Error('package_store_root_required'); this.root = resolve(root); }
  pathFor(app, digest) { return inside(this.root, `releases/${releaseKey(app)}/${digest.replace(':', '-')}`); }
  pointerFor(subjectId, appId) { if (!/^[0-9a-f-]{36}$/i.test(subjectId ?? '')) throw fail('invalid_subject_id'); return inside(this.root, `active/${subjectId}/${id(appId)}.json`); }
  async stage(app, checked, { candidateId } = {}) {
    const target = this.pathFor(app, checked.digest);
    try { await lstat(target); await this.check(app, checked.digest); return target; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const temporary = `${target}.tmp-${candidateId ?? `${process.pid}-${Date.now()}`}`;
    await mkdir(temporary, { recursive: true, mode: 0o700 });
    try {
      for (const [path, content] of checked.files) { const file = inside(temporary, path); await mkdir(dirname(file), { recursive: true, mode: 0o700 }); await writeFile(file, content, { flag: 'wx', mode: 0o600 }); }
      await writeFile(join(temporary, '.dgos-release.json'), stable({ digest: checked.digest, resourceDigests: checked.resourceDigests, manifest: app }), { flag: 'wx', mode: 0o600 });
      await rename(temporary, target);
    } catch (error) { await rm(temporary, { recursive: true, force: true }); throw error; }
    return target;
  }
  async check(app, digest) {
    const dir = this.pathFor(app, digest);
    const metadata = JSON.parse(await readFile(join(dir, '.dgos-release.json'), 'utf8'));
    if (metadata.digest !== digest || stable(metadata.manifest) !== stable(app)) throw fail('integrity_error');
    const expected = metadata.resourceDigests;
    if (`sha256:${sha(stable({ manifest: app, resourceDigests: expected }))}` !== digest) throw fail('integrity_error');
    const visit = async (folder, prefix = '') => {
      for (const entry of await readdir(folder, { withFileTypes: true })) {
        if (entry.isSymbolicLink() || (!entry.isFile() && !entry.isDirectory())) throw fail('invalid_package_path');
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await visit(join(folder, entry.name), relative);
        else if (relative !== '.dgos-release.json') {
          if (!expected[relative] || `sha256:${sha(await readFile(join(folder, entry.name)))}` !== expected[relative]) throw fail('integrity_error');
          seen.add(relative);
        }
      }
    };
    const seen = new Set(); await visit(dir);
    if (seen.size !== Object.keys(expected).length) throw fail('missing_package_resource');
    for (const path of Object.values(app.entrypoints)) {
      if (!expected[path]) throw fail('missing_package_resource');
      if (path.endsWith('.html') && !(await readFile(inside(dir, path), 'utf8')).toLowerCase().includes('<html')) throw fail('health_check_failed');
    }
    return true;
  }
  async current(subjectId, appId) { try { return JSON.parse(await readFile(this.pointerFor(subjectId, appId), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
  async switch(subjectId, appId, pointer) {
    const target = this.pointerFor(subjectId, appId); await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(temporary, stable(pointer), { flag: 'wx', mode: 0o600 });
    try { await rename(temporary, target); } catch (error) { await rm(temporary, { force: true }); throw error; }
  }
  async removePointer(subjectId, appId) { await rm(this.pointerFor(subjectId, appId), { force: true }); }
  dataFor(subjectId, appId) { if (!/^[0-9a-f-]{36}$/i.test(subjectId ?? '')) throw fail('invalid_subject_id'); return inside(this.root, `data/${subjectId}/${id(appId)}.json`); }
  async readData(subjectId, appId) { try { return JSON.parse(await readFile(this.dataFor(subjectId, appId), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return {}; throw error; } }
  async writeData(subjectId, appId, data) { const target = this.dataFor(subjectId, appId); await mkdir(dirname(target), { recursive: true, mode: 0o700 }); const temp = `${target}.tmp-${randomUUID()}`; await writeFile(temp, canonicalJson(data), { flag: 'wx', mode: 0o600 }); await rename(temp, target); }
  receiptFor(subjectId, appId, instanceId, requestId) {
    if (!/^[0-9a-f-]{36}$/i.test(subjectId ?? '') || !/^[0-9a-f-]{36}$/i.test(instanceId ?? '') || !/^[0-9a-f-]{36}$/i.test(requestId ?? '')) throw fail('invalid_request');
    return inside(this.root, `bridge-receipts/${subjectId}/${id(appId)}/${instanceId}/${requestId}.json`);
  }
  async readReceipt(subjectId, appId, instanceId, requestId) {
    try { return JSON.parse(await readFile(this.receiptFor(subjectId, appId, instanceId, requestId), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  async writeReceipt(subjectId, appId, instanceId, requestId, receipt) {
    const target = this.receiptFor(subjectId, appId, instanceId, requestId);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    const temporary = `${target}.tmp-${randomUUID()}`;
    await writeFile(temporary, bridgeJson(receipt), { flag: 'wx', mode: 0o600 });
    try { await rename(temporary, target); } catch (error) { await rm(temporary, { force: true }); throw error; }
  }
  async resource(subjectId, appId, path) {
    if (!safe(path)) throw fail('invalid_package_path');
    const pointer = await this.current(subjectId, appId);
    if (!pointer) throw fail('app_not_installed', 404);
    const app = pointer.manifest; await this.check(app, pointer.digest);
    const metadata = JSON.parse(await readFile(join(this.pathFor(app, pointer.digest), '.dgos-release.json'), 'utf8'));
    if (!metadata.resourceDigests[path]) throw fail('missing_package_resource', 404);
    return readFile(inside(this.pathFor(app, pointer.digest), path));
  }
  async resourceFromRelease(app, digest, path) { if (!safe(path)) throw fail('invalid_package_path'); await this.check(app, digest); return readFile(inside(this.pathFor(app, digest), path)); }
  async removeStagedCandidate(app, digest, candidateId) {
    if (!/^[0-9a-f-]{36}$/i.test(candidateId ?? '') || !/^sha256:[0-9a-f]{64}$/.test(digest ?? '')) throw fail('invalid_request');
    const target = this.pathFor(app, digest);
    const tombstone = inside(this.root, `retention-tombstones/${candidateId}`);
    const temporary = `${target}.tmp-${candidateId}`;
    await mkdir(dirname(tombstone), { recursive: true, mode: 0o700 });
    try {
      const stat = await lstat(tombstone);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw fail('invalid_package_path');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      try {
        const stat = await lstat(target);
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw fail('invalid_package_path');
        await this.check(app, digest);
        await rename(target, tombstone);
      } catch (missing) { if (missing.code !== 'ENOENT') throw missing; }
    }
    await rm(tombstone, { recursive: true, force: true });
    try {
      const stat = await lstat(temporary);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw fail('invalid_package_path');
      await rm(temporary, { recursive: true });
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

export class PackageService {
  #lockToken = Symbol('package-service-lock');
  constructor({ repository, store, trustRoots, audit, onActionsChanged, packageLimits, healthProbe, bridgeHandlers = {}, bridgeAuthorize } = {}) { Object.assign(this, { repository, store, trustRoots, audit, onActionsChanged, packageLimits, healthProbe, bridgeHandlers, bridgeAuthorize }); this.locks = new Set(); this.launches = new Map(); }
  async submit(input, lockToken) {
    const checked = verifyPackage(input, this.trustRoots, this.packageLimits);
    const { manifest: app } = input;
    if (!input.requestId) throw fail('request_id_required');
    if (lockToken !== this.#lockToken && this.repository.withAppLock) return this.repository.withAppLock(app.appId, () => this.submit(input, this.#lockToken));
    const existing = await this.repository.findPackageByRequest?.(input.requestId);
    if (existing) { if (existing.digest !== checked.digest) throw fail('version_conflict', 409); return existing; }
    const root = this.trustRoots.get(checked.keyId);
    if (app.trustLevel !== 'standard' && !root.allowedTrustLevels?.includes(app.trustLevel)) throw fail('untrusted_package', 403);
    if (app.uninstallPolicy === 'protected-preinstall' && !root.allowProtectedPreinstall) throw fail('untrusted_package', 403);
    const prior = (await this.repository.listPackages({ publicOnly: false })).filter((item) => item.appId === app.appId && item.releaseChannel === app.releaseChannel);
    if (prior.some((item) => compareVersion(app.version, item.version) < 0 || (app.version === item.version && app.build <= item.build))) throw fail('version_conflict', 409);
    const candidateId = await this.repository.recordStageCandidate?.(app, checked.digest);
    try {
      await this.store.stage(app, checked, { candidateId });
      if (candidateId) await this.repository.setStageCandidateState(candidateId, 'staged');
      return await this.repository.atomic(async () => {
        const record = await this.repository.recordPackage({ app, digest: checked.digest, source: checked.source, keyId: checked.keyId, requestId: input.requestId, effectiveTrustLevel: app.trustLevel, uninstallPolicy: app.uninstallPolicy, catalogState: checked.source === 'official' ? 'official' : 'pending_review' });
        await this.repository.auditEvent({ requestId: input.requestId, actorId: input.actorId, action: 'app.package.submit', appId: app.appId, digest: checked.digest });
        if (candidateId) await this.repository.setStageCandidateState(candidateId, 'finalized');
        return record;
      });
    } catch (error) {
      if (candidateId) await this.repository.setStageCandidateState(candidateId, 'failed').catch(() => {});
      throw error;
    }
  }
  async review({ appId, version, build, releaseChannel, baseVersion, decision, actorId, requestId, reason }) {
    if (!['approved', 'rejected', 'withdrawn'].includes(decision)) throw fail('invalid_review_decision');
    const record = await this.repository.getPackage(appId, version, build, releaseChannel);
    if (!record) throw fail('app_not_available', 404);
    if (record.source === 'official') throw fail('review_forbidden', 403);
    await this.store.check(record.manifest, record.digest);
    return this.repository.atomic(async () => {
      const result = await this.repository.reviewPackage({ record, baseVersion, decision, actorId, requestId, reason });
      await this.repository.auditEvent({ requestId, actorId, action: `app.catalog.${decision}`, appId, digest: record.digest });
      return result;
    });
  }
  async install({ subjectId, appId, version, build, releaseChannel, baseVersion, actorId, requestId, developerTest = false }, lockToken) {
    if (lockToken !== this.#lockToken) return this.repository.withAppLock(appId, () => this.repository.withLock(subjectId, appId, () => this.install({ subjectId, appId, version, build, releaseChannel, baseVersion, actorId, requestId, developerTest }, this.#lockToken)));
    const lock = `${subjectId}:${appId}`;
    if (this.locks.has(lock)) throw fail('app_install_conflict', 409);
    this.locks.add(lock);
    try {
      const release = await this.repository.getPackage(appId, version, build, releaseChannel);
      if (!release || (!developerTest && !['official', 'approved'].includes(release.catalogState))) {
        await this.repository.atomic(async () => { await this.repository.recordOperation({ subjectId, appId, requestId, actorId, action: 'install', state: 'rejected', digest: release?.digest, reason: 'app_not_available' }); await this.repository.auditEvent({ requestId, actorId, action: 'app.install.rejected', appId, digest: release?.digest, result: 'denied' }); });
        throw fail('app_not_available', 404);
      }
      if (developerTest && !['developer', 'admin'].includes(release.source)) throw fail('test_install_forbidden', 403);
      await this.recover({ subjectId, appId }, this.#lockToken);
      const before = await this.store.current(subjectId, appId);
      if (before?.digest === release.digest) return this.repository.getDeployment(subjectId, appId);
      const previousDeployment = await this.repository.getDeployment(subjectId, appId);
      if (previousDeployment && previousDeployment.versionNumber !== baseVersion) throw fail('version_conflict', 409);
      let migration;
      const needsMigration = before && before.manifest.dataVersion !== release.manifest.dataVersion;
      if (needsMigration && !release.manifest.dataMigration?.from?.includes(before.manifest.dataVersion)) throw fail('data_migration_required', 409);
      await this.repository.atomic(async () => { await this.repository.recordOperation({ subjectId, appId, requestId, actorId, action: 'install', state: 'prepared', digest: release.digest }); await this.repository.auditEvent({ requestId, actorId, action: 'app.install.prepared', appId, digest: release.digest }); });
      try { await this.store.check(release.manifest, release.digest); if (this.healthProbe && !(await this.healthProbe({ app: release.manifest, packagePath: this.store.pathFor(release.manifest, release.digest), subjectId }))) throw fail('health_check_failed'); } catch (error) {
        await this.repository.atomic(async () => { await this.repository.recordOperation({ subjectId, appId, requestId, actorId, action: 'install', state: 'rolled_back', digest: release.digest, reason: error.message }); await this.repository.auditEvent({ requestId, actorId, action: 'app.install.rollback', appId, digest: release.digest, result: 'failed' }); });
        throw error.message === 'health_check_failed' ? fail('rollback_required', 422) : error;
      }
      if (needsMigration) migration = await this.prepareMigration({ subjectId, appId, release, sourcePackageDigest: before.digest, fromVersion: before.manifest.dataVersion, requestId });
      await this.store.switch(subjectId, appId, { manifest: release.manifest, digest: release.digest });
      try {
        const result = await this.repository.atomic(async () => {
          const saved = await this.repository.saveDeployment({ subjectId, appId, release, requestId, previousDigest: before?.digest ?? null, expectedVersion: previousDeployment?.versionNumber ?? null, state: 'active' });
          if (migration) await this.repository.finishMigration(migration.migrationId, 'committed', migration.afterDigest);
          await this.repository.recordOperation({ subjectId, appId, requestId, actorId, action: 'install', state: 'active', digest: release.digest });
          await this.repository.auditEvent({ requestId, actorId, action: 'app.install', appId, digest: release.digest });
          return saved;
        });
        try { await this.syncActions(subjectId, appId, release.manifest, true); } catch { /* durable deployment remains; recovery retries registration */ }
        return result;
      } catch (error) {
        const committed = await this.repository.getDeployment(subjectId, appId);
        if (committed?.digest !== release.digest) { if (before) await this.store.switch(subjectId, appId, before); else await this.store.removePointer(subjectId, appId); if (migration) await this.rollbackMigration({ subjectId, appId, migration }); await this.repository.atomic(async () => { await this.repository.recordOperation({ subjectId, appId, requestId, actorId, action: 'install', state: 'rolled_back', digest: release.digest, reason: error.message }); await this.repository.auditEvent({ requestId, actorId, action: 'app.install.rollback', appId, digest: release.digest, result: 'failed' }); }); }
        throw error;
      }
    } finally { this.locks.delete(lock); }
  }
  async uninstall({ subjectId, appId, baseVersion, actorId, requestId }, lockToken) {
    if (lockToken !== this.#lockToken) return this.repository.withAppLock(appId, () => this.repository.withLock(subjectId, appId, () => this.uninstall({ subjectId, appId, baseVersion, actorId, requestId }, this.#lockToken)));
    const lock = `${subjectId}:${appId}`; if (this.locks.has(lock)) throw fail('app_install_conflict', 409);
    this.locks.add(lock);
    try {
      await this.recover({ subjectId, appId }, this.#lockToken);
      const before = await this.store.current(subjectId, appId);
      if (!before) throw fail('app_not_installed', 404);
      const previousDeployment = await this.repository.getDeployment(subjectId, appId);
      if (!previousDeployment || previousDeployment.versionNumber !== baseVersion) throw fail('version_conflict', 409);
      const release = await this.repository.getPackage(appId, before.manifest.version, before.manifest.build, before.manifest.releaseChannel);
      if (release?.uninstallPolicy === 'protected-preinstall') {
        await this.repository.atomic(async () => { await this.repository.recordOperation({ subjectId, appId, requestId, actorId, action: 'uninstall', state: 'rejected', digest: before.digest, reason: 'protected_preinstall' }); await this.repository.auditEvent({ requestId, actorId, action: 'app.uninstall.rejected', appId, digest: before.digest, result: 'denied' }); });
        throw fail('app_uninstall_forbidden', 403);
      }
      await this.repository.atomic(async () => { await this.repository.recordOperation({ subjectId, appId, requestId, actorId, action: 'uninstall', state: 'prepared', digest: before.digest }); await this.repository.auditEvent({ requestId, actorId, action: 'app.uninstall.prepared', appId, digest: before.digest }); });
      await this.store.removePointer(subjectId, appId);
      try {
        const result = await this.repository.atomic(async () => { const saved = await this.repository.saveDeployment({ subjectId, appId, release, requestId, expectedVersion: previousDeployment.versionNumber, state: 'uninstalled', dataRetained: true }); await this.repository.recordOperation({ subjectId, appId, requestId, actorId, action: 'uninstall', state: 'uninstalled', digest: before.digest }); await this.repository.auditEvent({ requestId, actorId, action: 'app.uninstall', appId, digest: before.digest }); return saved; });
        try { await this.syncActions(subjectId, appId, before.manifest, false); } catch { /* durable uninstall remains; recovery retries deregistration */ }
        return result;
      } catch (error) { const committed = await this.repository.getDeployment(subjectId, appId); if (committed?.state !== 'uninstalled') await this.store.switch(subjectId, appId, before); throw error; }
    } finally { this.locks.delete(lock); }
  }
  async health({ subjectId, appId }) { const deployment = await this.repository.getDeployment(subjectId, appId); if (!deployment || deployment.state !== 'active') return { appId, healthy: false, integrityHealthy: false, runtimeChecked: false, state: 'uninstalled' }; const current = await this.store.current(subjectId, appId); if (!current || current.digest !== deployment.digest) return { appId, healthy: false, integrityHealthy: false, runtimeChecked: false, state: 'damaged' }; try { await this.store.check(current.manifest, current.digest); if (!this.healthProbe) return { appId, healthy: false, integrityHealthy: true, runtimeChecked: false, state: 'runtime_unchecked', version: current.manifest.version, build: current.manifest.build }; const runtimeHealthy = Boolean(await this.healthProbe({ app: current.manifest, packagePath: this.store.pathFor(current.manifest, current.digest), subjectId })); return { appId, healthy: runtimeHealthy, integrityHealthy: true, runtimeChecked: true, state: runtimeHealthy ? 'active' : 'health_check_failed', version: current.manifest.version, build: current.manifest.build }; } catch { return { appId, healthy: false, integrityHealthy: false, runtimeChecked: false, state: 'damaged' }; } }
  async launch({ subjectId, sessionId, appId }) {
    if (!sessionId) throw fail('session_invalid', 401);
    await this.recover({ subjectId, appId });
    const deployment = await this.repository.getDeployment(subjectId, appId);
    if (!deployment || deployment.state !== 'active') throw fail('app_not_installed', 409);
    const release = await this.repository.getPackageById(deployment.packageId);
    const entry = release?.manifest.entrypoints?.web;
    if (!entry) throw fail('app_entry_unavailable', 409);
    await this.store.check(release.manifest, release.digest);
    const instanceId = randomUUID(); const ticket = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + 5 * 60_000;
    const resourcePaths = Object.keys(JSON.parse(await readFile(join(this.store.pathFor(release.manifest, release.digest), '.dgos-release.json'), 'utf8')).resourceDigests);
    this.launches.set(ticket, { instanceId, subjectId, sessionId, appId, digest: deployment.digest, expiresAt, capabilities: release.manifest.capabilityAllowlist, resourcePaths });
    return { appId, digest: deployment.digest, instanceId, bridgeVersion: 1, declaredCapabilities: release.manifest.capabilityAllowlist, entrypoint: `/api/v1/apps/${encodeURIComponent(appId)}/resources/${entry.split('/').map(encodeURIComponent).join('/')}?launchTicket=${encodeURIComponent(ticket)}`, isolation: 'opaque-origin-sandbox', expiresAt: new Date(expiresAt).toISOString() };
  }
  async resource({ subjectId, sessionId, appId, path, launchTicket }) {
    const launch = launchTicket ? this.launches.get(launchTicket) : null;
    if (launchTicket && (!launch || launch.subjectId !== subjectId || launch.sessionId !== sessionId || launch.appId !== appId || launch.expiresAt < Date.now() || !launch.resourcePaths.includes(path))) throw fail('launch_ticket_invalid', 403);
    await this.recover({ subjectId, appId });
    const deployment = await this.repository.getDeployment(subjectId, appId);
    if (!deployment || deployment.state !== 'active') throw fail('app_not_installed', 404);
    const release = await this.repository.getPackageById(deployment.packageId);
    if (!release || release.digest !== deployment.digest) throw fail('integrity_error');
    if (launch && launch.digest !== deployment.digest) throw fail('launch_ticket_invalid', 403);
    return this.store.resource(subjectId, appId, path);
  }
  resolveLaunch(ticket, appId, path) { const launch = this.launches.get(ticket); if (!launch || launch.appId !== appId || launch.expiresAt < Date.now() || !launch.resourcePaths.includes(path)) throw fail('launch_ticket_invalid', 403); return launch; }
  async bridge({ subjectId, sessionId, appId, instanceId, requestId, capability, input }) {
    if (!sessionId) throw fail('session_invalid', 401);
    if (typeof requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(requestId)) throw fail('invalid_request');
    const launch = [...this.launches.values()].find((item) => item.subjectId === subjectId && item.sessionId === sessionId && item.appId === appId && item.instanceId === instanceId && item.expiresAt >= Date.now());
    if (!launch || !launch.capabilities.includes(capability)) throw fail('permission_denied', 403);
    const deployment = await this.repository.getDeployment(subjectId, appId);
    if (!deployment || deployment.state !== 'active' || deployment.digest !== launch.digest) throw fail('app_not_installed', 409);
    const release = await this.repository.getPackageById(deployment.packageId);
    if (!release || release.digest !== deployment.digest || !['official', 'approved'].includes(release.catalogState)) throw fail('app_not_available', 404);
    if (!release.manifest.permissions.includes(capability) || !release.manifest.capabilityAllowlist.includes(capability)) throw fail('permission_denied', 403);
    if (!this.bridgeAuthorize) throw fail('capability_unavailable', 503);
    const inputDigest = `sha256:${sha(bridgeJson(input))}`;
    if (!(await this.bridgeAuthorize({ subjectId, sessionId, appId, instanceId, capability, requestId, input, packageDigest: deployment.digest }))) throw fail('permission_denied', 403);
    const handler = this.bridgeHandlers[capability];
    if (!handler) throw fail('capability_unavailable', 503);
    return this.repository.withLock(subjectId, appId, async () => {
      const current = await this.repository.getDeployment(subjectId, appId);
      if (current?.state !== 'active' || current.digest !== launch.digest) throw fail('app_not_installed', 409);
      const previous = await this.store.readReceipt(subjectId, appId, instanceId, requestId);
      if (previous && (previous.subjectId !== subjectId || previous.sessionId !== sessionId || previous.appId !== appId || previous.instanceId !== instanceId || previous.requestId !== requestId || previous.capability !== capability || previous.inputDigest !== inputDigest || previous.packageDigest !== current.digest)) throw fail('version_conflict', 409);
      if (previous?.state === 'completed') return previous.result;
      if (previous) throw fail('upstream_outcome_unknown', 409);
      const binding = { subjectId, sessionId, appId, instanceId, requestId, capability, inputDigest, packageDigest: current.digest };
      await this.store.writeReceipt(subjectId, appId, instanceId, requestId, { ...binding, state: 'prepared' });
      let result;
      try { result = await handler({ subjectId, sessionId, appId, instanceId, requestId, input }); }
      catch (error) {
        await this.store.writeReceipt(subjectId, appId, instanceId, requestId, { ...binding, state: 'failed', errorKey: error.message, statusCode: error.statusCode ?? 500 });
        throw error;
      }
      const projected = JSON.parse(bridgeJson(result));
      if (capability === 'dgos.model.resolve' && ['providerConfigId', 'modelId', 'intent', 'descriptorVersion', 'profile', 'workflow', 'defaults', 'limits', 'uiSchemas', 'assets'].some((key) => projected[key] === undefined)) throw fail('invalid_bridge_json');
      await this.store.writeReceipt(subjectId, appId, instanceId, requestId, { ...binding, state: 'completed', result: projected });
      return projected;
    });
  }
  async syncActions(subjectId, appId, manifest, enabled) { if (this.onActionsChanged) { await this.onActionsChanged({ subjectId, appId, manifest, enabled }); await this.repository.markActionsSynced(subjectId, appId); } }
  async prepareMigration({ subjectId, appId, release, sourcePackageDigest, fromVersion, requestId }) {
    const specPath = release.manifest.dataMigration.entry;
    const content = await this.store.resourceFromRelease(release.manifest, release.digest, specPath);
    let spec; try { spec = JSON.parse(content.toString('utf8')); } catch { throw fail('data_migration_invalid'); }
    const key = (value) => typeof value === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(value) && !['constructor', 'prototype', '__proto__'].includes(value);
    if (!spec || Object.keys(spec).length !== 1 || !Array.isArray(spec.moves) || spec.moves.length > 100 || !spec.moves.every((item) => item && !Array.isArray(item) && Object.keys(item).length === 2 && key(item.from) && key(item.to) && item.from !== item.to)) throw fail('data_migration_invalid');
    const sources = spec.moves.map(({ from }) => from); const destinations = spec.moves.map(({ to }) => to);
    if (new Set(sources).size !== sources.length || new Set(destinations).size !== destinations.length || sources.some((source) => destinations.includes(source))) throw fail('data_migration_invalid');
    const before = await this.store.readData(subjectId, appId);
    const after = structuredClone(before);
    for (const move of spec.moves) if (Object.hasOwn(after, move.from)) { if (Object.hasOwn(after, move.to)) throw fail('data_migration_conflict', 409); after[move.to] = after[move.from]; delete after[move.from]; }
    const migrationId = randomUUID(); const beforeDigest = `sha256:${sha(canonicalJson(before))}`; const afterDigest = `sha256:${sha(canonicalJson(after))}`;
    const backup = this.store.dataFor(subjectId, appId) + `.backup-${migrationId}`;
    await writeFile(backup, canonicalJson(before), { flag: 'wx', mode: 0o600 });
    await this.repository.recordMigration({ migrationId, subjectId, appId, requestId, fromVersion, toVersion: release.manifest.dataVersion, sourcePackageDigest, targetPackageDigest: release.digest, beforeDigest, afterDigest });
    await this.store.writeData(subjectId, appId, after);
    return { migrationId, backup, afterDigest };
  }
  async rollbackMigration({ subjectId, appId, migration }) { const before = JSON.parse(await readFile(migration.backup, 'utf8')); await this.store.writeData(subjectId, appId, before); await this.repository.finishMigration(migration.migrationId, 'rolled_back'); }
  async recover({ subjectId, appId }, lockToken) {
    if (lockToken !== this.#lockToken) return this.repository.withLock(subjectId, appId, () => this.recover({ subjectId, appId }, this.#lockToken));
    return (async () => {
      const deployment = await this.repository.getDeployment(subjectId, appId);
      for (const migration of await this.repository.listPendingMigrations(subjectId, appId)) {
        const backup = this.store.dataFor(subjectId, appId) + `.backup-${migration.migrationId}`;
        const backupDigest = `sha256:${sha(await readFile(backup))}`;
        if (backupDigest !== migration.beforeDigest) throw fail('integrity_error');
        const currentDataDigest = `sha256:${sha(canonicalJson(await this.store.readData(subjectId, appId)))}`;
        if (currentDataDigest !== migration.afterDigest && currentDataDigest !== migration.beforeDigest) throw fail('integrity_error');
        if (currentDataDigest === migration.afterDigest && deployment?.state === 'active' && deployment.digest === migration.targetPackageDigest && deployment.previousDigest === migration.sourcePackageDigest && deployment.packageId && (await this.repository.getPackageById(deployment.packageId))?.manifest.dataVersion === migration.toVersion) await this.repository.finishMigration(migration.migrationId, 'committed', migration.afterDigest);
        else await this.rollbackMigration({ subjectId, appId, migration: { ...migration, backup } });
      }
      const pointer = await this.store.current(subjectId, appId);
      if (!deployment || deployment.state === 'uninstalled') { if (pointer) await this.store.removePointer(subjectId, appId); if (deployment && !deployment.actionsSynced) { const release = await this.repository.getPackageById(deployment.packageId); if (release) await this.syncActions(subjectId, appId, release.manifest, false); } await this.repository.settlePrepared(subjectId, appId); return { appId, state: 'uninstalled' }; }
      const release = await this.repository.getPackageById(deployment.packageId);
      if (!release || release.digest !== deployment.digest) throw fail('integrity_error');
      await this.store.check(release.manifest, release.digest);
      if (pointer?.digest !== deployment.digest) await this.store.switch(subjectId, appId, { manifest: release.manifest, digest: release.digest });
      if (!deployment.actionsSynced) await this.syncActions(subjectId, appId, release.manifest, true);
      await this.repository.settlePrepared(subjectId, appId);
      return { appId, state: 'active', digest: release.digest };
    })();
  }
  async recoverAll() { for (const target of await this.repository.listRecoveryTargets()) await this.recover(target); }
  async ready() { await this.recoverAll(); return this; }
  async getDeployment(subjectId, appId) { return this.repository.getDeployment(subjectId, appId); }
  async getAppDeployment(subjectId, appId) {
    const deployment = await this.repository.getDeployment(subjectId, appId);
    if (!deployment) throw fail('app_not_installed', 404);
    const active = deployment.state === 'uninstalled' ? null : await this.repository.getPackageById(deployment.packageId);
    if (deployment.state !== 'uninstalled' && (!active || active.digest !== deployment.digest)) throw fail('integrity_error');
    return { appId, state: deployment.state, versionNumber: deployment.versionNumber, dataRetained: deployment.dataRetained, activeRelease: active ? { version: active.version, build: active.build, releaseChannel: active.releaseChannel, digest: active.digest, dataVersion: active.manifest.dataVersion } : null, ...(deployment.updatedAt ? { updatedAt: deployment.updatedAt } : {}) };
  }
  async installBundled({ envelope, subjectId, actorId, requestId }) {
    const checked = verifyPackage(envelope, this.trustRoots, this.packageLimits);
    if (checked.source !== 'official') throw fail('untrusted_package', 403);
    const release = await this.submit({ ...envelope, requestId: envelope.requestId ?? requestId, actorId });
    if (release.catalogState !== 'official') throw fail('untrusted_package', 403);
    return this.install({ subjectId, appId: release.appId, version: release.version, build: release.build, releaseChannel: release.releaseChannel, actorId, requestId });
  }
}
