#!/usr/bin/env node
/**
 * DGOS V1 Migration Creation Tool
 * Generate a new database migration file
 *
 * Usage:
 *   node scripts/migration-create.mjs <migration-name> [options]
 *
 * Options:
 *   --type <type>    Migration type: schema, data, rollback (default: schema)
 *   --template       Use template for common operations
 *
 * Examples:
 *   node scripts/migration-create.mjs add_user_preferences
 *   node scripts/migration-create.mjs seed_initial_data --type=data
 */

import { readdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import pg from '../apps/api/node_modules/pg/lib/index.js';

const [,, migrationName, ...argsList] = process.argv;

if (!migrationName) {
  console.error('Usage: node scripts/migration-create.mjs <migration-name>');
  process.exit(1);
}

const options = {
  type: 'schema',
  template: false
};

for (let i = 0; i < argsList.length; i++) {
  const arg = argsList[i];
  if (arg === '--type' && argsList[i + 1]) {
    options.type = argsList[++i];
  } else if (arg === '--template') {
    options.template = true;
  }
}

const config = {
  dbUrl: process.env.DGOS_DATABASE_URL,
  migrationsDir: resolve('./migrations')
};

/**
 * Get next migration number
 */
async function getNextMigrationNumber() {
  try {
    const files = await readdir(config.migrationsDir);
    const migrationFiles = files.filter(f => /^\d{4}_.*\.sql$/.test(f));

    if (migrationFiles.length === 0) return '0001';

    const numbers = migrationFiles.map(f => parseInt(f.split('_')[0]));
    const maxNumber = Math.max(...numbers);

    return String(maxNumber + 1).padStart(4, '0');
  } catch (err) {
    return '0001';
  }
}

/**
 * Generate migration template
 */
function generateMigrationTemplate(number, name, type) {
  const timestamp = new Date().toISOString().split('T')[0];
  const formattedName = name.replace(/-/g, '_');

  if (type === 'schema') {
    return `-- Migration: ${number}_${formattedName}
-- Created: ${timestamp}
-- Type: Schema Change
-- Description: ${name.replace(/_/g, ' ')}

-- ============================================================
-- FORWARD MIGRATION
-- ============================================================

-- Example: Create new table
-- CREATE TABLE example_table (
--   id TEXT PRIMARY KEY,
--   name TEXT NOT NULL,
--   created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
-- );

-- Example: Add column
-- ALTER TABLE existing_table
--   ADD COLUMN new_column TEXT;

-- Example: Create index
-- CREATE INDEX idx_example ON example_table(name);

-- Add your schema changes here


-- ============================================================
-- BACKWARD MIGRATION (ROLLBACK)
-- ============================================================

-- Example: Drop table
-- DROP TABLE IF EXISTS example_table;

-- Example: Remove column
-- ALTER TABLE existing_table
--   DROP COLUMN new_column;

-- Example: Drop index
-- DROP INDEX IF EXISTS idx_example;

-- Add your rollback logic here

`;
  } else if (type === 'data') {
    return `-- Migration: ${number}_${formattedName}
-- Created: ${timestamp}
-- Type: Data Migration
-- Description: ${name.replace(/_/g, ' ')}

-- ============================================================
-- DATA MIGRATION
-- ============================================================

-- Example: Insert initial data
-- INSERT INTO example_table (id, name) VALUES
--   ('1', 'Example 1'),
--   ('2', 'Example 2')
-- ON CONFLICT (id) DO NOTHING;

-- Example: Update existing data
-- UPDATE example_table
-- SET status = 'active'
-- WHERE created_at < NOW() - INTERVAL '30 days';

-- Add your data migration here


-- ============================================================
-- ROLLBACK (if applicable)
-- ============================================================

-- Example: Remove inserted data
-- DELETE FROM example_table
-- WHERE id IN ('1', '2');

-- Add rollback logic if needed

`;
  } else {
    return `-- Migration: ${number}_${formattedName}
-- Created: ${timestamp}
-- Type: Custom
-- Description: ${name.replace(/_/g, ' ')}

-- Add your migration logic here

`;
  }
}

/**
 * Create migration file
 */
async function createMigration() {
  console.error('🚀 Creating migration...', { via: 'stderr' });

  try {
    const number = await getNextMigrationNumber();
    const formattedName = migrationName.replace(/ /g, '_').toLowerCase();
    const fileName = `${number}_${formattedName}.sql`;
    const filePath = join(config.migrationsDir, fileName);

    const content = generateMigrationTemplate(number, formattedName, options.type);

    await writeFile(filePath, content);

    console.error('', { via: 'stderr' });
    console.error('✅ Migration created successfully!', { via: 'stderr' });
    console.error('', { via: 'stderr' });
    console.error(`   File: ${filePath}`, { via: 'stderr' });
    console.error(`   Number: ${number}`, { via: 'stderr' });
    console.error(`   Type: ${options.type}`, { via: 'stderr' });
    console.error('', { via: 'stderr' });
    console.error('Next steps:', { via: 'stderr' });
    console.error(`   1. Edit ${fileName} to add your migration logic`, { via: 'stderr' });
    console.error('   2. Test with: pnpm migration:up --to=' + number, { via: 'stderr' });
    console.error('   3. Verify with: pnpm migration:status', { via: 'stderr' });

    console.log(JSON.stringify({
      status: 'success',
      migration: {
        number,
        name: formattedName,
        file: filePath,
        type: options.type
      }
    }, null, 2));

  } catch (error) {
    console.error('❌ Migration creation failed:', error.message, { via: 'stderr' });
    process.exit(1);
  }
}

createMigration();
