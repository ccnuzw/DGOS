# DGOS CLI Developer Guide

Complete guide to building exceptional applications with the DGOS CLI.

## Overview

The DGOS CLI is designed to provide the best developer experience for building, testing, and deploying DGOS applications. This guide covers workflows, best practices, and advanced techniques.

## Getting Started

### Installation

```bash
npm install -g @dgos/cli
```

### First Application

```bash
# Create your first app
dgos app create hello-world

# Navigate to project
cd hello-world

# Start development server
dgos app dev --open
```

Your browser will open to `http://localhost:3000` with hot reload enabled.

## Development Workflow

### 1. Project Creation

The interactive wizard guides you through creating a new application:

```bash
dgos app create
```

You'll be prompted for:
- Application name
- Description
- Template selection
- Configuration preferences

**Available Templates:**

- **Basic** - Minimal setup, perfect for learning
- **Dashboard** - Data visualization with charts
- **Productivity** - Task management and notes
- **AI Assistant** - Chat interface with AI integration
- **MCP Integration** - Model Context Protocol integration

### 2. Development Server

Start the dev server with hot reload:

```bash
dgos app dev
```

**Features:**
- Instant hot reload on file changes
- WebSocket-based live updates
- Automatic browser refresh
- Error overlay for quick debugging
- Console log forwarding

**Custom Configuration:**

```bash
# Custom port
dgos app dev --port 8080

# Custom host
dgos app dev --host 0.0.0.0

# Auto-open browser
dgos app dev --open
```

### 3. Code Quality

Run linting and validation:

```bash
# Lint everything
dgos app lint

# Auto-fix issues
dgos app lint --fix

# Validate manifest only
dgos app lint --manifest
```

### 4. Testing

Comprehensive testing support:

```bash
# Run all tests
dgos app test

# Watch mode for TDD
dgos app test --watch

# Generate coverage report
dgos app test --coverage

# Unit tests only
dgos app test --unit

# E2E tests
dgos app test --e2e
```

### 5. Building

Build for production with optimizations:

```bash
# Production build
dgos app build --production

# With minification
dgos app build --production --minify

# Generate source maps
dgos app build --source-maps

# Analyze bundle size
dgos app build --analyze
```

The build process:
1. Validates manifest
2. Processes and optimizes files
3. Copies assets
4. Generates metadata
5. Creates bundle analysis (if requested)

### 6. Packaging

Create a distributable package:

```bash
# Create .dgos package
dgos app package

# Custom output name
dgos app package -o my-app-v1.0.0.dgos

# Sign package (requires certificate)
dgos app package --sign
```

### 7. Publishing

Publish to the DGOS app directory:

```bash
# Publish with version bump
dgos app publish --bump patch

# Specify release channel
dgos app publish --channel beta

# With release notes
dgos app publish --notes "Bug fixes and improvements"
```

## Project Structure

### Recommended Structure

```
my-app/
├── .dgosrc.json          # Project configuration
├── dgos.json             # Application manifest
├── package.json          # Node.js dependencies
├── tsconfig.json         # TypeScript configuration
├── .gitignore           # Git ignore rules
├── README.md            # Project documentation
├── src/                 # Source code
│   ├── index.html      # Main HTML entry
│   ├── app.js          # Application logic
│   ├── styles.css      # Styles
│   └── components/     # UI components
├── public/              # Static assets
│   ├── icon.png        # App icon
│   └── images/         # Images
├── tests/               # Test files
│   ├── unit/           # Unit tests
│   └── e2e/            # E2E tests
└── dist/                # Build output (generated)
```

### Manifest (dgos.json)

The manifest defines your application:

```json
{
  "format": "dgos-app/v1",
  "appId": "dev.my-app",
  "version": "1.0.0",
  "build": 1,
  "releaseChannel": "dev",
  "minRuntimeVersion": "0.1.0",
  "name": {
    "zh-CN": "我的应用",
    "en-US": "My Application"
  },
  "description": {
    "zh-CN": "应用描述",
    "en-US": "Application description"
  },
  "category": "utilities",
  "icon": "public/icon.png",
  "entrypoints": {
    "main": "src/index.html"
  },
  "defaultWindow": {
    "width": 960,
    "height": 720,
    "resizable": true
  },
  "permissions": [],
  "capabilityAllowlist": [],
  "dependencies": {
    "apps": [],
    "skills": [],
    "mcp": []
  }
}
```

### Project Configuration (.dgosrc.json)

Per-project settings:

```json
{
  "buildDir": "dist",
  "port": 3000,
  "plugins": [
    "dgos-cli-typescript",
    "dgos-cli-eslint"
  ],
  "defaultProvider": "openai",
  "baseUrl": "http://localhost:5000"
}
```

## Best Practices

### 1. Version Control

Always use git for version control:

```bash
# Initialize on project creation
dgos app create my-app  # Automatically initializes git

# Commit often
git add .
git commit -m "feat: add user authentication"
```

### 2. Continuous Testing

Use watch mode during development:

```bash
# Terminal 1: Dev server
dgos app dev

# Terminal 2: Test watch
dgos app test --watch
```

