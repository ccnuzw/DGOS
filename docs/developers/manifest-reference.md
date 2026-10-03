# DGOS Application Manifest Reference

> Complete field-by-field reference for DGOS application manifests

## Table of Contents

1. [Overview](#overview)
2. [Required Fields](#required-fields)
3. [Optional Fields](#optional-fields)
4. [Advanced Features](#advanced-features)
5. [Field Reference](#field-reference)
6. [Common Patterns](#common-patterns)
7. [Examples](#examples)
8. [Validation](#validation)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The DGOS application manifest (`dgos.json`) is the core configuration file for every DGOS application. It defines:

- Application identity and metadata
- Runtime requirements and permissions
- UI configuration and entry points
- Dependencies and integrations
- Features and capabilities

### Supported Formats

- **v1** (`dgos-app/v1`): Initial stable format
- **v2** (`dgos-app/v2`): Enhanced format with V2-V6 features

---

## Required Fields

These fields **must** be present in every manifest:

| Field | Type | Description |
|-------|------|-------------|
| `format` | string | Manifest format version |
| `appId` | string | Unique application identifier |
| `version` | string | Semantic version |
| `build` | integer | Build number |
| `releaseChannel` | string | Release channel |
| `minRuntimeVersion` | string | Minimum DGOS version |
| `dataVersion` | integer | Data schema version |
| `name` | object | Localized app name |
| `description` | object | Localized description |
| `category` | string | App category |
| `icon` | string | Path to app icon |
| `entrypoints` | object | Entry point mappings |
| `defaultWindow` | object | Default window config |
| `trustLevel` | string | Requested trust level |
| `backgroundPolicy` | string | Background execution policy |
| `uninstallPolicy` | string | Uninstall policy |
| `permissions` | array | Requested permissions |
| `capabilityAllowlist` | array | Allowed capabilities |

---

## Field Reference

### Core Identity

#### `format`

**Type**: `string`  
**Required**: Yes  
**Values**: `"dgos-app/v1"` | `"dgos-app/v2"`  

Specifies the manifest format version.

```json
{
  "format": "dgos-app/v2"
}
```

#### `appId`

**Type**: `string`  
**Required**: Yes  
**Pattern**: `^[a-z][a-z0-9.-]{1,63}$`  
**Example**: `com.example.myapp`

Globally unique application identifier. Use reverse domain notation.

**Rules**:
- Lowercase letters, numbers, dots, and hyphens only
- Must start with a letter
- 2-64 characters
- Cannot be changed after publication

```json
{
  "appId": "com.example.task-manager"
}
```

**Best Practices**:
- Use your domain: `com.yourcompany.appname`
- For personal projects: `dev.yourname.appname`
- For open source: `org.projectname.appname`

#### `version`

**Type**: `string`  
**Required**: Yes  
**Pattern**: SemVer 2.0.0  
**Example**: `1.2.3`

Semantic version following SemVer specification.

```json
{
  "version": "1.2.3"
}
```

**Version Components**:
- **MAJOR**: Breaking changes (1.0.0 → 2.0.0)
- **MINOR**: New features (1.0.0 → 1.1.0)
- **PATCH**: Bug fixes (1.0.0 → 1.0.1)

**Prerelease versions**:
```json
"version": "2.0.0-beta.1"
"version": "1.5.0-rc.2"
```

#### `build`

**Type**: `integer`  
**Required**: Yes  
**Range**: 0 to 9007199254740991  
**Example**: `42`

Monotonically increasing build number for this version.

```json
{
  "version": "1.0.0",
  "build": 1
}
```

**Rules**:
- Must increment with each build
- Separate build counter for each version
- Cannot reuse build numbers

#### `dataVersion`

**Type**: `integer`  
**Required**: Yes  
**Range**: 0 to 9007199254740991  
**Example**: `1`

Application data schema version. Increment when data structure changes.

```json
{
  "dataVersion": 2,
  "dataMigration": {
    "from": [0, 1],
    "entry": "migrations/2.json"
  }
}
```

**When to increment**:
- Changing storage structure
- Adding/removing required fields
- Changing data types
- Breaking data compatibility

#### `releaseChannel`

**Type**: `string`  
**Required**: Yes  
**Values**: `"stable"` | `"beta"` | `"dev"`  

Distribution channel for this release.

```json
{
  "releaseChannel": "stable"
}
```

**Channels**:
- **stable**: Production releases, all users
- **beta**: Testing releases, opt-in users
- **dev**: Development builds, developers only

#### `minRuntimeVersion`

**Type**: `string`  
**Required**: Yes  
**Example**: `"0.1.0"`

Minimum DGOS runtime version required to run this app.

```json
{
  "minRuntimeVersion": "0.2.0"
}
```

---

### Localization

#### `name`

**Type**: `object`  
**Required**: Yes  

Localized application name.

```json
{
  "name": {
    "zh-CN": "任务管理器",
    "en-US": "Task Manager",
    "ja-JP": "タスクマネージャー"
  }
}
```

**Required locales**: `zh-CN`, `en-US`  
**Optional locales**: Any BCP 47 language tag

**Best Practices**:
- Keep names concise (2-4 words)
- Use title case for en-US
- Avoid special characters
- Test truncation at various widths

#### `description`

**Type**: `object`  
**Required**: Yes  

Localized application description.

```json
{
  "description": {
    "zh-CN": "强大的任务管理工具，帮助您组织工作和生活",
    "en-US": "Powerful task management tool to organize your work and life"
  }
}
```

**Best Practices**:
- 1-2 sentences (80-160 characters)
- Highlight key features
- Target audience: users, not developers
- SEO-friendly for app store

#### `displayName` (optional)

**Type**: `object`  

Alternative display name for specific contexts.

```json
{
  "name": {
    "zh-CN": "任务管理器",
    "en-US": "Task Manager"
  },
  "displayName": {
    "zh-CN": "任务",
    "en-US": "Tasks"
  }
}
```

---

### Categorization

#### `category`

**Type**: `string`  
**Required**: Yes  

Application category for store classification.

```json
{
  "category": "productivity"
}
```

**Standard Categories**:
- `productivity` - Task managers, notes, calendars
- `utilities` - Tools, calculators, converters
- `creative` - Drawing, design, media
- `communication` - Chat, email, collaboration
- `development` - IDEs, debuggers, dev tools
- `data` - Databases, analytics, visualization
- `education` - Learning, tutorials, references
- `entertainment` - Games, media players
- `finance` - Accounting, budgeting
- `health` - Fitness, wellness, medical
- `business` - CRM, ERP, project management

---

### Visual Assets

#### `icon`

**Type**: `string` (path)  
**Required**: Yes  
**Example**: `"public/icon.png"`

Path to application icon.

```json
{
  "icon": "public/icon.png"
}
```

**Requirements**:
- Format: PNG or SVG
- Size: 512×512 pixels (PNG)
- Transparent background recommended
- Square aspect ratio
- Package-relative path

**Icon Guidelines**:
- Simple, recognizable design
- Works at small sizes (16×16)
- Consistent with brand
- Follows DGOS design language

#### `accentColor` (optional)

**Type**: `string`  

Semantic color token for app theming.

```json
{
  "accentColor": "blue-600"
}
```

**Usage**:
- Window title bar
- App store listing
- Notifications
- Splash screen

---

### Entry Points

#### `entrypoints`

**Type**: `object`  
**Required**: Yes  
**Minimum**: 1 entry point  

Mapping of entry point names to HTML files.

```json
{
  "entrypoints": {
    "main": "src/index.html",
    "settings": "src/settings.html",
    "about": "src/about.html"
  }
}
```

**Standard Entry Points**:
- `main` - Primary application window (required)
- `settings` - Settings/preferences window
- `about` - About window
- `help` - Help/documentation window
- `viewer` - Document viewer window

**Rules**:
- Paths must be relative to package root
- No path traversal (`..`)
- Files must exist in package
- HTML files only

---

### Window Configuration

#### `defaultWindow`

**Type**: `object`  
**Required**: Yes  

Default window configuration.

```json
{
  "defaultWindow": {
    "width": 960,
    "height": 720,
    "minWidth": 640,
    "minHeight": 480,
    "maxWidth": 1920,
    "maxHeight": 1080,
    "resizable": true,
    "maximizable": true,
    "minimizable": true,
    "closable": true,
    "alwaysOnTop": false,
    "fullscreenable": true,
    "transparent": false,
    "frame": true
  }
}
```

**Fields**:
- `width`, `height` - Initial dimensions (pixels)
- `minWidth`, `minHeight` - Minimum dimensions
- `maxWidth`, `maxHeight` - Maximum dimensions
- `resizable` - Allow resizing
- `maximizable` - Allow maximize
- `minimizable` - Allow minimize
- `closable` - Allow closing (should be true)
- `alwaysOnTop` - Stay above other windows
- `fullscreenable` - Allow fullscreen
- `transparent` - Transparent window
- `frame` - Show window frame

**Window Size Guidelines**:
- Default: 960×720 (good balance)
- Minimum: 640×480 (usability threshold)
- Maximum: Don't constrain unless needed
- Consider multi-monitor setups

#### `preferredWindow` (optional)

**Type**: `object`  

Preferred window configuration (overrides `defaultWindow`).

```json
{
  "preferredWindow": {
    "width": 1280,
    "height": 800
  }
}
```

#### `minWindowSize` (optional)

**Type**: `object`  

Minimum window dimensions (alternative to `defaultWindow.minWidth`).

```json
{
  "minWindowSize": {
    "width": 800,
    "height": 600
  }
}
```

---

### Security & Trust

#### `trustLevel`

**Type**: `string`  
**Required**: Yes  
**Values**: `"standard"` | `"trusted"` | `"system"`  

Requested trust level. Actual trust determined by platform.

```json
{
  "trustLevel": "standard"
}
```

**Trust Levels**:
- **standard**: Normal applications (default)
- **trusted**: Verified applications with extended permissions
- **system**: System-level applications (DGOS only)

**Note**: Declaring `trusted` or `system` doesn't grant trust. Trust must be verified through signing and platform authorization.

#### `uninstallPolicy`

**Type**: `string`  
**Required**: Yes  
**Values**: `"user-removable"` | `"protected-preinstall"`  

Uninstall policy declaration.

```json
{
  "uninstallPolicy": "user-removable"
}
```

**Policies**:
- **user-removable**: Users can uninstall (default for apps)
- **protected-preinstall**: Protected from uninstall (requires authorization)

**Note**: Declaring `protected-preinstall` doesn't prevent uninstall. Must be authorized by platform administrator.

#### `backgroundPolicy`

**Type**: `string`  
**Required**: Yes  
**Values**: `"release"` | `"keep-alive"`  

Background execution policy.

```json
{
  "backgroundPolicy": "release"
}
```

**Policies**:
- **release**: Process released when windows closed
- **keep-alive**: Process kept alive in background

**Use `keep-alive` for**:
- Background services
- Real-time sync
- Notifications
- System monitoring

#### `permissions`

**Type**: `array` of `string`  
**Required**: Yes  
**Default**: `[]`

Requested permission identifiers.

```json
{
  "permissions": [
    "storage.kv.read",
    "storage.kv.write",
    "network.fetch",
    "notifications.send",
    "clipboard.read",
    "clipboard.write"
  ]
}
```

**Standard Permissions**:

**Storage**:
- `storage.kv.read` - Read key-value storage
- `storage.kv.write` - Write key-value storage
- `storage.file.read` - Read file storage
- `storage.file.write` - Write file storage

**Network**:
- `network.fetch` - HTTP requests
- `network.websocket` - WebSocket connections
- `network.unrestricted` - All network access (dangerous)

**System**:
- `system.context.read` - Read system context
- `system.info.read` - Read system information
- `system.clipboard.read` - Read clipboard
- `system.clipboard.write` - Write clipboard

**Notifications**:
- `notifications.send` - Send notifications
- `notifications.manage` - Manage notifications

**Files**:
- `file.read` - Read files
- `file.write` - Write files
- `file.delete` - Delete files

#### `capabilityAllowlist`

**Type**: `array` of `string`  
**Required**: Yes  
**Default**: `[]`

Allowed capability identifiers that app can invoke.

```json
{
  "capabilityAllowlist": [
    "dgos.storage.kv.get",
    "dgos.storage.kv.set",
    "dgos.storage.kv.delete",
    "dgos.network.fetch",
    "dgos.ui.notify",
    "dgos.ui.toast",
    "dgos.ui.dialog"
  ]
}
```

**Standard Capabilities**:

**Storage**:
- `dgos.storage.kv.get` - Get key-value
- `dgos.storage.kv.set` - Set key-value
- `dgos.storage.kv.delete` - Delete key-value
- `dgos.storage.kv.list` - List keys

**Network**:
- `dgos.network.fetch` - HTTP fetch
- `dgos.network.ws.connect` - WebSocket connect

**UI**:
- `dgos.ui.notify` - Show notification
- `dgos.ui.toast` - Show toast
- `dgos.ui.dialog` - Show dialog
- `dgos.ui.menu` - Show menu

**System**:
- `dgos.system.context.read` - Read context
- `dgos.system.info` - System info
- `dgos.clipboard.read` - Read clipboard
- `dgos.clipboard.writeText` - Write text to clipboard

**AI/Model**:
- `dgos.model.list` - List models
- `dgos.model.resolve` - Resolve model
- `dgos.aiTask.submit` - Submit AI task
- `dgos.aiTask.get` - Get task status
- `dgos.aiTask.cancel` - Cancel task

#### `networkAllowlist` (optional)

**Type**: `array` of `string`  

Allowed network domains and URLs.

```json
{
  "networkAllowlist": [
    "https://api.example.com",
    "https://*.example.com",
    "wss://socket.example.com"
  ]
}
```

**Patterns**:
- Exact URLs: `https://api.example.com`
- Wildcards: `https://*.example.com`
- All subdomains: `https://*.example.com`

#### `contentSecurityPolicy` (optional)

**Type**: `string`  

Content Security Policy directives.

```json
{
  "contentSecurityPolicy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.example.com"
}
```

---

### Dependencies

#### `dependencies`

**Type**: `object`  

Application dependencies.

```json
{
  "dependencies": {
    "apps": [
      {
        "appId": "com.dgos.canvas",
        "version": "1.0.0",
        "optional": false
      }
    ],
    "skills": [
      {
        "packageId": "com.example.skills",
        "skillId": "data-processor",
        "version": "1.0.0",
        "operationIds": ["process", "validate"]
      }
    ],
    "mcp": [
      {
        "sourceId": "github",
        "version": "1.0.0",
        "operationIds": ["read-repo", "create-issue"]
      }
    ]
  }
}
```

**App Dependencies**:
- `appId` - Required app identifier
- `version` - Required semantic version (exact)
- `optional` - Whether dependency is optional

**Skill Dependencies**:
- `packageId` - Skill package identifier
- `skillId` - Skill identifier
- `version` - Required version
- `operationIds` - Required operations

**MCP Dependencies**:
- `sourceId` - MCP source identifier
- `version` - Required version
- `operationIds` - Required operations

---

### Actions

#### `actions`

**Type**: `array` of `object`  

Registered action declarations.

```json
{
  "actions": [
    {
      "actionId": "create-task",
      "version": "1.0.0",
      "label": {
        "zh-CN": "创建任务",
        "en-US": "Create Task"
      },
      "description": {
        "zh-CN": "创建新任务",
        "en-US": "Create a new task"
      },
      "inputSchema": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "description": { "type": "string" },
          "dueDate": { "type": "string", "format": "date-time" }
        },
        "required": ["title"]
      },
      "outputSchema": {
        "type": "object",
        "properties": {
          "taskId": { "type": "string" },
          "created": { "type": "boolean" }
        }
      },
      "requiredCapabilities": ["dgos.storage.kv.set"],
      "risk": "write",
      "sideEffects": "local-write",
      "confirmation": "none",
      "idempotency": "safe",
      "cancellable": false,
      "handler": "task.create"
    }
  ]
}
```

**Action Fields**:
- `actionId` - Unique action identifier (should be prefixed with appId)
- `version` - Action version
- `label` - Localized action label
- `description` - Localized description
- `inputSchema` - JSON Schema for input
- `outputSchema` - JSON Schema for output
- `requiredCapabilities` - Required capabilities
- `risk` - Risk level: `read`, `write`, `external`, `destructive`
- `sideEffects` - Side effects: `none`, `local-write`, `external-call`, `model-call`, `secret-use`, `destructive`
- `confirmation` - Confirmation level: `none`, `required`, `elevated`
- `idempotency` - Idempotency: `safe`, `required`, `unsupported`
- `cancellable` - Whether action can be cancelled
- `handler` - Registered handler identifier

---

### Advanced Features (V2)

#### `intents`

**Type**: `array` of `object`  

Intent handler declarations for inter-app communication.

```json
{
  "intents": [
    {
      "intentId": "view-document",
      "action": "view",
      "category": ["document", "text"],
      "dataSchema": {
        "type": "object",
        "properties": {
          "documentId": { "type": "string" },
          "format": { "type": "string" }
        }
      },
      "mimeTypes": ["text/plain", "text/markdown"],
      "priority": 50
    }
  ]
}
```

#### `widgets`

**Type**: `array` of `object`  

Widget declarations.

```json
{
  "widgets": [
    {
      "widgetId": "weather-widget",
      "name": {
        "zh-CN": "天气小部件",
        "en-US": "Weather Widget"
      },
      "description": {
        "zh-CN": "显示当前天气",
        "en-US": "Shows current weather"
      },
      "entrypoint": "src/widgets/weather.html",
      "icon": "public/weather-icon.png",
      "defaultSize": {
        "width": 300,
        "height": 200
      },
      "resizable": true,
      "refreshInterval": 300000,
      "configurable": true,
      "configSchema": {
        "type": "object",
        "properties": {
          "location": { "type": "string" },
          "units": { "enum": ["celsius", "fahrenheit"] }
        }
      }
    }
  ]
}
```

#### `backgroundServices`

**Type**: `array` of `object`  

Background service declarations.

```json
{
  "backgroundServices": [
    {
      "serviceId": "sync-service",
      "name": {
        "zh-CN": "同步服务",
        "en-US": "Sync Service"
      },
      "entrypoint": "src/services/sync.js",
      "autoStart": true,
      "restartPolicy": "on-failure",
      "maxRestarts": 3,
      "requiredCapabilities": ["dgos.network.fetch"]
    }
  ]
}
```

#### `extensions`

**Type**: `array` of `object`  

Extension point declarations.

```json
{
  "extensions": [
    {
      "extensionId": "custom-menu",
      "type": "menu",
      "target": "main-menu",
      "label": {
        "zh-CN": "自定义菜单",
        "en-US": "Custom Menu"
      },
      "icon": "public/menu-icon.png",
      "entrypoint": "src/extensions/menu.js",
      "position": 10
    }
  ]
}
```

#### `commands`

**Type**: `array` of `object`  

UI command declarations.

```json
{
  "commands": [
    {
      "commandId": "quick-add",
      "label": {
        "zh-CN": "快速添加",
        "en-US": "Quick Add"
      },
      "shortcut": "Ctrl+N",
      "category": "editing"
    }
  ]
}
```

#### `shortcuts`

**Type**: `array` of `object`  

Keyboard shortcut declarations.

```json
{
  "shortcuts": [
    {
      "shortcutId": "toggle-sidebar",
      "key": "Ctrl+B",
      "command": "sidebar.toggle",
      "when": "editorFocus",
      "platform": "all"
    }
  ]
}
```

#### `fileAssociations`

**Type**: `array` of `object`  

File type associations.

```json
{
  "fileAssociations": [
    {
      "extension": ".md",
      "mimeType": "text/markdown",
      "description": {
        "zh-CN": "Markdown文档",
        "en-US": "Markdown Document"
      },
      "icon": "public/markdown-icon.png"
    }
  ]
}
```

#### `exportedAPIs`

**Type**: `array` of `object`  

APIs exported for other apps.

```json
{
  "exportedAPIs": [
    {
      "apiId": "task-api",
      "version": "1.0.0",
      "description": {
        "zh-CN": "任务管理API",
        "en-US": "Task Management API"
      },
      "methods": [
        {
          "methodId": "create-task",
          "inputSchema": { "type": "object" },
          "outputSchema": { "type": "object" },
          "requiredCapabilities": []
        }
      ]
    }
  ]
}
```

#### `dataSchemas`

**Type**: `object`  

Application data schemas (JSON Schema).

```json
{
  "dataSchemas": {
    "task": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        "completed": { "type": "boolean" }
      },
      "required": ["id", "title"]
    }
  }
}
```

#### `featureFlags`

**Type**: `object`  

Feature flag declarations with defaults.

```json
{
  "featureFlags": {
    "enableNewUI": false,
    "enableBetaFeatures": false,
    "enableDebugMode": false
  }
}
```

#### `performance`

**Type**: `object`  

Performance budget declarations.

```json
{
  "performance": {
    "maxBundleSize": 500000,
    "maxMemory": 150,
    "maxCPU": 10,
    "maxStartupTime": 2000,
    "maxRenderTime": 1000
  }
}
```

#### `accessibility`

**Type**: `object`  

Accessibility configuration.

```json
{
  "accessibility": {
    "wcagLevel": "AA",
    "keyboardNavigable": true,
    "screenReaderSupport": true,
    "highContrastSupport": true,
    "textScaling": true,
    "ariaLabels": true
  }
}
```

#### `metadata`

**Type**: `object`  

Application metadata for store listing.

```json
{
  "metadata": {
    "author": "Your Name",
    "homepage": "https://example.com",
    "repository": "https://github.com/example/app",
    "license": "MIT",
    "tags": ["productivity", "tasks", "organization"],
    "screenshots": [
      {
        "url": "public/screenshots/main.png",
        "caption": {
          "zh-CN": "主界面",
          "en-US": "Main Interface"
        }
      }
    ]
  }
}
```

---

## Common Patterns

### Minimal Application

```json
{
  "format": "dgos-app/v1",
  "appId": "dev.example.minimal",
  "version": "1.0.0",
  "build": 1,
  "releaseChannel": "dev",
  "minRuntimeVersion": "0.1.0",
  "dataVersion": 1,
  "name": {
    "zh-CN": "最小应用",
    "en-US": "Minimal App"
  },
  "description": {
    "zh-CN": "最小DGOS应用示例",
    "en-US": "Minimal DGOS application example"
  },
  "category": "utilities",
  "icon": "public/icon.png",
  "entrypoints": {
    "main": "src/index.html"
  },
  "defaultWindow": {
    "width": 800,
    "height": 600,
    "resizable": true,
    "maximizable": true
  },
  "backgroundPolicy": "release",
  "trustLevel": "standard",
  "uninstallPolicy": "user-removable",
  "permissions": [],
  "capabilityAllowlist": []
}
```

### Data-Driven Application

```json
{
  "format": "dgos-app/v2",
  "appId": "com.example.data-app",
  "version": "1.0.0",
  "build": 1,
  "releaseChannel": "stable",
  "minRuntimeVersion": "0.2.0",
  "dataVersion": 2,
  "permissions": [
    "storage.kv.read",
    "storage.kv.write",
    "network.fetch"
  ],
  "capabilityAllowlist": [
    "dgos.storage.kv.get",
    "dgos.storage.kv.set",
    "dgos.network.fetch"
  ],
  "dataSchemas": {
    "user": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" }
      }
    }
  },
  "dataMigration": {
    "from": [0, 1],
    "entry": "migrations/2.json"
  }
}
```

### Background Service

```json
{
  "backgroundPolicy": "keep-alive",
  "backgroundServices": [
    {
      "serviceId": "main-service",
      "name": {
        "zh-CN": "主服务",
        "en-US": "Main Service"
      },
      "entrypoint": "src/service.js",
      "autoStart": true,
      "restartPolicy": "always"
    }
  ],
  "permissions": [
    "notifications.send",
    "network.fetch"
  ]
}
```

---

## Validation

Validate your manifest using:

```bash
dgos app validate ./dgos.json
```

Common validation errors:

1. **Missing required fields**
   ```
   Error: Missing required field: "appId"
   ```

2. **Invalid appId format**
   ```
   Error: appId must match pattern ^[a-z][a-z0-9.-]{1,63}$
   ```

3. **Invalid version**
   ```
   Error: version must be valid SemVer
   ```

4. **Missing locales**
   ```
   Error: name must include zh-CN and en-US
   ```

5. **Path traversal**
   ```
   Error: Invalid path "../outside" - paths must be relative
   ```

---

## Troubleshooting

### App fails to install

**Check**:
- Manifest validates without errors
- All referenced files exist
- Icon file is valid PNG/SVG
- appId is unique

### Permissions denied

**Check**:
- Permission is in `permissions` array
- Capability is in `capabilityAllowlist`
- Trust level is sufficient
- Network domains are in `networkAllowlist`

### Data migration fails

**Check**:
- `dataVersion` incremented
- Migration script exists
- Migration script is valid JSON
- `from` array includes old versions

### Widget not appearing

**Check**:
- Widget entry point exists
- Widget has valid configuration
- Background policy is set correctly
- Required permissions granted

---

## Resources

- [Development Standards](./development-standards.md)
- [Getting Started Guide](./getting-started.md)
- [Manifest Schema V1](../04-技术架构/当前版本/V1-app-manifest.schema.json)
- [Manifest Schema V2](../04-技术架构/当前版本/V2-app-manifest.schema.json)
- [SDK Documentation](../sdk-cli-guide.md)

---

**Version**: 2.0.0  
**Last Updated**: 2024-10-03  
**Status**: Active
