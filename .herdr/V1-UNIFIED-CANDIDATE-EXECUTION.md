# V1 Unified Candidate Execution Report

**Status**: FAILED - SOURCE DRIFT DETECTED  
**Execution Started**: 2026-10-02T12:13:15Z  
**Execution Ended**: 2026-10-02T12:16:19Z  
**Duration**: ~3 minutes  
**Commit**: 65d6f58 (chore: V1 development baseline 2026-10-02)  
**Run ID**: V1-candidate-r12-2026-10-02T12-13-15-872Z-5047d13e  
**Work Package**: V1-CANDIDATE-COVERAGE  
**Exit Code**: 1 (FAILED)  

## Executive Summary

The unified candidate validation run **FAILED** due to source drift detection. The validation system detected that source files were modified during test execution, which invalidated all harness groups. This is the expected safety behavior - candidate validation requires a stable, committed source baseline throughout the entire execution.

**Root Cause**: The repository had uncommitted changes in the working tree when execution started, and those files were being modified by concurrent processes (likely Claude Code operations) during the test run.

**Impact**: No valid test results can be accepted from this run. All 6 harness groups (memory, pg, redis, tls, business, guarded) failed with source drift errors.

## Source Drift Analysis

### Initial Source State
- **HEAD Commit**: 65d6f581cf5cb066d56c45d7c434dbe36472fbfd
- **Working Tree SHA256 (start)**: `dff86c9a6b021f03e7568395f8a68c20201372e6a141e72f56be4f0ced6a3e23`
- **Status**: Uncommitted changes present

### Final Source State  
- **HEAD Commit**: 65d6f581cf5cb066d56c45d7c434dbe36472fbfd (unchanged)
- **Working Tree SHA256 (end)**: `dbf9f1e838f4ce2923d0246a8f4801096e43fe168bc7e8390d6cec578c1c98a7`
- **Drift Detected**: YES - working tree hash changed during execution

### Modified Files Detected
The following tracked files were modified during or just before execution:
- `apps/api/src/server.mjs` (runtime config file - CRITICAL)
- `apps/api/src/system-routes.mjs`
- `apps/web/src/advanced.tsx`
- `apps/web/src/i18n.ts`
- `apps/web/src/main.tsx`
- `apps/web/src/style.css`
- `src/permissions/builtin-declarations.mjs`
- `.ccb/ccbd/keeper.json`
- `.ccb/ccbd/lease.json`
- `docs-evidence.json`
- `packages/design-tokens/src/index.ts`

**Critical Issue**: `apps/api/src/server.mjs` is a required runtime config file in the bindings. Changes to this file invalidate the candidate bindings and all test results.

## Candidate Bindings

**Bindings File**: `.herdr/v1-candidate-bindings-65d6f58.json`  
**Candidate ID**: `b8d1278acb7673959239bb0a1fe2ecafd3ecc272b6c0389490f9139b010fc5fb`

### Build Artifacts
- **Build SHA256**: `f942cd3efe20c939621815d12e5db2110a74bc53a703f71c7d7c328d21121319`
- **Image SHA256**: `a05678c0fe6a07933998186529177931712db9242cd5a30208bf6f9c67ef11bc`
- **Commit**: 65d6f58 (short form)
- **Full Commit**: 65d6f581cf5cb066d56c45d7c434dbe36472fbfd

### Runtime Assets
- **Config Files**: 12 required runtime configuration files
- **Envelope**: `.herdr/state/package-fixture-r9/ai-workbench-envelope.json`
- **Dist Files**: 3 web distribution files
- **Native Binary**: 4 files (macOS app bundle)

### Migration Checksums
- **Total Migrations**: 47 (frozen set through 0051-proxy-provisioning)
- All checksums verified against frozen baseline at bindings creation

## Execution Environment

- **Platform**: Local host Node.js with isolated resources
- **Admin Database**: dgos_v1_integrated (PostgreSQL 127.0.0.1:5432)
- **Redis**: Multiple isolated DBs (DB3, DB5, DB6)
- **Test Isolation**: Child databases created per group
- **Actual Duration**: ~3 minutes (aborted early due to drift detection)
- **Expected Duration**: 8-12 minutes (if no drift)

