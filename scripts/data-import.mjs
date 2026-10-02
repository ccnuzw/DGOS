#!/usr/bin/env node
/**
 * Import data to new instance
 * Usage: DGOS_DATABASE_URL=postgres://... node scripts/data-import.mjs <type> <file>
 * Types: users, config, packages
 */

import pg from '../apps/api/node_modules/pg/lib/index.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const [,, type, file] = process.argv;
const dbUrl = process.env.DGOS_DATABASE_URL;

if (!dbUrl || !type || !file) {
  console.error('Usage: DGOS_DATABASE_URL=postgres://... node scripts/data-import.mjs <type> <file>');
  console.error('Types: users, config, packages');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 5000 });

async function importUsers(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let imported = { principals: 0, sessions: 0, api_keys: 0 };

    // Import principals
    for (const principal of data.admin_principals || []) {
      await client.query(`
        INSERT INTO admin_principals (principal_id, status, credential_ref, roles, version, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (principal_id) DO UPDATE
        SET status = EXCLUDED.status, roles = EXCLUDED.roles, version = EXCLUDED.version, updated_at = EXCLUDED.updated_at
      `, [principal.principal_id, principal.status, principal.credential_ref, principal.roles, principal.version, principal.created_at, principal.updated_at]);
      imported.principals++;
    }

    // Import sessions
    for (const session of data.admin_sessions || []) {
      await client.query(`
        INSERT INTO admin_sessions (session_id, principal_id, state, session_version, expires_at, revoked_at, created_at, last_seen_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (session_id) DO UPDATE
        SET state = EXCLUDED.state, session_version = EXCLUDED.session_version, expires_at = EXCLUDED.expires_at, revoked_at = EXCLUDED.revoked_at, last_seen_at = EXCLUDED.last_seen_at
      `, [session.session_id, session.principal_id, session.state, session.session_version, session.expires_at, session.revoked_at, session.created_at, session.last_seen_at]);
      imported.sessions++;
    }

    // Import API keys
    for (const key of data.api_key_records || []) {
      await client.query(`
        INSERT INTO api_key_records (key_id, owner_id, prefix, digest, scope, rotation_group, state, version, expires_at, created_at, revoked_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (key_id) DO UPDATE
        SET state = EXCLUDED.state, version = EXCLUDED.version, expires_at = EXCLUDED.expires_at, revoked_at = EXCLUDED.revoked_at
      `, [key.key_id, key.owner_id, key.prefix, key.digest, key.scope, key.rotation_group, key.state, key.version, key.expires_at, key.created_at, key.revoked_at]);
      imported.api_keys++;
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({ status: 'success', type: 'users', imported }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function importConfig(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let imported = { providers: 0, bindings: 0, policies: 0, extensions: 0 };

    // Import provider accounts
    for (const provider of data.provider_accounts || []) {
      await client.query(`
        INSERT INTO provider_accounts (account_id, owner_type, owner_id, protocol_type, display_name, credential_ref, scope, state, version, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (account_id) DO UPDATE
        SET state = EXCLUDED.state, version = EXCLUDED.version, updated_at = EXCLUDED.updated_at
      `, [provider.account_id, provider.owner_type, provider.owner_id, provider.protocol_type, provider.display_name, provider.credential_ref, provider.scope, provider.state, provider.version, provider.created_at, provider.updated_at]);
      imported.providers++;
    }

    // Import provider bindings
    for (const binding of data.provider_bindings || []) {
      await client.query(`
        INSERT INTO provider_bindings (binding_id, account_id, provider_config_id, policy_version, state, version, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (binding_id) DO UPDATE
        SET state = EXCLUDED.state, version = EXCLUDED.version
      `, [binding.binding_id, binding.account_id, binding.provider_config_id, binding.policy_version, binding.state, binding.version, binding.created_at]);
      imported.bindings++;
    }

    // Import governance policies (if any)
    for (const policy of data.governance_policies || []) {
      try {
        await client.query(`
          INSERT INTO governance_policy (policy_id, policy_version, policy_document, state, created_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (policy_id) DO UPDATE
          SET policy_version = EXCLUDED.policy_version, policy_document = EXCLUDED.policy_document, state = EXCLUDED.state
        `, [policy.policy_id, policy.policy_version, policy.policy_document, policy.state, policy.created_at]);
        imported.policies++;
      } catch (error) {
        console.error('Warning: Could not import policy, table may not exist', { via: 'stderr' });
      }
    }

    // Import extensions
    for (const extension of data.extension_registry || []) {
      await client.query(`
        INSERT INTO extension_registry (extension_id, namespace, name, version, manifest, state, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (extension_id) DO UPDATE
        SET version = EXCLUDED.version, manifest = EXCLUDED.manifest, state = EXCLUDED.state
      `, [extension.extension_id, extension.namespace, extension.name, extension.version, extension.manifest, extension.state, extension.created_at]);
      imported.extensions++;
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({ status: 'success', type: 'config', imported }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function importPackages(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let imported = { packages: 0, deployments: 0, files: 0 };
    const packageRoot = process.env.DGOS_PACKAGE_ROOT || '/var/lib/dgos/packages';

    // Import app packages
    for (const pkg of data.app_packages || []) {
      await client.query(`
        INSERT INTO app_packages (package_id, namespace, name, version, digest, manifest, state, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (package_id) DO UPDATE
        SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at
      `, [pkg.package_id, pkg.namespace, pkg.name, pkg.version, pkg.digest, pkg.manifest, pkg.state, pkg.created_at, pkg.updated_at]);
      imported.packages++;
    }

    // Import package deployments
    for (const deployment of data.app_package_deployments || []) {
      await client.query(`
        INSERT INTO app_package_deployments (deployment_id, package_id, target_id, state, deployed_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (deployment_id) DO UPDATE
        SET state = EXCLUDED.state
      `, [deployment.deployment_id, deployment.package_id, deployment.target_id, deployment.state, deployment.deployed_at, deployment.created_at]);
      imported.deployments++;
    }

    // Note: Package files should be restored separately using tar/cp
    // This script only imports database records
    imported.files = data.package_files?.length || 0;

    await client.query('COMMIT');
    console.log(JSON.stringify({
      status: 'success',
      type: 'packages',
      imported,
      note: 'Package files must be restored separately to ' + packageRoot
    }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    const content = await readFile(file, 'utf-8');
    const data = JSON.parse(content);

    if (data.format_version !== 1) {
      throw new Error(`Unsupported format version: ${data.format_version}`);
    }

    switch (type) {
      case 'users':
        await importUsers(data.data);
        break;
      case 'config':
        await importConfig(data.data);
        break;
      case 'packages':
        await importPackages(data.data);
        break;
      default:
        throw new Error(`Unknown import type: ${type}. Use: users, config, or packages`);
    }
  } catch (error) {
    console.error('Import failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
