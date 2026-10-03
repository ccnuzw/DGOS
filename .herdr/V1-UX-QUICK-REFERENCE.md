# DGOS V1 UX Enhancement Quick Reference

## 🎯 Quick Start

### 1. Add Providers to Your App

```typescript
import { ToastProvider, KeyboardProvider } from '@dgos/dgos-ui';

function App() {
  return (
    <KeyboardProvider>
      <ToastProvider>
        <YourApp />
      </ToastProvider>
    </KeyboardProvider>
  );
}
```

### 2. Use Toast Notifications

```typescript
import { useToast } from '@dgos/dgos-ui';

function MyComponent() {
  const toast = useToast();

  // Simple notifications
  toast.success('Operation completed');
  toast.error('Something went wrong');
  toast.info('FYI: Processing in background');
  toast.warning('Warning: This action is irreversible');

  // With action button
  toast.success('File saved', {
    action: { label: 'Open', onClick: () => openFile() }
  });

  // Custom duration
  toast.info('Quick message', { duration: 2000 });
}
```

### 3. Add Keyboard Shortcuts

```typescript
import { useShortcut } from '@dgos/dgos-ui';

function MyComponent() {
  useShortcut(
    { key: 'n', meta: true, description: 'New item' },
    () => createNew(),
    []
  );

  useShortcut(
    { key: 'r', meta: true, description: 'Refresh' },
    () => reload(),
    []
  );
}
```

### 4. Use Enhanced Forms

```typescript
import { FormInput, FormSelect, validators } from '@dgos/dgos-ui';

<FormInput
  label="Email"
  type="email"
  autoFocus
  required
  validate={validators.email()}
  hint="Enter your email address"
/>

<FormSelect
  label="Provider"
  required
  hint="Choose your provider"
>
  <option value="">Select...</option>
  <option value="openai">OpenAI</option>
</FormSelect>
```

### 5. Show Loading States

```typescript
import { SkeletonList, ProgressBar, LoadingInline } from '@dgos/dgos-ui';

// While loading initial data
{loading ? <SkeletonList rows={3} /> : <YourList data={data} />}

// For operations with known progress
<ProgressBar value={progress} max={100} label="Installing..." />

// For inline loading
<span>Processing <LoadingInline /></span>
```

---

## 📚 Component Reference

### Toast Notifications

**Types:** `success` | `error` | `info` | `warning`

```typescript
toast.success(message, options?)
toast.error(message, options?)
toast.info(message, options?)
toast.warning(message, options?)

// Options
{
  duration: 5000,           // milliseconds (0 = no auto-dismiss)
  action: {
    label: 'Action',
    onClick: () => {}
  }
}
```

### Keyboard Shortcuts

```typescript
useShortcut(config, handler, deps)

// Config
{
  key: 'k',                 // Key to press
  meta: true,              // ⌘ (Mac) or Ctrl (Win/Linux)
  ctrl: true,              // Ctrl key
  shift: true,             // Shift key
  alt: true,               // Alt/Option key
  description: 'Open',     // For help modal
  global: false            // Works even in inputs if true
}
```

**Built-in Shortcuts:**
- `⌘K` / `Ctrl+K` - Command palette
- `?` - Show keyboard help
- `ESC` - Close modals

### Form Components

#### FormInput

```typescript
<FormInput
  label="Field Label"
  hint="Helper text"
  error="Error message"
  autoFocus={true}
  required={true}
  validate={(value) => value ? null : 'Required'}
  {...standardInputProps}
/>
```

#### FormSelect

```typescript
<FormSelect
  label="Select Label"
  hint="Helper text"
  error="Error message"
  autoFocus={true}
  required={true}
  {...standardSelectProps}
>
  <option>...</option>
</FormSelect>
```

#### FormTextarea

```typescript
<FormTextarea
  label="Description"
  hint="Helper text"
  maxLength={500}
  showCount={true}
  autoFocus={true}
  {...standardTextareaProps}
/>
```

