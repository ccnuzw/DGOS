# DGOS Icon System - Quick Reference

## 📍 Key File Locations

### Icon Assets
```
apps/web/public/icons/
├── apps/           # 9 application icons (48x48px)
├── system/         # 4 system icons (48x48px)
├── statusbar/      # 8 status bar icons (24x24px)
└── dark/           # 13 dark mode variants
```

### React Components
```
packages/dgos-ui/src/
├── icons.tsx          # Main icon components
├── icons.css          # Icon styling
├── icon-examples.tsx  # Usage examples
└── index.tsx          # Package exports
```

### Documentation
```
.herdr/
├── MACOS-ICONS-GUIDE.md      # Complete guide (365 lines)
├── ICON-USAGE-EXAMPLES.md    # Quick start
└── ICON-SUMMARY.md           # Implementation details

ICON-DELIVERY-REPORT.md       # Project deliverables
```

## 🚀 Quick Start

### Import
```tsx
import { MacOSIcon, DockIcon, StatusBarIcon } from '@dgos/ui';
```

### Basic Usage
```tsx
<MacOSIcon name="system-info" category="apps" size={48} />
<DockIcon name="catalog" />
<StatusBarIcon name="notifications" />
```

### Theme-Aware
```tsx
const { theme } = useTheme();
<MacOSIcon name="assistant" variant={theme} size={48} />
```

## 📋 Icon Names

### Apps (category="apps")
- `system-info` - Blue info symbol
- `catalog` - Purple grid
- `developer-center` - Green code brackets
- `settings` - Gray gear
- `providers` - Cyan cloud
- `models` - Purple cube
- `extensions` - Amber puzzle
- `assistant` - Gold sparkle
- `tasks` - Pink chart

### System (category="system")
- `dgos-logo` - DGOS branding
- `downloads` - Download folder
- `trash` - Empty trash
- `trash-full` - Full trash

### Status Bar (category="statusbar")
- `search`, `notifications`, `settings`, `user`
- `clock`, `wifi`, `battery`, `volume`

## 🎨 Design Specs

- **Base Size**: 48x48px (apps), 24x24px (statusbar)
- **Border Radius**: 10px
- **Format**: SVG (scalable)
- **Total Size**: 136KB (34 files)
- **Brand Colors**: DGOS palette (#0F5FD9, #06B6D4, etc.)

## 📖 Full Documentation

Read complete guides:
- Design principles: `.herdr/MACOS-ICONS-GUIDE.md`
- Usage examples: `.herdr/ICON-USAGE-EXAMPLES.md`
- Project summary: `ICON-DELIVERY-REPORT.md`

## ✅ Status

**Production Ready** - All 34 icons created with components and documentation.
