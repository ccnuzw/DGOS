# DGOS CLI - Complete Command Reference

The ultimate command-line interface for DGOS application development.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [App Development Commands](#app-development-commands)
- [System Commands](#system-commands)
- [Configuration](#configuration)
- [Plugin System](#plugin-system)
- [Tips & Tricks](#tips--tricks)

## Installation

```bash
# Global installation
npm install -g @dgos/cli

# Or with pnpm
pnpm add -g @dgos/cli

# Verify installation
dgos --version
```

## Quick Start

```bash
# Create a new app
dgos app create my-awesome-app

# Navigate to project
cd my-awesome-app

# Start development server
dgos app dev

# Build for production
dgos app build --production

# Package for distribution
dgos app package
```

## App Development Commands

### `dgos app create [name]`

Create a new DGOS application with an interactive wizard.

**Options:**
- `-t, --template <template>` - Template to use (basic, dashboard, productivity, ai-assistant, mcp-integration)
- `-d, --directory <dir>` - Output directory
- `--no-install` - Skip dependency installation
- `--no-git` - Skip git initialization

**Templates:**
- **basic** - Simple application with minimal setup
- **dashboard** - Data visualization dashboard
- **productivity** - Task management application
- **ai-assistant** - AI-powered assistant with chat
- **mcp-integration** - Application with MCP server integration

**Examples:**
```bash
# Interactive mode
dgos app create

# With template
dgos app create my-app --template dashboard

# Quick start with all options
dgos app create my-app -t ai-assistant -d ./projects/my-app
```

**What it does:**
- Creates project directory structure
- Generates `dgos.json` manifest
- Sets up `package.json` with scripts
- Creates template files (HTML, CSS, JS)
- Initializes git repository
- Installs dependencies
- Creates VS Code workspace settings

### `dgos app dev`

Start development server with hot reload and live preview.

**Options:**
- `-p, --port <port>` - Development server port (default: 3000)
- `--host <host>` - Server host (default: localhost)
- `--open` - Open browser automatically

**Features:**
- Hot module reloading
- Live preview in browser
- WebSocket-based file watching
- Automatic reload on file changes
- Error overlay
- Real-time console logs

**Examples:**
```bash
# Start dev server
dgos app dev

# Custom port
dgos app dev --port 8080

# Open browser automatically
dgos app dev --open
```

### `dgos app build`

Build the application for production with optimization.

**Options:**
- `-o, --output <dir>` - Output directory (default: dist)
- `--production` - Build for production (default: true)
- `--minify` - Minify output files
- `--source-maps` - Generate source maps
- `--analyze` - Generate bundle analysis report

**Features:**
- Production optimization
- Asset compression
- Code splitting (when applicable)
- Source map generation
- Bundle size analysis
- Tree shaking

**Examples:**
```bash
# Production build
dgos app build --production

# With source maps and analysis
dgos app build --source-maps --analyze

# Custom output directory
dgos app build -o ./build
```

### `dgos app test`

Run application tests with coverage support.

**Options:**
- `--watch` - Watch mode for continuous testing
- `--coverage` - Generate coverage report
- `--unit` - Run unit tests only
- `--e2e` - Run E2E tests only

**Examples:**
```bash
# Run all tests
dgos app test

# Watch mode
dgos app test --watch

# With coverage
dgos app test --coverage

# Unit tests only
dgos app test --unit
```

### `dgos app lint`

Lint code and validate manifest.

**Options:**
- `--fix` - Auto-fix issues when possible
- `--manifest` - Validate manifest only
- `--security` - Run security scan

**Checks:**
- TypeScript type checking
- Manifest validation (dgos.json)
- Code style issues
- Security vulnerabilities
- Permission usage

**Examples:**
```bash
# Lint everything
dgos app lint

# Auto-fix issues
dgos app lint --fix

# Manifest validation only
dgos app lint --manifest

# Include security scan
dgos app lint --security
```

### `dgos app package`

Package the application into a distributable .dgos file.

**Options:**
- `-o, --output <file>` - Output package file
- `--sign` - Sign the package
- `--compress <level>` - Compression level (1-9)

**What it includes:**
- Built application files
- Manifest (dgos.json)
- Assets and resources
- Package metadata
- Digital signature (if --sign)

**Examples:**
```bash
# Create package
dgos app package

# Custom output name
dgos app package -o my-app-v1.0.0.dgos

# With signature
dgos app package --sign
```

### `dgos app publish [package]`

Publish application to the DGOS app directory.

**Options:**
- `--channel <channel>` - Release channel (stable, beta, dev)
- `--notes <notes>` - Release notes
- `--bump <type>` - Version bump (major, minor, patch)

**Examples:**
```bash
# Publish with version bump
dgos app publish --bump minor --channel stable

# With release notes
dgos app publish --notes "New features added"

# Specific package file
dgos app publish my-app-1.0.0.dgos
```

### `dgos app inspect <appId>`

Inspect running application state and performance.

**Options:**
- `--state` - Show application state
- `--performance` - Show performance metrics

**Examples:**
```bash
# Inspect app
dgos app inspect dev.my-app

# With performance metrics
dgos app inspect dev.my-app --performance
```

### `dgos app logs <appId>`

View real-time application logs.

**Options:**
- `-f, --follow` - Follow log output
- `--level <level>` - Filter by log level (debug, info, warn, error)
- `--search <query>` - Search logs
- `--export <file>` - Export logs to file

**Examples:**
```bash
# View logs
dgos app logs dev.my-app

# Follow in real-time
dgos app logs dev.my-app --follow

# Filter errors only
dgos app logs dev.my-app --level error

# Search logs
dgos app logs dev.my-app --search "authentication"
```

### `dgos app profile <appId>`

Profile application performance.

**Options:**
- `--cpu` - CPU profiling
- `--memory` - Memory profiling
- `--network` - Network analysis
- `--duration <seconds>` - Profiling duration (default: 30)

**Examples:**
```bash
# CPU profiling
dgos app profile dev.my-app --cpu

# Memory profiling for 60 seconds
dgos app profile dev.my-app --memory --duration 60

# Full profile
dgos app profile dev.my-app --cpu --memory --network
```

### `dgos app upgrade`

Upgrade SDK version and dependencies.

**Options:**
- `--sdk <version>` - Upgrade to specific SDK version
- `--migrate` - Run migration scripts
- `--dry-run` - Show what would be upgraded

**Examples:**
```bash
# Upgrade to latest
dgos app upgrade

# Specific version
dgos app upgrade --sdk 2.0.0

# With migration
dgos app upgrade --migrate

# Dry run
dgos app upgrade --dry-run
```

### `dgos app doctor`

Check development environment and dependencies.

**Options:**
- `--fix` - Automatically fix issues

**Checks:**
- Node.js version
- Package manager (npm/pnpm)
- TypeScript installation
- Project structure (dgos.json)
- Dependencies installation
- Configuration validity

**Examples:**
```bash
# Run environment check
dgos app doctor

# Auto-fix issues
dgos app doctor --fix
```

## System Commands

### `dgos init`

Initialize DGOS configuration in current directory.

Creates `.dgosrc.json` with default project settings.

```bash
dgos init
```

### `dgos auth login`

Login to DGOS with username and password.

```bash
dgos auth login
```

### `dgos auth logout`

Logout from DGOS.

```bash
dgos auth logout
```

### `dgos auth status`

Check authentication status.

```bash
dgos auth status
```

### `dgos config set <key> <value>`

Set configuration value.

```bash
dgos config set baseUrl http://localhost:5000
dgos config set defaultProvider openai
dgos config set outputFormat table
```

### `dgos config get <key>`

Get configuration value.

```bash
dgos config get baseUrl
```

### `dgos config list`

List all configuration.

```bash
dgos config list
```

### `dgos tasks create <prompt>`

Create an AI task.

**Options:**
- `--model <model>` - Model to use
- `--provider <provider>` - Provider to use
- `--wait` - Wait for completion

```bash
dgos tasks create "Generate a summary of AI trends"
dgos tasks create "Write code" --model gpt-4 --wait
```

### `dgos tasks list`

List tasks.

**Options:**
- `--status <status>` - Filter by status
- `--page <page>` - Page number
- `--page-size <size>` - Items per page

```bash
dgos tasks list
dgos tasks list --status completed
```

### `dgos tasks get <taskId>`

Get task details.

```bash
dgos tasks get task-123
```

### `dgos system info`

Get system information.

```bash
dgos system info
```

### `dgos system health`

Check system health.

```bash
dgos system health
```

## Plugin System

### `dgos plugin list`

List installed plugins.

```bash
dgos plugin list
```

### `dgos plugin install <name>`

Install a plugin.

```bash
dgos plugin install dgos-cli-eslint
dgos plugin install ./local-plugin
```

### `dgos plugin uninstall <name>`

Uninstall a plugin.

```bash
dgos plugin uninstall dgos-cli-eslint
```

### `dgos plugin create <name>`

Create a new plugin from template.

```bash
dgos plugin create my-plugin
```

## Configuration

### Global Configuration (~/.dgos/config.json)

```json
{
  "baseUrl": "http://localhost:5000",
  "defaultProvider": "openai",
  "defaultModel": "gpt-4",
  "outputFormat": "table",
  "autoUpdate": true,
  "telemetry": false
}
```

### Project Configuration (.dgosrc.json)

```json
{
  "buildDir": "dist",
  "port": 3000,
  "plugins": [
    "dgos-cli-eslint"
  ],
  "defaultProvider": "openai"
}
```

### Environment Variables

- `DGOS_BASE_URL` - Base URL for DGOS API
- `DGOS_API_KEY` - API key for authentication
- `DGOS_OUTPUT_FORMAT` - Default output format
- `DGOS_LOG_LEVEL` - Log level (debug, info, warn, error)

## Tips & Tricks

### 1. Quick Project Setup

```bash
# One-liner to create and start
dgos app create my-app && cd my-app && dgos app dev --open
```

### 2. Build and Package Pipeline

```bash
# Complete build pipeline
dgos app lint && \
dgos app test && \
dgos app build --production --analyze && \
dgos app package
```

### 3. Use Project Config

Create `.dgosrc.json` in your project:

```json
{
  "port": 8080,
  "buildDir": "build",
  "plugins": ["@dgos/plugin-typescript"]
}
```

### 4. Shell Aliases

Add to your `.bashrc` or `.zshrc`:

```bash
alias ddev="dgos app dev"
alias dbuild="dgos app build --production"
alias dtest="dgos app test --watch"
```

### 5. Watch for Changes

```bash
# Continuous testing
dgos app test --watch

# Development with auto-open
dgos app dev --open
```

### 6. Environment-Specific Builds

```bash
# Development build
dgos app build

# Production build with all optimizations
dgos app build --production --minify --analyze
```

### 7. Debug Mode

```bash
# Enable verbose output
dgos --verbose app build

# Check system health
dgos system health --verbose
```

### 8. Multiple Projects

Use different ports for different projects:

```bash
# Project A
cd project-a && dgos app dev --port 3000

# Project B
cd project-b && dgos app dev --port 3001
```

### 9. Quick Validation

```bash
# Before committing
dgos app lint --fix && dgos app test
```

### 10. Performance Optimization

```bash
# Analyze bundle size
dgos app build --analyze

# Profile running app
dgos app profile dev.my-app --cpu --memory
```

## Workflow Examples

### Complete Development Workflow

```bash
# 1. Create new app
dgos app create my-app --template dashboard

# 2. Navigate to project
cd my-app

# 3. Start development
dgos app dev --open

# 4. Make changes, test continuously
dgos app test --watch

# 5. Lint before commit
dgos app lint --fix

# 6. Build for production
dgos app build --production --analyze

# 7. Package application
dgos app package

# 8. Publish to app store
dgos app publish --bump minor --channel stable
```

### CI/CD Pipeline

```bash
#!/bin/bash

# Install dependencies
pnpm install

# Run checks
dgos app doctor
dgos app lint --security
dgos app test --coverage

# Build
dgos app build --production --minify

# Package
dgos app package --sign

# Publish (if on main branch)
if [ "$BRANCH" = "main" ]; then
  dgos app publish --channel stable
fi
```

## Troubleshooting

### Command not found

```bash
# Reinstall globally
npm install -g @dgos/cli

# Or add to PATH
export PATH="$PATH:./node_modules/.bin"
```

### Dev server won't start

```bash
# Check port availability
lsof -i :3000

# Use different port
dgos app dev --port 8080

# Run doctor
dgos app doctor --fix
```

### Build fails

```bash
# Clean and rebuild
rm -rf dist node_modules
pnpm install
dgos app build
```

### Authentication issues

```bash
# Check status
dgos auth status

# Re-login
dgos auth logout
dgos auth login
```

## Learn More

- [DGOS Documentation](https://dgos.dev/docs)
- [SDK Reference](https://dgos.dev/docs/sdk)
- [API Reference](https://dgos.dev/docs/api)
- [Examples](https://github.com/dgos/examples)

## License

MIT
