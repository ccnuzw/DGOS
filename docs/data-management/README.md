# DGOS V1 Data Management Tools

## Quick Start

```bash
# Full backup
pnpm backup:full

# Restore from backup
pnpm restore:full ./backups/dgos-backup-2024-10-02

# Check data integrity
pnpm integrity:check

# Export data
pnpm export:data audit --since="2024-10-01" --format=json

# Cleanup old data
pnpm cleanup:data tasks --older-than=90 --dry-run
```

## Available Tools

### Backup and Restore

| Command | Description |
|---------|-------------|
| `pnpm backup:full` | Create complete backup (database, files, secrets) |
| `pnpm backup:incremental` | Create incremental backup since last backup |
| `pnpm backup:database` | Export database configuration only |
| `pnpm restore:full <dir>` | Restore complete backup |

### Data Export and Import

| Command | Description |
|---------|-------------|
| `pnpm export:users` | Export user data (principals, sessions, API keys) |
| `pnpm export:config` | Export configuration (providers, bindings, extensions) |
| `pnpm export:packages` | Export package metadata |
| `pnpm export:data <entity>` | Export data with filters and format options |
| `pnpm import:data <type> <file>` | Import data (users, config, packages) |

### Data Management

| Command | Description |
|---------|-------------|
| `pnpm migrate:create <name>` | Create new database migration |
| `pnpm migrate:plan` | Preview pending migrations |
| `pnpm migrate:check` | Check migration status |
| `pnpm validate:data` | Validate data integrity |
| `pnpm integrity:check` | Check and optionally fix integrity issues |
| `pnpm cleanup:data <entity>` | Clean up old data |

## Tool Details

### backup-full.mjs

Create complete system backup including database, files, secrets, and configuration.

**Features:**
- PostgreSQL database dump
- File and upload backup
- Secret encryption support
- S3 upload capability
- Checksum verification
- Compressed backups

**Usage:**
```bash
# Basic backup
DGOS_DATABASE_URL=postgres://... pnpm backup:full

# With compression and S3 upload
DGOS_DATABASE_URL=postgres://... \
AWS_S3_BUCKET=my-bucket \
node scripts/backup-full.mjs --compress --s3-upload

# With encryption
BACKUP_ENCRYPTION_KEY=your-256-bit-hex-key \
DGOS_DATABASE_URL=postgres://... \
node scripts/backup-full.mjs --encrypt --compress
```

**Options:**
- `--output <dir>` - Custom backup directory
- `--compress` - Compress backup with gzip
- `--encrypt` - Encrypt sensitive data
- `--s3-upload` - Upload to S3 after backup

### backup-incremental.mjs

Create incremental backup of changes since last full/incremental backup.

**Features:**
- Tracks database changes by timestamp
- Identifies new/modified files
- Links to reference backup
- Smaller backup size

**Usage:**
```bash
# Automatic (uses last backup as reference)
DGOS_DATABASE_URL=postgres://... pnpm backup:incremental

# Specify reference backup
DGOS_DATABASE_URL=postgres://... \
node scripts/backup-incremental.mjs \
  --since ./backups/dgos-backup-2024-10-02/metadata.json
```

### restore-full.mjs

Restore complete backup to system.

**Features:**
- Backup validation before restore
- Checksum verification
- Confirmation prompt
- Partial restore options
- Database decompression

**Usage:**
```bash
# Validate only
DGOS_DATABASE_URL=postgres://... \
node scripts/restore-full.mjs ./backups/dgos-backup-2024-10-02 --validate-only

# Full restore with confirmation
DGOS_DATABASE_URL=postgres://... \
pnpm restore:full ./backups/dgos-backup-2024-10-02

# Skip confirmation
DGOS_DATABASE_URL=postgres://... \
node scripts/restore-full.mjs ./backups/dgos-backup-2024-10-02 --force

# Partial restore
DGOS_DATABASE_URL=postgres://... \
node scripts/restore-full.mjs ./backups/dgos-backup-2024-10-02 \
  --skip-files --skip-secrets
```

**Options:**
- `--validate-only` - Validate backup without restoring
- `--skip-database` - Skip database restore
- `--skip-files` - Skip file restore
- `--skip-secrets` - Skip secrets restore
- `--force` - Skip confirmation prompt

### data-export.mjs

Export data in various formats with filtering support.

**Features:**
- Multiple export formats (JSON, CSV, YAML, SQL)
- Date range filtering
- Custom field selection
- Streaming for large datasets
- Limit and pagination

