# MCP System Documentation Index

## Overview

The DGOS MCP (Model Context Protocol) system provides comprehensive support for connecting AI assistants to external tools, services, and data sources.

## Documentation Structure

### 📚 User Documentation
- **[Getting Started Guide](users/getting-started.md)** - Complete introduction to MCP in DGOS
  - What is MCP and why use it
  - Adding servers (presets and manual)
  - Managing connections
  - Using tools
  - Security and permissions
  - Troubleshooting

### 🛠️ Developer Documentation
- **[Creating MCP Servers](developers/creating-servers.md)** - Build your own MCP servers
  - Quick start tutorial
  - Tools, resources, and prompts
  - Input validation
  - Error handling
  - Best practices
  - Complete examples

- **[Protocol Reference](developers/protocol-reference.md)** - Complete MCP protocol specification
  - Transport types
  - Message format (JSON-RPC 2.0)
  - All methods with examples
  - Content types
  - Error codes
  - Security considerations

### ⚡ Quick Reference
- **[Quick Reference Guide](QUICK-REFERENCE.md)** - Handy reference for common tasks
  - Common commands
  - Code snippets
  - Troubleshooting tips
  - API endpoints
  - JSON Schema examples

## Package Documentation

### @dgos/mcp-client
**Location**: `packages/mcp-client/`

MCP protocol client library for connecting to MCP servers.

**Features**:
- Multiple transport support (stdio, SSE, WebSocket)
- Connection lifecycle management
- Tool invocation
- Resource access
- Prompt handling
- Built-in preset library

**Usage**:
```typescript
import { MCPClient } from '@dgos/mcp-client';

const client = new MCPClient();
const connection = await client.connect(config);
const tools = await client.listTools(serverId);
const result = await client.callTool(serverId, 'tool_name', args);
```

**Files**:
- `src/index.ts` - Main client implementation
- `src/types.ts` - TypeScript type definitions
- `src/presets.ts` - Preset server configurations

### @dgos/mcp-server-sdk
**Location**: `packages/mcp-server-sdk/`

SDK for building MCP servers.

**Features**:
- Simple API for server creation
- Automatic JSON-RPC handling
- Tool registration and validation
- Resource management
- Notification support

**Usage**:
```typescript
import { MCPServer, createTextResult } from '@dgos/mcp-server-sdk';

const server = new MCPServer({
  name: 'My Server',
  version: '1.0.0',
});

server.addTool(definition, handler);
await server.start();
```

**Files**:
- `src/index.ts` - Server SDK implementation

## UI Components

### MCP Management Application
**Location**: `apps/web/src/`

Complete UI for managing MCP servers in DGOS.

**Components**:
- `mcp-management.tsx` - Main application with tabbed interface
- `mcp-enhanced-list.tsx` - Server list with status indicators
- `mcp-server-details.tsx` - Detailed server information modal
- `mcp-manual-config.tsx` - Manual server configuration form
- `mcp-preset-selector.tsx` - Quick setup from presets
- `mcp-tool-invoker.tsx` - Interactive tool testing interface
- `mcp-marketplace.tsx` - Browse and discover servers
- `mcp-styles.css` - Comprehensive styling

**Key Features**:
- Real-time connection status
- Tool discovery and testing
- Credential management
- Preset quick setup
- Marketplace browsing

## CLI Tools

### DGOS MCP CLI
**Location**: `packages/cli/src/mcp-cli.mjs`

Command-line tools for MCP server development.

**Commands**:
```bash
dgos mcp create <name>     # Create new server project
dgos mcp dev               # Run with auto-reload
dgos mcp test <server>     # Test server
dgos mcp validate <server> # Validate configuration
dgos mcp package           # Package for distribution
```

## Examples

### Example MCP Servers
**Location**: `examples/mcp-servers/`

Production-ready example implementations:

1. **memory-server.mjs** - Persistent memory storage
   - Store, retrieve, search memories
   - Tag-based categorization
   - Resource access to all memories

2. **filesystem-server.mjs** - Local filesystem access
   - List directories
   - Read/write files
   - File information
   - Project file resources

