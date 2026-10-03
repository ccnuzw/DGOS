#!/usr/bin/env node
/**
 * DGOS V1 Full Restore Tool
 * Restores a complete backup including database, files, secrets, and configuration
 *
 * Usage:
 *   DGOS_DATABASE_URL=postgres://... node scripts/restore-full.mjs <backup-dir> [options]
 *
 * Options:
 *   --validate-only    Only validate backup, don't restore
 *   --skip-database    Skip database restore
 *   --skip-files       Skip file restore
 *   --skip-secrets     Skip secrets restore
 *   --force            Skip confirmation prompt
 *
 * Environment:
 *   DGOS_DATABASE_URL       PostgreSQL connection string
 *   DGOS_PACKAGE_ROOT       Package files directory
 *   DGOS_SECRETS_DIR        Secrets directory
 *   DGOS_UPLOAD_DIR         User uploads directory
 */

import pg from '../apps/api/node_modules/pg/lib/index.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir, stat, copyFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const execAsync = promisify(exec);

// Parse arguments
const [,, backupDir, ...argsList] = process.argv;
const args = argsList;

if (!backupDir) {
  console.error('Usage: node scripts/restore-full.mjs <backup-dir> [options]');
  console.error('Options:');
  console.error('  --validate-only    Only validate backup, don\'t restore');
  console.error('  --skip-database    Skip database restore');
  console.error('  --skip-files       Skip file restore');
  console.error('  --skip-secrets     Skip secrets restore');
  console.error('  --force            Skip confirmation prompt');
  process.exit(1);
}

const options = {
  validateOnly: args.includes('--validate-only'),
  skipDatabase: args.includes('--skip-database'),
  skipFiles: args.includes('--skip-files'),
  skipSecrets: args.includes('--skip-secrets'),
  force: args.includes('--force')
};

const config = {
  dbUrl: process.env.DGOS_DATABASE_URL,
  packageRoot: process.env.DGOS_PACKAGE_ROOT || '/var/lib/dgos/packages',
  secretsDir: process.env.DGOS_SECRETS_DIR || '/var/lib/dgos/secrets',
  uploadDir: process.env.DGOS_UPLOAD_DIR || '/var/lib/dgos/uploads'
};

