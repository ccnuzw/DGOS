# DGOS V1 Migration and Upgrade Guide

**Version**: V1.0.0  
**Last Updated**: 2026-10-02  
**Audience**: DevOps Engineers, Database Administrators, System Operators

---

## Table of Contents

1. [Overview](#overview)
2. [Database Migration Guide](#database-migration-guide)
3. [Version Upgrade Paths](#version-upgrade-paths)
4. [Data Migration Tools](#data-migration-tools)
5. [Zero-Downtime Upgrade Strategy](#zero-downtime-upgrade-strategy)
6. [Backup and Restore Procedures](#backup-and-restore-procedures)
7. [Troubleshooting Guide](#troubleshooting-guide)
8. [Appendix: Migration Reference](#appendix-migration-reference)

---

## Overview

This guide provides comprehensive procedures for:
- Running database migrations safely
- Upgrading between DGOS versions
- Migrating data between instances
- Implementing zero-downtime deployments
- Backing up and restoring system state
- Recovering from migration failures

### Safety Principles

1. **Always backup before migration** - Full PostgreSQL and Redis backups
2. **Test on copy first** - Never test migrations on production directly
3. **Validate checksums** - Ensure migration integrity before applying
4. **Plan rollback path** - Know how to reverse every change
5. **Monitor during migration** - Watch for errors and performance issues

---

## Database Migration Guide

### Migration System Overview

DGOS uses a sequential migration system with:
- **47 migration files** (0001-0051, missing 0008, 0020, 0021, 0042)
- **Checksum validation** - Ensures migration integrity
- **Idempotent execution** - Safe to re-run migrations
- **Transaction-wrapped** - Each migration runs in a transaction
- **Version tracking** - Stored in `dgos_schema_migrations` table

### All 47 Migrations Documented

```
0001-v1-governance.sql                    - Foundation tables, admin, API keys, providers, audit
0002-connection-test-leases.sql           - Connection test lease management
0003-audit-outbox-leases.sql              - Audit event publishing leases
0004-retention-jobs.sql                   - Data retention job scheduling
0005-quota-usage.sql                      - Quota and usage tracking
0006-runtime.sql                          - Runtime execution tables
0007-provider-config-ai-task.sql          - Provider configuration and AI tasks
0009-quota-usage-dimensions.sql           - Extended quota dimensions
0010-quota-usage-idempotency.sql          - Quota idempotency keys
0011-runtime-persistence.sql              - Runtime state persistence
0012-ai-task-leases.sql                   - AI task lease management
0013-action-run-recovery.sql              - Action execution recovery
0014-audit-runtime-targets.sql            - Audit runtime target tracking
0015-action-handler-claim.sql             - Action handler claims
0016-action-input-recovery.sql            - Action input recovery
0017-action-recovery-guard.sql            - Action recovery guards
0018-action-cancel-guard.sql              - Action cancellation guards
0019-ai-task-dispatch-fence.sql           - AI task dispatch fencing
0022-api-key-rotation.sql                 - API key rotation support
0023-governance-policy.sql                - Governance policy tables
0024-admin-session-freshness.sql          - Admin session freshness tracking
0025-extension-registry.sql               - Extension registry tables
0026-extension-runs.sql                   - Extension execution tracking
0027-extension-run-events.sql             - Extension event logging
0028-app-packages.sql                     - Application package management
0029-app-package-deployments.sql          - Package deployment tracking
0030-app-package-operations.sql           - Package operation logs
0031-provider-account-bindings.sql        - Provider account bindings
0032-provider-connection-recovery.sql     - Provider connection recovery
0033-provider-admission.sql               - Provider admission control
0034-extension-recovery.sql               - Extension recovery mechanisms
0035-package-recovery.sql                 - Package recovery support
0036-provider-operations.sql              - Provider operation tracking
0037-app-data-migration.sql               - App data migration tables
0038-permission-action-lifecycle.sql      - Permission action lifecycle
0039-provider-protocol-confirmations.sql  - Provider protocol confirmations
0040-provider-profile-bindings.sql        - Provider profile bindings
0041-app-data-migration-package-digests.sql - Package digest tracking
0043-provider-protocol-receipts.sql      - Provider protocol receipts
0044-system-projection.sql                - System state projection
0045-network-route-activation.sql         - Network route activation
0046-package-retention.sql                - Package retention policies
0047-ai-task-parameters.sql               - AI task parameter storage
0048-network-route-fingerprint.sql        - Network route fingerprinting
0049-extension-management.sql             - Extension management tables
0050-session-management.sql               - Session management improvements
0051-proxy-provisioning.sql               - Network proxy provisioning
```

### Migration Procedure (Forward)

#### Step 1: Pre-Migration Checklist

```bash
# 1. Verify current database version
psql $DGOS_DATABASE_URL -c "SELECT version, applied_at FROM dgos_schema_migrations ORDER BY version;"

# 2. Check database connectivity
psql $DGOS_DATABASE_URL -c "SELECT current_database(), current_user, version();"

# 3. Verify disk space (migrations need ~100MB)
df -h /var/lib/postgresql/data

# 4. Check active connections
psql $DGOS_DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database();"

# 5. Create backup (see Backup section)
pg_dump $DGOS_DATABASE_URL > /backup/dgos-pre-migration-$(date +%Y%m%d-%H%M%S).sql
```

#### Step 2: Generate Migration SQL

```bash
# Navigate to DGOS repository
cd /path/to/DGOS

# Generate migration plan (preview)
node scripts/migrate.mjs

# Generate SQL statements
node scripts/migrate.mjs --print-sql > /tmp/migration.sql

# Review the generated SQL
less /tmp/migration.sql
```

#### Step 3: Test on Database Copy

```bash
# Create test database from backup
createdb dgos_test
psql dgos_test < /backup/dgos-latest.sql

# Run migrations on test database
DGOS_DATABASE_URL=postgres://user:pass@localhost/dgos_test \
  node scripts/v1-ops-migrate.mjs

# Verify test database
psql dgos_test -c "SELECT version FROM dgos_schema_migrations ORDER BY version;"
psql dgos_test -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"

# Run application tests against test database
DGOS_DATABASE_URL=postgres://user:pass@localhost/dgos_test npm test
```

#### Step 4: Apply to Production

```bash
# Set maintenance mode (optional)
# Prevents new connections during migration

# Apply migrations
DGOS_DATABASE_URL=$DGOS_PRODUCTION_URL \
  node scripts/v1-ops-migrate.mjs

# Sample output:
# {"migrations":[{"version":"0001-v1-governance","checksum":"4041..."},...]}
```

#### Step 5: Post-Migration Validation

```bash
# 1. Verify all migrations applied
psql $DGOS_DATABASE_URL -c "SELECT count(*) FROM dgos_schema_migrations;" 
# Expected: 47 rows

# 2. Check for schema errors
psql $DGOS_DATABASE_URL -c "\d+" | grep -i error

# 3. Validate table structure
psql $DGOS_DATABASE_URL -c "\dt+"

# 4. Test application startup
docker compose up api worker

# 5. Run smoke tests
curl http://localhost:3000/ready
curl http://localhost:3000/health

# 6. Check logs for errors
docker compose logs api | grep -i error
```

### Rollback Procedure

#### Option 1: Restore from Backup (Recommended)

```bash
# 1. Stop all services
docker compose down

# 2. Drop current database
dropdb dgos

# 3. Restore from backup
createdb dgos
psql dgos < /backup/dgos-pre-migration-YYYYMMDD-HHMMSS.sql

# 4. Verify restore
psql dgos -c "SELECT version FROM dgos_schema_migrations ORDER BY version DESC LIMIT 1;"

# 5. Restart services
docker compose up -d
```

#### Option 2: Manual Rollback (Not Recommended)

⚠️ **Warning**: DGOS migrations are designed for forward-only execution. Manual rollback requires:
- Deep understanding of schema dependencies
- Custom DROP and ALTER statements
- Data migration reversals
- High risk of data loss

If backup restore is not possible:

```bash
# Contact DGOS support for migration-specific rollback scripts
# Each migration may require custom rollback logic
# Example for simple table addition:
psql $DGOS_DATABASE_URL -c "
BEGIN;
DROP TABLE IF EXISTS new_table CASCADE;
DELETE FROM dgos_schema_migrations WHERE version = '0051-proxy-provisioning';
COMMIT;
"
```

### Migration Checksum Validation

```bash
# Verify migration file integrity
node scripts/migrate.mjs | jq '.[] | {version, checksum}'

# Compare against frozen operations migrations
# migrations 0045-0051 have frozen checksums in v1-ops-migrate.mjs

# If checksum mismatch detected:
# 1. Do NOT proceed with migration
# 2. Verify file integrity
# 3. Check for unauthorized modifications
# 4. Restore from version control
```

### Partial Migration Recovery

If migration fails mid-execution:

```bash
# 1. Check which migrations succeeded
psql $DGOS_DATABASE_URL -c "SELECT version FROM dgos_schema_migrations ORDER BY version;"

# 2. Check for partial transactions
psql $DGOS_DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE state = 'idle in transaction';"

# 3. Terminate hanging connections
psql $DGOS_DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction';"

# 4. Review migration error logs
docker compose logs migrate

# 5. Fix underlying issue (disk space, permissions, etc.)

# 6. Re-run migration (idempotent - skips completed migrations)
docker compose up migrate
```

---

## Version Upgrade Paths

### Semantic Versioning

DGOS follows semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR** (1.x.x): Breaking changes, manual intervention required
- **MINOR** (x.1.x): New features, backward compatible
- **PATCH** (x.x.1): Bug fixes, backward compatible

### V1.0 → V1.1 Upgrade Procedure

#### Pre-Upgrade Checklist

```bash
# 1. Review release notes
curl https://docs.dgos.io/releases/v1.1.0

# 2. Check current version
docker compose exec api node -e "console.log(process.env.DGOS_VERSION || 'v1.0.0')"

# 3. Backup current system
./scripts/v1-ops-backup.sh

# 4. Review breaking changes list
# - Check BREAKING_CHANGES.md in release
# - Review API deprecations
# - Check configuration changes
```

#### Upgrade Steps

```bash
# 1. Pull new version
git fetch --tags
git checkout v1.1.0

# 2. Review changes
git log v1.0.0..v1.1.0 --oneline
git diff v1.0.0..v1.1.0 docker-compose.production.yml

# 3. Update dependencies
pnpm install

# 4. Build new images
docker compose -f docker-compose.production.yml build

# 5. Run migrations (if any new migrations)
docker compose up migrate

# 6. Rolling restart (see Zero-Downtime section)
docker compose up -d --no-deps --scale api=2 api
sleep 30
docker compose up -d --no-deps --scale api=1 api

# 7. Verify upgrade
curl http://localhost:3000/system/version
docker compose logs api | grep "Server started"

# 8. Run acceptance tests
npm run test:release
```

#### Rollback V1.1 → V1.0

```bash
# 1. Stop services
docker compose down

# 2. Restore from backup
./scripts/v1-ops-restore.sh /backup/v1.0-state

# 3. Checkout previous version
git checkout v1.0.0

# 4. Rebuild images
docker compose -f docker-compose.production.yml build

# 5. Start services
docker compose up -d

# 6. Verify rollback
curl http://localhost:3000/system/version
```

### V1.x → V2.0 Upgrade Path Planning

⚠️ **Major Version Upgrade**: V2.0 will include breaking changes.

#### Expected Breaking Changes (Preliminary)

1. **Database Schema**: New required columns, table restructuring
2. **API Changes**: Endpoint deprecations, authentication changes
3. **Configuration**: Environment variable renames
4. **Redis Structure**: Key namespace changes
5. **Extension API**: Plugin interface breaking changes

#### Recommended Upgrade Strategy

```
V1.x → V1.latest (LTS) → V2.0
```

1. **Upgrade to V1.latest first**
   - Includes compatibility shims
   - Provides migration tools
   - Enables dual-version testing

2. **Run V2 compatibility check**
   ```bash
   node scripts/check-v2-compatibility.mjs
   ```

3. **Parallel deployment testing**
   - Run V1 and V2 in parallel
   - Route test traffic to V2
   - Compare results

4. **Cutover to V2**
   - Final backup of V1 state
   - Database migration to V2 schema
   - Configuration migration
   - Full system cutover

### Breaking Changes Checklist

Before any major version upgrade:

- [ ] Review all BREAKING_CHANGES.md entries
- [ ] Update custom integrations for API changes
- [ ] Migrate deprecated configuration options
- [ ] Update client SDKs and libraries
- [ ] Review and update monitoring dashboards
- [ ] Update backup/restore procedures
- [ ] Train operators on new features/changes
- [ ] Plan rollback window (minimum 24 hours)
- [ ] Schedule maintenance window
- [ ] Notify users of downtime/changes

### Compatibility Matrix

| Component | V1.0 | V1.1 | V1.2 | V2.0 |
|-----------|------|------|------|------|
| PostgreSQL | 16+ | 16+ | 16+ | 16+ |
| Redis | 7+ | 7+ | 7+ | 7+ |
| Node.js | 22+ | 22+ | 22+ | 22+ |
| Docker | 24+ | 24+ | 24+ | 25+ |
| API Clients V1 | ✓ | ✓ | ✓ | ✗ |
| API Clients V2 | ✗ | ✗ | ✓ | ✓ |
| Extension API V1 | ✓ | ✓ | Deprecated | ✗ |
| Extension API V2 | ✗ | ✓ | ✓ | ✓ |

---

## Data Migration Tools

### Tool 1: Export User Data

**Purpose**: Export all user accounts, sessions, and API keys for migration.

**Location**: `scripts/data-export-users.mjs`

**Usage**:
```bash
DGOS_DATABASE_URL=postgres://... node scripts/data-export-users.mjs > users-export.json
```

**Output Format**: JSON with admin principals, sessions, and API keys.

### Tool 2: Export Configuration

**Purpose**: Export provider configurations, governance policies, and system settings.

**Location**: `scripts/data-export-config.mjs`

**Usage**:
```bash
DGOS_DATABASE_URL=postgres://... node scripts/data-export-config.mjs > config-export.json
```

### Tool 3: Export Packages

**Purpose**: Export application packages and extensions.

**Location**: `scripts/data-export-packages.mjs`

**Usage**:
```bash
DGOS_DATABASE_URL=postgres://... \
DGOS_PACKAGE_ROOT=/var/lib/dgos/packages \
  node scripts/data-export-packages.mjs > packages-export.json
```

### Tool 4: Import to New Instance

**Purpose**: Import exported data to a fresh DGOS instance.

**Location**: `scripts/data-import.mjs`

**Usage**:
```bash
# Import users
DGOS_DATABASE_URL=postgres://... node scripts/data-import.mjs users users-export.json

# Import configuration
DGOS_DATABASE_URL=postgres://... node scripts/data-import.mjs config config-export.json

# Import packages
DGOS_DATABASE_URL=postgres://... \
DGOS_PACKAGE_ROOT=/var/lib/dgos/packages \
  node scripts/data-import.mjs packages packages-export.json
```

### Tool 5: Validate Data Integrity

**Purpose**: Verify data integrity after migration.

**Location**: `scripts/data-validate.mjs`

**Usage**:
```bash
DGOS_DATABASE_URL=postgres://... node scripts/data-validate.mjs

# Sample output:
# {
#   "status": "valid",
#   "checks": {
#     "referential_integrity": "pass",
#     "required_data": "pass",
#     "checksum_validation": "pass",
#     "orphaned_records": 0
#   }
# }
```

### Complete Data Migration Example

```bash
#!/bin/bash
# Complete instance migration script

SOURCE_DB="postgres://source-host/dgos"
TARGET_DB="postgres://target-host/dgos"
EXPORT_DIR="/backup/migration-$(date +%Y%m%d)"

# 1. Create export directory
mkdir -p "$EXPORT_DIR"

# 2. Export from source
echo "Exporting users..."
DGOS_DATABASE_URL="$SOURCE_DB" node scripts/data-export-users.mjs > "$EXPORT_DIR/users.json"

echo "Exporting configuration..."
DGOS_DATABASE_URL="$SOURCE_DB" node scripts/data-export-config.mjs > "$EXPORT_DIR/config.json"

echo "Exporting packages..."
DGOS_DATABASE_URL="$SOURCE_DB" \
DGOS_PACKAGE_ROOT=/var/lib/dgos/packages \
  node scripts/data-export-packages.mjs > "$EXPORT_DIR/packages.json"

# 3. Backup package files
echo "Backing up package files..."
tar czf "$EXPORT_DIR/packages.tar.gz" /var/lib/dgos/packages

# 4. Setup target instance
echo "Running migrations on target..."
DGOS_DATABASE_URL="$TARGET_DB" node scripts/v1-ops-migrate.mjs

# 5. Import to target
echo "Importing users..."
DGOS_DATABASE_URL="$TARGET_DB" node scripts/data-import.mjs users "$EXPORT_DIR/users.json"

echo "Importing configuration..."
DGOS_DATABASE_URL="$TARGET_DB" node scripts/data-import.mjs config "$EXPORT_DIR/config.json"

echo "Restoring package files..."
tar xzf "$EXPORT_DIR/packages.tar.gz" -C /

echo "Importing packages..."
DGOS_DATABASE_URL="$TARGET_DB" \
DGOS_PACKAGE_ROOT=/var/lib/dgos/packages \
  node scripts/data-import.mjs packages "$EXPORT_DIR/packages.json"

# 6. Validate
echo "Validating integrity..."
DGOS_DATABASE_URL="$TARGET_DB" node scripts/data-validate.mjs

echo "Migration complete!"
```

### Selective Data Migration

For migrating specific data subsets:

```bash
# Export only active users
DGOS_DATABASE_URL=postgres://... \
  node scripts/data-export-users.mjs --filter "status=active" > active-users.json

# Export specific provider
DGOS_DATABASE_URL=postgres://... \
  node scripts/data-export-config.mjs --provider "anthropic" > anthropic-config.json

# Export packages by namespace
DGOS_DATABASE_URL=postgres://... \
  node scripts/data-export-packages.mjs --namespace "com.example" > example-packages.json
```

---

## Zero-Downtime Upgrade Strategy

### Prerequisites

- Load balancer or reverse proxy (Caddy, Nginx, HAProxy)
- Multiple API/worker instances capability
- Health check endpoints configured
- Shared PostgreSQL and Redis instances

### Strategy 1: Blue-Green Deployment

**Best for**: Major version upgrades, significant changes

**Architecture**:
```
[Load Balancer]
    |
    ├─> [Blue Environment] (V1.0 - current)
    └─> [Green Environment] (V1.1 - new)
```

**Procedure**:

```bash
# 1. Setup green environment
docker compose -f docker-compose.green.yml up -d

# 2. Run migrations (if backward compatible)
DGOS_DATABASE_URL=$SHARED_DB docker compose -f docker-compose.green.yml up migrate

# 3. Health check green environment
for i in {1..30}; do
  curl -f http://green-host:3000/ready && break
  sleep 2
done

# 4. Run smoke tests on green
curl -f http://green-host:3000/health
curl -f http://green-host:3000/system/version

# 5. Switch 10% traffic to green
# Configure load balancer:
# Blue: 90% weight
# Green: 10% weight

# 6. Monitor for 15 minutes
# - Check error rates
# - Monitor latency
# - Review logs

# 7. Gradually increase green traffic
# Blue: 50%, Green: 50% (wait 10 min)
# Blue: 25%, Green: 75% (wait 10 min)
# Blue: 0%, Green: 100%

# 8. Decommission blue environment
docker compose -f docker-compose.blue.yml down

# 9. Rename green to production
mv docker-compose.green.yml docker-compose.production.yml
```

**Rollback**:
```bash
# Instant rollback: Switch traffic back to blue
# Blue: 100%, Green: 0%

# Then investigate green environment issues
docker compose -f docker-compose.green.yml logs
```

### Strategy 2: Rolling Update

**Best for**: Minor version upgrades, patch releases

**Procedure**:

```bash
# 1. Scale up with new version (mixed fleet)
docker compose up -d --scale api=4 --scale worker=2 api worker

# 2. Health check new instances
docker compose ps api

# 3. Remove old instances one by one
# Load balancer automatically routes around unhealthy instances
docker compose up -d --scale api=3 api
sleep 30  # Monitor
docker compose up -d --scale api=2 api
sleep 30
docker compose up -d --scale api=1 api
sleep 30

# 4. All old instances replaced
docker compose ps
```

**Rollback**:
```bash
# Revert to previous version
git checkout v1.0.0
docker compose build
docker compose up -d --scale api=4 api
# Gradually scale down new instances
```

### Strategy 3: Database Migration Without Downtime

**Challenge**: Database schema changes during live traffic

**Solution**: Expand-Contract Pattern

**Phase 1: Expand (Backward Compatible)**
```sql
-- Add new columns with defaults (does not break V1.0)
ALTER TABLE admin_principals ADD COLUMN email_verified boolean DEFAULT false;
ALTER TABLE admin_sessions ADD COLUMN user_agent text;

-- Add new tables (V1.0 ignores them)
CREATE TABLE admin_mfa_settings (
  principal_id uuid PRIMARY KEY REFERENCES admin_principals(principal_id),
  mfa_enabled boolean NOT NULL DEFAULT false,
  ...
);

-- Add new indexes (improves V1.0 performance)
CREATE INDEX CONCURRENTLY admin_principals_email_idx ON admin_principals (credential_ref);
```

**Phase 2: Deploy V1.1 (Uses New and Old Schema)**
```bash
# V1.1 reads from both old and new columns
# V1.1 writes to both old and new columns
docker compose up -d --scale api=2 api  # Mixed fleet
```

**Phase 3: Data Migration**
```sql
-- Backfill new columns
UPDATE admin_principals SET email_verified = true WHERE status = 'active';

-- Migrate data to new tables
INSERT INTO admin_mfa_settings (principal_id, mfa_enabled)
SELECT principal_id, false FROM admin_principals
ON CONFLICT DO NOTHING;
```

**Phase 4: Contract (Remove Old Schema)**
```sql
-- After all instances on V1.1, remove old columns
ALTER TABLE admin_principals DROP COLUMN legacy_status;
DROP TABLE IF EXISTS deprecated_table;
```

### Load Balancer Configuration Examples

**Caddy** (`Caddyfile`):
```
dgos.example.com {
    # Blue-green with weighted routing
    reverse_proxy {
        to blue-api:3000 green-api:3000
        lb_policy weighted 90 10  # 90% blue, 10% green
        health_uri /ready
        health_interval 5s
        health_timeout 3s
    }
}
```

**Nginx**:
```nginx
upstream dgos_api {
    server blue-api:3000 weight=90 max_fails=3 fail_timeout=30s;
    server green-api:3000 weight=10 max_fails=3 fail_timeout=30s;
    
    # Health checks (requires nginx-plus or module)
    check interval=5000 rise=2 fall=3 timeout=3000 type=http;
    check_http_send "GET /ready HTTP/1.0\r\n\r\n";
    check_http_expect_alive http_2xx http_3xx;
}

server {
    listen 443 ssl http2;
    server_name dgos.example.com;
    
    location / {
        proxy_pass http://dgos_api;
        proxy_next_upstream error timeout http_502 http_503;
    }
}
```

### Monitoring During Upgrade

```bash
# Watch error rates
watch -n 5 'curl -s http://localhost:3000/metrics | grep error_total'

# Monitor latency
curl -s http://localhost:3000/metrics | grep http_request_duration

# Check active connections
psql $DGOS_DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'dgos';"

# Watch logs in real-time
docker compose logs -f --tail=100 api worker

# Check health endpoints
watch -n 2 curl http://localhost:3000/ready
```

---

## Backup and Restore Procedures

### Complete System Backup

A full DGOS backup includes:
1. **PostgreSQL database** - All persistent state
2. **Redis data** (optional) - Ephemeral cache/queue data
3. **Encrypted secrets** - Ciphertext directory
4. **Package storage** - Application packages
5. **Configuration files** - Environment, compose files

### PostgreSQL Backup

#### Full Database Backup (pg_dump)

```bash
#!/bin/bash
# backup-postgres.sh

BACKUP_DIR="/backup/postgres"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DB_URL="${DGOS_DATABASE_URL}"

mkdir -p "$BACKUP_DIR"

# Full backup with custom format (compressed, parallel restore)
pg_dump "$DB_URL" \
  --format=custom \
  --compress=9 \
  --verbose \
  --file="$BACKUP_DIR/dgos-full-$TIMESTAMP.dump"

# Also create SQL format for inspection
pg_dump "$DB_URL" \
  --format=plain \
  --verbose \
  --file="$BACKUP_DIR/dgos-full-$TIMESTAMP.sql"

# Compress SQL backup
gzip "$BACKUP_DIR/dgos-full-$TIMESTAMP.sql"

# Verify backup
pg_restore --list "$BACKUP_DIR/dgos-full-$TIMESTAMP.dump" > /dev/null
echo "✓ Backup completed: dgos-full-$TIMESTAMP.dump"

# Calculate checksum
sha256sum "$BACKUP_DIR/dgos-full-$TIMESTAMP.dump" > "$BACKUP_DIR/dgos-full-$TIMESTAMP.dump.sha256"
```

#### Incremental Backup (WAL Archiving)

**Setup WAL archiving in PostgreSQL**:

```bash
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /backup/wal/%f && cp %p /backup/wal/%f'
archive_timeout = 300  # 5 minutes
```

**Base backup with WAL**:
```bash
# Create base backup
pg_basebackup -D /backup/base -F tar -z -P -U postgres

# WAL files automatically archived to /backup/wal
# Point-in-time recovery possible
```

#### Schema-Only Backup

```bash
# Backup schema without data (fast, for testing migrations)
pg_dump "$DB_URL" --schema-only --file=schema-only.sql
```

#### Selective Table Backup

```bash
# Backup specific tables
pg_dump "$DB_URL" \
  --table=admin_principals \
  --table=admin_sessions \
  --table=api_key_records \
  --file=admin-tables.sql
```

### PostgreSQL Restore

#### Full Database Restore

```bash
#!/bin/bash
# restore-postgres.sh

BACKUP_FILE="/backup/postgres/dgos-full-20261002-120000.dump"
TARGET_DB="dgos_restored"

# 1. Verify backup integrity
sha256sum -c "${BACKUP_FILE}.sha256"

# 2. Create fresh database
createdb "$TARGET_DB"

# 3. Restore (parallel for speed)
pg_restore \
  --dbname="$TARGET_DB" \
  --jobs=4 \
  --verbose \
  "$BACKUP_FILE"

# 4. Verify restore
psql "$TARGET_DB" -c "SELECT count(*) FROM dgos_schema_migrations;"
psql "$TARGET_DB" -c "SELECT count(*) FROM admin_principals;"

echo "✓ Restore completed to $TARGET_DB"
```

#### Point-in-Time Recovery (PITR)

```bash
# Restore to specific timestamp
pg_restore --dbname=dgos_pitr /backup/base/base.tar.gz

# Configure recovery
cat > /var/lib/postgresql/data/recovery.conf << EOF
restore_command = 'cp /backup/wal/%f %p'
recovery_target_time = '2026-10-02 12:00:00'
recovery_target_action = 'promote'
EOF

# Start PostgreSQL (will replay WAL to target time)
pg_ctl start
```

### Redis Backup

**RDB Snapshot** (point-in-time):
```bash
# Trigger save
redis-cli SAVE

# Or background save
redis-cli BGSAVE

# Copy snapshot
cp /var/lib/redis/dump.rdb /backup/redis/dump-$(date +%Y%m%d-%H%M%S).rdb
```

**AOF Backup** (append-only file):
```bash
# Enable AOF in redis.conf
appendonly yes
appendfilename "appendonly.aof"

# Backup AOF
cp /var/lib/redis/appendonly.aof /backup/redis/appendonly-$(date +%Y%m%d-%H%M%S).aof
```

**Redis Restore**:
```bash
# Stop Redis
docker compose stop redis

# Restore RDB
cp /backup/redis/dump-20261002-120000.rdb /var/lib/redis/dump.rdb

# Or restore AOF
cp /backup/redis/appendonly-20261002-120000.aof /var/lib/redis/appendonly.aof

# Start Redis
docker compose start redis
```

### File Storage Backup

#### Encrypted Secrets Backup

```bash
# Use official DGOS backup tool
node scripts/v1-ops-backup.mjs \
  /var/lib/dgos/ciphertext \
  /backup/secrets/ciphertext-$(date +%Y%m%d)

# Sample output:
# {"records":42,"destination":"/backup/secrets/ciphertext-20261002"}
```

#### Package Storage Backup

```bash
# Backup packages directory
BACKUP_DIR="/backup/packages/packages-$(date +%Y%m%d)"
PACKAGE_ROOT="/var/lib/dgos/packages"

# Create tar archive with verification
tar cvzf "$BACKUP_DIR.tar.gz" \
  --verify \
  --directory="$(dirname $PACKAGE_ROOT)" \
  "$(basename $PACKAGE_ROOT)"

# Calculate checksum
sha256sum "$BACKUP_DIR.tar.gz" > "$BACKUP_DIR.tar.gz.sha256"
```

### Full System Backup Script

```bash
#!/bin/bash
# full-system-backup.sh

set -euo pipefail

BACKUP_ROOT="/backup/dgos"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"

mkdir -p "$BACKUP_DIR"/{postgres,redis,secrets,packages,config}

echo "Starting full system backup: $TIMESTAMP"

# 1. PostgreSQL
echo "Backing up PostgreSQL..."
pg_dump "$DGOS_DATABASE_URL" \
  --format=custom \
  --file="$BACKUP_DIR/postgres/dgos.dump"

# 2. Redis
echo "Backing up Redis..."
docker compose exec -T redis redis-cli BGSAVE
sleep 5
docker compose cp redis:/data/dump.rdb "$BACKUP_DIR/redis/"

# 3. Encrypted secrets
echo "Backing up secrets..."
node scripts/v1-ops-backup.mjs \
  /var/lib/dgos/ciphertext \
  "$BACKUP_DIR/secrets/ciphertext"

# 4. Packages
echo "Backing up packages..."
tar czf "$BACKUP_DIR/packages/packages.tar.gz" \
  /var/lib/dgos/packages

# 5. Configuration
echo "Backing up configuration..."
cp .env "$BACKUP_DIR/config/"
cp docker-compose.production.yml "$BACKUP_DIR/config/"
cp -r deployment/ "$BACKUP_DIR/config/"

# 6. Create manifest
cat > "$BACKUP_DIR/manifest.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "version": "$(git describe --tags)",
  "components": {
    "postgres": "dgos.dump",
    "redis": "dump.rdb",
    "secrets": "ciphertext/",
    "packages": "packages.tar.gz",
    "config": "config/"
  }
}
EOF

# 7. Calculate checksums
echo "Calculating checksums..."
find "$BACKUP_DIR" -type f -exec sha256sum {} \; > "$BACKUP_DIR/checksums.txt"

# 8. Set permissions
chmod -R 700 "$BACKUP_DIR"

echo "✓ Backup completed: $BACKUP_DIR"
echo "Backup size: $(du -sh $BACKUP_DIR | cut -f1)"
```

### Full System Restore Script

```bash
#!/bin/bash
# full-system-restore.sh

set -euo pipefail

BACKUP_DIR="${1:?Usage: $0 BACKUP_DIR}"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "Error: Backup directory not found: $BACKUP_DIR"
  exit 1
fi

echo "Restoring from: $BACKUP_DIR"

# 1. Verify checksums
echo "Verifying backup integrity..."
cd "$BACKUP_DIR"
sha256sum -c checksums.txt

# 2. Stop services
echo "Stopping services..."
docker compose down

# 3. Restore PostgreSQL
echo "Restoring PostgreSQL..."
dropdb --if-exists dgos
createdb dgos
pg_restore --dbname=dgos "$BACKUP_DIR/postgres/dgos.dump"

# 4. Restore Redis
echo "Restoring Redis..."
docker compose cp "$BACKUP_DIR/redis/dump.rdb" redis:/data/dump.rdb

# 5. Restore secrets
echo "Restoring secrets..."
node scripts/v1-ops-restore.mjs \
  "$BACKUP_DIR/secrets/ciphertext" \
  /var/lib/dgos/ciphertext \
  /run/dgos-root-keys

# 6. Restore packages
echo "Restoring packages..."
tar xzf "$BACKUP_DIR/packages/packages.tar.gz" -C /

# 7. Restore configuration
echo "Restoring configuration..."
cp "$BACKUP_DIR/config/.env" .env
cp "$BACKUP_DIR/config/docker-compose.production.yml" .

# 8. Start services
echo "Starting services..."
docker compose up -d

# 9. Verify
echo "Verifying restore..."
sleep 10
curl -f http://localhost:3000/ready
curl -f http://localhost:3000/health

echo "✓ Restore completed successfully"
```

### Automated Backup Schedule

**Cron configuration**:
```bash
# /etc/cron.d/dgos-backup

# Full backup daily at 2 AM
0 2 * * * root /opt/dgos/scripts/full-system-backup.sh

# PostgreSQL backup every 6 hours
0 */6 * * * root pg_dump $DGOS_DATABASE_URL | gzip > /backup/postgres/hourly-$(date +\%H).sql.gz

# Redis snapshot every hour
0 * * * * root docker compose exec -T redis redis-cli BGSAVE

# Cleanup old backups (keep 30 days)
0 3 * * * root find /backup/dgos -type d -mtime +30 -exec rm -rf {} \;
```

### Disaster Recovery

#### Recovery Time Objective (RTO)

- **Full restore from backup**: 30-60 minutes
- **Database restore only**: 10-20 minutes
- **Hot standby failover**: < 5 minutes

#### Recovery Point Objective (RPO)

- **With hourly backups**: Up to 1 hour data loss
- **With WAL archiving**: Up to 5 minutes data loss (archive_timeout)
- **With streaming replication**: Near-zero data loss

#### Disaster Scenarios

**Scenario 1: Database Corruption**
```bash
# 1. Identify corruption
psql $DGOS_DATABASE_URL -c "SELECT * FROM admin_principals LIMIT 1;"
# ERROR: invalid page header

# 2. Stop services
docker compose down

# 3. Restore from last good backup
./scripts/full-system-restore.sh /backup/dgos/20261002-020000

# 4. Restart services
docker compose up -d
```

**Scenario 2: Accidental Data Deletion**
```bash
# 1. Stop writes immediately
docker compose stop api worker

# 2. Point-in-time recovery to before deletion
# Restore to 5 minutes before incident
./scripts/pitr-restore.sh "2026-10-02 14:55:00"

# 3. Verify data restored
psql dgos -c "SELECT count(*) FROM admin_principals;"

# 4. Resume operations
docker compose up -d
```

**Scenario 3: Complete Server Loss**
```bash
# 1. Provision new server
# 2. Install dependencies (Docker, PostgreSQL client, etc.)
# 3. Clone repository
git clone <repository-url> && cd DGOS

# 4. Restore from off-site backup
aws s3 cp s3://dgos-backups/latest.tar.gz /tmp/
tar xzf /tmp/latest.tar.gz -C /backup/

# 5. Full system restore
./scripts/full-system-restore.sh /backup/dgos/latest

# 6. Update DNS/load balancer to new server
```

### Backup Verification

**Automated restore testing**:
```bash
#!/bin/bash
# test-backup.sh - Run weekly to verify backups are restorable

LATEST_BACKUP=$(ls -t /backup/dgos/ | head -1)
TEST_DB="dgos_backup_test_$(date +%s)"

# Create test database
createdb "$TEST_DB"

# Restore backup
pg_restore --dbname="$TEST_DB" "/backup/dgos/$LATEST_BACKUP/postgres/dgos.dump"

# Run validation queries
psql "$TEST_DB" -c "SELECT count(*) FROM dgos_schema_migrations;" | grep 47
psql "$TEST_DB" -c "SELECT count(*) FROM admin_principals WHERE status='active';"

# Cleanup
dropdb "$TEST_DB"

echo "✓ Backup verification passed: $LATEST_BACKUP"
```

---

## Troubleshooting Guide

### Migration Failures

#### Issue 1: Checksum Mismatch

**Error**:
```
migration checksum mismatch: 0045-network-route-activation
```

**Cause**: Migration file was modified after initial application

**Solution**:
```bash
# 1. Check current checksum
node scripts/migrate.mjs | jq '.[] | select(.version=="0045-network-route-activation")'

# 2. Compare with frozen checksum in v1-ops-migrate.mjs
grep "0045-network-route-activation" scripts/v1-ops-migrate.mjs

# 3. If file is correct, checksum recorded in DB is wrong
# This indicates database was modified outside migration system
# Options:
# A. Restore from backup before corruption
# B. Contact support for manual fix

# 4. If file was modified incorrectly, restore from git
git checkout HEAD -- migrations/0045-network-route-activation.sql
```

#### Issue 2: Disk Space Exhausted

**Error**:
```
ERROR: could not extend file "base/16384/16389": No space left on device
```

**Cause**: Migration creates indexes or large tables, filling disk

**Solution**:
```bash
# 1. Check disk space
df -h /var/lib/postgresql/data

# 2. Stop services
docker compose down

# 3. Clean up space
# Remove old WAL files
find /var/lib/postgresql/data/pg_wal -type f -mtime +7 -delete

# Remove temporary files
rm -rf /var/lib/postgresql/data/pgsql_tmp/*

# 4. Or expand disk volume
# AWS: resize EBS volume
# Azure: expand managed disk
# On-prem: add more storage

# 5. Resume migration
docker compose up migrate
```

#### Issue 3: Lock Timeout

**Error**:
```
ERROR: canceling statement due to lock timeout
```

**Cause**: Long-running queries blocking migration

**Solution**:
```bash
# 1. Identify blocking queries
psql $DGOS_DATABASE_URL << 'EOF'
SELECT pid, usename, query, state, wait_event
FROM pg_stat_activity
WHERE state != 'idle' AND pid != pg_backend_pid()
ORDER BY query_start;
EOF

# 2. Terminate blocking queries (use with caution)
psql $DGOS_DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND pid != pg_backend_pid();"

# 3. Retry migration
docker compose up migrate
```

#### Issue 4: Duplicate Key Violation

**Error**:
```
ERROR: duplicate key value violates unique constraint "admin_principals_pkey"
```

**Cause**: Data inconsistency or concurrent migration attempts

**Solution**:
```bash
# 1. Check if migration already partially applied
psql $DGOS_DATABASE_URL -c "SELECT version FROM dgos_schema_migrations ORDER BY version DESC LIMIT 10;"

# 2. If migration recorded as complete, check for data corruption
psql $DGOS_DATABASE_URL -c "SELECT count(*) FROM admin_principals;"

# 3. Restore from backup if data corrupted
./scripts/full-system-restore.sh /backup/dgos/latest

# 4. Prevent concurrent migrations
# Ensure only one migration process runs at a time
# Use advisory locks in migration script
```

#### Issue 5: Foreign Key Constraint Violation

**Error**:
```
ERROR: insert or update on table violates foreign key constraint
```

**Cause**: Orphaned records or migration order issue

**Solution**:
```bash
# 1. Identify orphaned records
psql $DGOS_DATABASE_URL << 'EOF'
SELECT 'api_key_records' as table_name, count(*) as orphaned
FROM api_key_records
WHERE owner_id NOT IN (SELECT principal_id FROM admin_principals)
UNION ALL
SELECT 'admin_sessions', count(*)
FROM admin_sessions
WHERE principal_id NOT IN (SELECT principal_id FROM admin_principals);
EOF

# 2. Clean up orphaned records before migration
psql $DGOS_DATABASE_URL << 'EOF'
BEGIN;
DELETE FROM api_key_records WHERE owner_id NOT IN (SELECT principal_id FROM admin_principals);
DELETE FROM admin_sessions WHERE principal_id NOT IN (SELECT principal_id FROM admin_principals);
COMMIT;
EOF

# 3. Retry migration
docker compose up migrate
```

### Version Conflicts

#### Issue 6: API Version Mismatch

**Error**:
```
Error: API version v1.1.0 requires database schema v47, found v45
```

**Cause**: Application upgraded without running migrations

**Solution**:
```bash
# 1. Check current schema version
psql $DGOS_DATABASE_URL -c "SELECT version FROM dgos_schema_migrations ORDER BY version DESC LIMIT 1;"

# 2. Run missing migrations
docker compose up migrate

# 3. Verify schema version
psql $DGOS_DATABASE_URL -c "SELECT count(*) FROM dgos_schema_migrations;"
# Should be 47

# 4. Restart application
docker compose restart api worker
```

#### Issue 7: Downgrade Detected

**Error**:
```
Error: Cannot downgrade from v1.1.0 to v1.0.0 without database restore
```

**Cause**: Attempting to run older application version with newer schema

**Solution**:
```bash
# Option A: Upgrade application to match schema
git checkout v1.1.0
docker compose up -d

# Option B: Restore database to match application
./scripts/full-system-restore.sh /backup/dgos/v1.0-latest
docker compose up -d
```

### Data Corruption

#### Issue 8: Invalid Page Header

**Error**:
```
ERROR: invalid page header in block 12345 of relation base/16384/16789
```

**Cause**: Hardware failure, disk corruption, crash during write

**Solution**:
```bash
# 1. Stop all database access immediately
docker compose down

# 2. Attempt PostgreSQL recovery
docker compose up postgres
# Watch logs for recovery messages

# 3. If recovery fails, restore from backup
dropdb dgos
createdb dgos
pg_restore --dbname=dgos /backup/postgres/dgos-latest.dump

# 4. If backup is old, use WAL replay for point-in-time recovery
./scripts/pitr-restore.sh "2026-10-02 14:00:00"

# 5. Verify data integrity
psql dgos -c "VACUUM ANALYZE;"
psql dgos -c "REINDEX DATABASE dgos;"
```

#### Issue 9: Referential Integrity Violation

**Error**: Data inconsistency detected during validation

**Solution**:
```bash
# 1. Run integrity check
node scripts/data-validate.mjs

# 2. Fix orphaned records
psql $DGOS_DATABASE_URL << 'EOF'
BEGIN;
-- Remove orphaned sessions
DELETE FROM admin_sessions 
WHERE principal_id NOT IN (SELECT principal_id FROM admin_principals);

-- Remove orphaned API keys
DELETE FROM api_key_records 
WHERE owner_id NOT IN (SELECT principal_id FROM admin_principals);

-- Remove orphaned provider bindings
DELETE FROM provider_bindings 
WHERE account_id NOT IN (SELECT account_id FROM provider_accounts);

COMMIT;
EOF

# 3. Rebuild indexes
psql $DGOS_DATABASE_URL -c "REINDEX DATABASE dgos;"

# 4. Re-validate
node scripts/data-validate.mjs
```

### Performance Degradation

#### Issue 10: Slow Queries After Migration

**Symptoms**: Response times increased 10x after migration

**Diagnosis**:
```bash
# 1. Check missing indexes
psql $DGOS_DATABASE_URL << 'EOF'
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
EOF

# 2. Identify slow queries
psql $DGOS_DATABASE_URL << 'EOF'
SELECT calls, mean_exec_time, query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
EOF

# 3. Check table bloat
psql $DGOS_DATABASE_URL -c "SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

**Solution**:
```bash
# 1. Update statistics
psql $DGOS_DATABASE_URL -c "ANALYZE;"

# 2. Rebuild indexes
psql $DGOS_DATABASE_URL -c "REINDEX DATABASE dgos;"

# 3. Vacuum full (requires downtime)
docker compose down
psql $DGOS_DATABASE_URL -c "VACUUM FULL;"
docker compose up -d

# 4. Increase shared_buffers if needed
# Edit postgresql.conf:
# shared_buffers = 2GB  # 25% of RAM
```

#### Issue 11: Connection Pool Exhaustion

**Error**:
```
Error: remaining connection slots are reserved for non-replication superuser connections
```

**Cause**: Too many idle connections after upgrade

**Solution**:
```bash
# 1. Check current connections
psql $DGOS_DATABASE_URL -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"

# 2. Increase max_connections in PostgreSQL
# postgresql.conf:
# max_connections = 200  # Default is 100

# 3. Tune connection pool in application
# .env:
# DATABASE_POOL_MIN=10
# DATABASE_POOL_MAX=20

# 4. Kill idle connections
psql $DGOS_DATABASE_URL << 'EOF'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < now() - interval '10 minutes'
  AND pid != pg_backend_pid();
EOF

# 5. Restart services
docker compose restart api worker
```

### Recovery Procedures

#### Procedure 1: Emergency Rollback

When everything goes wrong:

```bash
#!/bin/bash
# emergency-rollback.sh

set -euo pipefail

echo "🚨 EMERGENCY ROLLBACK INITIATED"

# 1. Stop all services immediately
echo "Stopping services..."
docker compose down --remove-orphans

# 2. Identify latest good backup
LATEST_BACKUP=$(ls -t /backup/dgos/ | head -1)
echo "Using backup: $LATEST_BACKUP"

# 3. Verify backup integrity
cd "/backup/dgos/$LATEST_BACKUP"
sha256sum -c checksums.txt || exit 1

# 4. Restore database
echo "Restoring database..."
dropdb --if-exists dgos
createdb dgos
pg_restore --dbname=dgos postgres/dgos.dump

# 5. Restore secrets
echo "Restoring secrets..."
node scripts/v1-ops-restore.mjs \
  "/backup/dgos/$LATEST_BACKUP/secrets/ciphertext" \
  /var/lib/dgos/ciphertext \
  /run/dgos-root-keys

# 6. Checkout last known good version
echo "Rolling back code..."
BACKUP_VERSION=$(cat "/backup/dgos/$LATEST_BACKUP/manifest.json" | jq -r '.version')
git checkout "$BACKUP_VERSION"

# 7. Rebuild images
echo "Building images..."
docker compose build

# 8. Start services
echo "Starting services..."
docker compose up -d

# 9. Wait for health check
echo "Waiting for services to be ready..."
for i in {1..60}; do
  if curl -sf http://localhost:3000/ready > /dev/null; then
    echo "✓ Services are healthy"
    break
  fi
  sleep 2
done

# 10. Verify
curl -f http://localhost:3000/health
echo "✓ ROLLBACK COMPLETE"
```

#### Procedure 2: Partial Data Recovery

Recover specific data from backup without full restore:

```bash
# 1. Restore backup to temporary database
createdb dgos_recovery
pg_restore --dbname=dgos_recovery /backup/postgres/dgos-latest.dump

# 2. Extract specific data
psql dgos_recovery -c "COPY (SELECT * FROM admin_principals WHERE principal_id = 'abc-123') TO STDOUT" | \
psql dgos -c "COPY admin_principals FROM STDIN"

# 3. Clean up
dropdb dgos_recovery
```

#### Procedure 3: Split-Brain Resolution

When multiple instances have diverged:

```bash
# 1. Identify primary (most recent, most complete)
psql instance1 -c "SELECT max(applied_at) FROM dgos_schema_migrations;"
psql instance2 -c "SELECT max(applied_at) FROM dgos_schema_migrations;"

# 2. Choose primary (e.g., instance1)
# 3. Backup secondary for safety
pg_dump instance2 > /backup/instance2-diverged.sql

# 4. Drop secondary and restore from primary
dropdb instance2
createdb instance2
pg_dump instance1 | psql instance2

# 5. Verify synchronization
diff <(psql instance1 -c "SELECT version FROM dgos_schema_migrations ORDER BY version;") \
     <(psql instance2 -c "SELECT version FROM dgos_schema_migrations ORDER BY version;")
```

### Common Errors Reference

| Error Code | Description | Quick Fix |
|------------|-------------|-----------|
| `ECONNREFUSED` | Cannot connect to database | Check PostgreSQL is running: `docker compose ps postgres` |
| `53300` | Too many connections | Increase `max_connections` or kill idle connections |
| `42P01` | Relation does not exist | Run migrations: `docker compose up migrate` |
| `23505` | Unique constraint violation | Check for duplicate data or concurrent inserts |
| `23503` | Foreign key violation | Clean up orphaned records before migration |
| `57014` | Query canceled | Increase `statement_timeout` or optimize query |
| `40P01` | Deadlock detected | Retry transaction or reorder operations |
| `08006` | Connection failure | Check network, PostgreSQL logs, restart database |

### Getting Help

**Before contacting support, gather**:

1. **System information**
```bash
# Version
git describe --tags

# Database version
psql $DGOS_DATABASE_URL -c "SELECT version FROM dgos_schema_migrations ORDER BY version DESC LIMIT 1;"

# Environment
docker compose version
psql --version
redis-cli --version
```

2. **Error logs**
```bash
docker compose logs --tail=500 api worker migrate > /tmp/dgos-logs.txt
psql $DGOS_DATABASE_URL -c "SELECT * FROM pg_stat_activity;" > /tmp/pg-activity.txt
```

3. **System state**
```bash
docker compose ps
df -h
free -h
cat /proc/loadavg
```

4. **Recent changes**
```bash
git log --oneline -10
docker compose config
cat .env | grep -v PASSWORD | grep -v SECRET
```

**Support channels**:
- GitHub Issues: https://github.com/org/dgos/issues
- Slack: #dgos-support
- Email: support@dgos.io (include logs and system info)

---

## Appendix: Migration Reference

### Migration File Structure

Each migration file follows this pattern:

```sql
-- Migration description. PostgreSQL 14+.
-- Expand phase: backward compatible additions only.

-- Create new tables
CREATE TABLE IF NOT EXISTS new_table (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add new columns with defaults (safe)
ALTER TABLE existing_table ADD COLUMN IF NOT EXISTS new_column text;

-- Add indexes concurrently (no blocking)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_name ON table_name (column);

-- Add constraints (check data first)
ALTER TABLE table_name ADD CONSTRAINT chk_name CHECK (condition);
```

### Migration Dependencies

Some migrations depend on others:

```
0001-v1-governance.sql
  ↓
0002-connection-test-leases.sql (references provider_accounts)
0003-audit-outbox-leases.sql (references audit_events)
  ↓
0005-quota-usage.sql
  ↓
0009-quota-usage-dimensions.sql (extends 0005)
0010-quota-usage-idempotency.sql (extends 0005)
```

### Schema Evolution Timeline

```
V1.0.0 (migrations 0001-0044)
  - Foundation governance tables
  - Provider system
  - Runtime and worker infrastructure
  - Quota and usage tracking
  - Extension and package management

V1.0.1 (migrations 0045-0047)
  - Network route activation
  - Package retention policies
  - AI task parameters

V1.0.2 (migrations 0048-0051)
  - Network route fingerprinting
  - Extension management improvements
  - Session management enhancements
  - Proxy provisioning

V1.1.0 (planned)
  - Multi-tenant isolation
  - Advanced RBAC
  - Audit log streaming
```

### Testing Migrations

```bash
# Test suite for migrations
npm run test:integration

# Specific migration test
node --test tests/integration/migrations.test.mjs

# Test migration idempotency (run twice)
docker compose up migrate
docker compose up migrate  # Should succeed with no changes
```

### Migration Performance

Typical migration times:

| Migration | Time | Notes |
|-----------|------|-------|
| 0001-v1-governance | ~500ms | Creates 10 tables |
| 0005-quota-usage | ~200ms | Creates 2 tables |
| 0011-runtime-persistence | ~300ms | Creates 3 tables |
| 0025-extension-registry | ~150ms | Creates 1 table |
| 0044-system-projection | ~400ms | Creates 1 complex table |
| Full migration (0001-0051) | ~8s | On fresh database |
| Full migration (existing) | ~2s | Skips existing migrations |

### Security Considerations

**Migration safety checklist**:

- [ ] Migration tested on copy of production data
- [ ] No sensitive data in migration files
- [ ] Migrations are idempotent (safe to re-run)
- [ ] Transactions wrap each migration
- [ ] Checksums validated before application
- [ ] Backup created before migration
- [ ] Rollback plan documented
- [ ] Downtime window scheduled (if needed)
- [ ] Team notified of maintenance
- [ ] Monitoring ready for post-migration

### Useful SQL Queries

**Check migration status**:
```sql
SELECT version, applied_at 
FROM dgos_schema_migrations 
ORDER BY version;
```

**Find missing migrations**:
```sql
WITH expected AS (
  SELECT unnest(ARRAY['0001-v1-governance', '0002-connection-test-leases', /* ... */]) AS version
)
SELECT expected.version AS missing_migration
FROM expected
LEFT JOIN dgos_schema_migrations ON expected.version = dgos_schema_migrations.version
WHERE dgos_schema_migrations.version IS NULL;
```

**Table sizes**:
```sql
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Index usage**:
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

**Lock monitoring during migration**:
```sql
SELECT 
  l.pid,
  l.mode,
  l.granted,
  a.query,
  a.state
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.relation = 'admin_principals'::regclass;
```

---

## Document Control

**Version History**:

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-10-02 | Initial comprehensive migration guide | DGOS Team |

**Review Cycle**: Quarterly or after each major release

**Next Review**: 2027-01-02

**Maintained by**: DevOps Team

**Contact**: devops@dgos.io

---

**End of Migration and Upgrade Guide**