#### FormGroup

```typescript
<FormGroup legend="Section Title">
  <FormInput ... />
  <FormSelect ... />
</FormGroup>
```

### Validators

```typescript
import { validators } from '@dgos/dgos-ui';

validators.required('Custom message')
validators.minLength(8, 'Min 8 chars')
validators.maxLength(255, 'Max 255 chars')
validators.pattern(/^\d+$/, 'Numbers only')
validators.email('Invalid email')
validators.url('Invalid URL')
validators.combine(
  validators.required(),
  validators.minLength(8)
)
```

### Progress & Loading

#### ProgressBar (Determinate)

```typescript
<ProgressBar
  value={75}
  max={100}
  label="Downloading..."
  showPercentage={true}
  variant="default" | "success" | "warning" | "danger"
/>
```

#### ProgressIndeterminate

```typescript
<ProgressIndeterminate label="Connecting..." />
```

#### Skeleton Loaders

```typescript
// Predefined patterns
<SkeletonList rows={3} />
<SkeletonPanel />

// Custom skeleton
<Skeleton
  width="60%"
  height="1.2em"
  variant="text" | "circular" | "rectangular"
  count={1}
/>
```

#### Loading States

```typescript
<LoadingOverlay message="Processing..." />
<LoadingInline size="sm" | "md" | "lg" />
```

---

## 🎨 Best Practices

### ✅ DO

**Use toasts for:**
- Success confirmations
- Error notifications
- Background process updates
- Quick actions feedback

**Use inline alerts for:**
- Form-level errors
- Persistent warnings
- Critical information
- Context-specific messages

**Use loading states for:**
- Initial page loads (skeleton)
- List loading (skeleton list)
- Button actions (busy state)
- Long operations (progress bar)

**Use keyboard shortcuts for:**
- Common actions (create, refresh, save)
- Navigation (sections, pages)
- Power user features
- Accessibility

### ❌ DON'T

**Avoid:**
- Multiple toasts for same action
- Toast for every state change
- Blocking toasts (use duration)
- Toasts for form validation (use inline)
- Too many keyboard shortcuts
- Conflicting shortcuts
- Shortcuts without descriptions

---

## 🎹 Standard Keyboard Shortcuts

### Global
- `⌘K` / `Ctrl+K` - Command palette
- `?` - Keyboard help
- `ESC` - Close modal/cancel

### Forms
- `Enter` - Submit
- `Tab` - Next field
- `Shift+Tab` - Previous field

### Recommended (to implement)
- `⌘N` - New item
- `⌘S` - Save
- `⌘R` - Refresh
- `⌘1-9` - Navigate sections

---

## ♿ Accessibility Checklist

### Forms
- [ ] All inputs have labels
- [ ] Required fields marked
- [ ] Errors announced (aria-live)
- [ ] Validation on blur
- [ ] First field auto-focused

### Keyboard
- [ ] All actions keyboard accessible
- [ ] Visible focus indicators
- [ ] Logical tab order
- [ ] Escape closes modals
- [ ] No keyboard traps

### Screen Readers
- [ ] ARIA labels on buttons
- [ ] Role attributes correct
- [ ] Live regions for updates
- [ ] Landmark navigation
- [ ] Alt text on images

### Visual
- [ ] Color contrast ≥4.5:1
- [ ] Focus indicators visible
- [ ] Error states clear
- [ ] Loading states visible
- [ ] Dark mode support

---

## 🎯 Common Patterns

### Pattern: Resource Loading with Skeleton

```typescript
function ResourceList() {
  const { data, loading, error } = useResource('/api/items');

  if (loading && !data) return <SkeletonList rows={5} />;
  if (error) return <Alert>{error}</Alert>;
  
  return <List items={data} />;
}
```

### Pattern: Form with Toast Feedback

