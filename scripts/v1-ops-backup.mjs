import { cp, lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const [source, destination] = process.argv.slice(2);
if (!source || !destination || path.resolve(source) === path.resolve(destination) || path.resolve(destination).startsWith(`${path.resolve(source)}${path.sep}`)) throw new Error('usage: node scripts/v1-ops-backup.mjs CIPHERTEXT_DIR NEW_BACKUP_DIR');
const sourceInfo = await lstat(source);
if (!sourceInfo.isDirectory() || sourceInfo.mode & 0o077) throw new Error('ciphertext_directory_insecure');
try { await lstat(destination); throw new Error('backup_destination_must_be_new'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(destination, { mode: 0o700 });
const records = [];
for (const name of await readdir(source)) {
  if (!/^[a-f0-9]{64}\.json$/.test(name)) throw new Error('ciphertext_directory_busy_or_invalid');
  const from = path.join(source, name);
  const info = await lstat(from);
  if (!info.isFile() || info.mode & 0o077) throw new Error('ciphertext_file_insecure');
  const bytes = await readFile(from);
  const record = JSON.parse(bytes.toString('utf8'));
  if (record.format !== 2 || record.keyId === undefined || record.ciphertext === undefined || record.value !== undefined || createHash('sha256').update(record.secretRef).digest('hex') + '.json' !== name) throw new Error('ciphertext_record_invalid');
  await cp(from, path.join(destination, name), { errorOnExist: true, force: false });
  records.push({ name, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile(path.join(destination, 'manifest.json'), JSON.stringify({ format: 1, records }, null, 2), { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ records: records.length, destination: path.resolve(destination) }));
