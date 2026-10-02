# DGOS Design System Quick Reference

## Installation

```bash
# Design system packages are workspace dependencies
npm install
```

## Package Structure

```
@dgos/design-tokens  - Color, typography, spacing tokens
@dgos/dgos-ui        - React component library
@dgos/app-shell      - Navigation and window chrome
@dgos/host-adapter-* - Platform adapters (web, macos)
```

---

## Design Tokens

### Import Tokens

```typescript
import { colors, typography, spacing, breakpoints } from '@dgos/design-tokens';
import type { Theme, Locale } from '@dgos/design-tokens';
```

### CSS Variables

```tsx
import '@dgos/design-tokens/style.css';

// Automatically available in all CSS:
// --canvas, --surface, --raised
// --text, --muted
// --primary, --success, --warning, --danger, --info
// --border, --soft, --focus, --shadow
```

### Theme Switching

```typescript
// Switch to dark theme
document.documentElement.dataset.theme = 'dark';

// Switch to light theme
document.documentElement.dataset.theme = 'light';
```

---

## Components

### Import Components

```tsx
import { Button, Panel, Alert, Status, Empty } from '@dgos/dgos-ui';
import { Input, Select, Checkbox, Radio } from '@dgos/dgos-ui';
import { Badge, Card, Spinner, Toast, Dialog } from '@dgos/dgos-ui';
import { Tabs, Breadcrumb, Menu } from '@dgos/dgos-ui';
import '@dgos/dgos-ui/style.css';
```

### Button

```tsx
<Button variant="primary" onClick={handleSave}>Save</Button>
<Button variant="danger" onClick={handleDelete}>Delete</Button>
<Button busy>Loading...</Button>
<Button disabled>Unavailable</Button>
```

### Form Components

```tsx
<Input 
  label="Email" 
  type="email"
  value={email}
  onChange={e => setEmail(e.target.value)}
  error={errors.email}
/>

<Select label="Country" value={country} onChange={e => setCountry(e.target.value)}>
  <option value="us">United States</option>
  <option value="cn">China</option>
</Select>

<Checkbox label="I agree to terms" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
<Radio name="plan" label="Free" value="free" checked={plan === 'free'} onChange={e => setPlan(e.target.value)} />
```

### Feedback Components

```tsx
<Alert kind="error">Operation failed</Alert>
<Alert kind="info">New version available</Alert>

<Badge variant="success">Active</Badge>
<Badge variant="danger">Failed</Badge>

<Status value="ready" />  {/* Auto-colors based on text */}

<Spinner size="lg" label="Loading data" />

<Toast type="success" onClose={() => setShow(false)}>
  Settings saved successfully
</Toast>
```

### Layout Components

```tsx
<Panel>
  <h2>Settings</h2>
  <p>Configure your preferences</p>
</Panel>

<Card>
  <h3>Feature Card</h3>
  <p>Description of feature</p>
</Card>
```

### Dialog

```tsx
<Dialog 
  open={isOpen}
  onClose={() => setIsOpen(false)}
  title="Confirm Deletion"
  actions={
    <>
      <Button variant="danger" onClick={handleDelete}>Delete</Button>
      <Button onClick={() => setIsOpen(false)}>Cancel</Button>
    </>
  }
>
  <p>This action cannot be undone.</p>
</Dialog>
```

### Navigation Components

```tsx
<Tabs 
  tabs={[
    { id: 'overview', label: 'Overview' },
    { id: 'settings', label: 'Settings' }
  ]}
  active={activeTab}
  onChange={setActiveTab}
/>

<Breadcrumb items={[
  { label: 'Home', href: '/' },
  { label: 'Settings', href: '/settings' },
  { label: 'Profile' }
]} />

<Menu 
  trigger={<Button>Actions</Button>}
  items={[
    { label: 'Edit', onClick: handleEdit },
    { label: 'Delete', onClick: handleDelete, disabled: !canDelete }
  ]}
/>
```

### Empty States

```tsx
<Empty>No items found</Empty>
```

---

## App Shell

### Import Shell

```tsx
import { Shell, useRoute, navGroups } from '@dgos/app-shell';
import '@dgos/app-shell/style.css';
```

### Usage

```tsx
function App() {
  const route = useRoute();
  const labels = {
    navigation: 'Main navigation',
    command: 'Command palette',
    desktop: 'Desktop',
    catalog: 'Catalog',
    settings: 'Settings',
    // ... other route labels
  };

  return (
    <Shell 
      route={route} 
      labels={labels}
      actions={<Button variant="primary">New Item</Button>}
    >
      {/* Page content */}
      <Panel>
        <h2>Page Title</h2>
        <p>Page content goes here</p>
      </Panel>
    </Shell>
  );
}
```

### Command Palette

Press `⌘K` (Mac) or `Ctrl+K` (Windows/Linux) to open command palette for quick navigation.

---

## Host Adapters

