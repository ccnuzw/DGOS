import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const harness = fileURLToPath(new URL('../../scripts/v1-provider-http.mjs', import.meta.url));
const explicitAdmin = process.env.DGOS_VERIFY_ADMIN_URL || process.env.DGOS_PROVIDER_HTTP_ADMIN_DATABASE_URL;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('real public Provider workflow uses isolated PostgreSQL and an independent worker', { skip: !explicitAdmin }, async () => {
  const outcome = await new Promise((done, fail) => {
    const child = spawn(process.execPath, [harness], { cwd: fileURLToPath(new URL('../..', import.meta.url)), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), 90000);
    child.stdout.on('data', (bytes) => { stdout += bytes; if (stdout.length > 65536) child.kill('SIGTERM'); });
    child.stderr.on('data', (bytes) => { stderr += bytes; if (stderr.length > 65536) child.kill('SIGTERM'); });
    child.once('error', fail);
    child.once('close', (code, signal) => { clearTimeout(timer); done({ code, signal, stdout, stderr }); });
  });
  assert.equal(outcome.code, 0, `Provider harness failed: ${outcome.signal ?? outcome.stderr.slice(0, 1000)}`);
  const result = JSON.parse(outcome.stdout.trim().split('\n').at(-1));
  assert.equal(result.status, 'passed');
  assert.equal(result.cases, 9);
  const [reportBytes, manifestBytes] = await Promise.all([readFile(result.reportPath), readFile(result.manifestPath)]);
  const report = JSON.parse(reportBytes); const manifest = JSON.parse(manifestBytes);
  assert.equal(hash(reportBytes), manifest.reportSha256);
  assert.equal(report.sourceStable, true);
  assert.equal(manifest.status, 'passed');
  assert.equal(report.cases.length, 9);
  assert.ok(report.cases.every((entry) => entry.result === 'passed'));
  assert.equal(report.cases.find((entry) => entry.name === 'responses_snapshot_early_delta_artifact_replay')?.facts.lastEventIdResumed, true);
  assert.match(report.parentDatabase, /^(?:dgos_v1_provider|dgos_v1_verify_[0-9a-f]{32})$/);
});
