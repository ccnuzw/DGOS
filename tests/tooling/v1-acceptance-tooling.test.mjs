import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRequirementCoverage, candidateFingerprint, candidatePlan, candidateRunComplete, caseCoverageFromRows, classifyCandidate, coverageFromRows, passedAssertions, requirementRegistry, summarizeCandidate, summarizeRequirementCoverage, verifyCandidateFiles, verifyRuntimeAssets } from '../../scripts/v1-regression-sweep.mjs';
import { businessEvidencePaths, businessHarnessResult, candidateTimeoutMs, directHarnessResult, executeFiveGroups, frozenMigrations, isolatedEnvironment, providerEvidencePaths, successfulRow, tapResult, verifyRuntimeBindings } from '../../scripts/v1-candidate-run.mjs';

const runtimeConfigPaths = ['docker-compose.production.yml', 'docker-compose.integration.yml', 'deployment/Dockerfile', 'deployment/Caddyfile', 'scripts/v1-ops-api.mjs', 'scripts/v1-ops-worker.mjs', 'apps/api/src/server.mjs', 'apps/worker/src/worker.mjs', 'scripts/v1-ui-management-fixture.mjs', 'src/extensions/v1-default-runtime.json', '.herdr/state/package-fixture-r9/trust-roots.json', '.herdr/state/integration-trust-roots-r9.json'];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function fixtureBindings(repoRoot = process.cwd()) {
  const fileHash = async (file) => sha(await readFile(join(repoRoot, file)));
  const distRoot = 'apps/web/dist';
  const walk = async (directory, prefix = '') => (await Promise.all((await readdir(join(repoRoot, directory, prefix), { withFileTypes: true })).map(async (entry) => {
    const child = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? walk(directory, child) : [`${directory}/${child}`];
  }))).flat();
  const files = await walk(distRoot);
  return { build_sha256: 'c'.repeat(64), runtime_assets: {
    config: { id: 'api-worker-runtime', files: Object.fromEntries(await Promise.all(runtimeConfigPaths.map(async (file) => [file, await fileHash(file)]))) },
    envelope: { id: 'workbench-1.0.1', path: '.herdr/state/package-fixture-r9/ai-workbench-envelope.json', sha256: await fileHash('.herdr/state/package-fixture-r9/ai-workbench-envelope.json') },
    dist: { id: 'web-dist', root: distRoot, files: Object.fromEntries(await Promise.all(files.map(async (file) => [file, await fileHash(file)]))) },
    image: { id: `sha256:${'c'.repeat(64)}`, sha256: 'c'.repeat(64) },
  } };
}

async function makeRuntimeFixture(dir) {
  for (const file of [...runtimeConfigPaths, '.herdr/state/package-fixture-r9/ai-workbench-envelope.json', 'apps/web/dist/index.html', 'apps/web/dist/assets/app.js']) {
    await mkdir(join(dir, file, '..'), { recursive: true });
    await writeFile(join(dir, file), file === 'apps/web/dist/assets/app.js' ? 'console.log("original")' : file);
  }
  return (await fixtureBindings(dir)).runtime_assets;
}

test('provider workflow harness rejects a nonrandom Verify parent before database work', () => {
  const result = spawnSync(process.execPath, ['scripts/v1-provider-http.mjs'], { env: { ...process.env, DGOS_VERIFY_ADMIN_URL: 'postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_verify_bad', DGOS_PROVIDER_HTTP_ADMIN_DATABASE_URL: '' }, encoding: 'utf8', timeout: 5000 });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /dedicated_provider_database_required/);
});

