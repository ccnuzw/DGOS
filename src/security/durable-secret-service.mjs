import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';

const hash = (text) => createHash('sha256').update(text).digest('hex');
const text = (value, name) => { if (typeof value !== 'string' || !value || value.length > 1024) throw new TypeError(`${name} must be nonempty text`); };
const unavailable = () => new Error('credential_unavailable');
const safeKeyId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id);
const recordName = /^[a-f0-9]{64}\.json$/;
const tempName = /^([a-f0-9]{64}\.json)\.[a-f0-9]{24}\.tmp$/;
const aad = (record) => JSON.stringify({ format: record.format, secretRef: record.secretRef, purpose: record.purpose, subjectId: record.subjectId, version: record.version, expiresAt: record.expiresAt, revoked: record.revoked, keyId: record.keyId, digest: record.digest });

async function checkPrivate(location, type) {
  const info = await lstat(location);
  if ((type === 'directory' && !info.isDirectory()) || (type === 'file' && !info.isFile()) || (info.mode & 0o077)) throw new Error('secret_configuration_invalid');
  return info;
}

// Key files are provisioned out of band, separate from the ciphertext directory and backups.
export function createFileRootKeyHandle({ keyDirectory }) {
  text(keyDirectory, 'keyDirectory');
  async function keyFor(id) {
    if (!safeKeyId(id)) throw new Error('secret_key_unavailable');
    await checkPrivate(keyDirectory, 'directory');
    const keyFile = path.join(keyDirectory, `${id}.key`);
    await checkPrivate(keyFile, 'file');
    const encoded = (await readFile(keyFile, 'utf8')).trim();
    const key = Buffer.from(encoded, 'base64url');
    if (key.length !== 32 || key.toString('base64url') !== encoded) throw new Error('secret_key_unavailable');
    return key;
  }
  return {
    async getCurrentKey() {
      await checkPrivate(keyDirectory, 'directory');
      const currentFile = path.join(keyDirectory, 'current');
      await checkPrivate(currentFile, 'file');
      const keyId = (await readFile(currentFile, 'utf8')).trim();
      return { keyId, key: await keyFor(keyId) };
    },
    getKey: keyFor,
  };
}

export class DurableSecretService {
  constructor({ directory, rootKeyHandle, clock = () => Date.now(), handleTtlMs = 5000, auditAccess } = {}) {
    text(directory, 'directory');
    if (!rootKeyHandle?.getCurrentKey || !rootKeyHandle?.getKey) throw new Error('secret_configuration_invalid');
    if (!Number.isSafeInteger(handleTtlMs) || handleTtlMs < 1 || handleTtlMs > 60_000) throw new Error('secret_configuration_invalid');
    this.directory = directory;
    this.rootKeyHandle = rootKeyHandle;
    this.clock = clock;
    this.handleTtlMs = handleTtlMs;
    this.auditAccess = auditAccess;
  }

