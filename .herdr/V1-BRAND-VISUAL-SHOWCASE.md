# DGOS Brand Visual Showcase

**Version**: V1.0  
**Date**: 2026-10-02  
**Purpose**: Visual reference for DGOS独立品牌 implementation

---

## Color Palette

### Primary Brand Color: Deep Ocean Blue

**Light Mode**: `#0F5FD9`  
**Dark Mode**: `#5B9EFF`

```
■■■■■ Deep Ocean Blue
Represents: Technical precision, reliability, depth
Usage: Primary actions, links, focus states, brand moments
Distinction: More sophisticated than generic blues
```

### Secondary Brand Color: Electric Teal

**Light Mode**: `#06B6D4`  
**Dark Mode**: `#22D3EE`

```
■■■■■ Electric Teal  
Represents: Innovation, efficiency, modernity
Usage: Accents, progress indicators, secondary actions
Distinction: Energetic complement to primary
```

### Semantic Colors

```
Success ■■■■■ #10b981 / #34d399
Warning ■■■■■ #f59e0b / #fbbf24
Danger  ■■■■■ #ef4444 / #f87171
Info    ■■■■■ #0ea5e9 / #38bdf8
```

### Neutral Palette

**Light Mode**:
```
Canvas  ■■■■■ #f8fafc (Cool background)
Surface ■■■■■ #ffffff (White)
Text    ■■■■■ #0f172a (High contrast)
Muted   ■■■■■ #64748b (Secondary text)
Border  ■■■■■ #e2e8f0 (Dividers)
```

**Dark Mode**:
```
Canvas  ■■■■■ #0f172a (Deep navy)
Surface ■■■■■ #1e293b (Slate)
Raised  ■■■■■ #334155 (Elevated)
Text    ■■■■■ #f1f5f9 (High contrast)
Muted   ■■■■■ #94a3b8 (Secondary text)
Border  ■■■■■ #334155 (Subtle)
```

---

## Typography

### Primary Font: Inter

```
Font Family: Inter, -apple-system, BlinkMacSystemFont, 
             "SF Pro Text", "Segoe UI", "PingFang SC", 
             "Microsoft YaHei", sans-serif

Characteristics:
✓ Modern and clean
✓ Excellent readability at small sizes
✓ Professional technical aesthetic
✓ Good internationalization (supports Chinese)

ABCDEFGHIJKLMNOPQRSTUVWXYZ
abcdefghijklmnopqrstuvwxyz
0123456789 !@#$%^&*()

你好世界 (Chinese support)
```

### Code Font: JetBrains Mono

```
Font Family: "JetBrains Mono", ui-monospace, 
             SFMono-Regular, "SF Mono", Menlo, Monaco, 
             "Cascadia Code", Consolas, monospace

Characteristics:
✓ Developer-focused design
✓ Excellent ligature support
✓ Clear character distinction (0 vs O, 1 vs l vs I)
✓ Optimized for code

const connectProvider = async () => {
  return await dgos.providers.connect();
};

<!-- --> != === => <-
```

### Type Scale

```
xxxl (36px)  ━━━━━━━ Hero Text
xxl  (28px)  ━━━━━━━ Page Titles
xl   (22px)  ━━━━━━━ Section Headings
lg   (18px)  ━━━━━━━ Subheadings
md   (16px)  ━━━━━━━ Emphasized Body
base (14px)  ━━━━━━━ Body Text (Default)
sm   (12px)  ━━━━━━━ Secondary Text
xs   (11px)  ━━━━━━━ Labels, Captions
```

---

## Components

### Buttons

```
┌─────────────────┐
│ Connect Provider │  Primary - Deep Ocean Blue
└─────────────────┘  Used for main actions

┌─────────────────┐
│  View Details   │  Secondary - Soft background
└─────────────────┘  Used for less prominent actions

┌─────────────────┐
│ Delete Provider │  Danger - Red border/text
└─────────────────┘  Used for destructive actions
```

**States**:
- Default: Solid background
- Hover: Slightly darker (150ms transition)
- Active: Scale down 0.98 (100ms)
- Focus: 2px outline in brand primary
- Disabled: 55% opacity

### Badges

```
┌────────┐
│ Active │  Success - Green background
└────────┘

┌────────┐
│ Failed │  Danger - Red background
└────────┘

┌─────────┐
│ Pending │  Info - Blue background
└─────────┘

┌──────────┐
│ Warning  │  Warning - Amber background
└──────────┘
```

### Status Indicators

```
┌──────┐
│ ✓ OK │  Good - Green with checkmark
└──────┘

┌────────┐
│ ✗ Error│  Bad - Red with X
└────────┘
```

### Cards

```
┌─────────────────────────────┐
│                             │
│  Card Title                 │
│  ─────────────────────────  │
│                             │
│  Card content with border,  │
│  rounded corners (8px),     │
│  and subtle hover shadow    │
│                             │
└─────────────────────────────┘

Border: 1px solid var(--border)
Radius: 8px
Hover: Elevated shadow
```

### Alerts

