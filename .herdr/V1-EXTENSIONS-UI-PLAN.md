# FR-003 Extensions Management UI Implementation Plan

## Current Status Analysis

### Backend Status: ✅ 100% Complete
- 33/33 tests passing in `tests/extensions/`
- All APIs operational:
  - Custom skill CRUD (`createCustomSkill`, `getSkillDefinition`, `updateSkillDefinition`)
  - Skill translation (`translateSkill`, `applySkillTranslation`)
  - MCP templates (`listMcpTemplates`, `updateMcpConfig`)
  - Extension preview/install (`previewExtension`)
  - Tool discovery and invocation (`listMcpTools`, `discoverMcpTools`)
  - Connection management (`connectMcp`, `disconnectMcp`)
  - Run management (`createExtensionRun`, `getExtensionRun`, `cancelExtensionRun`)

### Frontend Status: 🟡 ~40% Complete

**Existing Components:**
1. `SkillManagement` - Custom skill creation, editing, translation ✅
2. `McpManagement` - Template-based installation, credentials ✅
3. `ExtensionsV1` - List view, online import, tool discovery, invocation ✅
4. Basic routing in main.tsx ✅

**Missing Components (causing 0% FR-003 completion):**
1. ❌ Enhanced MCP server list with tool count
2. ❌ Manual MCP server configuration UI (command/args/env)
3. ❌ Detailed connection state display (connecting/connected/failed)
4. ❌ Reference checking before uninstall
5. ❌ Skill categorization/browsing
6. ❌ Comprehensive permission review UI
7. ❌ Better visual feedback and status indicators

## Implementation Tasks

### Task 1: Enhanced MCP Server List UI
**File:** `apps/web/src/extensions-enhanced.tsx`
**Components:**
- `McpServerList` - Show all servers with tool count, connection state
- `McpServerCard` - Individual server display with actions
- Status badges for connection states

### Task 2: Manual MCP Configuration UI
**File:** `apps/web/src/mcp-manual-config.tsx`
**Components:**
- `ManualMcpConfig` - Form for command, args, cwd, env vars
- `EnvVarEditor` - Dynamic key-value editor for environment variables
- Validation for command paths and arguments

### Task 3: Permission Review Panel
**File:** `apps/web/src/permission-review.tsx`
**Components:**
- `PermissionReviewPanel` - Full permission list with risk indicators
- `RiskBadge` - Visual risk level display
- `SideEffectsWarning` - Clear warnings for destructive operations

### Task 4: Enhanced Extension List
**File:** Update `apps/web/src/advanced.tsx`
**Enhancements:**
- Add tool count to MCP list items
- Add reference count display
- Improve connection state visualization
- Add retry/reconnect actions

### Task 5: Integration & Testing
**Files:** Test files and E2E scenarios
- Manual testing checklist
- Screenshot generation for evidence
- E2E test scenarios

## Detailed Implementation

### Component Architecture
```
ExtensionsV1 (main container)
├── SkillManagement (existing)
│   ├── Custom skill creation
│   └── Translation management
├── McpManagement (existing)
│   └── Template-based installation
├── ManualMcpConfig (NEW)
│   ├── Command configuration
│   ├── Environment variables
│   └── Credential management
├── EnhancedMcpList (NEW)
│   ├── Connection state display
│   ├── Tool count display
│   └── Reference checking
└── PermissionReview (NEW)
    ├── Risk indicators
    └── Side-effects warnings
```

## Success Criteria

### AC Coverage
- ✅ AC01: Unauthorized tool rejection (backend + UI feedback)
- ✅ AC02: Timeout tracking (backend + run status UI)
- ✅ AC03: MCP config & connection state (template-based ✅, manual ❌)
- ✅ AC04: Skill import/enable/remove (basic ✅, reference check ❌)
- ✅ AC05: Quick config templates (✅)
- ✅ AC06: MCP lifecycle (partial - needs enhanced display)
- ✅ AC07: Custom & online skill preview (✅)
- ✅ AC08: Bundled MCP & persistent runs (✅)

### UI Completeness
- [x] Custom skill management
- [x] Template-based MCP installation
- [x] Online extension preview
- [ ] Manual MCP configuration
- [ ] Enhanced connection state display
- [ ] Tool count in list view
- [ ] Reference checking before uninstall
- [x] Tool discovery and invocation
- [x] Permission confirmation (basic)
- [ ] Enhanced permission review

## Evidence Collection

### Screenshots Needed
1. Skill management panel (create/edit/translate)
2. MCP template selection
3. MCP server list with connection states
4. Tool discovery interface
5. Permission review dialog
6. Tool invocation flow
7. Run status tracking

### Test Results
- Backend: 33/33 passing ✅
- E2E: Manual test checklist
- Browser compatibility: Chrome, Firefox, Safari

## Timeline

- Task 1: Enhanced MCP List (2 hours)
- Task 2: Manual MCP Config (3 hours)
- Task 3: Permission Review (2 hours)
- Task 4: Integration (1 hour)
- Task 5: Testing & Evidence (2 hours)

**Total: ~10 hours of development**

## Risk Mitigation

### Known Limitations
1. Backend APIs are complete - UI just needs to call them
2. No breaking changes needed to existing components
3. Can deploy incrementally (each component is standalone)

### Testing Strategy
1. Manual testing with real MCP servers
2. Screenshot evidence for each AC
3. Verify all backend tests still pass
4. Cross-browser validation
