# DGOS V1 Deployment Guide

**Version**: V1.0.0  
**Last Updated**: 2026-10-02  
**Audience**: DevOps, System Administrators

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installation Steps](#installation-steps)
3. [Configuration](#configuration)
4. [Database Setup](#database-setup)
5. [Redis Setup](#redis-setup)
6. [Provider Setup](#provider-setup)
7. [Security Configuration](#security-configuration)
8. [Monitoring](#monitoring)
9. [Backup & Recovery](#backup--recovery)

---

## System Requirements

### Minimum Requirements

**Server**:
- **OS**: Linux (Ubuntu 22.04+, Debian 11+, RHEL 9+)
- **CPU**: 2 cores
- **RAM**: 4GB
- **Disk**: 20GB SSD
- **Network**: 100 Mbps

**Desktop** (macOS):
- **OS**: macOS 12.0+ (Monterey or later)
- **CPU**: Intel or Apple Silicon
- **RAM**: 4GB
- **Disk**: 2GB free space

### Recommended Requirements

**Server**:
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Disk**: 50GB+ SSD with provisioned IOPS
- **Network**: 1 Gbps
- **Load Balancer**: For multi-instance deployment

**Desktop**:
- **OS**: macOS 13.0+ (Ventura or later)
- **RAM**: 8GB+
- **Disk**: 10GB free space

### Software Dependencies

**Required**:
- Node.js v22+
- PostgreSQL 16+
- Redis 7+
- Docker & Docker Compose (for containerized deployment)

**Optional**:
- Nginx or Caddy (reverse proxy)
- Prometheus (monitoring)
- Grafana (dashboards)
- S3-compatible storage (MinIO, AWS S3)

---

## Installation Steps

### Docker Compose Deployment (Recommended)

**1. Clone Repository**:
```bash
git clone <repository-url>
cd DGOS
git checkout v1.0.0
```

**2. Configure Environment**:
```bash
cp .env.example .env
# Edit .env with production values
```

**3. Generate Secrets**:
```bash
# Generate secure random keys
openssl rand -base64 32  # SECRET_KEY
openssl rand -base64 32  # SESSION_SECRET
```

**4. Start Services**:
```bash
docker compose -f docker-compose.prod.yml up -d
```

**5. Run Migrations**:
```bash
docker compose exec api pnpm migrate:plan
```

**6. Bootstrap Admin**:
```bash
# Access web UI and complete bootstrap wizard
open http://localhost:3000
```

### Native Deployment

**1. Install Dependencies**:
```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm
npm install -g pnpm@9.0.0

# PostgreSQL
sudo apt-get install -y postgresql-16

# Redis
sudo apt-get install -y redis-server
```

**2. Clone and Build**:
```bash
git clone <repository-url>
cd DGOS
git checkout v1.0.0
pnpm install
pnpm build
```

**3. Configure Environment**:
```bash
cp .env.example .env.production
# Edit with production values
```

**4. Setup Database**:
```bash
sudo -u postgres createdb dgos_production
sudo -u postgres psql -c "CREATE USER dgos WITH PASSWORD 'secure-password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE dgos_production TO dgos;"
```

**5. Run Migrations**:
```bash
NODE_ENV=production pnpm migrate:plan
```

**6. Start Services**:
```bash
# Using systemd (recommended)
sudo systemctl start dgos-api
sudo systemctl start dgos-worker
sudo systemctl enable dgos-api
sudo systemctl enable dgos-worker
```

---

## Configuration

### Environment Variables

**Essential Configuration**:
```env
# Environment
NODE_ENV=production

# Server
API_PORT=3000
API_HOST=0.0.0.0
PUBLIC_URL=https://dgos.yourdomain.com

# Database
DATABASE_URL=postgres://dgos:password@localhost:5432/dgos_production
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis
REDIS_URL=redis://localhost:6379
REDIS_DB_SESSIONS=0
REDIS_DB_CACHE=1
REDIS_DB_QUEUE=2

# Security
SECRET_KEY=<64-char-random-string>
SESSION_SECRET=<64-char-random-string>
CSRF_SECRET=<64-char-random-string>

# Session
SESSION_TIMEOUT_IDLE=1800000    # 30 min
SESSION_TIMEOUT_ABSOLUTE=86400000  # 24 hours

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

**Optional Configuration**:
```env
# TLS
TLS_ENABLED=true
TLS_CERT_PATH=/etc/dgos/certs/cert.pem
TLS_KEY_PATH=/etc/dgos/certs/key.pem

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000  # 1 minute

# Proxy
HTTP_PROXY=http://proxy.internal:8080
HTTPS_PROXY=http://proxy.internal:8080
NO_PROXY=localhost,127.0.0.1

# Monitoring
METRICS_ENABLED=true
METRICS_PORT=9090

# Storage (optional)
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=dgos-artifacts
S3_REGION=us-east-1
S3_ACCESS_KEY=<access-key>
S3_SECRET_KEY=<secret-key>
```

### Configuration Files

**API Configuration** (`config/production.json`):
```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 3000,
    "trustProxy": true
  },
  "database": {
    "pool": {
      "min": 2,
      "max": 10,
      "idleTimeoutMillis": 30000
    }
  },
  "redis": {
    "retryStrategy": {
      "maxRetries": 10,
      "retryDelay": 1000
    }
  },
  "cors": {
    "origin": "https://dgos.yourdomain.com",
    "credentials": true
  }
}
```

---

## Database Setup

### PostgreSQL Configuration

**1. Create Database**:
```sql
CREATE DATABASE dgos_production
  WITH ENCODING 'UTF8'
       LC_COLLATE 'en_US.UTF-8'
       LC_CTYPE 'en_US.UTF-8'
       TEMPLATE template0;
```

**2. Create User**:
```sql
CREATE USER dgos WITH PASSWORD 'secure-password';
GRANT ALL PRIVILEGES ON DATABASE dgos_production TO dgos;
```

**3. Configure PostgreSQL** (`postgresql.conf`):
```conf
# Connection Settings
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
work_mem = 16MB

# WAL Settings
wal_level = replica
max_wal_senders = 3
wal_keep_size = 1GB

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_min_duration_statement = 1000  # Log slow queries
```

**4. Configure Authentication** (`pg_hba.conf`):
```conf
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all            postgres                                peer
local   dgos_production dgos                                   md5
host    dgos_production dgos            127.0.0.1/32           md5
host    dgos_production dgos            ::1/128                md5
```

**5. Apply Configuration**:
```bash
sudo systemctl restart postgresql
```

### Database Migrations

**Run Migrations**:
```bash
NODE_ENV=production pnpm migrate:plan
```

**Verify Migration**:
```bash
psql dgos_production -c "SELECT * FROM migrations ORDER BY id DESC LIMIT 1;"
```

**Migration Checksum**:
```
Expected: 0cb6df60c0bbd5527bc6c8f1314be67fed7dbe6de7f1de30bb8681771af2744d
```

### Database Maintenance

**Vacuum**:
```sql
-- Auto-vacuum is enabled by default
-- Manual vacuum if needed
VACUUM ANALYZE;
```

**Backup**:
```bash
pg_dump dgos_production > backup-$(date +%Y%m%d-%H%M%S).sql
```

**Monitoring Queries**:
```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'dgos_production';

-- Long-running queries
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '5 minutes';

-- Database size
SELECT pg_size_pretty(pg_database_size('dgos_production'));
```

---

## Redis Setup

### Redis Configuration

**1. Configure Redis** (`redis.conf`):
```conf
# Network
bind 127.0.0.1
port 6379
protected-mode yes

# Security
requirepass <secure-password>

# Memory
maxmemory 512mb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log
```

**2. Start Redis**:
```bash
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**3. Test Connection**:
```bash
redis-cli -a <password> ping
# Should return: PONG
```

### Redis Database Usage

DGOS uses multiple Redis databases:

- **DB 0**: Sessions
- **DB 1**: Application cache
- **DB 2**: Task queue
- **DB 3**: Rate limiting
- **DB 5**: Provider cache
- **DB 6**: Model catalog cache
- **DB 7**: Extension state

### Redis Monitoring

**Memory Usage**:
```bash
redis-cli -a <password> INFO memory
```

**Connected Clients**:
```bash
redis-cli -a <password> CLIENT LIST
```

**Key Statistics**:
```bash
redis-cli -a <password> INFO keyspace
```

---

## Provider Setup

### Configuring Providers

**1. Access Provider Settings**:
- Navigate to Settings > Providers
- Must have administrator role

**2. Add Provider**:
```json
{
  "name": "OpenAI Production",
  "protocol": "openai-compatible",
  "baseUrl": "https://api.openai.com/v1",
  "credentials": {
    "apiKey": "sk-..."
  },
  "timeout": 60000,
  "retryStrategy": {
    "maxRetries": 3,
    "retryDelay": 1000
  }
}
```

**3. Test Connection**:
- Click "Test Connection"
- Verify success and latency

**4. Refresh Model Catalog**:
- Click "Refresh Catalog"
- Explicitly refresh to discover models

**5. Classify Models**:
- Assign "text" capability to chat models
- Enable desired models

**6. Set Defaults**:
- Select default model for text generation

### Provider Security

**API Key Storage**:
- Encrypted at rest using SECRET_KEY
- Never logged or exposed in error messages
- Stored in `provider_credentials` table

**Network Security**:
- All provider calls use HTTPS
- Certificate validation enabled
- Proxy support available

**Rate Limiting**:
- Per-provider rate limits
- Per-user quota enforcement
- Circuit breaker for failures

---

## Security Configuration

### TLS/SSL Setup

**1. Obtain Certificate**:
```bash
# Using Let's Encrypt
sudo certbot certonly --standalone -d dgos.yourdomain.com
```

**2. Configure Environment**:
```env
TLS_ENABLED=true
TLS_CERT_PATH=/etc/letsencrypt/live/dgos.yourdomain.com/fullchain.pem
TLS_KEY_PATH=/etc/letsencrypt/live/dgos.yourdomain.com/privkey.pem
```

**3. Or Use Reverse Proxy** (Recommended):

**Nginx Configuration**:
```nginx
server {
    listen 443 ssl http2;
    server_name dgos.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/dgos.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dgos.yourdomain.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api/v1/tasks/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
    }
}
```

### Firewall Configuration

**UFW (Ubuntu)**:
```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTPS
sudo ufw allow 443/tcp

# Allow HTTP (redirect to HTTPS)
sudo ufw allow 80/tcp

# Enable firewall
sudo ufw enable
```

**iptables**:
```bash
# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow SSH
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTPS
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Drop all other
iptables -A INPUT -j DROP
```

### Security Hardening

**1. User Permissions**:
```bash
# Run as dedicated user
sudo useradd -r -s /bin/false dgos
sudo chown -R dgos:dgos /opt/dgos
```

**2. File Permissions**:
```bash
# Restrict configuration files
chmod 600 /opt/dgos/.env
chmod 600 /etc/dgos/config.json

# Restrict certificates
chmod 600 /etc/dgos/certs/*.pem
```

**3. SELinux/AppArmor**:
```bash
# SELinux contexts
sudo semanage fcontext -a -t httpd_sys_content_t "/opt/dgos(/.*)?"
sudo restorecon -R /opt/dgos

# AppArmor profile
sudo aa-enforce /etc/apparmor.d/dgos
```

**4. Container Security**:
```yaml
# docker-compose.prod.yml
services:
  api:
    security_opt:
      - no-new-privileges:true
    read_only: true
    user: "1000:1000"
    cap_drop:
      - ALL
```

---

## Monitoring

### Health Checks

**API Health**:
```bash
curl http://localhost:3000/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-10-02T12:00:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "worker": "healthy"
  }
}
```

### Prometheus Metrics

**Enable Metrics**:
```env
METRICS_ENABLED=true
METRICS_PORT=9090
```

**Prometheus Configuration** (`prometheus.yml`):
```yaml
scrape_configs:
  - job_name: 'dgos'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: '/metrics'
```

**Available Metrics**:
- `dgos_http_requests_total`: HTTP request count
- `dgos_http_request_duration_seconds`: Request latency
- `dgos_task_submissions_total`: Task submission count
- `dgos_task_duration_seconds`: Task execution time
- `dgos_provider_calls_total`: Provider API calls
- `dgos_database_connections`: Active DB connections
- `dgos_redis_connections`: Active Redis connections

### Logging

**Log Configuration**:
```env
LOG_LEVEL=info
LOG_FORMAT=json
LOG_OUTPUT=/var/log/dgos/app.log
```

**Log Aggregation** (using journald):
```bash
# View API logs
journalctl -u dgos-api -f

# View worker logs
journalctl -u dgos-worker -f

# Filter by level
journalctl -u dgos-api -p err
```

**Log Rotation** (`/etc/logrotate.d/dgos`):
```conf
/var/log/dgos/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 dgos dgos
    sharedscripts
    postrotate
        systemctl reload dgos-api
    endscript
}
```

### Alerting

**Example Alerts** (Prometheus):
```yaml
groups:
  - name: dgos
    rules:
      - alert: HighErrorRate
        expr: rate(dgos_http_requests_total{status="500"}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
          
      - alert: DatabaseDown
        expr: up{job="dgos", service="database"} == 0
        for: 1m
        annotations:
          summary: "Database is down"
```

---

## Backup & Recovery

### Database Backup

**Automated Backup Script**:
```bash
#!/bin/bash
BACKUP_DIR=/backups/dgos
DATE=$(date +%Y%m%d-%H%M%S)
RETENTION_DAYS=30

# Create backup
pg_dump dgos_production | gzip > $BACKUP_DIR/dgos-$DATE.sql.gz

# Cleanup old backups
find $BACKUP_DIR -name "dgos-*.sql.gz" -mtime +$RETENTION_DAYS -delete
```

**Cron Schedule** (`/etc/cron.d/dgos-backup`):
```cron
# Daily backup at 2 AM
0 2 * * * dgos /opt/dgos/scripts/backup.sh
```

### Restore from Backup

```bash
# Stop services
sudo systemctl stop dgos-api dgos-worker

# Restore database
gunzip < dgos-20261002-020000.sql.gz | psql dgos_production

# Start services
sudo systemctl start dgos-api dgos-worker
```

### Disaster Recovery

**Recovery Time Objective (RTO)**: 4 hours  
**Recovery Point Objective (RPO)**: 24 hours (daily backups)

**DR Procedure**:
1. Provision new infrastructure
2. Restore database from latest backup
3. Restore Redis from RDB snapshot (if available)
4. Deploy application code
5. Restore environment configuration
6. Run health checks
7. Update DNS/load balancer

**DR Checklist**:
- [ ] Database backup accessible
- [ ] Environment configuration backed up
- [ ] TLS certificates backed up
- [ ] Provider credentials recoverable
- [ ] DNS failover configured
- [ ] DR procedure documented and tested

---

**For additional information:**
- [Security Best Practices](../04-技术架构/当前版本/V1-总体架构.md)
- [Monitoring Guide](../04-技术架构/当前版本/V1-总体架构.md)
- [Troubleshooting](../06-用户文档/V1-User-Guide.md#troubleshooting)