test('candidate plan classifies root tests without worktree discovery or unsafe DB fallback', async () => {
  const plan = await candidatePlan();
  const entries = Object.values(plan.groups).flat();
  assert.equal(entries.length, plan.main_tree_test_count);
  assert.equal(new Set(entries.map((entry) => entry.file)).size, entries.length);
  assert.ok(entries.every((entry) => entry.file.startsWith('tests/') && !entry.file.includes('.worktrees/')));
  assert.equal(classifyCandidate('tests/integration/postgres-identity.test.mjs').phase, 'pg');
  assert.equal(classifyCandidate('tests/integration/redis-security.test.mjs').phase, 'redis');
  assert.equal(classifyCandidate('tests/integration/network-settings.test.mjs').phase, 'tls');
  assert.equal(classifyCandidate('tests/security/provider-egress-stream.test.mjs').phase, 'tls');
  assert.equal(classifyCandidate('tests/integration/network-runtime-r6.test.mjs').phase, 'guarded');
  assert.equal(classifyCandidate('tests/integration/network-public-r6.test.mjs').phase, 'tls');
  assert.equal(classifyCandidate('tests/integration/network-provisioning-public-r7.test.mjs').phase, 'tls');
  assert.equal(classifyCandidate('tests/integration/proxy-provisioning-r7.test.mjs').phase, 'pg');
  assert.equal(classifyCandidate('tests/integration/network-context-r7.test.mjs').phase, 'pg');
  for (const file of ['action-freshness', 'audit-query', 'runtime-api', 'system-cross-process', 'system-http-projection', 'system-permission-rules']) assert.equal(classifyCandidate(`tests/integration/${file}.test.mjs`).phase, 'pg');
  assert.equal(classifyCandidate('tests/integration/postgres-package-retention.test.mjs').phase, 'pg');
  assert.equal(classifyCandidate('tests/provider/provider-parameters-pg.test.mjs').phase, 'pg');
  assert.equal(classifyCandidate('tests/extensions/management-credential-pg.test.mjs').phase, 'pg');
  assert.equal(classifyCandidate('tests/extensions/management-online-pg.test.mjs').phase, 'pg');
  assert.equal(classifyCandidate('tests/extensions/management-routes-pg.test.mjs').phase, 'pg');
  assert.equal(classifyCandidate('tests/e2e/assistant-settings-actions.spec.mjs').phase, 'memory');
  assert.equal(classifyCandidate('tests/e2e/release-rollback.spec.mjs').phase, 'placeholder');
  assert.equal(classifyCandidate('tests/e2e/app-catalog-lifecycle.spec.mjs').phase, 'placeholder');
  assert.equal(classifyCandidate('tests/integration/real-v1-workflow.test.mjs').phase, 'tls');
  assert.equal(classifyCandidate('tests/integration/provider-failures-http.test.mjs').phase, 'tls');
  assert.equal(classifyCandidate('tests/integration/postgres-action-resolver.test.mjs').phase, 'pg');
  assert.equal(classifyCandidate('tests/integration/permission-write-freshness.test.mjs').phase, 'memory');
  assert.match(plan.isolation.tls, /current random dgos_v1_verify_<32 hex> child URL, never dgos_v1_integrated/);
  assert.match(plan.isolation.tls, /15171-15172 and Redis DB5/);
  assert.equal(classifyCandidate('tests/extensions/postgres-extension.test.mjs').phase, 'guarded');
  assert.ok(plan.additional_assets.some((item) => item.file === 'apps/web/e2e/real-management.spec.mjs'));
  for (const file of ['scripts/v1-desktop-real.mjs', 'apps/desktop/scripts/visible-macos.mjs', 'apps/desktop/scripts/e2e-macos.mjs']) assert.ok(plan.additional_assets.some((item) => item.phase === 'native' && item.file === file));
  assert.match(plan.isolation.pg, /DGOS_EXTENSION_TEST_DATABASE_URL/);
  assert.equal(Object.keys(plan.replacement_proofs).length, 5);
  assert.ok(plan.evidence_contract.gate_manifest_fields.includes('commit'));
  assert.match(plan.evidence_contract.source_binding, /drift/);
});

