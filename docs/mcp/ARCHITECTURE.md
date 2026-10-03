# DGOS MCP System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              DGOS Frontend                               │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                    MCP Management Application                   │    │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌────────────┐           │    │
│  │  │Server│ │ Add  │ │Tools │ │Preset│ │Marketplace │           │    │
│  │  │ List │ │Server│ │Invoke│ │Select│ │  Browser   │           │    │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └────────────┘           │    │
│  └────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTP/WebSocket
┌───────────────────────────────▼─────────────────────────────────────────┐
│                           DGOS Backend API                               │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                    MCP Management Service                       │    │
│  │  • Server Configuration CRUD                                    │    │
│  │  • Connection State Management                                  │    │
│  │  • Tool Discovery & Invocation                                  │    │
│  │  • Credential Management                                        │    │
│  │  • Permission Enforcement                                       │    │
│  └────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                       MCP Client Library Layer                           │
│                        (@dgos/mcp-client)                                │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Connection Manager                                             │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐     │    │
│  │  │   Connection │  │  Connection  │  │    Connection    │     │    │
│  │  │     Pool     │  │   Lifecycle  │  │   Health Check   │     │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘     │    │
│  │                                                                 │    │
│  │  Protocol Layer                                                │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐     │    │
│  │  │    Tools     │  │  Resources   │  │     Prompts      │     │    │
│  │  │  Management  │  │  Management  │  │   Management     │     │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘     │    │
│  │                                                                 │    │
│  │  Transport Adapters                                            │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐     │    │
│  │  │    Stdio     │  │     SSE      │  │    WebSocket     │     │    │
│  │  │   Adapter    │  │   Adapter    │  │     Adapter      │     │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘     │    │
│  └────────────────────────────────────────────────────────────────┘    │
└───────────────┬──────────────────┬──────────────────┬───────────────────┘
                │                  │                  │
        ┌───────▼──────┐  ┌────────▼────────┐  ┌─────▼──────┐
        │    stdin     │  │   HTTP/SSE      │  │ WebSocket  │
        │    stdout    │  │   Connection    │  │ Connection │
        └───────┬──────┘  └────────┬────────┘  └─────┬──────┘
                │                  │                  │
┌───────────────▼──────────────────▼──────────────────▼───────────────────┐
│                         MCP Server Instances                             │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │              Built with @dgos/mcp-server-sdk                    │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │    │
│  │  │  GitHub  │  │  Memory  │  │   File   │  │  Custom  │       │    │
│  │  │   MCP    │  │   MCP    │  │   MCP    │  │   MCP    │  ...  │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │    │
│  │                                                                 │    │
│  │  Each Server Provides:                                         │    │
│  │  • Tools (executable functions)                                │    │
│  │  • Resources (data access)                                     │    │
│  │  • Prompts (conversation templates)                            │    │
│  └────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Interaction Flow

### 1. Server Installation Flow

```
User Action: Install MCP Server
         │
         ▼
   ┌─────────────┐
   │  UI Layer   │  Select preset or manual config
   └──────┬──────┘
          │ HTTP POST /api/v1/mcp
          ▼
   ┌─────────────┐
   │ Backend API │  Validate config, store in DB
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │  Database   │  Save server configuration
   └─────────────┘
```

### 2. Server Connection Flow

```
User Action: Connect to Server
         │
         ▼
   ┌─────────────┐
   │  UI Layer   │  Click "Connect" button
   └──────┬──────┘
          │ HTTP POST /api/v1/mcp/:id/connect
          ▼
   ┌─────────────┐
   │ Backend API │  Retrieve config, initiate connection
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │ MCP Client  │  Create transport adapter
   └──────┬──────┘
          │ spawn process / HTTP / WebSocket
          ▼
   ┌─────────────┐
   │ MCP Server  │  Initialize, return capabilities
   └──────┬──────┘
          │ JSON-RPC response
          ▼
   ┌─────────────┐
   │ MCP Client  │  Store connection, discover tools
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │  UI Layer   │  Display connected state + tool count
   └─────────────┘
```

### 3. Tool Invocation Flow

```
User/AI: Execute Tool
         │
         ▼
   ┌─────────────┐
   │  UI Layer   │  Fill parameters, click Execute
   └──────┬──────┘
          │ HTTP POST /api/v1/mcp/:id/tools/:name/invoke
          ▼
   ┌─────────────┐
   │ Backend API │  Check permissions, validate input
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │ MCP Client  │  Send tools/call JSON-RPC request
   └──────┬──────┘
          │ {"method": "tools/call", "params": {...}}
          ▼
   ┌─────────────┐
   │ MCP Server  │  Execute tool handler
   └──────┬──────┘
          │ Return result
          ▼
   ┌─────────────┐
   │ MCP Client  │  Parse response
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │ Backend API │  Log, audit, return result
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │  UI Layer   │  Display result (text/image/resource)
   └─────────────┘
```

## Data Flow Diagram

```
┌──────────────┐
│     User     │
└──────┬───────┘
       │
       │ Interacts with
       ▼
┌──────────────┐     Configuration      ┌──────────────┐
│   MCP UI     │────────────────────────▶│   Database   │
└──────┬───────┘                         └──────────────┘
       │                                          ▲
       │ Invokes                                  │
       ▼                                          │ Stores
┌──────────────┐     Permission Check    ┌──────┴──────┐
│  MCP Client  │────────────────────────▶│ Permission  │
└──────┬───────┘                         │   System    │
       │                                 └─────────────┘
       │ Calls                                   ▲
       ▼                                         │
┌──────────────┐                                │ Logs
│  MCP Server  │                         ┌──────┴──────┐
│   Instance   │────────────────────────▶│    Audit    │
└──────┬───────┘      Records            │     Log     │
       │                                 └─────────────┘
       │ Accesses
       ▼
┌──────────────┐
│  External    │
│  Resources   │
│ (Files, APIs)│
└──────────────┘
```

