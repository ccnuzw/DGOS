import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { canonicalJson, verifyPackage } from '../src/apps/package-service.mjs';

const capabilities = [
  'dgos.model.list', 'dgos.model.resolve', 'dgos.aiTask.submit',
  'dgos.aiTask.get', 'dgos.aiTask.events', 'dgos.aiTask.cancel', 'dgos.artifact.read',
  'dgos.system.context.read', 'dgos.system.context.events',
];
const mode = process.argv[2];
const option = (name) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const fixtureDir = resolve(option('--output') ?? '.herdr/state/package-fixture-r9');
const rootFile = join(fixtureDir, 'trust-roots.json');
const envelopeFile = join(fixtureDir, 'ai-workbench-envelope.json');
const failure = (message) => { throw new Error(message); };

async function generate() {
  const source = resolve('apps/ai-workbench-package');
  const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
  if (manifest.appId !== 'dgos.ai-workbench' || manifest.trustLevel !== 'standard' || canonicalJson(manifest.permissions) !== canonicalJson(capabilities) || canonicalJson(manifest.capabilityAllowlist) !== canonicalJson(capabilities)) failure('official_manifest_capabilities_changed');
  if (manifest.version !== '1.0.1' || manifest.build !== 2) failure('r9_manifest_version_required');
  const names = ['index.html', 'tokens.css', 'workbench.css', 'workbench.js', 'icon.svg'];
  const files = Object.fromEntries(await Promise.all(names.map(async (name) => [name, (await readFile(name === 'tokens.css' ? resolve('packages/design-tokens/src/tokens.css') : join(source, name))).toString('base64')])));
  const resourceDigests = Object.fromEntries(names.map((name) => [name, `sha256:${createHash('sha256').update(Buffer.from(files[name], 'base64')).digest('hex')}`]));
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privateDir = await mkdtemp(join(tmpdir(), 'dgos-package-fixture-key-'));
  await chmod(privateDir, 0o700);
  await writeFile(join(privateDir, 'signing.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
  const keyId = `official-fixture-${randomUUID()}`;
  const publicRoot = { keyId, source: 'official', publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString() };
  const envelope = { requestId: randomUUID(), manifest, files, resourceDigests, keyId, signature: sign(null, Buffer.from(canonicalJson({ manifest, resourceDigests })), privateKey).toString('base64') };
  const verified = verifyPackage(envelope, new Map([[keyId, publicRoot]]));
  await mkdir(fixtureDir, { recursive: true, mode: 0o700 });
  await writeFile(rootFile, JSON.stringify([publicRoot], null, 2), { mode: 0o644 });
  await writeFile(envelopeFile, JSON.stringify(envelope, null, 2), { mode: 0o644 });
  console.log(JSON.stringify({ mode: 'generate', trustRootsFile: rootFile, envelopeFile, keyId, appId: manifest.appId, version: manifest.version, build: manifest.build, releaseChannel: manifest.releaseChannel, digest: verified.digest, capabilityCount: capabilities.length }));
}

async function seed() {
  const apiUrl = option('--api-url');
  if (!apiUrl) failure('explicit_api_url_required');
  const base = new URL(apiUrl);
  if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) || base.username || base.password || base.search || base.hash || base.pathname !== '/') failure('local_api_url_required');
  const principalHint = process.env.DGOS_PACKAGE_FIXTURE_PRINCIPAL_ID;
  const credential = process.env.DGOS_PACKAGE_FIXTURE_CREDENTIAL;
  if (!principalHint || !credential) failure('fixture_admin_credentials_required');
  if (!isAbsolute(envelopeFile)) failure('fixture_path_must_be_absolute');
  const envelope = JSON.parse(await readFile(envelopeFile, 'utf8'));
  const roots = JSON.parse(await readFile(rootFile, 'utf8'));
  const root = roots.find((item) => item.keyId === envelope.keyId);
  if (!root || root.source !== 'official') failure('fixture_root_missing');
  const verified = verifyPackage(envelope, new Map([[root.keyId, root]]));
  if (canonicalJson(envelope.manifest.permissions) !== canonicalJson(capabilities) || canonicalJson(envelope.manifest.capabilityAllowlist) !== canonicalJson(capabilities)) failure('fixture_capabilities_changed');
  let sessionId;
  const call = async (method, path, body, expected = 200, requestId) => {
    const response = await fetch(new URL(`/api/v1${path}`, base), {
      method,
      signal: AbortSignal.timeout(10000),
      headers: { ...(sessionId ? { authorization: `Bearer ${sessionId}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...(requestId ? { 'x-request-id': requestId } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let data; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (response.status !== expected) failure(`${method} ${path}: HTTP ${response.status}, errorKey=${data?.errorKey ?? 'unavailable'}`);
    return data;
  };
  const session = await call('POST', '/identity/admin/login', { principalHint, credential });
  sessionId = session.sessionId;
  if (session.principalId !== principalHint || !sessionId) failure('fixture_session_mismatch');
  const appId = envelope.manifest.appId;
  const submitted = await call('POST', '/apps', envelope, 201, envelope.requestId);
  if (submitted.digest !== verified.digest || submitted.catalogState !== 'official') failure('fixture_submit_mismatch');
  let deployment;
  const currentResponse = await fetch(new URL(`/api/v1/apps/${encodeURIComponent(appId)}/deployment`, base), { headers: { authorization: `Bearer ${sessionId}` }, signal: AbortSignal.timeout(10000) });
  if (currentResponse.status === 200) deployment = await currentResponse.json();
  else if (currentResponse.status !== 404) failure(`GET deployment: HTTP ${currentResponse.status}`);
  if (deployment?.state === 'active' && deployment.activeRelease?.digest !== verified.digest) failure('different_active_release_requires_explicit_update');
  if (!deployment || deployment.state === 'uninstalled') {
    await call('POST', `/apps/${encodeURIComponent(appId)}/install`, { version: envelope.manifest.version, build: envelope.manifest.build, releaseChannel: envelope.manifest.releaseChannel, ...(deployment ? { baseVersion: deployment.versionNumber } : {}) });
  }
  deployment = await call('GET', `/apps/${encodeURIComponent(appId)}/deployment`);
  if (deployment.state !== 'active' || deployment.activeRelease?.digest !== verified.digest || !Number.isSafeInteger(deployment.versionNumber)) failure('fixture_deployment_mismatch');
  const grants = [];
  for (const capability of capabilities) {
    const decision = await call('PATCH', '/permissions', { requestId: randomUUID(), appId, capability, decision: 'allow' });
    if (decision.subjectId !== principalHint || decision.appId !== appId || decision.capability !== capability || decision.decision !== 'allow') failure('fixture_permission_mismatch');
    grants.push({ capability, decision: decision.decision, scope: decision.scope ?? '*' });
  }
  console.log(JSON.stringify({ mode: 'seed', appId, version: envelope.manifest.version, build: envelope.manifest.build, releaseChannel: envelope.manifest.releaseChannel, subjectId: principalHint, deploymentVersion: deployment.versionNumber, digest: verified.digest, grants, trustRootsFile: rootFile, envelopeFile }));
}

if (mode === 'generate') await generate();
else if (mode === 'seed') await seed();
else failure('usage: node scripts/v1-package-fixture.mjs generate|seed [--output absolute-directory] [--api-url http://127.0.0.1:port/]');
