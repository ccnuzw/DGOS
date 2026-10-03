#!/usr/bin/env node

/**
 * KMS Health Check Script
 *
 * Verifies KMS connectivity and performs basic operations
 */

import { createKMSProvider } from '../packages/secret-service/src/index.ts';
import { loadKMSConfig } from '../src/security/kms-config.mjs';

async function healthCheck() {
  console.log('='.repeat(60));
  console.log('KMS Health Check');
  console.log('='.repeat(60));
  console.log();

  try {
    // Load configuration
    console.log('Loading KMS configuration...');
    const config = loadKMSConfig();
    console.log(`✓ Provider: ${config.provider}`);

    if (config.provider === 'vault') {
      console.log(`✓ Vault Address: ${config.vaultAddress}`);
      console.log(`✓ Auth Method: ${config.vaultAuthMethod}`);
      console.log(`✓ Mount Path: ${config.vaultMountPath}`);
    }
    console.log();

    // Initialize provider
    console.log('Initializing KMS provider...');
    const provider = createKMSProvider(config);
    await provider.init();
    console.log('✓ KMS provider initialized');
    console.log();

    // Health check
    console.log('Checking KMS health...');
    const health = await provider.healthCheck();

    if (health.available) {
      console.log('✓ KMS is available');
      if (health.latencyMs !== undefined) {
        console.log(`✓ Latency: ${health.latencyMs}ms`);
      }
      if (health.keyId) {
        console.log(`✓ Key ID: ${health.keyId}`);
      }
    } else {
      console.error('✗ KMS is unavailable');
      if (health.error) {
        console.error(`  Error: ${health.error}`);
      }
      process.exit(1);
    }
    console.log();

    // Test encryption
    console.log('Testing encryption...');
    const testPlaintext = 'test-health-check-value';
    const testContext = { purpose: 'health-check', test: 'true' };

    const startEncrypt = Date.now();
    const encrypted = await provider.encrypt(testPlaintext, testContext);
    const encryptDuration = Date.now() - startEncrypt;

    console.log(`✓ Encryption successful (${encryptDuration}ms)`);
    console.log();

    // Test decryption
    console.log('Testing decryption...');
    const startDecrypt = Date.now();
    const decrypted = await provider.decrypt(encrypted, testContext);
    const decryptDuration = Date.now() - startDecrypt;

    if (decrypted === testPlaintext) {
      console.log(`✓ Decryption successful (${decryptDuration}ms)`);
    } else {
      console.error('✗ Decryption failed - value mismatch');
      process.exit(1);
    }
    console.log();

    // Test secret storage
    console.log('Testing secret storage...');
    const testSecretKey = `health-check-${Date.now()}`;
    const testSecretValue = 'health-check-secret-value';

    const startStore = Date.now();
    const ref = await provider.storeSecret(testSecretKey, testSecretValue, {
      purpose: 'health-check',
      ttlSeconds: 300, // 5 minutes
      tags: { test: 'true' },
    });
    const storeDuration = Date.now() - startStore;

    console.log(`✓ Secret stored (${storeDuration}ms)`);
    console.log(`  Path: ${ref.path}`);
    console.log(`  Version: ${ref.version}`);
    console.log();

    // Test secret retrieval
    console.log('Testing secret retrieval...');
    const startRetrieve = Date.now();
    const retrieved = await provider.retrieveSecret(ref);
    const retrieveDuration = Date.now() - startRetrieve;

    if (retrieved.value === testSecretValue) {
      console.log(`✓ Secret retrieved (${retrieveDuration}ms)`);
    } else {
      console.error('✗ Secret retrieval failed - value mismatch');
      process.exit(1);
    }
    console.log();

    // Clean up test secret
    console.log('Cleaning up test secret...');
    await provider.deleteSecret(ref, true);
    console.log('✓ Test secret deleted');
    console.log();

    // Summary
    console.log('='.repeat(60));
    console.log('Health Check Summary');
    console.log('='.repeat(60));
    console.log(`Provider: ${config.provider}`);
    console.log(`Status: ✓ HEALTHY`);
    console.log(`Encryption: ${encryptDuration}ms`);
    console.log(`Decryption: ${decryptDuration}ms`);
    console.log(`Store Secret: ${storeDuration}ms`);
    console.log(`Retrieve Secret: ${retrieveDuration}ms`);
    console.log('='.repeat(60));

    await provider.close();
    process.exit(0);

  } catch (error) {
    console.error();
    console.error('='.repeat(60));
    console.error('Health Check Failed');
    console.error('='.repeat(60));
    console.error(`Error: ${error.message}`);
    if (error.stack) {
      console.error();
      console.error('Stack trace:');
      console.error(error.stack);
    }
    console.error('='.repeat(60));
    process.exit(1);
  }
}

// Run health check
healthCheck();
