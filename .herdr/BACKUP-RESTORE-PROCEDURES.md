# DGOS V1 Backup and Restore Procedures

## Quick Reference

### Emergency Restore
```bash
# 1. Stop services
systemctl stop dgos-api dgos-worker

# 2. Validate backup
DGOS_DATABASE_URL=$DB_URL node scripts/restore-full.mjs /path/to/backup --validate-only

# 3. Restore
DGOS_DATABASE_URL=$DB_URL node scripts/restore-full.mjs /path/to/backup --force

# 4. Verify
DGOS_DATABASE_URL=$DB_URL pnpm integrity:check

# 5. Restart services
systemctl start dgos-api dgos-worker
```

---

## Table of Contents

1. [Backup Procedures](#backup-procedures)
2. [Restore Procedures](#restore-procedures)
3. [Disaster Recovery](#disaster-recovery)
4. [Testing and Validation](#testing-and-validation)
5. [Automation](#automation)
6. [Troubleshooting](#troubleshooting)

---

## Backup Procedures

### Pre-Backup Checklist

Before performing a backup:

- [ ] Verify sufficient disk space (at least 2x database size)
- [ ] Check database connectivity
- [ ] Ensure PostgreSQL client tools installed
- [ ] Verify write permissions on backup directory
- [ ] Note current system state (migrations applied, etc.)

### Full Backup Procedure

**Standard Full Backup (Production)**

```bash
#!/bin/bash
# full-backup.sh

set -e

BACKUP_DATE=$(date +%Y-%m-%d-%H%M%S)
BACKUP_DIR="/var/lib/dgos/backups/dgos-backup-$BACKUP_DATE"

echo "Starting full backup: $BACKUP_DATE"

# Set environment
export DGOS_DATABASE_URL="postgresql://dgos:${DB_PASSWORD}@localhost:5432/dgos"
export DGOS_PACKAGE_ROOT="/var/lib/dgos/packages"
export DGOS_SECRETS_DIR="/var/lib/dgos/secrets"
export DGOS_UPLOAD_DIR="/var/lib/dgos/uploads"
export AWS_S3_BUCKET="dgos-production-backups"

# Create backup
cd /opt/dgos
node scripts/backup-full.mjs \
  --output "$BACKUP_DIR" \
  --compress \
  --s3-upload

# Verify backup
if [ $? -eq 0 ]; then
  echo "Backup completed successfully: $BACKUP_DIR"
  
  # Store backup metadata
  cp "$BACKUP_DIR/metadata.json" "/var/lib/dgos/backups/latest-backup.json"
  
  # Send success notification
  echo "Backup successful: $BACKUP_DATE" | mail -s "DGOS Backup Success" ops@example.com
else
  echo "Backup failed!"
  echo "Backup failed: $BACKUP_DATE" | mail -s "DGOS Backup FAILED" ops@example.com
  exit 1
fi
```

**Minimal Backup (Development)**

```bash
# Quick backup for development/testing
DGOS_DATABASE_URL=$DB_URL \
node scripts/backup-full.mjs \
  --output ./backups/dev-backup-$(date +%Y%m%d)
```

### Incremental Backup Procedure

**Daily Incremental Backup**

```bash
#!/bin/bash
# incremental-backup.sh

set -e

BACKUP_DATE=$(date +%Y-%m-%d-%H%M%S)
BACKUP_DIR="/var/lib/dgos/backups/dgos-incremental-$BACKUP_DATE"

echo "Starting incremental backup: $BACKUP_DATE"

# Set environment
export DGOS_DATABASE_URL="postgresql://dgos:${DB_PASSWORD}@localhost:5432/dgos"

# Create incremental backup (auto-detects last backup)
cd /opt/dgos
node scripts/backup-incremental.mjs \
  --output "$BACKUP_DIR" \
  --compress

if [ $? -eq 0 ]; then
  echo "Incremental backup completed: $BACKUP_DIR"
else
  echo "Incremental backup failed!"
  exit 1
fi
```

### Backup Verification

**Always verify backups after creation:**

```bash
# 1. Check backup metadata
cat /path/to/backup/metadata.json | jq '.'

# 2. Verify checksums
cd /path/to/backup
sha256sum -c checksum.txt

# 3. Test restore (to temporary database)
DGOS_DATABASE_URL=postgresql://test:pass@localhost:5432/dgos_restore_test \
node scripts/restore-full.mjs /path/to/backup --validate-only

# 4. Verify backup size is reasonable
du -sh /path/to/backup
```

### Backup Contents Verification

```bash
# Check what's in a backup
ls -lh /path/to/backup/

# Expected structure:
# metadata.json          - Backup metadata
# database.sql.gz        - Compressed database dump
# config.json            - Configuration data
# checksum.txt           - File checksums
# secrets/               - Secret files
# packages/              - Package files
# uploads/               - User uploads
```

---

## Restore Procedures

### Pre-Restore Checklist

Before restoring:

- [ ] **STOP ALL SERVICES** - Critical to prevent data corruption
- [ ] Validate backup integrity
- [ ] Verify backup version compatibility
- [ ] Create a backup of current state (if possible)
- [ ] Notify team of restore operation
- [ ] Plan for downtime window

### Full Restore Procedure

**Standard Full Restore**

```bash
#!/bin/bash
# full-restore.sh

set -e

BACKUP_DIR="$1"

if [ -z "$BACKUP_DIR" ]; then
  echo "Usage: $0 <backup-directory>"
  exit 1
fi

echo "============================================"
echo "DGOS FULL RESTORE PROCEDURE"
echo "============================================"
echo "Backup: $BACKUP_DIR"
echo ""

# Step 1: Stop services
echo "Step 1: Stopping services..."
systemctl stop dgos-api
systemctl stop dgos-worker
sleep 5

# Step 2: Validate backup
echo ""
echo "Step 2: Validating backup..."
export DGOS_DATABASE_URL="postgresql://dgos:${DB_PASSWORD}@localhost:5432/dgos"

cd /opt/dgos
node scripts/restore-full.mjs "$BACKUP_DIR" --validate-only

if [ $? -ne 0 ]; then
  echo "Backup validation failed! Aborting restore."
  systemctl start dgos-api
  systemctl start dgos-worker
  exit 1
fi

# Step 3: Backup current state (if database accessible)
echo ""
echo "Step 3: Creating safety backup of current state..."
SAFETY_BACKUP="/var/lib/dgos/backups/pre-restore-$(date +%Y%m%d-%H%M%S)"
node scripts/backup-full.mjs --output "$SAFETY_BACKUP" --compress || true

# Step 4: Perform restore
echo ""
echo "Step 4: Performing restore..."
node scripts/restore-full.mjs "$BACKUP_DIR" --force

if [ $? -ne 0 ]; then
  echo "Restore failed! Manual intervention required."
  exit 1
fi

# Step 5: Verify restoration
echo ""
echo "Step 5: Verifying restoration..."
node scripts/data-integrity-check.mjs

# Step 6: Restart services
echo ""
echo "Step 6: Restarting services..."
systemctl start dgos-api
systemctl start dgos-worker

# Step 7: Health check
echo ""
echo "Step 7: Waiting for services to be ready..."
sleep 10

# Check API health
curl -f http://localhost:8080/health || echo "Warning: API health check failed"

echo ""
echo "============================================"
echo "RESTORE COMPLETED"
echo "============================================"
echo "Please verify system functionality"
```

### Partial Restore Procedures

**Restore Database Only**

```bash
# Restore only database, skip files and secrets
DGOS_DATABASE_URL=$DB_URL \
node scripts/restore-full.mjs /path/to/backup \
  --skip-files \
  --skip-secrets \
  --force
```

**Restore Files Only**

```bash
# Manually restore files
cp -r /path/to/backup/packages/* /var/lib/dgos/packages/
cp -r /path/to/backup/uploads/* /var/lib/dgos/uploads/

# Fix permissions
chown -R dgos:dgos /var/lib/dgos/packages
chown -R dgos:dgos /var/lib/dgos/uploads
```

**Restore Secrets Only**

```bash
# Restore secrets (requires proper key access)
cp -r /path/to/backup/secrets/* /var/lib/dgos/secrets/
chmod 700 /var/lib/dgos/secrets
chmod 600 /var/lib/dgos/secrets/*
chown -R dgos:dgos /var/lib/dgos/secrets
```

### Point-in-Time Recovery

**Using Full + Incremental Backups**

```bash
#!/bin/bash
# point-in-time-restore.sh

FULL_BACKUP="/path/to/full-backup"
INCREMENTAL_BACKUP="/path/to/incremental-backup"

# 1. Restore full backup
echo "Restoring full backup..."
DGOS_DATABASE_URL=$DB_URL \
node scripts/restore-full.mjs "$FULL_BACKUP" --force

# 2. Apply incremental changes
echo "Applying incremental changes..."
DGOS_DATABASE_URL=$DB_URL \
node scripts/data-import.mjs config "$INCREMENTAL_BACKUP/changes.json"

# 3. Copy changed files
cp -r "$INCREMENTAL_BACKUP/packages/"* /var/lib/dgos/packages/
cp -r "$INCREMENTAL_BACKUP/uploads/"* /var/lib/dgos/uploads/

# 4. Verify
DGOS_DATABASE_URL=$DB_URL pnpm integrity:check
```

---

## Disaster Recovery

### Disaster Recovery Plan

**Recovery Time Objective (RTO):** 4 hours  
**Recovery Point Objective (RPO):** 24 hours (daily backup)

### Disaster Scenarios

#### Scenario 1: Database Corruption

**Symptoms:**
- Database connection errors
- Query failures
- Data integrity violations

**Recovery Steps:**

```bash
# 1. Identify corruption
DGOS_DATABASE_URL=$DB_URL pnpm integrity:check

# 2. Stop services
systemctl stop dgos-api dgos-worker

# 3. Attempt database repair
psql -U dgos -d dgos -c "REINDEX DATABASE dgos;"
psql -U dgos -d dgos -c "VACUUM FULL;"

# 4. If repair fails, restore from backup
DGOS_DATABASE_URL=$DB_URL \
node scripts/restore-full.mjs /path/to/latest-backup --force

# 5. Verify and restart
DGOS_DATABASE_URL=$DB_URL pnpm integrity:check
systemctl start dgos-api dgos-worker
```

#### Scenario 2: Complete System Loss

**Symptoms:**
- Server hardware failure
- Complete data loss
- Need to rebuild on new infrastructure

**Recovery Steps:**

```bash
# 1. Provision new server
# 2. Install DGOS application

# 3. Download latest backup from S3
aws s3 sync s3://dgos-production-backups/backups/dgos-backup-latest /tmp/restore-backup

# 4. Install PostgreSQL and create database
sudo apt-get install postgresql
sudo -u postgres createdb dgos
sudo -u postgres createuser dgos

# 5. Restore from backup
export DGOS_DATABASE_URL="postgresql://dgos:password@localhost:5432/dgos"
cd /opt/dgos
node scripts/restore-full.mjs /tmp/restore-backup --force

# 6. Restore secrets from secure storage
# (Secrets should be stored separately in a secure vault)

# 7. Start services
systemctl start dgos-api dgos-worker

# 8. Verify functionality
curl http://localhost:8080/health
```

#### Scenario 3: Accidental Data Deletion

**Symptoms:**
- Users report missing data
- Audit logs show deletion events

**Recovery Steps:**

```bash
# 1. Identify deletion time from audit logs
DGOS_DATABASE_URL=$DB_URL \
node scripts/data-export.mjs audit \
  --filter="action=delete" \
  --since="2024-10-01" \
  --format=json

# 2. Find backup before deletion
ls -lt /var/lib/dgos/backups/

# 3. Export specific data from backup
# (Restore to temporary database)
DGOS_DATABASE_URL=postgresql://test@localhost:5432/temp_restore \
node scripts/restore-full.mjs /path/to/backup-before-deletion

# 4. Export deleted data
DGOS_DATABASE_URL=postgresql://test@localhost:5432/temp_restore \
node scripts/data-export.mjs <entity> --output=recovered-data.json

# 5. Import to production
DGOS_DATABASE_URL=postgresql://dgos@localhost:5432/dgos \
node scripts/data-import.mjs <entity> recovered-data.json

# 6. Verify recovery
DGOS_DATABASE_URL=$DB_URL pnpm integrity:check
```

### Communication Plan

**During Disaster Recovery:**

1. **Immediate notification** to stakeholders
2. **Status updates** every 30 minutes
3. **Post-recovery report** within 24 hours

**Notification Template:**

```
SUBJECT: [URGENT] DGOS System Recovery in Progress

Team,

We are currently performing disaster recovery on the DGOS production system.

Incident: [Brief description]
Started: [Timestamp]
Expected Resolution: [Timestamp]
Current Status: [In Progress/Testing/Completed]

Actions Taken:
- [Action 1]
- [Action 2]

Next Steps:
- [Step 1]
- [Step 2]

We will provide updates every 30 minutes.

Contact: [On-call engineer]
```

---

## Testing and Validation

### Backup Testing Schedule

**Monthly:** Full backup restore test to staging environment  
**Quarterly:** Disaster recovery drill with full team  
**After major changes:** Backup and restore test

### Backup Restore Test Procedure

```bash
#!/bin/bash
# test-backup-restore.sh

set -e

BACKUP_TO_TEST="$1"
TEST_DB="dgos_restore_test_$(date +%Y%m%d_%H%M%S)"

echo "Testing backup restore: $BACKUP_TO_TEST"

# 1. Create test database
sudo -u postgres createdb "$TEST_DB"

# 2. Restore to test database
export DGOS_DATABASE_URL="postgresql://postgres@localhost:5432/$TEST_DB"
node scripts/restore-full.mjs "$BACKUP_TO_TEST" --force

# 3. Run integrity checks
node scripts/data-integrity-check.mjs

# 4. Run validation
node scripts/data-validate.mjs

# 5. Query sample data
psql -d "$TEST_DB" -c "SELECT count(*) FROM admin_principals;"
psql -d "$TEST_DB" -c "SELECT count(*) FROM audit_events;"

# 6. Cleanup
sudo -u postgres dropdb "$TEST_DB"

echo "Backup restore test completed successfully"
```

### Validation Checklist

After restore, verify:

- [ ] Database accessible
- [ ] All tables present
- [ ] Record counts match backup metadata
- [ ] No orphaned records
- [ ] Secrets readable
- [ ] Package files accessible
- [ ] API service starts successfully
- [ ] Worker service starts successfully
- [ ] Health endpoint responds
- [ ] Sample API requests work
- [ ] Audit logs show restore event

---

## Automation

### Automated Backup Script

```bash
#!/bin/bash
# /opt/dgos/bin/automated-backup.sh

set -e

BACKUP_TYPE="${1:-incremental}"  # full or incremental
LOG_FILE="/var/log/dgos/backup-$(date +%Y%m%d).log"

# Logging function
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handler
error_handler() {
  log "ERROR: Backup failed on line $1"
  echo "DGOS Backup Failed" | mail -s "DGOS Backup Failure Alert" ops@example.com
  exit 1
}

trap 'error_handler $LINENO' ERR

log "Starting $BACKUP_TYPE backup"

# Load environment
source /opt/dgos/.env

# Check disk space
AVAILABLE=$(df /var/lib/dgos/backups | tail -1 | awk '{print $4}')
if [ "$AVAILABLE" -lt 10485760 ]; then  # 10GB
  log "WARNING: Low disk space: ${AVAILABLE}KB available"
fi

# Perform backup
cd /opt/dgos

if [ "$BACKUP_TYPE" = "full" ]; then
  node scripts/backup-full.mjs --compress --s3-upload
else
  node scripts/backup-incremental.mjs --compress
fi

# Cleanup old local backups (keep last 7 days)
find /var/lib/dgos/backups -type d -name "dgos-*" -mtime +7 -exec rm -rf {} +

log "Backup completed successfully"
```

### Cron Configuration

```bash
# /etc/cron.d/dgos-backup

# Full backup every Sunday at 2 AM
0 2 * * 0 dgos /opt/dgos/bin/automated-backup.sh full

# Incremental backup Monday-Saturday at 2 AM
0 2 * * 1-6 dgos /opt/dgos/bin/automated-backup.sh incremental

# Data cleanup every Sunday at 3 AM
0 3 * * 0 dgos cd /opt/dgos && DGOS_DATABASE_URL=$DB_URL pnpm cleanup:data all --older-than=90 --confirm

# Integrity check every day at 4 AM
0 4 * * * dgos cd /opt/dgos && DGOS_DATABASE_URL=$DB_URL pnpm integrity:check --report=/var/log/dgos/integrity-$(date +\%Y\%m\%d).json
```

### Monitoring Setup

```bash
#!/bin/bash
# check-backup-health.sh

# Check if last backup is recent (< 25 hours old)
LAST_BACKUP=$(find /var/lib/dgos/backups -type d -name "dgos-*" -mtime -1 | wc -l)

if [ "$LAST_BACKUP" -eq 0 ]; then
  echo "CRITICAL: No backup in last 24 hours"
  exit 2
fi

# Check backup size is reasonable
LATEST=$(ls -td /var/lib/dgos/backups/dgos-* | head -1)
SIZE=$(du -sm "$LATEST" | cut -f1)

if [ "$SIZE" -lt 10 ]; then  # Less than 10MB is suspicious
  echo "WARNING: Backup size unusually small: ${SIZE}MB"
  exit 1
fi

echo "OK: Backup health check passed"
exit 0
```

---

## Troubleshooting

### Common Issues

#### Issue: pg_dump command not found

**Solution:**
```bash
# Install PostgreSQL client
apt-get install postgresql-client

# Or specify pg_dump path
export PATH="/usr/lib/postgresql/14/bin:$PATH"
```

#### Issue: Permission denied on secrets

**Solution:**
```bash
# Fix secret directory permissions
chmod 700 /var/lib/dgos/secrets
chmod 600 /var/lib/dgos/secrets/*
chown -R dgos:dgos /var/lib/dgos/secrets
```

#### Issue: Backup fails with out of disk space

**Solution:**
```bash
# Check disk space
df -h /var/lib/dgos/backups

# Cleanup old backups
find /var/lib/dgos/backups -type d -name "dgos-*" -mtime +30 -exec rm -rf {} +

# Use different backup location
node scripts/backup-full.mjs --output /mnt/external/backup
```

#### Issue: Restore fails with version mismatch

**Solution:**
```bash
# Check backup version
cat /path/to/backup/metadata.json | jq '.version'

# Check current version
cat /opt/dgos/package.json | jq '.version'

# If versions differ, migrations may be needed
# Restore to staging first and test
```

#### Issue: Database restore hangs

**Solution:**
```bash
# Check for active connections
psql -d dgos -c "SELECT * FROM pg_stat_activity WHERE datname='dgos';"

# Terminate connections
psql -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='dgos' AND pid <> pg_backend_pid();"

# Retry restore
```

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
# Set environment variable
export DEBUG=dgos:*

# Run backup with verbose output
node scripts/backup-full.mjs --compress 2>&1 | tee backup-debug.log
```

---

## Appendix

### Backup Metadata Schema

```json
{
  "version": "1.0.0",
  "type": "full",
  "timestamp": "2024-10-02T15:00:00Z",
  "duration": 45000,
  "database": {
    "migrations": ["0001", "0002", "..."],
    "tableCounts": {
      "admin_principals": 10,
      "audit_events": 5000
    },
    "totalRows": 15234,
    "size": 10485760,
    "compressed": true
  },
  "secrets": {
    "fileCount": 25,
    "totalSize": 102400
  },
  "files": {
    "packages": {
      "fileCount": 50,
      "totalSize": 52428800
    },
    "uploads": {
      "fileCount": 100,
      "totalSize": 10485760
    }
  },
  "config": {
    "providers": 5,
    "bindings": 10,
    "extensions": 3,
    "policies": 2
  },
  "options": {
    "compressed": true,
    "encrypted": false
  }
}
```

---

**Document Version:** 1.0.0  
**Last Updated:** 2024-10-02  
**Next Review:** 2025-01-02
