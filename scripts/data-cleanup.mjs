#!/usr/bin/env node
/**
 * DGOS V1 Data Cleanup Tool
 * Clean up old data based on retention policies
 *
 * Usage:
 *   DGOS_DATABASE_URL=postgres://... node scripts/data-cleanup.mjs [entity] [options]
 *
 * Entities:
 *   tasks       - Clean up old completed/failed tasks
 *   audit       - Clean up old audit logs
 *   sessions    - Clean up expired sessions
 *   all         - Clean up all entities
 *
 * Options:
 *   --older-than <days>    Clean records older than N days (default: 30)
 *   --dry-run              Show what would be deleted without deleting
 *   --confirm              Skip confirmation prompt
 *
 * Examples:
 *   node scripts/data-cleanup.mjs tasks --older-than=90 --dry-run
 *   node scripts/data-cleanup.mjs audit --older-than=365 --confirm
 *   node scripts/data-cleanup.mjs all --older-than=30
 */

import pg from '../apps/api/node_modules/pg/lib/index.js';
import { createInterface } from 'node:readline';

// Parse arguments
const [,, entity = 'all', ...argsList] = process.argv;

const options = {
  olderThan: 30,
  dryRun: argsList.includes('--dry-run'),
  confirm: argsList.includes('--confirm')
};

