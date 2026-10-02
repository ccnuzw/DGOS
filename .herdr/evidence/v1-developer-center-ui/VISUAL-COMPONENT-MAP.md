# Developer Center UI - Visual Component Map

## UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Developer Center (Main View)                     │
├─────────────────────────────────┬───────────────────────────────────┤
│  Package Submission Panel       │    App Catalog Panel              │
│  ┌───────────────────────────┐  │  ┌─────────────────────────────┐ │
│  │ Submit signed package     │  │  │ Filter: [All ▼] [Refresh]  │ │
│  │                           │  │  └─────────────────────────────┘ │
│  │ Package envelope JSON     │  │                                   │
│  │ ┌───────────────────────┐ │  │  ┌─────────────────────────────┐ │
│  │ │ {                     │ │  │  │ ● dgos.ai-workbench         │ │
│  │ │   "manifest": {...},  │ │  │  │   1.0.1 · build 2 · stable  │ │
│  │ │   "files": {...},     │ │  │  │   Status: [approved]        │ │
│  │ │   ...                 │ │  │  │   [Details] [Installation]  │ │
│  │ │ }                     │ │  │  │   [Approve] [Reject]        │ │
│  │ └───────────────────────┘ │  │  │   [Withdraw] [Test install] │ │
│  │                           │  │  └─────────────────────────────┘ │
│  │ [Preview] [Apply]         │  │                                   │
│  │                           │  │  ┌─────────────────────────────┐ │
│  │ ┌───────────────────────┐ │  │  │ ● com.example.app           │ │
│  │ │ Preview Summary       │ │  │  │   2.0.0 · build 5 · stable  │ │
│  │ │ App ID: example       │ │  │  │   Status: [pending_review]  │ │
│  │ │ Version: 1.0.0 · b1   │ │  │  │   [...actions...]          │ │
│  │ │ Channel: stable       │ │  │  └─────────────────────────────┘ │
│  │ │ Trust: standard       │ │  │                                   │
│  │ │ Permissions: ...      │ │  │  (More apps...)                   │
│  │ └───────────────────────┘ │  │                                   │
│  └───────────────────────────┘  └───────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────┘
```

## Modal Views

### App Detail View (Modal)
```
┌─────────────────────────────────────────────────────┐
│ Details - dgos.ai-workbench            [Close]      │
├─────────────────────────────────────────────────────┤
│ App ID:              dgos.ai-workbench              │
│ Version:             1.0.1 · Build 2                │
│ Channel:             stable                         │
│ Status:              ● approved                     │
│ Source:              official                       │
│ Requested trust:     standard                       │
│ Data Version:        1                              │
│ Uninstall Policy:    user-removable                 │
│ Background Policy:   release                        │
│ Permissions:         dgos.model.list,               │
│                      dgos.aiTask.submit             │
│ Capabilities:        dgos.model.list,               │
│                      dgos.aiTask.submit             │
│ Description:         AI Workbench application       │
├─────────────────────────────────────────────────────┤
│ [Approve] [Reject] [Withdraw] [Test install]        │
└─────────────────────────────────────────────────────┘
```

### Installation Records View (Modal)
```
┌─────────────────────────────────────────────────────┐
│ Installation: dgos.ai-workbench        [Close]      │
├─────────────────────────────────────────────────────┤
│ Status:              ● installed                    │
│ Version:             1.0.1 · Build 2                │
│ Channel:             stable                         │
│ Installed At:        2024-01-09 10:30:00            │
│ Health Check:        ● passed                       │
│ Rollback Version:    -                              │
└─────────────────────────────────────────────────────┘
```

### Review Action Modal
```
┌─────────────────────────────────────────────────────┐
│ approve dgos.ai-workbench                           │
├─────────────────────────────────────────────────────┤
│ 1.0.1 · Build 2 · stable                            │
│                                                     │
│ Review reason:                                      │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Meets all security requirements                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [Confirm]  [Cancel]                                 │
└─────────────────────────────────────────────────────┘
```

## User Flows

### Flow 1: Submit New Package
```
Developer
    │
    ├─> Paste signed package envelope JSON
    │
    ├─> Click [Preview]
    │
    ├─> Review summary (validation)
    │
    ├─> Click [Apply]
    │
    ├─> Confirm submission
    │
    └─> Package appears in catalog with "pending_review" status
