import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const DEFAULT_SCOPES = [
  'apps', 'packages', 'src', 'migrations', 'scripts', 'tests', 'test-support',
  'deployment', 'docker-compose.yml', 'docker-compose.integration.yml',
  'docker-compose.production.yml', 'package.json', 'pnpm-lock.yaml',
  'pnpm-workspace.yaml', 'docs/05-测试与发布/发布', 'docs/release',
];

export function git(args, cwd = ROOT) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
}

export function normalizePath(path) {
  return path.split(sep).join('/');
}

export function listCandidateFiles({ root = ROOT, scopes = DEFAULT_SCOPES } = {}) {
  const output = execFileSync('git', ['ls-files', '-z', '--', ...scopes], { cwd: root, encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 });
  return output.toString('utf8').split('\0').filter(Boolean).sort();
}

export async function sha256File(path) {
  const hash = createHash('sha256');
  hash.update(await readFile(path));
  return hash.digest('hex');
}

export async function buildCandidateManifest({ root = ROOT, output, scopes = DEFAULT_SCOPES, limitations = [] } = {}) {
  if (!output) throw new Error('candidate_output_required');
  const files = listCandidateFiles({ root, scopes });
  const entries = [];
  for (const file of files) {
    const absolute = resolve(root, file);
    const info = await stat(absolute);
    entries.push({ path: normalizePath(relative(root, absolute)), bytes: info.size, sha256: await sha256File(absolute) });
  }
  const status = git(['status', '--porcelain', '--untracked-files=all'], root);
  const commit = git(['rev-parse', 'HEAD'], root);
  const manifest = {
    schema: 'dgos/v1-candidate-manifest',
    manifest_version: 1,
    candidate_id: `v1-local-${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`,
    created_at: new Date().toISOString(),
    source: { commit, dirty: Boolean(status), status_sha256: createHash('sha256').update(status).digest('hex') },
    scopes,
    files: entries,
    limitations: [
      'This manifest proves source/artifact identity only; it does not prove signing, notarization, production deployment, or a real external Provider.',
      ...limitations,
    ],
  };
  await mkdir(dirname(resolve(root, output)), { recursive: true });
  await writeFile(resolve(root, output), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outputIndex = process.argv.indexOf('--output');
  const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : `candidates/${Date.now()}/candidate-manifest.json`;
  const manifest = await buildCandidateManifest({ output, limitations: process.argv.includes('--allow-dirty') ? [] : ['A dirty source tree is not release eligible; freeze from a clean commit before production release.'] });
  console.log(JSON.stringify({ ok: true, candidate_id: manifest.candidate_id, commit: manifest.source.commit, dirty: manifest.source.dirty, files: manifest.files.length, manifest: output }, null, 2));
  if (manifest.source.dirty && !process.argv.includes('--allow-dirty')) process.exitCode = 2;
}
