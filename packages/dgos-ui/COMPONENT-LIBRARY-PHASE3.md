# DGOS UI Component Library - Phase 3 Components

This document describes the 7 new data display and layout components added to complete the DGOS UI component library.

## Components Overview

### 1. DataTable

A virtualized table component for displaying large datasets with sorting, filtering, and selection.

**Features:**
- Virtualized scrolling for performance with large datasets
- Column sorting (ascending/descending)
- Column filtering with text input
- Row selection (single/multiple with Shift/Cmd/Ctrl modifiers)
- Fixed header
- Responsive layout
- Monospace fonts for numeric columns
- Keyboard accessible

**Usage:**
```tsx
import { DataTable, type DataTableColumn } from '@dgos/dgos-ui';

const columns: DataTableColumn<User>[] = [
  {
    id: 'name',
    label: 'Name',
    accessor: (row) => row.name,
    sortable: true,
    filterable: true,
  },
  {
    id: 'count',
    label: 'Count',
    accessor: (row) => row.count,
    numeric: true,
    align: 'right',
  },
];

<DataTable
  columns={columns}
  data={users}
  rowKey={(row) => row.id}
  selectable
  selectionMode="multiple"
  selectedKeys={selectedKeys}
  onSelectionChange={setSelectedKeys}
  height="400px"
/>
```

### 2. Tree

A hierarchical tree component with expand/collapse and full keyboard navigation.

**Features:**
- Hierarchical data display
- Expand/collapse nodes
- Full keyboard navigation (Arrow keys, Home, End, Enter, Space)
- Icons for folders and files
- Indentation based on depth
- Selection support
- ARIA tree semantics

**Usage:**
```tsx
import { Tree, type TreeNode } from '@dgos/dgos-ui';

const data: TreeNode[] = [
  {
    id: 'root',
    label: 'Project',
    isFolder: true,
    children: [
      { id: 'file1', label: 'index.ts' },
      { id: 'file2', label: 'app.tsx' },
    ],
  },
];

<Tree
  data={data}
  selectedId={selectedId}
  onSelect={(node) => setSelectedId(node.id)}
  defaultExpandedIds={['root']}
  showIcons
/>
```

### 3. SplitPane

A resizable split panel component with drag handle and keyboard controls.

**Features:**
- Resizable split panels (horizontal/vertical)
- Drag handle with hover state
- Min/max size constraints
- Keyboard navigation (arrow keys when focused)
- Smooth resize animation
- LocalStorage persistence (optional)
- ARIA separator semantics

**Usage:**
```tsx
import { SplitPane } from '@dgos/dgos-ui';

<SplitPane
  direction="horizontal"
  initialSize="30%"
  minSize={150}
  maxSize={500}
  storageKey="my-split"
  onSizeChange={(size) => console.log(size)}
>
  <div>Left Panel</div>
  <div>Right Panel</div>
</SplitPane>
```

### 4. EnhancedTabs

An enhanced tabs component with icons, badges, and animated underline indicator.

**Features:**
- Horizontal tab navigation
- Icons + text labels
- Badge support for counts
- Active state with animated underline
- Full keyboard navigation (Arrow keys, Home, End)
- Disabled state support
- Size variants (sm, md, lg)

**Usage:**
```tsx
import { EnhancedTabs, TabPanel, type Tab } from '@dgos/dgos-ui';

const tabs: Tab[] = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'users', label: 'Users', icon: '👥', badge: 12 },
];

<EnhancedTabs
  tabs={tabs}
  activeId={activeTab}
  onChange={setActiveTab}
/>

<TabPanel tabId="overview" activeId={activeTab}>
  <p>Overview content</p>
</TabPanel>
```

### 5. EnhancedBreadcrumbs

A breadcrumb navigation component with overflow handling.

**Features:**
- Navigation path display
- Clickable segments with href or onClick
- Custom separator (default: ›)
- Overflow handling for long paths
- Expand collapsed items on demand
- Current page highlighted
- ARIA breadcrumb semantics

**Usage:**
```tsx
import { EnhancedBreadcrumbs, type BreadcrumbItem } from '@dgos/dgos-ui';

const items: BreadcrumbItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Projects', href: '/projects' },
  { label: 'DGOS' },
];

<EnhancedBreadcrumbs
  items={items}
  maxItems={4}
  separator="›"
/>
```