if (!config.dbUrl) {
  console.error('Error: DGOS_DATABASE_URL environment variable required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: config.dbUrl, connectionTimeoutMillis: 10000 });

/**
 * Calculate checksum for a file
 */
async function calculateChecksum(filePath) {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

/**
 * Validate backup integrity
 */
async function validateBackup(backupPath) {
  console.error('🔍 Validating backup...', { via: 'stderr' });

  const issues = [];

  // Check metadata file
  let metadata;
  try {
    const metadataPath = join(backupPath, 'metadata.json');
    const content = await readFile(metadataPath, 'utf-8');
    metadata = JSON.parse(content);

    if (!metadata.version || !metadata.timestamp || !metadata.type) {
      issues.push('Invalid metadata format');
    }
  } catch (err) {
    issues.push(`Cannot read metadata: ${err.message}`);
    return { valid: false, issues, metadata: null };
  }

  // Check database backup
  const dbFile = metadata.options?.compressed ? 'database.sql.gz' : 'database.sql';
  const dbPath = join(backupPath, dbFile);
  try {
    await stat(dbPath);
  } catch (err) {
    issues.push(`Database backup missing: ${dbFile}`);
  }

  // Verify checksums if available
  try {
    const checksumPath = join(backupPath, 'checksum.txt');
    const checksumContent = await readFile(checksumPath, 'utf-8');
    const checksums = checksumContent.split('\n').filter(l => l.trim());

    let verified = 0;
    let failed = 0;

    for (const line of checksums) {
      const [expectedHash, ...filePathParts] = line.split(/\s+/);
      const relPath = filePathParts.join(' ');
      const fullPath = join(backupPath, relPath);

      try {
        const actualHash = await calculateChecksum(fullPath);
        if (actualHash === expectedHash) {
          verified++;
        } else {
          failed++;
          issues.push(`Checksum mismatch: ${relPath}`);
        }
      } catch (err) {
        failed++;
        issues.push(`Cannot verify: ${relPath}`);
      }
    }

    console.error(`   Checksums: ${verified} verified, ${failed} failed`, { via: 'stderr' });
  } catch (err) {
    console.error(`   Warning: No checksums to verify`, { via: 'stderr' });
  }

  // Check version compatibility
  const currentVersion = '1.0.0';
  if (metadata.version !== currentVersion) {
    issues.push(`Version mismatch: backup is ${metadata.version}, system is ${currentVersion}`);
  }

  const valid = issues.length === 0;

  if (valid) {
    console.error('   ✅ Backup validation passed', { via: 'stderr' });
  } else {
    console.error('   ❌ Backup validation failed:', { via: 'stderr' });
    for (const issue of issues) {
      console.error(`      - ${issue}`, { via: 'stderr' });
    }
  }

  return { valid, issues, metadata };
}

/**
 * Prompt for user confirmation
 */
async function confirmRestore(metadata) {
  console.error('', { via: 'stderr' });
  console.error('⚠️  RESTORE OPERATION', { via: 'stderr' });
  console.error('', { via: 'stderr' });
  console.error('Backup Details:', { via: 'stderr' });
  console.error(`  Date: ${new Date(metadata.timestamp).toLocaleString()}`, { via: 'stderr' });
  console.error(`  Type: ${metadata.type}`, { via: 'stderr' });
  console.error(`  Version: ${metadata.version}`, { via: 'stderr' });
  console.error(`  Database: ${metadata.database?.totalRows || 0} rows`, { via: 'stderr' });
  console.error(`  Files: ${(metadata.files?.packages?.fileCount || 0) + (metadata.files?.uploads?.fileCount || 0)} files`, { via: 'stderr' });
  console.error('', { via: 'stderr' });
  console.error('⚠️  THIS WILL OVERWRITE CURRENT DATA!', { via: 'stderr' });
  console.error('', { via: 'stderr' });

  if (options.force) {
    console.error('--force specified, proceeding without confirmation', { via: 'stderr' });
    return true;
  }

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
 * Restore database
 */
async function restoreDatabase(backupPath, metadata) {
  console.error('📦 Restoring database...', { via: 'stderr' });

  const dbFile = metadata.options?.compressed ? 'database.sql.gz' : 'database.sql';
  const dbPath = join(backupPath, dbFile);

  const parseConnectionString = (url) => {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || 5432,
      database: parsed.pathname.slice(1),
      username: parsed.username,
      password: parsed.password
    };
  };

  const dbConfig = parseConnectionString(config.dbUrl);
  const pgEnv = {
    ...process.env,
    PGPASSWORD: dbConfig.password
  };

  try {
    // Decompress if needed
    let sqlPath = dbPath;
    if (metadata.options?.compressed) {
      console.error('   Decompressing database backup...', { via: 'stderr' });
      sqlPath = dbPath.replace('.gz', '');
      await execAsync(`gunzip -c "${dbPath}" > "${sqlPath}"`);
    }

    // Restore using psql
    console.error('   Importing data...', { via: 'stderr' });
    await execAsync(
      `psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -f "${sqlPath}"`,
      { env: pgEnv }
    );

    console.error('   ✅ Database restored', { via: 'stderr' });
  } catch (err) {
    throw new Error(`Database restore failed: ${err.message}`);
  }
}

/**
 * Restore secrets
 */
async function restoreSecrets(backupPath) {
  console.error('🔐 Restoring secrets...', { via: 'stderr' });

  const secretsBackupPath = join(backupPath, 'secrets');

  try {
    await mkdir(config.secretsDir, { recursive: true, mode: 0o700 });

    const files = await readdir(secretsBackupPath);

    for (const file of files) {
      const sourcePath = join(secretsBackupPath, file);
      const destPath = join(config.secretsDir, file);
      await copyFile(sourcePath, destPath);
    }

    console.error(`   ✅ Restored ${files.length} secret files`, { via: 'stderr' });
  } catch (err) {
    console.error(`   Warning: Could not restore secrets: ${err.message}`, { via: 'stderr' });
  }
}

/**
 * Restore files
 */
async function restoreFiles(backupPath) {
  console.error('📁 Restoring files...', { via: 'stderr' });

  let packageCount = 0;
  let uploadCount = 0;

  // Restore packages
  try {
    const packageBackupPath = join(backupPath, 'packages');
    await mkdir(config.packageRoot, { recursive: true });

    const files = await readdir(packageBackupPath);
    for (const file of files) {
      const sourcePath = join(packageBackupPath, file);
      const destPath = join(config.packageRoot, file);
      await copyFile(sourcePath, destPath);
      packageCount++;
    }
  } catch (err) {
    console.error(`   Warning: Could not restore packages: ${err.message}`, { via: 'stderr' });
  }

  // Restore uploads
  try {
    const uploadBackupPath = join(backupPath, 'uploads');
    await mkdir(config.uploadDir, { recursive: true });

    const files = await readdir(uploadBackupPath);
    for (const file of files) {
      const sourcePath = join(uploadBackupPath, file);
      const destPath = join(config.uploadDir, file);
      await copyFile(sourcePath, destPath);
      uploadCount++;
    }
  } catch (err) {
    console.error(`   Warning: Could not restore uploads: ${err.message}`, { via: 'stderr' });
  }

  console.error(`   ✅ Restored ${packageCount} packages, ${uploadCount} uploads`, { via: 'stderr' });
}

/**
 * Main restore process
 */
async function performRestore() {
  const startTime = Date.now();

  console.error('🚀 Starting restore...', { via: 'stderr' });
  console.error(`   Backup: ${backupDir}`, { via: 'stderr' });
  console.error('', { via: 'stderr' });

  try {
    // Validate backup
    const validation = await validateBackup(backupDir);

    if (!validation.valid) {
      console.log(JSON.stringify({
        status: 'error',
        error: 'Backup validation failed',
        issues: validation.issues
      }));
      process.exit(1);
    }

    if (options.validateOnly) {
      console.log(JSON.stringify({
        status: 'success',
        action: 'validate',
        metadata: validation.metadata
      }, null, 2));
      return;
    }

    // Confirm restore
    const confirmed = await confirmRestore(validation.metadata);
    if (!confirmed) {
      console.error('', { via: 'stderr' });
      console.error('❌ Restore cancelled by user', { via: 'stderr' });
      console.log(JSON.stringify({ status: 'cancelled' }));
      process.exit(0);
    }

    console.error('', { via: 'stderr' });

    // Perform restore
    if (!options.skipDatabase) {
      await restoreDatabase(backupDir, validation.metadata);
    }

    if (!options.skipSecrets) {
      await restoreSecrets(backupDir);
    }

    if (!options.skipFiles) {
      await restoreFiles(backupDir);
    }

    console.error('', { via: 'stderr' });
    console.error('✅ Restore completed successfully!', { via: 'stderr' });
    console.error(`   Duration: ${Math.round((Date.now() - startTime) / 1000)}s`, { via: 'stderr' });

    console.log(JSON.stringify({
      status: 'success',
      action: 'restore',
      duration: Date.now() - startTime,
      metadata: validation.metadata
    }, null, 2));

  } catch (error) {
    console.error('', { via: 'stderr' });
    console.error('❌ Restore failed:', error.message, { via: 'stderr' });
    console.log(JSON.stringify({
      status: 'error',
      error: error.message
    }));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

performRestore();
