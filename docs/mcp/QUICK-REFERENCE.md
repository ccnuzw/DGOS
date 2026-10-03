# MCP Quick Reference

## For Users

### Adding a Server

**Quick Setup (Preset)**
1. MCP Management → Presets tab
2. Select server → Configure credentials (if needed)
3. Install

**Manual Setup**
1. MCP Management → Add Server tab
2. Fill in: Server ID, Command, Arguments
3. Add environment variables (mark secrets)
4. Preview → Install

### Managing Servers

**Connect**: Enable → Connect  
**Disconnect**: Disconnect button  
**View Details**: Click server card  
**Delete**: Uninstall button (with confirmation)

### Using Tools

**From UI**: Tools tab → Select server → Choose tool → Fill params → Execute  
**From Chat**: Just ask! Tools are auto-discovered

### Connection States

- 🟢 **Connected**: Ready to use
- 🟡 **Connecting**: Starting up
- 🔴 **Failed**: Check logs
- 🟠 **Needs Credentials**: Add credentials

## For Developers

### Create New Server

```bash
dgos mcp create my-server
cd my-server
npm install
```

### Basic Server Structure

```javascript
import { MCPServer, createTextResult } from '@dgos/mcp-server-sdk';

const server = new MCPServer({
  name: 'My Server',
  version: '1.0.0',
});

server.addTool({
  name: 'my_tool',
  description: 'Does something useful',
  inputSchema: {
    type: 'object',
    properties: {
      input: { type: 'string' }
    },
    required: ['input']
  }
}, async (args) => {
  return createTextResult(`Result: ${args.input}`);
});

await server.start();
```

### Common Patterns

**Validation**
```javascript
if (!args.required_field) {
  return createErrorResult('Missing required field');
}
```

**Multiple Content Types**
```javascript
return {
  content: [
    { type: 'text', text: 'Result' },
    { type: 'image', data: base64, mimeType: 'image/png' }
  ]
};
```

**Resources**
```javascript
server.addResource({
  uri: 'data://items',
  name: 'Items',
  mimeType: 'application/json'
}, async () => ({
  contents: [{
    uri: 'data://items',
    text: JSON.stringify(items)
  }]
}));
```

### Testing

```bash
# Validate
dgos mcp validate src/index.mjs

# Test
dgos mcp test src/index.mjs

# Dev mode (auto-reload)
dgos mcp dev
```

### Deploy to DGOS

1. Add via MCP Management UI
2. Server ID: `my-server`
3. Command: `node`
4. Arguments: `/absolute/path/to/src/index.mjs`

## Quick Troubleshooting

**Server won't connect**
- Verify command path is correct
- Check if dependencies installed
- View logs tab for errors

**Tool errors**
- Verify input matches schema
- Check required credentials
- Review error message details

**Connection drops**
- Click Reconnect
- Check system resources
- Review server logs

## API Endpoints

```
GET    /api/v1/mcp                      # List servers
POST   /api/v1/mcp                      # Install server
GET    /api/v1/mcp/:id                  # Server details
DELETE /api/v1/mcp/:id                  # Uninstall
POST   /api/v1/mcp/:id/connect          # Connect
POST   /api/v1/mcp/:id/disconnect       # Disconnect
GET    /api/v1/mcp/:id/tools            # List tools
POST   /api/v1/mcp/:id/tools/:name/invoke  # Invoke tool
```

## File Locations

```
Client SDK:     packages/mcp-client/
Server SDK:     packages/mcp-server-sdk/
CLI:            packages/cli/src/mcp-cli.mjs
UI:             apps/web/src/mcp-*.tsx
Examples:       examples/mcp-servers/
Docs:           docs/mcp/
```

## Common JSON Schemas

**String with length**
```json
{
  "type": "string",
  "minLength": 1,
  "maxLength": 100
}
```

**Number with range**
```json
{
  "type": "number",
  "minimum": 0,
  "maximum": 100
}
```

**Enum**
```json
{
  "type": "string",
  "enum": ["option1", "option2"]
}
```

**Object**
```json
{
  "type": "object",
  "properties": {
    "field": { "type": "string" }
  },
  "required": ["field"]
}
```

**Array**
```json
{
  "type": "array",
  "items": { "type": "string" },
  "minItems": 1,
  "maxItems": 10
}
```

## Environment Variables

**For MCP Servers**
```bash
GITHUB_TOKEN=ghp_xxx
BRAVE_API_KEY=xxx
POSTGRES_CONNECTION_STRING=postgresql://...
```

**In DGOS Config**
```
Environment Variables:
  GITHUB_TOKEN: [secret value] (Secret: ✓)
```

## CLI Commands

```bash
# Create project
dgos mcp create my-server

# Development
dgos mcp dev

# Testing
dgos mcp test server.mjs
dgos mcp validate server.mjs

# Package
dgos mcp package
```

## Protocol Messages

**Initialize**
```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{
  "protocolVersion":"2024-11-05",
  "clientInfo":{"name":"DGOS","version":"1.0.0"}
}}
```

**List Tools**
```json
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
```

**Call Tool**
```json
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{
  "name":"search",
  "arguments":{"query":"test"}
}}
```

## Security Checklist

- [ ] Validate all inputs
- [ ] Mark credentials as secret
- [ ] Use HTTPS for remote servers
- [ ] Limit resource access
- [ ] Implement timeouts
- [ ] Log to stderr only
- [ ] Never log credentials
- [ ] Review permissions

## Popular Presets

| Server | Category | Credentials? | Use Case |
|--------|----------|--------------|----------|
| Filesystem | System | No | File operations |
| GitHub | API | Yes | Repository management |
| PostgreSQL | Database | Yes | Database queries |
| Brave Search | API | Yes | Web search |
| Memory | Utility | No | Context storage |
| Puppeteer | Automation | No | Browser automation |

## Resources

- 📖 [User Guide](users/getting-started.md)
- 🛠️ [Developer Guide](developers/creating-servers.md)
- 📋 [Protocol Reference](developers/protocol-reference.md)
- 💻 [Examples](README.md)
- 🌐 [MCP Spec](https://modelcontextprotocol.io)

## Support

- Check documentation first
- Review examples for patterns
- Test with validation CLI
- Check server logs for errors
- Report issues on GitHub

---

**Version**: 1.0.0 | **Last Updated**: 2024-10-02
