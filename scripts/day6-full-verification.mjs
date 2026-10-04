import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { day6Fixture, fixtureFingerprint } from '../tests/fixtures/day6-v1-fixture.mjs';

const root = resolve(new URL('..', import.meta.url).pathname);
const runId = `day6-v1-${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
const evidenceDir = resolve(root, '.herdr/evidence/day6-full-verification', runId);
const matrixPath = resolve(root, 'docs/05-测试与发布/端到端验收/报告/Day6-V1-完整验证矩阵.json');
const matrix = JSON.parse(await readFile(matrixPath, 'utf8'));
const fixtureStatePath = resolve(root, 'data/v1-ui-management-fixture/state.json');
let managementFixture = null;
let managementCredentials = null;
if (existsSync(fixtureStatePath)) {
  try { managementFixture = JSON.parse(await readFile(fixtureStatePath, 'utf8')); } catch { managementFixture = null; }
}
let fixtureProcess = null;
async function ensureManagementFixture() {
  if (managementFixture?.web) return false;
  fixtureProcess = spawn(process.execPath, ['scripts/v1-ui-management-fixture.mjs'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  fixtureProcess.stdout.on('data', chunk => { output += chunk; });
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (existsSync(fixtureStatePath)) {
      try { managementFixture = JSON.parse(await readFile(fixtureStatePath, 'utf8')); if (managementFixture.web) { managementCredentials = JSON.parse(await readFile(managementFixture.privateCredentialsFile, 'utf8')); return true; } } catch {}
    }
    await new Promise(resolveResult => setTimeout(resolveResult, 250));
  }
  throw new Error(`management_fixture_start_timeout:${output.slice(-500)}`);
}
async function stopManagementFixture(started) {
  if (!started) return;
  try { execFileSync(process.execPath, ['scripts/v1-ui-management-fixture.mjs', '--stop'], { cwd: root, stdio: 'ignore', timeout: 20_000 }); } catch {}
}
const startedFixture = await ensureManagementFixture();
await mkdir(evidenceDir, { recursive: true });

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function run(command, args, env = {}) {
  return new Promise((resolveResult) => {
    const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', code => resolveResult({ command: [command, ...args].join(' '), exitCode: code ?? 1, stdout, stderr }));
  });
}
function classify(result, item) {
  if (item.status === 'NOT_IN_V1') return 'NOT_IN_V1';
  if (result.exitCode === 0) return 'PASS';
  if (item.blocking === true) return 'FAIL';
  return 'BLOCKED';
}
const commands = [
  { id: 'fr001-web', fr: ['V1-FR-001'], command: 'pnpm', args: ['exec', 'playwright', 'test', 'apps/web/e2e/day6-fr001-web.spec.mjs', '--config=apps/web/playwright.config.mjs', '--reporter=line'], blocking: true },
  { id: 'fr002-lifecycle', fr: ['V1-FR-002'], command: 'node', args: ['--test', 'tests/e2e/app-catalog-lifecycle.spec.mjs'], blocking: true },
  { id: 'fr003-agent-mcp', fr: ['V1-FR-003'], command: 'node', args: ['--test', 'tests/integration/app-capabilities.test.mjs', 'tests/integration/runtime-api.test.mjs'], blocking: true },
  { id: 'fr005-ai-task', fr: ['V1-FR-005'], command: 'node', args: ['--test', 'tests/integration/ai-task-api.test.mjs', 'tests/integration/ai-task-worker.test.mjs'], blocking: true },
  { id: 'fr007-provider-model', fr: ['V1-FR-007'], command: 'node', args: ['--test', 'tests/integration/model-capability-api.test.mjs', 'tests/integration/provider-api.test.mjs'], blocking: true },
  { id: 'fr009-assistant', fr: ['V1-FR-009'], command: 'node', args: ['--test', 'tests/e2e/assistant-settings-actions.spec.mjs', 'tests/integration/action-recovery.test.mjs'], blocking: true },
  { id: 'fr010-identity', fr: ['V1-FR-010'], command: 'node', args: ['--test', 'tests/integration/identity-api.test.mjs', 'tests/security/v1-auth-authz.test.mjs'], blocking: true },
  { id: 'fr011-api-key', fr: ['V1-FR-011'], command: 'node', args: ['--test', 'tests/security/v1-ops-durable-secret.test.mjs'], blocking: true },
  { id: 'fr012-provider-account', fr: ['V1-FR-012'], command: 'node', args: ['--test', 'tests/integration/postgres-provider.test.mjs', 'tests/integration/provider-api.test.mjs'], blocking: true },
  { id: 'fr013-connection-test', fr: ['V1-FR-013'], command: 'node', args: ['scripts/v1-provider-failures-http.mjs'], blocking: false },
  { id: 'fr014-governance-audit', fr: ['V1-FR-014'], command: 'node', args: ['--test', 'tests/security/v1-governance-e2e.test.mjs', 'tests/integration/audit-query.test.mjs'], blocking: true },
  { id: 'fr015-usage-quota', fr: ['V1-FR-015'], command: 'node', args: ['--test', 'tests/integration/quota-api.test.mjs', 'tests/integration/postgres-quota.test.mjs'], blocking: true },
  { id: 'gates-migration', fr: ['V1-RG-001', 'V1-RG-003'], command: 'node', args: ['scripts/check-migration.mjs'], blocking: true },
  { id: 'gates-secret', fr: ['V1-NFR-001', 'V1-NFR-004'], command: 'node', args: ['scripts/secret-scan.mjs', '--paths', 'scripts', '.herdr', 'docs', 'packages'], blocking: true },
  { id: 'native-smoke', fr: ['V1-FR-001'], command: 'node', args: ['apps/desktop/scripts/e2e-macos.mjs'], blocking: false },
];
const out = [];
try {
for (const item of commands) {
  const itemEnv = item.id === 'fr001-web' && managementFixture?.web
    ? { WEB_EXTERNAL: '1', WEB_BASE_URL: managementFixture.web, REAL_MANAGEMENT_FIXTURE: '1', REAL_ADMIN_ID: managementFixture.principalId, REAL_ADMIN_CREDENTIAL: managementCredentials?.adminCredential ?? '' }
    : {};
  const result = await run(item.command, item.args, itemEnv);
  const file = resolve(evidenceDir, `${item.id}.json`);
  const row = { id: item.id, fr: item.fr, status: classify(result, item), command: result.command, exitCode: result.exitCode, stdoutSha256: sha256(result.stdout), stderrSha256: sha256(result.stderr), evidence: file.replace(`${root}/`, '') };
  await writeFile(file, JSON.stringify({ ...row, stdout: result.stdout, stderr: result.stderr }, null, 2));
  out.push(row);
}
} finally {
  await stopManagementFixture(startedFixture);
}
const byFr = Object.fromEntries(matrix.features.map(feature => [feature.id, out.filter(row => feature.id === row.fr[0]).map(row => row.status)]));
const manifest = { schema: 'dgos.day6.verification.v1', runId, createdAt: new Date().toISOString(), fixture: { profile: day6Fixture.profile, fingerprint: fixtureFingerprint(), managementWeb: managementFixture?.web ?? null }, matrixSha256: sha256(JSON.stringify(matrix)), results: out, byFr, result: out.some(row => row.status === 'FAIL') ? 'FAIL' : 'READY_FOR_VERIFY' };
await writeFile(resolve(evidenceDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ runId, result: manifest.result, manifest: `${evidenceDir.replace(`${root}/`, '')}/manifest.json`, counts: out.reduce((a, row) => ({ ...a, [row.status]: (a[row.status] ?? 0) + 1 }), {}) }, null, 2));
