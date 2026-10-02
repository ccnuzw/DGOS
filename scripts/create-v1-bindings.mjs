#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

const requiredRuntimeConfig = [
  'docker-compose.production.yml', 'docker-compose.integration.yml',
  'deployment/Dockerfile', 'deployment/Caddyfile',
  'scripts/v1-ops-api.mjs', 'scripts/v1-ops-worker.mjs',
  'apps/api/src/server.mjs', 'apps/worker/src/worker.mjs',
  'scripts/v1-ui-management-fixture.mjs',
  'src/extensions/v1-default-runtime.json',
  '.herdr/state/package-fixture-r9/trust-roots.json',
  '.herdr/state/integration-trust-roots-r9.json',
];

const envelopePath = '.herdr/state/package-fixture-r9/ai-workbench-envelope.json';
const distRoot = 'apps/web/dist';

async function walkDirectory(dirPath, baseRoot = dirPath) {
  const files = {};

  async function walk(dir, prefix = '') {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath, relative);
      } else if (entry.isFile()) {
        const relativePath = `${baseRoot}/${relative}`;
        const content = await readFile(fullPath);
        files[relativePath] = digest(content);
      }
    }
  }

  await walk(resolve(root, dirPath));
  return files;
}

async function collectSourceHashes() {
  const sourceFiles = [];

  // Collect all .mjs files from apps and src
  async function collectMjs(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== 'target') {
        await collectMjs(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
        sourceFiles.push(fullPath);
      }
    }
  }

  await collectMjs(resolve(root, 'apps'));
  await collectMjs(resolve(root, 'src'));

  // Calculate combined hash
  const hashes = [];
  for (const file of sourceFiles.sort()) {
    const content = await readFile(file);
    hashes.push(digest(content));
  }

  return digest(hashes.join('\n'));
}

async function collectMigrationChecksums() {
  const migrations = [];
  const migrationDir = resolve(root, 'migrations');
  const entries = await readdir(migrationDir);

  for (const file of entries.sort()) {
    if (!file.endsWith('.sql')) continue;
    const content = await readFile(join(migrationDir, file));
    migrations.push({
      file: `migrations/${file}`,
      checksum: digest(content)
    });
  }

  return migrations;
}

async function main() {
  console.log('Creating V1 candidate bindings...');

  // Collect config files
  console.log('Collecting config files...');
  const configFiles = {};
  for (const path of requiredRuntimeConfig) {
    const content = await readFile(resolve(root, path));
    configFiles[path] = digest(content);
  }

  // Collect envelope
  console.log('Collecting envelope...');
  const envelopeContent = await readFile(resolve(root, envelopePath));
  const envelopeHash = digest(envelopeContent);

  // Collect dist files
  console.log('Collecting dist files...');
  const distFiles = await walkDirectory(distRoot);

  // Collect source hash
  console.log('Calculating build hash...');
  const buildSha256 = await collectSourceHashes();

  // Collect migration checksums
  console.log('Collecting migration checksums...');
  const migrations = await collectMigrationChecksums();

  // Check for native binary (optional)
  let nativeApp = undefined;
  const nativeRoot = 'apps/desktop/src-tauri/target/debug/bundle/macos/DGOS.app';
  try {
    console.log('Checking for native binary...');
    const nativeFiles = await walkDirectory(nativeRoot);
    nativeApp = {
      id: `native-app-${createHash('sha256').update(JSON.stringify(nativeFiles)).digest('hex').slice(0, 8)}`,
      root: nativeRoot,
      files: nativeFiles
    };
    console.log('Native binary found');
  } catch (err) {
    console.log('Native binary not found (optional)');
  }

  // Create image binding (using build hash as image identifier)
  const imageSha256 = createHash('sha256').update(buildSha256 + envelopeHash + JSON.stringify(configFiles) + JSON.stringify(distFiles)).digest('hex');

  const bindings = {
    build_sha256: buildSha256,
    runtime_assets: {
      config: {
        id: `config-${createHash('sha256').update(JSON.stringify(configFiles)).digest('hex').slice(0, 8)}`,
        files: configFiles
      },
      envelope: {
        id: `envelope-${envelopeHash.slice(0, 8)}`,
        path: envelopePath,
        sha256: envelopeHash
      },
      dist: {
        id: `dist-${createHash('sha256').update(JSON.stringify(distFiles)).digest('hex').slice(0, 8)}`,
        root: distRoot,
        files: distFiles
      },
      image: {
        id: `sha256:${imageSha256}`,
        sha256: imageSha256
      }
    },
    metadata: {
      commit: '65d6f58',
      created_at: new Date().toISOString(),
      migration_count: migrations.length,
      config_file_count: Object.keys(configFiles).length,
      dist_file_count: Object.keys(distFiles).length
    },
    migrations
  };

  if (nativeApp) {
    bindings.runtime_assets.native_app = nativeApp;
    bindings.metadata.native_file_count = Object.keys(nativeApp.files).length;
  }

  const outputPath = '.herdr/v1-candidate-bindings-65d6f58.json';
  await writeFile(outputPath, JSON.stringify(bindings, null, 2) + '\n');

  console.log(`\nBindings created: ${outputPath}`);
  console.log(`Build SHA256: ${buildSha256}`);
  console.log(`Image SHA256: ${imageSha256}`);
  console.log(`Config files: ${Object.keys(configFiles).length}`);
  console.log(`Dist files: ${Object.keys(distFiles).length}`);
  console.log(`Migrations: ${migrations.length}`);
  if (nativeApp) {
    console.log(`Native files: ${Object.keys(nativeApp.files).length}`);
  }

  console.log(`\nReady to run: node scripts/v1-candidate-run.mjs --bindings ${outputPath}`);
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exitCode = 1;
});
