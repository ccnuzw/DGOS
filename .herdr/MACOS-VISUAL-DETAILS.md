# macOS Visual Details Reference

**Complete visual specification for DGOS V1 macOS-style interface**

## Glassmorphism Recipes

### System Bar (Top)

**Light Mode**
```css
background: linear-gradient(
  to bottom,
  rgba(255, 255, 255, 0.85) 0%,
  rgba(255, 255, 255, 0.75) 100%
);
backdrop-filter: blur(40px) saturate(180%) brightness(1.05);
-webkit-backdrop-filter: blur(40px) saturate(180%) brightness(1.05);
border-bottom: 1px solid rgba(0, 0, 0, 0.08);
box-shadow:
  inset 0 -1px 0 0 rgba(0, 0, 0, 0.04),
  0 1px 3px rgba(0, 0, 0, 0.02);
```

**Dark Mode**
```css
background: linear-gradient(
  to bottom,
  rgba(30, 30, 30, 0.9) 0%,
  rgba(25, 25, 25, 0.85) 100%
);
backdrop-filter: blur(40px) saturate(180%) brightness(0.85);
-webkit-backdrop-filter: blur(40px) saturate(180%) brightness(0.85);
border-bottom: 1px solid rgba(255, 255, 255, 0.08);
box-shadow:
  inset 0 -1px 0 0 rgba(255, 255, 255, 0.03),
  0 1px 3px rgba(0, 0, 0, 0.15);
```

### Dock (Bottom)

**Light Mode**
```css
background: linear-gradient(
  to bottom,
  rgba(255, 255, 255, 0.4) 0%,
  rgba(255, 255, 255, 0.3) 50%,
  rgba(255, 255, 255, 0.25) 100%
);
backdrop-filter: blur(60px) saturate(200%) brightness(1.1);
-webkit-backdrop-filter: blur(60px) saturate(200%) brightness(1.1);
border: 1px solid rgba(255, 255, 255, 0.3);
border-radius: 24px;
box-shadow:
  0 0 0 1px rgba(0, 0, 0, 0.04) inset,
  0 20px 40px rgba(0, 0, 0, 0.15),
  0 8px 16px rgba(0, 0, 0, 0.1);
```

**Dark Mode**
```css
background: linear-gradient(
  to bottom,
  rgba(50, 50, 50, 0.5) 0%,
  rgba(40, 40, 40, 0.4) 50%,
  rgba(35, 35, 35, 0.35) 100%
);
backdrop-filter: blur(60px) saturate(200%) brightness(0.9);
-webkit-backdrop-filter: blur(60px) saturate(200%) brightness(0.9);
border: 1px solid rgba(255, 255, 255, 0.1);
box-shadow:
  0 0 0 1px rgba(255, 255, 255, 0.05) inset,
  0 20px 40px rgba(0, 0, 0, 0.5),
  0 8px 16px rgba(0, 0, 0, 0.3);
```

### Windows

**Light Mode - Focused**
```css
background: rgba(255, 255, 255, 0.95);
backdrop-filter: blur(30px) saturate(150%);
-webkit-backdrop-filter: blur(30px) saturate(150%);
border: 1px solid rgba(0, 0, 0, 0.08);
box-shadow:
  0 0 0 1px rgba(255, 255, 255, 0.5) inset,
  0 30px 80px rgba(0, 0, 0, 0.3),
  0 12px 35px rgba(0, 0, 0, 0.18);
```

**Light Mode - Unfocused**
```css
opacity: 0.95;
box-shadow:
  0 0 0 1px rgba(255, 255, 255, 0.3) inset,
  0 15px 40px rgba(0, 0, 0, 0.15),
  0 5px 15px rgba(0, 0, 0, 0.1);
```

**Dark Mode - Focused**
```css
background: rgba(40, 40, 40, 0.95);
backdrop-filter: blur(30px) saturate(150%);
-webkit-backdrop-filter: blur(30px) saturate(150%);
border: 1px solid rgba(255, 255, 255, 0.08);
box-shadow:
  0 0 0 1px rgba(255, 255, 255, 0.05) inset,
  0 30px 80px rgba(0, 0, 0, 0.5),
  0 12px 35px rgba(0, 0, 0, 0.3);
```

