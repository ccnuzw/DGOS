# macOS UI Components - Developer Guide

**Version**: 1.0  
**Package**: `@dgos/app-shell`  
**Last Updated**: 2026-10-02

## Overview

This guide documents all macOS-style UI components for DGOS V1. Each component is designed to work together as part of a unified desktop environment while remaining independently usable.

---

## MacOSShell

**File**: `packages/app-shell/src/macos/index.tsx`  
**Purpose**: Main desktop environment integrating all macOS components

### Props

```typescript
interface MacOSShellProps {
  currentRoute: RouteKey;          // Active route/app
  labels: Record<string, string>;  // Localized labels
  children: ReactNode;             // Main content area
  onNavigate: (route: RouteKey) => void;  // Navigation handler
  theme?: 'light' | 'dark';        // Theme (default: 'light')
  onThemeToggle?: () => void;      // Theme toggle handler
}
```

### Usage Example

```tsx
import { MacOSShell } from '@dgos/app-shell';
import { useRoute } from '@dgos/app-shell';
import '@dgos/app-shell/macos/macos.css';

function App() {
  const route = useRoute();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  return (
    <MacOSShell
      currentRoute={route}
      labels={{
        catalog: 'App Catalog',
        assistant: 'AI Assistant',
        tasks: 'Tasks',
        settings: 'Settings',
        providers: 'Providers',
        models: 'Models',
        navigation: 'Main Navigation',
      }}
      onNavigate={(newRoute) => {
        window.history.pushState({}, '', routes[newRoute]);
        // Trigger route change
      }}
      theme={theme}
      onThemeToggle={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
    >
      <YourAppContent />
    </MacOSShell>
  );
}
```

### Features
- Automatic system bar, dock, and workspace layout
- Built-in launchpad (⌘K or F4)
- Running app tracking
- Theme management
- Keyboard shortcuts

---

## MacOSSystemBar

**File**: `packages/app-shell/src/macos/system-bar.tsx`  
**Purpose**: Top system bar with logo, app name, and controls

### Props

```typescript
interface SystemBarProps {
  currentApp?: string;                    // Currently active app name
  onMenuClick?: () => void;               // Logo/menu click handler
  onSearchClick?: () => void;             // Search icon click
  onNotificationsClick?: () => void;      // Notifications icon click
  onSettingsClick?: () => void;           // Settings icon click
  theme?: 'light' | 'dark';               // Theme
  onThemeToggle?: () => void;             // Theme toggle
}
```

### Usage Example

```tsx
import { MacOSSystemBar } from '@dgos/app-shell';

<MacOSSystemBar
  currentApp="AI Assistant"
  onMenuClick={() => console.log('Menu clicked')}
  onSearchClick={() => setSearchOpen(true)}
  onNotificationsClick={() => setNotificationsOpen(true)}
  onSettingsClick={() => navigate('/settings')}
  theme="dark"
/>
```

### Features
- Live-updating clock (HH:MM format)
- DGOS logo and branding
- Icon buttons with hover states
- Glassmorphism background
- Full keyboard accessibility

### Styling
- Height: 44px (fixed)
- Z-index: 1000
- Backdrop blur with 80% opacity
- Draggable region for desktop window (via -webkit-app-region)

---

## MacOSDock

**File**: `packages/app-shell/src/macos/dock.tsx`  
**Purpose**: Bottom-centered app launcher with magnification

### Props

```typescript
interface DockApp {
  id: string;                  // Unique app identifier
  name: string;                // Display name
  icon: React.ReactNode;       // Icon component
  route?: RouteKey;            // Associated route
  isRunning?: boolean;         // Show running indicator
  badge?: number;              // Notification badge count
  onClick?: () => void;        // Custom click handler
}

interface MacOSDockProps {
  apps: DockApp[];                                    // App list
  onAppClick?: (appId: string) => void;               // Click handler
  onAppRightClick?: (appId: string, event) => void;   // Context menu
}
```

### Usage Example

```tsx
import { MacOSDock } from '@dgos/app-shell';
import { Settings, MessageSquare } from 'lucide-react';

const dockApps = [
  {
    id: 'settings',
    name: 'Settings',
    icon: <Settings size={32} />,
    isRunning: true,
    onClick: () => navigate('/settings'),
  },
  {
    id: 'chat',
    name: 'Chat',
    icon: <MessageSquare size={32} />,
    isRunning: false,
    badge: 5,
    onClick: () => navigate('/chat'),
  },
  // System section - add these last, divider auto-inserted
  {
    id: 'downloads',
    name: 'Downloads',
    icon: <FolderDown size={32} />,
  },
  {
    id: 'trash',
    name: 'Trash',
    icon: <Trash2 size={32} />,
  },
];

<MacOSDock
  apps={dockApps}
  onAppClick={(id) => console.log('App clicked:', id)}
  onAppRightClick={(id, e) => showContextMenu(id, e)}
/>
```

