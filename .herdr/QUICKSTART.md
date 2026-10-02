# Model Configuration UI - Quick Start Guide

## For Developers

### Running the UI

**Prerequisites:**
- Backend API running with Provider endpoints
- Valid provider configuration in database
- Authentication/session active

**Start Development Server:**
```bash
cd apps/web
pnpm dev
```

**Navigate to Model Management:**
- URL: `/models` (once integrated into routing)
- Or import component directly: `import { ModelManagement } from './model-management';`

### Basic Usage

```typescript
import { ModelManagement } from './model-management';
import { allLabels } from './i18n';

function MyApp() {
  const t = allLabels('en'); // or 'zh'
  
  return (
    <ModelManagement 
      t={t} 
      onChanged={() => console.log('Model policies updated')} 
    />
  );
}
```

### Testing Your Changes

**Run Verification:**
```bash
node .herdr/verify-model-ui.mjs
```

**Run E2E Tests:**
```bash
node --test apps/web/e2e/model-management.spec.mjs
```

**Run Integration Tests:**
```bash
node --test tests/integration/model-capability-api.test.mjs
```

**Run All Tests:**
```bash
node --test apps/web/e2e/model-management.spec.mjs tests/integration/model-capability-api.test.mjs
```

### Component Structure

```
ModelManagement (Main Component)
├── Provider Selection Dropdown
├── Refresh Catalog Button
├── Catalog Status Display
├── Search & Filter Controls
│   ├── Search Input
│   └── Capability Filter Dropdown
├── Model List
│   └── For Each Model:
│       ├── Model Card
│       │   ├── Display Name / ID
│       │   ├── Status Badge
│       │   ├── Capability Badges
│       │   └── Default Indicator
│       ├── Enable/Disable Button
│       └── Configure Dropdown
│           └── ModelCapabilityEditor
│               ├── Capability Checkboxes
│               ├── Save Capabilities Button
│               └── Set Default Dropdown
└── Group by Capability View (Collapsible)
```

### Key Functions

**Load Data:**
```typescript
async function loadProviders()  // Fetch provider list
async function loadCatalog(providerId)  // Fetch model catalog
async function loadPolicies(providerId)  // Fetch model policies
```

**Modify Policies:**
```typescript
async function updateModelPolicy(modelId, updates)  // Update policy
async function toggleModelEnabled(modelId, enabled)  // Enable/disable
async function updateModelCapabilities(modelId, caps)  // Set capabilities
async function setDefaultModel(capability, modelId)  // Set default
```

**Refresh:**
```typescript
async function refreshCatalog()  // Explicit catalog refresh
```

### API Endpoints Reference

```typescript
// List providers
GET /api/v1/provider/configs
Response: { items: ProviderConfig[] }

// Get model catalog
GET /api/v1/provider/configs/{providerId}/models
Response: { 
  catalogVersion: string,
  status: string,
  items: ModelItem[],
  refreshedAt: string | null
}

// Refresh catalog
POST /api/v1/provider/configs/{providerId}/models
Body: { requestId: string }
Response: { status: string, catalogVersion: string }

// Get model policies
GET /api/v1/provider/configs/{providerId}/model-policies
Response: { items: ModelPolicy[] }

// Update model policy
POST /api/v1/provider/configs/{providerId}/model-policies
Body: {
  requestId: string,
  modelId: string,
  enabled: boolean,
  capabilities: string[],
  defaultForCapability?: string
}
Response: { policyVersion: string }
```

### Data Types

```typescript
interface ModelItem {
  modelId: string;
  displayName?: string;
  taskModes: string[];
  availability: 'available' | 'unavailable' | 'deprecated';
  capabilities?: string[];
  userCapabilities?: string[];
}

interface ModelPolicy {
  modelId: string;
  enabled: boolean;
  capabilities?: string[];
  defaultForCapability?: string;
}

interface ProviderCatalog {
  providerConfigId: string;
  catalogVersion: string;
  status: 'fresh' | 'stale' | 'unavailable';
  items: ModelItem[];
  refreshedAt: string | null;
}

type CapabilityType = 
  | 'text'
  | 'image-generation'
  | 'video-generation'
  | 'audio-generation'
  | 'image-understanding'
  | 'video-understanding'
  | 'audio-understanding'
  | 'embedding'
  | 'multimodal';
```

### Adding New Capability Types

1. **Update capability array:**
```typescript
const CAPABILITY_TYPES = [
  'text',
  'your-new-capability',  // Add here
  // ... rest
] as const;
```

2. **Add label:**
```typescript
const CAPABILITY_LABELS: Record<CapabilityType, string> = {
  'your-new-capability': 'Your New Capability',
  // ... rest
};
```

3. **Update i18n:**
```typescript
// In apps/web/src/i18n.ts
const en = {
  yourNewCapability: 'Your New Capability',
  // ... rest
};

const zh = {
  yourNewCapability: '你的新能力',
  // ... rest
};
```

### Customizing Filters

**Add custom filter logic:**
```typescript
const filteredModels = catalog?.items.filter(model => {
  const policy = policies.find(p => p.modelId === model.modelId);
  const modelCapabilities = policy?.capabilities || [];

  // Your custom filter logic here
  if (filter === 'my-custom-filter') {
    return yourCustomCondition(model);
  }

  // Standard filters
  if (filter === 'unclassified') return modelCapabilities.length === 0;
  return modelCapabilities.includes(filter);
});
```