**Running Examples**:
```bash
node examples/mcp-servers/memory-server.mjs
node examples/mcp-servers/filesystem-server.mjs
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        DGOS UI Layer                         │
│  ┌──────────┬──────────┬──────────┬──────────┬───────────┐  │
│  │  Server  │  Config  │  Tools   │ Presets  │Marketplace│  │
│  │   List   │   Form   │ Invoker  │ Selector │  Browser  │  │
│  └──────────┴──────────┴──────────┴──────────┴───────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                    MCP Client Library                        │
│  (@dgos/mcp-client)                                         │
│  ┌──────────────┬──────────────┬──────────────────────────┐ │
│  │   Transport  │  Connection  │    Protocol Methods      │ │
│  │   Adapters   │  Management  │  (tools/resources/etc)   │ │
│  └──────────────┴──────────────┴──────────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
    ┌─────▼─────┐  ┌─────▼─────┐  ┌────▼────┐
    │   stdio   │  │    SSE    │  │WebSocket│
    │ Transport │  │ Transport │  │Transport│
    └─────┬─────┘  └─────┬─────┘  └────┬────┘
          │              │              │
    ┌─────▼──────────────▼──────────────▼─────┐
    │           MCP Server Instances           │
    │  (Built with @dgos/mcp-server-sdk)      │
    │  ┌────────┬────────┬────────┬─────────┐ │
    │  │ GitHub │ Memory │  File  │ Custom  │ │
    │  │  MCP   │  MCP   │  MCP   │   MCP   │ │
    │  └────────┴────────┴────────┴─────────┘ │
    └──────────────────────────────────────────┘
```

## Integration Points

### With FR-003 (Skill MCP & Agent Integration)
- Implements all required MCP functionality
- Compatible with existing API routes
- Follows security and permission requirements
- Supports credential management
- Provides UI for server management

### With DGOS Core
- Uses `@dgos/dgos-ui` components
- Integrates with permission system
- Uses standard API patterns
- Follows i18n conventions (en/zh)
- Respects design tokens

## Development Workflow

### For Users
1. **Discover** - Browse presets or marketplace
2. **Install** - Quick setup or manual config
3. **Connect** - Enable and connect server
4. **Use** - Tools automatically available in conversations

### For Developers
1. **Create** - Use CLI to scaffold project
2. **Develop** - Implement tools using SDK
3. **Test** - Validate and test locally
4. **Deploy** - Add to DGOS instance
5. **Share** - Publish to marketplace

## Testing Strategy

### Manual Testing
1. Install example servers
2. Verify connection states
3. Test tool invocation
4. Check error handling
5. Validate UI flows

### CLI Testing
```bash
# Validate server
dgos mcp validate examples/mcp-servers/memory-server.mjs

# Test server
dgos mcp test examples/mcp-servers/filesystem-server.mjs
```

### Integration Testing
- Test with real DGOS API
- Verify permission checks
- Test credential storage
- Validate state persistence

## Security Considerations

### Credential Management
- Secrets marked and encrypted
- Never logged or exposed
- Secure storage backend
- Masked in UI

### Permission System
- Tools declare required permissions
- Users review before granting
- Audit logging of all calls
- Sandboxed execution

### Transport Security
- HTTPS for remote servers
- Validated URIs
- Input sanitization
- Resource limits

## Performance

### Optimization Strategies
- Connection pooling
- Tool result caching
- Lazy loading of resources
- Efficient state updates
- Debounced UI interactions

### Resource Management
- Process lifecycle management
- Memory limits for servers
- Timeout handling
- Graceful degradation

## Roadmap

### V1 (Current)
✅ Core MCP client and server SDK  
✅ Complete management UI  
✅ Preset library  
✅ Developer CLI  
✅ Examples and documentation  

### V2 (Future)
- [ ] Enhanced marketplace with ratings
- [ ] Server templates library
- [ ] Advanced monitoring dashboard
- [ ] Batch tool invocation
- [ ] Server health checks
- [ ] Performance analytics

### V3 (Future)
- [ ] Visual tool composition
- [ ] Workflow automation
- [ ] Server clustering
- [ ] Advanced caching
- [ ] Plugin system

## Contributing

### Adding New Presets
1. Edit `packages/mcp-client/src/presets.ts`
2. Add server configuration
3. Test installation flow
4. Update documentation

### Creating Examples
1. Use SDK to build server
2. Add to `examples/mcp-servers/`
3. Include README with usage
4. Test thoroughly

### Improving Documentation
1. Identify gaps or unclear sections
2. Add examples and diagrams
3. Update quick reference
4. Submit PR

## Support & Resources

### Getting Help
- 📖 Read documentation thoroughly
- 💻 Study example implementations
- 🔍 Check troubleshooting guides
- 🐛 Report issues on GitHub

### External Resources
- [MCP Specification](https://modelcontextprotocol.io)
- [JSON-RPC 2.0](https://www.jsonrpc.org/specification)
- [JSON Schema](https://json-schema.org/)

### Community
- GitHub Discussions for Q&A
- Issue tracker for bugs
- Pull requests welcome

---

**Last Updated**: 2024-10-02  
**Version**: 1.0.0  
**Status**: Production Ready
