import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCandidateManifest } from '../../scripts/candidate-freeze.mjs';
import { allocatePorts, portAvailable } from '../../scripts/local-preview.mjs';

test('candidate manifest records commit, dirty state, and deterministic file hashes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-candidate-'));
  try {
    const manifest = await buildCandidateManifest({ output: join(dir, 'candidate.json'), scopes: ['package.json'] });
    assert.match(manifest.source.commit, /^[0-9a-f]{40}$/);
    assert.equal(manifest.files.length, 1);
    assert.match(manifest.files[0].sha256, /^[0-9a-f]{64}$/);
    assert.equal(JSON.parse(await readFile(join(dir, 'candidate.json'))).schema, 'dgos/v1-candidate-manifest');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('preview port allocation returns five distinct available ports', async () => {
  const ports = await allocatePorts(15400);
  assert.equal(new Set(Object.values(ports)).size, 5);
  assert.equal((await Promise.all(Object.values(ports).map((port) => portAvailable(port)))).every(Boolean), true);
});
