# DGOS V1 Migration Quick Reference

**Quick access guide for common migration tasks**

---

## Emergency Contacts
- **Support Email**: support@dgos.io
- **GitHub Issues**: https://github.com/org/dgos/issues
- **Slack**: #dgos-support

---

## Quick Commands

### Run Migrations
```bash
# Production migration
DGOS_DATABASE_URL=$PRODUCTION_URL node scripts/v1-ops-migrate.mjs

# Generate migration SQL (preview)
node scripts/migrate.mjs --print-sql
```

### Backup
```bash
# Full system backup
./scripts/full-system-backup.sh

# PostgreSQL only
pg_dump $DGOS_DATABASE_URL --format=custom --file=backup.dump

# Secrets only
node scripts/v1-ops-backup.mjs /var/lib/dgos/ciphertext /backup/secrets
```

### Restore
```bash
# Full system restore
./scripts/full-system-restore.sh /backup/dgos/20261002-120000

# PostgreSQL only
pg_restore --dbname=dgos backup.dump

# Secrets only
node scripts/v1-ops-restore.mjs /backup/secrets /var/lib/dgos/ciphertext /run/dgos-root-keys
```

### Data Migration
```bash
# Export
DGOS_DATABASE_URL=$SOURCE node scripts/data-export-users.mjs > users.json
DGOS_DATABASE_URL=$SOURCE node scripts/data-export-config.mjs > config.json
DGOS_DATABASE_URL=$SOURCE node scripts/data-export-packages.mjs > packages.json

# Import
DGOS_DATABASE_URL=$TARGET node scripts/data-import.mjs users users.json
DGOS_DATABASE_URL=$TARGET node scripts/data-import.mjs config config.json
DGOS_DATABASE_URL=$TARGET node scripts/data-import.mjs packages packages.json

# Validate
DGOS_DATABASE_URL=$TARGET node scripts/data-validate.mjs
```

### Health Checks
```bash
# Service health
curl http://localhost:3000/ready
curl http://localhost:3000/health

# Database version
psql $DGOS_DATABASE_URL -c "SELECT version FROM dgos_schema_migrations ORDER BY version DESC LIMIT 1;"

# Database connections
psql $DGOS_DATABASE_URL -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
```

---

## Pre-Migration Checklist

- [ ] Review release notes and breaking changes
- [ ] Full system backup created and verified
- [ ] Test migrations on database copy
- [ ] Application tests pass on test environment
- [ ] Maintenance window scheduled
- [ ] Team notified
- [ ] Rollback plan documented
- [ ] Monitoring dashboards ready
- [ ] Disk space verified (> 20% free)
- [ ] Database connections minimal

---

## Migration Decision Tree

```
Is this a new installation?
├─ YES → Run all migrations: docker compose up migrate
└─ NO → Continue below

Is this a minor version upgrade (v1.0 → v1.1)?
├─ YES → Run new migrations only
└─ NO → Continue below

Is this a major version upgrade (v1.x → v2.0)?
├─ YES → Follow V2 migration guide
└─ NO → Contact support

Have you tested on a copy?
├─ NO → STOP. Test first!
└─ YES → Continue

Do you have a verified backup?
├─ NO → STOP. Backup first!
└─ YES → Proceed with migration
```

---

## Rollback Decision Tree

```
Is the issue critical (data loss, security breach)?
├─ YES → Emergency rollback immediately
└─ NO → Continue below

Can the issue be fixed forward?
├─ YES → Apply hotfix, monitor
└─ NO → Continue below

Is backup < 4 hours old?
├─ YES → Restore from backup
└─ NO → Attempt manual fix or contact support

After rollback, how much data loss?
├─ Acceptable → Document and proceed
└─ Unacceptable → Attempt point-in-time recovery
```

---

## Troubleshooting Quick Fixes

### Migration fails with "disk full"
```bash
df -h /var/lib/postgresql/data
# Free up space or expand volume
docker compose up migrate
```

### Migration fails with "lock timeout"
```bash
# Kill blocking queries
psql $DGOS_DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND pid != pg_backend_pid();"
# Retry
docker compose up migrate
```

### "Checksum mismatch" error
```bash
# Restore migration file from git
git checkout HEAD -- migrations/XXXX-name.sql
# Retry
docker compose up migrate
```

### Application won't start after migration
```bash
# Check migration status
psql $DGOS_DATABASE_URL -c "SELECT count(*) FROM dgos_schema_migrations;"
# Should be 47

# Check logs
docker compose logs api | tail -50

# Restart services
docker compose restart api worker
```

### Slow queries after migration
```bash
# Update statistics
psql $DGOS_DATABASE_URL -c "ANALYZE;"

# Rebuild indexes
psql $DGOS_DATABASE_URL -c "REINDEX DATABASE dgos;"
```

---

## Support Information to Gather

Before contacting support, collect:

```bash
# System info
git describe --tags > /tmp/support-info.txt
psql $DGOS_DATABASE_URL -c "SELECT version FROM dgos_schema_migrations ORDER BY version DESC LIMIT 1;" >> /tmp/support-info.txt
docker compose version >> /tmp/support-info.txt

# Logs
docker compose logs --tail=500 api worker migrate > /tmp/dgos-logs.txt

# Database state
psql $DGOS_DATABASE_URL -c "\dt+" > /tmp/db-tables.txt
psql $DGOS_DATABASE_URL -c "SELECT * FROM pg_stat_activity;" > /tmp/db-activity.txt

# System resources
df -h >> /tmp/support-info.txt
free -h >> /tmp/support-info.txt
```

Then send `/tmp/support-info.txt` and `/tmp/dgos-logs.txt` to support.

---

## Migration Timeline Estimates

| Operation | Fresh DB | Existing DB | Notes |
|-----------|----------|-------------|-------|
| All 47 migrations | ~8s | ~2s | Skips existing |
| PostgreSQL backup (1GB) | - | ~30s | Custom format |
| PostgreSQL restore (1GB) | - | ~45s | Parallel restore |
| Full system backup | - | ~2-5 min | All components |
| Full system restore | - | ~5-10 min | All components |
| Blue-green cutover | - | < 1 min | No downtime |
| Rolling update | - | ~5 min | Gradual cutover |

---

## Critical File Locations

```
/var/lib/dgos/ciphertext          # Encrypted secrets
/var/lib/dgos/packages            # Application packages
/var/lib/postgresql/data          # PostgreSQL data
/backup/dgos                      # System backups
/Users/apple/Progame/DGOS         # Application root
```

---

## Emergency Procedures

### Emergency Stop
```bash
docker compose down
```

### Emergency Rollback (< 5 minutes)
```bash
./scripts/emergency-rollback.sh
```

### Emergency Backup (< 2 minutes)
```bash
pg_dump $DGOS_DATABASE_URL | gzip > /backup/emergency-$(date +%s).sql.gz
```

---

## See Also

- **Full Migration Guide**: `docs/05-测试与发布/V1-Migration-Guide.md`
- **Deployment Guide**: `docs/05-测试与发布/V1-Deployment-Guide.md`
- **Security Baseline**: `docs/05-测试与发布/安全基线.md`

---

**Last Updated**: 2026-10-02  
**Maintained by**: DevOps Team
