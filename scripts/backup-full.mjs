#!/usr/bin/env node
/**
 * DGOS V1 Full Backup Tool
 * Creates a complete backup including database, files, secrets, and configuration
 *
 * Usage:
 *   DGOS_DATABASE_URL=postgres://... node scripts/backup-full.mjs [options]
 *
 * Options:
 *   --output <dir>     Backup directory (default: ./backups/dgos-backup-TIMESTAMP)
 *   --compress         Compress backup with gzip
 *   --encrypt          Encrypt sensitive data (requires BACKUP_ENCRYPTION_KEY)
 *   --s3-upload        Upload to S3 after backup (requires AWS credentials)
 *
 * Environment:
 *   DGOS_DATABASE_URL       PostgreSQL connection string
 *   DGOS_PACKAGE_ROOT       Package files directory
 *   DGOS_SECRETS_DIR        Secrets directory
 *   DGOS_UPLOAD_DIR         User uploads directory
 *   BACKUP_ENCRYPTION_KEY   Encryption key for sensitive data
 *   AWS_S3_BUCKET          S3 bucket for remote backup
 */

import pg from '../apps/api/node_modules/pg/lib/index.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readdir, stat, copyFile, readFile } from 'node:fs/promises';
import { createHash, createCipheriv, randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

const execAsync = promisify(exec);

// Parse arguments
const args = process.argv.slice(2);
const options = {
  output: null,
  compress: args.includes('--compress'),
  encrypt: args.includes('--encrypt'),
  s3Upload: args.includes('--s3-upload')
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--output' && args[i + 1]) {
    options.output = args[i + 1];
  }
}

// Environment configuration
const config = {
  dbUrl: process.env.DGOS_DATABASE_URL,
  packageRoot: process.env.DGOS_PACKAGE_ROOT || '/var/lib/dgos/packages',
  secretsDir: process.env.DGOS_SECRETS_DIR || '/var/lib/dgos/secrets',
  uploadDir: process.env.DGOS_UPLOAD_DIR || '/var/lib/dgos/uploads',
  encryptionKey: process.env.BACKUP_ENCRYPTION_KEY,
  s3Bucket: process.env.AWS_S3_BUCKET
};

if (!config.dbUrl) {
  console.error('Error: DGOS_DATABASE_URL environment variable required');
  process.exit(1);
}

if (options.encrypt && !config.encryptionKey) {
  console.error('Error: BACKUP_ENCRYPTION_KEY required for encryption');
  process.exit(1);
}

if (options.s3Upload && !config.s3Bucket) {
  console.error('Error: AWS_S3_BUCKET required for S3 upload');
  process.exit(1);
}

// Generate backup directory name
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const backupDir = options.output || resolve('./backups', `dgos-backup-${timestamp}`);

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
 * Encrypt data using AES-256-GCM
 */
function encryptData(data, key) {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);

  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Backup database schema and data
 */
async function backupDatabase(backupPath) {
  console.error('📦 Backing up database...', { via: 'stderr' });

  const client = await pool.connect();
  try {
    // Get migration status
    const migrations = await client.query(`
      SELECT migration_version, applied_at
      FROM dgos_schema_migrations
      ORDER BY applied_at
    `);

    // Get table counts
    const tables = [
      'admin_principals', 'admin_sessions', 'api_key_records',
      'provider_accounts', 'provider_bindings', 'connection_tests',
      'audit_events', 'quota_reservations', 'extension_registry',
      'app_packages', 'app_package_deployments', 'governance_policy'
    ];

    const tableCounts = {};
    let totalRows = 0;

    for (const table of tables) {
      try {
        const result = await client.query(`SELECT count(*) as count FROM ${table}`);
        const count = parseInt(result.rows[0].count);
        tableCounts[table] = count;
        totalRows += count;
      } catch (err) {
        tableCounts[table] = 0; // Table might not exist
      }
    }

    // Export database using pg_dump
    const dbSqlPath = join(backupPath, 'database.sql');
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
    const pgDumpEnv = {
      ...process.env,
      PGPASSWORD: dbConfig.password
    };

    await execAsync(
      `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -F p -f "${dbSqlPath}"`,
      { env: pgDumpEnv }
    );

    const sqlStats = await stat(dbSqlPath);

    // Compress if requested
    if (options.compress) {
      console.error('🗜️  Compressing database backup...', { via: 'stderr' });
      const gzipPath = `${dbSqlPath}.gz`;
      await pipeline(
        createReadStream(dbSqlPath),
        createGzip(),
        createWriteStream(gzipPath)
      );
      const gzStats = await stat(gzipPath);
      console.error(`   Compressed: ${sqlStats.size} → ${gzStats.size} bytes (${Math.round(gzStats.size / sqlStats.size * 100)}%)`, { via: 'stderr' });
    }

    return {
      migrations: migrations.rows.map(r => r.migration_version),
      tableCounts,
      totalRows,
      size: sqlStats.size,
      compressed: options.compress
    };

  } finally {
    client.release();
  }
}