```

### Flow 2: Admin Approval
```
Administrator
    │
    ├─> Filter catalog to "Pending Review"
    │
    ├─> Click [Details] on pending app
    │
    ├─> Review all metadata
    │
    ├─> Click [Approve] (or Reject)
    │
    ├─> Enter review reason
    │
    ├─> Click [Confirm]
    │
    └─> App status changes to "approved" (or "rejected")
```

### Flow 3: Check Installation Status
```
Developer/Admin
    │
    ├─> Find app in catalog
    │
    ├─> Click [Installation] button
    │
    ├─> View deployment modal
    │
    └─> See: status, version, health check, rollback info
```

### Flow 4: Test Installation (Developer)
```
Developer
    │
    ├─> Find own app in catalog
    │
    ├─> Click [Test install]
    │
    ├─> Enter test environment details
    │
    ├─> Confirm test installation
    │
    └─> App installs in isolated test environment
```

## Filter States

| Filter Option      | Shows                                    |
|--------------------|------------------------------------------|
| All                | All apps (approved, pending, rejected)   |
| Pending Review     | Only apps with catalogState = "pending_review" |
| Approved           | Only apps with catalogState = "approved" |
| Rejected           | Only apps with catalogState = "rejected" |

## Status Indicators

Visual status badges appear throughout the UI:

- ● **approved** - Green - Ready for installation
- ● **pending_review** - Yellow - Awaiting admin approval
- ● **rejected** - Red - Not approved for catalog
- ● **installed** - Blue - Currently deployed
- ● **health_check_passed** - Green - App is healthy
- ● **rollback_required** - Red - Installation failed

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ESC | Close any open modal |
| Tab | Navigate between form fields |
| Enter | Submit focused form |

## Accessibility Features

- ✅ Proper ARIA labels on all modals (`role="dialog"`, `aria-modal="true"`)
- ✅ Semantic HTML (proper heading hierarchy)
- ✅ Keyboard navigation support
- ✅ Focus management (trap focus in modals)
- ✅ Clear error messages
- ✅ Loading states with `role="status"`

## Component Interactions

```
[Package Submission]
        │
        ├─> Validates → Shows errors OR shows preview
        │
        └─> Submit → Calls POST /api/v1/apps
                         │
                         └─> Reloads catalog

[App Catalog List]
        │
        ├─> Filter → Filters items locally
        │
        ├─> [Details] → Opens AppDetailView modal
        │
        ├─> [Installation] → Opens InstallationRecordsView modal
        │                         │
        │                         └─> Calls GET /api/v1/apps/:id/deployment
        │
        └─> [Review Actions] → Opens review modal
                                    │
                                    └─> Calls POST /api/v1/apps/:id/{action}
                                            │
                                            └─> Reloads catalog

[AppDetailView Modal]
        │
        ├─> Shows complete metadata
        │
        ├─> [Review Actions] → Opens review modal
        │
        └─> [Close] → Dismisses modal

[InstallationRecordsView Modal]
        │
        ├─> Fetches deployment status
        │
        ├─> Shows health check status
        │
        └─> [Close] → Dismisses modal
```

## State Management

Each component maintains:

```typescript
// Main DeveloperCenter state
const [envelope, setEnvelope] = useState<string>("");
const [summary, setSummary] = useState<Dict | null>(null);
const [confirm, setConfirm] = useState<boolean>(false);
const [review, setReview] = useState<{app: Dict; action: string} | null>(null);
const [reason, setReason] = useState<string>("");
const [selectedApp, setSelectedApp] = useState<Dict | null>(null);
const [installationView, setInstallationView] = useState<string | null>(null);
const [filter, setFilter] = useState<string>("all");

// Shared hooks
const catalog = useResource("/api/v1/apps");  // Auto-fetching
const op = useAction();  // For mutations with loading/error states
```

## Error Handling

All operations show user-friendly errors:

1. **Invalid JSON** - "JSON parse error: ..."
2. **Invalid Envelope** - "Envelope needs manifest, files, resourceDigests, keyId, signature"
3. **API Errors** - Extracted from response.errorKey with fallback messages
4. **Network Failures** - "Service unavailable"
5. **Validation Failures** - Specific field-level errors

## Loading States

- Textarea: No spinner (instant)
- Preview: Validates synchronously
- Submit: [Apply] button shows `busy` state
- Catalog Load: "Loading..." message with role="status"
- Actions: Individual buttons show `busy` state
- Refresh: [Refresh] button shows `busy` state

---

This visual map provides a complete picture of the Developer Center UI implementation for FR-002.