### Launchpad Backdrop

**Light Mode**
```css
background: rgba(0, 0, 0, 0.35);
backdrop-filter: blur(40px) brightness(0.9);
-webkit-backdrop-filter: blur(40px) brightness(0.9);
```

**Dark Mode**
```css
background: rgba(0, 0, 0, 0.5);
backdrop-filter: blur(40px) brightness(0.7);
-webkit-backdrop-filter: blur(40px) brightness(0.7);
```

## Shadow Systems

### Light Shadows (Subtle Depth)
```css
/* Minimal elevation */
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);

/* Text shadow */
text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
```

### Medium Shadows (Standard Elevation)
```css
/* Dock icons */
box-shadow:
  0 2px 8px rgba(0, 0, 0, 0.15),
  0 1px 3px rgba(0, 0, 0, 0.1),
  inset 0 1px 0 rgba(255, 255, 255, 0.2);

/* Launchpad icons */
box-shadow:
  0 4px 12px rgba(0, 0, 0, 0.25),
  0 2px 6px rgba(0, 0, 0, 0.15),
  inset 0 1px 0 rgba(255, 255, 255, 0.2);
```

### Deep Shadows (High Elevation)
```css
/* Focused window */
box-shadow:
  0 0 0 1px rgba(255, 255, 255, 0.5) inset,
  0 30px 80px rgba(0, 0, 0, 0.3),
  0 12px 35px rgba(0, 0, 0, 0.18);

/* Dock container */
box-shadow:
  0 0 0 1px rgba(0, 0, 0, 0.04) inset,
  0 20px 40px rgba(0, 0, 0, 0.15),
  0 8px 16px rgba(0, 0, 0, 0.1);
```

### Badge Shadows
```css
box-shadow:
  0 2px 6px rgba(0, 0, 0, 0.3),
  inset 0 1px 0 rgba(255, 255, 255, 0.2);
```

## Traffic Light Button Specifications

### Dimensions
- **Diameter**: 12px
- **Spacing**: 8px gap between buttons
- **Position**: 12px from left, vertically centered in title bar

### Red Button (Close)
```css
background: linear-gradient(
  135deg,
  #FF6159 0%,
  #FF5F56 50%,
  #ED5450 100%
);
box-shadow:
  0 1px 2px rgba(0, 0, 0, 0.15),
  inset 0 1px 0 rgba(255, 255, 255, 0.3);
```
**Symbol**: × (Unicode: U+00D7)
- **Color**: #8C0000
- **Font size**: 13px
- **Font weight**: 700

### Yellow Button (Minimize)
```css
background: linear-gradient(
  135deg,
  #FFC02F 0%,
  #FFBD2E 50%,
  #E5A617 100%
);
box-shadow:
  0 1px 2px rgba(0, 0, 0, 0.15),
  inset 0 1px 0 rgba(255, 255, 255, 0.3);
```
**Symbol**: − (Unicode: U+2212)
- **Color**: #A15E00
- **Font size**: 11px
- **Font weight**: 700

### Green Button (Maximize)
```css
background: linear-gradient(
  135deg,
  #2DCC40 0%,
  #27C93F 50%,
  #1FB334 100%
);
box-shadow:
  0 1px 2px rgba(0, 0, 0, 0.15),
  inset 0 1px 0 rgba(255, 255, 255, 0.3);
```
**Symbol**: ⤢ (Unicode: U+2922)
- **Color**: #006600
- **Font size**: 9px
- **Font weight**: 700

### Button States

**Default (Window Unfocused)**
```css
background: #d4d4d8;
box-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
```
- Symbols hidden (opacity: 0)

**Hover**
```css
filter: brightness(0.95);
transform: scale(1.05);
```
- Symbols visible (opacity: 1)
- Transition: 150ms

