# DGOS V1 Migration Guide

## Overview

This guide covers database schema migrations, data migrations between environments, and version upgrades for DGOS V1.

---

## Table of Contents

1. [Database Schema Migrations](#database-schema-migrations)
2. [Data Migrations Between Environments](#data-migrations-between-environments)
3. [Version Upgrade Procedures](#version-upgrade-procedures)
4. [Migration Best Practices](#migration-best-practices)
5. [Rollback Procedures](#rollback-procedures)

---

## Database Schema Migrations

### Creating Migrations

**Generate a new migration file:**

```bash
# Schema change migration
pnpm migrate:create add_notification_preferences

# This creates: migrations/0048_add_notification_preferences.sql
```

**Migration file structure:**

```sql
-- Migration: 0048_add_notification_preferences
-- Created: 2024-10-02
-- Type: Schema Change
-- Description: Add user notification preferences

-- ============================================================
-- FORWARD MIGRATION
-- ============================================================

-- Create notification preferences table
CREATE TABLE notification_preferences (
  principal_id TEXT PRIMARY KEY REFERENCES admin_principals(principal_id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT true,
  slack_enabled BOOLEAN DEFAULT false,
  notification_types TEXT[] DEFAULT ARRAY['system', 'security'],
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add index for common queries
CREATE INDEX idx_notification_prefs_email ON notification_preferences(principal_id, email_enabled);

-- Add trigger for updated_at
CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- BACKWARD MIGRATION (ROLLBACK)
-- ============================================================

-- Drop trigger
DROP TRIGGER IF EXISTS notification_preferences_updated_at ON notification_preferences;

-- Drop table
DROP TABLE IF EXISTS notification_preferences;
```

### Migration Types

#### 1. Schema Change Migration

**Adding a table:**

```sql
-- FORWARD
CREATE TABLE task_templates (
  template_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  template_config JSONB NOT NULL,
  created_by TEXT REFERENCES admin_principals(principal_id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ROLLBACK
DROP TABLE IF EXISTS task_templates;
```

**Adding a column:**

```sql
-- FORWARD
ALTER TABLE admin_principals
  ADD COLUMN last_login_at TIMESTAMPTZ;

CREATE INDEX idx_admin_principals_last_login 
  ON admin_principals(last_login_at);

-- ROLLBACK
DROP INDEX IF EXISTS idx_admin_principals_last_login;

ALTER TABLE admin_principals
  DROP COLUMN IF EXISTS last_login_at;
```

**Modifying a column:**

```sql
-- FORWARD
-- Add new column
ALTER TABLE provider_accounts
  ADD COLUMN display_name_v2 TEXT;

-- Migrate data
UPDATE provider_accounts
SET display_name_v2 = display_name;

-- Make it NOT NULL after data migration
ALTER TABLE provider_accounts
  ALTER COLUMN display_name_v2 SET NOT NULL;

-- Drop old column
ALTER TABLE provider_accounts
  DROP COLUMN display_name;

-- Rename new column
ALTER TABLE provider_accounts
  RENAME COLUMN display_name_v2 TO display_name;

-- ROLLBACK
-- Reverse the process
ALTER TABLE provider_accounts
  RENAME COLUMN display_name TO display_name_v2;

ALTER TABLE provider_accounts
  ADD COLUMN display_name TEXT;

UPDATE provider_accounts
SET display_name = display_name_v2;

ALTER TABLE provider_accounts
  ALTER COLUMN display_name SET NOT NULL;

ALTER TABLE provider_accounts
  DROP COLUMN display_name_v2;
```

#### 2. Data Migration

**Seed initial data:**

```sql
-- Migration: 0049_seed_default_policies
-- Type: Data Migration

-- FORWARD
INSERT INTO governance_policy (policy_id, policy_version, policy_document, state, created_at)
VALUES 
  ('default-rate-limit', 1, '{"maxRequests": 100, "windowSeconds": 60}', 'active', NOW()),
  ('default-quota', 1, '{"maxConcurrent": 10, "dailyLimit": 1000}', 'active', NOW())
ON CONFLICT (policy_id) DO NOTHING;

-- ROLLBACK
DELETE FROM governance_policy
WHERE policy_id IN ('default-rate-limit', 'default-quota');
```

**Data transformation:**

```sql
-- Migration: 0050_normalize_email_addresses
-- Type: Data Migration

-- FORWARD
-- Convert all email addresses to lowercase
UPDATE admin_principals
SET credential_ref = jsonb_set(
  credential_ref,
  '{email}',
  to_jsonb(lower(credential_ref->>'email'))
)
WHERE credential_ref ? 'email';

-- ROLLBACK
-- No automatic rollback for data transformations
-- Must restore from backup if needed
```

#### 3. Index Migration

```sql
-- Migration: 0051_optimize_audit_queries
-- Type: Index Optimization

-- FORWARD
-- Add composite index for common query pattern
CREATE INDEX idx_audit_events_principal_timestamp 
  ON audit_events(principal_id, event_timestamp DESC);

-- Add partial index for active sessions
CREATE INDEX idx_admin_sessions_active 
  ON admin_sessions(expires_at) 
  WHERE state = 'active';

-- ROLLBACK
DROP INDEX IF EXISTS idx_audit_events_principal_timestamp;
DROP INDEX IF EXISTS idx_admin_sessions_active;
```

### Migration Planning

**Review pending migrations:**

```bash
# Show migrations that would be applied
pnpm migrate:plan

# Show SQL that would be executed
pnpm migrate:sql

# Check migration status
pnpm migrate:check
```

### Applying Migrations

**Current implementation uses manual application:**

```bash
# 1. Review migration files
ls -l migrations/

# 2. Check which migrations are applied
DGOS_DATABASE_URL=$DB_URL \
psql -d dgos -c "SELECT * FROM dgos_schema_migrations ORDER BY applied_at DESC LIMIT 10;"

# 3. Apply migrations manually (for now)
DGOS_DATABASE_URL=$DB_URL \
psql -d dgos -f migrations/0048_add_notification_preferences.sql

# 4. Record migration
DGOS_DATABASE_URL=$DB_URL \
psql -d dgos -c "INSERT INTO dgos_schema_migrations (migration_version, applied_at) VALUES ('0048', NOW());"
```

**Recommended: Create migration runner (future enhancement):**

```bash
# Future commands:
pnpm migrate:up              # Apply all pending
pnpm migrate:up --to=0048    # Apply up to version
pnpm migrate:down            # Rollback last
pnpm migrate:down --to=0045  # Rollback to version
pnpm migrate:redo            # Rollback and reapply
```

---

## Data Migrations Between Environments

### Development to Staging

**Export from development:**

```bash
# Set development database URL
export DEV_DB_URL="postgresql://user:pass@dev-db:5432/dgos"

# Export users
DGOS_DATABASE_URL=$DEV_DB_URL \
pnpm export:users > dev-users.json

# Export configuration
DGOS_DATABASE_URL=$DEV_DB_URL \
pnpm export:config > dev-config.json

# Export packages metadata
DGOS_DATABASE_URL=$DEV_DB_URL \
pnpm export:packages > dev-packages.json
```

**Import to staging:**

```bash
# Set staging database URL
export STAGING_DB_URL="postgresql://user:pass@staging-db:5432/dgos"

# Import users
DGOS_DATABASE_URL=$STAGING_DB_URL \
pnpm import:data users dev-users.json

# Import configuration
DGOS_DATABASE_URL=$STAGING_DB_URL \
pnpm import:data config dev-config.json

# Import packages
DGOS_PACKAGE_ROOT=/var/lib/dgos-staging/packages \
DGOS_DATABASE_URL=$STAGING_DB_URL \
pnpm import:data packages dev-packages.json

# Verify integrity
DGOS_DATABASE_URL=$STAGING_DB_URL \
pnpm integrity:check
```

### Staging to Production

**Production migration checklist:**

- [ ] Create full backup of production
- [ ] Test migration in staging environment
- [ ] Schedule maintenance window
- [ ] Notify users of downtime
- [ ] Prepare rollback plan
- [ ] Have emergency contact list ready

**Production migration procedure:**

```bash
#!/bin/bash
# production-migration.sh

set -e

echo "================================"
echo "PRODUCTION MIGRATION"
echo "================================"

# Step 1: Pre-migration backup
echo "Step 1: Creating pre-migration backup..."
DGOS_DATABASE_URL=$PROD_DB_URL \
pnpm backup:full --compress --s3-upload

# Step 2: Stop services
echo "Step 2: Stopping services..."
systemctl stop dgos-api
systemctl stop dgos-worker

# Step 3: Apply migrations
echo "Step 3: Applying database migrations..."
for migration in migrations/0048_*.sql; do
  echo "Applying $migration..."
  DGOS_DATABASE_URL=$PROD_DB_URL \
  psql -d dgos -f "$migration"
done

# Step 4: Import data if needed
if [ -f "migration-data.json" ]; then
  echo "Step 4: Importing migration data..."
  DGOS_DATABASE_URL=$PROD_DB_URL \
  pnpm import:data config migration-data.json
fi

# Step 5: Verify integrity
echo "Step 5: Verifying data integrity..."
DGOS_DATABASE_URL=$PROD_DB_URL \
pnpm integrity:check

# Step 6: Restart services
echo "Step 6: Restarting services..."
systemctl start dgos-api
systemctl start dgos-worker

# Step 7: Smoke tests
echo "Step 7: Running smoke tests..."
sleep 10
curl -f http://localhost:8080/health || exit 1

echo "================================"
echo "MIGRATION COMPLETED SUCCESSFULLY"
echo "================================"
```

### Selective Data Migration

**Export specific data with filters:**

```bash
# Export only active users
DGOS_DATABASE_URL=$SOURCE_DB \
node scripts/data-export.mjs users \
  --filter="status=active" \
  --format=json \
  --output=active-users.json

# Export recent audit logs
DGOS_DATABASE_URL=$SOURCE_DB \
node scripts/data-export.mjs audit \
  --since="2024-09-01" \
  --format=json \
  --output=recent-audit.json

# Export specific provider accounts
DGOS_DATABASE_URL=$SOURCE_DB \
node scripts/data-export.mjs models \
  --filter="protocol_type=anthropic" \
  --format=json \
  --output=anthropic-providers.json
```

---

## Version Upgrade Procedures

### Minor Version Upgrade (e.g., 1.0.0 → 1.1.0)

**Pre-upgrade checklist:**

- [ ] Review CHANGELOG for breaking changes
- [ ] Create full backup
- [ ] Test upgrade in staging
- [ ] Update monitoring dashboards
- [ ] Prepare rollback plan

**Upgrade procedure:**

```bash
#!/bin/bash
# minor-version-upgrade.sh

set -e

NEW_VERSION="1.1.0"

echo "Upgrading DGOS to version $NEW_VERSION"

# 1. Backup current state
echo "Creating backup..."
cd /opt/dgos
DGOS_DATABASE_URL=$DB_URL pnpm backup:full --compress

# 2. Stop services
echo "Stopping services..."
systemctl stop dgos-api dgos-worker

# 3. Pull new version
echo "Pulling new version..."
git fetch --tags
git checkout "v${NEW_VERSION}"

# 4. Install dependencies
echo "Installing dependencies..."
pnpm install

# 5. Run migrations
echo "Running migrations..."
pnpm migrate:plan
# Review and apply migrations as needed

# 6. Rebuild applications
echo "Building applications..."
pnpm build

# 7. Restart services
echo "Restarting services..."
systemctl start dgos-api dgos-worker

# 8. Verify
echo "Verifying upgrade..."
sleep 10
curl -f http://localhost:8080/health
DGOS_DATABASE_URL=$DB_URL pnpm integrity:check

echo "Upgrade to $NEW_VERSION completed successfully"
```

### Major Version Upgrade (e.g., 1.x → 2.0.0)

**Major version upgrades may require:**

- Data format migrations
- Configuration changes
- API compatibility updates
- Client updates

**Follow specific upgrade guide for major versions.**

### Downgrade Procedure

**Downgrade to previous version:**

```bash
#!/bin/bash
# downgrade.sh

PREVIOUS_VERSION="1.0.0"

# 1. Stop services
systemctl stop dgos-api dgos-worker

# 2. Restore backup from before upgrade
DGOS_DATABASE_URL=$DB_URL \
node scripts/restore-full.mjs /path/to/pre-upgrade-backup --force

# 3. Checkout previous version
git checkout "v${PREVIOUS_VERSION}"
pnpm install
pnpm build

# 4. Restart services
systemctl start dgos-api dgos-worker
```

---

## Migration Best Practices

### Before Migration

1. **Always create a backup**
   ```bash
   pnpm backup:full --compress --s3-upload
   ```

2. **Test migrations in non-production environment first**
   - Development → Staging → Production

3. **Review migration SQL carefully**
   ```bash
   pnpm migrate:sql
   ```

4. **Check for blocking operations**
   - Locks on large tables
   - Long-running operations
   - Dependent applications

5. **Plan maintenance window**
   - Off-peak hours
   - Sufficient time buffer
   - Communication plan

### During Migration

1. **Use transactions when possible**
   ```sql
   BEGIN;
   -- migration operations
   COMMIT;
   ```

2. **Monitor progress**
   ```bash
   # In another terminal, watch database activity
   watch -n 5 'psql -d dgos -c "SELECT * FROM pg_stat_activity;"'
   ```

3. **Have rollback plan ready**
   - Backup restoration procedure
   - Rollback SQL scripts
   - Emergency contacts

4. **Document everything**
   - Commands executed
   - Issues encountered
   - Resolution steps

### After Migration

1. **Verify data integrity**
   ```bash
   pnpm integrity:check
   pnpm validate:data
   ```

2. **Run smoke tests**
   ```bash
   curl http://localhost:8080/health
   # Additional API tests
   ```

3. **Monitor application logs**
   ```bash
   journalctl -u dgos-api -f
   journalctl -u dgos-worker -f
   ```

4. **Update documentation**
   - Record migration completion
   - Document any issues
   - Update runbooks

5. **Notify stakeholders**
   - Migration completion
   - Any issues encountered
   - Next steps

---

## Rollback Procedures

### Immediate Rollback (< 1 hour)

**If migration fails immediately:**

```bash
# 1. Stop services
systemctl stop dgos-api dgos-worker

# 2. Restore from backup
DGOS_DATABASE_URL=$DB_URL \
node scripts/restore-full.mjs /path/to/pre-migration-backup --force

# 3. Restart services
systemctl start dgos-api dgos-worker

# 4. Verify
curl http://localhost:8080/health
```

### Delayed Rollback (> 1 hour)

**If issues discovered after migration:**

```bash
# 1. Assess data written since migration
DGOS_DATABASE_URL=$DB_URL \
node scripts/data-export.mjs audit \
  --since="<migration-time>" \
  --output=post-migration-activity.json

# 2. Create backup of current state
DGOS_DATABASE_URL=$DB_URL \
pnpm backup:full --output=/tmp/current-state-backup

# 3. Stop services
systemctl stop dgos-api dgos-worker

# 4. Restore pre-migration backup
DGOS_DATABASE_URL=$DB_URL \
node scripts/restore-full.mjs /path/to/pre-migration-backup --force

# 5. Optionally replay critical operations
# (Manual process based on audit logs)

# 6. Restart services
systemctl start dgos-api dgos-worker
```

### Migration Rollback SQL

**For reversible schema changes:**

```sql
-- Execute rollback section from migration file

-- Example: migrations/0048_add_notification_preferences.sql
-- Run only the ROLLBACK section:

BEGIN;

DROP TRIGGER IF EXISTS notification_preferences_updated_at ON notification_preferences;
DROP TABLE IF EXISTS notification_preferences;

-- Remove migration record
DELETE FROM dgos_schema_migrations WHERE migration_version = '0048';

COMMIT;
```

### Post-Rollback Verification

```bash
# 1. Check migration status
DGOS_DATABASE_URL=$DB_URL \
psql -d dgos -c "SELECT * FROM dgos_schema_migrations ORDER BY applied_at DESC LIMIT 5;"

# 2. Verify data integrity
DGOS_DATABASE_URL=$DB_URL pnpm integrity:check

# 3. Test critical functionality
# Run integration tests or manual verification
```

---

## Troubleshooting

### Common Migration Issues

#### Issue: Migration fails mid-execution

**Solution:**
```bash
# Check database for partial changes
psql -d dgos -c "\dt"  # List tables
psql -d dgos -c "\d table_name"  # Describe table

# If in transaction, it should auto-rollback
# Otherwise, manually clean up and restore from backup
```

#### Issue: Migration succeeds but application breaks

**Solution:**
```bash
# Check application logs
journalctl -u dgos-api -n 100

# Verify configuration compatibility
cat /opt/dgos/config/production.json

# If config issue, update config and restart
# If code issue, rollback to previous version
```

#### Issue: Migration too slow / times out

**Solution:**
```sql
-- For large table alterations, use concurrent operations
ALTER TABLE large_table ADD COLUMN new_col TEXT;  -- May lock table

-- Instead, use:
CREATE INDEX CONCURRENTLY idx_large_table_new ON large_table(new_col);

-- Or break into smaller batches:
UPDATE large_table SET new_col = 'value' WHERE id >= 1 AND id < 1000;
UPDATE large_table SET new_col = 'value' WHERE id >= 1000 AND id < 2000;
-- etc.
```

#### Issue: Conflicting migrations between branches

**Solution:**
```bash
# Check migration numbers
ls -l migrations/

# If duplicate numbers, renumber newer migration
mv migrations/0048_feature_a.sql migrations/0049_feature_a.sql

# Update migration content to reflect new number
sed -i 's/0048/0049/g' migrations/0049_feature_a.sql
```

---

## Additional Resources

- [Data Management Guide](./DATA-MANAGEMENT-GUIDE.md)
- [Backup and Restore Procedures](./BACKUP-RESTORE-PROCEDURES.md)
- [Production Operations](./PRODUCTION-OPS.md)

---

**Document Version:** 1.0.0  
**Last Updated:** 2024-10-02  
**Next Review:** 2025-01-02
