# V1 Comprehensive Gap Analysis

**Generated:** 2026-10-02T11:55:10Z  
**Baseline:** 72ab1cb + concurrent uncommitted changes  
**Analyst:** Automated gap analysis against V1 AC specifications  
**Methodology:** Systematic comparison of 62 ACs against implementation evidence from V1-AC资产核对-2026-10-02.md

## Executive Summary

**Brutal Honesty Assessment:**

- **Total ACs:** 62
- **✅ Complete:** 29 (47%)
- **⚠️ Partial:** 32 (52%)
- **❌ Missing:** 1 (2%)

**Reality Check:**
- Nearly half of ACs are only partially validated
- Most gaps are in **UI/E2E validation** and **dual-host testing**
- Backend APIs are substantially complete (FR-010 through FR-015)
- Frontend and integration layers need significant work

## AC-by-AC Status

### FR-001: 桌面与应用工作区 (0/8 Complete)

| AC | Status | Evidence | Critical Gaps |
|----|--------|----------|---------------|
| AC01 | ⚠️ PARTIAL | F r6 desktop 3/3, real 7/7 | Human GUI validation, Developer ID/notarization |
| AC02 | ⚠️ PARTIAL | Unit tests | Real package validation with signatures |
| AC03 | ⚠️ PARTIAL | API tests | System info UI completely missing |
| AC04 | ⚠️ PARTIAL | A r9 browser fixture 1/1 | Current build UI, dual-host (desktop + web) |
| AC05 | ⚠️ PARTIAL | Web E2E mock | Locale/assistant language separation, dual-host |
| AC06 | ⚠️ PARTIAL | I r6/r7 network 10/10 | GUI proxy input, production secrets, worker actions |
| AC07 | ⚠️ PARTIAL | Unit/API deny subset | Cross-app capability full branches |
| AC08 | ⚠️ PARTIAL | Unit/API subset | Cross-app capability authorization flow |

**Critical Path:** FR-001 blocks V1-E2E-01 and system-level validation. Without dual-host UI and real permission flows, platform is not demonstrable.

### FR-002: 开发者中心与APP生命周期 (0/3 Complete)

| AC | Status | Evidence | Critical Gaps |
|----|--------|----------|---------------|
| AC01 | ⚠️ PARTIAL | G r11 packages 16/16 + HTTP 12 stages | Strict input validation, concurrent app lock, Task/Artifact retention after rollback, real developer UI |
| AC02 | ⚠️ PARTIAL | G r11 retention subset | Actual Task/Artifact preservation proof after rollback |
| AC03 | ⚠️ PARTIAL | G r11 subset | Real UI for test install, approval workflow end-to-end |

**Critical Path:** Package lifecycle needs comprehensive E2E with real UI. Rollback + data retention is safety-critical.

### FR-003: SkillMCP与Agent接入 (0/8 Complete)

| AC | Status | Evidence | Critical Gaps |
|----|--------|----------|---------------|
| AC01 | ⚠️ PARTIAL | E r6 extensions 33/33 | H management HTTP, D GUI, B Linux platform |
| AC02 | ⚠️ PARTIAL | E r6 subset | Independent process kill/lease, real UI cancel |
| AC03 | ⚠️ PARTIAL | E r6 subset | Real config with browser, production egress/OS isolation |
| AC04 | ⚠️ PARTIAL | E r6 subset | Custom Skill, rename/translate, delete protection |
| AC05 | ❌ MISSING | **None** | **Complete AC: template fill, credential paths, connection refusal** |
| AC06 | ⚠️ PARTIAL | E r6 subset | Dependency/active Run deletion protection, cross-process recovery |
| AC07 | ⚠️ PARTIAL | E r6 + Web E2E | Real source preview confirmation, custom fields/permissions |
| AC08 | ⚠️ PARTIAL | E r6 subset | Bundled credential samples, page close/reload, daemon recovery |

**Critical Path:** FR-003 AC05 is completely missing. Extensions management UI and cross-process lifecycle are critical for V1-E2E-03.

### FR-005: 多模态AI任务工作流 (2/3 Complete)

| AC | Status | Evidence | Critical Gaps |
|----|--------|----------|---------------|
| AC01 | ✅ COMPLETE | A r9 + F r6 + H r6 real chain | None |
| AC02 | ⚠️ PARTIAL | A r9 browser fixture | Dynamic params, theme/language, revoke-stop-polling, taskId recovery |
| AC08 | ✅ COMPLETE | H r6 real PG/Redis/worker/restart | None |