```typescript
function EditForm() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);

    try {
      await api.save(formData);
      toast.success('Saved successfully');
    } catch (error) {
      toast.error(`Failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* fields */}
      <Button type="submit" busy={busy}>Save</Button>
    </form>
  );
}
```

### Pattern: Confirmation Dialog with Toast

```typescript
function DeleteButton({ item }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);

  async function handleDelete() {
    setConfirm(false);
    try {
      await api.delete(item.id);
      toast.success('Deleted successfully');
    } catch (error) {
      toast.error('Delete failed', {
        action: { label: 'Retry', onClick: handleDelete }
      });
    }
  }

  return (
    <>
      <Button variant="danger" onClick={() => setConfirm(true)}>
        Delete
      </Button>
      {confirm && (
        <Confirm
          title="Delete Item"
          description="This action cannot be undone"
          onConfirm={handleDelete}
          onClose={() => setConfirm(false)}
        />
      )}
    </>
  );
}
```

### Pattern: Optimistic UI Update

```typescript
function ToggleSwitch({ id, enabled }) {
  const toast = useToast();
  const [state, setState] = useState(enabled);

  async function toggle() {
    const newState = !state;
    
    // Optimistic update
    setState(newState);

    try {
      await api.toggle(id, newState);
      toast.success(newState ? 'Enabled' : 'Disabled');
    } catch (error) {
      // Rollback
      setState(!newState);
      toast.error('Update failed');
    }
  }

  return (
    <button onClick={toggle}>
      {state ? 'ON' : 'OFF'}
    </button>
  );
}
```

### Pattern: Multi-Step Progress

```typescript
function Installation() {
  const [progress, setProgress] = useState(0);
  const toast = useToast();

  async function install() {
    setProgress(0);
    
    // Step 1
    await downloadPackage();
    setProgress(33);
    
    // Step 2
    await extractFiles();
    setProgress(66);
    
    // Step 3
    await configureApp();
    setProgress(100);
    
    toast.success('Installation complete');
  }

  return (
    <>
      {progress > 0 && progress < 100 && (
        <ProgressBar value={progress} label="Installing..." />
      )}
      <Button onClick={install}>Install</Button>
    </>
  );
}
```

---

## 🐛 Troubleshooting

### Toast not showing
- ✓ Wrapped app in `<ToastProvider>`?
- ✓ Calling `useToast()` inside component?
- ✓ Check z-index conflicts

### Keyboard shortcuts not working
- ✓ Wrapped app in `<KeyboardProvider>`?
- ✓ Check for conflicting shortcuts
- ✓ Focus inside input field? (use `global: true`)

### Form validation not working
- ✓ Using `FormInput` component?
- ✓ Validation function returns `null` for success?
- ✓ Validation triggered on blur

### Loading states not visible
- ✓ Check `loading` state correctly set
- ✓ Skeleton in correct position
- ✓ CSS imported properly

---

## 📦 Package Structure

```
@dgos/dgos-ui
├── Button, Panel, Alert        (existing)
├── useToast, ToastProvider     (new)
├── useKeyboard, useShortcut    (new)
├── FormInput, FormSelect       (new)
├── ProgressBar, Skeleton       (new)
├── validators                  (new)
└── LoadingOverlay, etc.        (new)
```

**Import everything from:**
```typescript
import { 
  Button, 
  useToast, 
  FormInput, 
  validators,
  SkeletonList 
} from '@dgos/dgos-ui';
```

---

## 🚀 Next Steps

1. **Integrate Providers** - Wrap your app root
2. **Replace Alerts** - Use toasts for notifications  
3. **Add Skeletons** - Show loading states
4. **Enhance Forms** - Use FormInput/FormSelect
5. **Add Shortcuts** - Implement common actions
6. **Test Accessibility** - Keyboard + screen reader

---

**Updated:** 2026-10-02  
**Version:** V1 Complete  
**Support:** See full documentation in V1-UI-UX-OPTIMIZATION.md
