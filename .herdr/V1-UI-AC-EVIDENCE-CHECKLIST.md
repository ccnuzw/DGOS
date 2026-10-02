# V1 UI-AC Evidence Collection Checklist

**Date**: 2026-10-02T14:04:28Z
**Status**: ✅ AUTOMATED EVIDENCE COMPLETE
**Commit**: 65d6f581cf5cb066d56c45d7c434dbe36472fbfd

---

## Evidence Collection Status

### ✅ Completed Tasks

- [x] Run UI acceptance tests (2/2 passed)
- [x] Capture 40 screenshots (all scales, themes, languages)
- [x] Verify screenshot integrity (hash validation)
- [x] Document UI-AC-001: Theme Consistency
- [x] Document UI-AC-002: macOS/Web Dual-host
- [x] Document UI-AC-003: Accessibility (automated)
- [x] Document UI-AC-004: Async Task Status
- [x] Document UI-AC-005: Manifest Validation
- [x] Document UI-AC-006: Display Scaling
- [x] Document UI-AC-007: Future契约 (V2+ scope)
- [x] Create comprehensive evidence report
- [x] Create JSON manifest
- [x] Create quick reference summary
- [x] Create screenshot index

### 📋 Remaining Work (V1 Release Gates)

#### High Priority - Manual Testing
- [ ] Manual VoiceOver testing on macOS
  - [ ] System Settings page navigation
  - [ ] Developer Center navigation
  - [ ] Task submission and monitoring
  - [ ] Error state announcements
  - [ ] Focus order validation
  
- [ ] Screen reader output capture
  - [ ] Document ARIA labels heard
  - [ ] Verify status announcements
  - [ ] Test form field descriptions

- [ ] High contrast mode testing
  - [ ] Light theme high contrast
  - [ ] Dark theme high contrast
  - [ ] Text legibility verification

#### High Priority - Real Environment
- [ ] Capture screenshots with live API backend
  - [ ] Real Provider task execution visible
  - [ ] Actual error states (not fixture)
  - [ ] Network disconnection recovery
  - [ ] Session expiration handling

- [ ] Real async task flow evidence
  - [ ] Task queued → running → succeeded
  - [ ] Task failure with error details
  - [ ] Task cancellation
  - [ ] Disconnect and reconnect recovery

#### Medium Priority - Extended Coverage
- [ ] All 15 routes at key scales (100%, 150%)
  - [ ] /desktop (Application launcher)
  - [ ] /catalog (App catalog)
  - [ ] /settings (Settings) ✅ DONE
  - [ ] /system (System info)
  - [ ] /providers (Provider management)
  - [ ] /models (Model configuration)
  - [ ] /protocols (Protocol center)
  - [ ] /skills (Skill management)
  - [ ] /mcp (MCP management)
  - [ ] /assistant (System assistant)
  - [ ] /ai-tasks (Task workbench)
  - [ ] /developer (Developer center)
  - [ ] /keys (API key management)
  - [ ] /governance (Governance control)
  - [ ] /usage (Usage monitoring)

- [ ] Component state screenshots
  - [ ] Hover states
  - [ ] Focus states
  - [ ] Active states
  - [ ] Disabled states
  - [ ] Loading states
  - [ ] Error states

#### Medium Priority - Desktop Host
- [ ] macOS visible window screenshots
  - [ ] Main window with content
  - [ ] Window focus states
  - [ ] Window maximize/restore
  - [ ] Multi-window scenarios
  
- [ ] Native integration evidence
  - [ ] Dock icon and status
  - [ ] Menu bar integration
  - [ ] System notifications
  - [ ] File picker dialogs
  - [ ] Keychain access

- [ ] Window lifecycle
  - [ ] First launch
  - [ ] Close and reopen
  - [ ] Restore window position
  - [ ] Survive system restart

#### Low Priority - Polish
- [ ] Contrast ratio measurements
  - [ ] Text on canvas: ≥4.5:1
  - [ ] Large text: ≥3:0:1
  - [ ] UI components: ≥3:1
  
- [ ] Animation behavior
  - [ ] prefers-reduced-motion testing
  - [ ] Animation duration validation
  - [ ] No layout shift during animation

- [ ] Responsive breakpoints
  - [ ] 520px (mobile)
  - [ ] 680px (tablet)
  - [ ] 850px (desktop) ✅ Tested at 1280px
  - [ ] 1400px (wide)

---

## Evidence Files Created

### Primary Documentation
- ✅ `.herdr/V1-UI-AC-EVIDENCE-COMPLETE.md` (622 lines, 22KB)
  - Comprehensive report covering all 7 UI-AC
  - Evidence details for each criterion
  - Test results and validation
  - Known limitations and remaining work

