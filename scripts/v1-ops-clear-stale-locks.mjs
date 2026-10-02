import { lstat, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const [directory, confirmation] = process.argv.slice(2);
if (!directory || confirmation !== '--all-processes-stopped') throw new Error('usage: node scripts/v1-ops-clear-stale-locks.mjs CIPHERTEXT_DIR --all-processes-stopped');
const info = await lstat(directory);
if (!info.isDirectory() || info.mode & 0o077) throw new Error('ciphertext_directory_insecure');
let cleared = 0;
for (const name of await readdir(directory)) {
  if (!/^[a-f0-9]{64}\.json\.lock$/.test(name)) continue;
  const lock = path.join(directory, name);
  if (!(await lstat(lock)).isDirectory()) throw new Error('lock_invalid');
  await rm(lock, { recursive: true });
  cleared++;
}
console.log(JSON.stringify({ cleared }));
