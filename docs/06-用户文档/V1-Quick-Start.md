# DGOS V1 Quick Start Guide

**Get up and running in 15 minutes or less**

**Version**: V1.0.0  
**Last Updated**: 2026-10-02  
**Target Time**: 15 minutes

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation Paths](#installation-paths)
3. [Path A: Docker Compose (Recommended)](#path-a-docker-compose-recommended)
4. [Path B: Local Development](#path-b-local-development)
5. [Path C: macOS Desktop (Coming Soon)](#path-c-macos-desktop-coming-soon)
6. [First Time Setup](#first-time-setup)
7. [Common Tasks](#common-tasks)
8. [Troubleshooting](#troubleshooting)
9. [Next Steps](#next-steps)

---

## Prerequisites

### System Requirements

- **Operating System**: macOS 12+, Linux (Ubuntu 20.04+, Debian 11+), Windows 10+ (WSL2)
- **Memory**: 4GB RAM minimum, 8GB recommended
- **Disk Space**: 2GB free space
- **Network**: Internet connection for initial setup

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Docker | 20.10+ | Container runtime |
| Docker Compose | 2.0+ | Multi-container orchestration |
| Node.js | 22.0+ | JavaScript runtime |
| pnpm | 9.0+ | Package manager |
| Git | 2.30+ | Version control |

### Quick Version Check

```bash
# Check all prerequisites at once
docker --version          # Should be 20.10+
docker compose version    # Should be 2.0+
node --version           # Should be v22.0+
pnpm --version          # Should be 9.0+
git --version           # Should be 2.30+
```

### Installing Missing Software

**Docker & Docker Compose**:
- macOS: [Docker Desktop](https://www.docker.com/products/docker-desktop)
- Linux: `curl -fsSL https://get.docker.com | sh`
- Windows: [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)

**Node.js v22**:
```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 22
nvm use 22
```

**pnpm**:
```bash
npm install -g pnpm@9
# or
corepack enable
corepack prepare pnpm@9.0.0 --activate
```

---

## Installation Paths

Choose the path that best fits your needs:

| Path | Best For | Time | Complexity |
|------|----------|------|------------|
| **A: Docker Compose** | Quick evaluation, production-like | 5 min | ⭐ Easy |
| **B: Local Development** | Active development, debugging | 10 min | ⭐⭐ Medium |
| **C: macOS Desktop** | End users, native experience | 2 min | ⭐ Easy |

---

## Path A: Docker Compose (Recommended)

**Perfect for**: First-time users, quick evaluation, production-like environment

### Step 1: Clone Repository

```bash
git clone https://github.com/your-org/DGOS.git
cd DGOS
```

### Step 2: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit if needed (optional for local development)
# nano .env
```

**Default configuration** (works out of the box):
```bash
NODE_ENV=development
DATABASE_URL=postgres://dgos:dgos@127.0.0.1:5432/dgos
REDIS_URL=redis://127.0.0.1:6379
HOST=127.0.0.1
PORT=3000
```

### Step 3: Start Infrastructure

```bash
# Start PostgreSQL and Redis
docker compose up -d

# Verify services are healthy
docker compose ps
```

Expected output:
```
NAME                COMMAND                  SERVICE      STATUS       PORTS
dgos-postgres-1     "docker-entrypoint..."   postgres     Up (healthy) 0.0.0.0:5432->5432/tcp
dgos-redis-1        "docker-entrypoint..."   redis        Up (healthy) 0.0.0.0:6379->6379/tcp
```

### Step 4: Install Dependencies

```bash
pnpm install --frozen-lockfile
```

⏱️ **This takes 2-3 minutes**

### Step 5: Run Database Migrations

```bash
pnpm migrate:plan
```

This creates the database schema automatically.

### Step 6: Start DGOS

```bash
# Start API server
pnpm --filter @dgos/api dev
```

In a **new terminal**:
```bash
# Start web interface
pnpm --filter @dgos/web dev
```

### Step 7: Access DGOS

Open your browser and navigate to:

```
http://127.0.0.1:5173
```

🎉 **DGOS is running!**

The API health endpoint is available at:
```
http://127.0.0.1:3000/health
```

---

## Path B: Local Development

**Perfect for**: Developers who want full control and debugging capabilities

### Step 1: Clone and Setup

```bash
git clone https://github.com/your-org/DGOS.git
cd DGOS
cp .env.example .env
```

### Step 2: Start Infrastructure

```bash
# Start PostgreSQL and Redis
docker compose up -d

# Wait for services to be healthy (30 seconds)
docker compose ps
```

### Step 3: Install Dependencies

```bash
pnpm install --frozen-lockfile
```

### Step 4: Initialize Database

```bash
# Run migrations
pnpm migrate:plan

# Verify migrations applied
pnpm migrate:check
```

### Step 5: Run Tests (Optional but Recommended)

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:security
pnpm test:integration
```

### Step 6: Start Development Servers

```bash
# Terminal 1: Start API and Worker
pnpm dev

# Terminal 2: Start Web UI
pnpm --filter @dgos/web dev
```

### Step 7: Access DGOS

- **Web Interface**: http://127.0.0.1:5173
- **API Server**: http://127.0.0.1:3000
- **API Health**: http://127.0.0.1:3000/health

---

## Path C: macOS Desktop (Coming Soon)

**Perfect for**: End users who want a native macOS experience

### Step 1: Download

```bash
# Download the latest release
curl -L -o DGOS.dmg https://github.com/your-org/DGOS/releases/latest/download/DGOS.dmg
```

### Step 2: Install

1. Open `DGOS.dmg`
2. Drag DGOS to Applications folder
3. Eject the disk image

### Step 3: Launch

1. Open DGOS from Applications
2. Allow system permissions when prompted
3. Wait for initialization (first launch takes 30-60 seconds)

### Step 4: First Run

The desktop app automatically:
- Sets up local database
- Starts background services
- Opens the workbench

**Status**: The macOS desktop build is in development. For now, use Path A or B.

---

## First Time Setup

After installation, you'll need to configure DGOS for first use.

### 1. Bootstrap Administrator Account

On first launch, DGOS will prompt you to create an admin account.

**Via Web Interface**:
```
http://127.0.0.1:5173/setup
```

**Via API**:
```bash
curl -X POST http://127.0.0.1:3000/admin/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "YourSecurePassword123!",
    "email": "admin@example.com"
  }'
```

**Password Requirements**:
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers
- At least one special character recommended

### 2. Configure Your First Provider

Providers are AI/LLM services that power DGOS tasks.

**Navigate to**: Settings → Providers → Add Provider

**Example: OpenAI**
```json
{
  "name": "OpenAI GPT-4",
  "protocol": "openai-compatible",
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-...",
  "defaultModel": "gpt-4",
  "status": "active"
}
```

**Example: Local Provider**
```json
{
  "name": "Local Ollama",
  "protocol": "openai-compatible",
  "baseUrl": "http://localhost:11434/v1",
  "apiKey": "not-required",
  "defaultModel": "llama2",
  "status": "active"
}
```

**Testing Provider**:

Use the built-in fixture for testing:

```bash
# Start test provider on random port
pnpm provider:fixture

# Note the baseUrl from output, then configure in UI
# Example output: {"baseUrl":"http://127.0.0.1:54321","token":"dgos-fixture-token"}
```

### 3. Install First Package (AI Workbench)

Packages extend DGOS with new capabilities.

**Via Web Interface**:
1. Navigate to **Catalog** → **Packages**
2. Find **AI Workbench**
3. Click **Install**
4. Wait for installation (30 seconds)
5. Click **Launch** to open

**Via API**:
```bash
curl -X POST http://127.0.0.1:3000/packages/install \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "packageId": "ai-workbench",
    "version": "1.0.0"
  }'
```

### 4. Create Your First Task

Tasks are AI-powered workflows.

**From Workbench**:
1. Open AI Workbench
2. Click **New Task**
3. Enter prompt: "Summarize the key features of DGOS"
4. Select Provider: "OpenAI GPT-4"
5. Click **Run**

**Via API**:
```bash
curl -X POST http://127.0.0.1:3000/tasks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "ai-completion",
    "prompt": "Summarize the key features of DGOS",
    "provider": "openai-gpt4",
    "parameters": {
      "temperature": 0.7,
      "maxTokens": 500
    }
  }'
```

### 5. View Results

**In Workbench**:
- Results appear in the output panel
- View execution logs in the sidebar
- Export results as JSON or text

**Via API**:
```bash
# Get task status
curl http://127.0.0.1:3000/tasks/{taskId} \
  -H "Authorization: Bearer YOUR_API_KEY"

# Get task result
curl http://127.0.0.1:3000/tasks/{taskId}/result \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## Common Tasks

### Add a New Provider

```bash
# Navigate to Settings → Providers
# Or use API:
curl -X POST http://127.0.0.1:3000/providers \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Anthropic Claude",
    "protocol": "openai-compatible",
    "baseUrl": "https://api.anthropic.com/v1",
    "apiKey": "sk-ant-...",
    "defaultModel": "claude-3-opus-20240229"
  }'
```

### Install a Package

```bash
# Via Web: Catalog → Browse → Install
# Via CLI (coming soon):
dgos package install <package-name>
```

### Create an API Key

**Via Web Interface**:
1. Navigate to **Settings** → **API Keys**
2. Click **Create API Key**
3. Enter name and select scope
4. Copy and save the key securely

**Via API**:
```bash
curl -X POST http://127.0.0.1:3000/api-keys \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Integration Key",
    "scope": ["tasks:read", "tasks:write"],
    "expiresIn": "90d"
  }'
```

### Configure Settings

**System Settings**:
- Navigate to **Settings** → **System**
- Configure locale, theme, defaults

**User Preferences**:
- Navigate to **Settings** → **Preferences**
- Set editor theme, language, notifications

### View Logs

**Application Logs**:
```bash
# API logs
docker compose logs -f api

# Worker logs
docker compose logs -f worker

# All services
docker compose logs -f
```

**Audit Logs** (Admin only):
- Navigate to **Settings** → **Audit**
- Filter by user, action, date range
- Export for compliance

### Backup and Restore

**Database Backup**:
```bash
# Backup
docker compose exec postgres pg_dump -U dgos dgos > backup.sql

# Restore
docker compose exec -T postgres psql -U dgos dgos < backup.sql
```

**Full System Backup**:
```bash
# Stop services
docker compose down

# Backup volumes
docker run --rm -v dgos_postgres-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/dgos-backup.tar.gz /data

# Restart
docker compose up -d
```

---

## Troubleshooting

### Services Won't Start

**Problem**: `docker compose up -d` fails

**Solution**:
```bash
# Check Docker is running
docker ps

# Check ports are available
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :3000  # API

# Remove old containers
docker compose down -v
docker compose up -d
```

### Database Connection Error

**Problem**: "Connection refused" or "database unavailable"

**Symptoms**:
```
error: connection to server at "127.0.0.1", port 5432 failed
```

**Solution**:
```bash
# 1. Verify PostgreSQL is running
docker compose ps postgres

# 2. Check database health
docker compose exec postgres pg_isready -U dgos -d dgos

# 3. Verify environment variables
cat .env | grep DATABASE_URL

# 4. Restart PostgreSQL
docker compose restart postgres

# 5. Check logs
docker compose logs postgres
```

### Migration Failed

**Problem**: `pnpm migrate:plan` fails

**Solution**:
```bash
# 1. Check migration status
pnpm migrate:check

# 2. View SQL that would be applied
pnpm migrate:sql

# 3. Reset database (WARNING: destroys data)
docker compose down -v
docker compose up -d
sleep 10
pnpm migrate:plan
```

### Port Already in Use

**Problem**: "EADDRINUSE: address already in use"

**Solution**:
```bash
# Find process using port 3000
lsof -ti:3000

# Kill process (macOS/Linux)
kill -9 $(lsof -ti:3000)

# Or change port in .env
echo "PORT=3001" >> .env
```

### pnpm Install Fails

**Problem**: Dependencies won't install

**Solution**:
```bash
# 1. Clear pnpm cache
pnpm store prune

# 2. Remove node_modules
rm -rf node_modules
rm pnpm-lock.yaml

# 3. Reinstall
pnpm install

# 4. Check Node version
node --version  # Must be v22+
```

### API Returns 502/504

**Problem**: Gateway errors from API

**Solution**:
```bash
# 1. Check API health
curl http://127.0.0.1:3000/health

# 2. Check API logs
docker compose logs api

# 3. Verify database connection
docker compose exec postgres psql -U dgos -c "SELECT 1"

# 4. Restart API
docker compose restart api
```

### Provider Test Fixture Won't Start

**Problem**: `pnpm provider:fixture` fails

**Solution**:
```bash
# 1. Check if port is available
lsof -ti:8080

# 2. Use fixed port
DGOS_FIXTURE_PORT=9000 pnpm provider:fixture

# 3. Check logs for errors
pnpm provider:fixture 2>&1 | tee fixture.log
```

### Web UI Shows White Screen

**Problem**: Blank page at http://127.0.0.1:5173

**Solution**:
```bash
# 1. Check Vite dev server
pnpm --filter @dgos/web dev

# 2. Check browser console for errors
# Open DevTools → Console

# 3. Clear browser cache
# Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (macOS)

# 4. Rebuild web assets
pnpm --filter @dgos/web build
```

### Permission Denied Errors

**Problem**: "EACCES" or permission errors

**Solution**:
```bash
# Fix node_modules permissions
sudo chown -R $(whoami) node_modules

# Fix Docker socket (Linux)
sudo usermod -aG docker $USER
# Then log out and back in
```

### Out of Memory

**Problem**: Node process crashes with heap errors

**Solution**:
```bash
# Increase Node memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Or edit package.json scripts
"dev": "NODE_OPTIONS='--max-old-space-size=4096' node --watch src/server.mjs"
```

### Still Having Issues?

1. **Check System Status**: http://127.0.0.1:5173/system-info
2. **Review Logs**: `docker compose logs -f`
3. **Search Issues**: https://github.com/your-org/DGOS/issues
4. **Ask Community**: https://discord.gg/dgos
5. **Report Bug**: https://github.com/your-org/DGOS/issues/new

**Include in bug reports**:
- DGOS version (`git rev-parse HEAD`)
- Operating system
- Node version (`node --version`)
- Docker version (`docker --version`)
- Error messages
- Steps to reproduce

---

## Next Steps

### Explore Features

- **📦 Browse Package Catalog**: Discover extensions and integrations
- **🤖 Configure Providers**: Add more AI providers for different tasks
- **⚙️ Customize Settings**: Set up themes, locales, and preferences
- **📊 View Analytics**: Monitor usage and performance
- **🔐 Set Up Security**: Configure authentication and permissions

### Learn More

- **[User Guide](V1-User-Guide.md)**: Complete feature documentation
- **[Developer Guide](V1-Developer-Guide.md)**: Build extensions and integrations
- **[API Reference](../04-技术架构/当前版本/V1-openapi.yaml)**: Full API specification
- **[Architecture](../04-技术架构/README.md)**: System design and patterns

### Join the Community

- **GitHub**: https://github.com/your-org/DGOS
- **Discord**: https://discord.gg/dgos
- **Twitter**: https://twitter.com/dgos
- **Forum**: https://community.dgos.dev

### Contribute

DGOS is open source! We welcome contributions:

- **Report Bugs**: https://github.com/your-org/DGOS/issues
- **Request Features**: https://github.com/your-org/DGOS/discussions
- **Submit PRs**: https://github.com/your-org/DGOS/pulls
- **Write Docs**: Help improve this guide
- **Build Extensions**: Create packages for the community

### Production Deployment

Ready to deploy DGOS to production?

- **[Production Guide](../05-测试与发布/发布/README.md)**: Deployment best practices
- **[Security Hardening](../04-技术架构/当前版本/安全架构.md)**: Security configuration
- **[Monitoring](../04-技术架构/当前版/可观测性.md)**: Observability and alerts
- **[Backup Strategy](../05-测试与发布/灾备/README.md)**: Disaster recovery planning

---

## Appendix: Quick Reference

### Essential Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f

# Install dependencies
pnpm install

# Run migrations
pnpm migrate:plan

# Start development
pnpm dev

# Run tests
pnpm test

# Check health
curl http://127.0.0.1:3000/health
```

### Default Ports

| Service | Port | URL |
|---------|------|-----|
| Web UI (Dev) | 5173 | http://127.0.0.1:5173 |
| API Server | 3000 | http://127.0.0.1:3000 |
| PostgreSQL | 5432 | postgresql://127.0.0.1:5432 |
| Redis | 6379 | redis://127.0.0.1:6379 |
| MinIO (optional) | 9000/9001 | http://127.0.0.1:9000 |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | development | Environment mode |
| `HOST` | 127.0.0.1 | API bind address |
| `PORT` | 3000 | API port |
| `DATABASE_URL` | postgres://... | PostgreSQL connection |
| `REDIS_URL` | redis://... | Redis connection |
| `SECRET_BACKEND` | development-memory | Secret storage |

### File Locations

```
DGOS/
├── .env                    # Environment configuration
├── docker-compose.yml      # Infrastructure definition
├── apps/api/              # API server source
├── apps/web/              # Web UI source
├── apps/worker/           # Background worker
├── migrations/            # Database migrations
├── docs/                  # Documentation
└── data/                  # Local data (gitignored)
```

---

**Questions?** Check the [User Guide](V1-User-Guide.md) or ask in [Discord](https://discord.gg/dgos)

**Found an issue?** Please [report it](https://github.com/your-org/DGOS/issues)

---

*Last updated: 2026-10-02 | DGOS V1.0.0*