for (let i = 0; i < argsList.length; i++) {
  if (argsList[i] === '--older-than' && argsList[i + 1]) {
    options.olderThan = parseInt(argsList[++i]);
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
 * Cleanup policies
 */
const cleanupPolicies = {
  tasks: {
    description: 'Completed, failed, and cancelled tasks',
    table: 'quota_reservations',
    conditions: [
      { state: 'completed', days: options.olderThan },
      { state: 'failed', days: options.olderThan },
      { state: 'cancelled', days: options.olderThan }
    ]
  },
  audit: {
    description: 'Audit event logs',
    table: 'audit_events',
    retentionDays: options.olderThan
  },
  sessions: {
    description: 'Expired admin sessions',
    table: 'admin_sessions',
    expiredOnly: true
  }
};

/**
 * Prompt for confirmation
 */
async function confirmCleanup(summary) {
  if (options.confirm || options.dryRun) return true;

  console.error('', { via: 'stderr' });
  console.error('⚠️  CLEANUP OPERATION', { via: 'stderr' });
  console.error('', { via: 'stderr' });
  console.error('Records to be deleted:', { via: 'stderr' });
  for (const [entity, count] of Object.entries(summary)) {
    console.error(`  ${entity}: ${count} records`, { via: 'stderr' });
  }
  console.error('', { via: 'stderr' });
  console.error('⚠️  THIS CANNOT BE UNDONE!', { via: 'stderr' });
  console.error('', { via: 'stderr' });

  const rl = createInterface({
    input: process.stdin,
    output: process.stderr
  });

  return new Promise((resolve) => {
    rl.question('Type "yes" to continue: ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Clean up tasks
 */
async function cleanupTasks(client, dryRun) {
  console.error('🗑️  Cleaning up tasks...', { via: 'stderr' });

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - options.olderThan);

  const states = ['completed', 'failed', 'cancelled'];
  let totalDeleted = 0;

  for (const state of states) {
    const countQuery = `
      SELECT count(*) as count
      FROM quota_reservations
      WHERE state = $1 AND updated_at < $2
    `;

    const result = await client.query(countQuery, [state, cutoffDate]);
    const count = parseInt(result.rows[0].count);

    if (count > 0) {
      console.error(`   ${state}: ${count} records`, { via: 'stderr' });

      if (!dryRun) {
        await client.query(
          `DELETE FROM quota_reservations WHERE state = $1 AND updated_at < $2`,
          [state, cutoffDate]
        );
      }

      totalDeleted += count;
    }
  }

  return totalDeleted;
}

/**
 * Clean up audit logs
 */
async function cleanupAudit(client, dryRun) {
  console.error('🗑️  Cleaning up audit logs...', { via: 'stderr' });

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - options.olderThan);

  const countQuery = `
    SELECT count(*) as count
    FROM audit_events
    WHERE event_timestamp < $1
  `;

  const result = await client.query(countQuery, [cutoffDate]);
  const count = parseInt(result.rows[0].count);

  console.error(`   Found ${count} old records`, { via: 'stderr' });

  if (!dryRun && count > 0) {
    await client.query(
      `DELETE FROM audit_events WHERE event_timestamp < $1`,
      [cutoffDate]
    );
  }

  return count;
}

/**
 * Clean up expired sessions
 */
async function cleanupSessions(client, dryRun) {
  console.error('🗑️  Cleaning up expired sessions...', { via: 'stderr' });

  const countQuery = `
    SELECT count(*) as count
    FROM admin_sessions
    WHERE state = 'expired' OR expires_at < NOW()
  `;

  const result = await client.query(countQuery);
  const count = parseInt(result.rows[0].count);

  console.error(`   Found ${count} expired sessions`, { via: 'stderr' });

  if (!dryRun && count > 0) {
    await client.query(
      `DELETE FROM admin_sessions WHERE state = 'expired' OR expires_at < NOW()`
    );
  }

  return count;
}

/**
 * Main cleanup process
 */
async function performCleanup() {
  const startTime = Date.now();

  console.error('🚀 Starting cleanup...', { via: 'stderr' });
  console.error(`   Retention: ${options.olderThan} days`, { via: 'stderr' });
  if (options.dryRun) {
    console.error('   Mode: DRY RUN (no data will be deleted)', { via: 'stderr' });
  }
  console.error('', { via: 'stderr' });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const summary = {};

    // Determine which entities to clean
    const entitiesToClean = entity === 'all'
      ? ['tasks', 'audit', 'sessions']
      : [entity];

    // Count records to be deleted
    for (const e of entitiesToClean) {
      switch (e) {
        case 'tasks':
          summary.tasks = await cleanupTasks(client, true);
          break;
        case 'audit':
          summary.audit = await cleanupAudit(client, true);
          break;
        case 'sessions':
          summary.sessions = await cleanupSessions(client, true);
          break;
      }
    }

    // Rollback counting transaction
    await client.query('ROLLBACK');

    // Confirm deletion
    const confirmed = await confirmCleanup(summary);

    if (!confirmed) {
      console.error('', { via: 'stderr' });
      console.error('❌ Cleanup cancelled by user', { via: 'stderr' });
      console.log(JSON.stringify({ status: 'cancelled' }));
      return;
    }

    console.error('', { via: 'stderr' });

    // Perform actual cleanup
    if (!options.dryRun) {
      await client.query('BEGIN');

      const deleted = {};

      for (const e of entitiesToClean) {
        switch (e) {
          case 'tasks':
            deleted.tasks = await cleanupTasks(client, false);
            break;
          case 'audit':
            deleted.audit = await cleanupAudit(client, false);
            break;
          case 'sessions':
            deleted.sessions = await cleanupSessions(client, false);
            break;
        }
      }

      await client.query('COMMIT');

      console.error('', { via: 'stderr' });
      console.error('✅ Cleanup completed!', { via: 'stderr' });
      console.error(`   Duration: ${Math.round((Date.now() - startTime) / 1000)}s`, { via: 'stderr' });
      console.error('', { via: 'stderr' });
      console.error('Records deleted:', { via: 'stderr' });
      for (const [entity, count] of Object.entries(deleted)) {
        console.error(`  ${entity}: ${count}`, { via: 'stderr' });
      }

      console.log(JSON.stringify({
        status: 'success',
        deleted,
        duration: Date.now() - startTime
      }, null, 2));
    } else {
      console.error('', { via: 'stderr' });
      console.error('✅ Dry run completed!', { via: 'stderr' });
      console.error('', { via: 'stderr' });
      console.error('Records that would be deleted:', { via: 'stderr' });
      for (const [entity, count] of Object.entries(summary)) {
        console.error(`  ${entity}: ${count}`, { via: 'stderr' });
      }

      console.log(JSON.stringify({
        status: 'dry-run',
        wouldDelete: summary
      }, null, 2));
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('', { via: 'stderr' });
    console.error('❌ Cleanup failed:', error.message, { via: 'stderr' });
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

performCleanup();
