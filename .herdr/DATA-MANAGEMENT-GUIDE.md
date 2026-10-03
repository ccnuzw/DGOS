# DGOS V1 Data Management Guide

## Overview

DGOS V1 includes comprehensive data management tools for backup, restore, migration, export/import, cleanup, and integrity checking. This guide covers all data management operations.

## Table of Contents

1. [Backup and Restore](#backup-and-restore)
2. [Data Export and Import](#data-export-and-import)
3. [Database Migrations](#database-migrations)
4. [Data Cleanup](#data-cleanup)
5. [Data Integrity Checks](#data-integrity-checks)
6. [Best Practices](#best-practices)

---

## Backup and Restore

### Full Backup

Create a complete backup of your DGOS instance including database, files, secrets, and configuration.

```bash
# Basic full backup
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
pnpm backup:full

# Backup with compression
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
node scripts/backup-full.mjs --compress

# Backup with encryption (requires BACKUP_ENCRYPTION_KEY)
BACKUP_ENCRYPTION_KEY=your-256-bit-hex-key \
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
node scripts/backup-full.mjs --encrypt --compress

# Backup with S3 upload
AWS_S3_BUCKET=my-backup-bucket \
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
node scripts/backup-full.mjs --compress --s3-upload

# Custom output directory
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
node scripts/backup-full.mjs --output /mnt/backups/dgos-backup-manual
```

**Environment Variables:**
- `DGOS_DATABASE_URL` - PostgreSQL connection string (required)
- `DGOS_PACKAGE_ROOT` - Package files directory (default: `/var/lib/dgos/packages`)
- `DGOS_SECRETS_DIR` - Secrets directory (default: `/var/lib/dgos/secrets`)
- `DGOS_UPLOAD_DIR` - User uploads directory (default: `/var/lib/dgos/uploads`)
- `BACKUP_ENCRYPTION_KEY` - 256-bit hex key for encryption (optional)
- `AWS_S3_BUCKET` - S3 bucket for remote backup (optional)

**Backup Contents:**
- `metadata.json` - Backup metadata and statistics
- `database.sql` - PostgreSQL dump (or `database.sql.gz` if compressed)
- `secrets/` - Secret files and credentials
- `packages/` - Application package files
- `uploads/` - User-uploaded files
- `config.json` - Configuration data
- `checksum.txt` - File integrity checksums

### Incremental Backup

Create an incremental backup of changes since the last full or incremental backup.

```bash
# Automatic incremental (uses last backup as reference)
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
pnpm backup:incremental

# Specify reference backup
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
node scripts/backup-incremental.mjs --since ./backups/dgos-backup-2024-10-02/metadata.json

# Compressed incremental backup
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
node scripts/backup-incremental.mjs --compress
```

**Incremental Backup Contents:**
- `metadata.json` - Incremental backup metadata
- `changes.json` - Database changes since reference
- `packages/` - New/modified package files
- `uploads/` - New/modified uploads

### Restore from Backup

Restore a complete backup to your DGOS instance.

```bash
# Validate backup without restoring
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
node scripts/restore-full.mjs ./backups/dgos-backup-2024-10-02 --validate-only

# Full restore with confirmation prompt
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
pnpm restore:full ./backups/dgos-backup-2024-10-02

# Force restore without confirmation
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
node scripts/restore-full.mjs ./backups/dgos-backup-2024-10-02 --force

# Partial restore (skip certain components)
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
node scripts/restore-full.mjs ./backups/dgos-backup-2024-10-02 --skip-files

# Available skip options:
# --skip-database    Skip database restore
# --skip-files       Skip file restore
# --skip-secrets     Skip secrets restore
```

**⚠️ Warning:** Restore operations overwrite current data. Always validate the backup first and confirm you have a recent backup before restoring.

### Backup Strategy

**Recommended Schedule:**
- **Full backup:** Weekly (Sunday 2:00 AM)
- **Incremental backup:** Daily (2:00 AM)
- **Pre-deployment backup:** Before each production deployment

**Retention Policy:**
- Last 7 days: Keep all daily backups
- Last 4 weeks: Keep weekly full backups
- Beyond 4 weeks: Keep monthly full backups
- Minimum retention: 90 days for compliance

**Example Cron Jobs:**

```bash
# Full backup every Sunday at 2 AM
0 2 * * 0 cd /app && DGOS_DATABASE_URL=$DB_URL pnpm backup:full --compress --s3-upload

# Incremental backup daily at 2 AM (except Sunday)
0 2 * * 1-6 cd /app && DGOS_DATABASE_URL=$DB_URL pnpm backup:incremental --compress

# Cleanup old backups (keep last 30 days locally)
0 3 * * * find /app/backups -type d -name "dgos-*" -mtime +30 -exec rm -rf {} +
```

---

## Data Export and Import

### Export Data

Export data in various formats (JSON, CSV, YAML, SQL) with filtering support.

```bash
# Export audit logs since a specific date
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
pnpm export:data audit --since="2024-10-01" --format=json --output=audit.json

# Export users as CSV
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
pnpm export:data users --format=csv --output=users.csv

# Export with filters
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
node scripts/data-export.mjs audit --filter="principal_id=admin123" --limit=1000

# Export specific fields only
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
node scripts/data-export.mjs users --fields=principal_id,status,created_at --format=json

# Stream large datasets
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
node scripts/data-export.mjs audit --stream --output=large-audit.json

# Export all entities
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
node scripts/data-export.mjs all --format=json --output=full-export.json --pretty
```

**Available Entities:**
- `tasks` - Task/reservation records
- `users` - Admin principals and sessions
- `audit` - Audit event logs
- `models` - Provider accounts and configurations
- `config` - Extension registry and system config
- `packages` - Application packages
- `all` - All entities combined

**Export Formats:**
- `json` - JSON format (default)
- `csv` - Comma-separated values
- `yaml` - YAML format
- `sql` - SQL INSERT statements

### Legacy Export Scripts

For backward compatibility, legacy export scripts are available:

```bash
# Export users
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
pnpm export:users > users-export.json

# Export configuration
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
pnpm export:config > config-export.json

# Export packages
DGOS_PACKAGE_ROOT=/var/lib/dgos/packages \
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
pnpm export:packages > packages-export.json
```

### Import Data

Import data from exported files.

```bash
# Import users
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
pnpm import:data users ./users-export.json

# Import configuration
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
pnpm import:data config ./config-export.json

# Import packages (metadata only, files must be restored separately)
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
DGOS_PACKAGE_ROOT=/var/lib/dgos/packages \
pnpm import:data packages ./packages-export.json
```

**Import Behavior:**
- Uses `ON CONFLICT` clauses to handle duplicates
- Updates existing records with matching IDs
- Wrapped in transactions for atomicity
- Returns import statistics on completion

### Data Validation

Validate data integrity after import or migration.

```bash
# Full validation
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
pnpm validate:data

# Validation checks:
# - Referential integrity (orphaned records)
# - Required data presence
# - Table structure completeness
# - Index availability
# - Data consistency
```

---

## Database Migrations

### Create Migration

Generate a new migration file with template.

```bash
# Create schema migration
pnpm migrate:create add_user_preferences

# Create data migration
node scripts/migration-create.mjs seed_initial_data --type=data

# Create custom migration
node scripts/migration-create.mjs custom_operation --type=custom
```

**Migration File Structure:**
```sql
-- Migration: 0048_add_user_preferences
-- Created: 2024-10-02
-- Type: Schema Change
-- Description: add user preferences

-- ============================================================
-- FORWARD MIGRATION
-- ============================================================

CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES admin_principals(principal_id),
  theme TEXT DEFAULT 'auto',
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- BACKWARD MIGRATION (ROLLBACK)
-- ============================================================

DROP TABLE IF EXISTS user_preferences;
```

### Apply Migrations

```bash
# Plan migrations (show what would be applied)
pnpm migrate:plan

# Print SQL without applying
pnpm migrate:sql

# Check migration status
pnpm migrate:check

# Apply migrations (would require migration manager script)
# Note: Current setup uses migrate.mjs for planning
# Production migrations should be applied carefully with backups
```

### Migration Best Practices

1. **Always test migrations** in a development environment first
2. **Create a backup** before applying migrations to production
3. **Write rollback logic** for all schema changes
4. **Keep migrations small** and focused on one change
5. **Document breaking changes** in migration comments
6. **Test rollback procedure** before deploying

---

## Data Cleanup

Remove old data based on retention policies.

```bash
# Dry run - see what would be deleted
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
node scripts/data-cleanup.mjs all --older-than=30 --dry-run

# Clean up completed tasks older than 90 days
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
pnpm cleanup:data tasks --older-than=90

# Clean up audit logs older than 365 days (1 year)
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
pnpm cleanup:data audit --older-than=365 --confirm

# Clean up expired sessions
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
pnpm cleanup:data sessions --confirm

# Clean up all entities
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
node scripts/data-cleanup.mjs all --older-than=30
```

**Cleanup Targets:**
- `tasks` - Completed, failed, and cancelled tasks
- `audit` - Audit event logs
- `sessions` - Expired admin sessions
- `all` - All of the above

**Recommended Retention:**
- Tasks: 90 days for completed/failed/cancelled
- Audit logs: 365 days (or per compliance requirements)
- Sessions: Clean immediately after expiry

**⚠️ Warning:** Cleanup operations are permanent. Always run with `--dry-run` first to preview deletions.

---

## Data Integrity Checks

Verify and optionally fix data integrity issues.

```bash
# Run integrity checks
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
pnpm integrity:check

# Run with auto-fix enabled
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
node scripts/data-integrity-check.mjs --auto-fix

# Generate detailed report
DGOS_DATABASE_URL=postgres://user:pass@localhost:5432/dgos \
node scripts/data-integrity-check.mjs --report=integrity-report.json --verbose
```

**Integrity Checks:**

1. **Orphaned Records**
   - Sessions without valid principals
   - API keys without valid owners
   - Provider bindings without accounts
   - Connection tests without accounts

2. **Duplicate Records**
   - Duplicate primary keys (should be prevented by constraints)
   - Redundant data entries

3. **Data Consistency**
   - Invalid version numbers
   - Expired sessions still marked active
   - Expired API keys still active
   - Mismatched state transitions

4. **Constraints**
   - At least one active admin principal
   - Required migrations applied
   - Critical tables present

**Auto-Fix Capabilities:**

The `--auto-fix` flag automatically resolves these issues:
- ✅ Delete orphaned sessions
- ✅ Delete orphaned API keys
- ✅ Delete orphaned bindings
- ✅ Fix invalid version numbers
- ✅ Mark expired sessions as expired
- ✅ Mark expired API keys as expired

**Issue Severity:**
- `critical` - System integrity compromised
- `high` - Data integrity issues requiring immediate attention
- `medium` - Issues that should be resolved soon
- `low` - Minor issues, cleanup recommended
- `warning` - Informational, no action required

---

## Best Practices

### Production Deployment Checklist

Before deploying to production:

1. **Create full backup**
   ```bash
   pnpm backup:full --compress --s3-upload
   ```

2. **Validate backup**
   ```bash
   node scripts/restore-full.mjs ./backups/latest --validate-only
   ```

3. **Check data integrity**
   ```bash
   pnpm integrity:check
   ```

4. **Plan migrations**
   ```bash
   pnpm migrate:plan
   ```

5. **Test in staging** with backup data

6. **Deploy to production**

7. **Verify post-deployment**
   ```bash
   pnpm integrity:check
   pnpm validate:data
   ```

### Disaster Recovery Procedure

1. **Assess the situation**
   - What data is affected?
   - When did the issue occur?
   - Which backup to use?

2. **Stop the application**
   ```bash
   systemctl stop dgos-api dgos-worker
   ```

3. **Restore from backup**
   ```bash
   # Validate backup first
   node scripts/restore-full.mjs ./backups/dgos-backup-2024-10-02 --validate-only
   
   # Restore
   node scripts/restore-full.mjs ./backups/dgos-backup-2024-10-02 --force
   ```

4. **Verify restoration**
   ```bash
   pnpm integrity:check
   pnpm validate:data
   ```

5. **Restart application**
   ```bash
   systemctl start dgos-api dgos-worker
   ```

6. **Monitor logs** for errors

### Data Security

1. **Encrypt backups** containing sensitive data
   ```bash
   BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32)
   node scripts/backup-full.mjs --encrypt --compress
   ```

2. **Store encryption keys securely** (not in the backup itself)

3. **Use S3 bucket encryption** for remote backups

4. **Restrict backup directory permissions**
   ```bash
   chmod 700 /var/lib/dgos/backups
   ```

5. **Regular security audits**
   ```bash
   pnpm test:security
   ```

### Monitoring and Alerts

Set up monitoring for:

- **Backup age:** Alert if last successful backup > 24 hours
- **Backup failures:** Alert on any backup script failures
- **Database size:** Alert at 80% of quota
- **Integrity check failures:** Alert on high/critical issues
- **Cleanup failures:** Monitor cleanup job execution

### Performance Optimization

1. **Run backups during low-traffic periods** (e.g., 2 AM)

2. **Use incremental backups** for daily backups

3. **Use streaming exports** for large datasets
   ```bash
   node scripts/data-export.mjs audit --stream --output=large-audit.json
   ```

4. **Regular cleanup** to maintain database performance
   ```bash
   # Weekly cleanup cron job
   0 3 * * 0 cd /app && pnpm cleanup:data all --older-than=90 --confirm
   ```

5. **Archive old data** before deletion if needed for compliance

### Compliance Considerations

1. **Data retention policies**
   - Audit logs: Typically 1-7 years depending on regulations
   - Personal data: Follow GDPR/privacy requirements
   - Financial data: Follow industry-specific requirements

2. **Backup retention**
   - Maintain backups for compliance periods
   - Document backup and retention procedures

3. **Data export capabilities**
   - Support data subject access requests (GDPR)
   - Provide data portability

4. **Audit trail**
   - All data operations are logged in audit_events
   - Export audit logs regularly for compliance
   ```bash
   pnpm export:data audit --format=json --output=audit-$(date +%Y-%m).json
   ```

---

## Troubleshooting

### Backup Issues

**Issue:** Backup fails with "pg_dump: command not found"

**Solution:** Install PostgreSQL client tools
```bash
# Ubuntu/Debian
apt-get install postgresql-client

# macOS
brew install postgresql
```

**Issue:** Backup is too large

**Solution:** Use compression and incremental backups
```bash
pnpm backup:incremental --compress
```

### Restore Issues

**Issue:** Restore fails with version mismatch

**Solution:** Check migration compatibility or use backup from matching version

**Issue:** Permission denied accessing secrets

**Solution:** Ensure proper file permissions
```bash
chmod 700 /var/lib/dgos/secrets
```

### Export Issues

**Issue:** Out of memory during large export

**Solution:** Use streaming mode
```bash
node scripts/data-export.mjs audit --stream --output=audit.json
```

### Integrity Check Issues

**Issue:** Many orphaned records found

**Solution:** Run with auto-fix after review
```bash
pnpm integrity:check --auto-fix
```

---

## Additional Resources

- [Backup and Restore Procedures](./BACKUP-RESTORE-PROCEDURES.md)
- [Migration Guide](./MIGRATION-GUIDE.md)
- [Security Best Practices](./SECURITY.md)
- [Production Operations](./PRODUCTION-OPS.md)

---

**Document Version:** 1.0.0  
**Last Updated:** 2024-10-02  
**Maintained by:** DGOS DevOps Team
