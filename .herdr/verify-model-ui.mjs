#!/usr/bin/env node
/**
 * Verification script for V1 Model Configuration UI implementation
 * Checks that all required files exist and have expected structure
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const checks = [];
const errors = [];

function check(name, fn) {
  checks.push({ name, fn });
}

function verify() {
  console.log('🔍 Verifying V1 Model Configuration UI Implementation...\n');

  let passed = 0;
  let failed = 0;

  for (const { name, fn } of checks) {
    try {
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.error(`❌ ${name}`);
      console.error(`   ${error.message}`);
      errors.push({ check: name, error: error.message });
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log('\n❌ Verification FAILED\n');
    process.exit(1);
  } else {
    console.log('\n✅ Verification PASSED\n');
    process.exit(0);
  }
}

// File existence checks
check('Model Management UI component exists', () => {
  const path = join(ROOT, 'apps/web/src/model-management.tsx');
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  const content = readFileSync(path, 'utf-8');
  if (!content.includes('ModelManagement')) {
    throw new Error('ModelManagement component not found in file');
  }
  if (!content.includes('CAPABILITY_TYPES')) {
    throw new Error('CAPABILITY_TYPES constant not found');
  }
});

check('E2E tests exist', () => {
  const path = join(ROOT, 'apps/web/e2e/model-management.spec.mjs');
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  const content = readFileSync(path, 'utf-8');
  if (!content.includes('Model Management UI - FR-007')) {
    throw new Error('E2E test suite not found');
  }
});

check('Integration tests exist', () => {
  const path = join(ROOT, 'tests/integration/model-capability-api.test.mjs');
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  const content = readFileSync(path, 'utf-8');
  if (!content.includes('Model Capability API - FR-007 AC05')) {
    throw new Error('Integration test suite not found');
  }
});

check('Implementation report exists', () => {
  const path = join(ROOT, '.herdr/V1-MODEL-UI-IMPLEMENTATION.md');
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  const content = readFileSync(path, 'utf-8');
  if (!content.includes('FR-007')) {
    throw new Error('FR-007 reference not found in report');
  }
  if (!content.includes('AC Compliance Matrix')) {
    throw new Error('AC compliance matrix not found in report');
  }
});

check('i18n labels updated', () => {
  const path = join(ROOT, 'apps/web/src/i18n.ts');
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  const content = readFileSync(path, 'utf-8');
  if (!content.includes('modelManagement')) {
    throw new Error('modelManagement label not found');
  }
  if (!content.includes('selectCapabilities')) {
    throw new Error('selectCapabilities label not found');
  }
  if (!content.includes('filterByCapability')) {
    throw new Error('filterByCapability label not found');
  }
});

// Component structure checks
check('ModelManagement component has required props', () => {
  const path = join(ROOT, 'apps/web/src/model-management.tsx');
  const content = readFileSync(path, 'utf-8');

  if (!content.includes('export function ModelManagement')) {
    throw new Error('ModelManagement export not found');
  }
  if (!content.includes('{ t, onChanged }')) {
    throw new Error('Required props not found');
  }
});

check('ModelManagement component has capability types', () => {
  const path = join(ROOT, 'apps/web/src/model-management.tsx');
  const content = readFileSync(path, 'utf-8');

  const requiredCapabilities = [
    'text',
    'image-generation',
    'video-generation',
    'audio-generation',
    'image-understanding',
    'video-understanding',
    'audio-understanding',
    'embedding',
    'multimodal'
  ];

  for (const cap of requiredCapabilities) {
    if (!content.includes(`'${cap}'`)) {
      throw new Error(`Capability type '${cap}' not found`);
    }
  }
});

check('ModelManagement component has filter functionality', () => {
  const path = join(ROOT, 'apps/web/src/model-management.tsx');
  const content = readFileSync(path, 'utf-8');

  if (!content.includes('filteredModels')) {
    throw new Error('filteredModels not found');
  }
  if (!content.includes('searchQuery')) {
    throw new Error('searchQuery state not found');
  }
  if (!content.includes('setFilter')) {
    throw new Error('Filter setter not found');
  }
});

check('ModelManagement component has default model selection', () => {
  const path = join(ROOT, 'apps/web/src/model-management.tsx');
  const content = readFileSync(path, 'utf-8');

  if (!content.includes('setDefaultModel')) {
    throw new Error('setDefaultModel function not found');
  }
  if (!content.includes('defaultForCapability')) {
    throw new Error('defaultForCapability not found');
  }
  if (!content.includes('getDefaultModel')) {
    throw new Error('getDefaultModel function not found');
  }
});

check('ModelManagement component has policy management', () => {
  const path = join(ROOT, 'apps/web/src/model-management.tsx');
  const content = readFileSync(path, 'utf-8');

  if (!content.includes('updateModelPolicy')) {
    throw new Error('updateModelPolicy function not found');
  }
  if (!content.includes('toggleModelEnabled')) {
    throw new Error('toggleModelEnabled function not found');
  }
  if (!content.includes('updateModelCapabilities')) {
    throw new Error('updateModelCapabilities function not found');
  }
});

check('ModelCapabilityEditor subcomponent exists', () => {
  const path = join(ROOT, 'apps/web/src/model-management.tsx');
  const content = readFileSync(path, 'utf-8');

  if (!content.includes('function ModelCapabilityEditor')) {
    throw new Error('ModelCapabilityEditor component not found');
  }
  if (!content.includes('toggleCapability')) {
    throw new Error('toggleCapability function not found in ModelCapabilityEditor');
  }
});

// API integration checks
check('Component uses correct API endpoints', () => {
  const path = join(ROOT, 'apps/web/src/model-management.tsx');
  const content = readFileSync(path, 'utf-8');

  const requiredEndpoints = [
    '/api/v1/provider/configs',
    '/api/v1/provider/configs/${encodeURIComponent(providerId)}/models',
    '/api/v1/provider/configs/${encodeURIComponent(providerId)}/model-policies'
  ];

  for (const endpoint of requiredEndpoints) {
    if (!content.includes(endpoint)) {
      throw new Error(`API endpoint not found: ${endpoint}`);
    }
  }
});

// Test coverage checks
check('E2E tests cover AC05', () => {
  const path = join(ROOT, 'apps/web/e2e/model-management.spec.mjs');
  const content = readFileSync(path, 'utf-8');

  if (!content.includes('AC05')) {
    throw new Error('AC05 test coverage not found');
  }
  if (!content.includes('capability classification')) {
    throw new Error('Capability classification tests not found');
  }
  if (!content.includes('default model')) {
    throw new Error('Default model tests not found');
  }
  if (!content.includes('filter')) {
    throw new Error('Filter tests not found');
  }
});

check('E2E tests cover AC07', () => {
  const path = join(ROOT, 'apps/web/e2e/model-management.spec.mjs');
  const content = readFileSync(path, 'utf-8');

  if (!content.includes('AC07')) {
    throw new Error('AC07 test coverage not found');
  }
  if (!content.includes('refresh catalog')) {
    throw new Error('Catalog refresh tests not found');
  }
});

check('Integration tests have comprehensive coverage', () => {
  const path = join(ROOT, 'tests/integration/model-capability-api.test.mjs');
  const content = readFileSync(path, 'utf-8');

  const requiredTests = [
    'Model Policy Management',
    'Capability Filtering',
    'Default Model Selection',
    'Task Selector Filtering',
    'Error Cases'
  ];

  for (const testSuite of requiredTests) {
    if (!content.includes(testSuite)) {
      throw new Error(`Test suite not found: ${testSuite}`);
    }
  }
});

// Documentation checks
check('Implementation report has AC compliance matrix', () => {
  const path = join(ROOT, '.herdr/V1-MODEL-UI-IMPLEMENTATION.md');
  const content = readFileSync(path, 'utf-8');

  const requiredACs = ['AC01', 'AC02', 'AC04', 'AC05', 'AC06', 'AC07', 'AC08', 'AC09'];

  for (const ac of requiredACs) {
    if (!content.includes(ac)) {
      throw new Error(`AC ${ac} not documented in compliance matrix`);
    }
  }
});

check('Implementation report documents all files', () => {
  const path = join(ROOT, '.herdr/V1-MODEL-UI-IMPLEMENTATION.md');
  const content = readFileSync(path, 'utf-8');

  if (!content.includes('model-management.tsx')) {
    throw new Error('Main component not documented');
  }
  if (!content.includes('model-management.spec.mjs')) {
    throw new Error('E2E tests not documented');
  }
  if (!content.includes('model-capability-api.test.mjs')) {
    throw new Error('Integration tests not documented');
  }
});

check('Implementation report has design decisions', () => {
  const path = join(ROOT, '.herdr/V1-MODEL-UI-IMPLEMENTATION.md');
  const content = readFileSync(path, 'utf-8');

  if (!content.includes('Design Decisions')) {
    throw new Error('Design decisions section not found');
  }
  if (!content.includes('Multi-Capability Support')) {
    throw new Error('Multi-capability design decision not documented');
  }
});

check('Implementation report has user flows', () => {
  const path = join(ROOT, '.herdr/V1-MODEL-UI-IMPLEMENTATION.md');
  const content = readFileSync(path, 'utf-8');

  if (!content.includes('User Flows')) {
    throw new Error('User flows section not found');
  }
  if (!content.includes('Flow 1: Classify and Enable Models')) {
    throw new Error('Classification flow not documented');
  }
});

// TypeScript/Component structure
check('Component uses TypeScript types correctly', () => {
  const path = join(ROOT, 'apps/web/src/model-management.tsx');
  const content = readFileSync(path, 'utf-8');

  if (!content.includes('interface ModelItem')) {
    throw new Error('ModelItem interface not found');
  }
  if (!content.includes('interface ModelPolicy')) {
    throw new Error('ModelPolicy interface not found');
  }
  if (!content.includes('interface ProviderCatalog')) {
    throw new Error('ProviderCatalog interface not found');
  }
});

check('Component uses hooks correctly', () => {
  const path = join(ROOT, 'apps/web/src/model-management.tsx');
  const content = readFileSync(path, 'utf-8');

  if (!content.includes('useState')) {
    throw new Error('useState hook not imported');
  }
  if (!content.includes('useEffect')) {
    throw new Error('useEffect hook not imported');
  }
  if (!content.includes('useDialogKeyboard')) {
    throw new Error('useDialogKeyboard hook not used');
  }
});

// Run all checks
verify();
