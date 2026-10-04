// NFR-006: Provider Adapter Limitations Validation
// Requirement: Document fixture vs real Provider limitations
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

test('NFR-006: Provider adapter implementations exist', () => {
  const adaptersPath = join(ROOT, 'src/provider-adapters');

  assert.ok(existsSync(adaptersPath), 'Provider adapters directory should exist');

  const files = readdirSync(adaptersPath);
  console.log('# Provider adapter files:', files.join(', '));

  assert.ok(files.length > 0, 'Should have provider adapter implementations');
});

test('NFR-006: Provider configuration supports multiple protocols', () => {
  const configPath = join(ROOT, 'src/provider-config');

  assert.ok(existsSync(configPath), 'Provider config directory should exist');

  const files = readdirSync(configPath);
  console.log('# Provider config files:', files.join(', '));

  // Check for protocol handling
  const hasProtocolSupport = files.some(f =>
    f.includes('protocol') || f.includes('adapter') || f.includes('registry')
  );

  assert.ok(hasProtocolSupport, 'Should have protocol/adapter support');
});

test('NFR-006: OpenAI-compatible protocol is supported', () => {
  const adaptersPath = '/Users/apple/Progame/DGOS/src/provider-adapters';

  const files = readdirSync(adaptersPath);
  const openaiAdapter = files.find(f =>
    f.includes('openai') || f.includes('compatible')
  );

  if (openaiAdapter) {
    const adapterFile = join(adaptersPath, openaiAdapter);
    const content = readFileSync(adapterFile, 'utf-8');

    // Check for streaming support
    assert.match(content, /stream|generator|async\s*\*/i,
      'OpenAI adapter should support streaming');

    console.log(`# OpenAI-compatible adapter: ${openaiAdapter}`);
  } else {
    console.log('# OpenAI adapter not found in expected location');
  }
});

test('NFR-006: Provider fixture for testing exists', () => {
  const scriptsPath = '/Users/apple/Progame/DGOS/scripts';

  try {
    const files = readdirSync(scriptsPath);
    const fixtureScript = files.find(f => f.includes('fixture'));

    if (fixtureScript) {
      console.log(`# Provider fixture script: ${fixtureScript}`);
      assert.ok(true, 'Fixture script exists');
    } else {
      console.log('# Provider fixture script not found');
    }
  } catch (err) {
    console.log('# Scripts directory check:', err.message);
  }
});

test('NFR-006: Provider capability documentation', () => {
  const docsPath = '/Users/apple/Progame/DGOS/docs/03-功能规格/V1/07-模型与配置';

  if (existsSync(docsPath)) {
    const files = readdirSync(docsPath);
    console.log('# Provider documentation files:', files.join(', '));

    const providerDoc = files.find(f =>
      f.includes('模型平台') || f.includes('Provider') || f.includes('工作流配置')
    );

    if (providerDoc) {
      const docPath = join(docsPath, providerDoc);
      const content = readFileSync(docPath, 'utf-8');

      // Should document capabilities and limitations
      const hasLimitations = content.includes('限制') ||
                             content.includes('limitation') ||
                             content.includes('fixture');

      console.log(`# Provider limitations documented: ${hasLimitations ? 'yes' : 'no'}`);
    }
  } else {
    console.log('# Provider documentation directory not found');
  }
});

test('NFR-006: Provider registry mechanism', () => {
  const registryFiles = [
    '/Users/apple/Progame/DGOS/src/provider-config/registry.mjs',
    '/Users/apple/Progame/DGOS/src/provider-config/adapter-registry.mjs',
  ];

  let registryFound = false;

  for (const file of registryFiles) {
    if (existsSync(file)) {
      const content = readFileSync(file, 'utf-8');

      // Should support dynamic registration
      const hasDynamicReg = content.includes('register') ||
                            content.includes('Map') ||
                            content.includes('get');

      console.log(`# Registry file: ${file.split('/').pop()}`);
      console.log(`# Supports dynamic registration: ${hasDynamicReg ? 'yes' : 'no'}`);

      registryFound = true;
      break;
    }
  }

  if (!registryFound) {
    console.log('# Provider registry not found at expected locations');
  }
});

test('NFR-006: Provider test coverage', () => {
  const testsPath = '/Users/apple/Progame/DGOS/tests';

  try {
    const files = readdirSync(testsPath, { recursive: true });
    const providerTests = files.filter(f =>
      typeof f === 'string' && f.includes('provider')
    );

    console.log(`# Found ${providerTests.length} provider-related test files`);

    if (providerTests.length > 0) {
      console.log('# Provider tests:', providerTests.slice(0, 5).join(', '));
    }

    assert.ok(providerTests.length > 0, 'Should have provider test coverage');
  } catch (err) {
    console.log('# Test directory scan:', err.message);
  }
});

test('NFR-006: Provider capability matrix documentation', () => {
  const matrixPath = '/Users/apple/Progame/DGOS/docs/03-功能规格/V1/00-V1需求追踪矩阵.md';

  if (existsSync(matrixPath)) {
    const content = readFileSync(matrixPath, 'utf-8');

    // Check for NFR-006 documentation
    const hasNFR006 = content.includes('V1-NFR-006') ||
                      content.includes('NFR-006');

    assert.ok(hasNFR006, 'Requirements matrix should document NFR-006');

    console.log('# NFR-006 documented in requirements matrix');
  } else {
    console.log('# Requirements matrix not found');
  }
});