test('five-group child environment removes inherited storage URLs and uses workflow CHILD', () => {
  const child = `postgresql://dgos:secret@127.0.0.1:5432/dgos_v1_verify_${'a'.repeat(32)}`;
  const inherited = { DGOS_DATABASE_URL: 'original', DGOS_EXTENSION_TEST_DATABASE_URL: 'original', DGOS_VERIFY_ADMIN_URL: 'parent', DGOS_REDIS_URL: 'redis://127.0.0.1:6379/0', DATABASE_URL: 'unsafe', REDIS_URL: 'unsafe', PGDATABASE: 'dgos' };
  const memory = isolatedEnvironment(inherited, 'memory');
  for (const name of Object.keys(inherited)) assert.equal(memory[name], undefined);
  const pg = isolatedEnvironment(inherited, 'pg', child);
  assert.equal(pg.DGOS_DATABASE_URL, child);
  assert.equal(pg.DGOS_EXTENSION_TEST_DATABASE_URL, child);
  assert.equal(pg.DGOS_VERIFY_ADMIN_URL, undefined);
  const tls = isolatedEnvironment(inherited, 'tls', child);
  assert.equal(tls.DGOS_VERIFY_ADMIN_URL, child);
  assert.equal(tls.DGOS_PROVIDER_HTTP_REDIS_URL, 'redis://127.0.0.1:6379/5');
  assert.equal(tls.DGOS_PROVIDER_FAILURES_REDIS_URL, 'redis://127.0.0.1:6379/5');
  assert.equal(isolatedEnvironment(inherited, 'redis').DGOS_REDIS_URL, 'redis://127.0.0.1:6379/6');
  assert.throws(() => isolatedEnvironment(inherited, 'pg', 'postgresql://localhost/dgos'), /random Verify child/);
  assert.ok(candidateTimeoutMs > 90_000);
});

test('frozen migration selection and TAP failures stay strict', () => {
  const migrations = Array.from({ length: 47 }, (_, index) => ({ version: `${String(index + 1).padStart(4, '0')}-fixture`, file: `${String(index + 1).padStart(4, '0')}-fixture.sql`, checksum: 'x', sql: 'SELECT 1;' }));
  assert.throws(() => frozenMigrations(migrations), /frozen migration set/);
  assert.deepEqual(tapResult('TAP version 13\n# tests 2\n# pass 1\n# fail 0\n# skipped 1\n'), { tests: 2, passed: 1, failed: 0, skipped: 1 });
  assert.equal(successfulRow({ exit_code: 0, signal: null, timed_out: false, tests: 2, passed: 1, failed: 0, skipped: 1, source_drift: false }), false);
  assert.deepEqual(directHarnessResult('{"status":"passed","cases":3}'), { tests: 3, passed: 3, failed: 0, skipped: 0 });
  assert.equal(directHarnessResult('{"status":"failed","cases":3}').tests, 0);
});

test('requirement registry preserves 62 AC, 12 E2E, 7 NFR and 3 RG and defaults to uncovered', async () => {
  const registry = await requirementRegistry();
  assert.deepEqual(Object.fromEntries(Object.entries(registry.ids).map(([kind, ids]) => [kind, ids.length])), { AC: 62, E2E: 12, NFR: 7, RG: 3 });
  assert.deepEqual(registry.supplemental_ids, { E2E: ['V1-E2E-16'] });
  assert.deepEqual(registry.count_issues, []);
  const evidence = [
    { requirement_id: 'V1-NFR-001', status: 'skipped' },
    { requirement_id: 'V1-NFR-001', status: 'passed' },
    { requirement_id: 'V1-RG-001', status: 'failed' },
  ];
  assert.equal(buildRequirementCoverage(registry.ids.NFR, evidence).find((row) => row.requirement_id === 'V1-NFR-001').status, 'skipped');
  const coverage = summarizeRequirementCoverage(registry, evidence);
  assert.deepEqual(coverage.RG.failed, ['V1-RG-001']);
  assert.equal(coverage.AC.uncovered.length, 62);
  assert.equal(coverage.E2E.uncovered.length, 12);
});