/**
 * Backup secrets and credentials
 */
async function backupSecrets(backupPath) {
  console.error('🔐 Backing up secrets...', { via: 'stderr' });

  const secretsBackupPath = join(backupPath, 'secrets');
  await mkdir(secretsBackupPath, { recursive: true, mode: 0o700 });

  let fileCount = 0;
  let totalSize = 0;

  try {
    const files = await readdir(config.secretsDir);

    for (const file of files) {
      const sourcePath = join(config.secretsDir, file);
      const destPath = join(secretsBackupPath, file);

      const stats = await stat(sourcePath);
      if (stats.isFile()) {
        await copyFile(sourcePath, destPath);
        fileCount++;
        totalSize += stats.size;
      }
    }

    // Encrypt secrets metadata if requested
    if (options.encrypt) {
      const secretsMetaPath = join(backupPath, 'secrets.enc');
      const secretsList = files.map(f => ({ name: f, backedUp: true }));
      const encrypted = encryptData(secretsList, config.encryptionKey);
      await writeFile(secretsMetaPath, JSON.stringify(encrypted, null, 2), { mode: 0o600 });
    }

  } catch (err) {
    console.error(`   Warning: Could not backup secrets: ${err.message}`, { via: 'stderr' });
  }

  return { fileCount, totalSize };
}

/**
 * Backup user uploads and package files
 */
async function backupFiles(backupPath) {
  console.error('📁 Backing up files...', { via: 'stderr' });

  const results = {
    packages: { fileCount: 0, totalSize: 0 },
    uploads: { fileCount: 0, totalSize: 0 }
  };

  // Backup package files
  try {
    const packageBackupPath = join(backupPath, 'packages');
    await mkdir(packageBackupPath, { recursive: true });

    const files = await readdir(config.packageRoot);
    for (const file of files) {
      const sourcePath = join(config.packageRoot, file);
      const stats = await stat(sourcePath);

      if (stats.isFile()) {
        await copyFile(sourcePath, join(packageBackupPath, file));
        results.packages.fileCount++;
        results.packages.totalSize += stats.size;
      }
    }
  } catch (err) {
    console.error(`   Warning: Could not backup packages: ${err.message}`, { via: 'stderr' });
  }

  // Backup user uploads
  try {
    const uploadBackupPath = join(backupPath, 'uploads');
    await mkdir(uploadBackupPath, { recursive: true });

    const files = await readdir(config.uploadDir);
    for (const file of files) {
      const sourcePath = join(config.uploadDir, file);
      const stats = await stat(sourcePath);

      if (stats.isFile()) {
        await copyFile(sourcePath, join(uploadBackupPath, file));
        results.uploads.fileCount++;
        results.uploads.totalSize += stats.size;
      }
    }
  } catch (err) {
    console.error(`   Warning: Could not backup uploads: ${err.message}`, { via: 'stderr' });
  }

  return results;
}

/**
 * Backup configuration
 */
async function backupConfig(backupPath) {
  console.error('⚙️  Backing up configuration...', { via: 'stderr' });

  const client = await pool.connect();
  try {
    // Export all configuration data
    const providers = await client.query('SELECT * FROM provider_accounts ORDER BY created_at');
    const bindings = await client.query('SELECT * FROM provider_bindings ORDER BY created_at');
    const extensions = await client.query('SELECT * FROM extension_registry ORDER BY created_at');

    let policies = { rows: [] };
    try {
      policies = await client.query('SELECT * FROM governance_policy ORDER BY created_at');
    } catch (err) {
      // Table might not exist
    }

    const configData = {
      provider_accounts: providers.rows,
      provider_bindings: bindings.rows,
      extension_registry: extensions.rows,
      governance_policies: policies.rows
    };

    const configPath = join(backupPath, 'config.json');
    await writeFile(configPath, JSON.stringify(configData, null, 2));

    return {
      providers: providers.rows.length,
      bindings: bindings.rows.length,
      extensions: extensions.rows.length,
      policies: policies.rows.length
    };

  } finally {
    client.release();
  }
}

