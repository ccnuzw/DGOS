# V1 UI Manual Testing Guide

**Created**: 2026-10-02
**Purpose**: Guide for completing manual UI-AC evidence collection
**Prerequisites**: Automated tests complete (6/6 passed)
**Estimated Time**: 8-12 hours total

---

## Overview

This guide provides step-by-step instructions for manual UI testing that cannot be automated. Complete these tests to satisfy all UI-AC requirements for V1 release.

**Testing Environment**:
- macOS with VoiceOver enabled
- Running app: `pnpm --filter @dgos/web dev` OR desktop build
- Clean browser profile (no extensions)
- Network access to real API backend

---

## 1. VoiceOver/Screen Reader Testing (Priority: HIGH)

### Setup
1. **Enable VoiceOver**: Press `⌘ + F5` or go to System Preferences → Accessibility → VoiceOver
2. **Learn basic commands**:
   - `VO + →` : Move to next item
   - `VO + ←` : Move to previous item
   - `VO + Space` : Activate item
   - `VO + A` : Read all
   - `Tab` : Move to next focusable element
   - `Shift + Tab` : Move to previous focusable element

3. **Start screen recording**: `⌘ + Shift + 5` → Record screen with audio
4. **Open app**: Navigate to `http://localhost:15133` in Safari

### Test Cases

#### TC-VO-001: Settings Page Navigation
**Route**: `/settings`

1. Navigate to Settings page
2. Press `VO + A` to read entire page
3. Navigate through each form field with `Tab`
4. Verify each field announces:
   - Field label
   - Field type
   - Current value
   - Instructions (if any)

**Document**:
- [ ] All labels are announced correctly
- [ ] Form fields have descriptive labels
- [ ] Select dropdowns announce current selection
- [ ] Save button is clearly identified
- [ ] Error messages are announced when present

**Issues Found**: _______________________________

#### TC-VO-002: Navigation Menu
**Route**: Any page

1. Press `VO + U` to open rotor
2. Select "Links" and navigate through menu items
3. Verify each navigation link announces destination

**Document**:
- [ ] All navigation items are announced
- [ ] Current page is indicated
- [ ] Link purposes are clear from labels
- [ ] No unnamed links

**Issues Found**: _______________________________

#### TC-VO-003: Task Submission Flow
**Route**: `/ai-tasks` or `/assistant`

1. Navigate to task submission form
2. Tab through all form fields
3. Submit a task
4. Monitor task status updates

**Document**:
- [ ] Form fields have clear labels
- [ ] Submit button is clearly identified
- [ ] Task status changes are announced
- [ ] Success/error messages are announced
- [ ] Loading states are announced

**Issues Found**: _______________________________

#### TC-VO-004: Modal Dialogs
**Route**: Any page with dialogs

1. Trigger a modal dialog (e.g., delete confirmation)
2. Verify focus is trapped in dialog
3. Navigate through dialog controls
4. Close dialog with Escape

**Document**:
- [ ] Dialog title is announced when opened
- [ ] Focus moves to dialog
- [ ] Tab cycles within dialog only
- [ ] All buttons are announced
- [ ] Dialog purpose is clear
- [ ] Escape closes dialog
- [ ] Focus returns to trigger element

**Issues Found**: _______________________________

#### TC-VO-005: Error States
**Route**: Any form

1. Submit a form with invalid data
2. Verify error announcement
3. Navigate to error field

**Document**:
- [ ] Errors are announced immediately
- [ ] Error messages are clear
- [ ] Focus moves to first error field
- [ ] Error fields are clearly identified
- [ ] Instructions for fixing error are provided

**Issues Found**: _______________________________

#### TC-VO-006: Data Tables/Lists
**Route**: `/catalog`, `/developer`, `/models`

1. Navigate to a page with data tables or lists
2. Use `VO + Right Arrow` to navigate through items
3. Verify item structure is clear

**Document**:
- [ ] List/table structure is announced
- [ ] Item count is announced
- [ ] Each item's key information is announced
- [ ] Actions for each item are clear
- [ ] Empty states are announced

**Issues Found**: _______________________________

### VoiceOver Test Report Template