  async ready() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await this.checkReady();
    return this;
  }

  async checkReady() {
    try { await checkPrivate(this.directory, 'directory'); await readdir(this.directory); await this.#key(true); }
    catch { throw unavailable(); }
  }

  #file(secretRef) { text(secretRef, 'secretRef'); return path.join(this.directory, `${hash(secretRef)}.json`); }
  async #key(current, id) {
    try {
      const result = current ? await this.rootKeyHandle.getCurrentKey() : { keyId: id, key: await this.rootKeyHandle.getKey(id) };
      if (!safeKeyId(result.keyId) || !Buffer.isBuffer(result.key) || result.key.length !== 32) throw unavailable();
      return result;
    } catch { throw unavailable(); }
  }
  async #record(file) {
    try {
      await checkPrivate(file, 'file');
      const record = JSON.parse(await readFile(file, 'utf8'));
      if (![1, 2].includes(record.format) || !Number.isSafeInteger(record.version) || record.version < 1 || !Number.isSafeInteger(record.expiresAt) || typeof record.revoked !== 'boolean' || !safeKeyId(record.keyId) || !/^[a-f0-9]{64}$/.test(record.digest)) throw unavailable();
      if (typeof record.secretRef !== 'string' || `${hash(record.secretRef)}.json` !== path.basename(file)) throw unavailable();
      return record;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw unavailable();
    }
  }
  async #locked(file, fn) {
    try { await checkPrivate(this.directory, 'directory'); } catch { throw unavailable(); }
    const lock = `${file}.lock`;
    let acquired = false;
    let sawExisting = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { await mkdir(lock, { mode: 0o700 }); acquired = true; break; }
      catch (error) { if (error.code !== 'EEXIST') throw unavailable(); sawExisting = true; await new Promise((resolve) => setTimeout(resolve, 10)); }
    }
    if (!acquired) throw unavailable();
    try { return await fn({ sawExisting }); }
    finally { await rm(lock, { recursive: true, force: true }); }
  }
  async #write(file, record) {
    const temp = `${file}.${randomBytes(12).toString('hex')}.tmp`;
    let handle;
    try {
      handle = await open(temp, 'wx', 0o600);
      await handle.writeFile(JSON.stringify(record));
      await handle.sync();
      await handle.close(); handle = null;
      await rename(temp, file);
      const dir = await open(this.directory, 'r');
      try { await dir.sync(); } finally { await dir.close(); }
    } catch { throw unavailable(); }
    finally { await handle?.close(); await rm(temp, { force: true }); }
  }
  #encrypt(value, key, metadata) {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(Buffer.from(aad(metadata)));
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return { nonce: nonce.toString('base64url'), ciphertext: ciphertext.toString('base64url'), tag: cipher.getAuthTag().toString('base64url') };
  }
  async #decrypt(record, { allowLegacy = false } = {}) {
    try {
      if (record.format !== 2 && !allowLegacy) throw unavailable();
      const { key } = await this.#key(false, record.keyId);
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(record.nonce, 'base64url'));
      decipher.setAAD(Buffer.from(record.format === 1 ? JSON.stringify({ secretRef: record.secretRef, purpose: record.purpose, subjectId: record.subjectId, version: record.version, expiresAt: record.expiresAt }) : aad(record)));
      decipher.setAuthTag(Buffer.from(record.tag, 'base64url'));
      const value = Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64url')), decipher.final()]).toString('utf8');
      if (hash(value) !== record.digest) throw unavailable();
      return value;
    } catch { throw unavailable(); }
  }

  async #audit(operation, { secretRef, purpose, subjectId, version, requestId } = {}) {
    if (!this.auditAccess) return;
    try {
      await this.auditAccess({ operation, secretRefDigest: hash(secretRef), purpose, subjectDigest: hash(subjectId), version, requestId: requestId ?? randomUUID() });
    } catch { throw unavailable(); }
  }

  async put({ secretRef, value, purpose, subjectId, ttlMs = 60_000, expectedVersion, requestId } = {}) {
    for (const [name, input] of Object.entries({ secretRef, value, purpose, subjectId })) text(input, name);
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || this.clock() + ttlMs > Number.MAX_SAFE_INTEGER) throw new RangeError('ttlMs must be a positive safe integer');
    const file = this.#file(secretRef);
    return this.#locked(file, async () => {
      const previous = await this.#record(file);
      if (expectedVersion !== undefined && expectedVersion !== (previous?.version ?? 0)) throw new Error('version_conflict');
      if (previous && (previous.purpose !== purpose || previous.subjectId !== subjectId)) throw new Error('credential_scope_denied');
      if (previous) await this.#decrypt(previous);
      const { keyId, key } = await this.#key(true);
      const metadata = { format: 2, secretRef, purpose, subjectId, version: (previous?.version ?? 0) + 1, expiresAt: this.clock() + ttlMs, revoked: false, keyId, digest: hash(value) };
      const encrypted = this.#encrypt(value, key, metadata);
      await this.#audit('put', { secretRef, purpose, subjectId, version: metadata.version, requestId });
      await this.#write(file, { ...metadata, ...encrypted });
      return { secretRef, version: metadata.version, credentialState: 'available' };
    });
  }

  async resolve({ secretRef, purpose, subjectId, requestId } = {}) {
    for (const [name, input] of Object.entries({ secretRef, purpose, subjectId })) text(input, name);
    if (requestId !== undefined) text(requestId, 'requestId');
    const file = this.#file(secretRef);
    const record = await this.#locked(file, () => this.#record(file));
    if (record) await this.#decrypt(record);
    if (!record || record.revoked || record.expiresAt <= this.clock()) throw unavailable();
    if (record.secretRef !== secretRef || record.purpose !== purpose || record.subjectId !== subjectId) throw new Error('credential_scope_denied');
    const version = record.version;
    const expiresAt = Math.min(record.expiresAt, this.clock() + this.handleTtlMs);
    await this.#audit('resolve', { secretRef, purpose, subjectId, version, requestId });
    return { secretRef, version, expiresAt, read: async (readRequestId = requestId) => {
      if (requestId !== undefined && readRequestId !== requestId) throw new Error('credential_scope_denied');
      return this.#locked(file, async () => {
        const current = await this.#record(file);
        if (!current || current.revoked || current.version !== version || current.expiresAt <= this.clock() || expiresAt <= this.clock()) throw unavailable();
        if (current.secretRef !== secretRef || current.purpose !== purpose || current.subjectId !== subjectId) throw new Error('credential_scope_denied');
        const value = await this.#decrypt(current);
        await this.#audit('read', { secretRef, purpose, subjectId, version, requestId: readRequestId });
        return value;
      });
    } };
  }

  async revoke(secretRef, { requestId } = {}) {
    const file = this.#file(secretRef);
    return this.#locked(file, async () => {
      const record = await this.#record(file);
      if (!record) return;
      const value = await this.#decrypt(record);
      if (record.revoked) return;
      const { keyId, key } = await this.#key(true);
      const next = { ...record, format: 2, version: record.version + 1, revoked: true, keyId };
      await this.#audit('revoke', { secretRef, purpose: record.purpose, subjectId: record.subjectId, version: next.version, requestId });
      await this.#write(file, { ...next, ...this.#encrypt(value, key, next) });
    });
  }

  async inspect(secretRef, { requestId } = {}) {
    const file = this.#file(secretRef);
    return this.#locked(file, async () => {
      const record = await this.#record(file);
      if (!record) return { credentialState: 'missing' };
      await this.#decrypt(record);
      await this.#audit('inspect', { secretRef, purpose: record.purpose, subjectId: record.subjectId, version: record.version, requestId });
      return { credentialState: record.revoked || record.expiresAt <= this.clock() ? 'unavailable' : 'available', version: record.version, digest: record.digest };
    });
  }

  async rewrap() {
    const { keyId, key } = await this.#key(true);
    let changed = 0;
    for (const name of await readdir(this.directory)) {
      if (!/^[a-f0-9]{64}\.json$/.test(name)) continue;
      const file = path.join(this.directory, name);
      await this.#locked(file, async () => {
        const record = await this.#record(file);
        if (!record || record.keyId === keyId) return;
        const value = await this.#decrypt(record);
        const next = { ...record, keyId };
        await this.#write(file, { ...next, ...this.#encrypt(value, key, next) });
        changed++;
      });
    }
    return { changed, keyId };
  }

  async verifyCiphertext() {
    let verified = 0;
    const checked = new Set();
    for (const name of await readdir(this.directory)) {
      const base = recordName.test(name) ? name : name.endsWith('.lock') ? name.slice(0, -5) : tempName.exec(name)?.[1];
      if (!base || !recordName.test(base)) throw unavailable();
      if (checked.has(base)) continue;
      const file = path.join(this.directory, base);
      await this.#locked(file, async ({ sawExisting }) => {
        if (name.endsWith('.lock') && !sawExisting) throw unavailable();
        const entries = await readdir(this.directory);
        if (entries.some((entry) => entry.startsWith(`${base}.`) && entry.endsWith('.tmp'))) throw unavailable();
        const record = await this.#record(file);
        if (!record || `${hash(record.secretRef)}.json` !== base) throw unavailable();
        await this.#decrypt(record);
        verified++;
      });
      checked.add(base);
    }
    return { verified };
  }

  async migrateLegacy({ trustLegacyControlState = false, reviewedRecordDigests = [] } = {}) {
    if (trustLegacyControlState !== true || !Array.isArray(reviewedRecordDigests)) throw new Error('legacy_state_review_required');
    const { keyId, key } = await this.#key(true);
    let migrated = 0;
    for (const name of await readdir(this.directory)) {
      if (!recordName.test(name)) continue;
      const file = path.join(this.directory, name);
      await this.#locked(file, async () => {
        const record = await this.#record(file);
        if (!record || record.format === 2) return;
        if (!reviewedRecordDigests.includes(name.slice(0, 64))) throw new Error('legacy_state_review_required');
        if (hash(record.secretRef) + '.json' !== name) throw unavailable();
        const value = await this.#decrypt(record, { allowLegacy: true });
        const next = { ...record, format: 2, version: record.version + 1, keyId };
        await this.#write(file, { ...next, ...this.#encrypt(value, key, next) });
        migrated++;
      });
    }
    return { migrated };
  }
}
