#!/usr/bin/env node
/**
 * Export package data for migration
 * Usage: DGOS_DATABASE_URL=postgres://... DGOS_PACKAGE_ROOT=/var/lib/dgos/packages node scripts/data-export-packages.mjs > packages-export.json
 */

import pg from '../apps/api/node_modules/pg/lib/index.js';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const dbUrl = process.env.DGOS_DATABASE_URL;
const packageRoot = process.env.DGOS_PACKAGE_ROOT || '/var/lib/dgos/packages';

if (!dbUrl) {
  console.error('Error: DGOS_DATABASE_URL environment variable required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 5000 });

async function hashFile(filePath) {
  const content = await readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

async function exportPackages() {
  try {
    // Export app packages
    const packages = await pool.query(`
      SELECT package_id, namespace, name, version, digest, manifest,
             state, created_at, updated_at
      FROM app_packages
      WHERE state = 'active'
      ORDER BY created_at
    `);

    // Export package deployments
    const deployments = await pool.query(`
      SELECT deployment_id, package_id, target_id, state, deployed_at, created_at
      FROM app_package_deployments
      WHERE state = 'deployed'
      ORDER BY created_at
    `);

    // Scan package files
    const packageFiles = [];
    try {
      const entries = await readdir(packageRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = join(packageRoot, entry.name);
          const stats = await stat(filePath);
          const hash = await hashFile(filePath);
          packageFiles.push({
            name: entry.name,
            size: stats.size,
            sha256: hash,
            modified_at: stats.mtime.toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Warning: Could not scan package directory:', error.message, { via: 'stderr' });
    }

    const exportData = {
      format_version: 1,
      exported_at: new Date().toISOString(),
      package_root: packageRoot,
      counts: {
        packages: packages.rows.length,
        deployments: deployments.rows.length,
        files: packageFiles.length
      },
      data: {
        app_packages: packages.rows,
        app_package_deployments: deployments.rows,
        package_files: packageFiles
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

exportPackages();