```markdown
## VoiceOver Test Report

**Date**: __________
**Tester**: __________
**VoiceOver Version**: __________
**Browser**: Safari __________
**App Version**: __________

### Summary
- Total test cases: 6
- Passed: ___
- Failed: ___
- Issues found: ___

### Detailed Results

[Copy findings from each TC above]

### Recommendations
[List improvements needed]

### Screen Recording
**File**: `evidence/voiceover-test-session.mov`
**Duration**: __________
**Key timestamps**: __________
```

---

## 2. Real Environment Screenshots (Priority: HIGH)

### Setup
1. **Start real backend**:
   ```bash
   pnpm --filter @dgos/api dev
   # Ensure database is initialized
   ```

2. **Start web app**:
   ```bash
   WEB_BASE_URL=http://127.0.0.1:15133 pnpm --filter @dgos/web dev
   ```

3. **Configure test data**:
   - Register at least 1 Provider
   - Install at least 2 Apps
   - Configure at least 1 Model
   - Set up at least 1 MCP server

### Screenshot Checklist

#### Real Data - System Pages
- [ ] `/system` - System Info with real system context
  - Light EN 100%
  - Dark EN 100%
  - Light ZH 150%
  - Dark ZH 150%

- [ ] `/providers` - Provider Management with real providers
  - Light EN 100% (list view)
  - Dark EN 100% (detail view)

- [ ] `/models` - Model Management with real models
  - Light EN 100%
  - Dark ZH 150%

#### Real Data - Developer Pages
- [ ] `/developer` - Developer Center with real packages
  - Light EN 100% (empty state)
  - Light EN 100% (with packages)
  - Dark EN 100% (package details)

- [ ] `/catalog` - App Catalog with real apps
  - Light EN 100%
  - Dark ZH 150%

#### Real Data - Task Execution
- [ ] `/ai-tasks` or `/assistant` - Task Workbench
  - Light EN 100% (no tasks)
  - Light EN 100% (task queued)
  - Light EN 100% (task running)
  - Light EN 100% (task succeeded)
  - Dark EN 100% (task failed with error)

#### Real Data - Extensions
- [ ] `/mcp` - MCP Management with real connections
  - Light EN 100% (connected)
  - Dark EN 100% (disconnected)

- [ ] `/skills` - Skill Management
  - Light EN 100%

#### Screenshot Naming Convention
```
{page}-real-{theme}-{lang}-{scale}-{state}.png

Examples:
system-real-light-en-100.png
tasks-real-light-en-100-running.png
tasks-real-dark-en-100-failed.png
```

### Capture Commands
```bash
# Use browser dev tools or Playwright
# Example with Playwright:
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:15133/system');
await page.screenshot({ path: 'evidence/ui-r5/system-real-light-en-100.png' });
```

---

## 3. Extended Page Coverage (Priority: MEDIUM)

### Goal
Capture all 15 routes at key scales to demonstrate complete UI implementation.

### Routes to Capture

| Route | Component | Priority | Scales |
|-------|-----------|----------|--------|
| `/desktop` | Desktop | HIGH | 100%, 150% |
| `/catalog` | AppCatalog | HIGH | 100%, 150% |
| `/settings` | Settings | ✅ DONE | All scales |
| `/system` | SystemInfo | HIGH | 100%, 150% |
| `/providers` | ProviderControl | HIGH | 100%, 150% |
| `/models` | ModelManagement | HIGH | 100%, 150% |
| `/protocols` | ProtocolControl | MEDIUM | 100% |
| `/skills` | ExtensionsV1 | MEDIUM | 100% |
| `/mcp` | ExtensionsV1 | HIGH | 100%, 150% |
| `/assistant` | Assistant | HIGH | 100%, 150% |
| `/ai-tasks` | Tasks | HIGH | 100%, 150% |
| `/developer` | DeveloperCenter | HIGH | 100%, 150% |
| `/keys` | KeyControl | MEDIUM | 100% |
| `/governance` | GovernanceControl | MEDIUM | 100% |
| `/usage` | UsageControl | MEDIUM | 100% |

### Matrix for Each Route
- 2 themes (light, dark)
- 2 languages (en, zh)
- 2 scales (100%, 150%)
- **Total per route**: 8 screenshots
- **Total for 14 routes** (excluding settings): 112 screenshots