**Critical Path:** Core text workflow is validated. AC02 needs browser E2E with edge cases.

### FR-007: 模型平台与工作流配置 (6/8 Complete)

| AC | Status | Evidence | Critical Gaps |
|----|--------|----------|---------------|
| AC01 | ✅ COMPLETE | H r5/r6 provider tests | None |
| AC02 | ✅ COMPLETE | H r5/r6 provider tests | None |
| AC04 | ⚠️ PARTIAL | H r4 fixture 10/10 | Real adapter for all Provider types/models |
| AC05 | ⚠️ PARTIAL | H r5/r6 subset | Full model classification branches |
| AC06 | ⚠️ PARTIAL | H r4 API injection 10/10 | UI no-export entry, target host validation |
| AC07 | ✅ COMPLETE | H r5/r6 provider tests | None |
| AC08 | ✅ COMPLETE | H r5/r6 protocol tests | None |
| AC09 | ✅ COMPLETE | H r5/r6 admission profile tests | None |

**Critical Path:** Provider backend is solid. UI for configuration management needed.

### FR-009: 系统智能助手与快捷指令 (0/6 Complete)

| AC | Status | Evidence | Critical Gaps |
|----|--------|----------|---------------|
| AC01 | ⚠️ PARTIAL | A r8 + Web E2E | Dual-host navigation, no-Provider mode, permission revoke |
| AC02 | ⚠️ PARTIAL | A r8 subset | Full action lifecycle state transitions |
| AC03 | ⚠️ PARTIAL | A r8 freshness 2/2 | Current identity/permission recheck enforcement |
| AC04 | ⚠️ PARTIAL | A r8 subset | Subject isolation, package digest/action versioning |
| AC05 | ⚠️ PARTIAL | A r8 subset | NL parsing comprehensive coverage |
| AC06 | ⚠️ PARTIAL | A r8 subset | Real user confirmation, full-process recovery |

**Critical Path:** Assistant actions need comprehensive E2E with real confirmation flows and dual-host support.

### FR-010: 管理员登录与会话 (3/4 Complete)

| AC | Status | Evidence | Critical Gaps |
|----|--------|----------|---------------|
| AC01 | ✅ COMPLETE | C r12 identity HTTP 20/20 | None |
| AC02 | ✅ COMPLETE | C r12 identity HTTP 20/20 | None |
| AC03 | ✅ COMPLETE | C r12 identity HTTP 20/20 | None |
| AC04 | ⚠️ PARTIAL | A r8 subset | Current identity/permission recheck for high-risk operations |

### FR-011: API-Key生命周期 (3/4 Complete)

| AC | Status | Evidence | Critical Gaps |
|----|--------|----------|---------------|
| AC01 | ✅ COMPLETE | C r12 identity HTTP 20/20 | None |
| AC02 | ✅ COMPLETE | C r12 identity HTTP 20/20 | None |
| AC03 | ⚠️ PARTIAL | C r12 subset | Limited key overlap window validation |
| AC04 | ✅ COMPLETE | C r12 identity HTTP 20/20 | None |

### FR-012: Provider账号与连接 (3/4 Complete)

| AC | Status | Evidence | Critical Gaps |
|----|--------|----------|---------------|
| AC01 | ✅ COMPLETE | H r5/r6 provider account tests | None |
| AC02 | ✅ COMPLETE | H r5/r6 provider binding tests | None |
| AC03 | ✅ COMPLETE | H r5/r6 provider tests | None |
| AC04 | ⚠️ PARTIAL | H r5/r6 subset | Full reference protection scenarios |

### FR-013: 上游账号连接测试 (3/4 Complete)

| AC | Status | Evidence | Critical Gaps |
|----|--------|----------|---------------|
| AC01 | ✅ COMPLETE | H r5/r6 provider probe tests | None |
| AC02 | ✅ COMPLETE | H r5/r6 provider probe tests | None |
| AC03 | ⚠️ PARTIAL | H r5/r6 subset | Full SSRF prevention validation |
| AC04 | ✅ COMPLETE | H r5/r6 provider lease tests | None |

### FR-014: 审计与管理员系统治理 (5/5 Complete)

