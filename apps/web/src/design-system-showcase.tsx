// Design System Interactive Showcase
import { useState } from 'react';
import {
  Alert, Badge, Button, Card, Checkbox, Dialog, Empty, Input, Menu,
  Panel, Radio, Select, Spinner, Status, Toast, Tabs, Breadcrumb
} from '@dgos/dgos-ui';

type ComponentKey = 'button' | 'input' | 'select' | 'checkbox' | 'radio' | 'panel' | 'card' |
  'alert' | 'badge' | 'status' | 'empty' | 'spinner' | 'toast' | 'dialog' | 'tabs' | 'breadcrumb' | 'menu';

const components: { id: ComponentKey; name: string; category: string }[] = [
  { id: 'button', name: 'Button', category: 'Actions' },
  { id: 'input', name: 'Input', category: 'Forms' },
  { id: 'select', name: 'Select', category: 'Forms' },
  { id: 'checkbox', name: 'Checkbox', category: 'Forms' },
  { id: 'radio', name: 'Radio', category: 'Forms' },
  { id: 'panel', name: 'Panel', category: 'Layout' },
  { id: 'card', name: 'Card', category: 'Layout' },
  { id: 'alert', name: 'Alert', category: 'Feedback' },
  { id: 'badge', name: 'Badge', category: 'Feedback' },
  { id: 'status', name: 'Status', category: 'Feedback' },
  { id: 'empty', name: 'Empty', category: 'Feedback' },
  { id: 'spinner', name: 'Spinner', category: 'Feedback' },
  { id: 'toast', name: 'Toast', category: 'Feedback' },
  { id: 'dialog', name: 'Dialog', category: 'Overlays' },
  { id: 'tabs', name: 'Tabs', category: 'Navigation' },
  { id: 'breadcrumb', name: 'Breadcrumb', category: 'Navigation' },
  { id: 'menu', name: 'Menu', category: 'Navigation' },
];

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: 'relative' }}>
      <pre className="code" style={{
        background: 'var(--surface)',
        padding: '12px',
        borderRadius: '6px',
        overflow: 'auto',
        border: '1px solid var(--border)'
      }}>
        <code>{code}</code>
      </pre>
      <Button
        onClick={handleCopy}
        style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '12px' }}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </Button>
    </div>
  );
}

