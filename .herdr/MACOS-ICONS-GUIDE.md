# macOS-Style Icon System for DGOS V1

**Version:** 1.0  
**Last Updated:** 2024  
**Status:** Complete

## Overview

DGOS V1 features a complete set of professional macOS-style icons that embody the system's brand identity: technical excellence, modern design, and professional aesthetics.

## Design Principles

### 1. Visual Consistency
- **Rounded Square Base**: 48x48px with 10px border radius
- **Premium Gradients**: Smooth color transitions that create depth
- **Subtle Highlights**: White overlay (20-40% opacity) on top third
- **Drop Shadows**: Consistent shadow filter for elevation

### 2. Brand Integration
All icons use DGOS brand colors:
- **Primary Blue**: #0F5FD9 → #5B9EFF (light → dark mode)
- **Secondary Teal**: #06B6D4 → #22D3EE  
- **Success Green**: #10B981 → #34D399
- **Warning Amber**: #F59E0B → #FBBF24
- **Purple**: #A855F7 → #C084FC
- **Pink/Rose**: #EC4899 → #F9A8D4
- **Neutral Gray**: #64748B → #94A3B8

### 3. Recognizability
Each icon uses a clear, distinctive metaphor that immediately communicates its purpose.

## Icon Catalog

### Application Icons (48x48px)