| AC | Status | Evidence | Critical Gaps |
|----|--------|----------|---------------|
| AC01 | ✅ COMPLETE | C r11 governance audit tests | None |
| AC02 | ✅ COMPLETE | C r11 audit query 5/5 | None |
| AC03 | ✅ COMPLETE | C r11 governance tests | None |
| AC04 | ✅ COMPLETE | G r9 retention 10/10 + 14/14 | None |
| AC05 | ✅ COMPLETE | C r11 governance policy tests | None |

**Status:** FR-014 is fully validated. Governance backend is production-ready.

### FR-015: 用量与额度管理 (5/5 Complete)

| AC | Status | Evidence | Critical Gaps |
|----|--------|----------|---------------|
| AC01 | ✅ COMPLETE | C r6 quota + H r6 | None |
| AC02 | ✅ COMPLETE | C r6 quota tests | None |
| AC03 | ✅ COMPLETE | C r6 quota tests | None |
| AC04 | ✅ COMPLETE | C r6 quota tests | None |
| AC05 | ✅ COMPLETE | C r6 quota tests | None |

**Status:** FR-015 is fully validated. Usage and quota backend is production-ready.

## Gap Categories

### Category A: Code Missing (1 AC)

| Priority | FR/AC | Effort | Description |
|----------|-------|--------|-------------|
| **P0** | **FR-003/AC05** | **3-4d** | **Complete MCP quick config: template non-secret fill, need-credentials/no-credentials dual path, connection before credentials refusal** |

### Category B: Code Exists, No Test (3 ACs)

| Priority | FR/AC | Effort | Description |
|----------|-------|--------|-------------|
| P1 | FR-001/AC02 | 2d | Real package validation with actual signatures, integrity checking |
| P2 | FR-011/AC03 | 1d | Limited key overlap window validation - extend test coverage |
| P2 | FR-013/AC03 | 1d | Full SSRF prevention validation with comprehensive attack vectors |

### Category D: E2E Partial (29 ACs)

#### P0 - Blocks Release (11 ACs)

| Priority | FR/AC | Effort | Description |
|----------|-------|--------|-------------|
| P0 | FR-001/AC01 | 3d | Human-assisted GUI validation + Developer ID/notarization for macOS |
| P0 | FR-001/AC03 | 2d | System info UI implementation (DGOS version, services, storage) |
| P0 | FR-001/AC04 | 3d | Current build UI with theme/scale support + dual-host validation |
| P0 | FR-001/AC06 | 4d | GUI proxy input, production secrets integration, worker action path |
| P0 | FR-002/AC01 | 3d | Strict input validation, concurrent app lock, rollback + Task/Artifact retention, developer UI |
| P0 | FR-002/AC03 | 2d | Real UI for developer test install + approval workflow E2E |
| P0 | FR-003/AC01 | 3d | H management HTTP completion, D GUI implementation, B Linux platform |
| P0 | FR-003/AC03 | 3d | Real config/Secret/permission with browser, production egress, OS isolation |
| P0 | FR-003/AC07 | 2d | Real source preview with confirmation, custom fields, permission validation |
| P0 | FR-007/AC06 | 1d | UI no-export entry validation + host check |
| P0 | FR-009/AC01 | 3d | Dual-host real navigation, no-Provider mode, permission revoke flow |

**P0 Total Effort:** ~29 days

#### P1 - Feature Completion (10 ACs)

| Priority | FR/AC | Effort | Description |
|----------|-------|--------|-------------|
| P1 | FR-001/AC05 | 3d | Locale/assistant language separation + dual-host validation |
| P1 | FR-001/AC07 | 2d | Cross-app capability authorization full branches |
| P1 | FR-001/AC08 | 2d | Cross-app capability vs launch permission separation |
| P1 | FR-002/AC02 | 2d | Actual Task/Artifact preservation proof after rollback |
| P1 | FR-003/AC02 | 2d | Independent process kill/lease + real UI cancel |
| P1 | FR-003/AC04 | 3d | Custom Skill, rename/translate, delete reference protection |
| P1 | FR-003/AC06 | 2d | Dependency/active Run deletion protection, cross-process recovery |
| P1 | FR-003/AC08 | 3d | Bundled credential dual samples, page close/reload, daemon recovery |
| P1 | FR-005/AC02 | 2d | Dynamic parameters, theme/language, revoke-stop-polling, taskId recovery |
| P1 | FR-009/AC06 | 2d | Real user confirmation + full-process recovery |

**P1 Total Effort:** ~23 days

