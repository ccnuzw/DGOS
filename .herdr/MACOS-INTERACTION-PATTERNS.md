# macOS Interaction Patterns Guide

**Complete interaction specification for DGOS V1 macOS-style interface**

## Overview

This document describes all interaction patterns, animations, and user feedback mechanisms in the DGOS macOS interface. Every interaction is designed to match native macOS behavior for familiarity and polish.

## System Bar Interactions

### Logo Button

**States**
- **Default**: Transparent background
- **Hover**: `rgba(0, 0, 0, 0.05)` background fade-in (150ms)
- **Active**: Scale 0.96, darker background
- **Focus**: 3px outline

**Behavior**
- Click: Opens launchpad
- Accessible via keyboard (Tab navigation)

### Icon Buttons (Search, Notifications, Settings)

**States**
- **Default**: 32×32px, transparent
- **Hover**: Background fade-in (150ms)
- **Active**: Scale 0.96 with transition
- **Focus**: 3px outline, 2px offset

**Feedback**
- Immediate visual response on hover
- Subtle scale-down on click
- Smooth cubic-bezier transitions

### Clock Display

**Behavior**
- Updates every second
- Only re-renders when minute changes
- Format: HH:MM (24-hour)
- Tabular numerals for alignment
- No interaction (display only)

## Dock Interactions

### Advanced Magnification

**Algorithm**
```javascript
function calculateIconScale(mouseX, iconCenter, maxScale = 1.5) {
  const distance = Math.abs(mouseX - iconCenter);
  const influenceRange = 100; // pixels
  
  if (distance > influenceRange) return 1;
  
  const normalizedDistance = distance / influenceRange;
  const scale = 1 + (maxScale - 1) * Math.cos(normalizedDistance * Math.PI / 2);
  
  return scale;
}
```

**Behavior**
- **Influence Range**: 100px radius from each icon
- **Max Scale**: 1.5× (50% larger)
- **Vertical Translation**: Scale factor × 8px upward
- **Z-Index**: Dynamic (scale × 10) for proper layering
- **Transition**: 200ms spring easing
- **Mouse Leave**: All icons return to normal (200ms)

**Visual Feedback**
- Smooth, continuous magnification
- Icons closer to mouse are larger
- Natural falloff curve (cosine)
- Proper depth ordering (z-index)

### Icon Click

**Single Click**
- **Primary Action**: Launch or focus app
- **Visual Feedback**: None (launches immediately)
- **Future**: Could add bounce animation

**Double Click**
- Not used (single click is sufficient)

**Right Click (Context Menu)**
- Prevents default
- Shows context menu (future implementation)
- Options: Open, Show in Finder, Quit, etc.

### Running Indicator

**Appearance**
- **Size**: 4×4px circle
- **Position**: 6px below icon, centered
- **Color**: `rgba(0, 0, 0, 0.5)` light / `rgba(255, 255, 255, 0.8)` dark
- **Shadow**: Glow effect
- **Animation**: Fade in/out (200ms)

**Behavior**
- Appears when app is running
- Persists while app is open
- Smooth opacity transition

### Badge Notifications

**Appearance**
- **Minimum Size**: 18×18px
- **Position**: Top-right corner (-4px offset)
- **Background**: Red gradient with white border
- **Text**: White, 11px, bold
- **Max Display**: "99+" for numbers over 99

**Behavior**
- Always visible when count > 0
- Updates in real-time
- No animation on number change

### Divider

**Appearance**
- **Size**: 2×40px
- **Color**: Semi-transparent
- **Position**: Between apps and system items

**Purpose**
- Visual separation of app icons from system icons
- Matches native macOS dock

## Window Interactions

### Title Bar Dragging

**Trigger**
- Mouse down on title bar (excluding traffic lights)
- Drag anywhere on title bar

**Behavior**
1. **Drag Start**
   - Records initial mouse position
   - Sets `isDragging` state
   - Brings window to front (updates z-index)

2. **During Drag**
   - Updates window position in real-time
   - Prevents dragging above system bar (min Y: 44px)
   - No snap zones (could be added)

3. **Drag End**
   - Commits final position
   - Releases mouse capture

**Visual Feedback**
- Cursor changes to move cursor
- No transition during drag (instant updates)
- Smooth transition on release (200ms)

**Double-Click Title Bar**
- Toggles maximize/restore
- Native macOS behavior

### Traffic Light Buttons

**Hover Behavior**
- **Container Hover**: All buttons show symbols (opacity 0 → 1)
- **Individual Hover**: Button scales 1.05×, brightness 0.95
- **Transition**: 150ms smooth

**Click Behavior**
- **Active State**: Scale 0.98, brightness 0.85
- **Close (Red)**: Closes window
- **Minimize (Yellow)**: Minimizes to dock
- **Maximize (Green)**: Toggles full screen

