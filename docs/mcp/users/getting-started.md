# MCP User Guide

## Getting Started with MCP in DGOS

Model Context Protocol (MCP) enables DGOS to connect to external tools, services, and data sources. This guide will help you get started with MCP servers.

## What is MCP?

MCP (Model Context Protocol) is an open standard that allows AI assistants to securely connect to external tools and data sources. Think of it as a plugin system for AI - instead of the AI being limited to its built-in capabilities, it can use specialized tools through MCP servers.

### Key Concepts

- **MCP Server**: A program that provides tools, resources, or prompts to DGOS
- **Tool**: A function that the AI can call (e.g., search the web, read a file)
- **Resource**: Data that can be accessed (e.g., documents, databases)
- **Prompt**: Pre-configured conversation templates

## Adding MCP Servers

### Quick Setup from Presets

The easiest way to add an MCP server is using presets:

1. Open the MCP Management interface
2. Click on the **Presets** tab
3. Browse available servers by category:
   - **System**: Filesystem, process management
   - **API**: GitHub, Slack, Google Drive
   - **Database**: PostgreSQL, SQLite, MongoDB
   - **Utility**: Memory, notes, calculations
4. Click on a preset card to view details
5. Configure any required credentials
6. Click **Install**

### Manual Configuration

For custom MCP servers:

1. Click the **Add Server** tab
2. Fill in the server configuration:
   - **Server ID**: Unique identifier (e.g., `my-custom-server`)
   - **Command**: Path to the MCP server executable
   - **Arguments**: Command-line arguments (optional)
   - **Working Directory**: Process working directory (optional)
   - **Environment Variables**: Environment variables and secrets
3. Mark sensitive values as **Secret**
4. Click **Preview** to review the configuration
5. Click **Install** to add the server

### Example: Installing GitHub MCP

```
Server ID: github
Command: npx
Arguments: -y @modelcontextprotocol/server-github
Environment Variables:
  - GITHUB_TOKEN: [Your GitHub Token] (Secret)
```

## Managing MCP Servers

### Viewing Servers

The **Servers** tab shows all installed MCP servers with:
- Connection status (Connected, Disconnected, Error)
- Number of available tools
- Last connection time
- Quick actions

### Connecting and Disconnecting

- **Connect**: Start the MCP server and establish communication
- **Disconnect**: Stop the server gracefully
- **Reconnect**: Restart a failed connection

### Server States

- **Enabled/Disabled**: Whether the server is allowed to run
- **Connected**: Server is running and communicating
- **Connecting**: Server is starting up
- **Failed**: Connection error (check logs)
- **Needs Credentials**: Missing required authentication

### Viewing Server Details

Click on a server to see:
- **Information**: Server metadata and configuration
- **Tools**: Available tools with descriptions and schemas
- **Resources**: Accessible data sources
- **Prompts**: Pre-configured templates
- **Logs**: Server output and errors

## Using MCP Tools

### From the Tool Invoker

Test tools directly from the UI:

1. Go to the **Tools** tab
2. Select an MCP server
3. Choose a tool
4. Fill in the required parameters
5. Click **Execute**
6. View the result

### In Conversations

Once connected, MCP tools are automatically available to the AI assistant. Simply ask the AI to perform tasks that require those tools.

Example with GitHub MCP:
```
"List the issues in the dgos-app/dgos repository"
```

The AI will automatically call the appropriate GitHub MCP tool.

## Security and Permissions

### Credentials

- Credentials are stored securely and never logged
- Secrets are encrypted at rest
- Only masked values are shown in the UI

### Permissions

Each MCP server declares required permissions:
- `fs:read`, `fs:write`: File system access
- `network:<domain>`: Network access to specific domains
- `process:spawn`: Ability to spawn processes
- `database:<type>`: Database connections

Review permissions before installing.

### Sandboxing

MCP servers run in isolated processes and:
- Cannot access DGOS internals
- Are subject to resource limits
- Can be stopped at any time

## Troubleshooting

### Server Won't Connect

1. Check the **Logs** tab for error messages
2. Verify the command and arguments are correct
3. Ensure required credentials are provided
4. Check that dependencies are installed (e.g., `npx` for Node packages)

### Connection Drops

- MCP servers may timeout if idle
- Click **Reconnect** to re-establish connection
- Check system resources (memory, CPU)

### Tool Errors

- Verify input parameters match the schema
- Check tool-specific requirements (API keys, permissions)
- Review execution logs for detailed errors

### Missing Tools

- Ensure the server is **Connected** (not just Enabled)
- Click **Refresh** to rediscover tools
- Check server logs for initialization errors

## Best Practices

1. **Start with Presets**: Use official presets when available
2. **Test Before Use**: Use the Tool Invoker to test tools before relying on them
3. **Monitor Connections**: Keep an eye on server status
4. **Secure Credentials**: Use environment variables for sensitive data
5. **Review Permissions**: Understand what each server can access
6. **Keep Updated**: Update MCP servers to get bug fixes and new features

## Popular MCP Servers

### Filesystem
Access local files and directories.
**Use cases**: Read code, write documentation, manage project files

### GitHub
Interact with GitHub repositories.
**Use cases**: Create issues, review PRs, check repository status

### PostgreSQL
Query and manage PostgreSQL databases.
**Use cases**: Data analysis, schema inspection, migrations

### Brave Search
Search the web using Brave Search API.
**Use cases**: Research, fact-checking, current information

### Memory
Persistent memory for conversation context.
**Use cases**: Remember user preferences, track project state

### Puppeteer
Browser automation and web scraping.
**Use cases**: Screenshots, web testing, data extraction

## Next Steps

- Explore the [MCP Marketplace](#) for more servers
- Learn to [build your own MCP server](./developers/creating-servers.md)
- Read the [MCP Protocol Reference](./developers/protocol-reference.md)

## Getting Help

- Check the [FAQ](./faq.md)
- View [Troubleshooting Guide](./troubleshooting.md)
- Report issues on [GitHub](https://github.com/dgos-app/dgos)