#### P2 - Polish & Edge Cases (8 ACs)

| Priority | FR/AC | Effort | Description |
|----------|-------|--------|-------------|
| P2 | FR-007/AC04 | 2d | Real adapter validation for all Provider types/models (not just fixture) |
| P2 | FR-007/AC05 | 1d | Full model classification branches coverage |
| P2 | FR-009/AC02 | 2d | Full action lifecycle state transitions |
| P2 | FR-009/AC03 | 1d | Current identity/permission recheck enforcement |
| P2 | FR-009/AC04 | 2d | Subject isolation, package digest, action SemVer/run revision |
| P2 | FR-009/AC05 | 3d | NL parsing comprehensive coverage |
| P2 | FR-010/AC04 | 1d | Step-up authentication for high-risk operations |
| P2 | FR-012/AC04 | 1d | Full reference protection scenarios |

**P2 Total Effort:** ~13 days

## Prioritized Task List

### Sprint 1: Critical Blockers (P0 - Week 1-2)

```
[P0] [FR-003/AC05] [Cat-A] [4d] Implement MCP quick config template system
  - Template non-secret autofill
  - Need-credentials vs no-credentials dual path
  - Connection refusal before credentials provided
  - Test: templates/mcp-quick-config.test.mjs
  - Evidence: .herdr/V1-EXT-QUICK-CONFIG-r7.md

[P0] [FR-001/AC03] [Cat-D] [2d] Build system info UI
  - DGOS version display
  - System services status
  - Storage/permissions/API settings entries
  - Test: apps/web/e2e/system-info.spec.mjs
  - Evidence: Screenshot + E2E results

[P0] [FR-001/AC01] [Cat-D] [3d] Complete desktop GUI validation
  - Human-assisted accessibility testing
  - macOS Developer ID signing
  - Notarization workflow
  - Test: Manual QA checklist + signed binary
  - Evidence: .herdr/V1-DESKTOP-SIGNED-r7.md

[P0] [FR-007/AC06] [Cat-D] [1d] Add UI no-export validation
  - Remove export button for Provider configs
  - API 404 for export endpoints
  - Test: apps/web/e2e/provider-no-export.spec.mjs
  - Evidence: UI screenshot + API negative test
```

### Sprint 2: UI & Integration (P0 - Week 3-4)

```
[P0] [FR-001/AC04] [Cat-D] [3d] Current build UI + dual-host
  - Theme/scale reactive updates
  - Desktop + Web host parity
  - System context propagation
  - Test: apps/desktop + apps/web E2E
  - Evidence: Dual-host screenshot matrix

[P0] [FR-001/AC06] [Cat-D] [4d] Complete proxy configuration
  - GUI proxy input form
  - Production secrets integration
  - Worker action path validation
  - Test: integration + E2E with real network
  - Evidence: .herdr/V1-NETWORK-PRODUCTION-r8.md

[P0] [FR-002/AC01] [Cat-D] [3d] Package lifecycle hardening
  - Strict input validation
  - Concurrent app installation lock
  - Rollback with Task/Artifact retention
  - Developer UI completion
  - Test: tests/integration/package-lifecycle-full.test.mjs
  - Evidence: .herdr/V1-PACKAGES-FULL-r12.md

[P0] [FR-002/AC03] [Cat-D] [2d] Developer test install UI
  - Test install flow
  - Approval workflow E2E
  - Permission validation
  - Test: apps/web/e2e/developer-center.spec.mjs
  - Evidence: E2E recording
```

### Sprint 3: Extensions & Actions (P0 - Week 5-6)

```
[P0] [FR-003/AC01] [Cat-D] [3d] Extensions management completion
  - H management HTTP routes
  - D GUI implementation
  - B Linux platform support
  - Test: Full extension lifecycle on Linux
  - Evidence: .herdr/V1-EXT-MANAGEMENT-FINAL-r8.md

[P0] [FR-003/AC03] [Cat-D] [3d] Extensions security hardening
  - Real config with browser integration
  - Production egress validation
  - OS-level isolation
  - Test: Security test suite with real network
  - Evidence: .herdr/V1-EXT-SECURITY-r7.md

[P0] [FR-003/AC07] [Cat-D] [2d] Skill preview confirmation
  - Real source preview UI
  - User confirmation flow
  - Custom fields + permissions
  - Test: apps/web/e2e/skill-import.spec.mjs
  - Evidence: E2E recording with confirmation

[P0] [FR-009/AC01] [Cat-D] [3d] Assistant dual-host navigation
  - Desktop + Web navigation
  - No-Provider mode
  - Permission revoke handling
  - Test: Dual-host assistant E2E
  - Evidence: .herdr/V1-ASSISTANT-DUAL-HOST-r9.md
```

