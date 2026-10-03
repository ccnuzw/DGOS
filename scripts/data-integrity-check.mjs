#!/usr/bin/env node
/**
 * DGOS V1 Data Integrity Check Tool
 * Verify data integrity and optionally fix issues
 *
 * Usage:
 *   DGOS_DATABASE_URL=postgres://... node scripts/data-integrity-check.mjs [options]
 *
 * Options:
 *   --auto-fix        Automatically fix issues that can be fixed safely
 *   --report <file>   Save detailed report to file
 *   --verbose         Show detailed information for each check
 *
 * Examples:
 *   node scripts/data-integrity-check.mjs
 *   node scripts/data-integrity-check.mjs --auto-fix
 *   node scripts/data-integrity-check.mjs --report=integrity-report.json
 */

import pg from '../apps/api/node_modules/pg/lib/index.js';
import { writeFile } from 'node:fs/promises';

// Parse arguments
const args = process.argv.slice(2);
const options = {
  autoFix: args.includes('--auto-fix'),
  report: null,
  verbose: args.includes('--verbose')
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--report' && args[i + 1]) {
    options.report = args[++i];
  }
}

const config = {
  dbUrl: process.env.DGOS_DATABASE_URL
};

if (!config.dbUrl) {
  console.error('Error: DGOS_DATABASE_URL environment variable required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: config.dbUrl, connectionTimeoutMillis: 10000 });

/**
 * Check for orphaned records
 */
async function checkOrphanedRecords(client) {
  console.error('🔍 Checking for orphaned records...', { via: 'stderr' });

  const issues = [];

  // Orphaned admin_sessions
  const orphanedSessions = await client.query(`
    SELECT session_id, principal_id
    FROM admin_sessions
    WHERE principal_id NOT IN (SELECT principal_id FROM admin_principals)
  `);

  if (orphanedSessions.rows.length > 0) {
    issues.push({
      type: 'orphan',
      table: 'admin_sessions',
      description: 'Sessions without valid principals',
      count: orphanedSessions.rows.length,
      severity: 'high',
      autoFixable: true,
      records: orphanedSessions.rows.map(r => r.session_id),
      fix: async () => {
        await client.query(`
          DELETE FROM admin_sessions
          WHERE principal_id NOT IN (SELECT principal_id FROM admin_principals)
        `);
      }
    });
  }

  // Orphaned API keys
  const orphanedKeys = await client.query(`
    SELECT key_id, owner_id
    FROM api_key_records
    WHERE owner_id NOT IN (SELECT principal_id FROM admin_principals)
  `);

  if (orphanedKeys.rows.length > 0) {
    issues.push({
      type: 'orphan',
      table: 'api_key_records',
      description: 'API keys without valid owners',
      count: orphanedKeys.rows.length,
      severity: 'high',
      autoFixable: true,
      records: orphanedKeys.rows.map(r => r.key_id),
      fix: async () => {
        await client.query(`
          DELETE FROM api_key_records
          WHERE owner_id NOT IN (SELECT principal_id FROM admin_principals)
        `);
      }
    });
  }

  // Orphaned provider bindings
  const orphanedBindings = await client.query(`
    SELECT binding_id, account_id
    FROM provider_bindings
    WHERE account_id NOT IN (SELECT account_id FROM provider_accounts)
  `);

  if (orphanedBindings.rows.length > 0) {
    issues.push({
      type: 'orphan',
      table: 'provider_bindings',
      description: 'Bindings without valid provider accounts',
      count: orphanedBindings.rows.length,
      severity: 'high',
      autoFixable: true,
      records: orphanedBindings.rows.map(r => r.binding_id),
      fix: async () => {
        await client.query(`
          DELETE FROM provider_bindings
          WHERE account_id NOT IN (SELECT account_id FROM provider_accounts)
        `);
      }
    });
  }

  // Orphaned connection tests
  const orphanedTests = await client.query(`
    SELECT test_id, account_id
    FROM connection_tests
    WHERE account_id NOT IN (SELECT account_id FROM provider_accounts)
  `);

  if (orphanedTests.rows.length > 0) {
    issues.push({
      type: 'orphan',
      table: 'connection_tests',
      description: 'Connection tests without valid accounts',
      count: orphanedTests.rows.length,
      severity: 'medium',
      autoFixable: true,
      records: orphanedTests.rows.map(r => r.test_id),
      fix: async () => {
        await client.query(`
          DELETE FROM connection_tests
          WHERE account_id NOT IN (SELECT account_id FROM provider_accounts)
        `);
      }
    });
  }

  console.error(`   Found ${issues.length} orphan issues`, { via: 'stderr' });
  return issues;
}

/**
 * Check for duplicate records
 */
async function checkDuplicates(client) {
  console.error('🔍 Checking for duplicates...', { via: 'stderr' });

  const issues = [];

  // Check for duplicate principals (shouldn't happen due to constraints)
  const dupPrincipals = await client.query(`
    SELECT principal_id, count(*) as count
    FROM admin_principals
    GROUP BY principal_id
    HAVING count(*) > 1
  `);

  if (dupPrincipals.rows.length > 0) {
    issues.push({
      type: 'duplicate',
      table: 'admin_principals',
      description: 'Duplicate principal IDs',
      count: dupPrincipals.rows.length,
      severity: 'critical',
      autoFixable: false,
      records: dupPrincipals.rows
    });
  }

  console.error(`   Found ${issues.length} duplicate issues`, { via: 'stderr' });
  return issues;
}

/**
 * Check for data consistency issues
 */
async function checkConsistency(client) {
  console.error('🔍 Checking data consistency...', { via: 'stderr' });

  const issues = [];

  // Check for invalid version numbers
  const invalidVersions = await client.query(`
    SELECT principal_id, version
    FROM admin_principals
    WHERE version < 1
  `);

  if (invalidVersions.rows.length > 0) {
    issues.push({
      type: 'consistency',
      table: 'admin_principals',
      description: 'Invalid version numbers (< 1)',
      count: invalidVersions.rows.length,
      severity: 'medium',
      autoFixable: true,
      records: invalidVersions.rows,
      fix: async () => {
        await client.query(`
          UPDATE admin_principals
          SET version = 1
          WHERE version < 1
        `);
      }
    });
  }

  // Check for active sessions that should be expired
  const expiredNotMarked = await client.query(`
    SELECT session_id, expires_at
    FROM admin_sessions
    WHERE expires_at < NOW() AND state = 'active'
  `);

  if (expiredNotMarked.rows.length > 0) {
    issues.push({
      type: 'consistency',
      table: 'admin_sessions',
      description: 'Sessions past expiry but still marked active',
      count: expiredNotMarked.rows.length,
      severity: 'low',
      autoFixable: true,
      records: expiredNotMarked.rows.map(r => r.session_id),
      fix: async () => {
        await client.query(`
          UPDATE admin_sessions
          SET state = 'expired'
          WHERE expires_at < NOW() AND state = 'active'
        `);
      }
    });
  }

  // Check for API keys that should be expired
  const expiredKeys = await client.query(`
    SELECT key_id, expires_at
    FROM api_key_records
    WHERE state = 'active' AND expires_at < NOW()
  `);

  if (expiredKeys.rows.length > 0) {
    issues.push({
      type: 'consistency',
      table: 'api_key_records',
      description: 'API keys past expiry but still active',
      count: expiredKeys.rows.length,
      severity: 'medium',
      autoFixable: true,
      records: expiredKeys.rows.map(r => r.key_id),
      fix: async () => {
        await client.query(`
          UPDATE api_key_records
          SET state = 'expired'
          WHERE state = 'active' AND expires_at < NOW()
        `);
      }
    });
  }

  console.error(`   Found ${issues.length} consistency issues`, { via: 'stderr' });
  return issues;
}

/**
 * Check table constraints
 */
async function checkConstraints(client) {
  console.error('🔍 Checking constraints...', { via: 'stderr' });

  const issues = [];

  // Check for missing required data
  const missingPrincipals = await client.query(`
    SELECT count(*) as count
    FROM admin_principals
    WHERE status = 'active'
  `);

  const activeCount = parseInt(missingPrincipals.rows[0].count);
  if (activeCount === 0) {
    issues.push({
      type: 'constraint',
      table: 'admin_principals',
      description: 'No active admin principals found',
      count: 1,
      severity: 'warning',
      autoFixable: false
    });
  }

  console.error(`   Found ${issues.length} constraint issues`, { via: 'stderr' });
  return issues;
}

/**
 * Fix issues automatically
 */
async function fixIssues(client, issues) {
  console.error('', { via: 'stderr' });
  console.error('🔧 Auto-fixing issues...', { via: 'stderr' });

  let fixed = 0;
  let failed = 0;

  for (const issue of issues) {
    if (issue.autoFixable && issue.fix) {
      try {
        await issue.fix();
        console.error(`   ✅ Fixed: ${issue.table} - ${issue.description}`, { via: 'stderr' });
        fixed++;
      } catch (err) {
        console.error(`   ❌ Failed to fix: ${issue.table} - ${err.message}`, { via: 'stderr' });
        failed++;
      }
    }
  }

  return { fixed, failed };
}

/**
 * Main integrity check process
 */
async function performIntegrityCheck() {
  const startTime = Date.now();

  console.error('🚀 Starting integrity check...', { via: 'stderr' });
  console.error('', { via: 'stderr' });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Run all checks
    const orphanIssues = await checkOrphanedRecords(client);
    const duplicateIssues = await checkDuplicates(client);
    const consistencyIssues = await checkConsistency(client);
    const constraintIssues = await checkConstraints(client);

    const allIssues = [
      ...orphanIssues,
      ...duplicateIssues,
      ...consistencyIssues,
      ...constraintIssues
    ];

    // Count by severity
    const summary = {
      total: allIssues.length,
      critical: allIssues.filter(i => i.severity === 'critical').length,
      high: allIssues.filter(i => i.severity === 'high').length,
      medium: allIssues.filter(i => i.severity === 'medium').length,
      low: allIssues.filter(i => i.severity === 'low').length,
      warning: allIssues.filter(i => i.severity === 'warning').length,
      autoFixable: allIssues.filter(i => i.autoFixable).length
    };

    // Auto-fix if requested
    let fixResults = null;
    if (options.autoFix && summary.autoFixable > 0) {
      fixResults = await fixIssues(client, allIssues);
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }

    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      summary,
      issues: allIssues.map(i => ({
        type: i.type,
        table: i.table,
        description: i.description,
        count: i.count,
        severity: i.severity,
        autoFixable: i.autoFixable,
        records: options.verbose ? i.records : undefined
      })),
      fixResults
    };

    // Save report if requested
    if (options.report) {
      await writeFile(options.report, JSON.stringify(report, null, 2));
      console.error(`', { via: 'stderr' });
      console.error(`📄 Report saved to ${options.report}`, { via: 'stderr' });
    }

    // Print summary
    console.error('', { via: 'stderr' });
    console.error('📊 Summary:', { via: 'stderr' });
    console.error(`   Total issues: ${summary.total}`, { via: 'stderr' });
    if (summary.critical > 0) console.error(`   Critical: ${summary.critical}`, { via: 'stderr' });
    if (summary.high > 0) console.error(`   High: ${summary.high}`, { via: 'stderr' });
    if (summary.medium > 0) console.error(`   Medium: ${summary.medium}`, { via: 'stderr' });
    if (summary.low > 0) console.error(`   Low: ${summary.low}`, { via: 'stderr' });
    if (summary.warning > 0) console.error(`   Warning: ${summary.warning}`, { via: 'stderr' });
    console.error(`   Auto-fixable: ${summary.autoFixable}`, { via: 'stderr' });

    if (fixResults) {
      console.error('', { via: 'stderr' });
      console.error('🔧 Auto-fix results:', { via: 'stderr' });
      console.error(`   Fixed: ${fixResults.fixed}`, { via: 'stderr' });
      console.error(`   Failed: ${fixResults.failed}`, { via: 'stderr' });
    }

    console.error(`   Duration: ${Math.round((Date.now() - startTime) / 1000)}s`, { via: 'stderr' });

    // Determine overall status
    let status = 'pass';
    if (summary.critical > 0) {
      status = 'critical';
    } else if (summary.high > 0) {
      status = 'fail';
    } else if (summary.medium > 0 || summary.low > 0) {
      status = 'warning';
    }

    console.error('', { via: 'stderr' });
    if (status === 'critical') {
      console.error('❌ CRITICAL issues found!', { via: 'stderr' });
    } else if (status === 'fail') {
      console.error('❌ Integrity check FAILED', { via: 'stderr' });
    } else if (status === 'warning') {
      console.error('⚠️  Integrity check completed with warnings', { via: 'stderr' });
    } else {
      console.error('✅ Integrity check PASSED', { via: 'stderr' });
    }

    console.log(JSON.stringify({ status, ...report }, null, 2));

    process.exit(status === 'pass' || status === 'warning' ? 0 : 1);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('', { via: 'stderr' });
    console.error('❌ Integrity check error:', error.message, { via: 'stderr' });
    console.log(JSON.stringify({
      status: 'error',
      error: error.message
    }));
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

performIntegrityCheck();