## Execution Results by Group

### 1. Memory Group
**Status**: ❌ FAILED (source drift)  
**Exit Code**: 1  
**Duration**: ~3 minutes  
**Child Database**: None  
**Redis DB**: None  
**Tests Executed**: 9 test files  
**Tests Passed**: 6/9  
**Tests Failed**: 3/9  

**Partial Results** (before drift detection):
- ✅ tests/extensions/daemon-r3.test.mjs (1 passed)
- ✅ tests/extensions/extension-routes.test.mjs (1 passed)
- ✅ tests/extensions/extension-service.test.mjs (7 passed)
- ✅ tests/extensions/hardening-r3.test.mjs (5 passed)
- ✅ tests/extensions/mcp-transport.test.mjs (8 passed)
- ✅ tests/extensions/runtime-loader-r3.test.mjs (2 passed)
- ❌ tests/e2e/assistant-settings-actions.spec.mjs (1 failed)
- ❌ tests/integration/action-candidates-wiring.test.mjs (1 failed)
- ❌ tests/integration/ai-task-api.test.mjs (0 tests, null exit - drift detected here)

**Error**: "source drift after tests/integration/ai-task-api.test.mjs"

### 2. PG Group
**Status**: ❌ FAILED (source drift)  
**Exit Code**: 1  
**Tests Executed**: 0 (aborted before execution)  
**Error**: "source drift after tests/integration/ai-task-api.test.mjs"

### 3. Redis Group  
**Status**: ❌ FAILED (source drift)  
**Exit Code**: 1  
**Tests Executed**: 0 (aborted before execution)  
**Error**: "source drift after tests/integration/ai-task-api.test.mjs"

### 4. TLS Group
**Status**: ❌ FAILED (source drift)  
**Exit Code**: 1  
**Tests Executed**: 0 (aborted before execution)  
**Error**: "source drift after tests/integration/ai-task-api.test.mjs"

### 5. Business Group
**Status**: ❌ FAILED (source drift)  
**Exit Code**: 1  
**Tests Executed**: 0 (aborted before execution)  
**Error**: "source drift after tests/integration/ai-task-api.test.mjs"

### 6. Guarded Group
**Status**: ❌ FAILED (source drift)  
**Exit Code**: 1  
**Tests Executed**: 0 (aborted before execution)  
**Error**: "source drift after tests/integration/ai-task-api.test.mjs"

## Validation Issues Summary

**Total Issues**: 254

### Critical Issues (Blockers)
1. **Source drift detected** - All groups invalidated
2. **Runtime config file changed** - apps/api/src/server.mjs modified during execution
3. **Missing browser and native groups** - Not included in this run
4. **Candidate not complete** - Cannot accept any results

### Missing Test Assets (Examples)
The plan expected many test files that were not executed due to early abort:
- 47 missing assets in memory group
- 24 missing assets in pg group  
- 1 missing asset in redis group
- 7 missing assets in tls group
- 4 missing assets in business group (critical business harnesses)
- 4 missing assets in guarded group

### Uncovered E2E Cases
All 12 required E2E cases remain uncovered:
- V1-E2E-01, 02, 03, 05, 07, 09, 10, 11, 12, 13, 14, 15

## AC Coverage Analysis

**Target**: 62 Acceptance Criteria (AC)  
**Achieved**: 0 AC fully proven (all results invalidated by source drift)  
**Completion**: 0%

**No valid coverage data** - Source drift invalidated all test results.

## Evidence Files

**Manifest Locations** (INVALIDATED - source drift):
- `docs/05-测试与发布/端到端验收/报告/V1-candidate-r12-2026-10-02T12-13-15-872Z-5047d13e-memory-manifest.json`
- `docs/05-测试与发布/端到端验收/报告/V1-candidate-r12-2026-10-02T12-13-15-872Z-5047d13e-pg-manifest.json`
- `docs/05-测试与发布/端到端验收/报告/V1-candidate-r12-2026-10-02T12-13-15-872Z-5047d13e-redis-manifest.json`
- `docs/05-测试与发布/端到端验收/报告/V1-candidate-r12-2026-10-02T12-13-15-872Z-5047d13e-tls-manifest.json`
- `docs/05-测试与发布/端到端验收/报告/V1-candidate-r12-2026-10-02T12-13-15-872Z-5047d13e-business-manifest.json`
- `docs/05-测试与发布/端到端验收/报告/V1-candidate-r12-2026-10-02T12-13-15-872Z-5047d13e-guarded-manifest.json`

