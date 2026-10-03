#!/usr/bin/env node
/**
 * DGOS V1 Incremental Backup Tool
 * Creates an incremental backup of changes since last full/incremental backup
 *
 * Usage:
 *   DGOS_DATABASE_URL=postgres://... node scripts/backup-incremental.mjs [options]
 *
 * Options:
 *   --output <dir>     Backup directory (default: ./backups/dgos-incremental-TIMESTAMP)
 *   --since <file>     Reference backup metadata.json file
 *   --compress         Compress backup with gzip
 */

import pg from '../apps/api/node_modules/pg/lib/index.js';
import { mkdir, writeFile, readFile, readdir, stat, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

// Parse arguments
const args = process.argv.slice(2);
const options = {
  output: null,
  since: null,
  compress: args.includes('--compress')
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--output' && args[i + 1]) {
    options.output = args[i + 1];
  } else if (args[i] === '--since' && args[i + 1]) {
    options.since = args[i + 1];
  }
}

// Find last backup if not specified
if (!options.since) {
  try {
    const backupRoot = resolve('./backups');
    const entries = await readdir(backupRoot, { withFileTypes: true });
    const backups = entries
      .filter(e => e.isDirectory() && e.name.startsWith('dgos-backup-'))
      .map(e => ({
        name: e.name,
        path: join(backupRoot, e.name, 'metadata.json')
      }))
      .sort((a, b) => b.name.localeCompare(a.name));

    if (backups.length > 0) {
      options.since = backups[0].path;
      console.error(`Using last backup: ${backups[0].name}`, { via: 'stderr' });
    }
  } catch (err) {
    // No backups found
  }
}

if (!options.since) {
  console.error('Error: No reference backup found. Use --since <metadata.json> or create a full backup first.');
  process.exit(1);
}

const config = {
  dbUrl: process.env.DGOS_DATABASE_URL,
  packageRoot: process.env.DGOS_PACKAGE_ROOT || '/var/lib/dgos/packages',
  uploadDir: process.env.DGOS_UPLOAD_DIR || '/var/lib/dgos/uploads'
};

