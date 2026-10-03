# DGOS Design System - Component Documentation

**Version**: V1.0  
**Last Updated**: 2024-10-02  
**Components**: 20

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Components](#components)
   - [Button](#button)
   - [Input](#input)
   - [Select](#select)
   - [Checkbox](#checkbox)
   - [Radio](#radio)
   - [Panel](#panel)
   - [Card](#card)
   - [Alert](#alert)
   - [Badge](#badge)
   - [Status](#status)
   - [Empty](#empty)
   - [Spinner](#spinner)
   - [Toast](#toast)
   - [Dialog](#dialog)
   - [Tabs](#tabs)
   - [Breadcrumb](#breadcrumb)
   - [Menu](#menu)
3. [Design Tokens](#design-tokens)
4. [Layout Patterns](#layout-patterns)
5. [Composition Patterns](#composition-patterns)
6. [Accessibility](#accessibility)
7. [Migration Guide](#migration-guide)

---

## Getting Started

### Installation

```bash
# Install workspace dependencies
pnpm install
```

### Basic Setup

```tsx
import { Button, Input, Panel } from '@dgos/dgos-ui';
import '@dgos/dgos-ui/style.css';
import '@dgos/design-tokens/style.css';

function MyComponent() {
  return (
    <Panel>
      <h2>Welcome</h2>
      <Input label="Email" type="email" />
      <Button variant="primary">Submit</Button>
    </Panel>
  );
}
```

---

## Components

## Button

Interactive button component with multiple variants and states.

### Purpose

Triggers actions and operations. Primary interface for user interactions.

### When to Use

- Form submissions
- Action triggers (save, delete, cancel)
- Navigation between states
- Opening dialogs/modals

### When NOT to Use

- For navigation to different pages (use `<a>` tag instead)
- For toggling states (use Checkbox/Radio instead)

### API

```tsx
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger';
  busy?: boolean;
  children: ReactNode;
}
```

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `variant` | `'default' \| 'primary' \| 'danger'` | `'default'` | No | Visual style variant |
| `busy` | `boolean` | `false` | No | Shows loading state, disables interaction |
| `disabled` | `boolean` | `false` | No | Disables the button |
| `onClick` | `() => void` | - | No | Click handler |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | No | Button type |

### Variants

#### Default Button
Neutral action, secondary importance.

```tsx
<Button onClick={handleCancel}>Cancel</Button>
<Button onClick={handleClose}>Close</Button>
```

#### Primary Button
Main action, primary importance.

```tsx
<Button variant="primary" onClick={handleSave}>Save</Button>
<Button variant="primary" type="submit">Submit</Button>
```

#### Danger Button
Destructive action, requires caution.

```tsx
<Button variant="danger" onClick={handleDelete}>Delete</Button>
<Button variant="danger" onClick={handleRevoke}>Revoke Access</Button>
```

### States

```tsx
// Default state
<Button>Click Me</Button>

// Hover (automatic)
// Active (automatic)

// Disabled state
<Button disabled>Unavailable</Button>

// Loading state
<Button busy>Saving...</Button>
```

### Examples

#### Basic Usage

```tsx
function ExampleButtons() {
  return (
    <div className="row">
      <Button variant="default">Cancel</Button>
      <Button variant="primary">Save</Button>
      <Button variant="danger">Delete</Button>
    </div>
  );
}
```

#### With Loading State

```tsx
function SaveButton() {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveData();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button variant="primary" busy={saving} onClick={handleSave}>
      {saving ? 'Saving...' : 'Save Changes'}
    </Button>
  );
}
```

#### Form Submit

```tsx
function LoginForm() {
  return (
    <form onSubmit={handleSubmit}>
      <Input label="Email" type="email" required />
      <Input label="Password" type="password" required />
      <Button variant="primary" type="submit">
        Sign In
      </Button>
    </form>
  );
}
```

### Best Practices

✅ **Do:**
- Use primary variant sparingly (one per screen section)
- Provide clear, action-oriented labels ("Save Changes" not "OK")
- Show loading state during async operations
- Disable buttons when actions aren't available

❌ **Don't:**
- Use multiple primary buttons in the same area
- Use vague labels like "Submit" or "OK"
- Leave buttons enabled during processing
- Use buttons for navigation (use links instead)

### Accessibility

- **Role**: `button` (implicit)
- **Keyboard**: `Enter` and `Space` activate
- **Focus**: 2px outline with `--focus` color
- **States**: `disabled` and `aria-busy` communicated to screen readers
- **Labels**: Always provide meaningful text content

```tsx
// Good: Clear label
<Button variant="danger" onClick={deleteUser}>Delete User</Button>

// Bad: Icon only (needs aria-label)
<Button>×</Button>

// Good: Icon with label
<Button aria-label="Close dialog">×</Button>
```

---

## Input

Text input field with label and error handling.

### Purpose

Collect text, email, password, number, and other simple data from users.

### When to Use

- Forms requiring user input
- Search fields
- Settings configuration
- Any single-line text entry

### When NOT to Use

- Multi-line text (use `<textarea>` instead)
- Selecting from options (use Select, Radio, or Checkbox)
- File uploads (use `<input type="file">`)

### API

```tsx
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}
```

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `label` | `string` | - | No | Label text displayed above input |
| `error` | `string` | - | No | Error message displayed below input |
| `type` | `string` | `'text'` | No | HTML input type |
| `value` | `string` | - | No | Controlled input value |
| `onChange` | `(e) => void` | - | No | Change handler |
| `placeholder` | `string` | - | No | Placeholder text |
| `required` | `boolean` | `false` | No | Required field |
| `disabled` | `boolean` | `false` | No | Disabled state |

### Variants

#### Text Input

```tsx
<Input 
  label="Full Name" 
  type="text"
  placeholder="Enter your name"
  value={name}
  onChange={e => setName(e.target.value)}
/>
```

#### Email Input

```tsx
<Input 
  label="Email Address" 
  type="email"
  placeholder="you@example.com"
  value={email}
  onChange={e => setEmail(e.target.value)}
  required
/>
```

#### Password Input

```tsx
<Input 
  label="Password" 
  type="password"
  value={password}
  onChange={e => setPassword(e.target.value)}
  required
/>
```

#### Number Input

```tsx
<Input 
  label="Port" 
  type="number"
  min="1"
  max="65535"
  value={port}
  onChange={e => setPort(e.target.value)}
/>
```

### States

```tsx
// Default state
<Input label="Username" />

// With value
<Input label="Username" value="john_doe" />

// With error
<Input label="Email" value="invalid" error="Please enter a valid email" />

// Disabled
<Input label="System ID" value="auto-generated" disabled />

// Required
<Input label="API Key" required />
```

### Examples

#### Basic Usage

```tsx
function NameInput() {
  const [name, setName] = useState('');

  return (
    <Input 
      label="Your Name"
      value={name}
      onChange={e => setName(e.target.value)}
      placeholder="Enter your name"
    />
  );
}
```

#### With Validation

```tsx
function EmailInput() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const validate = (value: string) => {
    if (!value.includes('@')) {
      setError('Please enter a valid email address');
    } else {
      setError('');
    }
  };

  return (
    <Input 
      label="Email Address"
      type="email"
      value={email}
      onChange={e => {
        setEmail(e.target.value);
        validate(e.target.value);
      }}
      error={error}
      required
    />
  );
}
```

#### Form Integration

```tsx
function SettingsForm() {
  const [settings, setSettings] = useState({
    displayName: '',
    email: '',
    port: '8080',
  });
  const [errors, setErrors] = useState({});

  return (
    <form className="field-group">
      <Input 
        label="Display Name"
        value={settings.displayName}
        onChange={e => setSettings({...settings, displayName: e.target.value})}
        error={errors.displayName}
      />
      <Input 
        label="Email"
        type="email"
        value={settings.email}
        onChange={e => setSettings({...settings, email: e.target.value})}
        error={errors.email}
      />
      <Input 
        label="Port"
        type="number"
        value={settings.port}
        onChange={e => setSettings({...settings, port: e.target.value})}
        error={errors.port}
      />
    </form>
  );
}
```

### Best Practices

✅ **Do:**
- Always provide clear labels
- Use appropriate input types (`email`, `password`, `number`)
- Show validation errors immediately after blur or submit
- Use placeholder text for examples, not instructions
- Make required fields obvious

❌ **Don't:**
- Use placeholder as the only label
- Validate on every keystroke (too aggressive)
- Hide password fields with no way to reveal
- Use generic error messages ("Invalid input")

### Accessibility

- **Label**: Automatically associated with input via `<label>`
- **Error**: Announced via `role="alert"` and `aria-invalid`
- **Focus**: 2px outline with 2px offset
- **Required**: Use `required` attribute for form validation
- **Keyboard**: Standard text input behavior

```tsx
// Accessibility features included automatically
<Input 
  label="Email"              // Associated label
  error="Invalid format"      // aria-invalid + role="alert"
  required                    // Form validation
/>
```

---

## Select

Dropdown selection component with label and error handling.

### Purpose

Allow users to choose one option from a predefined list.

### When to Use

- Selecting from 4+ options
- Country/region selection
- Status selection
- Any single-choice from a list

### When NOT to Use

- 2-3 options (use Radio buttons instead)
- Multi-select (use Checkbox group or multi-select component)
- Free-form text entry (use Input with autocomplete)

### API

```tsx
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: ReactNode;
}
```

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `label` | `string` | - | No | Label text displayed above select |
| `error` | `string` | - | No | Error message displayed below select |
| `value` | `string` | - | No | Selected value |
| `onChange` | `(e) => void` | - | No | Change handler |
| `children` | `ReactNode` | - | Yes | `<option>` elements |
| `required` | `boolean` | `false` | No | Required field |
| `disabled` | `boolean` | `false` | No | Disabled state |

### Examples

#### Basic Usage

```tsx
function CountrySelect() {
  const [country, setCountry] = useState('');

  return (
    <Select 
      label="Country"
      value={country}
      onChange={e => setCountry(e.target.value)}
    >
      <option value="">Select a country</option>
      <option value="us">United States</option>
      <option value="cn">China</option>
      <option value="uk">United Kingdom</option>
      <option value="jp">Japan</option>
    </Select>
  );
}
```

#### With Error

```tsx
<Select 
  label="Provider"
  value={provider}
  onChange={e => setProvider(e.target.value)}
  error="Provider is required"
  required
>
  <option value="">Choose provider</option>
  <option value="anthropic">Anthropic</option>
  <option value="openai">OpenAI</option>
</Select>
```

#### With Option Groups

```tsx
<Select label="Model" value={model} onChange={e => setModel(e.target.value)}>
  <option value="">Select model</option>
  <optgroup label="Anthropic">
    <option value="claude-3-opus">Claude 3 Opus</option>
    <option value="claude-3-sonnet">Claude 3 Sonnet</option>
  </optgroup>
  <optgroup label="OpenAI">
    <option value="gpt-4">GPT-4</option>
    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
  </optgroup>
</Select>
```

### Best Practices

✅ **Do:**
- Provide a default "Select..." option
- Sort options alphabetically or by relevance
- Use clear, descriptive option labels
- Show validation errors

❌ **Don't:**
- Use for 2-3 options (use Radio instead)
- Hide the first option as a placeholder hack
- Use overly long option text
- Nest optgroups (not supported)

### Accessibility

- **Label**: Automatically associated via `<label>`
- **Error**: Announced via `role="alert"` and `aria-invalid`
- **Keyboard**: Arrow keys navigate, Enter selects
- **Required**: Use `required` attribute

---

## Checkbox

Checkbox input with label for binary choices.

### Purpose

Enable users to select multiple options or toggle a single option on/off.

### When to Use

- Agreeing to terms
- Multi-select from a list
- Enabling/disabling features
- Boolean settings

### When NOT to Use

- Mutually exclusive options (use Radio instead)
- When action takes effect immediately (use Toggle/Switch instead)

### API

```tsx
interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}
```

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `label` | `string` | - | Yes | Label text next to checkbox |
| `checked` | `boolean` | - | No | Checked state |
| `onChange` | `(e) => void` | - | No | Change handler |
| `disabled` | `boolean` | `false` | No | Disabled state |

### Examples

#### Basic Usage

```tsx
function TermsCheckbox() {
  const [agreed, setAgreed] = useState(false);

  return (
    <Checkbox 
      label="I agree to the terms and conditions"
      checked={agreed}
      onChange={e => setAgreed(e.target.checked)}
    />
  );
}
```

#### Multiple Checkboxes

```tsx
function FeatureToggles() {
  const [features, setFeatures] = useState({
    notifications: true,
    analytics: false,
    experimental: false,
  });

  return (
    <div className="field-group">
      <Checkbox 
        label="Enable notifications"
        checked={features.notifications}
        onChange={e => setFeatures({...features, notifications: e.target.checked})}
      />
      <Checkbox 
        label="Enable analytics"
        checked={features.analytics}
        onChange={e => setFeatures({...features, analytics: e.target.checked})}
      />
      <Checkbox 
        label="Enable experimental features"
        checked={features.experimental}
        onChange={e => setFeatures({...features, experimental: e.target.checked})}
      />
    </div>
  );
}
```

### Best Practices

✅ **Do:**
- Use positive language ("Enable" not "Don't disable")
- Make labels clickable (built-in)
- Group related checkboxes

❌ **Don't:**
- Use for mutually exclusive options
- Use negative language in labels
- Make checkboxes too small (18px minimum)

### Accessibility

- **Label**: Integrated in component
- **Keyboard**: Space toggles, Tab navigates
- **Size**: 18px touch target
- **Focus**: Standard outline

---

## Radio

Radio button input for mutually exclusive options.

### Purpose

Allow users to select exactly one option from a group.

### When to Use

- 2-4 mutually exclusive options
- Selection must be visible at all times
- Comparing options side-by-side

### When NOT to Use

- 5+ options (use Select instead)
- Multiple selections allowed (use Checkbox)
- Binary yes/no (use Checkbox)

### API

```tsx
interface RadioProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}
```

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `label` | `string` | - | Yes | Label text next to radio |
| `name` | `string` | - | Yes | Group name (same for all options) |
| `value` | `string` | - | Yes | Value for this option |
| `checked` | `boolean` | - | No | Checked state |
| `onChange` | `(e) => void` | - | No | Change handler |

### Examples

#### Basic Usage

```tsx
function PlanSelector() {
  const [plan, setPlan] = useState('free');

  return (
    <div className="field-group">
      <Radio 
        name="plan"
        label="Free Plan"
        value="free"
        checked={plan === 'free'}
        onChange={e => setPlan(e.target.value)}
      />
      <Radio 
        name="plan"
        label="Pro Plan"
        value="pro"
        checked={plan === 'pro'}
        onChange={e => setPlan(e.target.value)}
      />
      <Radio 
        name="plan"
        label="Enterprise Plan"
        value="enterprise"
        checked={plan === 'enterprise'}
        onChange={e => setPlan(e.target.value)}
      />
    </div>
  );
}
```

### Best Practices

✅ **Do:**
- Provide clear, distinct labels
- Set one option as default
- Use consistent `name` for the group

❌ **Don't:**
- Use for 5+ options
- Leave without a selection
- Use for on/off toggles

### Accessibility

- **Role**: `radio` (implicit)
- **Group**: Use same `name` attribute
- **Keyboard**: Arrow keys navigate within group
- **Focus**: Shared across radio group

---

## Panel

Container component for grouping related content.

### Purpose

Provide visual grouping and hierarchy for content sections.

### When to Use

- Grouping related settings
- Form sections
- Content cards with hierarchy
- Any semantic section

### API

```tsx
interface PanelProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}
```

### Examples

```tsx
<Panel>
  <h2>Account Settings</h2>
  <Input label="Email" type="email" />
  <Input label="Password" type="password" />
  <Button variant="primary">Save</Button>
</Panel>
```

---

## Card

Elevated container for discrete content units.

### Purpose

Display individual items in a collection or highlight specific content.

### When to Use

- Product cards
- Feature highlights
- List items with actions
- Dashboard widgets

### API

```tsx
interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}
```

### Examples

```tsx
<Card>
  <h3>Feature Name</h3>
  <p>Description of the feature and its benefits.</p>
  <Button>Learn More</Button>
</Card>
```

---

## Alert

Feedback component for errors, warnings, and informational messages.

### Purpose

Communicate important information, errors, or status to users.

### When to Use

- Form validation errors
- Operation results
- System messages
- Important notices

### API

```tsx
interface AlertProps {
  children: ReactNode;
  kind?: 'error' | 'info';
}
```

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `kind` | `'error' \| 'info'` | `'error'` | No | Alert severity/type |
| `children` | `ReactNode` | - | Yes | Alert content |

### Examples

```tsx
// Error alert
<Alert kind="error">Failed to save settings</Alert>

// Info alert
<Alert kind="info">New version available</Alert>

// With action
<Alert kind="error">
  Connection failed. <Button onClick={retry}>Retry</Button>
</Alert>
```

### Accessibility

- **Role**: `alert` (error) or `status` (info)
- **Announcement**: Screen readers announce immediately
- **Visibility**: High contrast colors

---

## Badge

Small label for status, counts, or categorization.

### Purpose

Display compact status information or metadata.

### When to Use

- Status indicators
- Notification counts
- Tags and categories
- Small labels

### API

```tsx
interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}
```

### Examples

```tsx
<Badge variant="success">Active</Badge>
<Badge variant="danger">Failed</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="info">Beta</Badge>
<Badge>3 new</Badge>
```

---

## Status

Auto-colored status text based on semantic meaning.

### Purpose

Display status with automatic color coding based on keywords.

### When to Use

- Task status
- Service health
- Operation results

### API

```tsx
interface StatusProps {
  value: string;
}
```

### Examples

```tsx
<Status value="ready" />       // Green
<Status value="failed" />      // Red
<Status value="pending" />     // Neutral
```

### Auto-coloring Rules

- **Green**: success, ready, enabled, active
- **Red**: failed, denied, error, unavailable
- **Neutral**: everything else

---

## Empty

Empty state component for when no content exists.

### Purpose

Communicate that a list or section has no items.

### API

```tsx
interface EmptyProps {
  children: ReactNode;
}
```

### Examples

```tsx
{items.length === 0 && <Empty>No items found</Empty>}

<Empty>
  No servers configured yet.
  <Button onClick={addServer}>Add Server</Button>
</Empty>
```

---

## Spinner

Loading indicator for asynchronous operations.

### Purpose

Show that content is loading or an operation is in progress.

### API

```tsx
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}
```

### Examples

```tsx
<Spinner size="sm" />
<Spinner size="md" label="Loading data" />
<Spinner size="lg" label="Processing" />
```

---

## Toast

Temporary notification message.

### Purpose

Provide non-blocking feedback about operations.

### API

```tsx
interface ToastProps {
  children: ReactNode;
  type?: 'success' | 'error' | 'info' | 'warning';
  onClose?: () => void;
}
```

### Examples

```tsx
<Toast type="success" onClose={() => setShow(false)}>
  Settings saved successfully
</Toast>

<Toast type="error" onClose={() => setShow(false)}>
  Failed to save changes
</Toast>
```

---

## Dialog

Modal dialog for focused user interactions.

### Purpose

Get user attention and input for critical decisions or forms.

### API

```tsx
interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}
```

### Examples

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
  <p>This action cannot be undone. Are you sure?</p>
</Dialog>
```

### Accessibility

- **Role**: `dialog` with `aria-modal="true"`
- **Focus**: Traps focus within dialog
- **Escape**: Closes dialog
- **Backdrop**: Click to close

---

## Tabs

Tab navigation for switching between views.

### Purpose

Organize related content into separate, switchable views.

### API

```tsx
interface TabsProps {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}
```

### Examples

```tsx
<Tabs
  tabs={[
    { id: 'overview', label: 'Overview' },
    { id: 'settings', label: 'Settings' },
    { id: 'logs', label: 'Logs' }
  ]}
  active={activeTab}
  onChange={setActiveTab}
/>
```

---

## Breadcrumb

Navigation trail showing page hierarchy.

### Purpose

Help users understand their location and navigate up the hierarchy.

### API

```tsx
interface BreadcrumbProps {
  items: { label: string; href?: string }[];
}
```

### Examples

```tsx
<Breadcrumb items={[
  { label: 'Home', href: '/' },
  { label: 'Settings', href: '/settings' },
  { label: 'Profile' }
]} />
```

---

## Menu

Dropdown menu for contextual actions.

### Purpose

Provide a list of actions accessible from a trigger element.

### API

```tsx
interface MenuProps {
  trigger: ReactNode;
  items: { label: string; onClick: () => void; disabled?: boolean }[];
}
```

### Examples

```tsx
<Menu
  trigger={<Button>Actions</Button>}
  items={[
    { label: 'Edit', onClick: handleEdit },
    { label: 'Duplicate', onClick: handleDuplicate },
    { label: 'Delete', onClick: handleDelete, disabled: !canDelete }
  ]}
/>
```

---

## Design Tokens

### Colors

#### Light Theme
- Canvas: `#f5f6f8`
- Surface: `#ffffff`
- Text: `#1d1f23`
- Muted: `#5f6774`
- Primary: `#1769e0`
- Success: `#16834b`
- Warning: `#a15c00`
- Danger: `#c0352b`

#### Dark Theme
- Canvas: `#17181b`
- Surface: `#222428`
- Text: `#f4f5f7`
- Muted: `#b7bec8`
- Primary: `#6ea8ff`
- Success: `#55c88a`
- Warning: `#f0b45d`
- Danger: `#ff8178`

### Spacing

- XS: 4px
- SM: 8px
- MD: 12px
- LG: 16px
- XL: 20px
- XXL: 24px
- XXXL: 32px

### Typography

#### Font Family
- Base: SF Pro Text, PingFang SC, Inter, sans-serif
- Mono: SFMono-Regular, Menlo, Monaco, monospace

#### Font Sizes
- XS: 11px
- SM: 12px
- Base: 14px
- MD: 16px
- LG: 18px
- XL: 22px
- XXL: 28px

#### Font Weights
- Normal: 400
- Medium: 500
- Semibold: 650
- Bold: 700

### Border Radius

- SM: 4px
- MD: 6px (default)
- LG: 8px
- XL: 10px

### Shadows

- SM: `0 2px 8px rgba(29, 31, 35, 0.08)`
- MD: `0 4px 16px rgba(29, 31, 35, 0.1)`
- LG: `0 8px 24px rgba(29, 31, 35, 0.12)`

### Z-Index Layers

- Dropdown: 50
- Sticky: 100
- Modal: 1000
- Toast: 2000
- Tooltip: 3000

### Breakpoints

- Mobile: < 520px
- Tablet: 520-680px
- Desktop: 680-850px
- Wide: > 1400px

---

## Layout Patterns

### Page Layout

```tsx
<Shell route={route} labels={labels}>
  <div className="stack">
    <Panel>
      <h2>Page Title</h2>
      <p>Content goes here</p>
    </Panel>
  </div>
</Shell>
```

### Two-Column Layout

```tsx
<div className="two-col">
  <Input label="First Name" />
  <Input label="Last Name" />
</div>
```

### Settings Grid

```tsx
<div className="settings-grid">
  <Select label="Theme" />
  <Select label="Language" />
  <Input label="Display Name" />
  <Input label="Email" />
</div>
```

### Form Layout

```tsx
<form className="field-group">
  <Input label="Name" />
  <Input label="Email" type="email" />
  <Select label="Country">
    <option>United States</option>
  </Select>
  <Checkbox label="Subscribe to newsletter" />
  <div className="row">
    <Button variant="primary" type="submit">Save</Button>
    <Button type="button">Cancel</Button>
  </div>
</form>
```

---

## Composition Patterns

### Form with Validation

```tsx
function ValidatedForm() {
  const [data, setData] = useState({email: '', password: ''});
  const [errors, setErrors] = useState({});
  
  const validate = () => {
    const newErrors = {};
    if (!data.email.includes('@')) newErrors.email = 'Invalid email';
    if (data.password.length < 8) newErrors.password = 'Min 8 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      // Submit
    }
  };

  return (
    <form onSubmit={handleSubmit} className="field-group">
      <Input 
        label="Email"
        type="email"
        value={data.email}
        onChange={e => setData({...data, email: e.target.value})}
        error={errors.email}
      />
      <Input 
        label="Password"
        type="password"
        value={data.password}
        onChange={e => setData({...data, password: e.target.value})}
        error={errors.password}
      />
      <Button variant="primary" type="submit">Sign In</Button>
    </form>
  );
}
```

### Data Loading Pattern

```tsx
function DataPanel() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner size="lg" label="Loading data" />;
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <Empty>No data available</Empty>;

  return <Panel>{/* Render data */}</Panel>;
}
```

### Confirmation Dialog

```tsx
function DeleteAction() {
  const [showDialog, setShowDialog] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    setBusy(true);
    await deleteItem();
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
            <Button variant="danger" onClick={handleDelete} busy={busy}>
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

## Accessibility

### Keyboard Navigation

All components support keyboard navigation:

- **Tab**: Navigate forward through interactive elements
- **Shift+Tab**: Navigate backward
- **Enter/Space**: Activate buttons and controls
- **Escape**: Close dialogs and menus
- **Arrow keys**: Navigate within Select, Radio groups, Tabs

### ARIA Attributes

Components include proper ARIA attributes automatically:

- Buttons: `role="button"`, `aria-label` when needed
- Dialogs: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Alerts: `role="alert"` (errors), `role="status"` (info)
- Tabs: `role="tablist"`, `aria-selected`, `aria-controls`
- Forms: `aria-invalid`, `aria-describedby`, `aria-required`

### Focus Management

- 2px outline with 2px offset on all focusable elements
- High contrast focus color (`--focus`)
- Focus trap in Dialog components
- Logical tab order maintained
- No keyboard traps

### Screen Reader Support

- Semantic HTML elements used throughout
- Labels properly associated with inputs
- Error messages announced via `role="alert"`
- Status updates announced via `role="status"`
- Loading states communicate via `aria-busy` or `role="status"`

### Color Contrast

All color combinations meet WCAG AA standards:
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- Interactive elements: Clear visual differentiation

---

## Migration Guide

### From Custom Components

#### Step 1: Install Packages

```bash
pnpm install @dgos/dgos-ui @dgos/design-tokens
```

#### Step 2: Import Styles

```tsx
// At the top of your main file
import '@dgos/design-tokens/style.css';
import '@dgos/dgos-ui/style.css';
```

#### Step 3: Replace Components

```tsx
// Before
<button className="btn btn-primary" onClick={handleSave}>
  Save
</button>

// After
import { Button } from '@dgos/dgos-ui';

<Button variant="primary" onClick={handleSave}>
  Save
</Button>
```

#### Step 4: Use Design Tokens

```css
/* Before */
.custom {
  background: #ffffff;
  color: #333333;
  padding: 12px;
}

/* After */
.custom {
  background: var(--surface);
  color: var(--text);
  padding: var(--spacing-md);
}
```

### Theme Setup

```tsx
// Set theme on mount
useEffect(() => {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.dataset.theme = savedTheme;
}, []);

// Toggle theme
const toggleTheme = () => {
  const newTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = newTheme;
  localStorage.setItem('theme', newTheme);
};
```

### Common Patterns

#### Replace Form Inputs

```tsx
// Before
<div className="form-field">
  <label>Email</label>
  <input type="email" />
  {error && <span className="error">{error}</span>}
</div>

// After
<Input label="Email" type="email" error={error} />
```

#### Replace Buttons

```tsx
// Before
<button className="btn-danger" onClick={handleDelete}>Delete</button>

// After
<Button variant="danger" onClick={handleDelete}>Delete</Button>
```

#### Replace Alerts

```tsx
// Before
<div className="alert alert-error">{message}</div>

// After
<Alert kind="error">{message}</Alert>
```

---

## Support & Resources

- **Source Code**: `packages/dgos-ui/src/`
- **Design Tokens**: `packages/design-tokens/src/`
- **Quick Reference**: `packages/DESIGN-SYSTEM.md`
- **Interactive Showcase**: `/design-system` route

For questions or issues, review the source code or consult the team.

---

**End of Documentation**
