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
if (config.build?.frontendDist !== '../../web') throw new Error('Tauri must load the shared apps/web asset directory');
if (config.build?.devUrl !== 'http://127.0.0.1:4173') throw new Error('Tauri devUrl must use the shared Web server');
console.log('DGOS desktop host configuration is complete');
