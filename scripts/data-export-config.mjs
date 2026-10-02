#!/usr/bin/env node
/**
 * Export configuration data for migration
 * Usage: DGOS_DATABASE_URL=postgres://... node scripts/data-export-config.mjs > config-export.json
 */

import pg from '../apps/api/node_modules/pg/lib/index.js';

const dbUrl = process.env.DGOS_DATABASE_URL;
if (!dbUrl) {
  console.error('Error: DGOS_DATABASE_URL environment variable required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 5000 });

async function exportConfig() {
  try {
    // Export provider accounts
    const providers = await pool.query(`
      SELECT account_id, owner_type, owner_id, protocol_type, display_name,
             credential_ref, scope, state, version, created_at, updated_at
      FROM provider_accounts
      WHERE state != 'revoked'
      ORDER BY created_at
    `);

    // Export provider bindings
    const bindings = await pool.query(`
      SELECT binding_id, account_id, provider_config_id, policy_version,
             state, version, created_at
      FROM provider_bindings
      WHERE state = 'active'
      ORDER BY created_at
    `);

    // Export governance policy (if table exists)
    let policies = { rows: [] };
    try {
      policies = await pool.query(`
        SELECT policy_id, policy_version, policy_document, state, created_at
        FROM governance_policy
        WHERE state = 'active'
        ORDER BY created_at
      `);
    } catch (error) {
      console.error('Warning: governance_policy table not found, skipping', { via: 'stderr' });
    }

    // Export extensions
    const extensions = await pool.query(`
      SELECT extension_id, namespace, name, version, manifest, state, created_at
      FROM extension_registry
      WHERE state != 'deprecated'
      ORDER BY created_at
    `);

    const exportData = {
      format_version: 1,
      exported_at: new Date().toISOString(),
      counts: {
        provider_accounts: providers.rows.length,
        provider_bindings: bindings.rows.length,
        governance_policies: policies.rows.length,
        extensions: extensions.rows.length
      },
      data: {
        provider_accounts: providers.rows,
        provider_bindings: bindings.rows,
        governance_policies: policies.rows,
        extension_registry: extensions.rows
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

exportConfig();