### Features
- Hover magnification (1.2x scale, -8px lift)
- Running indicators (blue dot below icon)
- Notification badges (red circle with count)
- Auto-inserted divider before 'downloads' or 'trash'
- Full keyboard navigation
- Right-click support

### Styling
- Height: 68px container
- Icon size: 48px (base), 58px (hover)
- Border radius: 24px
- Bottom offset: 8px
- Glassmorphism with 75% opacity

---

## MacOSWindow

**File**: `packages/app-shell/src/macos/window.tsx`  
**Purpose**: Draggable, resizable window with traffic lights

### Props

```typescript
interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

type WindowState = 'normal' | 'minimized' | 'maximized' | 'fullscreen';

interface MacOSWindowProps {
  id: string;                                  // Unique window ID
  title: string;                               // Title bar text
  children: ReactNode;                         // Window content
  onClose?: () => void;                        // Close button handler
  onMinimize?: () => void;                     // Minimize button handler
  onMaximize?: () => void;                     // Maximize/restore handler
  onFocus?: () => void;                        // Focus event
  onBoundsChange?: (bounds: WindowBounds) => void;  // Position/size change
  bounds?: WindowBounds;                       // Initial position/size
  state?: WindowState;                         // Window state
  focused?: boolean;                           // Is focused
  zIndex?: number;                             // Stacking order
  minWidth?: number;                           // Min width (default: 400)
  minHeight?: number;                          // Min height (default: 300)
}
```

### Usage Example

```tsx
import { MacOSWindow } from '@dgos/app-shell';

<MacOSWindow
  id="settings-window"
  title="Settings"
  bounds={{ x: 100, y: 100, width: 800, height: 600 }}
  state="normal"
  focused={true}
  zIndex={20}
  onClose={() => closeWindow('settings-window')}
  onMinimize={() => minimizeWindow('settings-window')}
  onMaximize={() => toggleMaximize('settings-window')}
  onFocus={() => focusWindow('settings-window')}
  onBoundsChange={(bounds) => saveBounds('settings-window', bounds)}
>
  <SettingsContent />
</MacOSWindow>
```

### Features
- **Traffic Lights**: Red (close), Yellow (minimize), Green (maximize)
- **Draggable**: Click and drag title bar to move
- **Resizable**: Drag edges (8px) or corners (12px)
- **Double-click title bar**: Toggle maximize
- **States**: Normal, maximized, minimized, focused, unfocused
- **Animations**: Open, close, minimize effects
- **Constraints**: Respect min/max dimensions

### Styling
- Title bar: 32px height
- Border radius: 12px
- Shadow: 0 20px 60px (varies by focus)
- Traffic lights: 12px circles, 8px apart, 12px from left edge

### Keyboard Support
- Traffic lights focusable via Tab
- Enter/Space to activate
- All buttons have aria-labels

---

## MacOSLaunchpad

**File**: `packages/app-shell/src/macos/launchpad.tsx`  
**Purpose**: Full-screen app grid overlay

### Props

```typescript
interface LaunchpadApp {
  id: string;                  // App identifier
  name: string;                // Display name
  icon: React.ReactNode;       // Icon component
  onClick?: () => void;        // Click handler
}

interface MacOSLaunchpadProps {
  visible: boolean;                              // Show/hide
  apps: LaunchpadApp[];                          // App list
  onAppClick?: (appId: string) => void;          // App click handler
  onClose: () => void;                           // Close handler
}
```

### Usage Example

```tsx
import { MacOSLaunchpad } from '@dgos/app-shell';

const [launchpadOpen, setLaunchpadOpen] = useState(false);

const apps = [
  { id: 'settings', name: 'Settings', icon: <Settings size={40} /> },
  { id: 'chat', name: 'Chat', icon: <MessageSquare size={40} /> },
  // ... more apps
];

<MacOSLaunchpad
  visible={launchpadOpen}
  apps={apps}
  onAppClick={(id) => {
    navigate(`/${id}`);
    setLaunchpadOpen(false);
  }}
  onClose={() => setLaunchpadOpen(false)}
/>
```