#### **system-info.svg**
- **Purpose**: System Information app
- **Metaphor**: Information symbol "i"
- **Colors**: Blue gradient (#60A5FA → #3B82F6)
- **Usage**: System monitoring and hardware info

#### **catalog.svg**
- **Purpose**: Application Catalog/App Store
- **Metaphor**: 3x3 grid of app squares
- **Colors**: Purple-Indigo gradient (#8B5CF6 → #6366F1)
- **Usage**: Browse and install applications

#### **developer-center.svg**
- **Purpose**: Developer tools and SDK
- **Metaphor**: Code brackets `</>`
- **Colors**: Green gradient (#34D399 → #10B981)
- **Usage**: Development environment access

#### **settings.svg**
- **Purpose**: System Settings
- **Metaphor**: Gear with 8 teeth
- **Colors**: Gray gradient (#94A3B8 → #64748B)
- **Usage**: System configuration

#### **providers.svg**
- **Purpose**: AI Provider Management
- **Metaphor**: Cloud with server racks
- **Colors**: Cyan gradient (#38BDF8 → #0EA5E9)
- **Usage**: Configure API providers

#### **models.svg**
- **Purpose**: AI Model Management
- **Metaphor**: 3D cube (neural network representation)
- **Colors**: Purple gradient (#C084FC → #A855F7)
- **Usage**: Model selection and configuration

#### **extensions.svg**
- **Purpose**: Extension Management
- **Metaphor**: Puzzle piece
- **Colors**: Amber gradient (#FBBF24 → #F59E0B)
- **Usage**: Install and manage extensions

#### **assistant.svg**
- **Purpose**: AI Assistant
- **Metaphor**: Sparkle/star with glow effect
- **Colors**: Gold gradient (#FCD34D → #EAB308)
- **Usage**: Access AI assistant features

#### **tasks.svg**
- **Purpose**: Task Activity Monitor
- **Metaphor**: Activity line chart
- **Colors**: Pink gradient (#F472B6 → #EC4899)
- **Usage**: View AI task execution and history

### System Icons (48x48px)

#### **dgos-logo.svg**
- **Purpose**: Main DGOS system identifier
- **Metaphor**: Stylized "D" lettermark with geometric elements
- **Colors**: Multi-gradient (#0F5FD9 → #0EA5E9 → #06B6D4)
- **Usage**: Finder equivalent, system branding

#### **downloads.svg**
- **Purpose**: Downloads folder
- **Metaphor**: Folder with download arrow
- **Colors**: Blue gradient (#60A5FA → #3B82F6)
- **Usage**: Quick access to downloaded files

#### **trash.svg**
- **Purpose**: Trash bin (empty state)
- **Metaphor**: Waste basket with vertical lines
- **Colors**: Gray gradient (#E2E8F0 → #CBD5E1)
- **Usage**: Deleted files container (empty)

#### **trash-full.svg**
- **Purpose**: Trash bin (full state)
- **Metaphor**: Basket with colorful paper pieces
- **Colors**: Gray base with colorful content
- **Usage**: Deleted files container (has items)

### Status Bar Icons (24x24px)

All status bar icons use line-style design with `currentColor` fill/stroke for theming:

- **search.svg**: Magnifying glass
- **notifications.svg**: Bell with clapper
- **settings.svg**: Three vertical sliders
- **user.svg**: User profile silhouette
- **clock.svg**: Clock face showing time
- **wifi.svg**: WiFi signal waves (3 levels)
- **battery.svg**: Battery with fill indicator
- **volume.svg**: Speaker with sound waves

## Dark Mode Variants

All icons have optimized dark mode versions in `dark/` subdirectories featuring:
- **Brighter gradients** for better contrast
- **Enhanced glow effects** on key elements
- **Adjusted opacity** for highlights (40-50% vs 30-40%)
- **Stronger shadows** for depth perception

## File Structure

```
apps/web/public/icons/
├── apps/
│   ├── system-info.svg
│   ├── catalog.svg
│   ├── developer-center.svg
│   ├── settings.svg
│   ├── providers.svg
│   ├── models.svg
│   ├── extensions.svg
│   ├── assistant.svg
│   └── tasks.svg
├── system/
│   ├── dgos-logo.svg
│   ├── downloads.svg
│   ├── trash.svg
│   └── trash-full.svg
├── statusbar/
│   ├── search.svg
│   ├── notifications.svg
│   ├── settings.svg
│   ├── user.svg
│   ├── clock.svg
│   ├── wifi.svg
│   ├── battery.svg
│   └── volume.svg
└── dark/
    ├── apps/
    │   └── [all app icons with -dark variants]
    ├── system/
    │   └── [all system icons with -dark variants]
    └── statusbar/
        └── [inherits from main, uses currentColor]
```

## Size Guide

| Size | Usage | Export |
|------|-------|--------|
| 16x16 | Smallest UI elements | Optional |
| 24x24 | Status bar, toolbars | ✓ Created |
| 32x32 | Small lists | Optional |
| 48x48 | Dock, main icons | ✓ Created |
| 64x64 | Large Dock | Scale from 48px |
| 128x128 | High DPI displays | Scale from 48px |
| 256x256 | Retina @2x | Scale from 48px |
| 512x512 | Ultra high-res | Scale from 48px |

**Note**: SVG format ensures perfect scaling to any size without quality loss.

## Usage Examples

### Basic Icon Component

```tsx
interface IconProps {
  name: string;
  size?: 16 | 24 | 32 | 48 | 64;
  variant?: 'light' | 'dark';
  category?: 'apps' | 'system' | 'statusbar';
}

export function MacOSIcon({ 
  name, 
  size = 48, 
  variant = 'light',
  category = 'apps' 
}: IconProps) {
  const iconPath = variant === 'dark' 
    ? `/icons/dark/${category}/${name}.svg`
    : `/icons/${category}/${name}.svg`;
  
  return (
    <img 
      src={iconPath}
      alt={name}
      width={size}
      height={size}
      className="macos-icon"
      style={{
        filter: size >= 32 
          ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' 
          : 'none'
      }}
    />
  );
}
```

### Dock Integration

```tsx
<div className="dock">
  <MacOSIcon name="system-info" category="apps" size={48} />
  <MacOSIcon name="catalog" category="apps" size={48} />
  <MacOSIcon name="developer-center" category="apps" size={48} />
  <MacOSIcon name="settings" category="apps" size={48} />
</div>
```

### Status Bar Integration

```tsx
<div className="status-bar">
  <MacOSIcon name="search" category="statusbar" size={24} />
  <MacOSIcon name="notifications" category="statusbar" size={24} />
  <MacOSIcon name="wifi" category="statusbar" size={24} />
  <MacOSIcon name="battery" category="statusbar" size={24} />
</div>
```

### Theme-Aware Usage

```tsx
import { useTheme } from '@/hooks/useTheme';

function ThemedIcon({ name }: { name: string }) {
  const { theme } = useTheme();
  
  return (
    <MacOSIcon 
      name={name} 
      variant={theme} 
      category="apps"
      size={48}
    />
  );
}
```

## Technical Specifications

### SVG Structure
```xml
<svg width="48" height="48" viewBox="0 0 48 48" fill="none">
  <defs>
    <!-- Gradient definitions -->
    <linearGradient id="unique-grad-id">
      <stop offset="0%" stop-color="#color1"/>
      <stop offset="100%" stop-color="#color2"/>
    </linearGradient>
    
    <!-- Shadow filter -->
    <filter id="unique-shadow-id">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- Base rounded rectangle -->
  <rect x="4" y="4" width="40" height="40" rx="10" 
        fill="url(#unique-grad-id)" 
        filter="url(#unique-shadow-id)"/>
  
  <!-- Highlight overlay -->
  <path d="M 4 14 Q 4 4 14 4 L 34 4 Q 44 4 44 14 L 44 20 Q 24 10 4 20 Z" 
        fill="white" opacity="0.3"/>
  
  <!-- Icon symbol -->
  <!-- ... unique icon graphics ... -->
</svg>
```

### Optimization Guidelines
- ✓ Use `<defs>` for reusable gradients and filters
- ✓ Unique IDs to avoid conflicts when multiple icons load
- ✓ Minimal path nodes for smaller file size
- ✓ `fill="none"` on root to prevent unwanted backgrounds
- ✓ ViewBox ensures proper scaling

## Accessibility

### Alt Text Patterns
- App icons: `"[App Name] application"`
- System icons: `"[Function] folder"` or `"DGOS system"`
- Status icons: `"[Status] indicator"`

### Color Contrast
All icons maintain WCAG AA contrast ratios:
- Light mode: Colored gradients on white/light backgrounds
- Dark mode: Brighter variants on dark backgrounds
- Status bar: Inherits text color for maximum contrast

## Future Expansion

### Adding New Icons

1. **Follow the template structure**:
   - 48x48px viewBox
   - Rounded rectangle base (rx="10")
   - Brand-appropriate gradient
   - Highlight overlay
   - Consistent shadow filter

2. **Use brand colors** from design tokens

3. **Create both light and dark variants**

4. **Ensure unique IDs** for gradients/filters

5. **Update this documentation** with:
   - Icon name and purpose
   - Color palette used
   - Metaphor/concept
   - Usage context

### Planned Additions
- App-specific icons for third-party extensions
- Status indicators (online, busy, away)
- File type icons
- Action icons (copy, paste, delete, etc.)
- Size variants (16x16, 32x32) if needed

## Credits

- **Design System**: DGOS V1 Design Tokens
- **Style Inspiration**: macOS Big Sur icon language
- **Brand Colors**: DGOS Independent Brand Identity
- **Format**: SVG (scalable vector graphics)

## Version History

- **v1.0** (2024): Initial complete icon set
  - 9 application icons
  - 4 system icons  
  - 8 status bar icons
  - Full dark mode support
  - Complete documentation
