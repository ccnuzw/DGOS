import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from '../apps/api/node_modules/pg/lib/index.js';
import { createClient } from '../apps/api/node_modules/redis/dist/index.js';
import { buildMigrationSql, discoverMigrations } from './migrate.mjs';
import { candidateFingerprint, candidatePlan, caseCoverageFromRows, passedAssertions, summarizeCandidate, verifyCandidateFiles, verifyRuntimeAssets } from './v1-regression-sweep.mjs';
import { childDatabaseName, runCommand, sourceIdentity, summarizeCommandResult, validateAdminUrl } from './verify-release.mjs';

const root = resolve(new URL('..', import.meta.url).pathname);
const reportRoot = 'docs/05-测试与发布/端到端验收/报告';
export const executableGroups = ['memory', 'pg', 'redis', 'tls', 'business', 'guarded'];
export const candidateTimeoutMs = 180_000;
const frozen = new Map([
  ['0045-network-route-activation.sql', 'c2bc2a47a3360e47b02d4edd9880b88694ec3ab84cdf7613674cd2099d40040d'],
  ['0046-package-retention.sql', '7321916de0ddff31f40d48b837acada75d8ec893691c7c65f22d0b707d6a9a83'],
  ['0047-ai-task-parameters.sql', '22b6e9e886943f2b660de4d54989e0587c58cb67e373fbd45b7140849f6f15f6'],
  ['0048-network-route-fingerprint.sql', '7879e6cf17753fa82254675756fbeb1fdfb9ad67e11808aec8922cd2f10cd33d'],
  ['0049-extension-management.sql', 'ba0bc80a0ccc74e05a5244b50e52e6a26df39ad854995ba038020b7d5d954f1b'],
  ['0050-session-management.sql', '8802fe3a02b0bf7364aeac96215da09454d0c53b48c06d2cb76c6f3d6b455d85'],
  ['0051-proxy-provisioning.sql', '778fddef654d67bc3ecfc01e11fd91f826f91d68a5b6c5c72568b5e35cca1939'],
]);
const ports = new Map([
  ['tests/security/provider-egress-transport.test.mjs', [15171]],
  ['tests/integration/real-v1-workflow.test.mjs', [15171, 15172]],
  ['tests/integration/network-settings.test.mjs', [15181, 15182]],
  ['tests/integration/network-public-r6.test.mjs', [15183, 15184]],
  ['tests/integration/network-provisioning-public-r7.test.mjs', [15185, 15186, 15187]],
  ['scripts/v1-provider-failures-http.mjs', [15181, 15182, 15183, 15184, 15185, 15186, 15187, 15188, 15189]],
  ['tests/integration/provider-failures-http.test.mjs', [15181, 15182, 15183, 15184, 15185, 15186, 15187, 15188, 15189]],
  ['scripts/v1-identity-http.mjs', [15121, 15122]],
  ['scripts/v1-extension-http.mjs', [15141]],
  ['scripts/v1-extension-management-http.mjs', [15173, 15174]],
  ['scripts/v1-package-http.mjs', [15161]],
]);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const safePath = (path) => typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.includes('\\') && path.split('/').every((part) => part && part !== '..' && part !== '.');

export function isolatedEnvironment(parent, group, childUrl) {
  const env = { ...parent };
  for (const key of ['DGOS_DATABASE_URL', 'DGOS_EXTENSION_TEST_DATABASE_URL', 'DGOS_VERIFY_ADMIN_URL', 'DGOS_PROVIDER_HTTP_ADMIN_DATABASE_URL', 'DGOS_PROVIDER_HTTP_REDIS_URL', 'DGOS_PROVIDER_FAILURES_ADMIN_DATABASE_URL', 'DGOS_PROVIDER_FAILURES_REDIS_URL', 'DGOS_REDIS_URL', 'DATABASE_URL', 'REDIS_URL', 'PGDATABASE', 'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD']) delete env[key];
  if (['pg', 'tls', 'guarded'].includes(group)) {
    if (!childUrl || !/^dgos_v1_verify_[a-f0-9]{32}$/.test(new URL(childUrl).pathname.slice(1))) throw new Error('random Verify child URL required');
    env.DGOS_DATABASE_URL = childUrl;
    env.DGOS_EXTENSION_TEST_DATABASE_URL = childUrl;
    if (group === 'tls') env.DGOS_VERIFY_ADMIN_URL = childUrl;
  }
  if (group === 'redis') env.DGOS_REDIS_URL = 'redis://127.0.0.1:6379/6';
  if (group === 'tls') {
    env.DGOS_PROVIDER_HTTP_REDIS_URL = 'redis://127.0.0.1:6379/5';
    env.DGOS_PROVIDER_FAILURES_REDIS_URL = 'redis://127.0.0.1:6379/5';
  }
  return env;
}