**Active**
```css
filter: brightness(0.85);
transform: scale(0.98);
```

## Color Palette

### App Icon Gradients

**Catalog** (Blue)
```css
linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)
```

**Assistant** (Orange/Yellow)
```css
linear-gradient(135deg, #F59E0B 0%, #D97706 100%)
```

**Tasks** (Green)
```css
linear-gradient(135deg, #10B981 0%, #059669 100%)
```

**Settings** (Purple)
```css
linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)
```

**Providers** (Pink)
```css
linear-gradient(135deg, #EC4899 0%, #DB2777 100%)
```

**Models** (Cyan)
```css
linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)
```

**Skills** (Orange)
```css
linear-gradient(135deg, #F97316 0%, #EA580C 100%)
```

**MCP** (Indigo)
```css
linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)
```

**Developer** (Teal)
```css
linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)
```

### Badge Colors
```css
background: linear-gradient(135deg, #FF4747 0%, #FF3838 100%);
border: 2px solid rgba(255, 255, 255, 0.9);
```

### Running Indicator

**Light Mode**
```css
background: rgba(0, 0, 0, 0.5);
box-shadow:
  0 0 4px rgba(0, 0, 0, 0.3),
  inset 0 1px 0 rgba(255, 255, 255, 0.2);
```

**Dark Mode**
```css
background: rgba(255, 255, 255, 0.8);
box-shadow: 0 0 4px rgba(255, 255, 255, 0.4);
```

## Spacing System

### System Bar
- **Height**: 44px
- **Horizontal padding**: 16px
- **Icon button size**: 32px
- **Icon button gap**: 12px

### Dock
- **Bottom offset**: 8px
- **Padding**: 10px 16px
- **Icon size**: 48px
- **Icon gap**: 8px
- **Border radius**: 24px
- **Divider**: 2px × 40px

### Windows
- **Title bar height**: 32px
- **Border radius**: 12px
- **Minimum size**: 400px × 300px
- **Traffic light offset**: 12px from left

### Launchpad
- **Padding**: 60px 40px
- **Grid gap**: 32px (both axes)
- **Icon size**: 64px
- **Icon border radius**: 14px

## Border Radii

```css
/* System elements */
--system-bar-button: 6px;
--dock-container: 24px;
--dock-icon: 12px;
--window: 12px;
--launchpad-icon: 14px;

/* Small elements */
--badge: 9px;
--indicator: 50% (circle);
--traffic-light: 50% (circle);

/* Interactive elements */
--button: 6px;
--focus-outline: 8px;
```

## Opacity Levels

```css
/* Full visibility */
--opaque: 1.0;
--high-vibrancy: 0.95;
--vibrancy: 0.9;

/* Glassmorphism */
--glass-strong: 0.85;
--glass-medium: 0.75;
--glass-light: 0.4-0.25;

/* Overlays */
--overlay-dark: 0.5;
--overlay-medium: 0.35;
--overlay-light: 0.2;

/* Highlights */
--highlight-strong: 0.3;
--highlight-medium: 0.2;
--highlight-subtle: 0.1;

/* Disabled/Unfocused */
--unfocused: 0.95;
```

## Animation Timing

### Easing Curves

**Smooth (Default)**
```css
cubic-bezier(0.4, 0, 0.2, 1)
```
- General transitions
- Window movements
- Opacity changes

**Spring (Playful)**
```css
cubic-bezier(0.34, 1.56, 0.64, 1)
```
- Icon bounces
- Launchpad entry
- Dock magnification

**Ease Out (Exit)**
```css
cubic-bezier(0.4, 0, 1, 1)
```
- Closing animations
- Fade outs

### Duration Guidelines

```css
/* Ultra fast */
--instant: 0.01ms; /* Reduced motion */
--micro: 100ms; /* Hover feedback */

/* Fast */
--quick: 150ms; /* Button press */
--short: 200ms; /* Dock movement */

/* Standard */
--medium: 250ms; /* Dock magnification */
--normal: 300ms; /* Launchpad open/close */

/* Slow */
--long: 400ms; /* Icon entrance */
--extended: 600ms; /* Bounce animation */
```

