import { randomUUID, createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, realpath, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from '../apps/api/node_modules/pg/lib/index.js';
import { discoverMigrations, buildMigrationSql } from './migrate.mjs';
import { childDatabaseName, discoverRootTests, runCommand, sourceIdentity, summarizeCommandResult, validateAdminUrl } from './verify-release.mjs';

const root = resolve(new URL('..', import.meta.url).pathname);
const requirementsPath = 'docs/03-功能规格/V1/00-V1需求编号.md';
const acceptanceMatrixPath = 'docs/05-测试与发布/端到端验收/用例矩阵.md';
const reportRoot = 'docs/05-测试与发布/端到端验收/报告';
const timeoutMs = 60_000;
const candidateGroups = ['memory', 'pg', 'redis', 'tls', 'business', 'browser', 'native', 'guarded'];
const requiredCases = ['01', '02', '03', '05', '07', '09', '10', '11', '12', '13', '14', '15'].map((id) => `V1-E2E-${id}`);
const supplementalCases = ['16'].map((id) => `V1-E2E-${id}`);
const requiredRequirementCounts = { AC: 62, E2E: 12, NFR: 7, RG: 3 };
const runtimeKinds = ['config', 'envelope', 'dist', 'image'];
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
const nativeRoot = 'apps/desktop/src-tauri/target/debug/bundle/macos/DGOS.app';
const sha256 = /^[a-f0-9]{64}$/i;
const frozenDiagnosticMigrations = new Map([
  ['0045-network-route-activation.sql', 'c2bc2a47a3360e47b02d4edd9880b88694ec3ab84cdf7613674cd2099d40040d'],
  ['0046-package-retention.sql', '7321916de0ddff31f40d48b837acada75d8ec893691c7c65f22d0b707d6a9a83'],
  ['0047-ai-task-parameters.sql', '22b6e9e886943f2b660de4d54989e0587c58cb67e373fbd45b7140849f6f15f6'],
  ['0048-network-route-fingerprint.sql', '7879e6cf17753fa82254675756fbeb1fdfb9ad67e11808aec8922cd2f10cd33d'],
  ['0049-extension-management.sql', 'ba0bc80a0ccc74e05a5244b50e52e6a26df39ad854995ba038020b7d5d954f1b'],
  ['0050-session-management.sql', '8802fe3a02b0bf7364aeac96215da09454d0c53b48c06d2cb76c6f3d6b455d85'],
  ['0051-proxy-provisioning.sql', '778fddef654d67bc3ecfc01e11fd91f826f91d68a5b6c5c72568b5e35cca1939'],
]);
const pgOnly = new Set([
  'postgres-ai-task.test.mjs', 'postgres-app-packages.test.mjs', 'postgres-audit-outbox.test.mjs',
  'postgres-governance-policy.test.mjs', 'postgres-identity.test.mjs', 'postgres-provider-lease.test.mjs',
  'postgres-provider.test.mjs', 'postgres-quota.test.mjs', 'postgres-retention.test.mjs',
  'postgres-runtime.test.mjs', 'permission-action-lifecycle.test.mjs',
  'action-recovery.test.mjs', 'provider-audit-atomic.test.mjs',
  'provider-protocol-confirmations.test.mjs', 'provider-text-directory.test.mjs',
  'provider-parameters-pg.test.mjs', 'postgres-package-retention.test.mjs',
  'management-credential-pg.test.mjs', 'management-custom-run-pg.test.mjs',
  'management-definition-pg.test.mjs', 'management-online-pg.test.mjs',
  'management-translation-pg.test.mjs', 'management-routes-pg.test.mjs',
]);
const pgGuards = new Map([
  ['postgres-ai-task-atomic.test.mjs', 'Worker-B: dgos_v1_task name guard'],
  ['postgres-governance-hardening-r3.test.mjs', 'Worker-C: dgos_v1_governance name guard'],
  ['postgres-extension.test.mjs', 'Worker-C: dgos_v1_extensions name guard'],
  ['network-runtime-r6.test.mjs', 'Worker-I: dgos_v1_network_* name guard'],
]);
const external = new Map([
  ['app-package-browser.test.mjs', 'Worker-C/D: signed DGOS_BUNDLE_ENVELOPE and fixed port 15161'],
  ['app-package-routes.test.mjs', 'Worker-C/D: Playwright browser and fixed port 15162'],
  ['redis-security.test.mjs', 'Lead: Redis DB0 default; requires separate isolated Redis fixture'],
  ['real-v1-workflow.test.mjs', 'Worker-H: public Provider subprocess harness; needs exclusive 15171-15172, Redis DB5, and DGOS_VERIFY_ADMIN_URL set to the current random Verify child URL'],
  ['network-public-r6.test.mjs', 'Worker-I: local TLS/CONNECT and nested dgos_v1_network child; run only with explicit port isolation'],
  ['network-provisioning-public-r7.test.mjs', 'Worker-I: local TLS/CONNECT and nested dgos_v1_network child; run only with explicit port isolation'],
]);
const placeholders = new Set([
  'assistant.spec.mjs', 'permission-boundary.spec.mjs',
  'release-rollback.spec.mjs', 'system-settings.spec.mjs', 'app-catalog-lifecycle.spec.mjs',
]);
const replacementProofs = {
  'tests/e2e/release-rollback.spec.mjs': { case: 'V1-E2E-02', proofs: [{ asset: 'scripts/v1-package-http.mjs', assertions: ['five_catalog_origins_and_review_visibility', 'public_install_test_install_launch_health_and_protected_uninstall', 'public_provider_task_artifact_fixture', 'immutable_channel_update_and_browser_health_rollback', 'public_uninstall_keeps_data_and_history'] }] },
  'tests/e2e/app-catalog-lifecycle.spec.mjs': { case: 'V1-E2E-02', proofs: [{ asset: 'scripts/v1-package-http.mjs', assertions: ['five_catalog_origins_and_review_visibility', 'public_install_test_install_launch_health_and_protected_uninstall', 'immutable_channel_update_and_browser_health_rollback'] }] },
  'tests/e2e/assistant.spec.mjs': { case: 'V1-E2E-09', proofs: [
    { asset: 'apps/web/e2e/real-management-fixture.spec.mjs', assertions: ['ui.assistant.ask_request', 'ui.assistant.allow_replan_navigation'] },
  ] },
  'tests/e2e/permission-boundary.spec.mjs': { case: 'V1-E2E-10', proofs: [
    { asset: 'apps/web/e2e/real-context.spec.mjs', assertions: ['ui.system.appearance_context', 'ui.system.locale_context', 'ui.system.grid_context', 'ui.system.cas_conflict', 'ui.system.restore'] },
  ] },
  'tests/e2e/system-settings.spec.mjs': { case: 'V1-E2E-10', proofs: [
    { asset: 'apps/web/e2e/real-context.spec.mjs', assertions: ['ui.system.appearance_context', 'ui.system.locale_context', 'ui.system.grid_context', 'ui.system.cas_conflict', 'ui.system.restore'] },
  ] },
};
export { replacementProofs };

export function passedAssertions(asset, output) {
  const branchReceipts = output.split('\n').flatMap((line) => {
    try { const receipt = JSON.parse(line.trim()); return typeof receipt.case_passed === 'string' && Object.keys(receipt).length === 1 ? [receipt.case_passed] : []; } catch { return []; }
  });
  if (asset.endsWith('.spec.mjs') && asset.startsWith('apps/web/')) {
    const names = [...output.matchAll(/^\s*✓\s+[^\n]*›\s+([^\n]+?)\s*\(\d+(?:\.\d+)?[sm]\)\s*$/gm)].map((match) => match[1].trim());
    return [...new Set([...names, ...branchReceipts])];
  }
  if (asset === 'scripts/v1-package-http.mjs') {
    const receipt = [...output.split('\n')].reverse().map((line) => { try { return JSON.parse(line); } catch { return null; } }).find((item) => item?.result === 'passed' && item?.logPath);
    if (!receipt) return [];
    return [...new Set([...output.matchAll(/^PASS ([^\n]+)$/gm)].map((match) => match[1]))];
  }
  if (asset === 'scripts/v1-identity-http.mjs') {
    const start = output.indexOf('{\n  "workPackage": "V1-IDENTITY-r12"');
    const end = start < 0 ? -1 : output.indexOf('\n}\n', start);
    try { return JSON.parse(output.slice(start, end + 2)).cases.filter((item) => item.result === 'passed').map((item) => item.name); } catch { return []; }
  }
  if (asset === 'scripts/v1-extension-http.mjs') return [...new Set([...output.matchAll(/^\{"case":"([^"]+)","result":"passed"\}$/gm)].map((match) => match[1]))];
  if (asset === 'scripts/v1-extension-management-http.mjs') return [...new Set([...output.matchAll(/^PASS ([^\n]+)$/gm)].map((match) => match[1]))];
  if (asset === 'scripts/v1-provider-failures-http.mjs' || asset === 'scripts/v1-provider-http.mjs') return [...new Set([...output.matchAll(/^PASS ([^\n]+)$/gm)].map((match) => match[1]))];
  if (asset === 'scripts/v1-desktop-real.mjs') {
    const receipt = [...output.split('\n')].reverse().map((line) => { try { return JSON.parse(line); } catch { return null; } }).find((item) => item?.result === 'passed' && Array.isArray(item.cases));
    return receipt ? [...new Set(receipt.cases)] : [];
  }
  return [...new Set([...output.matchAll(/^\s*ok \d+ - (.+)$/gm)].map((match) => match[1].trim()))];
}

export function rowPassed(row) {
  return row.exit_code === 0 && row.signal === null && row.timed_out === false && row.source_drift === false &&
    Number.isInteger(row.tests) && row.tests > 0 && row.passed === row.tests && row.failed === 0 && row.skipped === 0;
}

export function coverageFromRows(rows) {
  const passed = rows.filter(rowPassed);
  const missing = [];
  const covered = [];
  for (const [placeholder, proof] of Object.entries(replacementProofs)) {
    for (const requirement of proof.proofs) for (const assertion of requirement.assertions) {
      if (!passed.some((row) => row.asset === requirement.asset && row.assertions?.includes(assertion))) missing.push(`${placeholder}: ${requirement.asset}: ${assertion}`);
    }
    if (!missing.some((item) => item.startsWith(`${placeholder}:`))) covered.push(placeholder);
  }
  return { covered, missing };
}

const caseRequirements = {
  'V1-E2E-01': [],
  'V1-E2E-02': replacementProofs['tests/e2e/release-rollback.spec.mjs'].proofs,
  'V1-E2E-03': [{ asset: 'scripts/v1-extension-management-http.mjs', assertions: ['template_credential_connect_discovery_invoke'] }, { asset: 'apps/web/e2e/real-management-fixture.spec.mjs', assertions: ['ui.mcp.first_install', 'ui.mcp.connect_invoke'] }],
  'V1-E2E-05': [{ asset: 'scripts/v1-provider-http.mjs', assertions: ['responses_snapshot_early_delta_artifact_replay'] }, { asset: 'apps/web/e2e/real-workbench.spec.mjs', assertions: ['real signed workbench submits one parameter task through a dedicated profile and restores it'] }],
  'V1-E2E-07': [{ asset: 'scripts/v1-provider-http.mjs', assertions: ['public_profile_account_config_quota_setup'] }, { asset: 'scripts/v1-provider-failures-http.mjs', assertions: ['authentication_failed', 'rate_limited', 'protocol_mismatch', 'tls_invalid', 'network_unreachable', 'timed_out', 'running_cancel', 'two_workers_restart_terminal_unique'] }],
  'V1-E2E-09': replacementProofs['tests/e2e/assistant.spec.mjs'].proofs,
  'V1-E2E-10': [],
  'V1-E2E-11': [{ asset: 'scripts/v1-identity-http.mjs', assertions: ['one_principal_multiple_independent_sessions', 'stale_current_session_logout_csrf_cookie_and_cross_instance_rejection'] }],
  'V1-E2E-12': [{ asset: 'scripts/v1-identity-http.mjs', assertions: ['key_once_scope_and_cross_instance_authentication', 'cross_instance_finite_rotation_overlap', 'cross_instance_expiry_and_revoke'] }],
  'V1-E2E-13': [{ asset: 'scripts/v1-provider-http.mjs', assertions: ['public_profile_account_config_quota_setup'] }, { asset: 'scripts/v1-provider-failures-http.mjs', assertions: ['authentication_failed', 'rate_limited', 'protocol_mismatch', 'tls_invalid', 'network_unreachable', 'timed_out', 'running_cancel', 'two_workers_restart_terminal_unique'] }],
  'V1-E2E-14': [],
  'V1-E2E-15': [],
};

export function caseCoverageFromRows(rows) {
  const passed = rows.filter(rowPassed);
  const covered = []; const missing = [];
  for (const [id, requirements] of Object.entries(caseRequirements)) {
    if (requirements.length === 0) { missing.push(`${id}: no current end-to-end assertion mapping`); continue; }
    const absent = requirements.flatMap(({ asset, assertions }) => assertions.filter((name) => !passed.some((row) => row.asset === asset && row.assertions?.includes(name))).map((name) => `${id}: ${asset}: ${name}`));
    if (absent.length) missing.push(...absent); else covered.push(id);
  }
  return { covered, missing };
}
const tlsFixtures = new Set([
  'network-settings.test.mjs', 'provider-egress-transport.test.mjs', 'provider-egress-stream.test.mjs',
  'provider-failures-http.test.mjs',
]);
const mixedDedicated = new Map([
  ['action-freshness.test.mjs', 'PG and memory cases run together; creates and drops dgos_v1_action_fresh_* through the Verify child'],
  ['audit-query.test.mjs', 'PG and memory cases run together under the strict Verify child'],
  ['runtime-api.test.mjs', 'PG and memory cases run together; creates and drops dgos_v1_runtime_* through the Verify child'],
  ['system-cross-process.test.mjs', 'PG and memory cases run together under the strict Verify child'],
  ['system-http-projection.test.mjs', 'PG and memory cases run together under the strict Verify child'],
  ['system-permission-rules.test.mjs', 'PG and memory cases run together under the strict Verify child'],
]);

export function classifyCandidate(file) {
  const name = file.split('/').at(-1);
  if (['proxy-provisioning-r7.test.mjs', 'network-context-r7.test.mjs'].includes(name)) return { phase: 'pg', reason: 'Mixed PG/memory file; owner fixture creates and drops a nested child through the strict Verify database' };
  if (placeholders.has(name) && file.startsWith('tests/e2e/')) return { phase: 'placeholder', reason: name === 'app-catalog-lifecycle.spec.mjs' ? 'Unauthenticated GET smoke does not prove E2E-02 lifecycle' : 'Unconditional skip; requires a real business-asserting replacement' };
  if (file === 'tests/e2e/assistant-settings-actions.spec.mjs') return { phase: 'memory', reason: 'Node test with in-memory Fastify fixture; not a real browser E2E' };
  if (external.has(name)) {
    if (name === 'redis-security.test.mjs') return { phase: 'redis', reason: 'Use verified Redis DB 6; never DB0 or FLUSHDB' };
    if (name === 'real-v1-workflow.test.mjs') return { phase: 'tls', reason: external.get(name) };
    if (name.startsWith('network-')) return { phase: 'tls', reason: external.get(name) };
    return { phase: 'browser', reason: external.get(name) };
  }
  if (pgGuards.has(name)) return { phase: 'guarded', reason: pgGuards.get(name) };
  if (name.startsWith('postgres-') || name.endsWith('-pg.test.mjs')) return { phase: 'pg', reason: 'PostgreSQL regression uses the strict random Verify child' };
  if (pgOnly.has(name)) return { phase: 'pg' };
  if (tlsFixtures.has(name)) return { phase: 'tls', reason: 'Local TLS/CONNECT fixture; fixed port or OpenSSL dependency requires port check' };
  if (mixedDedicated.has(name)) return { phase: 'pg', reason: mixedDedicated.get(name) };
  return { phase: 'memory' };
}

export async function candidatePlan(repoRoot = root) {
  const files = await discoverRootTests(repoRoot);
  const tests = files.map((file) => ({ file, ...classifyCandidate(file) }));
  const browserSpecs = (await readdir(join(repoRoot, 'apps/web/e2e'))).filter((name) => name.endsWith('.spec.mjs')).sort();
  return {
    root: repoRoot,
    main_tree_test_count: files.length,
    groups: Object.fromEntries(['memory', 'pg', 'redis', 'tls', 'business', 'browser', 'native', 'guarded', 'blocked', 'placeholder'].map((phase) => [phase, tests.filter((item) => item.phase === phase)])),
    additional_assets: [
      ...browserSpecs.map((name) => ({ phase: 'browser', file: `apps/web/e2e/${name}`, command: 'pnpm run test:web:e2e', owner: 'D' })),
      { phase: 'business', file: 'scripts/v1-package-http.mjs', command: 'node scripts/v1-package-http.mjs', owner: 'Verify' },
      { phase: 'business', file: 'scripts/v1-identity-http.mjs', command: 'node scripts/v1-identity-http.mjs', owner: 'Verify' },
      { phase: 'business', file: 'scripts/v1-extension-http.mjs', command: 'node scripts/v1-extension-http.mjs', owner: 'Verify' },
      { phase: 'business', file: 'scripts/v1-extension-management-http.mjs', command: 'node scripts/v1-extension-management-http.mjs', owner: 'Verify' },
      { phase: 'native', file: 'apps/desktop/scripts/e2e-macos.mjs', command: 'pnpm --filter @dgos/desktop e2e:macos', owner: 'F' },
      { phase: 'native', file: 'scripts/v1-desktop-real.mjs', command: 'node scripts/v1-desktop-real.mjs', owner: 'F' },
      { phase: 'native', file: 'apps/desktop/scripts/visible-macos.mjs', command: 'node apps/desktop/scripts/visible-macos.mjs', owner: 'F' },
      ...([{ phase: 'tls', file: 'scripts/v1-provider-failures-http.mjs', command: 'node scripts/v1-provider-failures-http.mjs', owner: 'I' }].filter((item) => existsSync(join(repoRoot, item.file)))),
    ],
    support_assets: [{ file: 'scripts/v1-ui-management-fixture.mjs', owner: 'H', role: 'long-lived browser fixture; not a passing test' }].filter((item) => existsSync(join(repoRoot, item.file))),
    isolation: {
      memory: 'Unset all PG and Redis URLs; explicitly pass only main-tree file paths.',
      pg: 'Create one random dgos_v1_verify_<32 hex> database from explicit dgos_v1_integrated admin URL; apply only Lead-frozen migration checksums. Set DGOS_DATABASE_URL and DGOS_EXTENSION_TEST_DATABASE_URL to that same child. Run files sequentially with zero skip and drop exactly that child.',
      redis: 'Verify redis://127.0.0.1:6379/6; run redis-security alone. Its test keys use dgos:* in DB6, so inspect and remove only run-owned keys; never FLUSHDB or DB0.',
      tls: 'Run real-v1-workflow alone with DGOS_VERIFY_ADMIN_URL set to the current random dgos_v1_verify_<32 hex> child URL, never dgos_v1_integrated. Reserve 15171-15172 and Redis DB5 for Worker-H harness; also verify 15181-15182 and 15183-15187 for network fixtures. Public network fixtures create and drop nested children through the strict Verify database; no paid upstream.',
      browser: 'D owns integration Compose ports 15200-15229 and signed package fixture; do not run in this tooling task.',
      native: 'F owns macOS signed/window visibility evidence; do not run in this tooling task.',
      business: 'Run identity on governance parent/Redis DB3, extension HTTP on an exclusively created random child of dgos_v1_extensions_r3final, public extension management on provider parent/Redis DB5, and package on packages parent.',
    },
    evidence_contract: {
      local_sweep: 'Preserve one immutable report/manifest pair and per-file TAP logs; record phase, actual exit/signal/timeout, pass/fail/skip, exclusions, DB name and exact cleanup.',
      source_binding: 'Capture Git HEAD and dirty worktree SHA256 before and after the candidate run; asset SHA256 for tested files and build inputs; any drift is a failed candidate. HEAD alone does not bind dirty source.',
      gate_manifest_fields: ['run_id', 'environment', 'code_version', 'commit', 'command', 'working_directory', 'exit_code', 'stats', 'started_at', 'test_report', 'asset_sha256', 'cleanup', 'sanitization', 'scope', 'limitations', 'prior_attempts'],
      release_binding: 'docs-evidence.json commit must be a real full SHA on current branch; each paired manifest.commit must match; no non-evidence source changes after that commit. Gate approvals and performance profile are separate required inputs.',
      migration_freeze: 'Diagnostic sweep checks board-frozen SHA256 for every 0045-0051 migration and excludes later SQL. This diagnostic is not candidate acceptance.',
      candidate_group_schema: { schema: 'dgos/v1-candidate-group/v1', fields: ['group', 'candidate_id', 'build_sha256', 'source_identity_start/source_identity_end/source_identity', 'source_drift', 'runtime_assets.config.files/envelope/dist.files/image/native_app(optional)', 'evidence_dirs', 'asset_sha256', 'results[asset,covers,cases,assertions,tests,passed,failed,skipped,exit_code,source_drift,log,log_sha256]', 'covered_cases', 'exit_code'], rule: 'One manifest per required group at the same source/build/runtime identity. Dist/native file lists are checked against recursively discovered files. A placeholder needs its fixed real harness and named business assertions in the hashed execution log; absent or weak coverage fails.' },
    },
    replacement_proofs: replacementProofs,
    case_requirements: caseRequirements,
    requirement_registry: await requirementRegistry(repoRoot),
    unresolved: ['Network and mixed PG files were statically regrouped after owner guard changes; actual zero-skip execution remains pending.', 'E2E-09 requires actual ask/allow branch receipts; E2E-10 still lacks native context and permission assertions.', 'real-v1-workflow requires its own TLS run with the current Verify child URL, exclusive H ports, and Redis DB5; historical Provider evidence does not bind the final source.', 'Browser/native and production TLS remain separate evidence.'],
  };
}

function tapCounts(output) {
  const count = (key) => Number(output.match(new RegExp(`^# ${key} (\\d+)$`, 'm'))?.[1] ?? 0);
  const failures = [...output.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map((match) => match[1]);
  return { tests: count('tests'), pass: count('pass'), fail: count('fail'), skipped: count('skipped'), failures };
}

export function candidateRunComplete({ results, excluded, setupError, sourceDrift }) {
  return !setupError && !sourceDrift && excluded.length === 0 && results.length > 0 && results.every((item) => item.passed && item.tests > 0 && item.fail === 0 && item.skipped === 0);
}

export function candidateFingerprint({ source_identity, build_sha256, runtime_assets }) {
  return createHash('sha256').update(JSON.stringify({ source_identity, build_sha256, runtime_assets })).digest('hex');
}

export function classifyRequirementStatus(id, evidence = []) {
  const rows = evidence.filter((item) => item?.requirement_id === id);
  if (rows.some((item) => item.status === 'failed')) return 'failed';
  if (rows.some((item) => item.status === 'skipped')) return 'skipped';
  if (rows.some((item) => item.status === 'passed')) return 'passed';
  return 'uncovered';
}

export function buildRequirementCoverage(ids, evidence = []) {
  return ids.map((requirement_id) => ({ requirement_id, status: classifyRequirementStatus(requirement_id, evidence) }));
}

export async function requirementRegistry(repoRoot = root) {
  const source = await readFile(resolve(repoRoot, requirementsPath), 'utf8');
  const featureRoot = resolve(repoRoot, 'docs/03-功能规格/V1');
  const featureFiles = [];
  const walk = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && entry.name.endsWith('.md')) featureFiles.push(path);
    }
  };
  await walk(featureRoot);
  const featureSources = await Promise.all(featureFiles.map((path) => readFile(path, 'utf8')));
  const matrix = await readFile(resolve(repoRoot, acceptanceMatrixPath), 'utf8');
  const ids = {
    AC: featureSources.flatMap((text) => {
      const feature = text.match(/^feature_id:\s*(V1-FR-\d{3})\s*$/m)?.[1] ?? text.match(/需求[：:]\s*`(V1-FR-\d{3})`/)?.[1];
      return feature ? [...text.matchAll(/^####\s+AC(\d{2})\b/gm)].map((match) => `${feature}/AC${match[1]}`) : [];
    }),
    E2E: requiredCases,
    NFR: [...source.matchAll(/`(V1-NFR-\d{3})`/g)].map((match) => match[1]),
    RG: [...source.matchAll(/`(V1-RG-\d{3})`/g)].map((match) => match[1]),
  };
  ids.AC = [...new Set(ids.AC)];
  ids.E2E = [...new Set(ids.E2E)];
  ids.NFR = [...new Set(ids.NFR)];
  ids.RG = [...new Set(ids.RG)];
  const countIssues = Object.entries(requiredRequirementCounts).flatMap(([kind, expectedCount]) => ids[kind].length === expectedCount ? [] : [`${kind} registry count ${ids[kind].length}, expected ${expectedCount}`]);
  const matrixCases = [...matrix.matchAll(/^\|\s*(V1-E2E-\d{2})\s*\|/gm)].map((match) => match[1]);
  const matrixIssues = matrixCases.filter((id) => !requiredCases.includes(id) && !supplementalCases.includes(id)).map((id) => `unclassified E2E matrix row ${id}`);
  return { source: requirementsPath, ids, supplemental_ids: { E2E: matrixCases.filter((id) => supplementalCases.includes(id)) }, expected_counts: requiredRequirementCounts, count_issues: [...countIssues, ...matrixIssues] };
}

export function summarizeRequirementCoverage(registry, evidence = []) {
  const result = {};
  for (const [kind, ids] of Object.entries(registry.ids)) {
    const rows = buildRequirementCoverage(ids, evidence);
    result[kind] = {
      total: rows.length,
      passed: rows.filter((row) => row.status === 'passed').map((row) => row.requirement_id),
      failed: rows.filter((row) => row.status === 'failed').map((row) => row.requirement_id),
      skipped: rows.filter((row) => row.status === 'skipped').map((row) => row.requirement_id),
      uncovered: rows.filter((row) => row.status === 'uncovered').map((row) => row.requirement_id),
    };
  }
  return result;
}

export function summarizeCandidate(plan, manifests, currentIdentity) {
  const issues = [];
  const byGroup = new Map();
  const expected = new Map(candidateGroups.map((group) => [group, [
    ...(plan.groups[group] ?? []).map((item) => item.file),
    ...(group === 'guarded' ? (plan.groups.blocked ?? []).map((item) => item.file) : []),
    ...(group === 'browser' ? (plan.groups.placeholder ?? []).map((item) => item.file) : []),
    ...plan.additional_assets.filter((item) => item.phase === group).map((item) => item.file),
  ]]));
  const reference = manifests[0];
  const allRows = manifests.flatMap((item) => item.results ?? []);
  const proofCoverage = coverageFromRows(allRows);
  const caseCoverage = caseCoverageFromRows(allRows);
  const registry = plan.requirement_registry ?? {
    ids: {
      AC: [],
      E2E: requiredCases,
      NFR: [],
      RG: [],
    },
    expected_counts: requiredRequirementCounts,
    count_issues: ['requirement registry was not attached to candidate plan'],
  };
  const requirementCoverage = summarizeRequirementCoverage(registry, manifests.flatMap((item) => item.requirements ?? []));
  if (!reference) issues.push('missing all group manifests');
  for (const group of candidateGroups) {
    if (!manifests.some((item) => item.group === group)) issues.push(`missing group: ${group}`);
  }
  for (const manifest of manifests) {
    if (!candidateGroups.includes(manifest.group)) { issues.push(`unknown group: ${manifest.group}`); continue; }
    if (byGroup.has(manifest.group)) issues.push(`duplicate group: ${manifest.group}`);
    byGroup.set(manifest.group, manifest);
    if (manifest.schema !== 'dgos/v1-candidate-group/v1') issues.push(`${manifest.group}: schema mismatch`);
    if (!Array.isArray(manifest.evidence_dirs) || manifest.evidence_dirs.length === 0 || manifest.evidence_dirs.some((dir) => typeof dir !== 'string')) issues.push(`${manifest.group}: evidence output paths missing`);
    if (!sha256.test(manifest.candidate_id ?? '') || manifest.candidate_id !== reference.candidate_id || manifest.candidate_id !== candidateFingerprint(manifest)) issues.push(`${manifest.group}: candidate mismatch`);
    if (!sha256.test(manifest.build_sha256 ?? '') || manifest.build_sha256 !== reference.build_sha256) issues.push(`${manifest.group}: build mismatch`);
    if (!manifest.source_identity || JSON.stringify(manifest.source_identity) !== JSON.stringify(reference.source_identity) || JSON.stringify(manifest.source_identity) !== JSON.stringify(currentIdentity)) issues.push(`${manifest.group}: source identity mismatch`);
    if (JSON.stringify(manifest.source_identity_start) !== JSON.stringify(manifest.source_identity) || JSON.stringify(manifest.source_identity_end) !== JSON.stringify(manifest.source_identity)) issues.push(`${manifest.group}: start/end source mismatch`);
    if (manifest.source_identity?.commit === null && !sha256.test(manifest.source_identity?.working_tree_sha256 ?? '')) issues.push(`${manifest.group}: dirty source hash missing`);
    if (manifest.source_drift !== false || manifest.exit_code !== 0) issues.push(`${manifest.group}: failed or drifting batch`);
    for (const kind of runtimeKinds) {
      const binding = manifest.runtime_assets?.[kind];
      if (!binding || !binding.id || (kind === 'image' && (!sha256.test(binding.sha256 ?? '') || binding.id !== `sha256:${binding.sha256}`)) || JSON.stringify(binding) !== JSON.stringify(reference.runtime_assets?.[kind])) issues.push(`${manifest.group}: runtime ${kind} missing or mismatched`);
    }
    if (JSON.stringify(manifest.runtime_assets?.native_app ?? null) !== JSON.stringify(reference.runtime_assets?.native_app ?? null)) issues.push(`${manifest.group}: runtime native_app mismatch`);
    const required = expected.get(manifest.group);
    const covered = new Set();
    const caseProofs = new Set();
    const rows = Array.isArray(manifest.results) ? manifest.results : [];
    if (rows.length === 0) issues.push(`${manifest.group}: zero results`);
    for (const row of rows) {
      if (!row.asset || !sha256.test(manifest.asset_sha256?.[row.asset] ?? '')) issues.push(`${manifest.group}: asset hash missing: ${row.asset ?? '?'}`);
      if (typeof row.log !== 'string' || !sha256.test(row.log_sha256 ?? '') || !manifest.evidence_dirs?.some((dir) => row.log.startsWith(`${dir}/`))) issues.push(`${manifest.group}: log binding missing: ${row.asset ?? '?'}`);
      if (!rowPassed(row)) issues.push(`${manifest.group}: failed/skipped/zero result: ${row.asset ?? '?'}`);
      for (const asset of row.covers ?? [row.asset]) {
        if ((plan.groups.placeholder ?? []).some((item) => item.file === asset)) {
          const proof = replacementProofs[asset];
          if (!proof || !proof.proofs.some((item) => item.asset === row.asset)) issues.push(`${manifest.group}: placeholder requires fixed real replacement: ${asset}`);
          if (!proofCoverage.covered.includes(asset)) issues.push(`${manifest.group}: placeholder business assertions missing: ${asset}`);
        } else if (asset !== row.asset) issues.push(`${manifest.group}: non-placeholder coverage requires the executed asset: ${asset}`);
        if (!required.includes(asset)) issues.push(`${manifest.group}: unexpected coverage: ${asset}`);
        else if (covered.has(asset)) issues.push(`${manifest.group}: duplicate coverage: ${asset}`);
        else covered.add(asset);
      }
      for (const id of row.cases ?? []) {
        if (!requiredCases.includes(id)) issues.push(`${manifest.group}: unregistered row case: ${id}`);
        else caseProofs.add(id);
      }
    }
    for (const asset of required) if (!covered.has(asset) && !proofCoverage.covered.includes(asset)) issues.push(`${manifest.group}: missing asset: ${asset}`);
    for (const id of manifest.covered_cases ?? []) if (!caseProofs.has(id)) issues.push(`${manifest.group}: case without passing row: ${id}`);
  }
  const cases = new Set(manifests.flatMap((item) => item.covered_cases ?? []));
  for (const missing of proofCoverage.missing) issues.push(`uncovered branch: ${missing}`);
  for (const missing of caseCoverage.missing) issues.push(`uncovered case branch: ${missing}`);
  for (const id of requiredCases) if (!caseCoverage.covered.includes(id)) issues.push(`missing case: ${id}`);
  for (const id of cases) if (!caseCoverage.covered.includes(id)) issues.push(`case without required proof: ${id}`);
  for (const id of cases) if (!requiredCases.includes(id)) issues.push(`unregistered case: ${id}`);
  if (registry.count_issues.length) issues.push(...registry.count_issues);
  return { candidate_complete: issues.length === 0, candidate_id: reference?.candidate_id ?? null, required_groups: candidateGroups, required_cases: requiredCases, covered_cases: caseCoverage.covered, requirement_coverage: requirementCoverage, uncovered_branches: [...proofCoverage.missing, ...caseCoverage.missing], issues };
}

function safeRelativePath(path) {
  return typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.includes('\\') && !path.includes('\0') && path.split('/').every((part) => part && part !== '.' && part !== '..');
}

export async function verifyCandidateFiles(manifests, repoRoot = root) {
  const issues = [];
  const actualRoot = await realpath(repoRoot);
  const checkHash = async (path, expected, label) => {
    if (!safeRelativePath(path) || !sha256.test(expected ?? '')) { issues.push(`${label} path or hash invalid: ${path ?? '?'}`); return; }
    try {
      const actualPath = await realpath(resolve(actualRoot, path));
      if (!actualPath.startsWith(`${actualRoot}/`)) { issues.push(`${label} outside repository: ${path}`); return; }
      const actual = createHash('sha256').update(await readFile(actualPath)).digest('hex');
      if (actual !== expected) issues.push(`${label} changed: ${path}`);
    } catch { issues.push(`${label} missing: ${path}`); }
  };
  issues.push(...await verifyRuntimeAssets(manifests[0]?.runtime_assets, repoRoot));
  for (const item of manifests) {
    for (const path of item.generated_files ?? []) await checkHash(path, item.generated_file_sha256?.[path], 'generated evidence');
    for (const [asset, expected] of Object.entries(item.asset_sha256 ?? {})) {
      if (!asset.startsWith('tests/') && !asset.startsWith('apps/') && !['scripts/v1-package-http.mjs', 'scripts/v1-identity-http.mjs', 'scripts/v1-extension-http.mjs', 'scripts/v1-extension-management-http.mjs', 'scripts/v1-desktop-real.mjs', 'scripts/v1-provider-failures-http.mjs'].includes(asset)) { issues.push(`asset outside candidate paths: ${asset}`); continue; }
      await checkHash(asset, expected, 'asset');
    }
    for (const row of item.results ?? []) {
      if (!item.evidence_dirs?.some((dir) => row.log?.startsWith(`${dir}/`))) { issues.push(`log outside group evidence: ${row.log ?? '?'}`); continue; }
      await checkHash(row.log, row.log_sha256, 'log');
      if (!row.assertions?.length) continue;
      if (!safeRelativePath(row.asset) || !safeRelativePath(row.log)) { issues.push(`assertion path invalid: ${row.asset}`); continue; }
      try {
        const source = await readFile(resolve(actualRoot, row.asset), 'utf8');
        const log = await readFile(resolve(actualRoot, row.log), 'utf8');
        const extracted = passedAssertions(row.asset, log);
        for (const name of row.assertions) if (!source.includes(name) || !extracted.includes(name)) issues.push(`replacement assertion absent from source or passed log: ${row.asset}: ${name}`);
      } catch { issues.push(`replacement source or log missing: ${row.asset}`); }
    }
  }
  return issues;
}

export async function verifyRuntimeAssets(assets, repoRoot = root) {
  const issues = [];
  const actualRoot = await realpath(repoRoot);
  const within = async (path, label) => {
    if (!safeRelativePath(path)) { issues.push(`${label} path invalid: ${path ?? '?'}`); return null; }
    try {
      const target = await realpath(resolve(actualRoot, path));
      if (!target.startsWith(`${actualRoot}/`)) { issues.push(`${label} outside repository: ${path}`); return null; }
      return target;
    } catch { issues.push(`${label} missing: ${path}`); return null; }
  };
  const check = async (path, expected, label) => {
    if (!sha256.test(expected ?? '')) { issues.push(`${label} hash invalid: ${path}`); return; }
    const target = await within(path, label);
    if (target && createHash('sha256').update(await readFile(target)).digest('hex') !== expected) issues.push(`${label} changed: ${path}`);
  };
  const config = assets?.config;
  if (!config?.id || !config.files || typeof config.files !== 'object' || Array.isArray(config.files)) issues.push('runtime config file list missing');
  else {
    const names = Object.keys(config.files);
    for (const path of requiredRuntimeConfig) if (!names.includes(path)) issues.push(`runtime config required file missing: ${path}`);
    for (const path of names) {
      if (!requiredRuntimeConfig.includes(path)) issues.push(`runtime config path not allowed: ${path}`);
      else await check(path, config.files[path], 'runtime config');
    }
  }
  const envelope = assets?.envelope;
  if (!envelope?.id || envelope.path !== envelopePath) issues.push('runtime envelope must bind signed workbench 1.0.1 r9 path');
  else await check(envelope.path, envelope.sha256, 'runtime envelope');
  const directory = async (binding, expectedRoot, label, requiredSuffix) => {
    if (!binding?.id || binding.root !== expectedRoot || !binding.files || typeof binding.files !== 'object' || Array.isArray(binding.files)) { issues.push(`${label} file list missing or root mismatch`); return; }
    const rootPath = await within(expectedRoot, label);
    if (!rootPath) return;
    const discovered = [];
    const walk = async (dir, prefix = '') => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await walk(join(dir, entry.name), relative);
        else if (entry.isFile()) discovered.push(`${expectedRoot}/${relative}`);
        else issues.push(`${label} unsupported directory entry: ${expectedRoot}/${relative}`);
      }
    };
    await walk(rootPath);
    const declared = Object.keys(binding.files);
    if (!discovered.length || !discovered.some((path) => path.endsWith(requiredSuffix))) issues.push(`${label} required entry missing`);
    for (const path of discovered) if (!declared.includes(path)) issues.push(`${label} file unbound: ${path}`);
    for (const path of declared) {
      if (!path.startsWith(`${expectedRoot}/`) || !discovered.includes(path)) issues.push(`${label} unexpected file: ${path}`);
      else await check(path, binding.files[path], label);
    }
  };
  await directory(assets?.dist, distRoot, 'runtime dist', '/index.html');
  if (assets?.native_app !== undefined) await directory(assets.native_app, nativeRoot, 'runtime native_app', '/Contents/MacOS/dgos-desktop');
  if (!assets?.image?.id || !sha256.test(assets.image.sha256 ?? '') || assets.image.id !== `sha256:${assets.image.sha256}`) issues.push('runtime image binding invalid');
  return issues;
}

async function main() {
  if (process.argv[2] === '--summarize') {
    if (process.argv.length < 4) throw new Error('--summarize requires at least one group manifest');
    if (process.cwd() !== root) throw new Error(`run from repository root: ${root}`);
    const manifestFiles = process.argv.slice(3);
    if (manifestFiles.some((file) => !safeRelativePath(file))) throw new Error('manifest paths must be relative repository paths');
    const manifests = await Promise.all(manifestFiles.map(async (file) => JSON.parse(await readFile(file, 'utf8'))));
    const plan = await candidatePlan(root);
    const unboundDirs = manifests.flatMap((item, index) => (item.evidence_dirs ?? []).filter((dir) => !(
      manifestFiles[index] === `${dir}-manifest.json` || manifestFiles[index].startsWith(`${dir}/`) ||
      (item.results ?? []).some((row) => row.log?.startsWith(`${dir}/`))
    )));
    if (unboundDirs.length > 0) throw new Error(`unbound evidence directories: ${unboundDirs.join(', ')}`);
    const evidenceDirs = [...new Set(manifests.flatMap((item) => item.evidence_dirs ?? []))];
    const generatedFiles = [...new Set(manifests.flatMap((item) => item.generated_files ?? []))];
    const currentIdentity = await sourceIdentity({ evidenceDirs, generatedFiles });
    const summary = summarizeCandidate(plan, manifests, currentIdentity);
    for (let index = 0; index < manifests.length; index++) if (!manifests[index].evidence_dirs?.some((dir) => manifestFiles[index] === `${dir}-manifest.json` || manifestFiles[index].startsWith(`${dir}/`))) summary.issues.push(`manifest outside its evidence: ${manifestFiles[index]}`);
    summary.issues.push(...await verifyCandidateFiles(manifests));
    const identityEnd = await sourceIdentity({ evidenceDirs, generatedFiles });
    if (JSON.stringify(currentIdentity) !== JSON.stringify(identityEnd)) summary.issues.push('source changed during candidate summary');
    summary.candidate_complete = summary.issues.length === 0;
    console.log(JSON.stringify(summary, null, 2));
    if (!summary.candidate_complete) process.exitCode = 1;
    return;
  }
  if (process.argv.includes('--plan')) {
    if (process.argv.length !== 3) throw new Error('--plan accepts no other arguments');
    if (process.cwd() !== root) throw new Error(`run from repository root: ${root}`);
    const plan = await candidatePlan(root);
    console.log(JSON.stringify({ ...plan, source_identity: await sourceIdentity() }, null, 2));
    return;
  }
  if (process.argv.length !== 3 || process.argv[2] !== '--diagnostic-r10') throw new Error('executable sweep requires --diagnostic-r10');
  const adminUrl = validateAdminUrl(process.env.DGOS_VERIFY_ADMIN_URL);
  if (process.cwd() !== root) throw new Error(`run from repository root: ${root}`);
  const runId = `V1-regression-diagnostic-r10-${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const evidenceDir = join(reportRoot, runId);
  await mkdir(evidenceDir, { recursive: false });
  const reportPath = `${evidenceDir}.md`;
  const manifestPath = `${evidenceDir}-manifest.json`;
  const startedAt = new Date().toISOString();
  const identityStart = await sourceIdentity({ evidenceDir });
  const files = await discoverRootTests(root);
  const entries = files.map((file) => ({ file, ...classifyCandidate(file) }));
  const results = [];
  const excluded = entries.filter((item) => !['memory', 'pg', 'guarded'].includes(item.phase));
  const baseEnv = { ...process.env };
  for (const key of ['DGOS_DATABASE_URL', 'DGOS_EXTENSION_TEST_DATABASE_URL', 'DGOS_REDIS_URL', 'DATABASE_URL', 'REDIS_URL', 'PGDATABASE', 'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD']) delete baseEnv[key];
  delete baseEnv.DGOS_VERIFY_ADMIN_URL;
  let database = null;
  let cleanup = 'not-created';
  let setupError = null;
  let admin;
  let child;
  let created = false;
  let migrations = [];
  const execute = async (entry, env) => {
    const serialFiles = new Set(['tests/integration/postgres-package-retention.test.mjs', 'tests/integration/postgres-retention.test.mjs']);
    const args = ['--test', '--test-reporter=tap', ...(serialFiles.has(entry.file) ? ['--test-concurrency=1'] : []), entry.file];
    const result = await runCommand(process.execPath, args, env, timeoutMs);
    const counts = tapCounts(result.output);
    const log = join(evidenceDir, `${String(results.length + 1).padStart(3, '0')}.tap.txt`);
    await writeFile(log, result.output);
    const record = { file: entry.file, phase: entry.phase, command: `node --test --test-reporter=tap ${entry.file}`, exit_code: result.exit_code, signal: result.signal, timed_out: result.timed_out, timeout_ms: timeoutMs, passed: summarizeCommandResult(result), ...counts, log };
    results.push(record);
    console.log(`${entry.phase} ${entry.file}: exit=${result.exit_code} pass=${counts.pass} fail=${counts.fail} skip=${counts.skipped}${result.timed_out ? ' timeout' : ''}`);
  };
  try {
    for (const entry of entries.filter((item) => item.phase === 'memory')) await execute(entry, baseEnv);
    admin = new pg.Pool({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 5000 });
    const actual = (await admin.query('SELECT current_database() AS name')).rows[0]?.name;
    if (actual !== decodeURIComponent(adminUrl.pathname.slice(1))) throw new Error(`admin database mismatch: ${actual}`);
    migrations = (await discoverMigrations()).filter((item) => Number(item.version.slice(0, 4)) <= 51);
    for (const [file, expected] of [
      ['0043-provider-protocol-receipts.sql', '2cbc7d81813a50c85393ae857b260c796e8a7ea4db8f7c122541ab0abf5266fb'],
      ['0044-system-projection.sql', 'a95019d20a3d2e63678b23f14fb35929f65c0192b075b4d995d35c8fb067e647'],
      ...frozenDiagnosticMigrations,
    ]) {
      const found = migrations.find((item) => item.file === file);
      if (!found || found.checksum !== expected) throw new Error(`frozen migration mismatch: ${file}`);
    }
    if (migrations.some((item) => Number(item.version.slice(0, 4)) >= 45 && !frozenDiagnosticMigrations.has(item.file))) throw new Error('unknown migration in frozen diagnostic range');
    database = childDatabaseName();
    await admin.query(`CREATE DATABASE ${database}`);
    created = true;
    const childUrl = new URL(adminUrl);
    childUrl.pathname = `/${database}`;
    child = new pg.Pool({ connectionString: childUrl.toString(), connectionTimeoutMillis: 5000 });
    const childActual = (await child.query('SELECT current_database() AS name')).rows[0]?.name;
    if (childActual !== database) throw new Error(`child database mismatch: ${childActual}`);
    await child.query(buildMigrationSql(migrations));
    await child.end(); child = null;
    const pgEnv = { ...baseEnv, DGOS_DATABASE_URL: childUrl.toString(), DGOS_EXTENSION_TEST_DATABASE_URL: childUrl.toString() };
    for (const entry of entries.filter((item) => item.phase === 'pg')) await execute(entry, pgEnv);
    for (const entry of entries.filter((item) => item.phase === 'guarded')) await execute(entry, pgEnv);
  } catch (error) {
    setupError = error.message;
    console.error(`sweep setup: ${error.message}`);
  } finally {
    try { if (child) await child.end(); } catch (error) { setupError ??= error.message; }
    if (created) {
      try { await admin.query(`DROP DATABASE ${database} WITH (FORCE)`); cleanup = `dropped ${database}`; }
      catch (error) { cleanup = `failed to drop ${database}: ${error.message}`; setupError ??= error.message; }
    }
    try { if (admin) await admin.end(); } catch (error) { setupError ??= error.message; }
    const assets = Object.fromEntries(await Promise.all(['scripts/v1-regression-sweep.mjs', 'scripts/migrate.mjs', ...files].map(async (file) => [file, createHash('sha256').update(await readFile(file)).digest('hex')])));
    const identityEnd = await sourceIdentity({ evidenceDir });
    const sourceDrift = JSON.stringify(identityStart) !== JSON.stringify(identityEnd);
    const totals = results.reduce((sum, item) => ({ files: sum.files + 1, passed: sum.passed + item.pass, failed: sum.failed + item.fail, skipped: sum.skipped + item.skipped }), { files: 0, passed: 0, failed: 0, skipped: 0 });
    const candidateComplete = candidateRunComplete({ results, excluded, setupError, sourceDrift });
    const manifest = { run_id: runId, work_package: 'V1-REGRESSION-DIAGNOSTIC-r10', started_at: startedAt, ended_at: new Date().toISOString(), environment: 'local Node and isolated PostgreSQL', admin_database: decodeURIComponent(adminUrl.pathname.slice(1)), child_database: database, cleanup, frozen_migrations: migrations.map(({ file, checksum }) => ({ file, checksum })), source_identity_start: identityStart, source_identity_end: identityEnd, source_drift: sourceDrift, asset_sha256: assets, totals, results, excluded, setup_error: setupError, candidate_complete: candidateComplete, limitations: ['One diagnostic batch while product owners may write; source drift is recorded and not retried.', 'Browser, desktop, Redis and TLS groups excluded by task ownership or shared resources.', 'Dedicated database-name guards retain actual skip counts; extension guard runs without its dedicated database URL.', 'Memory phase has no PG or Redis URL; PG URL is injected only for PG and guarded files.', 'This local run does not establish full V1 or release-gate acceptance.'] };
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    const lines = [
      `# ${runId}`, '', `- Work package: V1-REGRESSION-DIAGNOSTIC r10`, `- Environment: local Node, isolated PostgreSQL`, `- Started: ${startedAt}`, `- Ended: ${manifest.ended_at}`, `- Source drift: ${sourceDrift}; start=${JSON.stringify(identityStart)}; end=${JSON.stringify(identityEnd)}`, `- Database: ${database ?? 'not-created'}; cleanup: ${cleanup}; setup error: ${setupError ?? 'none'}`, `- Node TAP totals: ${JSON.stringify(totals)}. File exit status is recorded separately; skipped tests are not passes.`, `- Candidate complete: ${candidateComplete}; excluded files: ${excluded.length}.`, `- Manifest: ${manifestPath}`, '', '## Executed files', '', '| Phase | File | Exit | Passed | Failed | Skipped | Timeout | Log |', '| --- | --- | ---: | ---: | ---: | ---: | --- | --- |',
      ...results.map((item) => `| ${item.phase} | ${item.file} | ${item.exit_code ?? `signal:${item.signal ?? 'null'}`} | ${item.pass} | ${item.fail} | ${item.skipped} | ${item.timed_out} | ${item.log} |`),
      '', '## Failed assertions', '', ...results.flatMap((item) => item.failures.map((name) => `- ${item.file}: ${name} (${item.log})`)),
      '', '## Excluded or guarded files', '', ...excluded.map((item) => `- ${item.file}: ${item.reason}`),
      '', '## Limitations', '', ...manifest.limitations.map((item) => `- ${item}`), ''
    ];
    await writeFile(reportPath, lines.join('\n'));
    console.log(`Evidence: ${reportPath} ${manifestPath}`);
    if (!candidateComplete) process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