// Button Showcase
function ButtonShowcase() {
  const [busy, setBusy] = useState(false);

  return (
    <div className="stack">
      <div>
        <h3>Variants</h3>
        <div className="row">
          <Button variant="default">Default</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="danger">Danger</Button>
        </div>
      </div>

      <div>
        <h3>States</h3>
        <div className="row">
          <Button>Normal</Button>
          <Button disabled>Disabled</Button>
          <Button busy>Loading</Button>
          <Button
            busy={busy}
            onClick={() => {
              setBusy(true);
              setTimeout(() => setBusy(false), 2000);
            }}
          >
            {busy ? 'Saving...' : 'Click to Load'}
          </Button>
        </div>
      </div>

      <div>
        <h3>Usage</h3>
        <CodeBlock code={`import { Button } from '@dgos/dgos-ui';

// Basic
<Button onClick={handleClick}>Click Me</Button>

// Primary action
<Button variant="primary" onClick={handleSave}>Save</Button>

// Destructive action
<Button variant="danger" onClick={handleDelete}>Delete</Button>

// Loading state
<Button busy={saving} onClick={handleSave}>
  {saving ? 'Saving...' : 'Save'}
</Button>`} />
      </div>

      <div>
        <h3>Props</h3>
        <table style={{ width: '100%', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Prop</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Type</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Default</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px' }}><code>variant</code></td>
              <td style={{ padding: '8px' }}>default | primary | danger</td>
              <td style={{ padding: '8px' }}>default</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px' }}><code>busy</code></td>
              <td style={{ padding: '8px' }}>boolean</td>
              <td style={{ padding: '8px' }}>false</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px' }}><code>disabled</code></td>
              <td style={{ padding: '8px' }}>boolean</td>
              <td style={{ padding: '8px' }}>false</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Input Showcase
function InputShowcase() {
  const [value, setValue] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  return (
    <div className="stack">
      <div>
        <h3>Basic Input</h3>
        <Input
          label="Your Name"
          placeholder="Enter your name"
          value={value}
          onChange={e => setValue(e.target.value)}
        />
      </div>

      <div>
        <h3>With Validation</h3>
        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={e => {
            setEmail(e.target.value);
            setError(e.target.value && !e.target.value.includes('@') ? 'Invalid email' : '');
          }}
          error={error}
          required
        />
      </div>

      <div>
        <h3>Input Types</h3>
        <div className="field-group">
          <Input label="Text" type="text" placeholder="Text input" />
          <Input label="Email" type="email" placeholder="email@example.com" />
          <Input label="Password" type="password" placeholder="Enter password" />
          <Input label="Number" type="number" placeholder="123" />
        </div>
      </div>

      <div>
        <h3>States</h3>
        <div className="field-group">
          <Input label="Normal" value="Some value" onChange={() => {}} />
          <Input label="Disabled" value="Can't edit" disabled />
          <Input label="With Error" value="invalid" error="This field has an error" />
          <Input label="Required" required />
        </div>
      </div>

      <div>
        <h3>Usage</h3>
        <CodeBlock code={`import { Input } from '@dgos/dgos-ui';

const [value, setValue] = useState('');
const [error, setError] = useState('');

<Input
  label="Email"
  type="email"
  value={value}
  onChange={e => setValue(e.target.value)}
  error={error}
  required
/>`} />
      </div>
    </div>
  );
}

// Select Showcase
function SelectShowcase() {
  const [value, setValue] = useState('');

  return (
    <div className="stack">
      <div>
        <h3>Basic Select</h3>
        <Select
          label="Country"
          value={value}
          onChange={e => setValue(e.target.value)}
        >
          <option value="">Select a country</option>
          <option value="us">United States</option>
          <option value="cn">China</option>
          <option value="uk">United Kingdom</option>
          <option value="jp">Japan</option>
        </Select>
      </div>

      <div>
        <h3>With Option Groups</h3>
        <Select label="Model">
          <option value="">Select model</option>
          <optgroup label="Anthropic">
            <option value="claude-opus">Claude 3 Opus</option>
            <option value="claude-sonnet">Claude 3 Sonnet</option>
          </optgroup>
          <optgroup label="OpenAI">
            <option value="gpt-4">GPT-4</option>
            <option value="gpt-3.5">GPT-3.5 Turbo</option>
          </optgroup>
        </Select>
      </div>

      <div>
        <h3>Usage</h3>
        <CodeBlock code={`import { Select } from '@dgos/dgos-ui';

const [country, setCountry] = useState('');

<Select
  label="Country"
  value={country}
  onChange={e => setCountry(e.target.value)}
>
  <option value="">Select</option>
  <option value="us">United States</option>
  <option value="cn">China</option>
</Select>`} />
      </div>
    </div>
  );
}

// Checkbox & Radio Showcase
function CheckboxRadioShowcase() {
  const [agreed, setAgreed] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [plan, setPlan] = useState('free');

  return (
    <div className="stack">
      <div>
        <h3>Checkboxes</h3>
        <div className="field-group">
          <Checkbox
            label="I agree to the terms and conditions"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
          />
          <Checkbox
            label="Enable notifications"
            checked={notifications}
            onChange={e => setNotifications(e.target.checked)}
          />
          <Checkbox label="Disabled checkbox" disabled />
        </div>
      </div>

      <div>
        <h3>Radio Buttons</h3>
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
      </div>

      <div>
        <h3>Usage</h3>
        <CodeBlock code={`import { Checkbox, Radio } from '@dgos/dgos-ui';

// Checkbox
const [checked, setChecked] = useState(false);
<Checkbox
  label="Enable feature"
  checked={checked}
  onChange={e => setChecked(e.target.checked)}
/>

// Radio
const [plan, setPlan] = useState('free');
<Radio
  name="plan"
  label="Free Plan"
  value="free"
  checked={plan === 'free'}
  onChange={e => setPlan(e.target.value)}
/>`} />
      </div>
    </div>
  );
}

// Layout Components Showcase
function LayoutShowcase() {
  return (
    <div className="stack">
      <div>
        <h3>Panel</h3>
        <Panel>
          <h4 style={{ margin: '0 0 8px' }}>Account Settings</h4>
          <p style={{ margin: '0 0 12px', color: 'var(--muted)' }}>
            Manage your account preferences
          </p>
          <Button variant="primary">Edit Settings</Button>
        </Panel>
      </div>

      <div>
        <h3>Card</h3>
        <div className="two-col">
          <Card>
            <h4 style={{ margin: '0 0 8px' }}>Feature One</h4>
            <p style={{ margin: '0 0 12px', color: 'var(--muted)' }}>
              Description of this feature and its benefits.
            </p>
            <Button>Learn More</Button>
          </Card>
          <Card>
            <h4 style={{ margin: '0 0 8px' }}>Feature Two</h4>
            <p style={{ margin: '0 0 12px', color: 'var(--muted)' }}>
              Another great feature to showcase.
            </p>
            <Button>Learn More</Button>
          </Card>
        </div>
      </div>

      <div>
        <h3>Usage</h3>
        <CodeBlock code={`import { Panel, Card } from '@dgos/dgos-ui';

// Panel for grouped content
<Panel>
  <h2>Settings</h2>
  <p>Configure your preferences</p>
</Panel>

// Card for discrete items
<Card>
  <h3>Feature Name</h3>
  <p>Feature description</p>
  <Button>Learn More</Button>
</Card>`} />
      </div>
    </div>
  );
}

// Feedback Components Showcase
function FeedbackShowcase() {
  const [showToast, setShowToast] = useState(false);

  return (
    <div className="stack">
      <div>
        <h3>Alert</h3>
        <div className="stack">
          <Alert kind="error">An error occurred while saving your changes.</Alert>
          <Alert kind="info">New version available. Update to get the latest features.</Alert>
        </div>
      </div>

      <div>
        <h3>Badge</h3>
        <div className="row">
          <Badge>Default</Badge>
          <Badge variant="success">Active</Badge>
          <Badge variant="warning">Pending</Badge>
          <Badge variant="danger">Failed</Badge>
          <Badge variant="info">Beta</Badge>
        </div>
      </div>

      <div>
        <h3>Status</h3>
        <div className="row">
          <Status value="ready" />
          <Status value="success" />
          <Status value="failed" />
          <Status value="pending" />
          <Status value="denied" />
        </div>
      </div>

      <div>
        <h3>Empty State</h3>
        <Empty>No items found. Try adjusting your filters.</Empty>
      </div>

      <div>
        <h3>Spinner</h3>
        <div className="row">
          <Spinner size="sm" label="Small" />
          <Spinner size="md" label="Medium" />
          <Spinner size="lg" label="Large" />
        </div>
      </div>

      <div>
        <h3>Toast</h3>
        <Button onClick={() => setShowToast(true)}>Show Toast</Button>
        {showToast && (
          <div style={{ marginTop: '12px' }}>
            <Toast type="success" onClose={() => setShowToast(false)}>
              Settings saved successfully!
            </Toast>
          </div>
        )}
      </div>

      <div>
        <h3>Usage</h3>
        <CodeBlock code={`import { Alert, Badge, Status, Empty, Spinner, Toast } from '@dgos/dgos-ui';

// Alert
<Alert kind="error">Error message</Alert>
<Alert kind="info">Info message</Alert>

// Badge
<Badge variant="success">Active</Badge>

// Status (auto-colored)
<Status value="ready" />

// Empty state
<Empty>No items found</Empty>

// Spinner
<Spinner size="md" label="Loading" />

// Toast
<Toast type="success" onClose={handleClose}>
  Operation completed
</Toast>`} />
      </div>
    </div>
  );
}

// Dialog Showcase
function DialogShowcase() {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="stack">
      <div>
        <h3>Basic Dialog</h3>
        <Button onClick={() => setOpen(true)}>Open Dialog</Button>

        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Example Dialog"
          actions={
            <>
              <Button variant="primary" onClick={() => setOpen(false)}>OK</Button>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
            </>
          }
        >
          <p>This is an example dialog with some content inside.</p>
          <Input label="Your Name" placeholder="Enter name" />
        </Dialog>
      </div>

      <div>
        <h3>Confirmation Dialog</h3>
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>Delete Item</Button>

        <Dialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title="Confirm Deletion"
          actions={
            <>
              <Button variant="danger" onClick={() => setConfirmOpen(false)}>Delete</Button>
              <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
            </>
          }
        >
          <Alert kind="error">This action cannot be undone.</Alert>
          <p>Are you sure you want to delete this item?</p>
        </Dialog>
      </div>

      <div>
        <h3>Usage</h3>
        <CodeBlock code={`import { Dialog, Button } from '@dgos/dgos-ui';

const [open, setOpen] = useState(false);

<Button onClick={() => setOpen(true)}>Open</Button>

<Dialog
  open={open}
  onClose={() => setOpen(false)}
  title="Dialog Title"
  actions={
    <>
      <Button variant="primary" onClick={handleSave}>Save</Button>
      <Button onClick={() => setOpen(false)}>Cancel</Button>
    </>
  }
>
  <p>Dialog content goes here</p>
</Dialog>`} />
      </div>
    </div>
  );
}

// Navigation Components Showcase
function NavigationShowcase() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="stack">
      <div>
        <h3>Tabs</h3>
        <Tabs
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'settings', label: 'Settings' },
            { id: 'logs', label: 'Logs' },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />
        <Panel>
          <p>Current tab: <strong>{activeTab}</strong></p>
        </Panel>
      </div>

      <div>
        <h3>Breadcrumb</h3>
        <Breadcrumb items={[
          { label: 'Home', href: '#' },
          { label: 'Settings', href: '#' },
          { label: 'Profile' }
        ]} />
      </div>

      <div>
        <h3>Menu</h3>
        <Menu
          trigger={<span>Actions ▾</span>}
          items={[
            { label: 'Edit', onClick: () => alert('Edit') },
            { label: 'Duplicate', onClick: () => alert('Duplicate') },
            { label: 'Delete', onClick: () => alert('Delete'), disabled: false },
          ]}
        />
      </div>

      <div>
        <h3>Usage</h3>
        <CodeBlock code={`import { Tabs, Breadcrumb, Menu } from '@dgos/dgos-ui';

// Tabs
const [active, setActive] = useState('overview');
<Tabs
  tabs={[
    { id: 'overview', label: 'Overview' },
    { id: 'settings', label: 'Settings' }
  ]}
  active={active}
  onChange={setActive}
/>

// Breadcrumb
<Breadcrumb items={[
  { label: 'Home', href: '/' },
  { label: 'Settings' }
]} />

// Menu
<Menu
  trigger={<Button>Actions</Button>}
  items={[
    { label: 'Edit', onClick: handleEdit },
    { label: 'Delete', onClick: handleDelete }
  ]}
/>`} />
      </div>
    </div>
  );
}

