import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { DiskPackageStore } from './package-service.mjs';

export function packageRuntimeConfig({ env = process.env, trustRoots, store } = {}) {
  let roots = trustRoots;
  if (!roots && env.DGOS_PACKAGE_TRUST_ROOTS_FILE) {
    if (!isAbsolute(env.DGOS_PACKAGE_TRUST_ROOTS_FILE)) throw new Error('package_configuration_invalid');
    const parsed = JSON.parse(readFileSync(env.DGOS_PACKAGE_TRUST_ROOTS_FILE, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error('package_configuration_invalid');
    roots = new Map();
    for (const root of parsed) {
      if (!root || typeof root.keyId !== 'string' || roots.has(root.keyId) || typeof root.publicKey !== 'string' || !['official', 'admin', 'developer'].includes(root.source)) throw new Error('package_configuration_invalid');
      roots.set(root.keyId, root);
    }
  }
  if (env.NODE_ENV === 'production' && (!roots?.size || (!store && !env.DGOS_PACKAGE_ROOT))) throw new Error('package_configuration_invalid');
  let temporaryRoot;
  if (!store) {
    if (env.DGOS_DATABASE_URL && !env.DGOS_PACKAGE_ROOT) throw new Error('package_configuration_invalid: persistent package root required');
    const root = env.DGOS_PACKAGE_ROOT ?? (temporaryRoot = mkdtempSync(join(tmpdir(), 'dgos-packages-')));
    if (!isAbsolute(root)) throw new Error('package_configuration_invalid');
    store = new DiskPackageStore(root);
  }
  return { trustRoots: roots ?? new Map(), store, temporaryRoot };
}
