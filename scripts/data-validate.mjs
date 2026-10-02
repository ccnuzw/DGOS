#!/usr/bin/env node
/**
 * Validate data integrity after migration
 * Usage: DGOS_DATABASE_URL=postgres://... node scripts/data-validate.mjs
 */

import pg from '../apps/api/node_modules/pg/lib/index.js';

const dbUrl = process.env.DGOS_DATABASE_URL;
if (!dbUrl) {
  console.error('Error: DGOS_DATABASE_URL environment variable required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 5000 });

async function checkReferentialIntegrity() {
  const checks = [];

  // Check orphaned admin_sessions
  const orphanedSessions = await pool.query(`
    SELECT count(*) as count
    FROM admin_sessions
    WHERE principal_id NOT IN (SELECT principal_id FROM admin_principals)
  `);
  checks.push({
    check: 'orphaned_admin_sessions',
    status: orphanedSessions.rows[0].count === '0' ? 'pass' : 'fail',
    count: parseInt(orphanedSessions.rows[0].count)
  });

  // Check orphaned api_key_records
  const orphanedKeys = await pool.query(`
    SELECT count(*) as count
    FROM api_key_records
    WHERE owner_id NOT IN (SELECT principal_id FROM admin_principals)
  `);
  checks.push({
    check: 'orphaned_api_keys',
    status: orphanedKeys.rows[0].count === '0' ? 'pass' : 'fail',
    count: parseInt(orphanedKeys.rows[0].count)
  });

  // Check orphaned provider_bindings
  const orphanedBindings = await pool.query(`
    SELECT count(*) as count
    FROM provider_bindings
    WHERE account_id NOT IN (SELECT account_id FROM provider_accounts)
  `);
  checks.push({
    check: 'orphaned_provider_bindings',
    status: orphanedBindings.rows[0].count === '0' ? 'pass' : 'fail',
    count: parseInt(orphanedBindings.rows[0].count)
  });

  // Check orphaned connection_tests
  const orphanedTests = await pool.query(`
    SELECT count(*) as count
    FROM connection_tests
    WHERE account_id NOT IN (SELECT account_id FROM provider_accounts)
  `);
  checks.push({
    check: 'orphaned_connection_tests',
    status: orphanedTests.rows[0].count === '0' ? 'pass' : 'fail',
    count: parseInt(orphanedTests.rows[0].count)
  });

  return checks;
}

async function checkRequiredData() {
  const checks = [];

  // Check schema migrations
  const migrations = await pool.query(`SELECT count(*) as count FROM dgos_schema_migrations`);
  checks.push({
    check: 'schema_migrations',
    status: parseInt(migrations.rows[0].count) >= 47 ? 'pass' : 'fail',
    count: parseInt(migrations.rows[0].count),
    expected: 47
  });

  // Check at least one admin principal exists
  const principals = await pool.query(`SELECT count(*) as count FROM admin_principals WHERE status = 'active'`);
  checks.push({
    check: 'active_admin_principals',
    status: parseInt(principals.rows[0].count) > 0 ? 'pass' : 'warning',
    count: parseInt(principals.rows[0].count)
  });

  return checks;
}

async function checkTableStructure() {
  const checks = [];

  // Check critical tables exist
  const expectedTables = [
    'dgos_schema_migrations',
    'admin_principals',
    'admin_sessions',
    'api_key_records',
    'provider_accounts',
    'provider_bindings',
    'audit_events',
    'quota_reservations',
    'extension_registry',
    'app_packages'
  ];

  for (const table of expectedTables) {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) as exists
    `, [table]);

    checks.push({
      check: `table_${table}`,
      status: result.rows[0].exists ? 'pass' : 'fail'
    });
  }

  return checks;
}

async function checkIndexes() {
  const checks = [];

  // Check critical indexes exist
  const result = await pool.query(`
    SELECT count(*) as count
    FROM pg_indexes
    WHERE schemaname = 'public'
  `);

  checks.push({
    check: 'total_indexes',
    status: parseInt(result.rows[0].count) > 20 ? 'pass' : 'warning',
    count: parseInt(result.rows[0].count)
  });

  return checks;
}

async function checkDataConsistency() {
  const checks = [];

  // Check admin_principals version consistency
  const invalidVersions = await pool.query(`
    SELECT count(*) as count
    FROM admin_principals
    WHERE version < 1
  `);
  checks.push({
    check: 'admin_principals_version_consistency',
    status: invalidVersions.rows[0].count === '0' ? 'pass' : 'fail',
    count: parseInt(invalidVersions.rows[0].count)
  });

  // Check expired sessions are marked correctly
  const expiredNotMarked = await pool.query(`
    SELECT count(*) as count
    FROM admin_sessions
    WHERE expires_at < now() AND state = 'active'
  `);
  checks.push({
    check: 'expired_sessions_marked',
    status: parseInt(expiredNotMarked.rows[0].count) < 10 ? 'pass' : 'warning',
    count: parseInt(expiredNotMarked.rows[0].count),
    note: 'Small number acceptable, worker will clean up'
  });

  // Check API keys state consistency
  const invalidKeys = await pool.query(`
    SELECT count(*) as count
    FROM api_key_records
    WHERE state = 'active' AND expires_at < now()
  `);
  checks.push({
    check: 'api_keys_state_consistency',
    status: parseInt(invalidKeys.rows[0].count) < 5 ? 'pass' : 'warning',
    count: parseInt(invalidKeys.rows[0].count),
    note: 'Small number acceptable, worker will clean up'
  });

  return checks;
}

async function validate() {
  try {
    console.error('Running validation checks...', { via: 'stderr' });

    const results = {
      timestamp: new Date().toISOString(),
      overall_status: 'pass',
      checks: {}
    };

    // Run all checks
    results.checks.referential_integrity = await checkReferentialIntegrity();
    results.checks.required_data = await checkRequiredData();
    results.checks.table_structure = await checkTableStructure();
    results.checks.indexes = await checkIndexes();
    results.checks.data_consistency = await checkDataConsistency();

    // Determine overall status
    let failCount = 0;
    let warnCount = 0;

    for (const category of Object.values(results.checks)) {
      for (const check of category) {
        if (check.status === 'fail') {
          failCount++;
          results.overall_status = 'fail';
        } else if (check.status === 'warning') {
          warnCount++;
          if (results.overall_status === 'pass') {
            results.overall_status = 'warning';
          }
        }
      }
    }

    results.summary = {
      total_checks: Object.values(results.checks).reduce((sum, cat) => sum + cat.length, 0),
      passed: Object.values(results.checks).reduce((sum, cat) => sum + cat.filter(c => c.status === 'pass').length, 0),
      warnings: warnCount,
      failed: failCount
    };

    console.log(JSON.stringify(results, null, 2));

    if (results.overall_status === 'fail') {
      console.error('\n❌ Validation FAILED - data integrity issues detected', { via: 'stderr' });
      process.exit(1);
    } else if (results.overall_status === 'warning') {
      console.error('\n⚠️  Validation completed with warnings', { via: 'stderr' });
      process.exit(0);
    } else {
      console.error('\n✅ Validation PASSED - all checks successful', { via: 'stderr' });
      process.exit(0);
    }
  } catch (error) {
    console.error('Validation error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

validate();
