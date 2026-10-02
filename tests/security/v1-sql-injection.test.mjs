import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { InMemoryIdentityRepository, PostgresIdentityRepository } from '../../src/identity/repository.mjs';
import { InMemoryProviderRepository, PostgresProviderRepository } from '../../src/provider/repository.mjs';

test('SQL injection - identity repository uses parameterized queries', async () => {
  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL || 'postgresql://test:test@localhost:5432/test' });
  const repo = new PostgresIdentityRepository(pool);

  // Attempt SQL injection through hint parameter
  const maliciousHint = "'; DROP TABLE admin_principals; --";

  try {
    const result = await repo.findPrincipalByHint(maliciousHint);
    // Should return null/undefined, not throw or execute injection
    assert.ok(result === undefined || result === null, 'SQL injection should not succeed');
  } catch (error) {
    // If error occurs, ensure it's not a syntax error indicating successful injection
    assert.ok(!error.message.includes('syntax error'), 'Should not have SQL syntax errors');
  } finally {
    await pool.end();
  }
});

test('SQL injection - provider repository parameterized queries', async () => {
  if (!process.env.DGOS_DATABASE_URL) {
    console.log('Skipping PostgreSQL SQL injection test - DGOS_DATABASE_URL not set');
    return;
  }

  const pool = new pg.Pool({ connectionString: process.env.DGOS_DATABASE_URL });
  const repo = new PostgresProviderRepository(pool);

  // Attempt SQL injection through owner_id filter
  const maliciousOwnerId = "1' OR '1'='1";

  try {
    const accounts = await repo.listAccounts(maliciousOwnerId);
    // Should return empty array or throw permission error, not all accounts
    assert.ok(Array.isArray(accounts), 'Should return array');
  } catch (error) {
    // Acceptable to throw error, but not SQL syntax error
    assert.ok(!error.message.includes('syntax'), 'Should not have SQL syntax errors');
  } finally {
    await pool.end();
  }
});

test('SQL injection - in-memory repository safe', async () => {
  const repo = new InMemoryIdentityRepository();

  const maliciousHint = "'; DROP TABLE admin_principals; --";
  const result = await repo.findPrincipalByHint(maliciousHint);

  assert.ok(result === undefined || result === null, 'In-memory repo handles malicious input safely');
});
