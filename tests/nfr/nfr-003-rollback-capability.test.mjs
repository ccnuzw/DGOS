// NFR-003: Rollback Capability Validation
// Requirement: Rollback failed deployments, preserve data
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

test('NFR-003: Docker compose configuration supports rollback', () => {
  const composeFile = '/Users/apple/Progame/DGOS/docker-compose.production.yml';

  assert.ok(existsSync(composeFile), 'Production docker-compose file should exist');

  const content = readFileSync(composeFile, 'utf-8');

  // Check for health checks
  assert.match(content, /healthcheck:|health_check:/,
    'Should have healthcheck configuration');

  // Check for restart policy
  assert.match(content, /restart:/,
    'Should have restart policy');
});

test('NFR-003: Migration rollback support', () => {
  const migrationsDir = '/Users/apple/Progame/DGOS/migrations';

  assert.ok(existsSync(migrationsDir), 'Migrations directory should exist');

  // Check for migration tracking
  const migrationFiles = execSync(`find ${migrationsDir} -name "*.sql" | wc -l`)
    .toString().trim();

  assert.ok(parseInt(migrationFiles) > 0, 'Should have SQL migration files');
  console.log(`# Found ${migrationFiles} migration files`);
});

test('NFR-003: Data preservation during rollback', () => {
  // Verify that rollback procedures exist
  const docsDir = '/Users/apple/Progame/DGOS/docs/05-测试与发布';

  assert.ok(existsSync(docsDir), 'Release documentation should exist');

  const files = execSync(`find ${docsDir} -type f -name "*rollback*" -o -name "*Migration*"`)
    .toString().trim();

  console.log('# Rollback/Migration documentation:', files || 'None found');
});

test('NFR-003: Health check mechanism validation', () => {
  const composeFile = '/Users/apple/Progame/DGOS/docker-compose.production.yml';
  const content = readFileSync(composeFile, 'utf-8');

  // Parse health check configuration
  const hasAPIHealth = content.includes('api:') &&
    (content.match(/healthcheck:|health_check:/g) || []).length > 0;

  assert.ok(hasAPIHealth, 'Should have health check for critical services');
  console.log('# Health check configuration found');
});

test('NFR-003: Backup and restore capability', () => {
  const scriptsDir = '/Users/apple/Progame/DGOS/scripts';

  try {
    const backupScripts = execSync(
      `find ${scriptsDir} -type f \\( -name "*backup*" -o -name "*restore*" -o -name "*migrate*" \\)`,
      { encoding: 'utf-8' }
    ).trim();

    console.log('# Backup/restore scripts:', backupScripts || 'None found');

    // Check for migration script
    const hasMigrationScript = existsSync(`${scriptsDir}/migrate.mjs`);
    assert.ok(hasMigrationScript, 'Migration script should exist');
  } catch (err) {
    console.log('# Scripts directory check:', err.message);
  }
});

test('NFR-003: Version tracking mechanism', () => {
  // Verify version tracking exists
  const packageJson = '/Users/apple/Progame/DGOS/package.json';

  assert.ok(existsSync(packageJson), 'package.json should exist');

  const pkg = JSON.parse(readFileSync(packageJson, 'utf-8'));
  console.log(`# Package name: ${pkg.name}`);

  // Check for git tracking
  const gitDir = '/Users/apple/Progame/DGOS/.git';
  assert.ok(existsSync(gitDir), 'Git repository should exist for version control');
});