### Batch Capture Script Template
```javascript
// extended-coverage.spec.mjs
import { test } from '@playwright/test';

const routes = [
  { path: '/desktop', heading: 'Desktop' },
  { path: '/system', heading: 'System Information' },
  // ... add all routes
];

for (const route of routes) {
  test(`Capture ${route.path}`, async ({ page }) => {
    for (const theme of ['light', 'dark']) {
      for (const lang of ['en', 'zh']) {
        for (const scale of [100, 150]) {
          await page.goto(route.path);
          await page.locator('.top-actions select').nth(0).selectOption(theme);
          await page.locator('.top-actions select').nth(1).selectOption(lang);
          await page.locator('.top-actions').getByLabel(lang === 'zh' ? '显示倍率' : 'Display scale').selectOption(String(scale));
          await page.waitForSelector(`h1:has-text("${route.heading}")`);
          await page.locator('.dgos-shell').screenshot({
            path: `evidence/ui-r5/${route.path.slice(1)}-${theme}-${lang}-${scale}.png`
          });
        }
      }
    }
  });
}
```

---

## 4. Desktop UI Screenshots (Priority: MEDIUM)

### Prerequisites
```bash
# Build desktop app
pnpm --filter @dgos/desktop build

# Launch desktop app
pnpm --filter @dgos/desktop start
```

### Screenshots Needed

#### Window States
- [ ] Main window - light theme - normal size
- [ ] Main window - dark theme - maximized
- [ ] Main window - with visible titlebar and controls
- [ ] Main window - with sidebar expanded
- [ ] Main window - with sidebar collapsed

#### Native Integration
- [ ] Dock icon (active state)
- [ ] Dock icon (with notification badge)
- [ ] Menu bar (app menu visible)
- [ ] Window title bar (macOS native controls)
- [ ] System notification

#### Multi-window
- [ ] Two windows side by side
- [ ] Window focus states (active vs inactive)

### Capture Method
- Use macOS Screenshot (`⌘ + Shift + 4`)
- Capture entire window with shadow
- Save to `evidence/desktop-ui/`

---

## 5. Cross-Browser Testing (Priority: LOW)

### Browsers to Test
1. **Chrome/Edge** (Chromium)
2. **Firefox**
3. **Safari**

### Test Matrix
**Routes**: `/settings`, `/system`, `/ai-tasks`, `/developer`
**Per browser**: Light EN 100%, Dark EN 100%

### Test Cases

#### TC-BR-001: Visual Rendering
Compare screenshots across browsers for:
- [ ] Font rendering
- [ ] Color accuracy
- [ ] Layout consistency
- [ ] Button styles
- [ ] Form controls

#### TC-BR-002: Functionality
Test in each browser:
- [ ] Theme switching
- [ ] Language switching
- [ ] Scale changes
- [ ] Form submission
- [ ] Navigation
- [ ] Dialogs

#### TC-BR-003: Performance
Measure in each browser:
- [ ] Initial load time
- [ ] Time to interactive
- [ ] Navigation speed
- [ ] Form responsiveness

### Browser Test Report Template
```markdown
## Browser Compatibility Report

| Feature | Chrome | Firefox | Safari | Notes |
|---------|--------|---------|--------|-------|
| Theme switching | ✅ | ✅ | ✅ | |
| Form controls | ✅ | ⚠️ | ✅ | Firefox: dropdown styling |
| Layout | ✅ | ✅ | ✅ | |
| Performance | Excellent | Good | Excellent | |
| Known issues | None | Minor styling | None | |
```

---

## 6. Mobile/Tablet Testing (Priority: LOW)

### Test Devices (or Responsive Mode)
- iPhone 12 Pro (390x844)
- iPad Pro (834x1194)
- Generic tablet (768x1024)

### Test Cases

#### TC-MOB-001: Touch Interactions
- [ ] Tap targets ≥ 44x44 points
- [ ] No hover-only features
- [ ] Swipe gestures work
- [ ] Pinch zoom works
- [ ] No accidental taps

#### TC-MOB-002: Layout
- [ ] No horizontal scroll
- [ ] Content fits viewport
- [ ] Navigation is accessible
- [ ] Forms are usable
- [ ] Text is readable

#### TC-MOB-003: Virtual Keyboard
- [ ] Form fields scroll into view
- [ ] Keyboard doesn't obscure submit button
- [ ] Input type appropriate (email, number, etc.)
- [ ] Keyboard dismisses on submit