### Features
- Grid layout: 7 columns (responsive)
- Staggered entrance animations (20ms between icons)
- Keyboard navigation: Arrows, Home, End, Enter, Space
- Close on: ESC key, F4 key, click outside
- Auto-focus first item on open
- Backdrop blur effect

### Styling
- Full viewport overlay
- Icon size: 64px
- Icon spacing: 32px horizontal, 40px vertical
- Background: rgba(0, 0, 0, 0.3) with blur(40px)
- Label: 12px, white, max 2 lines

---

## WindowManager

**File**: `packages/app-shell/src/macos/window-manager.tsx`  
**Purpose**: Multi-window orchestration and state management

### Component Props

```typescript
interface WindowInstance {
  id: string;
  route: RouteKey;
  title: string;
  content: ReactNode;
  bounds: WindowBounds;
  state: WindowState;
  zIndex: number;
  minWidth?: number;
  minHeight?: number;
}

interface WindowManagerProps {
  windows: WindowInstance[];
  focusedWindowId: string | null;
  onWindowsChange: (windows: WindowInstance[]) => void;
  onFocusChange: (windowId: string | null) => void;
}
```

### Hook API

```typescript
const {
  windows,              // Array of WindowInstance
  focusedWindowId,      // Currently focused window ID
  openWindow,           // (route, title, content, options?) => windowId
  closeWindow,          // (windowId) => void
  minimizeWindow,       // (windowId) => void
  restoreWindow,        // (windowId) => void
  setWindows,           // Direct state setter
  setFocusedWindowId,   // Direct focus setter
} = useWindowManager();
```

### Usage Example

```tsx
import { WindowManager, useWindowManager } from '@dgos/app-shell';

function App() {
  const {
    windows,
    focusedWindowId,
    openWindow,
    closeWindow,
    setWindows,
    setFocusedWindowId,
  } = useWindowManager();

  const handleOpenSettings = () => {
    openWindow(
      'settings',
      'Settings',
      <SettingsPage />,
      {
        bounds: { x: 200, y: 150, width: 900, height: 700 },
        minWidth: 600,
        minHeight: 400,
      }
    );
  };

  return (
    <div>
      <button onClick={handleOpenSettings}>Open Settings</button>
      
      <WindowManager
        windows={windows}
        focusedWindowId={focusedWindowId}
        onWindowsChange={setWindows}
        onFocusChange={setFocusedWindowId}
      />
    </div>
  );
}
```

### Features
- Automatic z-index management
- Focus tracking and propagation
- Window lifecycle management
- Bounds persistence
- Minimized window filtering (hidden from view)
- Next-window focus on close
- State synchronization

### Window Operations
- **openWindow**: Creates new window with unique ID, stacks on top
- **closeWindow**: Removes window, focuses next highest
- **minimizeWindow**: Sets state to 'minimized', focuses next
- **restoreWindow**: Returns to 'normal' state, brings to front

---

## Design Tokens

**File**: `packages/design-tokens/src/macos-tokens.ts`  
**Purpose**: Centralized design values for all macOS components

### Import

```typescript
import { macOSTokens } from '@dgos/design-tokens';

// Access tokens
const dockHeight = macOSTokens.dock.height;          // '68px'
const windowRadius = macOSTokens.window.borderRadius; // '12px'
const springEasing = macOSTokens.animations.spring;   // 'cubic-bezier(...)'
```

### Token Categories

#### Window Tokens
```typescript
macOSTokens.window = {
  titleBarHeight: '32px',
  borderRadius: '12px',
  minWidth: '400px',
  minHeight: '300px',
  shadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
  // ... more
}
```

#### Traffic Lights
```typescript
macOSTokens.trafficLights = {
  size: '12px',
  spacing: '8px',
  colors: {
    close: '#FF5F56',
    minimize: '#FFBD2E',
    maximize: '#27C93F',
  },
  // ... more
}
```

#### Dock Tokens
```typescript
macOSTokens.dock = {
  height: '68px',
  iconSize: '48px',
  hoverScale: '1.21',
  hoverLift: '-8px',
  // ... more
}
```

#### Animation Tokens
```typescript
macOSTokens.animations = {
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  windowOpen: '300ms cubic-bezier(...)',
  dockHover: '300ms cubic-bezier(...)',
  // ... more
}
```

#### Glassmorphism
```typescript
macOSTokens.glass = {
  light: {
    background: 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  dark: { /* ... */ },
}
```