### Error Handling

**Common errors and solutions:**

```typescript
// Provider not found
catch (error) {
  if (error.errorKey === 'provider_config_not_found') {
    // Provider doesn't exist or user has no access
  }
}

// Model not in catalog
catch (error) {
  if (error.errorKey === 'model_not_found') {
    // Model ID not in current catalog
    // Refresh catalog or check model ID
  }
}

// Capability mismatch
catch (error) {
  if (error.errorKey === 'capability_mismatch') {
    // Model doesn't support assigned capability
    // Show warning to user
  }
}

// Version conflict
catch (error) {
  if (error.errorKey === 'version_conflict') {
    // Policy was modified by another request
    // Reload and retry
  }
}
```

### Debugging Tips

**Enable console logging:**
```typescript
async function loadCatalog(providerId: string) {
  console.log('Loading catalog for provider:', providerId);
  const result = await api<ProviderCatalog>(`/api/v1/provider/configs/${encodeURIComponent(providerId)}/models`);
  console.log('Catalog loaded:', result);
  setCatalog(result);
}
```

**Check state:**
```typescript
useEffect(() => {
  console.log('Current state:', {
    providers,
    selectedProvider,
    catalog,
    policies,
    filter,
    searchQuery
  });
}, [providers, selectedProvider, catalog, policies, filter, searchQuery]);
```

**Verify API responses:**
```typescript
async function updateModelPolicy(modelId: string, updates: Partial<ModelPolicy>) {
  console.log('Updating policy:', { modelId, updates });
  const result = await api(...);
  console.log('Policy updated:', result);
}
```

### Common Modifications

**Change default capability:**
```typescript
// To show different capabilities for V1
const V1_ACTIVE_CAPABILITIES = ['text']; // Only text in V1

const filteredModels = catalog?.items.filter(model => {
  // Only show V1-active capabilities
  return modelCapabilities.some(cap => V1_ACTIVE_CAPABILITIES.includes(cap));
});
```

**Add bulk operations:**
```typescript
async function bulkEnableModels(modelIds: string[]) {
  for (const modelId of modelIds) {
    await updateModelPolicy(modelId, { enabled: true });
  }
  await loadPolicies(selectedProvider);
}
```

**Add capability templates:**
```typescript
const CAPABILITY_TEMPLATES = {
  'text-llm': ['text', 'embedding'],
  'vision-model': ['image-understanding', 'text'],
  'multimodal': ['text', 'image-understanding', 'multimodal']
};

function applyTemplate(modelId: string, template: string) {
  const capabilities = CAPABILITY_TEMPLATES[template];
  updateModelCapabilities(modelId, capabilities);
}
```

### Styling

**Component uses design tokens:**
```typescript
import { Button, Panel, Alert, Status } from '@dgos/dgos-ui';
```

**Custom styles in:**
```css
/* apps/web/src/style.css */
.badge { /* Capability badge styles */ }
.modal { /* Confirmation modal styles */ }
.record-list { /* Model list styles */ }
```

### Performance Optimization

**Debounce search:**
```typescript
import { useMemo } from 'react';

const debouncedSearch = useMemo(() => 
  debounce((query) => setSearchQuery(query), 300),
  []
);
```

**Memoize filtered results:**
```typescript
const filteredModels = useMemo(() => {
  return catalog?.items.filter(/* ... */) || [];
}, [catalog, policies, filter, searchQuery]);
```

### Integration Checklist

- [ ] Backend APIs deployed and accessible
- [ ] Provider configurations exist in database
- [ ] Authentication/authorization configured
- [ ] i18n labels loaded
- [ ] Navigation route added
- [ ] Component imported in main app
- [ ] Tests passing
- [ ] Verification script passing
- [ ] Manual testing complete

### Troubleshooting

**UI not loading:**
1. Check browser console for errors
2. Verify API endpoints are accessible
3. Check authentication token/session
4. Verify Provider configuration exists

**Policies not updating:**
1. Check network tab for API errors
2. Verify request payload format
3. Check policy version conflicts
4. Reload policies after update

**Filters not working:**
1. Console.log filtered results
2. Verify capability values match constants
3. Check model policy data structure
4. Verify search query logic

## Quick Reference

**File Locations:**
- Main Component: `apps/web/src/model-management.tsx`
- E2E Tests: `apps/web/e2e/model-management.spec.mjs`
- Integration Tests: `tests/integration/model-capability-api.test.mjs`
- i18n Labels: `apps/web/src/i18n.ts`
- Documentation: `.herdr/V1-MODEL-UI-IMPLEMENTATION.md`

**Commands:**
- Verify: `node .herdr/verify-model-ui.mjs`
- Test E2E: `node --test apps/web/e2e/model-management.spec.mjs`
- Test API: `node --test tests/integration/model-capability-api.test.mjs`

**Support:**
- Full docs: `.herdr/V1-MODEL-UI-IMPLEMENTATION.md`
- Summary: `.herdr/SUMMARY.txt`
- This guide: `.herdr/QUICKSTART.md`