### 6. EmptyState

A centered empty state component for when data is not available.

**Features:**
- Centered layout with icon + message + action
- Icon support (emoji or React node)
- Primary and secondary actions
- Size variants (sm, md, lg)
- Clear, non-marketing messaging
- Status role for screen readers

**Usage:**
```tsx
import { EmptyState } from '@dgos/dgos-ui';

<EmptyState
  icon="📭"
  title="No messages"
  description="You don't have any messages yet."
  action={{
    label: 'New Message',
    onClick: createMessage,
  }}
  size="md"
/>
```

### 7. ErrorState

An error display component with request IDs and recovery actions.

**Features:**
- Error display with request_id for tracing
- Multiple severity levels (warning, error, critical)
- Retry and custom recovery actions
- Non-blocking (inline mode available)
- Dismissable
- Error code display
- ARIA alert/status roles

**Usage:**
```tsx
import { ErrorState } from '@dgos/dgos-ui';

<ErrorState
  severity="error"
  title="Failed to load data"
  description="We couldn't retrieve the requested data."
  requestId="req_abc123"
  code="FETCH_ERROR"
  onRetry={retry}
  actions={[
    {
      label: 'View Details',
      onClick: showDetails,
    },
  ]}
  onDismiss={dismiss}
/>
```

## Design Compliance

All components follow the V1 界面规范 specifications:

### Design Tokens
- Use semantic color tokens (`var(--text)`, `var(--border)`, `var(--primary)`, etc.)
- 4px spacing system (4, 8, 12, 16, 24, 32)
- Control heights: 32px (compact), 36px (standard), 44px (touch)
- Border radius: 4px (sm), 6px (md), 8px (lg)

### Animations
- Timing: 150-300ms with `cubic-bezier(0.4, 0, 0.2, 1)`
- Only animate `transform` and `opacity`
- Respect `prefers-reduced-motion`

### Accessibility (WCAG AA)
- Full keyboard navigation
- ARIA labels, roles, and states
- Focus management with visible focus indicators (2px outline)
- Screen reader support
- Minimum touch target size: 44×44px
- Color contrast ratios: 4.5:1 for normal text, 3:1 for large text

### Typography
- Font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Inter", sans-serif`
- Monospace for numbers, codes, IDs: `'SF Mono', 'Monaco', 'Menlo', monospace`
- Font sizes: 12, 13, 14, 16, 18, 22, 28px
- Line height: 1.5 for body text

## File Structure

```
packages/dgos-ui/src/
├── data-table.tsx              # DataTable component
├── tree.tsx                    # Tree component
├── split-pane.tsx              # SplitPane component
├── enhanced-tabs.tsx           # EnhancedTabs & TabPanel components
├── enhanced-breadcrumbs.tsx    # EnhancedBreadcrumbs component
├── empty-state.tsx             # EmptyState component
├── error-state.tsx             # ErrorState & InlineError components
├── data-components.css         # Styles for all new components
├── component-examples.tsx      # Comprehensive usage examples
└── index.tsx                   # Main exports (updated)
```

## Browser Support

- Modern browsers with ES2020+ support
- CSS Grid and Flexbox
- CSS custom properties (CSS variables)
- LocalStorage (with graceful degradation)

## Testing Recommendations

1. **Keyboard Navigation**: Verify all interactive elements are keyboard accessible
2. **Screen Readers**: Test with VoiceOver (macOS) or NVDA (Windows)
3. **Responsive**: Test at different viewport sizes (320px to 1920px)
4. **Theme**: Verify light and dark modes
5. **Reduced Motion**: Test with `prefers-reduced-motion: reduce`
6. **Performance**: Test DataTable with 10k+ rows
7. **Touch**: Verify touch targets are at least 44×44px

## Next Steps

To use these components in your application:

1. Import the CSS:
   ```tsx
   import '@dgos/dgos-ui/src/data-components.css';
   ```

2. Import and use components:
   ```tsx
   import { DataTable, Tree, SplitPane, /* ... */ } from '@dgos/dgos-ui';
   ```

3. Refer to `component-examples.tsx` for complete working examples

## Notes

- All components are self-contained with TypeScript types
- Props are documented with JSDoc comments
- Components follow React best practices (hooks, controlled/uncontrolled patterns)
- No external dependencies beyond React
