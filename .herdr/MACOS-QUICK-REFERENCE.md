# macOS UI Quick Reference

**Quick integration guide for DGOS V1 macOS-style UI system**

---

## 🚀 Quick Start (5 minutes)

### 1. Install (if needed)
```bash
npm install lucide-react
```

### 2. Import CSS
```tsx
import '@dgos/app-shell/macos/macos.css';
```

### 3. Use MacOSShell
```tsx
import { MacOSShell, useRoute } from '@dgos/app-shell';
import { routes } from '@dgos/design-tokens';

function App() {
  const route = useRoute();
  
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
      }}
      onNavigate={(route) => {
        window.history.pushState({}, '', routes[route]);
      }}
      theme="light"
    >
      <YourContent />
    </MacOSShell>
  );
}
```

Done! ✅

---

## 📦 Components Overview

| Component | Purpose | Import |
|-----------|---------|--------|
| `MacOSShell` | Complete desktop | `@dgos/app-shell` |
| `MacOSSystemBar` | Top bar | `@dgos/app-shell/macos/system-bar` |
| `MacOSDock` | Bottom launcher | `@dgos/app-shell/macos/dock` |
| `MacOSWindow` | Window frame | `@dgos/app-shell/macos/window` |
| `MacOSLaunchpad` | App grid | `@dgos/app-shell/macos/launchpad` |
| `WindowManager` | Multi-window | `@dgos/app-shell/macos/window-manager` |

---

## 🎨 Design Tokens

```typescript
import { macOSTokens } from '@dgos/design-tokens';

// Quick access
macOSTokens.dock.height              // '68px'
macOSTokens.window.borderRadius      // '12px'
macOSTokens.animations.spring        // 'cubic-bezier(...)'
macOSTokens.trafficLights.colors.close  // '#FF5F56'
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` | Open launchpad |
| `F4` | Toggle launchpad |
| `ESC` | Close overlays |
| `Tab` | Navigate elements |
| `↑ ↓ ← →` | Navigate grid |
| `Enter` / `Space` | Activate |

---

## 🪟 Window Management

```tsx
import { useWindowManager } from '@dgos/app-shell';

const { openWindow, closeWindow, minimizeWindow } = useWindowManager();

// Open a window
const id = openWindow(
  'settings',
  'Settings',
  <SettingsPage />,
  { width: 900, height: 700 }
);

// Close it
closeWindow(id);
```

---

## 🎯 Common Tasks

### Change Theme
```tsx
const [theme, setTheme] = useState<'light' | 'dark'>('light');

<MacOSShell
  theme={theme}
  onThemeToggle={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
  {...props}
/>
```

### Add Dock App
```tsx
const dockApps = [
  {
    id: 'myapp',
    name: 'My App',
    icon: <MyIcon size={32} />,
    isRunning: true,
    badge: 5,
    onClick: () => navigate('/myapp'),
  },
];

<MacOSDock apps={dockApps} />
```

### Handle Window Events
```tsx
<MacOSWindow
  title="My Window"
  onClose={() => console.log('Closed')}
  onMinimize={() => console.log('Minimized')}
  onMaximize={() => console.log('Maximized')}
  onFocus={() => console.log('Focused')}
  onBoundsChange={(bounds) => console.log('Moved/resized', bounds)}
>
  <Content />
</MacOSWindow>
```

---

## 🎨 CSS Classes

### System Bar
```css
.macos-system-bar
.macos-system-bar__logo
.macos-system-bar__icon-button
.macos-system-bar__time
```

### Dock
```css
.macos-dock
.macos-dock__item
.macos-dock__item--running
.macos-dock__indicator
.macos-dock__badge
```

### Window
```css
.macos-window
.macos-window--focused
.macos-window--maximized
.macos-window__title-bar
.macos-window__traffic-lights
```

### Launchpad
```css
.macos-launchpad
.macos-launchpad__grid
.macos-launchpad__item
.macos-launchpad__icon
```

---

## 🐛 Troubleshooting

### Dock not visible?
```tsx
// Ensure CSS is imported
import '@dgos/app-shell/macos/macos.css';
```

### Icons not showing?
```bash
# Install lucide-react
npm install lucide-react
```

### Animations not working?
```css
/* Check browser support for backdrop-filter */
@supports (backdrop-filter: blur(20px)) {
  /* Supported */
}
```

### Window not draggable?
```tsx
// Ensure title bar has correct className
<div className="macos-window__title-bar">
```

---

## 📊 Performance Tips

1. **Memoize windows** to prevent unnecessary re-renders
2. **Use CSS transforms** for custom animations
3. **Debounce resize handlers** (150ms recommended)
4. **Virtual scrolling** for long lists (>100 items)

```tsx
const MemoizedWindow = React.memo(MacOSWindow);
```

---

## ♿ Accessibility Checklist

- [ ] All buttons have `aria-label`
- [ ] Keyboard navigation works
- [ ] Focus is visible (3px ring)
- [ ] Screen reader tested
- [ ] Reduced motion respected
- [ ] Touch targets ≥44×44px

---

## 📱 Responsive Breakpoints

```css
/* Desktop (full experience) */
@media (min-width: 851px) { }

/* Tablet (adjusted) */
@media (min-width: 521px) and (max-width: 850px) { }

/* Mobile (compact) */
@media (max-width: 520px) { }
```

---

## 🎚️ Scaling

```tsx
// Set on html element
<html data-scale="125">
```

Supported: `75` | `100` | `125` | `150` | `175`

---

## 🎨 Theme Variables

Ensure these CSS variables are defined:

```css
:root {
  --surface: #ffffff;
  --canvas: #f8fafc;
  --text: #0f172a;
  --muted: #64748b;
  --border: #e2e8f0;
  --primary: #0F5FD9;
}

[data-theme="dark"] {
  --surface: #1e293b;
  --canvas: #0f172a;
  --text: #f1f5f9;
  /* ... */
}
```

---

## 📚 Full Documentation

- **Design Spec**: `.herdr/MACOS-UI-DESIGN-SPEC.md`
- **Component Docs**: `.herdr/MACOS-UI-COMPONENTS.md`
- **Implementation Report**: `.herdr/V1-MACOS-UI-COMPLETE.md`
- **Visual Comparison**: `.herdr/MACOS-VISUAL-COMPARISON.md`

---

## 🆘 Need Help?

1. Check component documentation
2. Review usage examples
3. Check troubleshooting guide
4. Review implementation report

---

**Quick Reference Version**: 1.0  
**Last Updated**: 2026-10-02  
**Status**: Production Ready ✅