**Group Reports** (INVALIDATED):
- `docs/05-测试与发布/端到端验收/报告/V1-candidate-r12-2026-10-02T12-13-15-872Z-5047d13e-memory.md` (partial results)
- Other group .md files (empty/aborted)

**Test Logs**:
- Memory group: 8 TAP output files in memory directory
- Other groups: No test logs generated (aborted)

## Root Cause Analysis

### Why Did This Fail?

1. **Uncommitted Changes**: The repository had modified tracked files when the validation started
2. **Concurrent Modifications**: Files were being modified during test execution (likely by Claude Code operations running in parallel)
3. **Critical File Changed**: `apps/api/src/server.mjs` is a runtime config file bound in the candidate bindings - any change to it invalidates the entire candidate
4. **Correct Safety Behavior**: The validation system correctly detected instability and aborted

### What is Source Drift?

Source drift detection is a safety mechanism that ensures:
- All tests run against the exact same source code
- No code changes occur during the multi-minute validation run
- Results are reproducible and trustworthy
- The candidate bindings accurately reflect what was tested

When drift is detected, **all results are rejected** because we cannot guarantee which version of the code was actually tested.

## Required Corrective Actions

### Immediate Actions (Before Re-running)

1. **Clean Working Tree**
   ```bash
   # Review all changes
   git status
   git diff
   
   # Either commit changes or stash them
   git add -A
   git commit -m "chore: prepare clean baseline for candidate validation"
   # OR
   git stash push -u -m "WIP changes during validation prep"
   ```

2. **Update Bindings for New Commit**
   ```bash
   # After committing, create new bindings with updated commit hash
   node scripts/create-v1-bindings.mjs
   ```

3. **Ensure No Concurrent Operations**
   - Stop all Claude Code operations that modify source files
   - Ensure no other processes are running that touch the repository
   - Dedicate the terminal/environment exclusively to the validation run

4. **Verify Clean State**
   ```bash
   git status  # Should show "nothing to commit, working tree clean"
   ```

### Re-execution Steps

1. ✅ Create candidate bindings (COMPLETED - but needs redo after clean commit)
2. ❌ Clean and commit working tree (REQUIRED)
3. ❌ Create fresh bindings for clean commit
4. ❌ Execute unified candidate run with no concurrent operations
5. ❌ Monitor execution (8-12 minutes without interruption)
6. ❌ Collect all manifests
7. ❌ Generate unified coverage report
8. ❌ Verify AC completion percentage
9. ❌ Document remaining gaps

## Lessons Learned

1. **Candidate validation requires a clean, committed baseline** - No uncommitted changes
2. **Source must remain stable during execution** - No concurrent modifications
3. **Runtime config files are critical** - Changes to them invalidate everything
4. **The safety system works as designed** - Drift detection prevented accepting invalid results

## Remaining Work

### To Get Valid Results:

1. Commit or stash all current changes
2. Ensure working tree is clean
3. Create new bindings for the clean commit
4. Re-run validation with no interruptions
5. Wait full 8-12 minutes for completion
6. Then generate coverage report from valid manifests

### Expected Outcomes (Next Run):

If run cleanly:
- All 6 groups should execute fully
- Business harness tests will provide key assertions
- E2E case coverage can be calculated
- AC completion percentage can be determined
- Valid evidence for release decision

## Conclusion

**This validation run FAILED correctly** - the system detected source instability and rejected all results to maintain integrity. No AC coverage can be claimed from this run.

**Next Action**: Commit all changes, create clean bindings, and re-execute with a stable, dedicated environment.

---

**Report Status**: FINAL - Run failed due to source drift  
**Generated**: 2026-10-02T12:20:00Z  
**Valid Results**: None - All invalidated by source drift
