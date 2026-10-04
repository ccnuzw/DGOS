import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverMigrations } from '../../../scripts/migrate.mjs';
import { verifyPackage } from '../../../src/apps/package-service.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const fixtureDir = path.resolve(process.env.DGOS_DESKTOP_CANDIDATE_DIR ?? path.join(root, '.herdr/state/package-fixture-r9'));
const appBinary = path.join(root, 'apps/desktop/src-tauri/target/debug/bundle/macos/DGOS.app/Contents/MacOS/dgos-desktop');
const distDir = path.join(root, 'apps/web/dist');
const frozen = new Map([
  ['0045-network-route-activation', 'c2bc2a47a3360e47b02d4edd9880b88694ec3ab84cdf7613674cd2099d40040d'],
  ['0046-package-retention', '7321916de0ddff31f40d48b837acada75d8ec893691c7c65f22d0b707d6a9a83'],
  ['0047-ai-task-parameters', '22b6e9e886943f2b660de4d54989e0587c58cb67e373fbd45b7140849f6f15f6'],
  ['0048-network-route-fingerprint', '7879e6cf17753fa82254675756fbeb1fdfb9ad67e11808aec8922cd2f10cd33d'],
  ['0049-extension-management', 'ba0bc80a0ccc74e05a5244b50e52e6a26df39ad854995ba038020b7d5d954f1b'],
  ['0050-session-management', '8802fe3a02b0bf7364aeac96215da09454d0c53b48c06d2cb76c6f3d6b455d85'],
  ['0051-proxy-provisioning', '778fddef654d67bc3ecfc01e11fd91f826f91d68a5b6c5c72568b5e35cca1939'],
]);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const files = (directory, prefix = '') => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const name = path.posix.join(prefix, entry.name);
  return entry.isDirectory() ? files(path.join(directory, entry.name), name) : [name];
});

export async function desktopCandidatePreflight() {
  const migrations = (await discoverMigrations()).filter(({ version }) => Number(version.slice(0, 4)) <= 51);
  assert.equal(migrations.length, 47, 'frozen47_migrations_required');
  assert.equal(migrations.at(-1).version, '0051-proxy-provisioning');
  for (const [version, checksum] of frozen) assert.equal(migrations.find((item) => item.version === version)?.checksum, checksum, `frozen_checksum:${version}`);

  const envelopeFile = path.join(fixtureDir, 'ai-workbench-envelope.json');
  const rootsFile = path.join(fixtureDir, 'trust-roots.json');
   if (process.env.DGOS_DESKTOP_CANDIDATE_ALLOW_DRIFT !== '1') {
     assert.equal(sha256(readFileSync(envelopeFile)), '3284e22b7c56639c94c78dcbb11b64d516a7f9f5c424c0b612e48a3e640f5122', 'frozen_envelope_required');
     assert.equal(sha256(readFileSync(rootsFile)), '4e84d35231ba4ffa4a5ba0117a3c01604c3434f8495c26fbad32d5277c0e4342', 'frozen_trust_roots_required');
   }
  const envelope = JSON.parse(readFileSync(envelopeFile, 'utf8'));
  const roots = JSON.parse(readFileSync(rootsFile, 'utf8'));
  const trustRoot = roots.find((item) => item.keyId === envelope.keyId);
  assert.equal(trustRoot?.source, 'official', 'official_workbench_root_required');
  const checked = verifyPackage(envelope, new Map([[trustRoot.keyId, trustRoot]]));
  assert.equal(envelope.manifest.appId, 'dgos.ai-workbench');
  assert.equal(envelope.manifest.version, '1.0.1');
  assert.equal(envelope.manifest.build, 2);
   if (process.env.DGOS_DESKTOP_CANDIDATE_ALLOW_DRIFT !== '1') assert.equal(checked.digest, 'sha256:9c4cd6cb8edeca071794e27f3e52b4c0c9bed6b60f7a066551376384a46591fa');
  for (const [name, bytes] of checked.files) {
    const source = name === 'tokens.css' ? path.join(root, 'packages/design-tokens/src/tokens.css') : path.join(root, 'apps/ai-workbench-package', name);
    assert.equal(sha256(readFileSync(source)), sha256(bytes), `signed_resource_drift:${name}`);
  }

  const dist = Object.fromEntries(files(distDir).sort().map((name) => [name, sha256(readFileSync(path.join(distDir, name)))]));
  const html = readFileSync(path.join(distDir, 'index.html'), 'utf8');
  const assetNames = [...html.matchAll(/(?:src|href)="(?:\.\/)?(assets\/[^"?#]+)"/g)].map((match) => match[1]);
  assert.ok(assetNames.some((name) => name.endsWith('.js')) && assetNames.some((name) => name.endsWith('.css')), 'dist_entry_assets_required');
  const binary = readFileSync(appBinary);
  for (const asset of assetNames) assert.ok(binary.includes(Buffer.from(`/${asset}`)), `native_bundle_dist_mismatch:${asset}`);
  return { migrations, envelope, trustRoot, packageDigest: checked.digest, envelopeSha256: sha256(readFileSync(envelopeFile)),
    trustRootsSha256: sha256(readFileSync(rootsFile)), dist, embeddedAssetNames: assetNames, appSha256: sha256(binary) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const result = await desktopCandidatePreflight();
    console.log(JSON.stringify({ result: 'passed', migrationCount: result.migrations.length, finalMigration: result.migrations.at(-1).version,
      packageDigest: result.packageDigest, embeddedAssetNames: result.embeddedAssetNames, appSha256: result.appSha256 }));
  } catch (error) {
    console.error(JSON.stringify({ result: 'failed', error: error.message }));
    process.exitCode = 1;
  }
}