### 3. Pre-commit Checks

Create a pre-commit hook:

```bash
#!/bin/sh
dgos app lint --fix
dgos app test
```

### 4. Environment Validation

Run doctor before starting work:

```bash
dgos app doctor
```

### 5. Manifest Validation

Validate manifest frequently:

```bash
dgos app lint --manifest
```

### 6. Bundle Analysis

Regularly check bundle size:

```bash
dgos app build --analyze
```

Review `dist/build-analysis.json` to identify large dependencies.

### 7. Security Scanning

Include security checks:

```bash
dgos app lint --security
```

### 8. Documentation

Document your application:
- Update README.md with setup instructions
- Comment complex code
- Document API interfaces
- Include examples

## Advanced Techniques

### Custom Build Scripts

Add custom scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "dgos app dev",
    "build": "dgos app build --production",
    "test": "dgos app test",
    "lint": "dgos app lint --fix",
    "package": "dgos app package",
    "publish": "dgos app publish",
    "prebuild": "dgos app lint && dgos app test",
    "postbuild": "dgos app package"
  }
}
```

### Environment Variables

Use environment variables for configuration:

```bash
export DGOS_BASE_URL=https://api.dgos.dev
export DGOS_API_KEY=your-api-key
export DGOS_LOG_LEVEL=debug

dgos app dev
```

### Multiple Environments

Create environment-specific configs:

```json
// .dgosrc.development.json
{
  "baseUrl": "http://localhost:5000",
  "port": 3000
}

// .dgosrc.production.json
{
  "baseUrl": "https://api.dgos.dev",
  "port": 80
}
```

### Plugin Development

Create custom plugins to extend the CLI:

```javascript
// my-plugin/index.js
export function register(program) {
  program
    .command('my-command')
    .description('My custom command')
    .action(() => {
      console.log('Hello from my plugin!');
    });
}

export const metadata = {
  name: 'dgos-cli-my-plugin',
  version: '1.0.0',
  description: 'My custom plugin',
};
```

Install locally:

```bash
dgos plugin install ./my-plugin
```

### Debugging

Enable verbose mode for debugging:

```bash
dgos --verbose app build
```

View detailed logs:

```bash
dgos app logs dev.my-app --follow --level debug
```

### Performance Profiling

Profile your application:

```bash
# CPU profiling
dgos app profile dev.my-app --cpu --duration 60

# Memory profiling
dgos app profile dev.my-app --memory

# Network analysis
dgos app profile dev.my-app --network
```

### Automated Deployment

Create a deployment script:

```bash
#!/bin/bash
set -e

echo "🚀 Deploying application..."

# 1. Run checks
dgos app doctor
dgos app lint --security
dgos app test

# 2. Build
dgos app build --production --minify

# 3. Package
dgos app package --sign

# 4. Publish
dgos app publish --bump patch --channel stable

echo "✓ Deployment complete!"
```

## Troubleshooting

### Common Issues

**1. Port already in use**

```bash
# Use different port
dgos app dev --port 8080

# Or kill process using the port
lsof -ti:3000 | xargs kill -9
```

**2. Module not found**

```bash
# Reinstall dependencies
rm -rf node_modules
pnpm install
```

**3. Build fails**

```bash
# Clean build directory
rm -rf dist

# Rebuild
dgos app build
```

**4. Authentication errors**

```bash
# Check authentication
dgos auth status

# Re-login
dgos auth logout
dgos auth login
```

**5. Hot reload not working**

```bash
# Restart dev server
# Press Ctrl+C, then:
dgos app dev
```

### Getting Help

```bash
# Command help
dgos app --help
dgos app build --help

# Check system status
dgos system health

# Run environment check
dgos app doctor --fix
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install DGOS CLI
        run: npm install -g @dgos/cli
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Lint
        run: dgos app lint
      
      - name: Test
        run: dgos app test --coverage
      
      - name: Build
        run: dgos app build --production
      
      - name: Package
        run: dgos app package
      
      - name: Publish
        if: github.ref == 'refs/heads/main'
        run: dgos app publish --channel stable
        env:
          DGOS_API_KEY: ${{ secrets.DGOS_API_KEY }}
```

### GitLab CI

```yaml
stages:
  - test
  - build
  - deploy

test:
  stage: test
  script:
    - npm install -g @dgos/cli
    - pnpm install
    - dgos app lint --security
    - dgos app test --coverage

build:
  stage: build
  script:
    - npm install -g @dgos/cli
    - pnpm install
    - dgos app build --production
    - dgos app package
  artifacts:
    paths:
      - dist/
      - "*.dgos"

deploy:
  stage: deploy
  script:
    - npm install -g @dgos/cli
    - dgos app publish --channel stable
  only:
    - main
```

## Resources

- [CLI Reference](./cli-reference.md)
- [SDK Documentation](./sdk-cli-guide.md)
- [API Reference](https://dgos.dev/docs/api)
- [Examples Repository](https://github.com/dgos/examples)
- [Community Forum](https://forum.dgos.dev)

## Contributing

Found a bug or have a feature request? Please open an issue on GitHub.

## License

MIT