---

## CSS Classes Reference

**File**: `packages/app-shell/src/macos/macos.css`

### System Bar
- `.macos-system-bar` - Main container
- `.macos-system-bar__left/center/right` - Layout sections
- `.macos-system-bar__logo` - DGOS logo button
- `.macos-system-bar__icon-button` - Icon buttons
- `.macos-system-bar__time` - Clock display

### Dock
- `.macos-dock` - Main container
- `.macos-dock__item` - Individual app
- `.macos-dock__item--running` - Running app modifier
- `.macos-dock__icon` - Icon container
- `.macos-dock__indicator` - Running dot
- `.macos-dock__badge` - Notification badge
- `.macos-dock__divider` - Separator

### Window
- `.macos-window` - Window container
- `.macos-window--focused/unfocused` - Focus states
- `.macos-window--maximized` - Fullscreen state
- `.macos-window__title-bar` - Draggable header
- `.macos-window__traffic-lights` - Button group
- `.macos-window__traffic-light--close/minimize/maximize` - Individual buttons
- `.macos-window__title` - Title text
- `.macos-window__content` - Content area

### Launchpad
- `.macos-launchpad` - Overlay container
- `.macos-launchpad--closing` - Closing animation
- `.macos-launchpad__grid` - App grid
- `.macos-launchpad__item` - Individual app
- `.macos-launchpad__icon` - Icon container
- `.macos-launchpad__label` - App name

### Desktop
- `.macos-desktop` - Root container
- `.macos-desktop__workspace` - Main area

---

## Accessibility Guidelines

### Keyboard Navigation
- **Tab**: Move forward through interactive elements
- **Shift+Tab**: Move backward
- **Arrow keys**: Navigate grids (Launchpad)
- **Enter/Space**: Activate buttons
- **Escape**: Close overlays
- **⌘K**: Toggle launchpad
- **F4**: Toggle launchpad

### Screen Reader Support
All components include:
- `aria-label` on icon-only buttons
- `role` attributes (dialog, toolbar, button)
- `aria-modal` for overlays
- `aria-current` for active items
- `aria-live` for dynamic content (where appropriate)

### Focus Management
- Visible focus rings (3px, brand color)
- Focus trap in modals
- Focus restoration after close
- Logical tab order

### Reduced Motion
Respects `prefers-reduced-motion: reduce`:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Theming

### Theme Application
Set `data-theme` on root or shell:
```tsx
<div data-theme="dark">
  <MacOSShell theme="dark" {...props} />
</div>
```

### CSS Variables Required
Ensure these variables are defined:
```css
:root {
  --surface: #ffffff;
  --canvas: #f8fafc;
  --text: #0f172a;
  --muted: #64748b;
  --border: #e2e8f0;
  --primary: #0F5FD9;
  --soft: #f1f5f9;
}

[data-theme="dark"] {
  --surface: #1e293b;
  --canvas: #0f172a;
  --text: #f1f5f9;
  --muted: #94a3b8;
  --border: #334155;
  --primary: #5B9EFF;
  --soft: #1e293b;
}
```

---

## Performance Tips

### Optimization Techniques
1. **Use CSS transforms** for animations (GPU accelerated)
2. **Add `will-change`** to animating elements (sparingly)
3. **Memoize** expensive window calculations
4. **Debounce** resize handlers
5. **Virtual scrolling** for long app lists (future)

### Example: Optimized Window
```tsx
const MemoizedWindow = React.memo(MacOSWindow, (prev, next) => {
  return prev.focused === next.focused &&
         prev.state === next.state &&
         prev.zIndex === next.zIndex &&
         prev.bounds.x === next.bounds.x &&
         prev.bounds.y === next.bounds.y;
});
```

---

## Troubleshooting

### Dock not appearing
- Check that CSS is imported: `import '@dgos/app-shell/macos/macos.css'`
- Verify z-index not being overridden
- Check viewport height (needs space below content)

### Windows not draggable
- Ensure title bar has correct class: `.macos-window__title-bar`
- Check for pointer-events interference
- Verify event handlers are attached

### Animations not working
- Import CSS file
- Check `prefers-reduced-motion` setting
- Verify browser supports backdrop-filter

### Icons not showing
- Install lucide-react: `npm install lucide-react`
- Or provide custom ReactNode icons

---

## Examples

See `.herdr/V1-MACOS-UI-COMPLETE.md` for complete integration examples and usage patterns.

---

**Next**: Read the interaction guide for detailed behavior specifications.
