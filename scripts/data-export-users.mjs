#!/usr/bin/env node
/**
 * Export user data for migration
 * Usage: DGOS_DATABASE_URL=postgres://... node scripts/data-export-users.mjs > users-export.json
 */

import pg from '../apps/api/node_modules/pg/lib/index.js';

const dbUrl = process.env.DGOS_DATABASE_URL;
if (!dbUrl) {
  console.error('Error: DGOS_DATABASE_URL environment variable required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 5000 });

async function exportUsers() {
  try {
    // Export admin principals
    const principals = await pool.query(`
      SELECT principal_id, status, credential_ref, roles, version, created_at, updated_at
      FROM admin_principals
      ORDER BY created_at
    `);

    // Export admin sessions
    const sessions = await pool.query(`
      SELECT session_id, principal_id, state, session_version, expires_at, revoked_at, created_at, last_seen_at
      FROM admin_sessions
      WHERE state = 'active' OR (state = 'expired' AND expires_at > now() - interval '30 days')
      ORDER BY created_at
    `);

    // Export API keys
    const apiKeys = await pool.query(`
      SELECT key_id, owner_id, prefix, digest, scope, rotation_group, state, version, expires_at, created_at, revoked_at
      FROM api_key_records
      WHERE state != 'revoked' OR (state = 'revoked' AND revoked_at > now() - interval '30 days')
      ORDER BY created_at
    `);

    const exportData = {
      format_version: 1,
      exported_at: new Date().toISOString(),
      counts: {
        principals: principals.rows.length,
        sessions: sessions.rows.length,
        api_keys: apiKeys.rows.length
      },
      data: {
        admin_principals: principals.rows,
        admin_sessions: sessions.rows,
        api_key_records: apiKeys.rows
      }
    };

    console.log(JSON.stringify(exportData, null, 2));
  } catch (error) {
    console.error('Export failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

exportUsers();