test('Provider receipt must name one exact report/log/manifest stem', () => {
  const stem = 'tests/provider/evidence/V1-PROVIDER-r6-2026-10-02T12-00-00-000Z-abcdef01';
  const receipt = { status: 'passed', reportPath: `${stem}.json`, logPath: `${stem}.log`, manifestPath: `${stem}-manifest.json` };
  assert.deepEqual(providerEvidencePaths(`# ${JSON.stringify(receipt)}\n# tests 1\n`), [receipt.reportPath, receipt.logPath, receipt.manifestPath]);
  assert.deepEqual(providerEvidencePaths(`# ${JSON.stringify({ ...receipt, logPath: 'tests/provider/evidence/V1-PROVIDER-r6-other.log' })}`), []);
  assert.deepEqual(providerEvidencePaths('# tests 1'), []);
  const failuresStem = 'tests/provider/evidence/V1-PROVIDER-FAILURES-r8-2026-10-02T12-00-00-000Z-abcdef01';
  assert.deepEqual(providerEvidencePaths(JSON.stringify({ ...receipt, reportPath: `${failuresStem}.json`, logPath: `${failuresStem}.log`, manifestPath: `${failuresStem}-manifest.json` })), [`${failuresStem}.json`, `${failuresStem}.log`, `${failuresStem}-manifest.json`]);
});

test('five groups write paired manifests, continue independent failures and drop exact PG children', async () => {
  const runId = `V1-candidate-tooling-${Date.now()}`;
  const evidenceRoot = 'docs/05-测试与发布/端到端验收/报告';
  const files = ['tests/tooling/v1-acceptance-tooling.test.mjs', 'tests/tooling/verify-release.test.mjs'];
  const groups = Object.fromEntries(['memory', 'pg', 'redis', 'tls', 'guarded', 'browser', 'native', 'blocked', 'placeholder'].map((group) => [group, []]));
  groups.memory = files.map((file) => ({ file }));
  groups.pg = [{ file: files[0] }]; groups.redis = [{ file: files[0] }]; groups.tls = [{ file: files[0] }]; groups.guarded = [{ file: files[0] }];
  const identity = { commit: null, head_commit: 'a'.repeat(40), working_tree_sha256: 'b'.repeat(64) };
  const hash = 'c'.repeat(64);
  const bindings = await fixtureBindings();
  assert.deepEqual(await verifyRuntimeBindings(bindings), []);
  const queries = []; const environments = []; let calls = 0;
  const makePool = (url) => ({ async query(sql) { queries.push({ database: new URL(url).pathname.slice(1), sql }); return sql.startsWith('SELECT current_database()') ? { rows: [{ name: new URL(url).pathname.slice(1) }] } : { rows: [] }; }, async end() {} });
  const redis = { async *scanIterator() { yield []; }, async del() { throw new Error('no Redis keys expected'); }, async quit() {} };
  const migrations = Array.from({ length: 47 }, (_, index) => ({ version: `${String(index + 1).padStart(4, '0')}-fixture`, file: `${String(index + 1).padStart(4, '0')}-fixture.sql`, checksum: 'x', sql: 'SELECT 1;' }));
  migrations.splice(44, 3, ...[['0049-extension-management', 'ba0bc80a0ccc74e05a5244b50e52e6a26df39ad854995ba038020b7d5d954f1b'], ['0050-session-management', '8802fe3a02b0bf7364aeac96215da09454d0c53b48c06d2cb76c6f3d6b455d85'], ['0051-proxy-provisioning', '778fddef654d67bc3ecfc01e11fd91f826f91d68a5b6c5c72568b5e35cca1939']].map(([version, checksum]) => ({ version, file: `${version}.sql`, checksum, sql: 'SELECT 1;' })));
  for (const [index, version, checksum] of [[40, '0045-network-route-activation', 'c2bc2a47a3360e47b02d4edd9880b88694ec3ab84cdf7613674cd2099d40040d'], [41, '0046-package-retention', '7321916de0ddff31f40d48b837acada75d8ec893691c7c65f22d0b707d6a9a83'], [42, '0047-ai-task-parameters', '22b6e9e886943f2b660de4d54989e0587c58cb67e373fbd45b7140849f6f15f6'], [43, '0048-network-route-fingerprint', '7879e6cf17753fa82254675756fbeb1fdfb9ad67e11808aec8922cd2f10cd33d']]) migrations[index] = { version, file: `${version}.sql`, checksum, sql: 'SELECT 1;' };
  const runner = async (_command, args, env, timeoutMs) => { environments.push({ args, env, timeoutMs }); calls++; return { exit_code: calls === 1 ? 2 : 0, signal: null, timed_out: false, output: `TAP version 13\n# tests 1\n# pass ${calls === 1 ? 0 : 1}\n# fail ${calls === 1 ? 1 : 0}\n# skipped 0\n` }; };
  try {
    const result = await executeFiveGroups({ adminUrl: 'postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_integrated', bindings, runId, evidenceRoot, plan: { groups, additional_assets: [] }, runner, identityReader: async () => identity, makePool, getMigrations: async () => migrations, connectRedis: async () => redis });
    assert.equal(calls, 6, JSON.stringify(result.group_results));
    assert.equal(result.group_results[0].exit_code, 1);
    assert.equal(result.group_results[1].exit_code, 0);
    assert.equal(result.candidate_complete, false);
    assert.equal(environments[0].env.DGOS_DATABASE_URL, undefined);
    assert.match(environments[2].env.DGOS_DATABASE_URL, /dgos_v1_verify_[a-f0-9]{32}$/);
    assert.equal(environments[2].env.DGOS_EXTENSION_TEST_DATABASE_URL, environments[2].env.DGOS_DATABASE_URL);
    assert.equal(environments[4].env.DGOS_VERIFY_ADMIN_URL, environments[4].env.DGOS_DATABASE_URL);
    assert.equal(environments[4].timeoutMs, candidateTimeoutMs);
    assert.equal(queries.filter((item) => item.sql.startsWith('DROP DATABASE')).length, 3);
    for (const path of result.manifest_paths) { const manifest = JSON.parse(await readFile(path, 'utf8')); assert.equal(manifest.results.length, manifest.group === 'business' ? 0 : manifest.group === 'memory' ? 2 : 1); assert.deepEqual(manifest.unexecuted_assets, []); }
  } finally { for (const group of ['memory', 'pg', 'redis', 'tls', 'guarded']) { const stem = join(evidenceRoot, `${runId}-${group}`); await rm(stem, { recursive: true, force: true }); await rm(`${stem}.md`, { force: true }); await rm(`${stem}-manifest.json`, { force: true }); } }
});

