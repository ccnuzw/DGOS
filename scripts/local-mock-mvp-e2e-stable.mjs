import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { findAvailablePort, startWebServer, waitForHttp } from './web-test-server.mjs';

const root = resolve(new URL('..', import.meta.url).pathname);
const runId = `local-mock-mvp-${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
const evidenceDir = resolve(root, '.herdr/evidence/local-mock-mvp', runId);
await mkdir(evidenceDir, { recursive: true });

const runCommand = (command, args, env = process.env) => new Promise(resolveResult => {
  const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('error', error => { stderr += `${error.stack || error.message}\n`; });
  child.on('close', exitCode => resolveResult({ exitCode: exitCode ?? 1, stdout, stderr }));
});

const build = await runCommand('pnpm', ['--filter', '@dgos/web', 'build']);
await writeFile(resolve(evidenceDir, 'build.stdout.log'), build.stdout);
await writeFile(resolve(evidenceDir, 'build.stderr.log'), build.stderr);
if (build.exitCode !== 0) {
  await writeFile(resolve(evidenceDir, 'manifest.json'), `${JSON.stringify({ schema: 'dgos.local-mock-mvp.v1', runId, environment: 'local-mock', providerMode: 'mock', result: 'BLOCKED', phase: 'build', exitCode: build.exitCode, evidenceDir: `.herdr/evidence/local-mock-mvp/${runId}` }, null, 2)}\n`);
  console.error(build.stderr || build.stdout);
  process.exitCode = 1;
  process.exit();
}

const port = await findAvailablePort({ preferredPort: process.env.WEB_PORT || 15133 });
const server = startWebServer({ cwd: root, host: '127.0.0.1', port, env: process.env });
let serverStdout = '';
let serverStderr = '';
server.child.stdout?.on('data', chunk => { serverStdout += chunk; });
server.child.stderr?.on('data', chunk => { serverStderr += chunk; });
let result = { exitCode: 1, stdout: '', stderr: '' };

try {
  await waitForHttp(`http://127.0.0.1:${port}`);
  const args = ['exec', 'playwright', 'test', 'apps/web/e2e/workbench.spec.mjs', '--grep', 'mock workbench submits a task', '--config=apps/web/playwright.config.mjs', '--reporter=line'];
  const env = { ...process.env, VITE_DGOS_MOCK: '1', WEB_EXTERNAL: '1', WEB_BASE_URL: `http://127.0.0.1:${port}`, WEB_PORT: String(port) };
  result = await runCommand('pnpm', args, env);
  const sha = value => createHash('sha256').update(value).digest('hex');
  await writeFile(resolve(evidenceDir, 'stdout.log'), result.stdout);
  await writeFile(resolve(evidenceDir, 'stderr.log'), result.stderr);
  const manifest = {
    schema: 'dgos.local-mock-mvp.v1',
    runId,
    environment: 'local-mock',
    providerMode: 'mock',
    port,
    command: `pnpm ${args.join(' ')}`,
    exitCode: result.exitCode,
    result: result.exitCode === 0 ? 'PASS' : 'FAIL',
    build: { exitCode: build.exitCode, stdoutSha256: sha(build.stdout), stderrSha256: sha(build.stderr) },
    server: { stdout: serverStdout, stderr: serverStderr },
    stdoutSha256: sha(result.stdout),
    stderrSha256: sha(result.stderr),
    limitations: ['Mock Provider proves Web state flow only; it does not prove external Provider, production credentials, macOS host, or release gates.'],
    evidenceDir: `.herdr/evidence/local-mock-mvp/${runId}`,
  };
  await writeFile(resolve(evidenceDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ runId, result: manifest.result, manifest: `${manifest.evidenceDir}/manifest.json` }, null, 2));
  process.exitCode = result.exitCode;
} catch (error) {
  result = { exitCode: 1, stdout: '', stderr: `${error.stack || error.message}\n` };
  await writeFile(resolve(evidenceDir, 'stdout.log'), result.stdout);
  await writeFile(resolve(evidenceDir, 'stderr.log'), result.stderr);
  await writeFile(resolve(evidenceDir, 'server.stdout.log'), serverStdout);
  await writeFile(resolve(evidenceDir, 'server.stderr.log'), serverStderr);
  await writeFile(resolve(evidenceDir, 'server.stdout.log'), serverStdout);
  await writeFile(resolve(evidenceDir, 'server.stderr.log'), serverStderr);
  await writeFile(resolve(evidenceDir, 'manifest.json'), `${JSON.stringify({ schema: 'dgos.local-mock-mvp.v1', runId, environment: 'local-mock', providerMode: 'mock', port, result: 'FAIL', error: error.message, server: { stdout: serverStdout, stderr: serverStderr }, evidenceDir: `.herdr/evidence/local-mock-mvp/${runId}` }, null, 2)}\n`);
  console.error(error.stack || error.message);
  process.exitCode = 1;
} finally {
  await server.stop();
}
