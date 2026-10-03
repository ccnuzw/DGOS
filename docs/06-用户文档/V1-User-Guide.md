# DGOS V1 User Guide

**Version**: V1.0.0  
**Last Updated**: 2026-10-02  
**Audience**: End Users, Administrators

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [System Info UI](#system-info-ui)
3. [Developer Center](#developer-center)
4. [Extensions Management](#extensions-management)
5. [System Assistant](#system-assistant)
6. [Provider Configuration](#provider-configuration)
7. [Package Management](#package-management)
8. [AI Task Workflow](#ai-task-workflow)
9. [Settings & Preferences](#settings--preferences)
10. [Troubleshooting](#troubleshooting)

---

## Getting Started

### First Launch

1. **Launch DGOS Desktop** (macOS):
   - Open DGOS from Applications folder
   - Or run from terminal: `pnpm tauri dev`

2. **First-Time Setup**:
   - Bootstrap administrator account
   - Set password (minimum 12 characters)
   - Configure initial settings

3. **Access Web Interface**:
   - Navigate to `http://localhost:3000`
   - Or use the embedded workbench in desktop app

### User Roles

**Administrator**:
- Full system access
- Provider configuration
- Package approval
- System settings
- Audit log access

**Regular User**:
- Install approved packages
- Submit AI tasks
- Manage personal extensions
- View own audit trail

**Developer**:
- Test package installation
- Access developer center
- View extension logs
- Debug application issues

---

## System Info UI

### Overview

The System Info screen provides comprehensive information about your DGOS installation, including version, status, and system health.

### Accessing System Info

**From Desktop**:
1. Open DGOS application
2. Navigate to **Settings** > **System Info**

**From Web**:
1. Navigate to `http://localhost:3000/settings`
2. Click **System Info** tab

### Information Displayed

#### Version Information
- **DGOS Version**: Current release (v1.0.0)
- **Build Date**: Build timestamp
- **Commit Hash**: Git commit identifier
- **Node Version**: Runtime version

#### System Status
- **API Status**: API server health
- **Database Status**: PostgreSQL connection
- **Redis Status**: Cache server connection
- **Worker Status**: Background worker health

#### Resource Usage
- **Database Connections**: Active/max connections
- **Redis Memory**: Cache utilization
- **Task Queue**: Pending/active tasks

#### Configuration
- **Environment**: Development/Production
- **Provider Count**: Active providers
- **Model Count**: Available models
- **Package Count**: Installed packages

### Health Indicators

🟢 **Green**: Healthy, all systems operational  
🟡 **Yellow**: Warning, degraded performance  
🔴 **Red**: Error, service unavailable  
⚪ **Gray**: Unknown or not configured

---

## Developer Center

### Overview

The Developer Center is where developers can test, validate, and manage applications before they're approved for general distribution.

### Accessing Developer Center

**Requirements**:
- Developer role or administrator privileges
- Developer center package installed

**Access**:
1. Navigate to **Apps** > **Developer Center**
2. Or go to `http://localhost:3000/developer`

### Package Validation

#### Upload Package

1. Click **Upload Package**
2. Select `.dgos` package file
3. System validates:
   - Manifest schema
   - Permission declarations
   - Resource integrity
   - Signature (if signed)

#### Validation Results

**Success** (✅):
- Package name and version
- Declared capabilities
- Required permissions
- Resource summary

**Failure** (❌):
- Error type and location
- Validation message
- Suggested fixes

### Test Installation

#### Installing for Testing

1. Select validated package
2. Click **Test Install**
3. Review permissions requested
4. Confirm installation

**What Happens**:
- Package staged to test environment
- Health check executed
- Activation if health check passes
- Rollback if health check fails

#### Health Check Results

**Pass** (✅):
- Application launches successfully
- Required APIs accessible
- No fatal errors in logs

**Fail** (❌):
- Error details
- Log excerpts
- Previous version restored
- Application data preserved

### Package Management

#### View Installed Test Packages

**Package List Shows**:
- Package name and version
- Installation status
- Active/staged version
- Last health check result

#### Uninstall Test Package

1. Select package from list
2. Click **Uninstall**
3. Confirm deletion

**Note**: Uninstalling removes:
- Application files
- Configuration (optional)
- Does NOT remove: User data, audit logs

### Developer Logs

#### Viewing Logs

1. Select package
2. Click **View Logs**
3. Filter by:
   - Time range
   - Log level (error, warn, info, debug)
   - Component

#### Log Information

Each log entry shows:
- Timestamp
- Log level
- Component name
- Message
- Context (if available)

**Security**: Secrets are redacted from logs

---

## Extensions Management

### Overview

Extensions add capabilities to DGOS through Skills, MCP integrations, and custom tools.

### Accessing Extensions

1. Navigate to **Settings** > **Extensions**
2. Or go to `http://localhost:3000/extensions`

### Installing Extensions

#### From Catalog

1. Browse extension catalog
2. Review extension details:
   - Name and description
   - Author
   - Permissions required
   - User ratings (if available)
3. Click **Install**
4. Approve permissions
5. Wait for installation to complete

#### Manual Installation

1. Click **Install from File**
2. Select extension package
3. Validate and install

### Managing Extensions

#### Enable/Disable

**To Disable**:
1. Find extension in list
2. Toggle switch to **Off**
3. Extension stops but remains installed

**To Enable**:
1. Find disabled extension
2. Toggle switch to **On**
3. Extension resumes operation

#### Configure Extension

1. Click extension name
2. Click **Configure**
3. Modify settings:
   - Credentials (if required)
   - API endpoints
   - Behavior options
4. Click **Save**

#### Update Extension

**Automatic Updates** (if enabled):
- System checks for updates
- Notifies when available
- Prompts to install

**Manual Update**:
1. Click extension name
2. Click **Check for Updates**
3. If available, click **Update**
4. Review changes
5. Confirm update

#### Uninstall Extension

1. Click extension name
2. Click **Uninstall**
3. Confirm deletion

**Warning**: Uninstalling removes:
- Extension files
- Configuration
- Stored credentials
- User data (optional prompt)

### Extension Status

**Status Indicators**:
- 🟢 **Active**: Running normally
- 🟡 **Starting**: Initialization in progress
- 🟠 **Degraded**: Partial functionality
- 🔴 **Error**: Failed to start or crashed
- ⚪ **Disabled**: Manually disabled

### Credentials Management

#### Template Credentials

Some extensions use template credentials:

1. Click **Configure** on extension
2. Select credential template
3. Fill in required fields:
   - API key
   - Secret token
   - Endpoint URL
4. Click **Save**

**Security**: Credentials are encrypted at rest

#### Testing Connection

1. After configuring credentials
2. Click **Test Connection**
3. Wait for result:
   - ✅ Success: Connection established
   - ❌ Failure: Error message shown

### Extension Isolation

**Security Features**:
- Extensions run in isolated contexts
- Limited file system access
- Network calls monitored
- Permission checks enforced

---

## System Assistant

### Overview

The System Assistant is an AI-powered helper that can execute system actions, answer questions, and automate tasks.

### Accessing Assistant

**From Desktop**:
- Press **Cmd+Space** (macOS)
- Or click **Assistant** icon in menu bar

**From Web**:
- Click **Assistant** in navigation
- Or go to `http://localhost:3000/assistant`

### Using the Assistant

#### Text Input

1. Type your request:
   - "Show me system status"
   - "Install package XYZ"
   - "List recent audit events"
   - Natural language queries

2. Press **Enter** or click **Send**

#### Quick Actions

Predefined shortcuts:
- **System Info**: View system status
- **Check Updates**: Check for package updates
- **View Logs**: Open audit log viewer
- **Settings**: Open system settings

### Action Execution

#### How It Works

1. **Input**: You provide request
2. **Planning**: Assistant generates action plan
3. **Review**: You review planned actions
4. **Confirmation**: You approve or reject
5. **Execution**: Actions execute if approved
6. **Results**: Output displayed

#### Action Types

**Information Actions** (no confirmation):
- View system status
- List packages
- Query audit logs
- Read configuration

**Modification Actions** (requires confirmation):
- Install/uninstall packages
- Change settings
- Grant/revoke permissions
- Modify Provider configuration

**Dangerous Actions** (requires explicit confirmation):
- Delete data
- Revoke credentials
- Disable security features
- Factory reset

### Action Plans

#### Plan Review

Before execution, review shows:
- **Actions**: List of operations
- **Impact**: What will change
- **Permissions**: Required permissions
- **Reversibility**: Can it be undone?

#### Plan Approval

- **Approve**: Click **Execute Plan**
- **Modify**: Click **Edit** to adjust
- **Reject**: Click **Cancel**

### Running Actions

#### Progress Tracking

During execution:
- Progress indicator
- Current step
- Estimated time remaining
- Cancel option (if safe)

#### Long-Running Actions

For tasks that take time:
- Receive **Run ID** for tracking
- Close assistant (task continues)
- Check status later with Run ID
- Receive notification when complete

### Action Results

**Success** (✅):
- Confirmation message
- Result summary
- Changed values (if applicable)

**Failure** (❌):
- Error message
- Reason for failure
- Suggested remediation
- Rollback status (if applicable)

---

## Provider Configuration

### Overview

Providers are external AI services that power DGOS task execution. Configure providers to enable AI features.

### Accessing Provider Settings

1. Navigate to **Settings** > **Providers**
2. Or go to `http://localhost:3000/settings/providers`

**Required Role**: Administrator

### Adding a Provider

#### Supported Protocols

V1 supports:
- ✅ **openai-compatible**: OpenAI-compatible APIs
- 🔶 **anthropic**: Planned for V2
- 🔶 **google**: Planned for V2
- 🔶 **custom**: Custom adapters in V2+

#### Add Provider Steps

1. Click **Add Provider**
2. Select protocol: `openai-compatible`
3. Enter provider details:
   - **Name**: Friendly name (e.g., "OpenAI Production")
   - **Base URL**: API endpoint (e.g., `https://api.openai.com/v1`)
   - **API Key**: Your API key
   - **Organization ID**: Optional org identifier
4. Click **Save**

**Security Note**: API keys are encrypted at rest and never displayed in logs.

### Testing Provider Connection

#### Connection Test

1. Select provider from list
2. Click **Test Connection**
3. Wait for results:
   - ✅ **Success**: Shows latency and model count
   - ❌ **Failure**: Shows error reason

**Test Results Include**:
- Connection latency (ms)
- Authentication status
- Available model count
- API version (if supported)

#### What Connection Test Checks

- Network connectivity
- API endpoint validity
- Authentication success
- Basic API functionality

**Note**: Connection test does NOT:
- Refresh model catalog
- Make billable API calls
- Store credentials until you save

### Refreshing Model Catalog

**Important**: Model refresh is EXPLICIT and MANUAL.

#### Why Explicit Refresh?

- Avoid unexpected changes
- Control when models appear
- Preserve custom classifications
- Audit when catalog changes

#### How to Refresh

1. Select provider
2. Click **Refresh Catalog**
3. Confirm action
4. Wait for refresh (usually <5 seconds)
5. Review new models

**What Happens**:
- Query provider for available models
- Add new models to catalog
- Preserve existing classifications
- Update catalog version
- Log refresh event in audit

**What's Preserved**:
- ✅ Model capabilities you assigned
- ✅ Default model selections
- ✅ Enabled/disabled status
- ✅ Historical configurations

### Model Classification

#### Understanding Capabilities

Models can have multiple capabilities:

**V1 Functional**:
- **text**: Text generation (LLM chat)

**UI Ready (Backend V3+)**:
- **image-generation**: Create images
- **video-generation**: Create videos
- **audio-generation**: Create audio/music

**UI Ready (Backend Future)**:
- **image-understanding**: Analyze images
- **video-understanding**: Analyze videos
- **audio-understanding**: Speech recognition
- **embedding**: Vector embeddings
- **multimodal**: Multiple modalities

#### Classifying Models

1. Select provider
2. Find unclassified model
3. Click **Configure**
4. Select capabilities (checkboxes)
5. Click **Save Capabilities**

**Tips**:
- Assign multiple capabilities if supported
- Only enable "text" for V1 task execution
- Other capabilities for future releases

#### Viewing Classified Models

**Group by Capability**:
- Toggle **Group View**
- Models organized by capability
- See all text-capable models together

**Filter by Capability**:
- Select capability from dropdown
- Only shows models with that capability

**Unclassified Section**:
- Shows models without capabilities
- Prompts you to classify

### Enabling/Disabling Models

#### Enable Model

1. Find model in list
2. Toggle switch to **On**
3. Model appears in task selector

**Prerequisites**:
- Model must have "text" capability (V1)
- Provider must be active
- Must have admin permissions

#### Disable Model

1. Find model in list
2. Toggle switch to **Off**
3. Model removed from task selector

**What Happens**:
- Existing tasks complete normally
- New tasks cannot select this model
- Configuration preserved

### Default Model Selection

#### Setting Default

1. Filter to desired capability (e.g., "text")
2. Find preferred model
3. Click **Set as Default**
4. Select capability: "Text Generation"
5. Confirm

**Rules**:
- Only ONE default per capability
- Previous default automatically cleared
- Default must be enabled
- Default must have the capability

#### Using Defaults

- Task selector pre-selects default model
- Users can override selection
- Defaults apply per capability type

### Provider Management

#### Edit Provider

1. Select provider
2. Click **Edit**
3. Modify details (name, URL, key)
4. Click **Save**

**Note**: Changing credentials requires re-testing connection.

#### Disable Provider

1. Select provider
2. Toggle **Enabled** switch to Off
3. Confirm

**Impact**:
- No new tasks with this provider
- Existing tasks continue
- Models removed from selector
- Configuration preserved

#### Delete Provider

1. Select provider
2. Click **Delete**
3. Review impact warning
4. Type provider name to confirm
5. Click **Delete Permanently**

**Warning**: Deletion removes:
- Provider configuration
- Model catalog
- Classifications
- Credentials
- Does NOT remove: Task history, audit logs

### Provider Status

**Status Indicators**:
- 🟢 **Active**: Connection tested, models available
- 🟡 **Stale**: Catalog needs refresh
- 🟠 **Degraded**: Connection issues
- 🔴 **Failed**: Last connection test failed
- ⚪ **Disabled**: Manually disabled

---

## Package Management

### Overview

Packages are applications that extend DGOS functionality. Install, update, and manage packages from the catalog.

### Accessing Package Catalog

1. Navigate to **Apps** > **Catalog**
2. Or go to `http://localhost:3000/packages`

### Browsing Packages

#### Catalog View

**List View**:
- Package name and icon
- Short description
- Version
- Install status
- Actions (Install/Launch/Update)

**Filter Options**:
- All packages
- Installed only
- Updates available
- By category

**Search**:
- Search by name
- Search by description
- Search by author

#### Package Details

Click package for details:
- Full description
- Screenshots (if available)
- Permissions required
- Version history
- User reviews (if available)
- Developer information

### Installing Packages

#### Installation Process

1. Find package in catalog
2. Click **Install**
3. Review permissions:
   - File system access
   - Network access
   - System APIs
   - User data access
4. Click **Approve & Install**
5. Wait for installation
6. Launch when ready

#### Installation Stages

1. **Downloading**: Fetch package from registry
2. **Validating**: Check integrity and signature
3. **Staging**: Prepare for installation
4. **Health Check**: Verify application works
5. **Activating**: Make available to user
6. **Complete**: Ready to launch

#### Installation Failures

**If Health Check Fails**:
- Installation cancelled
- No changes to system
- Error details shown
- Can retry installation

**If Download Fails**:
- Retry automatically (3 times)
- Show error if all retries fail
- No changes to system

### Launching Packages

#### From Catalog

1. Find installed package
2. Click **Launch**
3. Application opens in workbench

#### From Desktop (macOS)

1. Open DGOS desktop
2. View installed apps in launcher
3. Click application icon
4. App loads in window

### Updating Packages

#### Check for Updates

**Automatic** (if enabled):
- System checks daily
- Notification when updates available

**Manual**:
1. Go to catalog
2. Click **Check Updates**
3. View available updates

#### Install Update

1. Find package with update
2. Review changelog
3. Click **Update**
4. Installation proceeds (same as new install)

**What Happens**:
- New version staged
- Health check performed
- If pass: Activate new version
- If fail: Rollback to current version

**Rollback Process**:
- Previous version restored
- Application data preserved
- User settings preserved
- Error logged

### Uninstalling Packages

#### Can I Uninstall?

**Regular Packages**: Yes, can uninstall  
**Preinstalled Packages**: May be marked as "required"

**Check Uninstall Status**:
- Package details show uninstall capability
- "Required" packages show reason

#### Uninstall Process

1. Find package
2. Click **Uninstall**
3. Choose data handling:
   - ✅ Keep user data
   - ❌ Delete all data
4. Confirm
5. Package removed

**What's Removed**:
- Application files
- Configuration (optional)
- Cache data

**What's Preserved** (if selected):
- User documents
- Settings
- Extension data
- Audit logs

---

## AI Task Workflow

### Overview

Submit text generation tasks to AI providers and view results in real-time.

### Accessing AI Workbench

1. Launch **DGOS AI Workbench** package
2. Or navigate to workbench URL

### Creating a Task

#### Task Submission

1. **Select Model**:
   - Choose from enabled models
   - Default pre-selected
   - Shows capability and provider

2. **Enter Prompt**:
   - Type your request
   - Multi-line supported
   - Markdown preview available

3. **Configure Options** (optional):
   - Temperature
   - Max tokens
   - Stop sequences

4. **Submit**:
   - Click **Generate**
   - Task ID generated
   - Streaming begins

### Viewing Results

#### Real-Time Streaming

**During Generation**:
- Incremental text appears
- Progress indicator
- Token count updates
- Cancel button available

**Streaming Events**:
- Text deltas (incremental)
- Progress updates
- Token usage
- Completion status

#### Task States

**States**:
- 🔵 **Pending**: Queued for execution
- 🟡 **Running**: Generation in progress
- 🟢 **Completed**: Success, results available
- 🔴 **Failed**: Error occurred
- ⚪ **Cancelled**: User cancelled

#### Completion

**On Success**:
- Full text displayed
- Token usage shown
- Latency metrics
- Save/copy/share options

**On Failure**:
- Error message
- Failure reason
- Retry option
- Original prompt preserved

### Task Management

#### Task History

View previous tasks:
- Task ID
- Timestamp
- Model used
- Status
- Preview

Click task to view full details.

#### Reopening Tasks

**By Task ID**:
1. Click **Open Task**
2. Enter Task ID
3. View results

**From History**:
1. Click task in history
2. Full results displayed

**Important**: Task IDs are persistent. Reopening a task shows the SAME results, never creates a duplicate.

### Task Cancellation

#### How to Cancel

**While Running**:
1. Click **Cancel** button
2. Confirm cancellation
3. Task stops immediately

**What Happens**:
- Provider call terminated (if possible)
- Partial results preserved
- Task marked as "Cancelled"
- Can view partial output
- Original prompt saved

### Disconnection & Reconnection

#### If Connection Lost

**System Behavior**:
- Task continues on server
- Task ID preserved
- Results accumulate
- Reconnect shows same task

**To Reconnect**:
1. Refresh page or reopen workbench
2. System detects open task
3. Auto-reconnects to stream
4. Shows accumulated results

**Important**: Never submit duplicate! Always use existing Task ID.

### Quota & Limits

#### Viewing Quota

Check your usage:
- Current token count
- Quota limit
- Percentage used
- Reset date

#### When Quota Exceeded

**Before Task**:
- Submit button disabled
- Shows quota exceeded message
- Contact admin to increase

**During Task**:
- Task may be terminated
- Partial results preserved
- Quota status updated

---

## Settings & Preferences

### Accessing Settings

1. Click **Settings** icon (desktop) or navigate to settings
2. Or go to `http://localhost:3000/settings`

### General Settings

#### Appearance

**Theme**:
- Light mode
- Dark mode
- Auto (system preference)

**Language**:
- English (en)
- Chinese (zh)

**Font Size**:
- Small
- Medium (default)
- Large
- Extra Large

#### Behavior

**Notifications**:
- Enable/disable notifications
- Notification sound
- Desktop notifications

**Confirmation Dialogs**:
- Always ask
- Remember choice
- Never ask (dangerous)

### Network Settings

#### Proxy Configuration

**HTTP Proxy**:
1. Enable proxy
2. Enter host and port
3. Authentication (if required)
4. Test connection

**HTTPS Proxy**:
- Same as HTTP
- Separate configuration

**No Proxy**:
- List of excluded domains
- Localhost always excluded

#### Timeout Settings

**API Timeout**:
- Default: 30 seconds
- Range: 10-300 seconds

**Task Timeout**:
- Default: 600 seconds (10 minutes)
- Range: 60-3600 seconds

### Privacy Settings

#### Data Collection

**Usage Statistics**:
- Enable/disable anonymous usage data
- Helps improve DGOS
- No personal information collected

**Crash Reports**:
- Send crash reports
- Include logs (secrets redacted)
- Optional

#### Data Retention

**Audit Logs**:
- Retention period: 90 days (default)
- Range: 30-365 days
- Auto-cleanup when exceeded

**Task History**:
- Retention period: 30 days (default)
- Range: 7-180 days

### Security Settings

#### Session Management

**Session Timeout**:
- Idle timeout: 30 minutes (default)
- Range: 5-240 minutes
- Absolute timeout: 24 hours

**Session Behavior**:
- Auto-logout on idle
- Remember session (less secure)
- Require password for sensitive actions

#### API Keys

**View Keys**:
- List all API keys
- Creation date
- Last used
- Expiry date

**Create New Key**:
1. Click **Create API Key**
2. Name the key
3. Select scope/permissions
4. Set expiry (optional)
5. Copy key (shown once!)

**Revoke Key**:
1. Select key
2. Click **Revoke**
3. Confirm
4. Key immediately invalid

### Advanced Settings

#### Database

**Connection Pool**:
- Min connections: 2
- Max connections: 10
- Idle timeout: 30s

**Note**: Requires restart to apply.

#### Redis

**Cache TTL**:
- Default: 3600s (1 hour)
- Session cache: 1800s (30 min)
- Model catalog: 7200s (2 hours)

#### Logging

**Log Level**:
- Error
- Warn
- Info (default)
- Debug
- Trace

**Log Destinations**:
- Console
- File
- Syslog (if available)

### Backup & Export

#### Export Configuration

1. Go to **Settings** > **Backup**
2. Click **Export Configuration**
3. Select what to include:
   - System settings
   - Provider configs (no credentials)
   - Package list
   - User preferences
4. Download JSON file

**Security**: Credentials are NOT exported.

#### Import Configuration

1. Click **Import Configuration**
2. Select JSON file
3. Review changes
4. Confirm import
5. Restart (if required)

---

## Troubleshooting

### Common Issues

#### Cannot Connect to API Server

**Symptoms**:
- "Connection refused" error
- UI shows "Disconnected"
- Operations fail

**Solutions**:
1. **Check API is running**:
   ```bash
   curl http://localhost:3000/health
   ```
2. **Restart API server**:
   ```bash
   pnpm --filter @dgos/api dev
   ```
3. **Check port conflicts**:
   ```bash
   lsof -i :3000
   ```
4. **Review logs**:
   Check console output for errors

#### Database Connection Failed

**Symptoms**:
- "Database error" messages
- Operations hang or timeout
- Migration failures

**Solutions**:
1. **Check PostgreSQL is running**:
   ```bash
   docker compose ps postgres
   ```
2. **Start PostgreSQL**:
   ```bash
   docker compose up -d postgres
   ```
3. **Check credentials** in `.env`:
   ```
   DATABASE_URL=postgres://...
   ```
4. **Test connection**:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

#### Redis Connection Failed

**Symptoms**:
- Session errors
- Cache warnings
- Slow performance

**Solutions**:
1. **Check Redis is running**:
   ```bash
   docker compose ps redis
   ```
2. **Start Redis**:
   ```bash
   docker compose up -d redis
   ```
3. **Test connection**:
   ```bash
   redis-cli -h localhost -p 6379 ping
   ```

#### Provider Connection Test Fails

**Symptoms**:
- "Connection failed" error
- "Authentication error"
- "Timeout"

**Solutions**:
1. **Check API key**: Verify key is correct
2. **Check base URL**: Ensure URL is correct (include `/v1`)
3. **Test manually**:
   ```bash
   curl -H "Authorization: Bearer YOUR_KEY" \
     https://api.openai.com/v1/models
   ```
4. **Check proxy settings**: Disable if using proxy
5. **Check firewall**: Ensure outbound HTTPS allowed

#### Model Not Appearing in Task Selector

**Symptoms**:
- Model exists but not selectable
- Empty model dropdown

**Checklist**:
1. ✅ Provider is enabled
2. ✅ Model catalog refreshed
3. ✅ Model classified with "text" capability
4. ✅ Model is enabled (toggle on)
5. ✅ User has task submission permission

**Steps**:
1. Go to **Settings** > **Providers**
2. Select provider
3. Click **Refresh Catalog**
4. Find model, click **Configure**
5. Select "text" capability
6. Click **Save**
7. Toggle model **On**

#### Task Stuck in "Pending"

**Symptoms**:
- Task never starts
- No streaming data
- Remains pending indefinitely

**Solutions**:
1. **Check worker is running**:
   ```bash
   pnpm --filter @dgos/worker dev
   ```
2. **Check task queue**:
   - View Redis queue depth
   - Check for blocked tasks
3. **Check provider status**:
   - Test provider connection
   - Verify API key valid
4. **Cancel and retry**:
   - Cancel stuck task
   - Submit new task

#### Desktop App Won't Launch (macOS)

**Symptoms**:
- App crashes on startup
- "Damaged app" warning
- Permission denied errors

**Solutions**:
1. **Check macOS version**: Requires 12.0+
2. **Security permissions**:
   ```bash
   xattr -cr /Applications/DGOS.app
   ```
3. **Grant permissions**:
   - System Preferences > Security & Privacy
   - Allow DGOS
4. **Rebuild app**:
   ```bash
   cd apps/desktop
   pnpm tauri build
   ```

### Performance Issues

#### Slow API Response

**Symptoms**:
- Long loading times
- Timeouts
- UI lag

**Check**:
1. **Database performance**:
   - Connection pool exhaustion
   - Long-running queries
   - Index missing
2. **Redis performance**:
   - Memory usage
   - Cache hit rate
3. **System resources**:
   - CPU usage
   - Memory usage
   - Disk I/O

**Solutions**:
1. Increase connection pool size
2. Add database indexes
3. Tune Redis memory
4. Scale vertically (more RAM/CPU)

#### High Memory Usage

**Symptoms**:
- System slow
- Out of memory errors
- Process killed

**Check**:
1. **Node.js heap**:
   ```bash
   node --max-old-space-size=4096 ...
   ```
2. **Redis memory**:
   - Check `INFO memory`
   - Set maxmemory policy
3. **Task artifacts**:
   - Large responses cached
   - Clean old artifacts

### Getting Additional Help

#### Log Files

**API Logs**:
- Console output when running dev
- Or check log files (if configured)

**Desktop Logs** (macOS):
- `~/Library/Logs/DGOS/`

**Browser Console**:
- Open DevTools (F12)
- Console tab
- Network tab for API calls

#### Diagnostic Information

When reporting issues, include:
1. **Version**: `v1.0.0`
2. **Platform**: macOS version / Docker version
3. **Steps to reproduce**
4. **Error messages** (redact secrets!)
5. **Logs** (relevant excerpts)
6. **Screenshots** (if applicable)

#### Support Channels

1. Check [Known Issues](../02-产品与版本/当前版本/V1-Known-Issues.md)
2. Review [Deployment Guide](../05-测试与发布/V1-Deployment-Guide.md)
3. Search documentation
4. Contact technical support

---

## Glossary

**Provider**: External AI service (OpenAI, etc.)  
**Model**: AI model available from provider  
**Task**: Request for AI generation  
**Package**: Installable application  
**Extension**: Plugin that adds capabilities  
**Capability**: Type of operation (text, image, etc.)  
**Artifact**: Generated output from task  
**Audit Log**: Record of system activities  
**Task ID**: Unique identifier for task  
**Quota**: Usage limit for tokens/requests

---

## Keyboard Shortcuts

### Global (Desktop)

- `Cmd+Space`: Open assistant
- `Cmd+,`: Open settings
- `Cmd+Q`: Quit application
- `Cmd+W`: Close window

### Workbench

- `Cmd+Enter`: Submit task
- `Cmd+K`: Clear input
- `Esc`: Cancel task (if running)
- `Cmd+/`: Show shortcuts

### Text Editor

- `Cmd+Z`: Undo
- `Cmd+Shift+Z`: Redo
- `Cmd+C`: Copy
- `Cmd+V`: Paste
- `Cmd+A`: Select all

---

**For additional information, see:**
- [Developer Guide](./V1-Developer-Guide.md)
- [Deployment Guide](../05-测试与发布/V1-Deployment-Guide.md)
- [API Reference](../04-技术架构/V1-API-Reference.md)