**Usage:**
```bash
# Export audit logs
DGOS_DATABASE_URL=postgres://... \
pnpm export:data audit --since="2024-10-01" --format=json

# Export as CSV
DGOS_DATABASE_URL=postgres://... \
node scripts/data-export.mjs users --format=csv --output=users.csv

# Export with filters
DGOS_DATABASE_URL=postgres://... \
node scripts/data-export.mjs audit \
  --filter="principal_id=admin123" \
  --limit=1000

# Stream large dataset
DGOS_DATABASE_URL=postgres://... \
node scripts/data-export.mjs audit --stream --output=large-audit.json
```

**Entities:**
- `tasks` - Task/reservation records
- `users` - Admin principals
- `audit` - Audit event logs
- `models` - Provider accounts
- `config` - System configuration
- `packages` - Application packages
- `all` - All entities

**Options:**
- `--format <format>` - json, csv, yaml, sql
- `--output <file>` - Output file (default: stdout)
- `--since <date>` - Filter by date
- `--until <date>` - Filter by date
- `--filter <key=value>` - Custom filters
- `--fields <field,field>` - Select specific fields
- `--limit <number>` - Limit records
- `--stream` - Use streaming mode
- `--pretty` - Pretty-print JSON

### data-integrity-check.mjs

Check data integrity and optionally fix issues.

**Features:**
- Orphaned record detection
- Duplicate checking
- Data consistency validation
- Constraint verification
- Auto-fix capability
- Detailed reporting

**Usage:**
```bash
# Check integrity
DGOS_DATABASE_URL=postgres://... pnpm integrity:check

# Auto-fix issues
DGOS_DATABASE_URL=postgres://... \
node scripts/data-integrity-check.mjs --auto-fix

# Generate detailed report
DGOS_DATABASE_URL=postgres://... \
node scripts/data-integrity-check.mjs \
  --report=integrity-report.json \
  --verbose
```

**Checks:**
- Orphaned sessions, API keys, bindings
- Duplicate primary keys
- Invalid version numbers
- Expired sessions still active
- Constraint violations

**Options:**
- `--auto-fix` - Automatically fix fixable issues
- `--report <file>` - Save detailed report
- `--verbose` - Show detailed information

### data-cleanup.mjs

Clean up old data based on retention policies.

**Features:**
- Configurable retention periods
- Dry-run mode
- Confirmation prompts
- Multiple entity support
- Transaction safety

**Usage:**
```bash
# Dry run
DGOS_DATABASE_URL=postgres://... \
node scripts/data-cleanup.mjs all --older-than=30 --dry-run

# Clean tasks
DGOS_DATABASE_URL=postgres://... \
pnpm cleanup:data tasks --older-than=90

# Clean audit logs
DGOS_DATABASE_URL=postgres://... \
pnpm cleanup:data audit --older-than=365 --confirm

# Clean all
DGOS_DATABASE_URL=postgres://... \
node scripts/data-cleanup.mjs all --older-than=30
```

**Entities:**
- `tasks` - Completed/failed/cancelled tasks
- `audit` - Audit event logs
- `sessions` - Expired sessions
- `all` - All entities

**Options:**
- `--older-than <days>` - Retention period (default: 30)
- `--dry-run` - Preview without deleting
- `--confirm` - Skip confirmation prompt

### migration-create.mjs

Generate new database migration file.

**Features:**
- Template generation
- Sequential numbering
- Multiple migration types
- Forward/backward structure

**Usage:**
```bash
# Schema migration
pnpm migrate:create add_user_preferences

# Data migration
node scripts/migration-create.mjs seed_initial_data --type=data

# Custom migration
node scripts/migration-create.mjs custom_operation --type=custom
```

**Options:**
- `--type <type>` - schema, data, rollback (default: schema)
- `--template` - Use template for common operations

## Environment Variables

### Required

- `DGOS_DATABASE_URL` - PostgreSQL connection string
  ```
  postgresql://user:password@host:port/database
  ```

### Optional

- `DGOS_PACKAGE_ROOT` - Package files directory (default: `/var/lib/dgos/packages`)
- `DGOS_SECRETS_DIR` - Secrets directory (default: `/var/lib/dgos/secrets`)
- `DGOS_UPLOAD_DIR` - User uploads directory (default: `/var/lib/dgos/uploads`)
- `BACKUP_ENCRYPTION_KEY` - 256-bit hex key for encryption
- `AWS_S3_BUCKET` - S3 bucket for remote backups

## Backup Strategy

### Recommended Schedule