export function frozenMigrations(all) {
  const selected = all.filter((item) => /^\d{4}-/.test(item.version) && Number(item.version.slice(0, 4)) <= 51);
  if (selected.length !== 47 || selected.at(-1)?.version !== '0051-proxy-provisioning') throw new Error('frozen migration set must contain exactly 47 files through 0051');
  for (const [file, checksum] of frozen) if (selected.find((item) => item.file === file)?.checksum !== checksum) throw new Error(`frozen migration mismatch: ${file}`);
  if (selected.some((item) => Number(item.version.slice(0, 4)) >= 45 && !frozen.has(item.file))) throw new Error('unknown migration in frozen range');
  return selected;
}

export function tapResult(output) {
  const count = (name) => Number(output.match(new RegExp(`^# ${name} (\\d+)$`, 'm'))?.[1] ?? 0);
  return { tests: count('tests'), passed: count('pass'), failed: count('fail'), skipped: count('skipped') };
}

export function directHarnessResult(output) {
  for (const line of output.trim().split('\n').reverse()) {
    let receipt;
    try { receipt = JSON.parse(line); } catch { continue; }
    if (receipt?.status !== 'passed' || !Number.isInteger(receipt.cases) || receipt.cases <= 0) continue;
    return { tests: receipt.cases, passed: receipt.cases, failed: 0, skipped: 0 };
  }
  return { tests: 0, passed: 0, failed: 0, skipped: 0 };
}

export function businessHarnessResult(file, output) {
  const assertions = passedAssertions(file, output);
  let valid = false;
  if (file === 'scripts/v1-identity-http.mjs') valid = /"cleanup":"passed"/.test(output) && assertions.length === 20;
  else if (file === 'scripts/v1-extension-http.mjs') valid = /"status":"passed"/.test(output) && assertions.length === 12;
  else if (file === 'scripts/v1-extension-management-http.mjs') valid = /"status":"passed"/.test(output) && assertions.length === 8;
  else if (file === 'scripts/v1-package-http.mjs') valid = /"result":"passed"/.test(output) && assertions.length >= 10;
  return { tests: valid ? assertions.length : 0, passed: valid ? assertions.length : 0, failed: 0, skipped: 0, assertions: valid ? assertions : [] };
}

export function businessEvidencePaths(file, output) {
  const receipt = output.trim().split('\n').reverse().map((line) => { try { return JSON.parse(line); } catch { return null; } }).find((item) => item && (item.reportPath || item.evidencePath));
  if (!receipt) return file === 'scripts/v1-identity-http.mjs' && /"cleanup":"passed"/.test(output) ? [] : null;
  const raw = file === 'scripts/v1-extension-http.mjs' ? [receipt.evidencePath, receipt.manifestPath] : [receipt.reportPath, receipt.logPath, receipt.manifestPath];
  const paths = raw.map((path) => typeof path === 'string' && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path);
  const patterns = {
    'scripts/v1-extension-http.mjs': /^\.herdr\/V1-EXT-http-[A-Za-z0-9_-]+(?:-manifest)?\.json$/,
    'scripts/v1-extension-management-http.mjs': /^tests\/extensions\/evidence\/V1-EXT-PUBLIC-r7-[A-Za-z0-9_-]+(?:-manifest\.json|\.json|\.log)$/,
    'scripts/v1-package-http.mjs': /^\.herdr\/state\/package-http-evidence\/V1-package-http-[A-Za-z0-9_-]+(?:-manifest\.json|\.log\.json|\.md)$/,
  };
  if (!patterns[file] || paths.some((path) => !patterns[file].test(path))) return null;
  const stems = paths.map((path) => path.replace(/(?:-manifest\.json|\.log\.json|\.json|\.log|\.md)$/, ''));
  return stems.every((stem) => stem === stems[0]) ? paths : null;
}