## Package Dependencies

```
┌────────────────────────────────────────────────┐
│              DGOS Web Application              │
│  ┌──────────────────────────────────────────┐ │
│  │         MCP Management UI                │ │
│  │  (mcp-management.tsx + components)       │ │
│  └────────────────┬─────────────────────────┘ │
│                   │ imports                    │
│                   ▼                            │
│  ┌──────────────────────────────────────────┐ │
│  │          @dgos/mcp-client                │ │
│  │  • MCPClient class                       │ │
│  │  • Type definitions                      │ │
│  │  • Preset library                        │ │
│  └────────────────┬─────────────────────────┘ │
│                   │ uses                       │
│                   ▼                            │
│  ┌──────────────────────────────────────────┐ │
│  │          @dgos/dgos-ui                   │ │
│  │  • Button, Panel, Alert                  │ │
│  │  • Tabs, Badge, Status                   │ │
│  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│          MCP Server Development                │
│  ┌──────────────────────────────────────────┐ │
│  │         Custom MCP Server                │ │
│  │  (user's implementation)                 │ │
│  └────────────────┬─────────────────────────┘ │
│                   │ imports                    │
│                   ▼                            │
│  ┌──────────────────────────────────────────┐ │
│  │       @dgos/mcp-server-sdk               │ │
│  │  • MCPServer class                       │ │
│  │  • Helper functions                      │ │
│  │  • Type definitions                      │ │
│  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│           CLI Development Tools                │
│  ┌──────────────────────────────────────────┐ │
│  │            dgos mcp CLI                  │ │
│  │  • create, test, validate                │ │
│  │  • dev, package                          │ │
│  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

## State Management

```
┌─────────────────────────────────────────────────┐
│              MCP Server State                   │
├─────────────────────────────────────────────────┤
│                                                 │
│  Server Lifecycle:                              │
│    discovered → installed → enabled →           │
│    connecting → connected → running             │
│                                                 │
│  Connection States:                             │
│    • disconnected                               │
│    • connecting                                 │
│    • connected                                  │
│    • failed                                     │
│    • stopped                                    │
│    • needs-credentials                          │
│                                                 │
│  Server Data:                                   │
│    • serverId (unique identifier)               │
│    • displayName, description                   │
│    • version, author                            │
│    • connectionType (stdio/sse/websocket)       │
│    • capabilities (tools/resources/prompts)     │
│    • toolCount (discovered tools)               │
│    • lastConnected (timestamp)                  │
│    • error (if failed)                          │
│                                                 │
│  Credentials:                                   │
│    • stored separately (encrypted)              │
│    • referenced by credentialRef                │
│    • never in logs or UI                        │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Security Layers

```
┌─────────────────────────────────────────────────┐
│              Security Architecture              │
└─────────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌───────────┐  ┌───────────┐  ┌───────────┐
│Permission │  │Credential │  │  Process  │
│  System   │  │  Storage  │  │  Sandbox  │
└─────┬─────┘  └─────┬─────┘  └─────┬─────┘
      │              │              │
      │ Checks       │ Encrypts     │ Isolates
      │              │              │
      ▼              ▼              ▼
┌─────────────────────────────────────────┐
│          MCP Server Execution           │
│  • Input validation                     │
│  • Resource limits                      │
│  • Timeout enforcement                  │
│  • Audit logging                        │
└─────────────────────────────────────────┘
```

## File System Layout

```
DGOS/
├── packages/
│   ├── mcp-client/              # MCP protocol client
│   │   ├── src/
│   │   │   ├── index.ts         # Main client
│   │   │   ├── types.ts         # Type definitions
│   │   │   └── presets.ts       # Preset configs
│   │   └── package.json
│   │
│   ├── mcp-server-sdk/          # Server development SDK
│   │   ├── src/
│   │   │   └── index.ts         # Server framework
│   │   └── package.json
│   │
│   └── cli/
│       └── src/
│           └── mcp-cli.mjs      # Development CLI
│
├── apps/web/src/
│   ├── mcp-management.tsx       # Main app
│   ├── mcp-enhanced-list.tsx    # Server list
│   ├── mcp-server-details.tsx   # Details modal
│   ├── mcp-manual-config.tsx    # Config form
│   ├── mcp-preset-selector.tsx  # Preset selector
│   ├── mcp-tool-invoker.tsx     # Tool tester
│   ├── mcp-marketplace.tsx      # Marketplace
│   └── mcp-styles.css           # Styling
│
├── examples/mcp-servers/
│   ├── memory-server.mjs        # Memory example
│   └── filesystem-server.mjs    # Filesystem example
│
└── docs/mcp/
    ├── README.md                # Index
    ├── QUICK-REFERENCE.md       # Quick ref
    ├── users/
    │   └── getting-started.md   # User guide
    └── developers/
        ├── creating-servers.md  # Dev guide
        └── protocol-reference.md # Protocol spec
```

---

**Version**: 1.0.0  
**Last Updated**: 2024-10-02  
**Status**: Production Ready
