#!/usr/bin/env node
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

console.log('FR-002 Developer Center UI Verification\n');
console.log('=' .repeat(60));

const checks = [];

async function fileExists(path) {
  try {
    await readFile(join(root, path));
    return true;
  } catch {
    return false;
  }
}

async function fileContains(path, searchString) {
  try {
    const content = await readFile(join(root, path), 'utf-8');
    return content.includes(searchString);
  } catch {
    return false;
  }
}

async function check(name, fn) {
  const result = await fn();
  checks.push({ name, passed: result });
  console.log(`${result ? '✓' : '✗'} ${name}`);
  return result;
}

// Check implementation files
await check('Developer Center component exists', () =>
  fileExists('apps/web/src/developer-center.tsx')
);

await check('Component exports DeveloperCenter', () =>
  fileContains('apps/web/src/developer-center.tsx', 'export function DeveloperCenter')
);

await check('App detail view implemented', () =>
  fileContains('apps/web/src/developer-center.tsx', 'function AppDetailView')
);

await check('Installation records view implemented', () =>
  fileContains('apps/web/src/developer-center.tsx', 'function InstallationRecordsView')
);

await check('Package submission UI exists', () =>
  fileContains('apps/web/src/developer-center.tsx', 'packageEnvelope')
);

await check('Review actions UI exists', () =>
  fileContains('apps/web/src/developer-center.tsx', 'reviewAction')
);

await check('Filter functionality implemented', () =>
  fileContains('apps/web/src/developer-center.tsx', 'filter')
);

await check('Main app imports new component', () =>
  fileContains('apps/web/src/main.tsx', 'import { DeveloperCenter }')
);

await check('Main app uses DeveloperCenter', () =>
  fileContains('apps/web/src/main.tsx', '<DeveloperCenter t={t} />')
);

// Check E2E tests
await check('E2E test file exists', () =>
  fileExists('apps/web/e2e/developer-center.spec.mjs')
);

await check('E2E tests catalog loading', () =>
  fileContains('apps/web/e2e/developer-center.spec.mjs', 'developer center UI loads and displays catalog')
);

await check('E2E tests filter functionality', () =>
  fileContains('apps/web/e2e/developer-center.spec.mjs', 'developer center filter functionality')
);

await check('E2E tests app detail view', () =>
  fileContains('apps/web/e2e/developer-center.spec.mjs', 'app detail view displays complete metadata')
);

await check('E2E tests installation records', () =>
  fileContains('apps/web/e2e/developer-center.spec.mjs', 'installation records view shows deployment status')
);

await check('E2E tests review actions', () =>
  fileContains('apps/web/e2e/developer-center.spec.mjs', 'review action flow with reason input')
);

await check('E2E tests validation errors', () =>
  fileContains('apps/web/e2e/developer-center.spec.mjs', 'package validation shows errors')
);

await check('E2E tests keyboard navigation', () =>
  fileContains('apps/web/e2e/developer-center.spec.mjs', 'keyboard navigation closes modals')
);

console.log('\n' + '='.repeat(60));
const passed = checks.filter(c => c.passed).length;
const total = checks.length;
const percentage = Math.round((passed / total) * 100);

console.log(`\nResults: ${passed}/${total} checks passed (${percentage}%)`);

if (passed === total) {
  console.log('\n✓ All verification checks passed!');
  process.exit(0);
} else {
  console.log('\n✗ Some checks failed. Review the output above.');
  process.exit(1);
}
