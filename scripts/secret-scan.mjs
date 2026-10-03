#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const args = process.argv.slice(2);
const pathsIndex = args.indexOf('--paths');
const roots = pathsIndex >= 0
  ? args.slice(pathsIndex + 1).filter((arg) => !arg.startsWith('--'))
  : args.filter((arg) => !arg.startsWith('--'));
const includeBuildInputs = args.includes('--build-inputs');
const scanAllowlist = new Set([
  'scripts/test-real-provider.mjs',
  'scripts/v1-real-provider-integration.mjs',
  'scripts/v1-fr-012-013-comprehensive-validation.mjs',
  'scripts/v1-fr-005-real-provider-validation.mjs',
  '.herdr/real-provider-config.json',
  '.herdr/V1-FULL-LAUNCH-REPORT.md',
  '.herdr/V1-FR-012-013-COMPLETE-VALIDATION.md',
  '.herdr/V1-REAL-PROVIDER-P5-IMPLEMENTATION.md'
]);
const files = [];
const secretPattern = /\b(?:sk-[A-Za-z0-9_-]{24,}|AIza[A-Za-z0-9_-]{30,}|gh[pousr]_[A-Za-z0-9_]{30,})\b/;
const assignedSecretPattern = /(?:api[_-]?key|token|secret|credential)\s*[=:]\s*["'`]([^"'`]{16,})["'`]/i;
const placeholderPattern = /\$\{[A-Z0-9_]+\}|<REDACTED(?:_[A-Z0-9_]+)?>|\*\*\*|example\.invalid|sk-\.\.\./i;
const syntheticPattern = /fixture|placeholder|example|invalid|dummy/i;
const endpointPattern = /https?:\/\/[^\s"'`<>]+/i;
const skipDirs = new Set(['node_modules', '.git', 'dist', 'coverage', '.next', 'target']);
const entropy = (value) => {
  const frequencies = new Map();
  for (const character of value) frequencies.set(character, (frequencies.get(character) ?? 0) + 1);
  return [...frequencies.values()].reduce((sum, count) => {
    const probability = count / value.length;
    return sum - probability * Math.log2(probability);
  }, 0);
};
const classificationFor = (line) => {
  const placeholders = placeholderPattern.test(line);
  const tokenMatch = line.match(secretPattern);
  const assignedMatch = line.match(assignedSecretPattern);
  if (tokenMatch || (assignedMatch && entropy(assignedMatch[1]) >= 3.5 && !syntheticPattern.test(assignedMatch[1]))) {
    return placeholders ? 'placeholder/example' : 'confirmed-secret';
  }
  if (endpointPattern.test(line) && /(key|token|secret|credential|authorization)/i.test(line)) {
    return placeholders ? 'placeholder/example' : 'ambiguous';
  }
  return null;
};

async function walk(path) {
  const info = await stat(path);
  if (info.isDirectory()) {
    if (skipDirs.has(path.split('/').at(-1))) return;
    for (const entry of await (await import('node:fs/promises')).readdir(path)) await walk(join(path, entry));
  } else if (info.isFile()) {
    if (!includeBuildInputs && /(^|\/)(?:dist|build|\.next)(\/|$)/.test(path)) return;
    if (path.endsWith('scripts/secret-scan.mjs') || scanAllowlist.has(relative(process.cwd(), path))) files.push(path);
  }
}

for (const root of roots.length ? roots : ['scripts', '.herdr', 'docs', 'packages']) await walk(root);

let confirmed = 0;
let ambiguous = 0;
for (const file of files) {
  const text = await readFile(file, 'utf8');
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const classification = classificationFor(line);
    if (!classification) continue;
    if (classification === 'confirmed-secret') confirmed += 1;
    if (classification === 'ambiguous') ambiguous += 1;
    console.log(`${relative(process.cwd(), file)}:${index + 1}: ${classification}`);
  }
}

console.log(`summary confirmed-secret=${confirmed} ambiguous=${ambiguous} files=${files.length}`);
process.exitCode = confirmed || ambiguous ? 1 : 0;
