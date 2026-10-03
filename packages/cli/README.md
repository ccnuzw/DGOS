# @dgos/cli

Official command-line interface for DGOS.

## Installation

```bash
npm install -g @dgos/cli
```

## Configuration

Configure the CLI to connect to your DGOS instance:

```bash
dgos config set baseUrl http://localhost:5000
```

Configuration is stored in `~/.dgos/config.json`.

## Authentication

### Login with Username/Password

```bash
dgos auth login
```

### Create API Key

```bash
dgos auth create-key
```

The API key will be stored in `~/.dgos/credentials.json`.

### Use API Key from Environment

```bash
export DGOS_API_KEY=your-api-key
dgos tasks list
```

### Check Authentication Status

```bash
dgos auth status
```

### Logout

```bash
dgos auth logout
```

## Commands

### Tasks

Create and manage AI tasks:

```bash
# Create a task
dgos tasks create "Generate an image of a cat"

# Create with specific model
dgos tasks create "Write a poem" --model gpt-4 --provider openai

# Create and wait for completion
dgos tasks create "Summarize this text" --wait

# Get task status
dgos tasks get <task-id>

# List tasks
dgos tasks list
dgos tasks list --status completed
dgos tasks list --page 2 --page-size 50

# Cancel a task
dgos tasks cancel <task-id>

# Stream task events
dgos tasks stream <task-id>
```

### Providers

Manage AI provider configurations:

```bash
# List providers
dgos providers list

# Get provider details
dgos providers get <provider-id>

# Configure provider interactively
dgos providers configure

# Test provider connection
dgos providers test <provider-id>

# List models for a provider
dgos providers models <provider-id>

# Refresh model catalog
dgos providers models <provider-id> --refresh

# Delete provider
dgos providers delete <provider-id>
dgos providers delete <provider-id> --yes  # Skip confirmation
```

### Packages

Install and manage DGOS packages:

```bash
# List packages
dgos packages list

# Get package details
dgos packages get ai-workbench

# Install package
dgos packages install ai-workbench

# Install specific version
dgos packages install ai-workbench --version 2.0.0

# Update package
dgos packages update ai-workbench 2.1.0

# Uninstall package
dgos packages uninstall ai-workbench
dgos packages uninstall ai-workbench --yes  # Skip confirmation
```

### API Keys

Manage API keys:

```bash
# List API keys
dgos auth list-keys

# Create API key
dgos auth create-key

# Revoke API key
dgos auth revoke-key <key-id>
dgos auth revoke-key <key-id> --yes  # Skip confirmation
```

### System

Get system information:

```bash
# System information
dgos system info

# Health check
dgos system health

# System settings
dgos system settings
```

### Configuration

Manage CLI configuration:

```bash
# Get configuration value
dgos config get baseUrl

# Set configuration value
dgos config set baseUrl http://localhost:5000
dgos config set outputFormat table

# List all configuration
dgos config list
```

## Output Formats

Most commands support multiple output formats:

```bash
# JSON (default for most commands)
dgos tasks list --format json

# Table (human-readable)
dgos tasks list --format table

# YAML
dgos tasks list --format yaml
```

## Examples

### Complete Workflow

```bash
# Configure CLI
dgos config set baseUrl http://localhost:5000

# Login
dgos auth login

# Configure a provider
dgos providers configure

# Create and run a task
dgos tasks create "Generate a summary of quantum computing" --wait

# Check task status
dgos tasks get <task-id>

# List completed tasks
dgos tasks list --status completed --format table
```

### Using API Keys

```bash
# Create API key
dgos auth create-key

# Export API key
export DGOS_API_KEY=sk-...

# Use CLI with API key
dgos tasks create "Test task"
```

### Batch Operations

```bash
# List all providers
dgos providers list --format json > providers.json

# Install multiple packages
dgos packages install ai-workbench
dgos packages install code-assistant
dgos packages install image-generator
```

## Environment Variables

- `DGOS_BASE_URL` - Base URL for DGOS API
- `DGOS_API_KEY` - API key for authentication
- `DGOS_OUTPUT_FORMAT` - Default output format (json, table, yaml)

## Configuration File

Configuration is stored in `~/.dgos/config.json`:

```json
{
  "baseUrl": "http://localhost:5000",
  "defaultProvider": "openai",
  "defaultModel": "gpt-4",
  "outputFormat": "table"
}
```

Credentials are stored separately in `~/.dgos/credentials.json`:

```json
{
  "apiKey": "sk-...",
  "session": "session-token"
}
```

## Global Options

```bash
dgos --help              # Show help
dgos --version           # Show version
dgos --verbose           # Verbose output
dgos --base-url <url>    # Override base URL
dgos --api-key <key>     # Override API key
```

## Shell Completion

Add shell completion for better experience:

```bash
# Bash
dgos completion bash >> ~/.bashrc

# Zsh
dgos completion zsh >> ~/.zshrc

# Fish
dgos completion fish >> ~/.config/fish/completions/dgos.fish
```

## Troubleshooting

### Authentication Issues

```bash
# Check authentication status
dgos auth status

# Re-login
dgos auth logout
dgos auth login
```

### Connection Issues

```bash
# Verify base URL
dgos config get baseUrl

# Test connection
dgos system health
```

### Debug Mode

```bash
# Enable verbose output
dgos --verbose tasks list
```

## License

MIT