### Sprint 4: Feature Completion (P1 - Week 7-8)

```
[P1] [FR-001/AC02] [Cat-B] [2d] Real package validation
  - Actual signature verification
  - Integrity checking
  - Tamper detection
  - Test: tests/security/package-integrity.test.mjs
  - Evidence: Real signed package test results

[P1] [FR-001/AC05] [Cat-D] [3d] Language/locale separation
  - Interface language vs locale format
  - Assistant language independence
  - Dual-host validation
  - Test: E2E with all language combinations
  - Evidence: Multi-locale screenshot matrix

[P1] [FR-001/AC07-08] [Cat-D] [4d] Cross-app permissions
  - Launch vs capability authorization
  - Cross-app permission branches
  - Test: Permission matrix tests
  - Evidence: .herdr/V1-PERMISSIONS-CROSS-APP-r9.md

[P1] [FR-002/AC02] [Cat-D] [2d] Rollback data retention proof
  - Task/Artifact preservation verification
  - Rollback with active references
  - Test: tests/integration/rollback-retention.test.mjs
  - Evidence: Before/after database snapshots
```

### Sprint 5: Extensions Polish (P1 - Week 9-10)

```
[P1] [FR-003/AC02] [Cat-D] [2d] Extension process management
  - Independent process kill
  - Lease management
  - Real UI cancel
  - Test: Integration with process isolation
  - Evidence: .herdr/V1-EXT-PROCESS-r8.md

[P1] [FR-003/AC04] [Cat-D] [3d] Skill lifecycle completeness
  - Custom Skill creation
  - Rename/translate operations
  - Delete reference protection
  - Test: Full skill lifecycle E2E
  - Evidence: .herdr/V1-SKILL-LIFECYCLE-r8.md

[P1] [FR-003/AC06] [Cat-D] [2d] MCP deletion protection
  - Active Run dependency check
  - Cross-process recovery
  - Test: tests/integration/mcp-deletion-protection.test.mjs
  - Evidence: Dependency graph validation

[P1] [FR-003/AC08] [Cat-D] [3d] Bundled MCP credentials
  - Dual credential samples (with/without)
  - Page close/reload behavior
  - Daemon recovery
  - Test: apps/web/e2e/bundled-mcp.spec.mjs
  - Evidence: E2E with browser restart
```

### Sprint 6: Edge Cases & Polish (P2 - Week 11-12)

```
[P2] [FR-005/AC02] [Cat-D] [2d] Task edge cases
  - Dynamic parameters
  - Theme/language handling
  - Revoke-stop-polling
  - TaskId recovery
  - Test: Browser E2E edge case suite
  - Evidence: .herdr/V1-TASK-EDGE-CASES-r6.md

[P2] [FR-007/AC04-05] [Cat-D] [3d] Provider adapter validation
  - Real adapter for all types
  - Full classification branches
  - Test: Real provider integration tests
  - Evidence: Multi-provider test matrix

[P2] [FR-009/AC02-06] [Cat-D] [8d] Assistant action polish
  - Full lifecycle transitions
  - Identity/permission recheck
  - Subject isolation
  - NL parsing coverage
  - Real confirmation + recovery
  - Test: Comprehensive action test suite
  - Evidence: .herdr/V1-ASSISTANT-COMPLETE-r10.md

[P2] [FR-010/AC04] [Cat-D] [1d] Step-up authentication
  - High-risk operation recheck
  - Test: tests/security/step-up-auth.test.mjs
  - Evidence: Security test results
```

## Effort Summary

| Category | ACs | Estimated Days |
|----------|-----|----------------|
| **P0 - Critical Blockers** | 11 + 1 missing = 12 | **~33 days** |
| **P1 - Feature Completion** | 10 + 3 test gaps = 13 | **~28 days** |
| **P2 - Polish & Edge Cases** | 8 | **~13 days** |
| **TOTAL** | **33 incomplete ACs** | **~74 days** |

**With 2 developers working in parallel: ~37 working days (~7.5 weeks)**