---

## 7. High Contrast Mode (Priority: MEDIUM)

### Setup - macOS
1. System Preferences → Accessibility → Display
2. Enable "Increase contrast"
3. Also test with "Invert colors"

### Setup - Windows
1. Settings → Ease of Access → High contrast
2. Select a high contrast theme

### Test Cases

#### TC-HC-001: Text Readability
- [ ] All text is readable
- [ ] Sufficient contrast on all backgrounds
- [ ] No text becomes invisible
- [ ] Icons remain visible

#### TC-HC-002: Borders and Focus
- [ ] All borders are visible
- [ ] Focus indicators are strong
- [ ] Button boundaries are clear
- [ ] Form field boundaries are clear

#### TC-HC-003: Images and Icons
- [ ] Icons adapt to high contrast
- [ ] No information lost
- [ ] Alternative text is available

### Screenshots
Capture each theme (light/dark) with high contrast enabled:
- [ ] `/settings` - high contrast light
- [ ] `/settings` - high contrast dark
- [ ] `/system` - high contrast light
- [ ] `/ai-tasks` - high contrast dark

---

## 8. Evidence Compilation

### Directory Structure
```
apps/web/evidence/
├── ui-r5/                    # Automated screenshots (40 files) ✅
├── ui-real/                  # Real environment screenshots
├── ui-extended/              # Extended page coverage
├── desktop-ui/               # Desktop app screenshots
├── voiceover/               # VoiceOver test recordings
├── high-contrast/           # High contrast screenshots
└── cross-browser/           # Browser comparison screenshots
```

### Create Evidence Index
For each new directory, create an index markdown file documenting:
- File count
- Naming convention
- Coverage matrix
- File hashes
- Test date and environment

### Update Compliance Checklist
Update `.herdr/V1-UI-AC-EVIDENCE-CHECKLIST.md` as tests are completed.

---

## 9. Test Report Generation

### Final Report Structure
```markdown
# V1 UI Manual Testing Complete

## Executive Summary
- Tests completed: X/Y
- Issues found: Z
- Release readiness: [READY/BLOCKED]

## VoiceOver Testing
[Results from Section 1]

## Real Environment Testing
[Results from Section 2]

## Extended Coverage
[Results from Section 3]

## Desktop UI
[Results from Section 4]

## Cross-Browser
[Results from Section 5]

## Mobile/Tablet
[Results from Section 6]

## High Contrast
[Results from Section 7]

## Evidence Files
- Total screenshots: XXX
- Total size: XXX MB
- VoiceOver recordings: XXX
- Test reports: XXX

## Issues Found
1. [Issue description]
   - Severity: HIGH/MEDIUM/LOW
   - Component: [component name]
   - Reproduction: [steps]
   - Recommendation: [fix suggestion]

## Recommendations
[List of improvements]

## Sign-off
- Tester: ___________
- Date: ___________
- Status: ✅ COMPLETE
```

---

## Testing Tips

### General
- Take breaks between test sessions
- Use a checklist to track progress
- Document everything, even small issues
- Take extra screenshots if something looks odd
- Note the timestamp for video evidence

### VoiceOver
- Practice basic commands first
- Use headphones to hear announcements clearly
- Test in Safari (best VoiceOver support)
- Record audio commentary as you test

### Screenshots
- Use consistent viewport sizes
- Clear browser cache between captures
- Wait for animations to complete
- Ensure no personal data in screenshots
- Verify screenshots are not blurry

### Performance
- Close other applications
- Use incognito/private browsing
- Test with fresh profile
- Note any console errors

---

## Checklist Summary

- [ ] VoiceOver testing (6 test cases)
- [ ] Screen reader report written
- [ ] Real environment screenshots (30+ files)
- [ ] Extended page coverage (112+ files)
- [ ] Desktop UI screenshots (10+ files)
- [ ] Cross-browser testing (3 browsers)
- [ ] Mobile/tablet testing
- [ ] High contrast mode testing
- [ ] Evidence compiled and indexed
- [ ] Final report written

**Estimated Total Time**: 8-12 hours
**Recommended**: Complete over 2-3 sessions

---

**Document**: V1-UI-MANUAL-TESTING-GUIDE.md
**Status**: Ready for use
**Next**: Begin with VoiceOver testing (highest priority)