```bash
# Full backup every Sunday at 2 AM
0 2 * * 0 cd /app && DGOS_DATABASE_URL=$DB_URL pnpm backup:full --compress --s3-upload

# Incremental backup Monday-Saturday at 2 AM
0 2 * * 1-6 cd /app && DGOS_DATABASE_URL=$DB_URL pnpm backup:incremental --compress

# Data cleanup every Sunday at 3 AM
0 3 * * 0 cd /app && DGOS_DATABASE_URL=$DB_URL pnpm cleanup:data all --older-than=90 --confirm

# Integrity check daily at 4 AM
0 4 * * * cd /app && DGOS_DATABASE_URL=$DB_URL pnpm integrity:check
```

### Retention Policy

- **Last 7 days:** Keep all daily backups
- **Last 4 weeks:** Keep weekly full backups
- **Beyond 4 weeks:** Keep monthly full backups
- **Minimum:** 90 days for compliance

## Complete Documentation

- **[Data Management Guide](../99-历史归档/README.md)** - Complete guide to all data management operations
- **[Backup and Restore Procedures](../99-历史归档/README.md)** - Detailed backup/restore procedures and disaster recovery
- **[Migration Guide](../99-历史归档/README.md)** - Database migrations and version upgrades

## Common Workflows

### Pre-Deployment Backup

```bash
# 1. Create full backup
DGOS_DATABASE_URL=$DB_URL pnpm backup:full --compress --s3-upload

# 2. Validate backup
node scripts/restore-full.mjs ./backups/latest --validate-only

# 3. Check integrity
DGOS_DATABASE_URL=$DB_URL pnpm integrity:check

# 4. Ready to deploy
```

### Disaster Recovery

```bash
# 1. Stop services
systemctl stop dgos-api dgos-worker

# 2. Restore from backup
DGOS_DATABASE_URL=$DB_URL \
node scripts/restore-full.mjs /path/to/backup --force

# 3. Verify
DGOS_DATABASE_URL=$DB_URL pnpm integrity:check
DGOS_DATABASE_URL=$DB_URL pnpm validate:data

# 4. Restart services
systemctl start dgos-api dgos-worker
```

### Environment Migration

```bash
# Export from source
DGOS_DATABASE_URL=$SOURCE_DB pnpm export:users > users.json
DGOS_DATABASE_URL=$SOURCE_DB pnpm export:config > config.json

# Import to target
DGOS_DATABASE_URL=$TARGET_DB pnpm import:data users users.json
DGOS_DATABASE_URL=$TARGET_DB pnpm import:data config config.json

# Verify
DGOS_DATABASE_URL=$TARGET_DB pnpm integrity:check
```

### Regular Maintenance

```bash
# Weekly cleanup (dry run first)
DGOS_DATABASE_URL=$DB_URL \
node scripts/data-cleanup.mjs all --older-than=90 --dry-run

# If looks good, execute
DGOS_DATABASE_URL=$DB_URL \
pnpm cleanup:data all --older-than=90 --confirm

# Check integrity after cleanup
DGOS_DATABASE_URL=$DB_URL pnpm integrity:check
```

## Best Practices

1. **Always backup before major changes**
2. **Test restores regularly** (at least monthly)
3. **Use dry-run mode** before destructive operations
4. **Verify backups** after creation
5. **Monitor backup age** and alert if > 24 hours
6. **Store backups offsite** (S3 or similar)
7. **Encrypt sensitive backups**
8. **Document all data operations**
9. **Test disaster recovery procedures** quarterly
10. **Keep retention policies aligned** with compliance requirements

## Troubleshooting

### Backup fails with "pg_dump: command not found"

Install PostgreSQL client tools:
```bash
# Ubuntu/Debian
apt-get install postgresql-client

# macOS
brew install postgresql
```

### Restore fails with permission errors

Check file permissions:
```bash
chmod 700 /var/lib/dgos/secrets
chmod 600 /var/lib/dgos/secrets/*
chown -R dgos:dgos /var/lib/dgos
```

### Out of memory during export

Use streaming mode:
```bash
node scripts/data-export.mjs audit --stream --output=audit.json
```

### Integrity check finds many issues

Review and auto-fix:
```bash
DGOS_DATABASE_URL=$DB_URL \
node scripts/data-integrity-check.mjs --report=issues.json --verbose

# Review issues.json, then auto-fix
DGOS_DATABASE_URL=$DB_URL \
node scripts/data-integrity-check.mjs --auto-fix
```

## Support

For issues or questions:
- Check documentation in `.herdr/` directory
- Review script help: `node scripts/<script>.mjs --help`
- Check logs in `/var/log/dgos/`

---

**Version:** 1.0.0  
**Last Updated:** 2024-10-02