if (!config.dbUrl) {
  console.error('Error: DGOS_DATABASE_URL environment variable required');
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const backupDir = options.output || resolve('./backups', `dgos-incremental-${timestamp}`);

const pool = new pg.Pool({ connectionString: config.dbUrl, connectionTimeoutMillis: 10000 });

/**
 * Load reference backup metadata
 */
async function loadReferenceMetadata() {
  const content = await readFile(options.since, 'utf-8');
  return JSON.parse(content);
}

/**
 * Track database changes since reference backup
 */
async function trackDatabaseChanges(sinceTimestamp) {
  console.error('📊 Tracking database changes...', { via: 'stderr' });

  const client = await pool.connect();
  try {
    const changes = {
      tables: {},
      newMigrations: []
    };

    // Check for new migrations
    const newMigrations = await client.query(`
      SELECT migration_version, applied_at
      FROM dgos_schema_migrations
      WHERE applied_at > $1
      ORDER BY applied_at
    `, [sinceTimestamp]);

    changes.newMigrations = newMigrations.rows.map(r => r.migration_version);

    // Track changes in each table
    const tablesWithTimestamp = [
      { table: 'admin_principals', timestampCol: 'updated_at' },
      { table: 'admin_sessions', timestampCol: 'created_at' },
      { table: 'api_key_records', timestampCol: 'created_at' },
      { table: 'provider_accounts', timestampCol: 'updated_at' },
      { table: 'provider_bindings', timestampCol: 'created_at' },
      { table: 'audit_events', timestampCol: 'event_timestamp' },
      { table: 'extension_registry', timestampCol: 'created_at' },
      { table: 'app_packages', timestampCol: 'updated_at' },
      { table: 'app_package_deployments', timestampCol: 'created_at' }
    ];

    for (const { table, timestampCol } of tablesWithTimestamp) {
      try {
        // Count new/updated records
        const result = await client.query(`
          SELECT count(*) as count
          FROM ${table}
          WHERE ${timestampCol} > $1
        `, [sinceTimestamp]);

        const count = parseInt(result.rows[0].count);

        if (count > 0) {
          // Export changed records
          const data = await client.query(`
            SELECT *
            FROM ${table}
            WHERE ${timestampCol} > $1
            ORDER BY ${timestampCol}
          `, [sinceTimestamp]);

          changes.tables[table] = {
            changedRows: count,
            data: data.rows
          };
        }
      } catch (err) {
        console.error(`   Warning: Could not track ${table}: ${err.message}`, { via: 'stderr' });
      }
    }

    return changes;

  } finally {
    client.release();
  }
}

/**
 * Track file changes
 */
async function trackFileChanges(refMetadata) {
  console.error('📁 Tracking file changes...', { via: 'stderr' });

  const changes = {
    packages: { added: [], modified: [], count: 0 },
    uploads: { added: [], modified: [], count: 0 }
  };

  // Track package file changes
  try {
    const files = await readdir(config.packageRoot);
    const refPackageCount = refMetadata.files?.packages?.fileCount || 0;

    for (const file of files) {
      const filePath = join(config.packageRoot, file);
      const stats = await stat(filePath);

      if (stats.isFile() && stats.mtime > new Date(refMetadata.timestamp)) {
        changes.packages.added.push({
          name: file,
          size: stats.size,
          modified: stats.mtime.toISOString()
        });
        changes.packages.count++;
      }
    }
  } catch (err) {
    console.error(`   Warning: Could not track packages: ${err.message}`, { via: 'stderr' });
  }

  // Track upload file changes
  try {
    const files = await readdir(config.uploadDir);

    for (const file of files) {
      const filePath = join(config.uploadDir, file);
      const stats = await stat(filePath);

      if (stats.isFile() && stats.mtime > new Date(refMetadata.timestamp)) {
        changes.uploads.added.push({
          name: file,
          size: stats.size,
          modified: stats.mtime.toISOString()
        });
        changes.uploads.count++;
      }
    }
  } catch (err) {
    console.error(`   Warning: Could not track uploads: ${err.message}`, { via: 'stderr' });
  }

  return changes;
}

/**
 * Backup changed files
 */
async function backupChangedFiles(backupPath, fileChanges) {
  console.error('💾 Backing up changed files...', { via: 'stderr' });

  // Backup changed packages
  if (fileChanges.packages.added.length > 0) {
    const packageBackupPath = join(backupPath, 'packages');
    await mkdir(packageBackupPath, { recursive: true });

    for (const file of fileChanges.packages.added) {
      const sourcePath = join(config.packageRoot, file.name);
      const destPath = join(packageBackupPath, file.name);
      await copyFile(sourcePath, destPath);
    }
  }

  // Backup changed uploads
  if (fileChanges.uploads.added.length > 0) {
    const uploadBackupPath = join(backupPath, 'uploads');
    await mkdir(uploadBackupPath, { recursive: true });

    for (const file of fileChanges.uploads.added) {
      const sourcePath = join(config.uploadDir, file.name);
      const destPath = join(uploadBackupPath, file.name);
      await copyFile(sourcePath, destPath);
    }
  }
}

/**
 * Main incremental backup process
 */
async function performIncrementalBackup() {
  const startTime = Date.now();

  console.error('🚀 Starting incremental backup...', { via: 'stderr' });
  console.error(`   Output: ${backupDir}`, { via: 'stderr' });
  console.error('', { via: 'stderr' });

  try {
    // Load reference metadata
    const refMetadata = await loadReferenceMetadata();
    const sinceTimestamp = refMetadata.timestamp;

    console.error(`   Reference: ${sinceTimestamp}`, { via: 'stderr' });
    console.error('', { via: 'stderr' });

    // Create backup directory
    await mkdir(backupDir, { recursive: true, mode: 0o700 });

    // Track changes
    const dbChanges = await trackDatabaseChanges(sinceTimestamp);
    const fileChanges = await trackFileChanges(refMetadata);

    // Backup changed data
    const changesPath = join(backupDir, 'changes.json');
    await writeFile(changesPath, JSON.stringify(dbChanges, null, 2));

    // Backup changed files
    await backupChangedFiles(backupDir, fileChanges);

    // Calculate totals
    const totalChangedRows = Object.values(dbChanges.tables).reduce(
      (sum, t) => sum + t.changedRows,
      0
    );

    // Generate metadata
    const metadata = {
      version: '1.0.0',
      type: 'incremental',
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      reference: {
        timestamp: sinceTimestamp,
        metadataFile: options.since
      },
      changes: {
        database: {
          tables: Object.keys(dbChanges.tables).length,
          totalRows: totalChangedRows,
          newMigrations: dbChanges.newMigrations.length
        },
        files: {
          packages: fileChanges.packages.count,
          uploads: fileChanges.uploads.count
        }
      },
      options: {
        compressed: options.compress
      }
    };

    await writeFile(
      join(backupDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.error('', { via: 'stderr' });
    console.error('✅ Incremental backup completed!', { via: 'stderr' });
    console.error('', { via: 'stderr' });
    console.error(`📊 Summary:`, { via: 'stderr' });
    console.error(`   Changed rows: ${totalChangedRows} across ${Object.keys(dbChanges.tables).length} tables`, { via: 'stderr' });
    console.error(`   New migrations: ${dbChanges.newMigrations.length}`, { via: 'stderr' });
    console.error(`   Changed packages: ${fileChanges.packages.count}`, { via: 'stderr' });
    console.error(`   Changed uploads: ${fileChanges.uploads.count}`, { via: 'stderr' });
    console.error(`   Duration: ${Math.round((Date.now() - startTime) / 1000)}s`, { via: 'stderr' });

    // Output result as JSON
    console.log(JSON.stringify({
      status: 'success',
      backupDir: resolve(backupDir),
      metadata
    }, null, 2));

  } catch (error) {
    console.error('', { via: 'stderr' });
    console.error('❌ Incremental backup failed:', error.message, { via: 'stderr' });
    console.log(JSON.stringify({
      status: 'error',
      error: error.message,
      backupDir: resolve(backupDir)
    }));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

performIncrementalBackup();
