import { access, lstat, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createFileRootKeyHandle, DurableSecretService } from './durable-secret-service.mjs';
import { PostgresAuditRepository } from '../audit/outbox.mjs';

const invalid = () => { throw new Error('production_configuration_invalid'); };
const placeholder = (value) => /(?:change.?me|example|placeholder|fixture|development|localhost|127\.0\.0\.1)/i.test(value);

export function validateProductionConfig(env = process.env) {
  if (env.NODE_ENV !== 'production' || env.DGOS_SECRET_BACKEND !== 'encrypted-file') invalid();
  if (env.DGOS_ALLOW_INSECURE_FIXTURE || env.DGOS_FIXTURE_BASE_URL || env.SECRET_BACKEND || env.DGOS_DEBUG) invalid();
  for (const name of ['DGOS_DATABASE_URL', 'REDIS_URL', 'DGOS_SECRET_DIRECTORY', 'DGOS_ROOT_KEY_DIRECTORY', 'DGOS_PUBLIC_ORIGIN', 'DGOS_PACKAGE_ROOT', 'DGOS_PACKAGE_TRUST_ROOTS_FILE', 'DGOS_EXTENSION_CONFIG_FILE']) {
    if (!env[name] || placeholder(env[name])) invalid();
  }
  let origin, database, redis;
  try { origin = new URL(env.DGOS_PUBLIC_ORIGIN); database = new URL(env.DGOS_DATABASE_URL); redis = new URL(env.REDIS_URL); }
  catch { invalid(); }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) invalid();
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.password || placeholder(database.password) || database.password === database.username || database.password === 'dgos') invalid();
  if (redis.protocol !== 'redis:') invalid();
  if (!path.isAbsolute(env.DGOS_SECRET_DIRECTORY) || !path.isAbsolute(env.DGOS_ROOT_KEY_DIRECTORY)) invalid();
  const secretRoot = path.resolve(env.DGOS_SECRET_DIRECTORY);
  const keyRoot = path.resolve(env.DGOS_ROOT_KEY_DIRECTORY);
  if (secretRoot === keyRoot || !path.relative(secretRoot, keyRoot).startsWith('..') || !path.relative(keyRoot, secretRoot).startsWith('..')) invalid();
  if (!path.isAbsolute(env.DGOS_PACKAGE_ROOT) || !path.isAbsolute(env.DGOS_PACKAGE_TRUST_ROOTS_FILE) || !path.isAbsolute(env.DGOS_EXTENSION_CONFIG_FILE)) invalid();
  return { secretDirectory: env.DGOS_SECRET_DIRECTORY, rootKeyDirectory: env.DGOS_ROOT_KEY_DIRECTORY, packageRoot: env.DGOS_PACKAGE_ROOT, packageTrustRootsFile: env.DGOS_PACKAGE_TRUST_ROOTS_FILE, extensionConfigFile: env.DGOS_EXTENSION_CONFIG_FILE, publicOrigin: origin.origin };
}

export async function validateProductionPackageResources(config) {
  try {
    const root = await lstat(config.packageRoot);
    const rootsFile = await lstat(config.packageTrustRootsFile);
    if (!root.isDirectory() || !rootsFile.isFile()) invalid();
    await access(config.packageRoot, constants.R_OK | constants.W_OK | constants.X_OK);
    await access(config.packageTrustRootsFile, constants.R_OK);
    const roots = JSON.parse(await readFile(config.packageTrustRootsFile, 'utf8'));
    if (!Array.isArray(roots) || roots.length === 0) invalid();
    const extensionFile = await lstat(config.extensionConfigFile);
    if (!extensionFile.isFile()) invalid();
    const extension = JSON.parse(await readFile(config.extensionConfigFile, 'utf8'));
    if (extension.version !== 1 || !Array.isArray(extension.sources) || extension.sources.length === 0) invalid();
  } catch { invalid(); }
}

export async function createProductionSecretService({ env = process.env, rootKeyHandle, auditAccess } = {}) {
  const config = validateProductionConfig(env);
  await validateProductionPackageResources(config);
  const keyDirectory = config.rootKeyDirectory;
  const keys = rootKeyHandle ?? createFileRootKeyHandle({ keyDirectory });
  if (!rootKeyHandle) {
    const directory = await lstat(keyDirectory);
    if (!directory.isDirectory() || (directory.mode & 0o077)) invalid();
  }
  const service = new DurableSecretService({ directory: config.secretDirectory, rootKeyHandle: keys, auditAccess });
  await service.ready();
  await service.verifyCiphertext();
  return service;
}

export function createProductionSecretAuditAccess(pool) {
  if (!pool?.query) invalid();
  const audit = new PostgresAuditRepository(pool);
  return async ({ operation, secretRefDigest, purpose, subjectDigest, version, requestId }) => {
    const digest = createHash('sha256').update(requestId).digest('hex');
    const auditRequestId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
      ? requestId : `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
    await audit.record({ requestId: auditRequestId, action: `secret.${operation}.requested`, targetType: 'secret_ref_digest', summary: { secretRefDigest, purpose, subjectDigest, version }, result: 'attempted' });
  };
}
