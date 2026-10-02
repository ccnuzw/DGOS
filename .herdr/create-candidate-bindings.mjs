import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { sourceIdentity } from '../scripts/verify-release.mjs';
import { verifyRuntimeAssets } from '../scripts/v1-regression-sweep.mjs';

// Lead-only local candidate inventory. This records real bytes, never approvals.
const image = process.argv[2];
if (!/^sha256:[0-9a-f]{64}$/.test(image ?? '')) throw new Error('exact existing Docker image ID required');
const imageId = execFileSync('docker', ['image', 'inspect', image, '--format', '{{.Id}}'], { encoding: 'utf8' }).trim();
if (imageId !== image) throw new Error('image identity mismatch');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = async file => sha(await readFile(file));
const configPaths = [
  'docker-compose.production.yml', 'docker-compose.integration.yml',
  'deployment/Dockerfile', 'deployment/Caddyfile',
  'scripts/v1-ops-api.mjs', 'scripts/v1-ops-worker.mjs',
  'apps/api/src/server.mjs', 'apps/worker/src/worker.mjs',
  'scripts/v1-ui-management-fixture.mjs', 'src/extensions/v1-default-runtime.json',
  '.herdr/state/package-fixture-r9/trust-roots.json', '.herdr/state/integration-trust-roots-r9.json',
];
const tree = async root => {
  const files = {};
  const walk = async dir => {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) files[file] = await hash(file);
      else throw new Error(`unsupported artifact entry: ${file}`);
    }
  };
  await walk(root);
  return { id: root, root, files };
};
const before = await sourceIdentity();
const envelope = '.herdr/state/package-fixture-r9/ai-workbench-envelope.json';
const runtime_assets = {
  config: { id: 'V1-candidate-runtime-inputs', files: Object.fromEntries(await Promise.all(configPaths.map(async file => [file, await hash(file)]))) },
  envelope: { id: 'dgos.ai-workbench-1.0.1-build2', path: envelope, sha256: await hash(envelope) },
  dist: await tree('apps/web/dist'),
  native_app: await tree('apps/desktop/src-tauri/target/debug/bundle/macos/DGOS.app'),
  image: { id: imageId, sha256: imageId.slice(7) },
};
const issues = await verifyRuntimeAssets(runtime_assets);
if (issues.length) throw new Error(issues.join('\n'));
const after = await sourceIdentity();
if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('source changed during candidate inventory');
const binding = { build_sha256: sha(JSON.stringify(runtime_assets)), runtime_assets, source_identity_at_freeze: after, recorded_at: new Date().toISOString(), limitations: ['Local uncommitted candidate inventory; image security disposition and formal release conditions remain separate.'] };
const output = '.herdr/state/v1-final-candidate-bindings.json';
await writeFile(output, `${JSON.stringify(binding, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ output, build_sha256: binding.build_sha256, source_identity: after, image: imageId, dist_files: Object.keys(runtime_assets.dist.files).length, native_files: Object.keys(runtime_assets.native_app.files).length }));
