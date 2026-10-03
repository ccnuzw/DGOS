import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const runRoot = '.herdr/evidence/w1-candidate-runs';

test('Wave 1 candidate batches bind hashes, commands, and separate result groups', async () => {
  const { readdir } = await import('node:fs/promises');
  const runs = [];
  for (const entry of (await readdir(runRoot)).sort()) {
    try { await access(`${runRoot}/${entry}/manifest.json`); runs.push(entry); } catch { /* retain but ignore interrupted starts */ }
  }
  assert.ok(runs.length >= 2, 'failed and subsequent runs must be retained independently');
  const manifests = await Promise.all(runs.map(async (run) => JSON.parse(await readFile(`${runRoot}/${run}/manifest.json`, 'utf8'))));
  const latest = manifests.at(-1);
  assert.match(latest.code_version, /^[a-f0-9]{40}$/);
  assert.match(latest.source.patch_sha256, /^[a-f0-9]{64}$/);
  assert.ok(Array.isArray(latest.asset_sha256) && latest.asset_sha256.length > 0);
  assert.ok(latest.environment.node && latest.environment.platform && latest.environment.package_manager);
  assert.ok(latest.commands.every((item) => item.status === 'blocked' || (item.exit_code !== null && item.stdout_log && item.stderr_log)));
  assert.ok(latest.groups['web-text-only']);
  assert.ok(latest.groups['native-workbench']);
  assert.ok(!latest.groups['native-workbench'].commands.includes('typecheck'));
});