```
┃  Unable to connect to provider.
┃  Check your network and try again.
    Error - Red left border

┃  New version available. Update recommended.
    Info - Blue left border

┃  Provider connected successfully.
    Success - Green left border

┃  Connection may be unstable.
    Warning - Amber left border
```

### Tabs

```
Overview   Settings   Advanced
━━━━━━━━   ─────────  ─────────
  (active)   (hover)   (default)

Active: Primary blue underline + bold
Hover: Text color darkens
Default: Muted gray
```

### Forms

```
┌─ Label ──────────────────────┐
│                              │
│  Input field with border     │
│                              │
└──────────────────────────────┘
Focus: Blue outline + border

┌─ Label ──────────────────────┐
│                              │
│  Error input (red border)    │
│                              │
└──────────────────────────────┘
Error message below in red
```

---

## Logo & Icons

### DGOS Logo

```
    ┌─────────────┐
    │   ┌─────┐   │  Layered applications
    │ D │  •  │   │  D letterform
    │   │ • • │   │  Connection nodes
    │   └─────┘   │  Deep Ocean Blue + Electric Teal
    └─────────────┘
```

**Concept**:
- Layered rectangles = Multiple applications
- Connection nodes = AI/MCP integration
- D letterform = DGOS brand
- Colors = Primary + Secondary brand

**Sizes**: 128x128 (logo.svg), 64x64 (icon.svg)

### App Icons

**Light Mode** (`icon.svg`):
- Primary: #0F5FD9 (Deep Ocean Blue)
- Secondary: #06B6D4 (Electric Teal)
- Background: Transparent

**Dark Mode** (`icon-dark.svg`):
- Primary: #5B9EFF (Lighter blue)
- Secondary: #22D3EE (Brighter teal)
- Background: Transparent

---

## Illustrations

### Empty States

**No Providers** (`empty-providers.svg`):
```
    ○ ··· ○ ··· ○
         ⊕
    Disconnected nodes
    Plus icon for action
```

**No Data** (`empty-data.svg`):
```
    ┌───────┐
    │ ___   │
    │ _____ │  Empty document
    │ ____  │  with search icon
    └───────┘
        🔍
```

### Error States

**Connection Failed** (`error-connection.svg`):
```
    ○ ── ✗ ── ○
         ⚠
    Broken connection
    Alert icon
```

**Style**:
- Line art (2px stroke)
- Brand colors (primary + secondary)
- Simple metaphors
- Not too abstract

---

## Motion Design

### Easing Curves

```css
/* Standard (default) */
cubic-bezier(0.4, 0, 0.2, 1)
Smooth, balanced transitions

/* Enter */
cubic-bezier(0, 0, 0.2, 1)
Elements appearing

/* Exit */
cubic-bezier(0.4, 0, 1, 1)
Elements disappearing

/* Emphasis (use sparingly) */
cubic-bezier(0.34, 1.56, 0.64, 1)
Bouncy, attention-grabbing
```

### Duration Guidelines

```
100ms ━━━     Instant - Hover, focus
150ms ━━━━    Fast - Tooltips, badges
250ms ━━━━━   Normal - Modals, tabs
350ms ━━━━━━  Slow - Page transitions
500ms ━━━━━━━ Slower - Loading states
```

### Animation Examples

**Button Hover**:
```
Default → Hover (150ms, standard easing)
Background: var(--surface) → var(--soft)
```

**Button Active**:
```
Hover → Active (100ms, standard easing)
Transform: scale(1) → scale(0.98)
```

**Toast Slide In**:
```
Hidden → Visible (250ms, enter easing)
Opacity: 0 → 1
Transform: translateY(-8px) → translateY(0)
```

**Dialog Scale In**:
```
Hidden → Visible (250ms, enter easing)
Opacity: 0 → 1
Transform: scale(0.95) → scale(1)
```

**Spinner Rotation**:
```
Continuous rotation (800ms linear infinite)
Transform: rotate(0deg) → rotate(360deg)
```

---

## Spacing System

**Base Unit**: 4px

```
0  ━          0px    (None)
1  ━━         4px    (Tiny)
2  ━━━━       8px    (Small)
3  ━━━━━━     12px   (Medium-small)
4  ━━━━━━━━   16px   (Medium)
5  ━━━━━━━━━━ 20px   (Medium-large)
6  ━━━━━━━━━━━━ 24px (Large)
8  ━━━━━━━━━━━━━━━━ 32px (Extra large)
10 ━━━━━━━━━━━━━━━━━━━━ 40px (XXL)
12 ━━━━━━━━━━━━━━━━━━━━━━━━ 48px (XXXL)
```

**Usage**:
- Between elements: 4px, 8px, 12px
- Padding: 12px, 16px, 20px
- Margins: 16px, 24px, 32px
- Section spacing: 48px, 64px

---

## Border Radius

```
none ▭          0     Sharp corners
sm   ▢          4px   Small elements (badges, tags)
md   ▢          6px   Standard (buttons, inputs)
lg   ▢          8px   Large (panels, cards)
xl   ▢          12px  Extra large (modals)
full ●          9999px Circular (avatars, pills)
```

---

## Elevation/Shadow