**Symbol Appearance**
- Only visible on hover
- Different colors per button
- Proper font sizing

**Unfocused State**
- Gray background (#d4d4d8)
- No symbols visible
- Reduced shadow

### Window Resizing

**Resize Handles**
- **Edges**: 8px wide/tall
- **Corners**: 12×12px
- **Cursors**: 
  - N/S: ns-resize
  - E/W: ew-resize
  - NE/SW: ne-resize/sw-resize
  - NW/SE: nw-resize/se-resize

**Resize Behavior**
1. **Start**: Mouse down on handle
2. **During**: 
   - Real-time size/position updates
   - Respects min-width/min-height
   - Smooth calculations
3. **End**: Commits final bounds

**Constraints**
- **Min Width**: 400px (configurable)
- **Min Height**: 300px (configurable)
- **Max**: Screen boundaries

**Visual Feedback**
- Cursor changes on hover
- Instant resize during drag
- No resize transition

### Window Focus

**Click to Focus**
- Click anywhere on window
- Brings to front
- Updates z-index
- Changes shadow depth

**Visual Changes**
- **Focused**: 
  - Full opacity (1.0)
  - Deeper shadows
  - Colored traffic lights
- **Unfocused**: 
  - Slight opacity (0.95)
  - Lighter shadows
  - Gray traffic lights

### Maximize State

**Behavior**
- Fills screen below system bar
- Full viewport width
- Height: 100vh - 44px
- Removes border radius
- Removes shadows
- Disables resize handles

**Toggle**
- Green button click
- Title bar double-click
- Keyboard shortcut (future)

## Launchpad Interactions

### Opening

**Triggers**
- Logo button click
- Search button click
- F4 key press
- Cmd/Ctrl + K shortcut

**Animation**
1. Backdrop fades in (opacity 0 → 1)
2. Backdrop blur animates (0px → 40px)
3. Icons appear with stagger effect
4. Duration: 300ms

**Stagger Effect**
- Each icon delays by 20ms
- Scale from 0.3 with Y translation
- Spring easing for playful feel
- Up to 15+ items supported

### Closing

**Triggers**
- Click outside icons (backdrop click)
- Escape key press
- F4 key press (toggle)
- Clicking an app icon

**Animation**
1. Icons fade out (no stagger)
2. Backdrop blur reduces
3. Backdrop fades out
4. Duration: 250ms

### Icon Interactions

**Hover**
- Background: `rgba(255, 255, 255, 0.12)`
- Scale: 1.02×
- Transition: 150ms

**Active (Click)**
- Scale: 0.95×
- Background: `rgba(255, 255, 255, 0.08)`
- Launches app immediately
- Closes launchpad

**Focus (Keyboard)**
- 3px outline
- Keyboard navigation support

### Keyboard Navigation

**Arrow Keys**
- **Right**: Next icon
- **Left**: Previous icon
- **Down**: +7 icons (grid column count)
- **Up**: -7 icons
- **Home**: First icon
- **End**: Last icon

**Action Keys**
- **Enter**: Launch selected app
- **Space**: Launch selected app
- **Escape**: Close launchpad

**Focus Management**
- First icon auto-focused on open
- Visual focus indicator
- Smooth focus transitions

## Micro-Interactions

### Button Press Feedback

**All Buttons**
```css
transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);

/* Hover */
background: rgba(0, 0, 0, 0.05);

/* Active */
transform: scale(0.96);
background: rgba(0, 0, 0, 0.08);
```

**Purpose**
- Immediate tactile feedback
- Confirms interaction
- Professional feel

### Dock Launch Animation (Future)

**Bounce Effect**
```css
@keyframes dock-icon-bounce {
  0% { transform: scale(1) translateY(0); }
  25% { transform: scale(0.95) translateY(-4px); }
  50% { transform: scale(1.05) translateY(-12px); }
  75% { transform: scale(0.98) translateY(-8px); }
  100% { transform: scale(1) translateY(-10px); }
}
```

**Timing**
- Duration: 600ms
- Easing: Spring curve
- Triggered on app launch

### Scrollbar Interactions

**Appearance**
- Overlays content (doesn't take space)
- Only visible during scroll
- Fades out when idle (future)

**Hover**
- Darkens thumb
- Transition: 200ms
- Better grab affordance

**Active (Dragging)**
- Even darker
- Instant feedback

### Menu Dropdown (Future)

**Opening**
```css
@keyframes menu-dropdown {
  from {
    opacity: 0;
    transform: scaleY(0.8) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scaleY(1) translateY(0);
  }
}
```

**Duration**: 250ms
**Origin**: Top center
**Behavior**: Smooth scale and slide

## Animation Timing Reference

### Instant (< 100ms)
- **Use**: Hover feedback, cursor changes
- **Easing**: Linear or ease-out
- **Examples**: Button hover, traffic light hover

### Quick (100-200ms)
- **Use**: State changes, toggles
- **Easing**: `cubic-bezier(0.4, 0, 0.2, 1)`
- **Examples**: Button press, dock movement, focus changes

### Standard (200-400ms)
- **Use**: Overlays, panels, major state changes
- **Easing**: `cubic-bezier(0.4, 0, 0.2, 1)`
- **Examples**: Launchpad open/close, window animations

### Slow (400-600ms)
- **Use**: Playful animations, attention-grabbing
- **Easing**: `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring)
- **Examples**: Icon bounce, launchpad icon entrance

## Touch Device Adaptations

### Hit Area Enlargement

```css
@media (hover: none) and (pointer: coarse) {
  .macos-dock__item {
    min-width: 56px;
    min-height: 56px;
  }
  
  .macos-system-bar__icon-button {
    min-width: 44px;
    min-height: 44px;
  }
  
  .macos-window__traffic-light {
    min-width: 16px;
    min-height: 16px;
  }
}
```

**Purpose**
- Meets touch target minimums (44×44px)
- Improves usability on mobile
- Maintains visual design

### Dock Magnification on Touch

**Behavior**
- Disabled on touch devices
- Icons remain fixed size
- Tap to launch (no hover state)
- Long press for context menu (future)

## Keyboard Shortcuts

### Global
- **⌘K / Ctrl+K**: Open launchpad
- **F4**: Toggle launchpad
- **Escape**: Close overlays

### Window Management (Future)
- **⌘W**: Close window
- **⌘M**: Minimize window
- **⌘F**: Maximize window

### Navigation
- **Tab**: Next control
- **Shift+Tab**: Previous control
- **Enter / Space**: Activate control
- **Arrow Keys**: Grid navigation (launchpad)

## Accessibility Considerations

### Reduced Motion

**Implementation**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Behavior**
- All animations become instant
- Transitions skip to end state
- No loss of functionality
- Respects user preference

### Screen Reader Support

**ARIA Labels**
- All buttons have `aria-label`
- Dock has `role="toolbar"`
- Launchpad has `role="dialog"` with `aria-modal="true"`
- Running indicators have `aria-label="Running"`
- Badge counts announced

**Focus Management**
- Logical tab order
- Visible focus indicators
- Keyboard accessibility throughout

### Focus Indicators

**Style**
```css
:focus-visible {
  outline: 3px solid var(--primary);
  outline-offset: 2px;
  border-radius: 8px;
}
```

**Visibility**
- Only shown on keyboard navigation
- Not shown on mouse clicks
- High contrast for visibility
- Rounded for polish

## Error States & Edge Cases

### Window Dragging
- **Above System Bar**: Constrained to Y ≥ 44px
- **Off Screen**: No constraints (future: could add)
- **While Maximized**: Dragging disabled

### Dock
- **No Apps**: Shows only system items
- **Many Apps**: Scrollable (future) or smaller icons
- **Badge Overflow**: Shows "99+"

### Launchpad
- **No Apps**: Shows empty state (future)
- **Single Page**: No pagination needed
- **Multiple Pages**: Pagination controls (future)

### Window Management
- **All Windows Closed**: Dock remains
- **Many Windows**: Z-index stacking works
- **Minimum Size**: Enforced constraints

## Performance Optimizations

### GPU Acceleration
- `transform: translate3d(0, 0, 0)` on animated elements
- `will-change: transform` on dock items
- Avoids layout thrashing

### Efficient Updates
- Only update scales for visible icons
- Debounce mouse move events (implicit via React)
- Minimize DOM queries with refs

### RequestAnimationFrame
- Use for smooth 60fps animations
- Batch DOM updates
- Coordinate with browser repaint

## User Feedback Mechanisms

### Visual Feedback
- **Hover**: Background change, scale, cursor
- **Active**: Scale down, brightness change
- **Focus**: Outline, highlight
- **Running**: Indicator dot
- **Notifications**: Badge count

### Haptic Feedback (Future)
- Button clicks
- Window snap
- Dock magnification peaks

### Sound Effects (Future)
- App launch
- Window minimize
- Notification
- Trash empty

## Future Enhancements

### Spotlight Search
- Global search overlay (⌘Space)
- Real-time results
- Keyboard navigation
- Launch apps/files

### Context Menus
- Right-click dock icons
- Options: Keep in Dock, Options, Quit
- Native macOS style menu

### Window Snapping
- Drag to edge zones
- Snap to half/quarter screen
- Visual indicators

### Mission Control
- F3 or gesture to show all windows
- Grid layout
- Click to focus

### Notification Center
- Slide-out panel
- Recent notifications
- Quick settings

### Desktop Icons
- File/folder placement
- Grid alignment
- Selection and management

This comprehensive guide ensures consistent, intuitive interactions throughout the DGOS macOS interface.