test('skipped or excluded tests and source drift cannot complete a candidate', () => {
  const ok = { results: [{ passed: true, tests: 1, fail: 0, skipped: 0 }], excluded: [], setupError: null, sourceDrift: false };
  assert.equal(candidateRunComplete(ok), true);
  assert.equal(candidateRunComplete({ ...ok, results: [{ ...ok.results[0], skipped: 1 }] }), false);
  assert.equal(candidateRunComplete({ ...ok, results: [{ ...ok.results[0], tests: 0 }] }), false);
  assert.equal(candidateRunComplete({ ...ok, excluded: [{ file: 'tests/e2e/assistant.spec.mjs' }] }), false);
  assert.equal(candidateRunComplete({ ...ok, sourceDrift: true }), false);
});

test('candidate groups compose only with complete matching source, build, assets and cases', () => {
  const hash = 'a'.repeat(64);
  const identity = { commit: null, head_commit: 'b'.repeat(40), working_tree_sha256: 'c'.repeat(64) };
  const runtimeAssets = { config: { id: 'runtime', files: Object.fromEntries(runtimeConfigPaths.map((path) => [path, hash])) }, envelope: { id: 'envelope', path: '.herdr/state/package-fixture-r9/ai-workbench-envelope.json', sha256: hash }, dist: { id: 'dist', root: 'apps/web/dist', files: { 'apps/web/dist/index.html': hash, 'apps/web/dist/assets/index.js': hash } }, image: { id: `sha256:${hash}`, sha256: hash } };
  const candidateId = candidateFingerprint({ source_identity: identity, build_sha256: hash, runtime_assets: runtimeAssets });
  const plan = { groups: { memory: [{ file: 'tests/memory.test.mjs' }], pg: [{ file: 'tests/pg.test.mjs' }], redis: [{ file: 'tests/redis.test.mjs' }], tls: [{ file: 'tests/tls.test.mjs' }], browser: [{ file: 'tests/browser.test.mjs' }], native: [], guarded: [{ file: 'tests/guarded.test.mjs' }], blocked: [{ file: 'tests/blocked.test.mjs' }], placeholder: [{ file: 'tests/e2e/release-rollback.spec.mjs' }] }, additional_assets: [{ phase: 'browser', file: 'scripts/v1-package-http.mjs' }, { phase: 'native', file: 'apps/desktop/scripts/e2e-macos.mjs' }] };
  const cases = ['01', '02', '03', '05', '07', '09', '10', '11', '12', '13', '14', '15'].map((id) => `V1-E2E-${id}`);
  const groups = ['memory', 'pg', 'redis', 'tls', 'browser', 'native', 'guarded'];
  const manifests = groups.map((group, index) => {
    const files = [ ...(plan.groups[group] ?? []).map((item) => item.file), ...(group === 'guarded' ? plan.groups.blocked.map((item) => item.file) : []), ...(group === 'browser' ? plan.groups.placeholder.map((item) => item.file) : []), ...plan.additional_assets.filter((item) => item.phase === group).map((item) => item.file) ];
    const coveredCases = index === 0 ? cases : [];
    const rows = files.filter((file) => file !== 'scripts/v1-package-http.mjs').map((file, row) => ({ asset: file === 'tests/e2e/release-rollback.spec.mjs' ? 'scripts/v1-package-http.mjs' : file, covers: file === 'tests/e2e/release-rollback.spec.mjs' ? [file, 'scripts/v1-package-http.mjs'] : [file], cases: file === 'tests/e2e/release-rollback.spec.mjs' ? ['V1-E2E-02'] : row === 0 ? coveredCases : [], assertions: file === 'tests/e2e/release-rollback.spec.mjs' ? ['five_catalog_origins_and_review_visibility', 'public_install_test_install_launch_health_and_protected_uninstall', 'public_provider_task_artifact_fixture', 'immutable_channel_update_and_browser_health_rollback', 'public_uninstall_keeps_data_and_history'] : [], tests: 1, passed: 1, failed: 0, skipped: 0, exit_code: 0, source_drift: false, log: `docs/05-测试与发布/端到端验收/报告/V1-regression-fixture/${group}-${row}.tap.txt`, log_sha256: hash }));
    return { schema: 'dgos/v1-candidate-group/v1', group, candidate_id: candidateId, build_sha256: hash, source_identity: identity, source_identity_start: identity, source_identity_end: identity, source_drift: false, exit_code: 0, evidence_dirs: ['docs/05-测试与发布/端到端验收/报告/V1-regression-fixture'], runtime_assets: runtimeAssets, asset_sha256: Object.fromEntries(rows.map((row) => [row.asset, hash])), results: rows, covered_cases: coveredCases };
  });
  assert.equal(summarizeCandidate(plan, manifests, identity).candidate_complete, false);
  assert.match(summarizeCandidate(plan, manifests, identity).issues.join(','), /uncovered case branch|missing group: business/);
  assert.match(summarizeCandidate(plan, manifests.slice(1), identity).issues.join(','), /missing group: memory/);
  assert.match(summarizeCandidate(plan, manifests.map((item) => item.group === 'pg' ? { ...item, candidate_id: 'd'.repeat(64) } : item), identity).issues.join(','), /candidate mismatch/);
  assert.match(summarizeCandidate(plan, manifests.map((item) => item.group === 'pg' ? { ...item, build_sha256: 'd'.repeat(64) } : item), identity).issues.join(','), /build mismatch/);
  assert.match(summarizeCandidate(plan, manifests.map((item) => item.group === 'pg' ? { ...item, results: [{ ...item.results[0], skipped: 1 }] } : item), identity).issues.join(','), /failed\/skipped/);
  assert.match(summarizeCandidate(plan, manifests, { ...identity, working_tree_sha256: 'e'.repeat(64) }).issues.join(','), /source identity mismatch/);
  assert.match(summarizeCandidate(plan, manifests.map((item) => item.group === 'native' ? { ...item, results: [] } : item), identity).issues.join(','), /zero results/);
  assert.match(summarizeCandidate(plan, manifests.map((item) => item.group === 'browser' ? { ...item, results: item.results.slice(0, 1) } : item), identity).issues.join(','), /missing asset: tests\/e2e\/release-rollback/);
  assert.match(summarizeCandidate(plan, manifests.map((item) => item.group === 'browser' ? { ...item, results: item.results.map((row) => row.covers.includes('tests/e2e/release-rollback.spec.mjs') ? { ...row, asset: 'tests/e2e/release-rollback.spec.mjs' } : row) } : item), identity).issues.join(','), /placeholder requires fixed real replacement/);
  assert.match(summarizeCandidate(plan, manifests.map((item) => item.group === 'browser' ? { ...item, results: item.results.map((row) => row.covers.includes('tests/e2e/release-rollback.spec.mjs') ? { ...row, assertions: [] } : row) } : item), identity).issues.join(','), /placeholder business assertions missing/);
  assert.match(summarizeCandidate(plan, manifests.map((item) => item.group === 'pg' ? { ...item, results: item.results.map((row) => ({ ...row, log_sha256: null })) } : item), identity).issues.join(','), /log binding missing/);
  assert.match(summarizeCandidate(plan, manifests.map((item) => item.group === 'pg' ? { ...item, runtime_assets: { ...item.runtime_assets, image: { id: `sha256:${'d'.repeat(64)}`, sha256: hash } } } : item), identity).issues.join(','), /runtime image missing or mismatched/);
});