## Z-Index Layers

```css
--desktop: 0;
--windows: 10-100; /* Dynamic based on focus */
--dock: 100;
--launchpad: 500;
--system-bar: 1000;
--tooltips: 1100;
--modals: 2000;
```

## Scrollbar Styling

### Dimensions
- **Width/Height**: 10px
- **Border**: 2px transparent (with background-clip)
- **Border radius**: 10px

### Colors

**Light Mode**
```css
--scrollbar-default: rgba(0, 0, 0, 0.2);
--scrollbar-hover: rgba(0, 0, 0, 0.3);
--scrollbar-active: rgba(0, 0, 0, 0.4);
```

**Dark Mode**
```css
--scrollbar-default: rgba(255, 255, 255, 0.2);
--scrollbar-hover: rgba(255, 255, 255, 0.3);
--scrollbar-active: rgba(255, 255, 255, 0.4);
```

## Typography

### Font Smoothing
```css
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
text-rendering: optimizeLegibility;
```

### System Bar
- **App name**: 14px, 600 weight
- **Time**: 13px, 500 weight, tabular-nums

### Window Title Bar
- **Title**: 14px, 600 weight, centered

### Launchpad
- **Icon label**: 12px, white, text-shadow, line-height 1.3

### Badge
- **Count**: 11px, 600 weight, white

## Hover States

### System Bar Buttons
```css
background: rgba(0, 0, 0, 0.05); /* Light */
background: rgba(255, 255, 255, 0.08); /* Dark */
```

### Dock Icons
- Programmatic scale: 1.0 → 1.5
- TranslateY: 0 → -8px (at peak)

### Launchpad Items
```css
background: rgba(255, 255, 255, 0.12);
transform: scale(1.02);
```

## Active States

### Buttons
```css
transform: scale(0.96);
filter: brightness(0.95);
```

### Launchpad Icons
```css
transform: scale(0.95);
background: rgba(255, 255, 255, 0.08);
```

## Focus Indicators

```css
outline: 3px solid var(--primary);
outline-offset: 2px;
border-radius: 8px;
```

Applied to:
- System bar buttons
- Dock items
- Traffic lights
- Launchpad items
- Logo button

## Performance Optimizations

### GPU Acceleration
```css
will-change: transform;
transform: translate3d(0, 0, 0);
```

### Recommended Properties for Animation
- ✅ `transform` (scale, translate, rotate)
- ✅ `opacity`
- ⚠️ `filter` (use sparingly)
- ❌ `left`, `top`, `width`, `height` (avoid)

## Accessibility

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Touch Targets (Mobile/Tablet)
```css
@media (hover: none) and (pointer: coarse) {
  /* Minimum 44x44px touch targets */
  --min-touch-target: 44px;
  --comfortable-touch-target: 56px;
}
```

## Browser Prefixes

Always include for backdrop-filter:
```css
backdrop-filter: blur(40px);
-webkit-backdrop-filter: blur(40px);
```

## Icon SVG Template

```svg
<svg width="48" height="48" viewBox="0 0 48 48" fill="none">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#COLOR1" />
      <stop offset="100%" stopColor="#COLOR2" />
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
    </filter>
    <linearGradient id="highlight" gradientTransform="rotate(135 24 24)">
      <stop offset="0" stopColor="white" stopOpacity="0.3"/>
      <stop offset="1" stopColor="white" stopOpacity="0"/>
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect x="4" y="4" width="40" height="40" rx="10" 
        fill="url(#grad)" filter="url(#shadow)" />
  
  <!-- Highlight overlay -->
  <rect x="4" y="4" width="40" height="40" rx="10" 
        fill="url(#highlight)" fillOpacity="0.3"/>
  
  <!-- Icon content (white, opacity 0.9) -->
</svg>
```

This comprehensive reference ensures consistent, pixel-perfect implementation across all macOS UI components.
