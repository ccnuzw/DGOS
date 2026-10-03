# DGOS Icon Usage Examples

## Installation

The icon component is part of `@dgos/ui` package:

```tsx
import { MacOSIcon, DockIcon, StatusBarIcon, SystemIcon } from '@dgos/ui';
```

## Quick Start

### Basic Icon
```tsx
<MacOSIcon name="system-info" category="apps" size={48} />
```

### Theme-Aware Icon
```tsx
import { useTheme } from '@/hooks/useTheme';

function MyComponent() {
  const { theme } = useTheme();
  return <MacOSIcon name="settings" variant={theme} size={48} />;
}
```

### Status Bar Icon
```tsx
<StatusBarIcon name="notifications" />
```

### Dock Icon
```tsx
<DockIcon name="catalog" variant="light" />
```

## Complete Examples

See `/packages/dgos-ui/src/icon-examples.tsx` for runnable examples including:

- Basic icon usage
- Theme-aware icons
- Dock component
- Status bar
- Icon grid/launcher
- System icons
- Badge notifications
- Size variations

## Icon Categories

### Apps (`category="apps"`)
- system-info
- catalog
- developer-center
- settings
- providers
- models
- extensions
- assistant
- tasks

### System (`category="system"`)
- dgos-logo
- downloads
- trash
- trash-full

### Status Bar (`category="statusbar"`)
- search
- notifications
- settings
- user
- clock
- wifi
- battery
- volume

## Styling

Icons automatically include:
- Drop shadows (32px and larger)
- Hover effects on dock icons
- Theme-appropriate colors
- Smooth transitions

Custom styles can be added via `className` or `style` props:

```tsx
<MacOSIcon 
  name="assistant" 
  size={48}
  className="my-custom-class"
  style={{ margin: '10px' }}
/>
```

## Accessibility

Always provide meaningful alt text when needed:

```tsx
<MacOSIcon 
  name="settings" 
  alt="Open system settings"
  size={48}
/>
```

## Performance

- SVG format ensures crisp rendering at any size
- Icons are loaded on-demand
- No JavaScript required for static icons
- Minimal file size (~2-3KB per icon)