// Main Showcase Component
export function DesignSystemShowcase({ t }: { t: any }) {
  const [search, setSearch] = useState('');
  const [selectedComponent, setSelectedComponent] = useState<ComponentKey>('button');
  const [theme, setTheme] = useState<'light' | 'dark'>(
    (document.documentElement.dataset.theme as 'light' | 'dark') || 'light'
  );

  const filteredComponents = components.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.category.toLowerCase().includes(search.toLowerCase())
  );

  const categories = Array.from(new Set(components.map(c => c.category)));

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.dataset.theme = newTheme;
  };

  const renderShowcase = () => {
    switch (selectedComponent) {
      case 'button': return <ButtonShowcase />;
      case 'input': return <InputShowcase />;
      case 'select': return <SelectShowcase />;
      case 'checkbox':
      case 'radio': return <CheckboxRadioShowcase />;
      case 'panel':
      case 'card': return <LayoutShowcase />;
      case 'alert':
      case 'badge':
      case 'status':
      case 'empty':
      case 'spinner':
      case 'toast': return <FeedbackShowcase />;
      case 'dialog': return <DialogShowcase />;
      case 'tabs':
      case 'breadcrumb':
      case 'menu': return <NavigationShowcase />;
      default: return <Empty>Component showcase not implemented</Empty>;
    }
  };

  return (
    <div className="stack">
      {/* Header */}
      <Panel>
        <div className="workspace-head">
          <div>
            <h1 style={{ margin: '0 0 4px' }}>Design System Showcase</h1>
            <p className="muted" style={{ margin: 0 }}>
              Interactive component library and documentation
            </p>
          </div>
          <Button onClick={toggleTheme}>
            {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
          </Button>
        </div>
      </Panel>

      <div className="two-col">
        {/* Sidebar */}
        <div>
          <Panel>
            <Input
              label="Search Components"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            <div style={{ marginTop: '16px' }}>
              {categories.map(category => {
                const categoryComponents = filteredComponents.filter(c => c.category === category);
                if (categoryComponents.length === 0) return null;

                return (
                  <div key={category} style={{ marginBottom: '16px' }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase' }}>
                      {category}
                    </h4>
                    <div style={{ display: 'grid', gap: '4px' }}>
                      {categoryComponents.map(component => (
                        <button
                          key={component.id}
                          onClick={() => setSelectedComponent(component.id)}
                          style={{
                            padding: '8px 12px',
                            textAlign: 'left',
                            background: selectedComponent === component.id ? 'var(--soft)' : 'transparent',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: selectedComponent === component.id ? 'var(--primary)' : 'var(--text)',
                            fontWeight: selectedComponent === component.id ? 500 : 400,
                          }}
                        >
                          {component.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '13px' }}>Quick Links</h4>
              <div style={{ display: 'grid', gap: '4px', fontSize: '13px' }}>
                <a href="#" style={{ color: 'var(--primary)' }}>Component Documentation</a>
                <a href="#" style={{ color: 'var(--primary)' }}>Design Tokens</a>
                <a href="#" style={{ color: 'var(--primary)' }}>Accessibility Guide</a>
              </div>
            </div>
          </Panel>
        </div>

        {/* Main Content */}
        <div className="wide">
          <Panel>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '24px',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--border)'
            }}>
              <h2 style={{ margin: 0, flex: 1 }}>
                {components.find(c => c.id === selectedComponent)?.name}
              </h2>
              <Badge variant="info">
                {components.find(c => c.id === selectedComponent)?.category}
              </Badge>
            </div>

            {renderShowcase()}
          </Panel>
        </div>
      </div>

      {/* Footer */}
      <Panel>
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
          <p style={{ margin: 0 }}>
            DGOS Design System V1.0 • 20 Components • Full Documentation in{' '}
            <code style={{ background: 'var(--soft)', padding: '2px 6px', borderRadius: '3px' }}>
              packages/DESIGN-SYSTEM-COMPONENTS.md
            </code>
          </p>
        </div>
      </Panel>
    </div>
  );
}