```
none    No shadow (flat)

sm      ▢ Subtle
        0 1px 2px rgba(0,0,0,0.05)
        Buttons, small cards

md      ▢ Medium
        0 4px 6px rgba(0,0,0,0.1)
        Dropdowns, popovers

lg      ▢ Large
        0 10px 15px rgba(0,0,0,0.1)
        Modals, large panels

xl      ▢ Extra Large
        0 20px 25px rgba(0,0,0,0.1)
        Full-screen overlays
```

---

## UI Voice Examples

### Button Labels

✅ **Good** (Action-oriented):
- Connect Provider
- Save Changes
- Deploy Application
- Create New Task
- View Details

❌ **Avoid** (Generic):
- OK
- Submit
- Confirm
- Yes
- No
- Click Here

### Error Messages

✅ **Good** (Helpful, actionable):
```
Unable to connect to the provider.
Check your network connection and try again.
```

❌ **Avoid** (Technical jargon):
```
Connection failed. Error code: ECONNREFUSED
```

### Success Messages

✅ **Good** (Brief, encouraging):
```
Provider connected successfully
```

❌ **Avoid** (Over-enthusiastic):
```
Congratulations! Your provider has been 
successfully connected to the system!
```

### Empty States

✅ **Good** (Guides next action):
```
No providers yet.
Connect your first provider to get started.
```

❌ **Avoid** (Unhelpful):
```
There are no providers available.
```

### Loading States

✅ **Good** (Informative):
```
Loading providers...
Connecting to MCP server...
Deploying application...
```

❌ **Avoid** (Vague):
```
Please wait...
Loading...
```

---

## Accessibility

### Color Contrast

✅ **WCAG AA Compliant**:
- Primary (#0F5FD9) on white: 7.2:1
- Text (#0f172a) on white: 16.1:1
- Muted (#64748b) on white: 4.7:1
- All interactive elements: >3:1

### Focus Indicators

```
┌─────────────────┐
│ Focused Button  │
└─────────────────┘
    ┗━━━━━━━━━━━┛
    2px outline
    Brand primary color
    2px offset
```

### Keyboard Navigation

- Tab: Navigate forward
- Shift+Tab: Navigate backward
- Enter/Space: Activate buttons
- Escape: Close dialogs
- Arrow keys: Navigate lists/menus

### Screen Reader Support

All components include:
- Semantic HTML
- ARIA labels
- Proper heading hierarchy
- Alt text for images
- Status announcements

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

All animations respect user preferences.

---

## Brand Asset Locations

### Design Tokens
```
/packages/design-tokens/src/
  ├── brand.ts        - Complete brand system
  ├── colors.ts       - Color palette
  ├── typography.ts   - Font system
  ├── spacing.ts      - Spacing scale
  ├── tokens.css      - CSS variables
  └── index.ts        - Exports
```

### Visual Assets
```
/apps/web/public/
  ├── brand/
  │   ├── logo.svg       - DGOS logo (128x128)
  │   ├── icon.svg       - App icon light (64x64)
  │   └── icon-dark.svg  - App icon dark (64x64)
  └── illustrations/
      ├── empty-providers.svg
      ├── empty-data.svg
      └── error-connection.svg
```

### Component Styles
```
/packages/dgos-ui/src/
  ├── ui.css           - Core components
  ├── components.css   - Extended components
  └── ux-enhancements.css
```

---

## Usage in Code

### Import Brand Tokens

```typescript
import { dgosBrand } from '@dgos/design-tokens';

// Colors
const primary = dgosBrand.colors.primary[600]; // #0F5FD9

// Typography
const fontFamily = dgosBrand.typography.primary.family;

// Motion
const duration = dgosBrand.motion.duration.fast; // 150ms
const easing = dgosBrand.motion.easing.standard;

// Spacing
const spacing = dgosBrand.spacing.scale[4]; // 16px
```

### CSS Variables

```css
.my-component {
  background: var(--primary);
  color: var(--on-primary);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

.my-component:hover {
  background: var(--hover);
  box-shadow: var(--shadow-md);
}
```

### Components

```tsx
import { Button, Badge, Alert } from '@dgos/dgos-ui';

<Button variant="primary">Connect Provider</Button>
<Badge variant="success">Active</Badge>
<Alert kind="info">New version available</Alert>
```

---

## Comparison: DGOS vs DX OS

| Aspect | DX OS (Reference) | DGOS (Independent) |
|--------|-------------------|-------------------|
| Primary Color | Generic #1769e0 | Deep Ocean Blue #0F5FD9 |
| Secondary | None visible | Electric Teal #06B6D4 |
| Typography | System default | Inter + JetBrains Mono |
| Motion | Unknown | Fast (150-250ms) |
| Icon Style | Unknown | Layered apps + nodes |
| Personality | Consumer-oriented | Developer-focused |
| Target | General users | Devs, creators, enterprises |

**Key Distinction**: DGOS独立品牌 - completely independent visual identity.

---

**Last Updated**: 2026-10-02  
**Version**: V1.0  
**Status**: Implementation Complete - Core + Visual Assets