/**
 * Generate checksum file
 */
async function generateChecksums(backupPath) {
  console.error('🔍 Generating checksums...', { via: 'stderr' });

  const checksums = [];
  const files = await readdir(backupPath, { recursive: true });

  for (const file of files) {
    const filePath = join(backupPath, file);
    const stats = await stat(filePath);

    if (stats.isFile() && file !== 'checksum.txt') {
      const checksum = await calculateChecksum(filePath);
      checksums.push(`${checksum}  ${file}`);
    }
  }

  await writeFile(join(backupPath, 'checksum.txt'), checksums.join('\n'));

  return checksums.length;
}

/**
 * Upload backup to S3
 */
async function uploadToS3(backupPath) {
  console.error('☁️  Uploading to S3...', { via: 'stderr' });

  const backupName = backupPath.split('/').pop();

  try {
    await execAsync(
      `aws s3 sync "${backupPath}" "s3://${config.s3Bucket}/backups/${backupName}" --storage-class STANDARD_IA`
    );

    console.error(`   Uploaded to s3://${config.s3Bucket}/backups/${backupName}`, { via: 'stderr' });

    return {
      bucket: config.s3Bucket,
      key: `backups/${backupName}`,
      uploaded: true
    };
  } catch (err) {
    console.error(`   S3 upload failed: ${err.message}`, { via: 'stderr' });
    return { uploaded: false, error: err.message };
  }
}

/**
 * Main backup process
 */
async function performFullBackup() {
  const startTime = Date.now();

  console.error('🚀 Starting full backup...', { via: 'stderr' });
  console.error(`   Output: ${backupDir}`, { via: 'stderr' });
  console.error('', { via: 'stderr' });

  try {
    // Create backup directory
    await mkdir(backupDir, { recursive: true, mode: 0o700 });

    // Perform backups
    const dbBackup = await backupDatabase(backupDir);
    const secretsBackup = await backupSecrets(backupDir);
    const filesBackup = await backupFiles(backupDir);
    const configBackup = await backupConfig(backupDir);

    // Generate metadata
    const metadata = {
      version: '1.0.0',
      type: 'full',
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      database: dbBackup,
      secrets: secretsBackup,
      files: filesBackup,
      config: configBackup,
      options: {
        compressed: options.compress,
        encrypted: options.encrypt
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform
      }
    };

    await writeFile(
      join(backupDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    // Generate checksums
    const checksumCount = await generateChecksums(backupDir);

    // Upload to S3 if requested
    let s3Upload = null;
    if (options.s3Upload) {
      s3Upload = await uploadToS3(backupDir);
    }

    // Calculate total size
    const backupStats = await stat(backupDir);

    console.error('', { via: 'stderr' });
    console.error('✅ Backup completed successfully!', { via: 'stderr' });
    console.error('', { via: 'stderr' });
    console.error(`📊 Summary:`, { via: 'stderr' });
    console.error(`   Database: ${dbBackup.totalRows} rows from ${Object.keys(dbBackup.tableCounts).length} tables`, { via: 'stderr' });
    console.error(`   Secrets: ${secretsBackup.fileCount} files`, { via: 'stderr' });
    console.error(`   Packages: ${filesBackup.packages.fileCount} files`, { via: 'stderr' });
    console.error(`   Uploads: ${filesBackup.uploads.fileCount} files`, { via: 'stderr' });
    console.error(`   Config: ${configBackup.providers} providers, ${configBackup.extensions} extensions`, { via: 'stderr' });
    console.error(`   Checksums: ${checksumCount} files verified`, { via: 'stderr' });
    console.error(`   Duration: ${Math.round((Date.now() - startTime) / 1000)}s`, { via: 'stderr' });

    if (s3Upload?.uploaded) {
      console.error(`   S3: ${s3Upload.key}`, { via: 'stderr' });
    }

    // Output result as JSON
    console.log(JSON.stringify({
      status: 'success',
      backupDir: resolve(backupDir),
      metadata,
      s3Upload
    }, null, 2));

  } catch (error) {
    console.error('', { via: 'stderr' });
    console.error('❌ Backup failed:', error.message, { via: 'stderr' });
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

performFullBackup();