test('candidate file bindings detect changed logs and runtime assets', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-candidate-files-'));
  const digest = (value) => createHash('sha256').update(value).digest('hex');
  const evidence = 'docs/05-测试与发布/端到端验收/报告/V1-regression-fixture';
  const log = `${evidence}/001.tap.txt`;
  try {
    await mkdir(join(dir, evidence), { recursive: true });
    await mkdir(join(dir, 'tests'));
    await writeFile(join(dir, 'tests/test.mjs'), 'test');
    await writeFile(join(dir, log), 'pass');
    const manifest = { runtime_assets: await makeRuntimeFixture(dir), evidence_dirs: [evidence], asset_sha256: { 'tests/test.mjs': digest('test') }, results: [{ log, log_sha256: digest('pass') }] };
    assert.deepEqual(await verifyCandidateFiles([manifest], dir), []);
    await writeFile(join(dir, log), 'altered');
    assert.match((await verifyCandidateFiles([manifest], dir)).join(','), /log changed/);
    await writeFile(join(dir, log), 'pass');
    await writeFile(join(dir, 'scripts/v1-ops-api.mjs'), 'altered');
    assert.match((await verifyCandidateFiles([manifest], dir)).join(','), /runtime config changed/);
    await writeFile(join(dir, 'scripts/v1-ops-api.mjs'), 'scripts/v1-ops-api.mjs');
    manifest.results[0].log = `${evidence}/../secret.txt`;
    assert.match((await verifyCandidateFiles([manifest], dir)).join(','), /log path or hash invalid/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a hashed replacement log without a business assertion does not cover the placeholder', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-replacement-proof-'));
  const digest = (value) => createHash('sha256').update(value).digest('hex');
  const evidence = 'docs/05-测试与发布/端到端验收/报告/V1-replacement-fixture';
  const log = `${evidence}/package.log.json`;
  const assertion = 'immutable_channel_update_and_browser_health_rollback';
  const allAssertions = ['five_catalog_origins_and_review_visibility', 'public_install_test_install_launch_health_and_protected_uninstall', 'public_provider_task_artifact_fixture', assertion, 'public_uninstall_keeps_data_and_history'];
  const source = allAssertions.map((name) => `mark('${name}');`).join('\n');
  const passed = (names) => `${names.map((name) => `PASS ${name}`).join('\n')}\n${JSON.stringify({ result: 'passed', logPath: `${evidence}/package.log.json` })}`;
  try {
    await mkdir(join(dir, evidence), { recursive: true });
    await mkdir(join(dir, 'scripts'));
    await writeFile(join(dir, 'scripts/v1-package-http.mjs'), source);
    await writeFile(join(dir, log), passed(allAssertions.filter((name) => name !== assertion)));
    const manifest = { runtime_assets: await makeRuntimeFixture(dir), evidence_dirs: [evidence], asset_sha256: { 'scripts/v1-package-http.mjs': digest(source) }, results: [{ asset: 'scripts/v1-package-http.mjs', covers: ['tests/e2e/release-rollback.spec.mjs'], assertions: allAssertions, log, log_sha256: digest(passed(allAssertions.filter((name) => name !== assertion))) }] };
    assert.match((await verifyCandidateFiles([manifest], dir)).join(','), /replacement assertion absent from source or passed log/);
    await writeFile(join(dir, log), passed(allAssertions));
    manifest.results[0].log_sha256 = digest(passed(allAssertions));
    assert.deepEqual(await verifyCandidateFiles([manifest], dir), []);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('unchanged HTML cannot hide changed or omitted dist JavaScript', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-dist-binding-'));
  try {
    const assets = await makeRuntimeFixture(dir);
    assert.deepEqual(await verifyRuntimeAssets(assets, dir), []);
    await writeFile(join(dir, 'apps/web/dist/assets/app.js'), 'console.log("tampered")');
    assert.match((await verifyRuntimeAssets(assets, dir)).join(','), /runtime dist changed: apps\/web\/dist\/assets\/app.js/);
    assert.match((await verifyCandidateFiles([{ runtime_assets: assets, results: [], asset_sha256: {} }], dir)).join(','), /runtime dist changed: apps\/web\/dist\/assets\/app.js/);
    await writeFile(join(dir, 'apps/web/dist/assets/app.js'), 'console.log("original")');
    delete assets.dist.files['apps/web/dist/assets/app.js'];
    assert.match((await verifyRuntimeAssets(assets, dir)).join(','), /runtime dist file unbound/);
    assets.dist.files['apps/web/dist/assets/app.js'] = sha('console.log("original")');
    assets.config.files['../outside.json'] = sha('outside');
    assert.match((await verifyRuntimeAssets(assets, dir)).join(','), /runtime config path not allowed/);
    delete assets.config.files['../outside.json'];
    delete assets.config.files['.herdr/state/integration-trust-roots-r9.json'];
    assert.match((await verifyRuntimeAssets(assets, dir)).join(','), /runtime config required file missing: \.herdr\/state\/integration-trust-roots-r9\.json/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('optional native app binding checks actual bundle files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dgos-native-binding-'));
  try {
    const assets = await makeRuntimeFixture(dir);
    const binary = 'apps/desktop/src-tauri/target/debug/bundle/macos/DGOS.app/Contents/MacOS/dgos-desktop';
    const resource = 'apps/desktop/src-tauri/target/debug/bundle/macos/DGOS.app/Contents/Resources/icon.icns';
    await mkdir(join(dir, binary, '..'), { recursive: true });
    await mkdir(join(dir, resource, '..'), { recursive: true });
    await writeFile(join(dir, binary), 'binary');
    await writeFile(join(dir, resource), 'icon');
    assets.native_app = { id: 'debug-app', root: 'apps/desktop/src-tauri/target/debug/bundle/macos/DGOS.app', files: { [binary]: sha('binary'), [resource]: sha('icon') } };
    assert.deepEqual(await verifyRuntimeAssets(assets, dir), []);
    await writeFile(join(dir, resource), 'changed icon');
    assert.match((await verifyRuntimeAssets(assets, dir)).join(','), /runtime native_app changed/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('command registry contains only actual narrow entries and keeps release binding enabled', async () => {
  const config = JSON.parse(await readFile('docs-gate.json', 'utf8'));
  const registry = config.commandRegistry;
  assert.equal(config.requireCommitBinding, true);
  assert.equal(config.requireManifest, true);
  assert.equal(config.release.allowPendingACs, false);
  assert.ok(Array.isArray(registry) && registry.length > 0);
  assert.equal(new Set(registry).size, registry.length);
  assert.ok(registry.includes('pnpm run test:release'));
  assert.ok(registry.includes('node --test tests/unit/runtime.test.mjs'));
  assert.ok(!registry.includes('pnpm test'));
  assert.ok(!registry.some((entry) => entry === 'node --test' || entry.includes('postgres-identity.test.mjs') || entry.includes('npm test --')));
});
