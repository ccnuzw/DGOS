# DGOS V1 Operations Runbook

**Version**: V1.0.0  
**Last Updated**: 2026-10-02  
**Audience**: Operations, SRE, DevOps Engineers

---

## Table of Contents

1. [Incident Response Playbooks](#incident-response-playbooks)
2. [Daily Operations](#daily-operations)
3. [Maintenance Procedures](#maintenance-procedures)
4. [Monitoring & Alerting](#monitoring--alerting)
5. [Scaling Procedures](#scaling-procedures)
6. [Disaster Recovery](#disaster-recovery)
7. [Common Operations Tasks](#common-operations-tasks)
8. [Contact & Escalation](#contact--escalation)

---

## Incident Response Playbooks

### General Incident Response Framework

**Detection → Diagnosis → Mitigation → Resolution → Postmortem**

**Response Roles**:
- **Incident Commander**: Coordinates response, makes decisions
- **Technical Lead**: Diagnoses root cause, implements fixes
- **Communications**: Updates stakeholders, maintains incident log
- **Scribe**: Documents timeline, commands executed, observations

**Severity Levels**:
- **SEV1**: Service down, data loss, security breach (respond immediately)
- **SEV2**: Degraded performance, partial outage (respond within 30 min)
- **SEV3**: Minor issues, no user impact (address during business hours)

---

### Playbook 1: API Service Down

**Symptoms**:
- `/health` endpoint returns 5xx or times out
- Users cannot access web interface
- High error rates in logs
- No response from API container/process

#### Detection

```bash
# Check API health
curl -f http://localhost:3000/health || echo "API DOWN"

# Check API ready state
curl -f http://localhost:3000/ready || echo "API NOT READY"

# Check container status (Docker)
docker ps | grep api

# Check process status (systemd)
systemctl status dgos-api
```

#### Diagnosis

```bash
# Check API logs (Docker)
docker logs dgos_api_1 --tail 100

# Check API logs (systemd)
journalctl -u dgos-api -n 100 --no-pager

# Check for common issues
# 1. Database connectivity
docker exec dgos_api_1 node -e "const pg=require('pg');const pool=new pg.Pool({connectionString:process.env.DGOS_DATABASE_URL});pool.query('SELECT 1').then(()=>{console.log('DB OK');process.exit(0)}).catch((e)=>{console.error('DB FAIL:',e.message);process.exit(1)})"

# 2. Redis connectivity
docker exec dgos_api_1 node -e "const redis=require('redis');const client=redis.createClient({url:process.env.REDIS_URL});client.connect().then(()=>client.ping()).then(()=>{console.log('REDIS OK');process.exit(0)}).catch((e)=>{console.error('REDIS FAIL:',e.message);process.exit(1)})"

# 3. Port conflicts
netstat -tulpn | grep 3000

# 4. Resource exhaustion
docker stats dgos_api_1 --no-stream
```

#### Mitigation

```bash
# Quick restart (Docker)
docker restart dgos_api_1

# Quick restart (systemd)
systemctl restart dgos-api

# Check if restart resolved issue
sleep 10
curl -f http://localhost:3000/health
```

#### Resolution

**If database connection fails**:
```bash
# Check PostgreSQL status
docker exec dgos_postgres_1 pg_isready -U ${DGOS_POSTGRES_USER}

# Check connection pool exhaustion
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT count(*) FROM pg_stat_activity WHERE datname='${DGOS_POSTGRES_DB}';"

# Restart PostgreSQL if needed (CAUTION: will drop connections)
docker restart dgos_postgres_1
```

**If Redis connection fails**:
```bash
# Check Redis status
docker exec dgos_redis_1 redis-cli ping

# Restart Redis (safe - data is not persisted in production config)
docker restart dgos_redis_1
```

**If out of memory**:
```bash
# Check memory usage
free -h
docker stats --no-stream

# Increase memory limits (edit docker-compose.production.yml)
# Then restart with new limits
docker compose -f docker-compose.production.yml up -d api
```

**If migration state mismatch**:
```bash
# Check current migration version
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT version FROM dgos_migrations ORDER BY id DESC LIMIT 1;"

# Run migrations if needed
docker compose -f docker-compose.production.yml run --rm migrate
```

---

### Playbook 2: Worker Service Down

**Symptoms**:
- AI tasks stuck in "pending" or "claimed" state
- Provider connection tests not running
- Extension background jobs not executing
- No worker heartbeat in logs

#### Detection

```bash
# Check worker status
docker ps | grep worker
systemctl status dgos-worker

# Check for stale task claims
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT task_id, state, claimed_at, claimed_by FROM ai_tasks WHERE state='claimed' AND claimed_at < NOW() - INTERVAL '5 minutes';"

# Check worker logs
docker logs dgos_worker_1 --tail 50
journalctl -u dgos-worker -n 50
```

#### Diagnosis

```bash
# Check worker configuration
docker exec dgos_worker_1 env | grep DGOS_

# Check for task processing errors
docker logs dgos_worker_1 | grep -i error | tail -20

# Check database connectivity from worker
docker exec dgos_worker_1 node -e "const pg=require('pg');const pool=new pg.Pool({connectionString:process.env.DGOS_DATABASE_URL});pool.query('SELECT 1').then(()=>{console.log('OK');process.exit(0)}).catch((e)=>{console.error(e.message);process.exit(1)})"

# Check for network route issues
docker logs dgos_worker_1 | grep "network_route"
```

#### Mitigation

```bash
# Restart worker
docker restart dgos_worker_1
systemctl restart dgos-worker

# Verify worker is processing tasks
sleep 10
docker logs dgos_worker_1 --tail 20 | grep "task_claimed\|task_completed"
```

#### Resolution

**If tasks are permanently stuck**:
```bash
# Release stale task claims (run clear-stale-locks script)
docker compose -f docker-compose.production.yml run --rm \
  -e DGOS_DATABASE_URL="${DGOS_DATABASE_URL}" \
  api node scripts/v1-ops-clear-stale-locks.mjs

# Verify tasks released
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT COUNT(*) FROM ai_tasks WHERE state='claimed' AND claimed_at < NOW() - INTERVAL '5 minutes';"
```

**If worker cannot connect to providers**:
```bash
# Check network egress
docker exec dgos_worker_1 curl -I https://api.openai.com/v1/models

# Check proxy configuration
docker exec dgos_worker_1 env | grep -i proxy

# Check provider credentials
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT provider_id, state, disabled FROM provider_configs WHERE disabled=false;"
```

---

### Playbook 3: Database Issues

**Symptoms**:
- Slow query performance
- Connection pool exhaustion
- Disk space warnings
- Replication lag
- Transaction conflicts

#### Detection

```bash
# Check database status
docker exec dgos_postgres_1 pg_isready

# Check active connections
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT count(*), state FROM pg_stat_activity WHERE datname='${DGOS_POSTGRES_DB}' GROUP BY state;"

# Check long-running queries
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT pid, now() - query_start AS duration, state, query FROM pg_stat_activity WHERE state != 'idle' AND now() - query_start > interval '30 seconds' ORDER BY duration DESC;"

# Check database size
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT pg_size_pretty(pg_database_size('${DGOS_POSTGRES_DB}'));"

# Check table bloat
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables WHERE schemaname='public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 10;"
```

#### Diagnosis

**Connection pool exhaustion**:
```bash
# Check max connections setting
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -c "SHOW max_connections;"

# Check current connections by application
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT application_name, count(*), state FROM pg_stat_activity WHERE datname='${DGOS_POSTGRES_DB}' GROUP BY application_name, state;"

# Identify connection leaks
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT pid, application_name, state, state_change, now() - state_change AS idle_duration FROM pg_stat_activity WHERE state = 'idle' AND now() - state_change > interval '10 minutes';"
```

**Slow queries**:
```bash
# Enable query logging (temporarily)
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -c "ALTER SYSTEM SET log_min_duration_statement = 1000;"
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -c "SELECT pg_reload_conf();"

# Check for missing indexes
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT schemaname, tablename, seq_scan, seq_tup_read, idx_scan, seq_tup_read / seq_scan AS avg_seq_tup FROM pg_stat_user_tables WHERE seq_scan > 0 AND seq_tup_read / seq_scan > 10000 ORDER BY seq_tup_read DESC LIMIT 10;"
```

**Disk space issues**:
```bash
# Check disk usage
df -h | grep postgres

# Check WAL files
docker exec dgos_postgres_1 du -sh /var/lib/postgresql/data/pg_wal

# Check for large tables needing cleanup
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT tablename, pg_size_pretty(pg_total_relation_size('public.'||tablename)) FROM pg_tables WHERE schemaname='public' ORDER BY pg_total_relation_size('public.'||tablename) DESC LIMIT 5;"
```

#### Mitigation

**Kill long-running queries**:
```bash
# Identify problematic query PID
PID=<pid-from-diagnosis>

# Terminate gracefully
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT pg_terminate_backend(${PID});"

# Force kill if needed
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT pg_cancel_backend(${PID});"
```

**Release idle connections**:
```bash
# Kill idle connections older than 1 hour
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND now() - state_change > interval '1 hour' AND datname='${DGOS_POSTGRES_DB}';"
```

#### Resolution

**Optimize database performance**:
```bash
# Run VACUUM ANALYZE (safe, can run online)
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "VACUUM ANALYZE;"

# Check vacuum progress
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT * FROM pg_stat_progress_vacuum;"

# Reindex if needed (CAUTION: locks tables)
# Schedule during maintenance window
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "REINDEX DATABASE ${DGOS_POSTGRES_DB};"
```

**Increase connection limits**:
```bash
# Edit postgresql.conf or docker-compose.yml
# Add command override
# command: ["-c", "max_connections=200"]

# Restart PostgreSQL
docker restart dgos_postgres_1
```

---

### Playbook 4: Redis Failures

**Symptoms**:
- Session failures ("session_invalid")
- High cache miss rates
- Rate limiting not working
- Connection timeouts to Redis

#### Detection

```bash
# Check Redis status
docker exec dgos_redis_1 redis-cli ping

# Check Redis info
docker exec dgos_redis_1 redis-cli INFO

# Check memory usage
docker exec dgos_redis_1 redis-cli INFO memory | grep used_memory_human

# Check connected clients
docker exec dgos_redis_1 redis-cli CLIENT LIST | wc -l

# Check for errors
docker logs dgos_redis_1 --tail 50
```

#### Diagnosis

```bash
# Check Redis configuration
docker exec dgos_redis_1 redis-cli CONFIG GET '*'

# Check keyspace
docker exec dgos_redis_1 redis-cli INFO keyspace

# Check slow log
docker exec dgos_redis_1 redis-cli SLOWLOG GET 10

# Check memory pressure
docker exec dgos_redis_1 redis-cli INFO stats | grep evicted_keys
```

#### Mitigation

```bash
# Quick restart (safe - sessions will be lost but regenerated)
docker restart dgos_redis_1

# Wait for Redis to be ready
sleep 5
docker exec dgos_redis_1 redis-cli ping
```

#### Resolution

**If memory exhausted**:
```bash
# Check current maxmemory
docker exec dgos_redis_1 redis-cli CONFIG GET maxmemory

# Increase maxmemory (edit docker-compose or redis.conf)
# Restart with new config
docker restart dgos_redis_1

# Or flush old data (CAUTION: clears all sessions)
docker exec dgos_redis_1 redis-cli FLUSHDB
```

**If too many connections**:
```bash
# Check connection limits
docker exec dgos_redis_1 redis-cli CONFIG GET maxclients

# Kill idle clients if needed
docker exec dgos_redis_1 redis-cli CLIENT KILL TYPE normal SKIPME yes

# Increase connection pool settings in API/Worker
# Edit environment variables and restart services
```

---

### Playbook 5: Provider Timeouts

**Symptoms**:
- AI tasks failing with "upstream_unavailable"
- Connection test failures
- High latency to provider APIs
- Provider rate limit errors

#### Detection

```bash
# Check recent task failures
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT task_id, error_key, error_message, updated_at FROM ai_tasks WHERE state='failed' AND updated_at > NOW() - INTERVAL '1 hour' ORDER BY updated_at DESC LIMIT 20;"

# Check provider connection tests
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT test_id, provider_id, state, result->>'error' as error FROM provider_connection_tests WHERE created_at > NOW() - INTERVAL '1 hour' ORDER BY created_at DESC LIMIT 10;"

# Check worker logs for provider errors
docker logs dgos_worker_1 | grep -i "provider\|upstream" | tail -20
```

#### Diagnosis

```bash
# Test provider connectivity from worker
docker exec dgos_worker_1 curl -v -m 10 https://api.openai.com/v1/models

# Check for network issues
docker exec dgos_worker_1 curl -v -m 10 https://api.anthropic.com/v1/messages

# Check proxy configuration
docker exec dgos_worker_1 env | grep -i proxy

# Check provider account status
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT account_id, provider, state, disabled, error_count FROM provider_accounts WHERE disabled=false;"

# Check provider config status
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT provider_id, protocol, state, disabled FROM provider_configs WHERE disabled=false;"
```

#### Mitigation

```bash
# Temporarily disable failing provider
# Access DGOS admin UI → Providers → Disable problematic provider
# Or via database (CAUTION: understand impact first)
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "UPDATE provider_configs SET disabled=true WHERE provider_id='<provider-id>';"

# Retry failed tasks manually
# They will use alternative provider if available
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "UPDATE ai_tasks SET state='pending', claimed_by=NULL, claimed_at=NULL WHERE state='failed' AND error_key='upstream_unavailable' AND updated_at > NOW() - INTERVAL '1 hour';"
```

#### Resolution

**If provider API key invalid**:
```bash
# Rotate provider credentials via UI
# Settings → Providers → Edit → Update API Key

# Or trigger credential rotation script
docker compose -f docker-compose.production.yml run --rm api node scripts/v1-ops-rotate.mjs
```

**If network/firewall blocking**:
```bash
# Check egress rules
iptables -L OUTPUT -v -n

# Test direct connection
curl -v https://api.openai.com/v1/models

# Check DNS resolution
nslookup api.openai.com

# If using proxy, verify proxy is accessible
curl -v -x $HTTP_PROXY https://api.openai.com/v1/models
```

**If provider rate limiting**:
```bash
# Check rate limit policy in provider config
# Adjust retry strategy and backoff

# Distribute load across multiple provider accounts
# Add additional provider configs in UI
```

---

### Playbook 6: Memory Leak

**Symptoms**:
- Steadily increasing memory usage
- OOM kills in logs
- Service restarts due to memory limits
- Degraded performance over time

#### Detection

```bash
# Monitor memory over time
docker stats --no-stream

# Check for OOM kills
dmesg | grep -i oom
journalctl -k | grep -i oom

# Check Node.js heap usage
docker exec dgos_api_1 node -e "console.log(JSON.stringify(process.memoryUsage(), null, 2))"

# Check container memory limits
docker inspect dgos_api_1 | grep -A 10 Memory
```

#### Diagnosis

```bash
# Get heap snapshot (requires heapdump package)
# For investigation purposes only

# Check for event listener leaks
docker logs dgos_api_1 | grep "MaxListenersExceededWarning"

# Check for unclosed connections
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT COUNT(*), state FROM pg_stat_activity WHERE datname='${DGOS_POSTGRES_DB}' GROUP BY state;"

# Check for large objects in Redis
docker exec dgos_redis_1 redis-cli --bigkeys

# Review recent code changes for:
# - Event listeners not removed
# - Timers/intervals not cleared
# - File handles not closed
# - Database connections not released
```

#### Mitigation

```bash
# Immediate: Restart affected service
docker restart dgos_api_1
docker restart dgos_worker_1

# Monitor if issue recurs
watch -n 10 'docker stats --no-stream dgos_api_1'
```

#### Resolution

```bash
# Increase memory limits (temporary workaround)
# Edit docker-compose.production.yml
services:
  api:
    deploy:
      resources:
        limits:
          memory: 2G  # Increase from 1G

# Restart with new limits
docker compose -f docker-compose.production.yml up -d api

# Long-term: Fix code leak
# Requires investigation, profiling, and deployment of fix
# See V1-Deployment-Guide.md for deployment procedures
```

---

### Playbook 7: Disk Full

**Symptoms**:
- Write operations failing
- Database errors "No space left on device"
- Log rotation failures
- Container crashes

#### Detection

```bash
# Check disk usage
df -h

# Check Docker volumes
docker system df

# Check specific volume usage
docker exec dgos_postgres_1 df -h /var/lib/postgresql/data

# Check log file sizes
du -sh /var/lib/docker/containers/*/
du -sh /var/log/
```

#### Diagnosis

```bash
# Identify largest files/directories
du -h / | sort -rh | head -20

# Check for large log files
find /var/log -type f -size +100M -exec ls -lh {} \;

# Check Docker image cache
docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}'

# Check PostgreSQL WAL files
docker exec dgos_postgres_1 du -sh /var/lib/postgresql/data/pg_wal/

# Check for old backups
ls -lh /backups/dgos/
```

#### Mitigation

```bash
# IMMEDIATE: Free up space

# 1. Clean Docker system (safe)
docker system prune -f

# 2. Remove old Docker images
docker image prune -a -f

# 3. Rotate logs manually
journalctl --vacuum-time=7d

# 4. Remove old backups (keep last 7)
cd /backups/dgos/
ls -t | tail -n +8 | xargs rm -f

# 5. Clean PostgreSQL WAL (CAUTION: ensure backups exist)
# PostgreSQL manages this automatically; only intervene if urgent
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -c "CHECKPOINT;"
```

#### Resolution

```bash
# Configure log rotation for Docker containers
# /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}

# Restart Docker daemon
systemctl restart docker

# Configure PostgreSQL archiving
# Edit postgresql.conf
archive_mode = on
archive_command = '/path/to/archive_script.sh %p %f'
wal_keep_size = 512MB  # Reduce from 1GB

# Set up automated backup cleanup
# Add to crontab
0 3 * * * find /backups/dgos -name "dgos-*.sql.gz" -mtime +30 -delete

# Extend disk volume if persistently running low
# (Cloud provider specific or LVM resize)
```

---

### Playbook 8: Certificate Expiry

**Symptoms**:
- Browser warnings about expired certificates
- HTTPS connection failures
- "certificate has expired" errors in logs
- Gateway/proxy errors

#### Detection

```bash
# Check certificate expiry
echo | openssl s_client -connect dgos.yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates

# Check certificate expiry from file
openssl x509 -in /etc/caddy/certificates/cert.pem -noout -enddate

# Check Caddy managed certificates
docker exec dgos_gateway_1 caddy list-certificates

# Get days until expiry
echo | openssl s_client -connect dgos.yourdomain.com:443 2>/dev/null | openssl x509 -noout -checkend 2592000 && echo "Certificate valid for 30+ days" || echo "Certificate expires within 30 days"
```

#### Diagnosis

```bash
# Check Caddy automatic renewal logs
docker logs dgos_gateway_1 | grep -i "renew\|certificate"

# Check Let's Encrypt rate limits
# https://letsencrypt.org/docs/rate-limits/

# Check DNS configuration
dig dgos.yourdomain.com

# Check if renewal failed
docker logs dgos_gateway_1 | grep -i "error\|fail" | tail -20
```

#### Mitigation

```bash
# If using Caddy auto-renewal, force renewal
docker exec dgos_gateway_1 caddy reload --force

# If using certbot, manually renew
certbot renew --force-renewal

# Restart gateway to load new certificate
docker restart dgos_gateway_1
```

#### Resolution

```bash
# Ensure Caddy has write access to certificate storage
docker exec dgos_gateway_1 ls -la /data/caddy/certificates/

# Verify ACME challenge can reach server
curl -I http://dgos.yourdomain.com/.well-known/acme-challenge/test

# Set up monitoring for certificate expiry
# Add to monitoring system or cron
0 0 * * * /opt/dgos/scripts/check-cert-expiry.sh

# Example check-cert-expiry.sh
#!/bin/bash
DAYS_UNTIL_EXPIRY=$(echo | openssl s_client -connect dgos.yourdomain.com:443 2>/dev/null | openssl x509 -noout -checkend $((7*86400)) && echo "OK" || echo "WARN")
if [ "$DAYS_UNTIL_EXPIRY" = "WARN" ]; then
  # Send alert
  echo "Certificate expires within 7 days" | mail -s "DGOS Certificate Expiry Warning" ops@yourcompany.com
fi
```

---

## Daily Operations

### Morning Health Check Routine

Execute daily at start of business day:

```bash
#!/bin/bash
# daily-health-check.sh

echo "=== DGOS Daily Health Check ==="
echo "Date: $(date)"
echo ""

# 1. Service Status
echo "1. Service Status"
docker compose -f docker-compose.production.yml ps
echo ""

# 2. Health Endpoints
echo "2. API Health"
curl -f http://localhost:3000/health || echo "FAIL"
echo ""

echo "3. API Ready"
curl -f http://localhost:3000/ready || echo "FAIL"
echo ""

# 3. Resource Usage
echo "4. Resource Usage"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
echo ""

# 4. Database Status
echo "5. Database Connections"
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT count(*), state FROM pg_stat_activity WHERE datname='${DGOS_POSTGRES_DB}' GROUP BY state;"
echo ""

echo "6. Database Size"
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT pg_size_pretty(pg_database_size('${DGOS_POSTGRES_DB}'));"
echo ""

# 5. Redis Status
echo "7. Redis Status"
docker exec dgos_redis_1 redis-cli INFO server | grep redis_version
docker exec dgos_redis_1 redis-cli INFO memory | grep used_memory_human
echo ""

# 6. Recent Errors
echo "8. Recent API Errors (last hour)"
docker logs dgos_api_1 --since 1h 2>&1 | grep -i error | wc -l
echo ""

echo "9. Recent Worker Errors (last hour)"
docker logs dgos_worker_1 --since 1h 2>&1 | grep -i error | wc -l
echo ""

# 7. Failed Tasks
echo "10. Failed AI Tasks (last 24h)"
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -t -c "SELECT COUNT(*) FROM ai_tasks WHERE state='failed' AND updated_at > NOW() - INTERVAL '24 hours';"
echo ""

# 8. Disk Usage
echo "11. Disk Usage"
df -h | grep -E "Filesystem|/dev/"
echo ""

# 9. Certificate Expiry
echo "12. Certificate Days Remaining"
echo | openssl s_client -connect ${DGOS_PUBLIC_HOST}:443 2>/dev/null | openssl x509 -noout -enddate
echo ""

echo "=== Health Check Complete ==="
```

### Log Monitoring

**Check for critical errors**:
```bash
# API errors in last hour
docker logs dgos_api_1 --since 1h 2>&1 | grep -E "ERROR|FATAL|CRITICAL"

# Worker errors in last hour
docker logs dgos_worker_1 --since 1h 2>&1 | grep -E "ERROR|FATAL|CRITICAL"

# Database errors
docker logs dgos_postgres_1 --since 1h 2>&1 | grep -i error

# Gateway errors
docker logs dgos_gateway_1 --since 1h 2>&1 | grep -i error
```

### Metric Collection

**Key metrics to track daily**:
```bash
# API request rate (if metrics endpoint available)
curl -s http://localhost:9090/metrics | grep dgos_http_requests_total

# Task completion rate
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -t -c "SELECT state, COUNT(*) FROM ai_tasks WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY state;"

# Average task duration
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -t -c "SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) FROM ai_tasks WHERE state='completed' AND updated_at > NOW() - INTERVAL '24 hours';"

# Provider success rate
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -t -c "SELECT state, COUNT(*) FROM provider_connection_tests WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY state;"
```

### Backup Verification

**Daily backup check**:
```bash
#!/bin/bash
# verify-backup.sh

BACKUP_DIR=/backups/dgos
LATEST_BACKUP=$(ls -t $BACKUP_DIR/dgos-*.sql.gz | head -1)

if [ -z "$LATEST_BACKUP" ]; then
  echo "ERROR: No backups found"
  exit 1
fi

# Check backup age
BACKUP_AGE=$(find "$LATEST_BACKUP" -mtime +1)
if [ -n "$BACKUP_AGE" ]; then
  echo "WARNING: Latest backup is older than 24 hours"
  echo "Latest: $LATEST_BACKUP"
  exit 1
fi

# Check backup size
BACKUP_SIZE=$(stat -f%z "$LATEST_BACKUP" 2>/dev/null || stat -c%s "$LATEST_BACKUP")
if [ "$BACKUP_SIZE" -lt 1000000 ]; then
  echo "WARNING: Backup size suspiciously small: $BACKUP_SIZE bytes"
  exit 1
fi

# Test backup integrity
gunzip -t "$LATEST_BACKUP"
if [ $? -ne 0 ]; then
  echo "ERROR: Backup file is corrupted"
  exit 1
fi

echo "✓ Backup verification passed"
echo "  File: $LATEST_BACKUP"
echo "  Size: $(du -h $LATEST_BACKUP | cut -f1)"
echo "  Date: $(stat -f%Sm -t '%Y-%m-%d %H:%M:%S' $LATEST_BACKUP 2>/dev/null || stat -c%y $LATEST_BACKUP)"
```

### Certificate Expiry Check

**Weekly certificate check**:
```bash
#!/bin/bash
# check-certificates.sh

DOMAIN=${DGOS_PUBLIC_HOST}
WARN_DAYS=30

EXPIRY_DATE=$(echo | openssl s_client -connect ${DOMAIN}:443 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$EXPIRY_DATE" +%s)
NOW_EPOCH=$(date +%s)
DAYS_REMAINING=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))

echo "Certificate for $DOMAIN"
echo "Expires: $EXPIRY_DATE"
echo "Days remaining: $DAYS_REMAINING"

if [ $DAYS_REMAINING -lt 7 ]; then
  echo "CRITICAL: Certificate expires in less than 7 days!"
  exit 2
elif [ $DAYS_REMAINING -lt $WARN_DAYS ]; then
  echo "WARNING: Certificate expires in less than $WARN_DAYS days"
  exit 1
else
  echo "OK: Certificate valid"
  exit 0
fi
```

---

## Maintenance Procedures

### Database Maintenance

**Weekly VACUUM ANALYZE** (runs online, no downtime):
```bash
#!/bin/bash
# weekly-vacuum.sh

echo "Starting VACUUM ANALYZE at $(date)"

docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "VACUUM ANALYZE VERBOSE;"

echo "VACUUM ANALYZE completed at $(date)"
```

**Monthly REINDEX** (requires maintenance window):
```bash
#!/bin/bash
# monthly-reindex.sh

echo "WARNING: REINDEX will lock tables"
echo "Ensure this runs during maintenance window"
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted"
  exit 1
fi

# Stop API and Worker to prevent new connections
docker compose -f docker-compose.production.yml stop api worker

# Run REINDEX
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "REINDEX DATABASE ${DGOS_POSTGRES_DB};"

# Restart services
docker compose -f docker-compose.production.yml start api worker

echo "REINDEX completed at $(date)"
```

**Check for bloat**:
```bash
# Check table bloat
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
"
```

### Log Rotation

**Configure systemd log rotation**:
```bash
# /etc/systemd/journald.conf
[Journal]
SystemMaxUse=1G
SystemKeepFree=2G
SystemMaxFileSize=100M
MaxRetentionSec=2week
```

**Docker log rotation** (already configured in docker-compose.production.yml):
```yaml
services:
  api:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

**Manual log cleanup**:
```bash
# Clean journald logs older than 14 days
journalctl --vacuum-time=14d

# Clean Docker logs
docker system prune -f --volumes
```

### Backup Management

**Automated daily backup** (runs at 2 AM):
```bash
#!/bin/bash
# /opt/dgos/scripts/backup.sh

BACKUP_DIR=/backups/dgos
RETENTION_DAYS=30
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/dgos-$DATE.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Database backup
docker exec dgos_postgres_1 pg_dump -U ${DGOS_POSTGRES_USER} ${DGOS_POSTGRES_DB} | gzip > $BACKUP_FILE

# Verify backup
if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ]; then
  echo "Backup successful: $BACKUP_FILE"
  
  # Backup ciphertext (secrets)
  CIPHERTEXT_BACKUP="$BACKUP_DIR/ciphertext-$DATE"
  docker compose -f docker-compose.production.yml run --rm \
    -v secret-ciphertext:/source:ro \
    -v $BACKUP_DIR:/destination \
    api node scripts/v1-ops-backup.mjs /source $CIPHERTEXT_BACKUP
  
  # Cleanup old backups
  find $BACKUP_DIR -name "dgos-*.sql.gz" -mtime +$RETENTION_DAYS -delete
  find $BACKUP_DIR -type d -name "ciphertext-*" -mtime +$RETENTION_DAYS -exec rm -rf {} +
  
  echo "Backup cleanup complete"
else
  echo "Backup failed!"
  exit 1
fi
```

**Crontab entry**:
```cron
# /etc/cron.d/dgos-backup
0 2 * * * root /opt/dgos/scripts/backup.sh >> /var/log/dgos/backup.log 2>&1
```

### Certificate Renewal

**Using Caddy (automatic)**:
Caddy automatically renews Let's Encrypt certificates. Monitor logs for renewal activity:
```bash
docker logs dgos_gateway_1 | grep -i renew
```

**Manual certbot renewal** (if not using Caddy):
```bash
# Test renewal
certbot renew --dry-run

# Force renewal
certbot renew --force-renewal

# Reload gateway
docker restart dgos_gateway_1
```

### Dependency Updates

**Check for updates** (monthly):
```bash
# Check Node.js security updates
docker exec dgos_api_1 npm audit

# Check for package updates
cd /opt/dgos
git fetch
git log HEAD..origin/main --oneline

# Review changelog before updating
```

**Apply security patches** (as needed):
```bash
# Follow V1-Deployment-Guide.md for deployment

# 1. Create backup
/opt/dgos/scripts/backup.sh

# 2. Pull latest code
cd /opt/dgos
git pull origin main

# 3. Run migrations
docker compose -f docker-compose.production.yml run --rm migrate

# 4. Rebuild and restart services
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d

# 5. Verify health
curl -f http://localhost:3000/health
```

---

## Monitoring & Alerting

### What to Monitor

#### Service Metrics
- **API Health**: `/health` endpoint status
- **API Ready**: `/ready` endpoint status (includes database/Redis checks)
- **Worker Status**: Worker process running and claiming tasks
- **Response Time**: P50, P95, P99 latencies
- **Error Rate**: 5xx errors per minute
- **Request Rate**: Requests per second

#### Resource Metrics
- **CPU Usage**: Per container, alert >80%
- **Memory Usage**: Per container, alert >85%
- **Disk Usage**: Host filesystem, alert >85%
- **Network I/O**: Bandwidth usage

#### Database Metrics
- **Connection Count**: Active connections, alert >80% of max
- **Query Duration**: Slow queries >1s
- **Transaction Rate**: Transactions per second
- **Database Size**: Growth rate
- **Replication Lag**: (if using replication)

#### Redis Metrics
- **Memory Usage**: Used memory vs maxmemory
- **Eviction Rate**: Keys evicted per second
- **Hit Rate**: Cache hit ratio
- **Connection Count**: Connected clients

#### Application Metrics
- **Task Queue Length**: Pending AI tasks, alert >100
- **Task Success Rate**: Completed vs failed tasks
- **Task Duration**: Average task execution time
- **Provider Success Rate**: Successful provider API calls
- **Session Count**: Active user sessions

### Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| API 5xx Error Rate | >1% for 5min | >5% for 5min | Check logs, restart if needed |
| API Response Time P95 | >2s for 5min | >5s for 5min | Check database, scale if needed |
| CPU Usage | >80% for 10min | >95% for 5min | Scale up or optimize |
| Memory Usage | >85% for 10min | >95% for 5min | Restart service, check for leaks |
| Disk Usage | >85% | >95% | Clean up logs/backups, expand disk |
| DB Connections | >80 (of 100) | >95 (of 100) | Check for connection leaks |
| Task Queue Depth | >50 pending | >100 pending | Check worker, scale workers |
| Certificate Expiry | <30 days | <7 days | Renew certificate |
| Backup Age | >25 hours | >36 hours | Check backup script |

### Alert Routing

```yaml
# Example Prometheus alertmanager config
route:
  group_by: ['alertname', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'dgos-oncall'
  routes:
    - match:
        severity: critical
      receiver: 'dgos-pager'
      continue: true
    - match:
        severity: warning
      receiver: 'dgos-slack'

receivers:
  - name: 'dgos-oncall'
    email_configs:
      - to: 'dgos-oncall@yourcompany.com'
  
  - name: 'dgos-pager'
    pagerduty_configs:
      - service_key: '<pagerduty-key>'
  
  - name: 'dgos-slack'
    slack_configs:
      - api_url: '<slack-webhook>'
        channel: '#dgos-alerts'
```

### Dashboard Setup

**Recommended Grafana dashboards**:

1. **Service Overview**
   - Service status (up/down)
   - Request rate
   - Error rate
   - Response time percentiles

2. **Resource Usage**
   - CPU usage by container
   - Memory usage by container
   - Disk usage
   - Network I/O

3. **Database Health**
   - Connection count
   - Query duration
   - Transaction rate
   - Database size

4. **Application Metrics**
   - Task queue depth
   - Task completion rate
   - Provider success rate
   - Active sessions

### SLI/SLO Definitions

**Service Level Indicators**:
- **Availability**: Percentage of time `/health` returns 200
- **Latency**: P95 response time for API requests
- **Success Rate**: Percentage of requests returning 2xx/3xx

**Service Level Objectives**:
- **Availability SLO**: 99.9% uptime (43min downtime/month)
- **Latency SLO**: P95 < 500ms for API requests
- **Success Rate SLO**: 99.5% of requests succeed

**Error Budget**:
- Monthly error budget: 0.1% = 43 minutes downtime
- If error budget exhausted: freeze non-critical changes

---

## Scaling Procedures

### Horizontal Scaling

#### Scale API Service

**Docker Compose**:
```bash
# Scale to 3 API instances
docker compose -f docker-compose.production.yml up -d --scale api=3

# Verify all instances healthy
docker compose -f docker-compose.production.yml ps api
docker exec dgos_api_1 curl -f http://localhost:3000/health
docker exec dgos_api_2 curl -f http://localhost:3000/health
docker exec dgos_api_3 curl -f http://localhost:3000/health
```

**Kubernetes**:
```bash
# Scale deployment
kubectl scale deployment dgos-api --replicas=3

# Verify pods
kubectl get pods -l app=dgos-api
kubectl logs -l app=dgos-api --tail=20
```

**Considerations**:
- API is stateless and can scale horizontally
- Sessions stored in Redis (shared across instances)
- Load balancer distributes traffic (Caddy/Nginx/K8s ingress)

#### Scale Worker Service

```bash
# Scale to 2 worker instances
docker compose -f docker-compose.production.yml up -d --scale worker=2

# Verify workers are claiming tasks
docker logs dgos_worker_1 | grep "task_claimed"
docker logs dgos_worker_2 | grep "task_claimed"

# Check task distribution
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT claimed_by, COUNT(*) FROM ai_tasks WHERE state='claimed' GROUP BY claimed_by;"
```

**Considerations**:
- Workers compete for tasks using database locking
- Each worker must have unique DGOS_WORKER_ID
- More workers = better task throughput (up to provider rate limits)

### Vertical Scaling

#### Increase API Resources

**Edit docker-compose.production.yml**:
```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2.0'      # Increase from 1.0
          memory: 2G       # Increase from 1G
        reservations:
          cpus: '1.0'
          memory: 1G
```

**Apply changes**:
```bash
docker compose -f docker-compose.production.yml up -d api
```

#### Increase Worker Resources

```yaml
services:
  worker:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
    environment:
      DGOS_WORKER_POOL_MAX: 20  # Increase DB connection pool
```

### Database Scaling

#### Increase Connection Pool

**Increase max_connections in PostgreSQL**:
```bash
# Edit PostgreSQL config
docker exec dgos_postgres_1 psql -U postgres -c "ALTER SYSTEM SET max_connections = 200;"
docker restart dgos_postgres_1
```

**Increase application pool size**:
```yaml
services:
  api:
    environment:
      DATABASE_POOL_MAX: 20  # Increase from 10
  worker:
    environment:
      DGOS_WORKER_POOL_MAX: 20
```

#### Read Replicas (future enhancement)

For read-heavy workloads, configure PostgreSQL streaming replication:
```yaml
services:
  postgres-replica:
    image: postgres:16-alpine
    environment:
      POSTGRES_PRIMARY_HOST: postgres
      POSTGRES_PRIMARY_PORT: 5432
```

Update application to route reads to replica.

### Load Balancing

**Nginx load balancer configuration**:
```nginx
upstream dgos_api {
    least_conn;  # Use least connections algorithm
    server api1:3000 max_fails=3 fail_timeout=30s;
    server api2:3000 max_fails=3 fail_timeout=30s;
    server api3:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl http2;
    server_name dgos.yourdomain.com;
    
    location / {
        proxy_pass http://dgos_api;
        proxy_next_upstream error timeout http_500 http_502 http_503;
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### Auto-scaling Triggers

**CPU-based scaling** (Kubernetes HPA):
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: dgos-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: dgos-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

**Queue depth-based scaling** (custom metrics):
```yaml
metrics:
  - type: External
    external:
      metric:
        name: dgos_task_queue_depth
      target:
        type: Value
        value: "50"
```

---

## Disaster Recovery

### RPO/RTO Targets

- **Recovery Point Objective (RPO)**: 24 hours (daily backups)
- **Recovery Time Objective (RTO)**: 4 hours (time to restore service)

For critical production systems, consider:
- **Reduced RPO**: Continuous WAL archiving (RPO < 1 hour)
- **Reduced RTO**: Hot standby with automated failover (RTO < 15 minutes)

### Backup Strategy

**What to backup**:
1. PostgreSQL database (daily full backup)
2. Ciphertext secrets (daily, synchronized with database)
3. Environment configuration (version controlled)
4. TLS certificates (backed up, version controlled)
5. Docker volumes (package data, if applicable)

**Backup schedule**:
- **Daily**: Full database dump + ciphertext backup (2 AM)
- **Retention**: 30 days for database, 90 days for ciphertext
- **Storage**: Local disk + off-site backup (S3, NAS, etc.)

### Backup Restoration

**Full database restore**:
```bash
#!/bin/bash
# restore-database.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  exit 1
fi

# 1. Stop services
echo "Stopping services..."
docker compose -f docker-compose.production.yml stop api worker

# 2. Drop and recreate database
echo "Recreating database..."
docker exec dgos_postgres_1 psql -U postgres -c "DROP DATABASE IF EXISTS ${DGOS_POSTGRES_DB};"
docker exec dgos_postgres_1 psql -U postgres -c "CREATE DATABASE ${DGOS_POSTGRES_DB} WITH ENCODING 'UTF8';"
docker exec dgos_postgres_1 psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${DGOS_POSTGRES_DB} TO ${DGOS_POSTGRES_USER};"

# 3. Restore backup
echo "Restoring backup..."
gunzip < $BACKUP_FILE | docker exec -i dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB}

if [ $? -ne 0 ]; then
  echo "ERROR: Restore failed"
  exit 1
fi

# 4. Verify restore
echo "Verifying restore..."
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT COUNT(*) FROM dgos_migrations;"

# 5. Restart services
echo "Restarting services..."
docker compose -f docker-compose.production.yml start api worker

# 6. Health check
sleep 10
curl -f http://localhost:3000/health || echo "WARNING: Health check failed"

echo "Restore complete"
```

**Restore ciphertext secrets**:
```bash
# Restore from backup directory
BACKUP_DIR=/backups/dgos/ciphertext-20261002-020000

# Stop services
docker compose -f docker-compose.production.yml stop api worker

# Clear existing ciphertext
docker volume rm dgos-production_secret-ciphertext
docker volume create dgos-production_secret-ciphertext

# Restore ciphertext files
docker run --rm -v dgos-production_secret-ciphertext:/destination -v $BACKUP_DIR:/source:ro \
  busybox sh -c "cp -a /source/. /destination/ && chown -R 1000:1000 /destination && chmod 700 /destination"

# Restart services
docker compose -f docker-compose.production.yml start api worker
```

### Failover Procedures

**Primary site failure**:

1. **Assess situation**
   - Determine if primary can be recovered
   - Estimate recovery time
   - If recovery > RTO, proceed with DR site activation

2. **Activate DR site**
   ```bash
   # On DR site
   cd /opt/dgos-dr
   
   # Restore latest backup
   ./restore-database.sh /backups/latest/dgos-latest.sql.gz
   
   # Restore ciphertext
   ./restore-ciphertext.sh /backups/latest/ciphertext-latest
   
   # Start services
   docker compose -f docker-compose.production.yml up -d
   
   # Verify health
   curl -f http://localhost:3000/health
   ```

3. **Update DNS**
   ```bash
   # Update DNS to point to DR site
   # A record: dgos.yourdomain.com → <DR-IP>
   
   # Verify propagation
   dig dgos.yourdomain.com
   ```

4. **Monitor and validate**
   - Check all services healthy
   - Verify user login works
   - Test critical workflows
   - Monitor error rates

5. **Communicate**
   - Notify users service is restored
   - Document incident timeline
   - Plan primary site recovery

### Data Recovery

**Recover deleted data** (if within retention window):
```bash
# Check if audit trail exists
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "
SELECT * FROM audit_events 
WHERE action LIKE '%.delete' 
  AND created_at > NOW() - INTERVAL '30 days' 
  AND target_id = '<deleted-object-id>'
ORDER BY created_at DESC;
"

# If data is in backup, restore to temporary database
gunzip < backup.sql.gz | docker exec -i dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d dgos_recovery

# Extract specific data
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d dgos_recovery -c "
SELECT * FROM <table> WHERE id = '<object-id>';
"

# Manually insert into production database if appropriate
# (Ensure consistency and audit trail)
```

### Service Recovery Order

When restoring from disaster, start services in this order:

1. **PostgreSQL**: Database must be healthy first
2. **Redis**: Cache and session store
3. **Migrate**: Run any pending migrations
4. **API**: Core service
5. **Worker**: Background task processing
6. **Web**: Frontend application
7. **Gateway**: Reverse proxy/ingress

**Verification at each step**:
```bash
# 1. PostgreSQL
docker exec dgos_postgres_1 pg_isready

# 2. Redis
docker exec dgos_redis_1 redis-cli ping

# 3. Migrations
docker compose -f docker-compose.production.yml logs migrate

# 4. API
curl -f http://localhost:3000/health

# 5. Worker
docker logs dgos_worker_1 | grep "status.*ready"

# 6. Web
curl -f http://localhost:4173/

# 7. Gateway
curl -f https://dgos.yourdomain.com/health
```

---

## Common Operations Tasks

### User Management

**Bootstrap initial admin** (first-time setup):
```bash
# Access web UI
open http://localhost:3000

# Follow bootstrap wizard
# Creates first admin user with full permissions
```

**View users** (via database):
```bash
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "
SELECT principal_id, username, state, created_at 
FROM principals 
WHERE state != 'deleted' 
ORDER BY created_at DESC;
"
```

**Disable user** (emergency):
```bash
# Via database (CAUTION: bypasses audit trail)
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "
UPDATE principals 
SET state = 'disabled' 
WHERE username = '<username>';
"

# Better: Use admin UI to disable user (creates audit trail)
```

**Reset user password** (via admin UI):
- Admin → Users → Select User → Reset Password

### Provider Configuration

**Add new provider**:
```bash
# Via UI (recommended)
# Settings → Providers → Add Provider
# Enter provider details, credentials, test connection

# View provider configs
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "
SELECT provider_id, protocol, state, disabled, created_at 
FROM provider_configs 
ORDER BY created_at DESC;
"
```

**Test provider connection**:
```bash
# Via UI: Settings → Providers → Select Provider → Test Connection

# Check test results
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "
SELECT test_id, provider_id, state, result 
FROM provider_connection_tests 
WHERE provider_id = '<provider-id>' 
ORDER BY created_at DESC 
LIMIT 5;
"
```

**Refresh provider model catalog**:
```bash
# Via UI: Settings → Providers → Select Provider → Refresh Catalog

# Monitor refresh job
docker logs dgos_worker_1 | grep "model_catalog_refresh"
```

**Disable provider temporarily**:
```bash
# Via UI: Settings → Providers → Select Provider → Disable

# Or via database (emergency)
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "
UPDATE provider_configs 
SET disabled = true 
WHERE provider_id = '<provider-id>';
"
```

### Debug Logging

**Enable debug logging for API**:
```bash
# Edit environment variable
LOG_LEVEL=debug

# Restart API
docker compose -f docker-compose.production.yml restart api

# View debug logs
docker logs -f dgos_api_1 | grep DEBUG
```

**Enable query logging in PostgreSQL**:
```bash
# Temporarily enable (session-level)
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -c "SET log_statement = 'all';"

# Or persist (requires restart)
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -c "ALTER SYSTEM SET log_statement = 'all';"
docker restart dgos_postgres_1

# View query logs
docker logs dgos_postgres_1 | grep "LOG:  statement"

# Disable after debugging
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -c "ALTER SYSTEM SET log_statement = 'none';"
docker restart dgos_postgres_1
```

### Performance Tuning

**Identify slow API endpoints**:
```bash
# Check API logs for slow requests
docker logs dgos_api_1 | grep "duration" | awk '{print $NF}' | sort -n | tail -20

# Identify slow queries
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "
SELECT query, calls, mean_exec_time, max_exec_time 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
"
```

**Tune database connection pool**:
```yaml
# Increase pool size if seeing connection waits
services:
  api:
    environment:
      DATABASE_POOL_MIN: 5    # Increase from 2
      DATABASE_POOL_MAX: 20   # Increase from 10
```

**Optimize Redis memory**:
```bash
# Check memory usage
docker exec dgos_redis_1 redis-cli INFO memory

# Adjust maxmemory policy
docker exec dgos_redis_1 redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Set appropriate maxmemory limit
docker exec dgos_redis_1 redis-cli CONFIG SET maxmemory 1gb
```

### Cache Clearing

**Clear Redis cache**:
```bash
# Clear specific database (DB 1 = app cache)
docker exec dgos_redis_1 redis-cli -n 1 FLUSHDB

# Clear all sessions (DB 0)
docker exec dgos_redis_1 redis-cli -n 0 FLUSHDB

# Clear provider cache (DB 5)
docker exec dgos_redis_1 redis-cli -n 5 FLUSHDB
```

**Clear application caches**:
```bash
# Restart services to clear in-memory caches
docker compose -f docker-compose.production.yml restart api worker
```

---

## Contact & Escalation

### Escalation Path

**Level 1: On-Call Engineer**
- Initial response to all alerts
- Execute runbook procedures
- Escalate to L2 if unresolved within 30 minutes

**Level 2: Senior SRE / Technical Lead**
- Complex diagnosis and resolution
- Code-level debugging
- Escalate to L3 if architectural changes needed

**Level 3: Engineering Manager / Architect**
- Architectural decisions
- Major incidents affecting business
- Coordination with stakeholders

### Communication Channels

**During Incidents**:
- **Slack**: #dgos-incidents (real-time coordination)
- **Email**: dgos-oncall@yourcompany.com
- **PagerDuty**: Critical alerts

**Status Updates**:
- **Status Page**: status.yourcompany.com/dgos
- **Update Frequency**: Every 30 minutes during SEV1, hourly during SEV2

### Incident Logging

**Document in incident log**:
```markdown
## Incident YYYY-MM-DD-NNN

**Severity**: SEV1 / SEV2 / SEV3
**Start Time**: YYYY-MM-DD HH:MM UTC
**End Time**: YYYY-MM-DD HH:MM UTC
**Duration**: X hours Y minutes

**Summary**: Brief description of incident

**Impact**:
- Users affected: X
- Services affected: API, Worker, etc.
- Data loss: Yes/No

**Timeline**:
- HH:MM - Alert fired
- HH:MM - On-call acknowledged
- HH:MM - Root cause identified
- HH:MM - Mitigation applied
- HH:MM - Service restored
- HH:MM - Incident closed

**Root Cause**: Detailed explanation

**Resolution**: Steps taken to resolve

**Prevention**: Actions to prevent recurrence

**Action Items**:
- [ ] Task 1 (Owner: Name, Due: Date)
- [ ] Task 2 (Owner: Name, Due: Date)
```

### Postmortem Process

**Within 48 hours of major incident**:

1. **Schedule postmortem meeting** (all responders + stakeholders)
2. **Prepare timeline** (from incident log and metrics)
3. **Identify root cause** (5 whys analysis)
4. **Document learnings** (what went well, what didn't)
5. **Create action items** (assign owners and deadlines)
6. **Publish postmortem** (share with team)

**Postmortem template**: See `/docs/templates/postmortem-template.md`

---

## Appendix

### Useful Commands Reference

```bash
# Service status
docker compose -f docker-compose.production.yml ps
systemctl status dgos-*

# Health checks
curl http://localhost:3000/health
curl http://localhost:3000/ready

# Logs
docker logs -f dgos_api_1
docker logs -f dgos_worker_1
journalctl -u dgos-api -f

# Database queries
docker exec dgos_postgres_1 psql -U ${DGOS_POSTGRES_USER} -d ${DGOS_POSTGRES_DB} -c "SELECT 1;"

# Redis commands
docker exec dgos_redis_1 redis-cli ping
docker exec dgos_redis_1 redis-cli INFO

# Restart services
docker compose -f docker-compose.production.yml restart api
docker compose -f docker-compose.production.yml restart worker

# Backup
/opt/dgos/scripts/backup.sh

# Restore
/opt/dgos/scripts/restore-database.sh /backups/dgos/dgos-YYYYMMDD.sql.gz
```

### Related Documentation

- [V1 Deployment Guide](./V1-Deployment-Guide.md) - Initial deployment procedures
- [V1 Migration Guide](./V1-Migration-Guide.md) - Upgrade and migration procedures
- [部署手册](./发布/部署手册.md) - Deployment manual (Chinese)
- [回滚手册](./发布/回滚手册.md) - Rollback procedures (Chinese)
- [安全基线](./安全基线.md) - Security baseline (Chinese)

---

**Document Version**: 1.0.0  
**Last Reviewed**: 2026-10-02  
**Next Review**: 2026-11-02  
**Owner**: Operations Team