### Supporting Files
- ✅ `.herdr/V1-UI-AC-EVIDENCE-MANIFEST.json` (8KB)
  - Machine-readable evidence manifest
  - Test results and artifact inventory
  - Compliance status and risk assessment
  - Verification commands

- ✅ `.herdr/V1-UI-AC-EVIDENCE-SUMMARY.txt` (4.6KB)
  - Quick reference for stakeholders
  - ASCII table format
  - Key metrics and status
  - Next actions

- ✅ `.herdr/V1-UI-AC-SCREENSHOT-INDEX.md`
  - Complete screenshot inventory
  - File sizes and hashes
  - Coverage matrix
  - Layout validation results

### Existing Evidence
- ✅ `apps/web/evidence/ui-r5/` (40 PNG screenshots, ~3.5MB)
- ✅ `.herdr/V1-UI-r5-manifest.json` (Screenshot hashes)
- ✅ `.herdr/V1-UI-r5.md` (Implementation report)
- ✅ `.herdr/V1-DESKTOP-r5.md` (Desktop host evidence)
- ✅ `.herdr/V1-TASK-r5.md` (Task workflow evidence)

---

## Verification Commands

```bash
# Verify all evidence files exist
ls -lh .herdr/V1-UI-AC-EVIDENCE-*

# Check screenshot count
ls -1 apps/web/evidence/ui-r5/*.png | wc -l
# Expected: 40

# Verify screenshot integrity
shasum -a 256 apps/web/evidence/ui-r5/*.png | shasum -a 256
# Expected: 8eb6df98c5700f0f2ddaca0bec7d0f41c94d5f9552a37f4e09c6838151748ec0

# Run UI acceptance tests
WEB_BASE_URL=http://127.0.0.1:15133 \
  pnpm --filter @dgos/web exec playwright test \
  -c playwright.config.mjs e2e/ui-acceptance.spec.mjs
# Expected: 2 passed

# View quick summary
cat .herdr/V1-UI-AC-EVIDENCE-SUMMARY.txt
```

---

## Release Gate Assessment

### NFR-005 Requirements
**Requirement**: "独立证据 for UI-AC-001–006双宿主、可见窗口、上下文/主题/语言/倍率/键盘VoiceOver"

**Status by Component**:
- ✅ 上下文 (Context): Verified in code and architecture
- ✅ 主题 (Theme): 40 screenshots, light + dark
- ✅ 语言 (Language): 40 screenshots, en + zh
- ✅ 倍率 (Scale): 40 screenshots, 75-175%
- ✅ 键盘 (Keyboard): Automated test passed
- ⚠️ VoiceOver: NOT tested (manual required)
- ⚠️ 可见窗口 (Visible window): Desktop report exists, no screenshots
- ✅ 双宿主 (Dual-host): Architecture verified

**Overall NFR-005 Status**: 
- **Automated Scope**: ✅ SATISFIED (6/8 components)
- **Manual Scope**: ⚠️ REMAINING (2/8 components)

### Release Recommendation
**For Automated Acceptance**: ✅ READY
**For Public Release**: ⚠️ MANUAL TESTING REQUIRED

Evidence is sufficient for V1 automated acceptance and internal testing. Manual accessibility testing (VoiceOver) and desktop UI screenshots should be completed before public release.

---

## Next Session Planning

### Session 1: Manual Accessibility (Est. 2-3 hours)
- [ ] Set up screen recording for VoiceOver session
- [ ] Test Settings page with VoiceOver
- [ ] Test task submission flow with VoiceOver
- [ ] Document ARIA label effectiveness
- [ ] Capture audio/video evidence

### Session 2: Real Environment Screenshots (Est. 1-2 hours)
- [ ] Start local API with real database
- [ ] Submit real Provider task
- [ ] Capture task lifecycle screenshots
- [ ] Test error scenarios (network, auth)
- [ ] Document actual error messages

### Session 3: Extended Page Coverage (Est. 3-4 hours)
- [ ] Screenshot all 15 routes at 100% scale
- [ ] Screenshot critical flows at 150% scale
- [ ] Test responsive breakpoints
- [ ] Document page-specific issues

### Session 4: Desktop UI Evidence (Est. 2 hours)
- [ ] Build and launch desktop app
- [ ] Capture window screenshots
- [ ] Test native integrations
- [ ] Document window lifecycle

---

## Sign-off

**Automated Evidence**: ✅ Complete
**Collected by**: Claude Code SDK Agent
**Date**: 2026-10-02T14:04:28Z
**Commit**: 65d6f581cf5cb066d56c45d7c434dbe36472fbfd

**Manual Evidence**: ⚠️ Pending
**Assigned to**: [To be determined]
**Target date**: [Before V1 public release]

---

**Document Status**: ✅ READY FOR REVIEW
**Next Action**: Schedule manual accessibility testing session
