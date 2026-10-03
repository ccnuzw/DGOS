# DGOS Brand Identity Guidelines

**Version**: V1.0  
**Date**: 2026-10-02  
**Status**: Active  
**Related**: ADR-0004, V1-DESIGN-SYSTEM-VALIDATION.md

---

## Executive Summary

DGOS is an **independent application operating system** with its own distinct brand identity. This document defines the visual and experiential elements that make DGOS recognizable, professional, and aligned with its target audience: developers, creators, and enterprises.

**Key Principle**: DGOS 独立品牌表达，不是 DX OS 的复制。

DX OS serves only as a research reference for window management patterns and extension architecture. DGOS has its own brand colors, typography, motion language, and UI personality.

---

## Brand Positioning

### Identity
- **Name**: DGOS (Developer's General Operating System)
- **Category**: Application Operating System
- **Positioning**: Professional runtime platform for modern applications

### Target Audience
1. **Developers**: Building and deploying AI-powered applications
2. **Creators**: Using AI tools for content, design, and productivity
3. **Enterprises**: Managing scalable AI infrastructure

### Brand Qualities
- **Professional**: Enterprise-grade, reliable, trustworthy
- **Efficient**: Fast, responsive, doesn't waste user time
- **Scalable**: Grows from individual to team to organization
- **Modern**: Contemporary design, current technology
- **Technical**: Honest about complexity, respects expertise

---

## Visual Identity

### 1. Color Palette

#### Primary Brand Color: Deep Ocean Blue
```
Light Mode: #0F5FD9
Dark Mode:  #5B9EFF
```

**Personality**: Depth, reliability, technical precision  
**Usage**: Primary actions, links, focus states, brand moments  
**Distinction**: Deeper and more sophisticated than standard blues, communicates technical expertise

#### Secondary Brand Color: Electric Teal
```
Light Mode: #06B6D4
Dark Mode:  #22D3EE
```

**Personality**: Innovation, efficiency, modernity  
**Usage**: Accents, secondary actions, data visualization, progress indicators  
**Distinction**: Energetic complement to primary, adds dynamism

#### Accent Color: Amber
```
Light Mode: #F59E0B
Dark Mode:  #FBC759
```

**Personality**: Energy, success, warmth  
**Usage**: Success states, highlights, important notifications  
**Distinction**: Warm counterpoint to cool primaries

#### Semantic Colors

| Purpose | Light Mode | Dark Mode | Usage |
|---------|------------|-----------|-------|
| Success | #10b981 | #34d399 | Confirmations, completed tasks |
| Warning | #f59e0b | #fbbf24 | Cautions, important notices |
| Danger  | #ef4444 | #f87171 | Errors, destructive actions |
| Info    | #0ea5e9 | #38bdf8 | Informational messages |

#### Neutral Palette

**Light Mode**:
- Canvas: #f8fafc (slightly cool background)
- Surface: #ffffff (cards, panels)
- Text: #0f172a (high contrast)
- Muted: #64748b (secondary text)
- Border: #e2e8f0 (dividers, outlines)

**Dark Mode**:
- Canvas: #0f172a (deep navy)
- Surface: #1e293b (elevated elements)
- Raised: #334155 (modals, dropdowns)
- Text: #f1f5f9 (high contrast)
- Muted: #94a3b8 (secondary text)
- Border: #334155 (subtle dividers)

### 2. Typography

#### Primary Font: Inter

```css
font-family: Inter, -apple-system, BlinkMacSystemFont, 
             "SF Pro Text", "Segoe UI", "PingFang SC", 
             "Microsoft YaHei", sans-serif;
```

**Characteristics**:
- Modern, clean, highly readable
- Excellent at small sizes (UI text)
- Professional technical aesthetic
- Good internationalization support

**Weights**:
- Regular (400): Body text
- Medium (500): Emphasis, labels
- Semibold (600): Subheadings, button text
- Bold (700): Headings, important actions

#### Code Font: JetBrains Mono

```css
font-family: "JetBrains Mono", ui-monospace, 
             SFMono-Regular, "SF Mono", Menlo, Monaco, 
             "Cascadia Code", Consolas, monospace;
```

**Characteristics**:
- Developer-focused design
- Excellent ligature support
- Clear character distinction
- Optimized for code readability

#### Type Scale

| Size | Value | Usage |
|------|-------|-------|
| xs   | 11px  | Labels, captions, metadata |
| sm   | 12px  | Secondary text, helper text |
| base | 14px  | Body text, UI default |
| md   | 16px  | Emphasized body, form inputs |
| lg   | 18px  | Subheadings |
| xl   | 22px  | Section headings |
| xxl  | 28px  | Page titles |
| xxxl | 36px  | Hero text, landing pages |

### 3. Iconography

#### Style: Outlined with 1.5px stroke

**Characteristics**:
- Clean, technical, professional
- Scales well at all sizes
- Consistent visual weight
- Modern and minimal

**Icon Sizes**:
- xs: 12px (inline text icons)
- sm: 16px (buttons, UI elements)
- md: 20px (navigation, actions)
- lg: 24px (headers, features)
- xl: 32px (empty states)
- xxl: 48px (splash screens, large features)

**Icon Library**: Heroicons v2 (outlined) or custom DGOS icons following same style

### 4. Spacing System

**Base Unit**: 4px

All spacing follows 4px increments for visual consistency:

```
0:  0px
1:  4px
2:  8px
3:  12px
4:  16px
5:  20px
6:  24px
8:  32px
10: 40px
12: 48px
16: 64px
20: 80px
24: 96px
```

**Usage Guidelines**:
- Use consistent spacing throughout the interface
- Prefer tokens over arbitrary values
- Larger spacing creates visual hierarchy

### 5. Border Radius

**Style**: Subtle rounded corners (modern but not playful)

```
none: 0     (dividers, certain borders)
sm:   4px   (badges, tags, small elements)
md:   6px   (buttons, inputs, standard elements)
lg:   8px   (panels, cards, containers)
xl:   12px  (large modals, hero sections)
full: 9999px (pills, avatars, circular elements)
```

### 6. Elevation & Shadow

**Style**: Subtle layering (professional, not dramatic)

```css
none: none
sm:   0 1px 2px 0 rgba(0, 0, 0, 0.05)
md:   0 4px 6px -1px rgba(0, 0, 0, 0.1), 
      0 2px 4px -1px rgba(0, 0, 0, 0.06)
lg:   0 10px 15px -3px rgba(0, 0, 0, 0.1), 
      0 4px 6px -2px rgba(0, 0, 0, 0.05)
xl:   0 20px 25px -5px rgba(0, 0, 0, 0.1), 
      0 10px 10px -5px rgba(0, 0, 0, 0.04)
```

**Usage**:
- sm: Buttons, small cards
- md: Dropdowns, popovers
- lg: Modals, large panels
- xl: Full-screen overlays

---

## Motion Design Language

### Personality: Responsive and Efficient

Motion in DGOS should feel:
- **Immediate**: Fast enough to not block the user
- **Refined**: Smooth transitions, not jarring
- **Purposeful**: Every animation has a reason
- **Respectful**: Honors reduced motion preferences

### Easing Curves

```css
/* Sharp and efficient for exits */
exit: cubic-bezier(0.4, 0, 1, 1)

/* Smooth deceleration for entrances */
enter: cubic-bezier(0, 0, 0.2, 1)

/* Balanced for state changes */
standard: cubic-bezier(0.4, 0, 0.2, 1)

/* Bouncy for emphasis (use sparingly) */
emphasis: cubic-bezier(0.34, 1.56, 0.64, 1)
```

### Duration Guidelines

| Type | Duration | Usage |
|------|----------|-------|
| Instant | 100ms | Immediate feedback (hover, focus) |
| Fast | 150ms | Quick transitions (tooltips, badges) |
| Normal | 250ms | Standard transitions (modals, panels) |
| Slow | 350ms | Complex animations (page transitions) |
| Slower | 500ms+ | Loading states, progress indicators |

### Animation Principles

1. **Micro-interactions**: 100-150ms
   - Button hover states
   - Input focus
   - Toggle switches
   - Checkbox/radio animations

2. **State changes**: 150-250ms
   - Tab switching
   - Accordion expand/collapse
   - Dropdown menus
   - Toast notifications

3. **Page transitions**: 250-350ms
   - Route navigation
   - Modal open/close
   - Sidebar slide in/out
   - Panel expansion

4. **Loading animations**: 500ms+
   - Progress bars
   - Skeleton screens
   - Data loading states
   - Long operations

---

## UI Voice & Tone

### Personality: Professional yet Approachable

**Core Principles**:
1. **Clear and Direct** - Not verbose or flowery
2. **Helpful and Supportive** - Not condescending or robotic
3. **Action-Oriented** - Not passive or vague
4. **Honest** - Not over-promising or hiding limitations

### Button Labels

**✅ Good** (Action verbs):
- Save
- Create
- Delete
- Connect
- Deploy
- Start Task
- View Details

**❌ Avoid** (Generic):
- OK
- Submit
- Confirm
- Yes
- No
- Click Here

### Error Messages

**✅ Good** (Helpful, actionable):
```
Unable to connect to the provider. 
Check your network connection and try again.
```

**❌ Avoid** (Technical jargon):
```
Connection failed. Error code: ECONNREFUSED
```

### Success Messages

**✅ Good** (Brief, encouraging):
```
Provider connected successfully
```

**❌ Avoid** (Over-enthusiastic):
```
Congratulations! Your provider has been successfully 
connected to the system!
```

### Empty States

**✅ Good** (Guides next action):
```
No providers yet. Connect your first provider to get started.
```

**❌ Avoid** (Unhelpful):
```
There are no providers available.
```

### Loading States

**✅ Good** (Informative):
```
Loading providers...
Connecting to MCP server...
Deploying application...
```

**❌ Avoid** (Vague):
```
Please wait...
Loading...
```

---

## Logo & App Icon

### DGOS Application Icon

**Concept**: Abstract geometric representation combining:
- **D** letterform (subtle)
- **Layers** representing applications/operating system
- **Connection** nodes representing AI/MCP integration

**Style**:
- Modern, minimal, geometric
- Uses DGOS brand colors (Deep Ocean Blue + Electric Teal)
- Works at all sizes (16px to 1024px)
- Distinct silhouette for recognition

**Variants**:
- Full color (standard)
- Monochrome (system tray, small sizes)
- Dark mode optimized
- Light mode optimized

### Favicon

**Sizes**: 16x16, 32x32, 48x48  
**Format**: ICO, PNG, SVG  
**Design**: Simplified DGOS icon, optimized for tiny sizes

### Loading Logo Animation

**Duration**: 1.5-2 seconds loop  
**Style**: Subtle fade/pulse or geometric transformation  
**Colors**: Primary brand color with subtle gradient  
**Usage**: App initialization, splash screens

---

## Illustration Style

### Empty States

**Style**:
- Line art illustrations
- Uses brand colors (primary + secondary)
- Simple, clear metaphors
- Not too abstract, not too literal
- Consistent line weight (2px)

**Themes**:
- Empty catalog: Open box or app tiles
- No connections: Disconnected nodes
- No data: Empty chart or document
- Error states: Broken connection or alert symbol

### Feature Highlights

**Style**:
- Screenshot-based with UI elements
- Subtle overlays highlighting features
- Uses brand accent colors for callouts
- Professional, not marketing-heavy

### Onboarding Graphics

**Style**:
- Progressive disclosure
- Clear step-by-step visuals
- Combines UI screenshots with minimal illustrations
- Consistent with overall brand aesthetic

---

## Photography & Imagery Guidelines

### Screenshots

**Style**:
- Clean, focused on feature
- Use actual DGOS UI (not mockups)
- Light and dark mode variants
- Consistent window chrome
- Subtle shadow/border for context

**Technical Specs**:
- Format: PNG with transparency or subtle background
- Resolution: 2x for retina displays
- Max width: 1280px for documentation
- Color profile: sRGB

### Documentation Images

**Style**:
- Clear, annotated when needed
- Arrows and callouts use brand colors
- Consistent styling across all docs
- Alt text for accessibility

### Social Media Templates

**Dimensions**:
- Twitter/X: 1200x675px
- LinkedIn: 1200x627px
- GitHub Social: 1280x640px

**Style**:
- DGOS brand colors and typography
- Logo in consistent position
- Clear hierarchy
- Professional, not promotional

---

## Component Showcase

### Primary Button
```tsx
<Button variant="primary">
  Connect Provider
</Button>
```
- Background: var(--primary)
- Text: var(--on-primary)
- Hover: Slightly darker primary
- Active: Even darker with scale transform
- Focus: 2px outline in focus color

### Secondary Button
```tsx
<Button variant="secondary">
  View Details
</Button>
```
- Background: var(--soft)
- Text: var(--text)
- Border: var(--border)
- Hover: Slightly darker background

### Danger Button
```tsx
<Button variant="danger">
  Delete Provider
</Button>
```
- Background: var(--danger)
- Text: white
- Usage: Destructive actions only

### Alert Messages
```tsx
<Alert kind="info">New version available</Alert>
<Alert kind="success">Settings saved</Alert>
<Alert kind="warning">Connection unstable</Alert>
<Alert kind="error">Failed to connect</Alert>
```

### Status Badges
```tsx
<Badge variant="success">Active</Badge>
<Badge variant="danger">Failed</Badge>
<Badge variant="info">Pending</Badge>
```

---

## Brand Assets Location

### Design Tokens
- **Package**: `@dgos/design-tokens`
- **File**: `/packages/design-tokens/src/brand.ts`
- **CSS Variables**: `/packages/design-tokens/src/tokens.css`

### Logo & Icons
- **Directory**: `/apps/web/public/brand/` (to be created)
- **Formats**: SVG (preferred), PNG (fallback)
- **Variants**: logo, icon, favicon

### Illustrations
- **Directory**: `/apps/web/public/illustrations/` (to be created)
- **Format**: SVG with embedded brand colors
- **Categories**: empty-states, onboarding, features, errors

### Screenshots
- **Directory**: `/apps/web/evidence/` (existing)
- **Naming**: `{feature}-{width}-{theme}-{locale}-{scale}.png`

---

## Implementation Checklist

### ✅ Phase 1: Core Brand (Completed)
- [x] Define brand color palette (Deep Ocean Blue + Electric Teal)
- [x] Select typography system (Inter + JetBrains Mono)
- [x] Create motion design language
- [x] Define spacing and radius systems
- [x] Document UI voice and tone
- [x] Update design tokens package
- [x] Update CSS variables

### 🔄 Phase 2: Visual Assets (In Progress)
- [ ] Design DGOS application icon
- [ ] Create favicon variants
- [ ] Design loading logo animation
- [ ] Create empty state illustrations
- [ ] Create error page illustrations
- [ ] Create onboarding graphics

### 📋 Phase 3: UI Implementation (Next)
- [ ] Update all components with new colors
- [ ] Apply typography to all text elements
- [ ] Implement motion system in transitions
- [ ] Update button styles and variants
- [ ] Refresh alert and badge components
- [ ] Update form components

### 📋 Phase 4: Documentation (Next)
- [ ] Create brand asset library
- [ ] Document component variations
- [ ] Create usage guidelines per component
- [ ] Generate screenshot templates
- [ ] Create social media templates

---

## Maintenance & Governance

### Version Control
- Brand tokens are versioned with `@dgos/design-tokens` package
- Breaking changes require ADR approval
- Visual updates documented in this file

### Design Review
- All new components must follow brand guidelines
- Visual regressions caught by automated testing
- Manual review for brand consistency

### Evolution
- Brand may evolve based on user feedback
- Changes require update to this document
- Major changes require new ADR

---

## References

- **ADR-0004**: V1统一设计系统与跨应用交互契约
- **Package**: `@dgos/design-tokens` - Token implementation
- **Package**: `@dgos/dgos-ui` - Component library
- **Evidence**: `/apps/web/evidence/` - Visual regression tests

---

**Last Updated**: 2026-10-02  
**Version**: V1.0  
**Status**: Active - Core brand defined, assets in progress