export function successfulRow(row) {
  return row.exit_code === 0 && row.signal === null && row.timed_out === false && row.tests > 0 && row.passed === row.tests && row.failed === 0 && row.skipped === 0 && row.source_drift === false;
}

async function checkPorts(file) {
  for (const port of ports.get(file) ?? []) {
    const server = createServer();
    await new Promise((done, fail) => { server.once('error', fail); server.listen({ host: '127.0.0.1', port, exclusive: true }, done); });
    await new Promise((done) => server.close(done));
  }
}

async function redisClient(database) {
  const client = createClient({ url: `redis://127.0.0.1:6379/${database}`, socket: { connectTimeout: 5000 } });
  client.on('error', () => {});
  await client.connect();
  if (Number(await client.sendCommand(['CLIENT', 'INFO']).then((text) => text.match(/db=(\d+)/)?.[1])) !== database) {
    await client.quit(); throw new Error(`Redis DB${database} identity mismatch`);
  }
  await client.ping();
  return client;
}

async function redisKeys(client, pattern) {
  const keys = new Set();
  for await (const batch of client.scanIterator({ MATCH: pattern, COUNT: 100 })) for (const key of Array.isArray(batch) ? batch : [batch]) keys.add(key);
  return keys;
}

export function providerEvidencePaths(output) {
  let receipt;
  for (const line of output.trim().split('\n').reverse()) {
    try { receipt = JSON.parse(line.replace(/^#\s*/, '')); if (receipt.reportPath && receipt.manifestPath) break; }
    catch { /* TAP lines are not receipts. */ }
  }
  if (!receipt?.reportPath || !receipt?.manifestPath) return [];
  const paths = [receipt.reportPath, receipt.logPath, receipt.manifestPath].map((path) => typeof path === 'string' && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path);
  if (paths.some((path) => !/^tests\/provider\/evidence\/V1-PROVIDER(?:-FAILURES)?-r[68]-[A-Za-z0-9_-]+(?:-manifest\.json|\.json|\.log)$/.test(path))) return [];
  const stems = paths.map((path) => path.replace(/(?:-manifest\.json|\.json|\.log)$/, ''));
  return stems.every((stem) => stem === stems[0]) ? paths : [];
}

async function bindingsFrom(path) {
  if (!safePath(path)) throw new Error('bindings path must be a relative repository file');
  const bindings = JSON.parse(await readFile(path, 'utf8'));
  if (!/^[a-f0-9]{64}$/.test(bindings.build_sha256 ?? '')) throw new Error('build_sha256 required');
  const issues = await verifyRuntimeAssets(bindings.runtime_assets);
  if (issues.length) throw new Error(issues.join('; '));
  return bindings;
}

export async function verifyRuntimeBindings(bindings) {
  return verifyRuntimeAssets(bindings.runtime_assets);
}

export async function executeFiveGroups({ adminUrl, bindings, runId = `V1-candidate-r12-${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`, evidenceRoot = reportRoot, plan = null, runner = runCommand, identityReader = sourceIdentity, makePool = (url) => new pg.Pool({ connectionString: url, connectionTimeoutMillis: 5000 }), getMigrations = discoverMigrations, connectRedis = redisClient } = {}) {
  if (process.cwd() !== root) throw new Error(`run from repository root: ${root}`);
  const parsed = validateAdminUrl(adminUrl);
  if (!bindings?.build_sha256 || !bindings?.runtime_assets) throw new Error('explicit build and runtime bindings required');
  const initialBindings = await verifyRuntimeBindings(bindings);
  if (initialBindings.length) throw new Error(initialBindings.join('; '));
  plan ??= await candidatePlan(root);
  const migrations = frozenMigrations(await getMigrations());
  const dirs = Object.fromEntries(executableGroups.map((group) => [group, join(evidenceRoot, `${runId}-${group}`)]));
  const evidenceDirs = Object.values(dirs);
  const generatedFiles = [];
  const generatedHashes = {};
  const readIdentity = () => identityReader({ evidenceDirs, generatedFiles });
  for (const dir of evidenceDirs) await mkdir(dir, { recursive: false });
  const startIdentity = await readIdentity();
  const candidateId = candidateFingerprint({ source_identity: startIdentity, build_sha256: bindings.build_sha256, runtime_assets: bindings.runtime_assets });
  const manifests = [];
  let fatal = null;
  for (const group of executableGroups) {
    const startedAt = new Date().toISOString();
    const dir = dirs[group];
    const entries = [...(plan.groups[group] ?? []), ...plan.additional_assets.filter((item) => item.phase === group)];
    const results = [];
    const failures = [];
    const assetSha256 = {};
    const cleanup = [];
    let error = null; let admin = null; let child = null; let created = false; let database = null;
    let redis = null; let redisBefore = null;
    const groupStart = await readIdentity();
    if (JSON.stringify(groupStart) !== JSON.stringify(startIdentity)) fatal ??= 'source identity changed before group';
    try {
      if (fatal) throw new Error(fatal);
      if (group === 'pg' || group === 'tls' || group === 'guarded') {
        admin = makePool(parsed.toString());
        const actual = (await admin.query('SELECT current_database() AS name')).rows[0]?.name;
        if (actual !== decodeURIComponent(parsed.pathname.slice(1))) throw new Error(`admin database mismatch: ${actual}`);
        database = childDatabaseName();
        await admin.query(`CREATE DATABASE ${database}`); created = true;
        const childUrl = new URL(parsed); childUrl.pathname = `/${database}`;
        child = makePool(childUrl.toString());
        if ((await child.query('SELECT current_database() AS name')).rows[0]?.name !== database) throw new Error('child database mismatch');
        await child.query(buildMigrationSql(migrations));
        await child.end(); child = null;
      }
      if (group === 'redis' || group === 'tls') {
        redis = await connectRedis(group === 'redis' ? 6 : 5);
        if (group === 'redis') redisBefore = {
          limiter: await redisKeys(redis, 'dgos:ratelimit:integration-*'),
          secret: await redisKeys(redis, 'dgos:secret:integration/*'),
        };
      }
      const childUrl = database ? new URL(parsed) : null;
      if (childUrl) childUrl.pathname = `/${database}`;
      for (const entry of entries) {
        const file = entry.file;
        try { await checkPorts(file); }
        catch (caught) { error = `port precondition for ${file}: ${caught.message}`; fatal = error; break; }
        const env = isolatedEnvironment(process.env, group, childUrl?.toString());
        const businessHarness = group === 'business';
        if (businessHarness) {
          if (file === 'scripts/v1-identity-http.mjs') { env.DGOS_IDENTITY_ADMIN_DATABASE_URL = process.env.DGOS_IDENTITY_ADMIN_DATABASE_URL; env.DGOS_IDENTITY_REDIS_URL = 'redis://127.0.0.1:6379/3'; }
          if (file === 'scripts/v1-extension-http.mjs') env.DGOS_EXTENSION_TEST_DATABASE_URL = process.env.DGOS_EXTENSION_TEST_DATABASE_URL;
          if (file === 'scripts/v1-extension-management-http.mjs') { env.DGOS_EXT_PUBLIC_ADMIN_DATABASE_URL = process.env.DGOS_EXT_PUBLIC_ADMIN_DATABASE_URL; env.DGOS_EXT_PUBLIC_REDIS_URL = 'redis://127.0.0.1:6379/5'; }
          if (file === 'scripts/v1-package-http.mjs') env.DGOS_PACKAGE_HTTP_ADMIN_DATABASE_URL = process.env.DGOS_PACKAGE_HTTP_ADMIN_DATABASE_URL;
        }
        const directHarness = businessHarness || file === 'scripts/v1-provider-failures-http.mjs';
        const args = directHarness ? [file] : ['--test', '--test-reporter=tap', file];
        const timeout = group === 'tls' && (file.endsWith('/real-v1-workflow.test.mjs') || directHarness) ? 240_000 : candidateTimeoutMs;
        const result = await runner(process.execPath, args, env, timeout);
        const providerReceiptRequired = file.endsWith('/real-v1-workflow.test.mjs') || file.endsWith('/provider-failures-http.test.mjs') || file === 'scripts/v1-provider-failures-http.mjs';
        const evidencePaths = businessHarness ? businessEvidencePaths(file, result.output ?? '') : providerReceiptRequired ? providerEvidencePaths(result.output ?? '') : [];
        if (businessHarness || providerReceiptRequired) {
          if (!evidencePaths || (providerReceiptRequired && evidencePaths.length !== 3)) failures.push(`${file}: harness evidence receipt missing or malformed`);
          else {
            for (const path of evidencePaths) {
              generatedFiles.push(path);
              generatedHashes[path] = digest(await readFile(path));
            }
          }
        }
        const log = join(dir, `${String(results.length + 1).padStart(3, '0')}.${directHarness ? 'raw' : 'tap'}.txt`);
        await writeFile(log, result.output ?? '');
        assetSha256[file] = digest(await readFile(file));
        const current = await readIdentity();
        const counts = businessHarness ? businessHarnessResult(file, result.output ?? '') : directHarness ? directHarnessResult(result.output ?? '') : tapResult(result.output ?? '');
        const row = { asset: file, covers: [file], cases: [], assertions: counts.assertions ?? (result.exit_code === 0 && !result.timed_out && !result.signal && counts.failed === 0 && counts.skipped === 0 && counts.passed === counts.tests ? passedAssertions(file, result.output ?? '') : []), command: `node ${args.join(' ')}`, ...counts, exit_code: result.exit_code, signal: result.signal ?? null, timed_out: Boolean(result.timed_out), timeout_ms: timeout, source_drift: JSON.stringify(startIdentity) !== JSON.stringify(current), log, log_sha256: digest(result.output ?? '') };
        results.push(row);
        console.log(`${group} ${file}: exit=${row.exit_code} tests=${row.tests} pass=${row.passed} fail=${row.failed} skip=${row.skipped}`);
        if (!successfulRow(row) || !summarizeCommandResult(result)) failures.push(`${file}: exit=${row.exit_code} signal=${row.signal} timeout=${row.timed_out} tests=${row.tests} failed=${row.failed} skipped=${row.skipped}`);
        if (row.source_drift) { error = `source drift after ${file}`; fatal = error; break; }
        if ((businessHarness || providerReceiptRequired) && !evidencePaths) { error = `harness evidence receipt missing: ${file}`; fatal = error; break; }
      }
    } catch (caught) { error = caught.message; fatal ??= error; }
    finally {
      if (redis) {
        try {
          if (redisBefore) for (const [kind, pattern] of [['limiter', 'dgos:ratelimit:integration-*'], ['secret', 'dgos:secret:integration/*']]) {
            const after = await redisKeys(redis, pattern);
            const owned = [...after].filter((key) => !redisBefore[kind].has(key));
            for (const key of owned) await redis.del(key);
            cleanup.push(`Redis DB6 ${kind}: removed ${JSON.stringify(owned)}`);
          }
          await redis.quit();
        } catch (caught) { error ??= `Redis cleanup: ${caught.message}`; fatal ??= error; }
      }
      try { if (child) await child.end(); } catch (caught) { error ??= caught.message; }
      if (created) {
        try { await admin.query(`DROP DATABASE ${database} WITH (FORCE)`); cleanup.push(`dropped ${database}`); }
        catch (caught) { cleanup.push(`failed to drop ${database}: ${caught.message}`); error ??= caught.message; fatal ??= error; }
      }
      try { if (admin) await admin.end(); } catch (caught) { error ??= caught.message; }
      const endIdentity = await readIdentity();
      const drift = JSON.stringify(startIdentity) !== JSON.stringify(endIdentity) || JSON.stringify(startIdentity) !== JSON.stringify(groupStart);
      if (drift) { error ??= 'source identity changed'; fatal ??= error; }
      const unexecuted = entries.map((item) => item.file).filter((file) => !results.some((row) => row.asset === file));
      if (unexecuted.length) error ??= `unexecuted assets: ${unexecuted.length}`;
      if (!results.length) error ??= 'group has zero results';
      if (failures.length) error ??= `${failures.length} asset failure(s)`;
      const manifest = { schema: 'dgos/v1-candidate-group/v1', work_package: 'V1-CANDIDATE-COVERAGE', revision: 15, run_id: `${runId}-${group}`, group, started_at: startedAt, ended_at: new Date().toISOString(), candidate_id: candidateId, build_sha256: bindings.build_sha256, runtime_assets: bindings.runtime_assets, source_identity: startIdentity, source_identity_start: groupStart, source_identity_end: endIdentity, source_drift: drift, exit_code: error ? 1 : 0, candidate_complete: false, environment: 'local host Node with isolated resources; image is candidate artifact binding only', admin_database: group === 'pg' || group === 'tls' || group === 'guarded' ? decodeURIComponent(parsed.pathname.slice(1)) : null, child_database: database, redis_db: group === 'redis' ? 6 : group === 'tls' ? 5 : null, frozen_migrations: group === 'pg' || group === 'tls' || group === 'guarded' ? migrations.map(({ file, checksum }) => ({ file, checksum })) : [], evidence_dirs: [dir], generated_files: [...generatedFiles], generated_file_sha256: { ...generatedHashes }, asset_sha256: assetSha256, results, failed_assets: failures, unexecuted_assets: unexecuted, covered_cases: caseCoverageFromRows(results).covered, cleanup, error, limitations: ['Local host execution only; browser/native and unresolved branch receipts remain pending.', 'Image field binds the candidate artifact and does not claim these tests ran in that image.', 'No E2E case is claimed without explicit passing business assertions.'] };
      await writeFile(`${dir}-manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
      await writeFile(`${dir}.md`, [`# ${manifest.run_id}`, '', `- Work package: V1-CANDIDATE-RUNNER r12`, `- Result: ${error ?? 'group commands passed'}; exit ${manifest.exit_code}`, `- Source drift: ${drift}`, `- Child database: ${database ?? 'none'}`, `- Redis DB: ${manifest.redis_db ?? 'none'}`, `- Cleanup: ${cleanup.join('; ') || 'no resources created'}`, `- Manifest: ${dir}-manifest.json`, '', '| Asset | Exit | Tests | Passed | Failed | Skipped | Timeout | TAP |', '| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |', ...results.map((row) => `| ${row.asset} | ${row.exit_code ?? row.signal} | ${row.tests} | ${row.passed} | ${row.failed} | ${row.skipped} | ${row.timed_out} | ${row.log} |`), '', '## Failed assets', '', ...failures.map((item) => `- ${item}`), '', '## Unexecuted assets', '', ...unexecuted.map((item) => `- ${item}`), '', '## Limitations', '', ...manifest.limitations.map((item) => `- ${item}`), ''].join('\n'));
      manifests.push(manifest);
    }
  }
  const summary = summarizeCandidate(plan, manifests, await readIdentity());
  summary.issues.push(...await verifyRuntimeBindings(bindings));
  summary.issues.push(...await verifyCandidateFiles(manifests));
  summary.candidate_complete = summary.issues.length === 0;
  return { run_id: runId, manifest_paths: evidenceDirs.map((dir) => `${dir}-manifest.json`), group_results: manifests.map(({ group, exit_code, error, cleanup }) => ({ group, exit_code, error, cleanup })), candidate_complete: summary.candidate_complete, issues: summary.issues };
}

async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== '--bindings') throw new Error('usage: node scripts/v1-candidate-run.mjs --bindings <relative JSON path>');
  const bindings = await bindingsFrom(process.argv[3]);
  const result = await executeFiveGroups({ adminUrl: process.env.DGOS_VERIFY_ADMIN_URL, bindings });
  console.log(JSON.stringify(result, null, 2));
  if (!result.candidate_complete) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
