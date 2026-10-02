import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createFileRootKeyHandle, DurableSecretService } from '../src/security/durable-secret-service.mjs';

const [backup, destination, keyDirectory] = process.argv.slice(2);
if (!backup || !destination || !keyDirectory) throw new Error('usage: node scripts/v1-ops-restore.mjs BACKUP_DIR NEW_CIPHERTEXT_DIR INDEPENDENT_KEY_DIR');
try { await lstat(destination); throw new Error('restore_destination_must_be_new'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const manifest = JSON.parse(await readFile(path.join(backup, 'manifest.json'), 'utf8'));
if (manifest.format !== 1 || !Array.isArray(manifest.records)) throw new Error('backup_manifest_invalid');
const files = [];
for (const item of manifest.records) {
  if (!/^[a-f0-9]{64}\.json$/.test(item.name) || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error('backup_manifest_invalid');
  const file = path.join(backup, item.name);
  const info = await lstat(file);
  if (!info.isFile() || info.mode & 0o077) throw new Error('backup_file_insecure');
  const bytes = await readFile(file);
  if (createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw new Error('backup_integrity_failed');
  const record = JSON.parse(bytes.toString('utf8'));
  if (record.format !== 2 || record.value !== undefined || !record.keyId) throw new Error('backup_record_invalid');
  files.push({ file, name: item.name, keyId: record.keyId });
}
const keys = createFileRootKeyHandle({ keyDirectory });
await keys.getCurrentKey();
for (const file of files) await keys.getKey(file.keyId);
await mkdir(destination, { mode: 0o700 });
for (const file of files) await cp(file.file, path.join(destination, file.name), { errorOnExist: true, force: false });
const service = await new DurableSecretService({ directory: destination, rootKeyHandle: keys }).ready();
const validation = await service.verifyCiphertext();
console.log(JSON.stringify({ state: 'restored_read_only_validation_required', records: validation.verified, destination: path.resolve(destination) }));