**Reality Check:** This assumes:
- No major architectural issues discovered
- Test infrastructure is stable
- No blocking dependencies between tasks
- Developers are familiar with codebase

**Risk Buffer:** Add 20-30% for:
- Integration issues
- Test flakiness fixes
- Documentation updates
- Code review cycles

**Realistic Timeline:** **9-10 weeks** with 2 developers

## Release Gate Assessment

### RG-001: V1 FRs spec-ready with AC test mapping

**Status:** ⚠️ **BLOCKED**

**Blocker ACs:** 33 incomplete (32 partial + 1 missing)

**Critical Path:**
1. FR-003/AC05 (missing) - 4 days
2. FR-001 UI completeness - 15 days
3. FR-002/003 E2E validation - 18 days
4. Cross-cutting UI/dual-host - 10 days

**Unblock Timeline:** 6-7 weeks minimum

### RG-002: Workbench text AI task complete

**Status:** ✅ **PASSING**

**Evidence:**
- FR-005/AC01: Complete (A r9 + F r6 + H r6)
- FR-005/AC08: Complete (H r6 real streaming)
- FR-005/AC02: Partial but not blocking for basic text workflow

**Confidence:** HIGH - Core text AI workflow validated end-to-end

### RG-003: Platform minimums passing

**Status:** ⚠️ **PARTIAL**

**Gaps:**
- Desktop GUI validation incomplete (FR-001/AC01)
- System info UI missing (FR-001/AC03)
- Dual-host testing incomplete (FR-001/AC04-05)
- Developer UI missing (FR-002/AC03)
- Extensions management UI incomplete (FR-003/AC01)

**Unblock Timeline:** 4-5 weeks for minimal demonstrability

## Recommendations

### Immediate Actions (Week 1)

1. **Complete FR-003/AC05** (only missing AC)
2. **Build system info UI** (FR-001/AC03) - high visibility, low risk
3. **Start desktop signing** (FR-001/AC01) - long lead time

### Parallel Workstreams

**Stream A: Desktop & System**
- FR-001 AC01, AC03, AC04, AC06
- Owner: Desktop specialist
- Duration: 4 weeks

**Stream B: Package & Developer Experience**
- FR-002 AC01, AC02, AC03
- Owner: Backend + UI generalist
- Duration: 3 weeks

**Stream C: Extensions & Skills**
- FR-003 AC05, AC01, AC03, AC07
- Owner: Extensions specialist
- Duration: 4 weeks

**Stream D: Assistant & Actions**
- FR-009 AC01, AC06
- Owner: Integration specialist
- Duration: 3 weeks

### Decision Points

**Week 2 Review:**
- Is FR-003/AC05 complete?
- Is system info UI functional?
- Are we on track for desktop signing?

**Week 4 Review:**
- Are P0 blockers clearing?
- Do we need to descope any P1/P2 items?
- Is dual-host validation viable?

**Week 6 Review:**
- Can we freeze for regression?
- Are release gates unblocked?
- What is the realistic ship date?

## Risk Assessment

### High Risk

1. **Desktop Signing/Notarization** - May require Apple Developer account setup, could take 1-2 weeks alone
2. **Dual-Host Testing** - Significant infra work if test harness not ready
3. **Production Secrets** - May require ops coordination and security review

### Medium Risk

1. **Cross-Process Recovery** - Complex state management, potential race conditions
2. **Permission Edge Cases** - Large combinatorial test space
3. **Real Network Testing** - Flakiness, environment dependencies

### Low Risk

1. **UI Implementation** - Straightforward given backend APIs exist
2. **Test Coverage** - Time-consuming but low technical risk
3. **Documentation** - Can be parallelized

## Conclusion

**Honest Assessment:**

V1 is **not ready for release**. While backend APIs are substantially complete (29/62 ACs fully validated), the product is not demonstrable or usable without:

1. System and developer UIs
2. Desktop application signing
3. Dual-host validation
4. Extension management completion
5. Cross-cutting E2E validation

**Estimated time to production-ready:** **9-10 weeks** with 2 developers working efficiently.

**Key Dependencies:**
- Desktop signing infrastructure
- Dual-host test harness
- Production secrets integration
- UI design system completeness

**Recommendation:** Do not commit to external release date until Week 4 review confirms P0 blockers are clearing on schedule.

---

**Validation:** This analysis is based on evidence from V1-AC资产核对-2026-10-02.md and systematic FR specification review. Numbers are conservative estimates assuming no major blockers.
