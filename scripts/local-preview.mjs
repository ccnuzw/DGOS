import { execFileSync } from 'node:child_process';
import net from 'node:net';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { integrationEnvironment } from './release-environment.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const STATE_DIR = resolve(ROOT, '.herdr/state/local-preview');
const COMPOSE_FILE = 'docker-compose.integration.yml';
export function portAvailable(port, host = '127.0.0.1') {
  return new Promise((resolvePort) => { const server = net.createServer(); server.once('error', () => resolvePort(false)); server.listen(port, host, () => server.close(() => resolvePort(true))); });
}
export async function allocatePorts(start = Number(process.env.DGOS_PREVIEW_PORT_BASE ?? 15300)) {
  for (let base = start; base <= 15450; base += 10) {
    const ports = { postgres: base, redis: base + 1, api: base + 2, web: base + 3, fixture: base + 4 };
    if ((await Promise.all(Object.values(ports).map((port) => portAvailable(port)))).every(Boolean)) return ports;
  }
  throw new Error('local_preview_no_free_port_block');
}
export function composeArgs(state) { return ['compose', '-p', state.project, '-f', COMPOSE_FILE]; }
const ENV_PORT_NAMES = { postgres: 'PG', redis: 'REDIS', api: 'API', web: 'WEB', fixture: 'FIXTURE' };
function envFor(state) { return { ...process.env, DGOS_INTEGRATION_PROJECT: state.project, ...Object.entries(state.ports).map(([name, port]) => [`DGOS_INTEGRATION_${ENV_PORT_NAMES[name]}_PORT`, String(port)]).reduce((values, [key, value]) => ({ ...values, [key]: String(value) }), {}) }; }
function compose(state, args) { return execFileSync('docker', [...composeArgs(state), ...args], { cwd: ROOT, env: envFor(state), encoding: 'utf8', stdio: 'inherit' }); }
export async function startPreview() {
  const ports = await allocatePorts();
  const state = { schema: 'dgos/v1-local-preview', id: randomUUID(), project: `dgos-v1-preview-${randomUUID().slice(0, 8)}`, ports, compose_file: COMPOSE_FILE, limitations: ['Uses local fixture Provider only.', 'No signing, notarization, production TLS/KMS, or real external Provider validation.'] };
  await mkdir(STATE_DIR, { recursive: true });
  await writeFile(resolve(STATE_DIR, `${state.id}.json`), `${JSON.stringify(state, null, 2)}\n`);
  compose(state, ['up', '-d', 'postgres', 'redis', 'fixture', 'api', 'worker', 'web']);
  compose(state, ['run', '--rm', 'migrate']);
  console.log(JSON.stringify({ status: 'started', ...state, web_url: `http://127.0.0.1:${ports.web}`, api_url: `http://127.0.0.1:${ports.api}`, state_file: `.herdr/state/local-preview/${state.id}.json` }, null, 2));
  return state;
}
export async function stopPreview(stateFile) { const state = JSON.parse(await readFile(resolve(ROOT, stateFile))); compose(state, ['down', '--volumes', '--remove-orphans']); await rm(resolve(ROOT, stateFile), { force: true }); return state; }
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2] ?? 'up';
  if (command === 'up') await startPreview();
  else if (command === 'down') { const stateFile = process.argv[3]; if (!stateFile) throw new Error('state_file_required'); console.log(JSON.stringify({ status: 'stopped', project: (await stopPreview(stateFile)).project })); }
  else if (command === 'ports') console.log(JSON.stringify(await allocatePorts(), null, 2));
  else throw new Error(`unknown_local_preview_command: ${command}`);
}
