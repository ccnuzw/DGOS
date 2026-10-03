# macOS UI Design Specification for DGOS V1

**Status**: Implementation Guide  
**Date**: 2026-10-02  
**Version**: 1.0  

## Overview

DGOS V1 adopts a macOS-inspired design language while maintaining its independent brand identity. This specification extracts key requirements from reference materials and defines implementation standards for unified Web + Desktop experience.

## Reference Sources

- `docs/90-参考资料/DX-OS成熟软件截图证据.md` - Visual reference
- `docs/04-技术架构/当前版本/V1-界面规范.md` - Technical standards
- `docs/06-决策记录/ADR/0004-V1统一设计系统与跨应用交互契约.md` - Architecture decisions

## Core Design Principles

1. **macOS Visual Language**: Apple-style desktop with system bar, Dock, rounded windows, and translucent materials
2. **DGOS Brand Identity**: Use DGOS colors (#0F5FD9 primary), logos, and independent branding
3. **Unified Experience**: Web and Desktop share identical visual and interaction patterns
4. **Performance First**: 60fps animations, GPU acceleration, optimized rendering
5. **Accessibility**: Full keyboard navigation, screen reader support, reduced motion support

## Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  System Bar (44px)  [DGOS] [App Menu] ... [Search] [⏰] │ ← Fixed top
├─────────────────────────────────────────────────────────┤
│                                                           │
│                  Desktop / Window Area                    │
│                                                           │
│              ┌──[●][●][●]─[Title]────────┐              │
│              │                            │              │
│              │      Window Content        │              │
│              │                            │              │
│              └────────────────────────────┘              │
│                                                           │
└─────────────────────────────────────────────────────────┘
  └──[📱][⚙️][💬] ... [📂][🗑️]──┘ ← Dock (68px, centered)
```

## 1. System Bar (Top)

### Dimensions
- Height: `44px`
- Position: Fixed to viewport top
- Z-index: `1000`

### Layout
```
[DGOS Logo (32px)] [Current App Name] ... [Search Icon] [Notifications] [Settings] [HH:MM]
```

### Visual Style
- Background: `rgba(255, 255, 255, 0.8)` (light) / `rgba(30, 30, 30, 0.85)` (dark)
- Backdrop filter: `blur(20px) saturate(180%)`
- Border bottom: `1px solid rgba(0, 0, 0, 0.1)`
- Text: 14px, semibold for app name
- Icons: 20px, consistent spacing 12px

### Interactions
- Logo click → App menu/launcher
- Search → Spotlight-style command palette
- Time → Always live-updating
- Icons → Hover state with subtle scale

## 2. Dock (Bottom)

### Dimensions
- Height: `68px` (container)
- Icon size: `48x48px` base, up to `58px` on hover
- Border radius: `24px`
- Bottom offset: `8px` from viewport edge
- Position: Fixed, horizontally centered

### Layout
```
[App1] [App2] [App3] [App4] | [Downloads] [Trash]
  ●                              ↑ Divider (2px, 40px height)
↑ Running indicator
```

### Visual Style
- Background: `rgba(255, 255, 255, 0.75)` (light) / `rgba(50, 50, 50, 0.85)` (dark)
- Backdrop filter: `blur(30px) saturate(180%)`
- Shadow: `0 8px 32px rgba(0, 0, 0, 0.15)`
- Border: `1px solid rgba(255, 255, 255, 0.2)` (light) / `rgba(255, 255, 255, 0.05)` (dark)
- Icon spacing: `8px`
- Padding: `10px 16px`

### Interactions
- **Hover magnification**: Icon scales to `1.2` and lifts `8px`
- **Running indicator**: Small dot (6px) below running apps, color: primary brand
- **Badge**: Notification count on top-right (12px circle, red background)
- **Drag to reorder**: Visual feedback with ghost image
- **Right-click menu**: Options (Open, Options, Quit)

### Animations
- Hover: `cubic-bezier(0.34, 1.56, 0.64, 1) 300ms` (spring-like)
- Icon entrance: Staggered bounce with 50ms delay between icons
- Minimize window: "Genie effect" - window scales and morphs into dock icon

## 3. Window Frame

### Structure
```
┌─[●][●][●]───────[Window Title]──────────────[…]─┐
│  12px  from left edge                             │
│                                                    │
│                  Content Area                     │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Dimensions
- Title bar: `32px` height
- Border radius: `12px` (all corners)
- Min size: `400x300px`
- Default: `800x600px`

### Traffic Lights (Red/Yellow/Green Buttons)
- Size: `12px` diameter circles
- Spacing: `8px` between buttons
- Position: `12px` from left, `10px` from top
- Colors:
  - Close (Red): `#FF5F56`
  - Minimize (Yellow): `#FFBD2E`
  - Maximize (Green): `#27C93F`
- Hover state: Show symbols (×, −, +) in dark gray
- Active state: Darken by 10%

### Window Styles
- Shadow: `0 20px 60px rgba(0, 0, 0, 0.25)`
- Border: `1px solid rgba(0, 0, 0, 0.08)` (light) / `rgba(255, 255, 255, 0.08)` (dark)
- Background: `var(--surface)`
- Title: Centered, 14px, semibold, `var(--text)`

### Window States
1. **Normal**: Standard size and position
2. **Maximized**: Full viewport minus system bar
3. **Minimized**: Scaled to Dock icon
4. **Focused**: Full opacity, elevated shadow
5. **Unfocused**: 95% opacity, reduced shadow

### Interactions
- **Drag title bar**: Move window (cursor: move)
- **Double-click title bar**: Toggle maximize
- **Drag to top edge**: Snap to maximize
- **Resize from edges**: 8px hit zone, cursor changes
- **Resize from corners**: 12px hit zone, diagonal cursor

## 4. Launchpad

### Layout
- Grid: `7 columns × 5 rows` (adjusts to viewport)
- Icon size: `64x64px`
- Icon spacing: `32px` horizontal, `40px` vertical
- Label: Below icon, 12px, centered, max 2 lines

### Background
- Overlay: Full viewport
- Background: `rgba(0, 0, 0, 0.3)` with backdrop blur `blur(40px)`
- Click outside to dismiss

### Animations
- **Open**: Icons zoom from center with spring animation, staggered 20ms
- **Close**: Reverse animation, icons zoom back to center
- **Page transition**: Slide with momentum (if pagination needed)

### Interactions
- **Trigger**: F4 key or gesture
- **Dismiss**: ESC key or click background
- **Search**: Type to filter (optional in V1)
- **Drag**: Reorder icons (save to preferences)

## 5. Icons

### Application Icons
Design in SVG, 48×48px base size, style:
- Rounded square with 12px corner radius
- Subtle gradient (top lighter)
- Inner shadow for depth: `inset 0 1px 2px rgba(255,255,255,0.3)`
- Outer shadow: `0 2px 8px rgba(0,0,0,0.15)`

### System Icons (20×20px for system bar)
- Monochrome, stroke-based
- 2px stroke width
- Rounded caps and joins
- Use Lucide icons or similar SF Symbols style

### Icon List
**Applications** (48px):
- `dgos-logo.svg` - DGOS main logo
- `catalog.svg` - Grid of squares
- `settings.svg` - Gear/cog
- `providers.svg` - Cloud/server
- `models.svg` - Stacked cubes
- `skills.svg` - Puzzle piece
- `mcp.svg` - Connected nodes
- `assistant.svg` - Sparkle/star
- `tasks.svg` - Check list
- `developer.svg` - Code brackets

**System** (20px):
- `search.svg` - Magnifying glass
- `notifications.svg` - Bell
- `user.svg` - Person circle
- `clock.svg` - Clock face

## 6. Colors & Materials

### Glassmorphism
```css
.glass-effect {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.glass-effect-dark {
  background: rgba(30, 30, 30, 0.85);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
```

### Shadows
- Dock: `0 8px 32px rgba(0, 0, 0, 0.15)`
- Window: `0 20px 60px rgba(0, 0, 0, 0.25)`
- Elevated menu: `0 12px 40px rgba(0, 0, 0, 0.2)`

### DGOS Brand Integration
- Primary actions: `#0F5FD9` (DGOS blue)
- Running indicators: `#0F5FD9`
- Focus rings: `#0F5FD9` with `0 0 0 3px rgba(15, 95, 217, 0.2)`
- Links: `#0F5FD9`

## 7. Typography

- System font: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif`
- Chinese: Add `"PingFang SC"` before sans-serif
- Sizes: 12px (small), 13px (body), 14px (default), 16px (large), 22px (heading)
- Weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

## 8. Animations & Transitions

### Timing Functions
- **Standard**: `cubic-bezier(0.4, 0, 0.2, 1)` - 250ms
- **Spring/Emphasis**: `cubic-bezier(0.34, 1.56, 0.64, 1)` - 300ms
- **Quick**: `cubic-bezier(0, 0, 0.2, 1)` - 150ms
- **Exit**: `cubic-bezier(0.4, 0, 1, 1)` - 200ms

### Key Animations
1. **Window open**: Scale from 0.95 → 1.0, opacity 0 → 1, 300ms spring
2. **Window close**: Scale to 0.95, opacity to 0, 200ms
3. **Window minimize**: Genie effect to dock icon, 400ms
4. **Dock icon hover**: Scale 1.0 → 1.2, translateY 0 → -8px, 300ms spring
5. **Launchpad open**: Icons scale from 0.3 → 1.0, staggered 20ms, 400ms spring

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## 9. Responsive Behavior

### Breakpoints
- Mobile: `< 520px` - Dock hidden, simplified top bar
- Tablet: `520px - 850px` - Dock at bottom, reduced window chrome
- Desktop: `> 850px` - Full macOS experience
- Wide: `> 1400px` - Expanded workspace, more visible windows

### Scaling (75% - 175%)
All dimensions scale proportionally via CSS `zoom` or `transform: scale()` on root element:
```css
html[data-scale="75"] { zoom: 0.75; }
html[data-scale="100"] { zoom: 1.0; }
html[data-scale="125"] { zoom: 1.25; }
html[data-scale="150"] { zoom: 1.5; }
html[data-scale="175"] { zoom: 1.75; }
```

## 10. Accessibility

### Keyboard Navigation
- Tab: Move between interactive elements
- Shift+Tab: Move backward
- Arrow keys: Navigate within lists/grids
- Enter/Space: Activate buttons
- Escape: Close dialogs/menus
- ⌘K: Open command palette
- ⌘W: Close window
- ⌘M: Minimize window
- ⌘Q: Quit application
- F4: Toggle launchpad

### Screen Reader
- All icons have `aria-label`
- Window state changes announced
- Focus management for dialogs
- Live regions for status updates

### Focus Management
- Visible focus ring: 3px, `var(--primary)` with 20% opacity shadow
- Focus trap in modals
- Restore focus after dialog close

## 11. Performance Targets

- **First Paint**: < 500ms
- **Interactive**: < 1000ms
- **Animation FPS**: 60fps sustained
- **Dock hover response**: < 16ms
- **Window drag response**: < 16ms
- **Memory**: < 200MB for shell (excluding apps)

### Optimization Techniques
- `will-change: transform` on animating elements
- `transform3d` for GPU acceleration
- Virtual scrolling for long lists (>100 items)
- Debounced window resize handlers (150ms)
- RequestAnimationFrame for animations
- Passive event listeners for scroll

## 12. Dark Mode

All components support automatic dark mode switching:
- Read from system preference or DGOS settings
- Toggle without page reload
- Smooth transition: `200ms` for color changes
- Assets: Provide light/dark variants for complex graphics

## Implementation Checklist

### Phase 1: Core Structure (Priority 1)
- [ ] macOS design tokens (colors, spacing, shadows)
- [ ] System bar component
- [ ] Dock component with icons
- [ ] Window frame component with traffic lights
- [ ] Basic window manager (open, close, focus)

### Phase 2: Interactions (Priority 2)
- [ ] Dock icon hover magnification
- [ ] Window dragging
- [ ] Window resizing
- [ ] Traffic light button actions
- [ ] Launchpad overlay

### Phase 3: Animations (Priority 3)
- [ ] Window open/close animations
- [ ] Dock icon animations
- [ ] Launchpad entrance/exit
- [ ] Minimize genie effect

### Phase 4: Polish (Priority 4)
- [ ] Keyboard shortcuts
- [ ] Right-click menus
- [ ] Accessibility features
- [ ] Performance optimization
- [ ] Reduced motion support

## Acceptance Criteria

✓ **Visual**: Recognizably macOS-inspired while maintaining DGOS brand  
✓ **Functional**: All core interactions work smoothly  
✓ **Performance**: 60fps animations, responsive interactions  
✓ **Accessible**: Full keyboard navigation, screen reader support  
✓ **Responsive**: Works on all specified breakpoints and scales  
✓ **Cross-platform**: Identical on Web and Desktop (Tauri)  

---

**Next Steps**: Proceed to implementation following this specification, starting with Phase 1 components.
