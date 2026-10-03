# DGOS CLI Quick Reference Card

## Quick Start

```bash
# Create new app
dgos app create my-app

# Start development
cd my-app && dgos app dev --open

# Build for production
dgos app build --production
```

## Essential Commands

### Development
```bash
dgos app create [name]           # Create new app (interactive)
dgos app dev                     # Start dev server with hot reload
dgos app build --production      # Build for production
dgos app test --watch            # Run tests in watch mode
dgos app lint --fix              # Lint and auto-fix
```

### Deployment
```bash
dgos app package                 # Create .dgos package
dgos app publish --bump patch    # Publish with version bump
dgos app upgrade                 # Upgrade SDK/dependencies
```

### Inspection
```bash
dgos app doctor                  # Check environment
dgos app logs <appId> --follow   # View real-time logs
dgos app profile <appId> --cpu   # Profile performance
dgos app inspect <appId>         # Inspect running app
```

### Configuration
```bash
dgos init                        # Initialize .dgosrc.json
dgos config set baseUrl <url>    # Set config value
dgos config list                 # Show all config
```

### Plugins
```bash
dgos plugin list                 # List plugins
dgos plugin install <name>       # Install plugin
```

## Templates

- `basic` - Minimal setup
- `dashboard` - Data visualization
- `productivity` - Task management
- `ai-assistant` - AI chat interface
- `mcp-integration` - MCP server integration

## Options

### Global Options
```bash
--verbose                        # Detailed output
--format json|table|yaml         # Output format
--base-url <url>                 # Override API URL
--api-key <key>                  # Override API key
```

### Dev Server Options
```bash
--port 3000                      # Server port
--host localhost                 # Server host
--open                           # Open browser
```

### Build Options
```bash
--production                     # Production mode
--minify                         # Minify output
--source-maps                    # Generate source maps
--analyze                        # Bundle analysis
```

### Test Options
```bash
--watch                          # Watch mode
--coverage                       # Coverage report
--unit                           # Unit tests only
--e2e                            # E2E tests only
```

### Lint Options
```bash
--fix                            # Auto-fix issues
--manifest                       # Validate manifest only
--security                       # Security scan
```

## Configuration Files

### Global Config (~/.dgos/config.json)
```json
{
  "baseUrl": "http://localhost:5000",
  "outputFormat": "table"
}
```

### Project Config (.dgosrc.json)
```json
{
  "buildDir": "dist",
  "port": 3000,
  "plugins": []
}
```

### Manifest (dgos.json)
```json
{
  "format": "dgos-app/v1",
  "appId": "dev.my-app",
  "version": "1.0.0",
  "name": { "en-US": "My App" },
  "entrypoints": { "main": "src/index.html" }
}
```

## Environment Variables

```bash
DGOS_BASE_URL                    # API base URL
DGOS_API_KEY                     # API key
DGOS_OUTPUT_FORMAT               # Output format
DGOS_LOG_LEVEL                   # Log level
```

## Common Workflows

### New Project
```bash
dgos app create my-app --template dashboard
cd my-app
pnpm install
dgos app dev --open
```

### Development Cycle
```bash
# Terminal 1
dgos app dev

# Terminal 2
dgos app test --watch
```

### Pre-commit
```bash
dgos app lint --fix
dgos app test
```

### Release
```bash
dgos app lint --security
dgos app test --coverage
dgos app build --production --analyze
dgos app package
dgos app publish --bump minor --channel stable
```

## Keyboard Shortcuts

- `Ctrl+C` - Stop dev server
- `Space` - Select in multi-select
- `Enter` - Confirm selection
- `↑/↓` - Navigate lists

## Tips

1. Use `--open` to auto-open browser
2. Use `--watch` for continuous testing
3. Use `--analyze` to check bundle size
4. Use `--fix` to auto-fix lint issues
5. Use `--verbose` when debugging
6. Use `.dgosrc.json` for project settings
7. Create shell aliases for common commands
8. Use `dgos app doctor` when things break
9. Check logs with `dgos app logs --follow`
10. Profile before optimizing with `dgos app profile`

## Get Help

```bash
dgos --help                      # General help
dgos app --help                  # App commands help
dgos app create --help           # Command help
```

## Documentation

- **CLI Reference**: `/docs/cli-reference.md`
- **Developer Guide**: `/docs/cli-guide.md`
- **Plugin Examples**: `/docs/cli-plugin-examples.md`

## Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Port in use | `dgos app dev --port 8080` |
| Module not found | `pnpm install` |
| Build fails | `rm -rf dist && dgos app build` |
| Auth error | `dgos auth logout && dgos auth login` |
| Hot reload broken | Restart dev server |
| Slow build | Use `--analyze` to find large deps |

## Examples

```bash
# Create AI assistant
dgos app create ai-bot --template ai-assistant

# Dev server on custom port
dgos app dev --port 8080 --open

# Production build with analysis
dgos app build --production --minify --analyze

# Test with coverage
dgos app test --coverage --unit

# Lint and fix security issues
dgos app lint --fix --security

# Profile for 60 seconds
dgos app profile dev.my-app --cpu --memory --duration 60

# Publish beta release
dgos app publish --bump minor --channel beta --notes "New features"
```

## Project Structure

```
my-app/
├── .dgosrc.json          # Project config
├── dgos.json             # App manifest
├── package.json          # Dependencies
├── src/                  # Source code
│   ├── index.html       # Entry point
│   ├── app.js           # App logic
│   └── styles.css       # Styles
├── public/              # Static assets
├── tests/               # Tests
└── dist/                # Build output
```

## Status Indicators

- ✓ Success (green)
- ✗ Error (red)
- ⚠ Warning (yellow)
- ℹ Info (blue)
- ⏳ In progress (cyan)

---

**Quick Link**: For full documentation, see `/docs/cli-reference.md`

**Version**: 1.0.0 | **License**: MIT
