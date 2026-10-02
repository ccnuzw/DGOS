import fs from 'node:fs';
import path from 'node:path';

const desktop = path.resolve(new URL('..', import.meta.url).pathname);
const required = [
  'src-tauri/Cargo.toml',
  'src-tauri/src/main.rs',
  'src-tauri/tauri.conf.json',
  'src-tauri/icons/icon.png',
  'README.md',
];
for (const file of required) {
  if (!fs.existsSync(path.join(desktop, file))) throw new Error(`Missing desktop host file: ${file}`);
}
const config = JSON.parse(fs.readFileSync(path.join(desktop, 'src-tauri/tauri.conf.json'), 'utf8'));
if (config.build?.frontendDist !== '../../web/dist') throw new Error('Tauri must package the shared apps/web/dist build');
if (config.build?.devUrl !== 'http://127.0.0.1:15151') throw new Error('Tauri devUrl must use the assigned Web port');
if (config.app?.security?.csp?.includes('127.0.0.1:3000')) throw new Error('Packaged CSP must not expose API origin');
if (!config.app?.withGlobalTauri) throw new Error('Native host bridge must be available to Host Adapter');
console.log('DGOS desktop host configuration is complete');