### Web Platform

```tsx
import { webHost } from '@dgos/host-adapter-web';

// Navigate to route
webHost.open('/settings');

// Show notification
webHost.notify('Operation completed');

// Check capabilities
if (webHost.capabilities.filePicker) {
  // Use File System Access API
}
```

### macOS Platform

```tsx
import { macosHostAdapter } from '@dgos/host-adapter-macos';

// Open window
await macosHostAdapter.windows.open('settings');

// Save workspace
await macosHostAdapter.windows.saveWorkspace();

// Forget session
await macosHostAdapter.session.forgetLocalBinding();
```

---

## Responsive Design

### Breakpoints

```css
/* Mobile: < 520px */
@media (max-width: 520px) {
  /* Stacked layout, larger touch targets */
}

/* Tablet: 520px - 680px */
@media (max-width: 680px) {
  /* Reduced spacing */
}

/* Desktop: 680px - 850px */
@media (max-width: 850px) {
  /* Sidebar collapses */
}

/* Wide: > 1400px */
/* Max content width applied */
```

### Usage in TypeScript

```typescript
import { breakpoints } from '@dgos/design-tokens';

const query = `@media (max-width: ${breakpoints.tablet})`;
```

---

## Accessibility Guidelines

### Keyboard Navigation

- **Tab**: Navigate forward
- **Shift+Tab**: Navigate backward
- **Enter/Space**: Activate buttons
- **Escape**: Close dialogs/modals
- **⌘K/Ctrl+K**: Open command palette

### ARIA Attributes

All components include proper ARIA attributes:
- Buttons: `role="button"`, `aria-label`
- Dialogs: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Alerts: `role="alert"` (errors), `role="status"` (info)
- Tabs: `role="tablist"`, `aria-selected`
- Forms: `aria-invalid`, `aria-describedby`

### Focus Management

- All interactive elements are keyboard accessible
- Focus indicators (2px outline) on all focusable elements
- Focus trap in dialogs
- Focus returns to trigger after dialog close

### Testing

```bash
# Run accessibility tests
npm run test:e2e

# Manual testing with screen readers:
# - macOS: VoiceOver (Cmd+F5)
# - Windows: NVDA
# - Check: All elements announced, navigation works
```

---

## Common Patterns

### Form with Validation

```tsx
function SettingsForm() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    
    if (!email.includes('@')) {
      newErrors.email = 'Invalid email address';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Submit form
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input 
        label="Email"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        error={errors.email}
      />
      <Button type="submit" variant="primary">Save</Button>
    </form>
  );
}
```

### Loading State

```tsx
function DataPanel() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  if (loading) {
    return (
      <Panel>
        <Spinner size="lg" label="Loading data" />
      </Panel>
    );
  }

  if (!data) {
    return (
      <Panel>
        <Empty>No data available</Empty>
      </Panel>
    );
  }

  return (
    <Panel>
      {/* Render data */}
    </Panel>
  );
}
```

### Confirmation Dialog

```tsx
function DeleteButton({ onDelete }: { onDelete: () => Promise<void> }) {
  const [showDialog, setShowDialog] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    await onDelete();
    setBusy(false);
    setShowDialog(false);
  };

  return (
    <>
      <Button variant="danger" onClick={() => setShowDialog(true)}>
        Delete
      </Button>
      
      <Dialog
        open={showDialog}
        onClose={() => !busy && setShowDialog(false)}
        title="Confirm Deletion"
        actions={
          <>
            <Button variant="danger" onClick={handleConfirm} busy={busy}>
              Delete
            </Button>
            <Button onClick={() => setShowDialog(false)} disabled={busy}>
              Cancel
            </Button>
          </>
        }
      >
        <Alert kind="error">This action cannot be undone.</Alert>
        <p>Are you sure you want to delete this item?</p>
      </Dialog>
    </>
  );
}
```

---

## Styling Custom Components

### Use Design Tokens

```css
/* Good: Use CSS variables */
.custom-component {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
}

/* Bad: Hardcoded colors */
.custom-component {
  background: #ffffff;
  color: #1d1f23;
}
```

### Import Typography

```typescript
import { typography } from '@dgos/design-tokens';

const style = {
  fontFamily: typography.fontFamily.mono,
  fontSize: typography.fontSize.lg,
};
```

---

## Package Versions

- `@dgos/design-tokens@0.1.0`
- `@dgos/dgos-ui@0.1.0`
- `@dgos/app-shell@0.1.0`
- `@dgos/host-adapter-web@0.1.0`
- `@dgos/host-adapter-macos@0.1.0`

---

## Support

For issues or questions about the design system:
1. Check this quick reference
2. Review full validation report: `.herdr/V1-DESIGN-SYSTEM-VALIDATION.md`
3. Examine component source in `packages/dgos-ui/src/`

---

**Last Updated**: 2024-10-02  
**Version**: V1.0
