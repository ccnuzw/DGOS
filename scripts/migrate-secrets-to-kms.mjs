#!/usr/bin/env node

/**
 * Migrate secrets from Redis/In-memory storage to KMS
 *
 * Usage:
 *   node scripts/migrate-secrets-to-kms.mjs --dry-run
 *   node scripts/migrate-secrets-to-kms.mjs --execute
 *   node scripts/migrate-secrets-to-kms.mjs --execute --verify
 */

import { createClient } from 'redis';
import { createKMSProvider, KMSSecretService } from '../packages/secret-service/src/index.ts';
import pg from 'pg';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isExecute = args.includes('--execute');
const shouldVerify = args.includes('--verify');

if (!isDryRun && !isExecute) {
  console.error('Error: Must specify --dry-run or --execute');
  process.exit(1);
}

class SecretMigration {
  constructor() {
    this.redis = null;
    this.kmsProvider = null;
    this.kmsService = null;
    this.db = null;
    this.results = {
      total: 0,
      migrated: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };
  }

  async init() {
    console.log('Initializing migration...');

    // Connect to Redis
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = createClient({ url: redisUrl });
    await this.redis.connect();
    console.log('✓ Connected to Redis');

    // Initialize KMS provider
    this.kmsProvider = createKMSProvider({
      provider: process.env.KMS_PROVIDER || 'vault',
      vaultAddress: process.env.VAULT_ADDR,
      vaultToken: process.env.VAULT_TOKEN,
      authMethod: process.env.VAULT_AUTH_METHOD,
      roleId: process.env.VAULT_ROLE_ID,
      secretId: process.env.VAULT_SECRET_ID,
    });
    await this.kmsProvider.init();
    console.log('✓ Connected to KMS');

    // Initialize KMS Secret Service
    this.kmsService = new KMSSecretService({ kmsProvider: this.kmsProvider });
    await this.kmsService.init();
    console.log('✓ Initialized KMS Secret Service');

    // Connect to database
    const { Pool } = pg;
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost/dgos',
    });
    console.log('✓ Connected to database');
  }

  async scanRedisSecrets() {
    console.log('\nScanning Redis for secrets...');
    const secrets = [];
    const keyPrefix = process.env.REDIS_KEY_PREFIX || 'dgos:secret:';

    let cursor = 0;
    do {
      const result = await this.redis.scan(cursor, {
        MATCH: `${keyPrefix}*`,
        COUNT: 100,
      });
      cursor = result.cursor;

      for (const key of result.keys) {
        const secretRef = key.replace(keyPrefix, '');
        const data = await this.redis.hGetAll(key);

        if (data.value || data.ciphertext) {
          secrets.push({
            secretRef,
            redisKey: key,
            data,
          });
        }
      }
    } while (cursor !== 0);

    console.log(`Found ${secrets.length} secrets in Redis`);
    return secrets;
  }

  async getProviderAccountsFromDB() {
    console.log('\nFetching provider accounts from database...');
    const result = await this.db.query(`
      SELECT
        account_id,
        owner_id,
        protocol_type,
        display_name,
        credential_ref,
        status,
        created_at
      FROM provider_accounts
      WHERE credential_ref IS NOT NULL
      ORDER BY created_at DESC
    `);

    console.log(`Found ${result.rows.length} provider accounts with credentials`);
    return result.rows;
  }

  async migrateSecret(secret) {
    const { secretRef, data } = secret;

    try {
      // Decrypt if encrypted
      let value = data.value;
      if (data.ciphertext && !value) {
        console.log(`  Warning: Encrypted secret found, but no decryption key available: ${secretRef}`);
        this.results.skipped++;
        return;
      }

      // Extract metadata
      const purpose = data.purpose || 'provider-account';
      const subjectId = data.subjectId || 'unknown';
      const ttlMs = 365 * 24 * 60 * 60 * 1000; // 1 year default

      if (isDryRun) {
        console.log(`  [DRY RUN] Would migrate: ${secretRef}`);
        console.log(`    Purpose: ${purpose}, Subject: ${subjectId}`);
        this.results.migrated++;
        return;
      }

      // Store in KMS
      await this.kmsService.put({
        secretRef,
        value,
        purpose,
        subjectId,
        ttlMs,
      });

      console.log(`  ✓ Migrated: ${secretRef}`);
      this.results.migrated++;
    } catch (error) {
      console.error(`  ✗ Failed to migrate ${secretRef}: ${error.message}`);
      this.results.failed++;
      this.results.errors.push({ secretRef, error: error.message });
    }
  }

  async migrateProviderCredentials(accounts) {
    console.log('\nMigrating provider account credentials...');

    for (const account of accounts) {
      const { account_id, owner_id, credential_ref, display_name } = account;

      try {
        // Check if credential exists in Redis
        const redisKey = `dgos:secret:${credential_ref}`;
        const exists = await this.redis.exists(redisKey);

        if (!exists) {
          console.log(`  Skipped: ${credential_ref} (not in Redis)`);
          this.results.skipped++;
          continue;
        }

        const data = await this.redis.hGetAll(redisKey);
        const value = data.value;

        if (!value) {
          console.log(`  Skipped: ${credential_ref} (no value)`);
          this.results.skipped++;
          continue;
        }

        if (isDryRun) {
          console.log(`  [DRY RUN] Would migrate: ${credential_ref} (${display_name})`);
          this.results.migrated++;
          continue;
        }

        // Store in KMS
        await this.kmsService.put({
          secretRef: credential_ref,
          value,
          purpose: 'provider-account',
          subjectId: owner_id,
          ttlMs: 365 * 24 * 60 * 60 * 1000,
        });

        console.log(`  ✓ Migrated: ${credential_ref} (${display_name})`);
        this.results.migrated++;
      } catch (error) {
        console.error(`  ✗ Failed to migrate ${credential_ref}: ${error.message}`);
        this.results.failed++;
        this.results.errors.push({
          secretRef: credential_ref,
          accountId: account_id,
          error: error.message
        });
      }
    }
  }

  async verifyMigration() {
    console.log('\nVerifying migration...');

    const accounts = await this.getProviderAccountsFromDB();
    let verified = 0;
    let missing = 0;

    for (const account of accounts) {
      try {
        const result = await this.kmsService.inspect(account.credential_ref);

        if (result.credentialState === 'available') {
          verified++;
        } else {
          console.log(`  ✗ Missing or unavailable: ${account.credential_ref}`);
          missing++;
        }
      } catch (error) {
        console.log(`  ✗ Verification failed for ${account.credential_ref}: ${error.message}`);
        missing++;
      }
    }

    console.log(`\nVerification Results:`);
    console.log(`  Verified: ${verified}`);
    console.log(`  Missing/Unavailable: ${missing}`);

    return { verified, missing };
  }

  async cleanupRedis() {
    if (isDryRun) {
      console.log('\n[DRY RUN] Would clean up Redis secrets');
      return;
    }

    console.log('\nCleaning up Redis secrets...');
    const keyPrefix = process.env.REDIS_KEY_PREFIX || 'dgos:secret:';

    let cursor = 0;
    let deleted = 0;

    do {
      const result = await this.redis.scan(cursor, {
        MATCH: `${keyPrefix}*`,
        COUNT: 100,
      });
      cursor = result.cursor;

      for (const key of result.keys) {
        await this.redis.del(key);
        deleted++;
      }
    } while (cursor !== 0);

    console.log(`Deleted ${deleted} keys from Redis`);
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'EXECUTE'}`);
    console.log(`Total secrets found: ${this.results.total}`);
    console.log(`Successfully migrated: ${this.results.migrated}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Skipped: ${this.results.skipped}`);

    if (this.results.errors.length > 0) {
      console.log('\nErrors:');
      for (const error of this.results.errors) {
        console.log(`  - ${error.secretRef}: ${error.error}`);
      }
    }

    console.log('='.repeat(60));
  }

  async run() {
    try {
      await this.init();

      // Get all provider accounts
      const accounts = await this.getProviderAccountsFromDB();
      this.results.total = accounts.length;

      // Migrate provider credentials
      await this.migrateProviderCredentials(accounts);

      // Verify if requested
      if (shouldVerify && isExecute) {
        await this.verifyMigration();
      }

      // Print summary
      this.printSummary();

      // Ask about cleanup
      if (isExecute && this.results.failed === 0) {
        console.log('\n⚠️  All secrets migrated successfully!');
        console.log('To clean up Redis secrets, run:');
        console.log('  node scripts/migrate-secrets-to-kms.mjs --cleanup');
      }

    } catch (error) {
      console.error('\n✗ Migration failed:', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async cleanup() {
    if (this.redis) await this.redis.quit();
    if (this.kmsProvider) await this.kmsProvider.close();
    if (this.db) await this.db.end();
  }
}

// Handle cleanup argument
if (args.includes('--cleanup')) {
  const migration = new SecretMigration();
  await migration.init();
  await migration.cleanupRedis();
  await migration.cleanup();
  process.exit(0);
}

// Run migration
const migration = new SecretMigration();
await migration.run();
