# V1 Unified Candidate Execution - Quick Summary

**Date**: 2026-10-02  
**Status**: ❌ FAILED  
**Reason**: Source drift detected  
**Run ID**: V1-candidate-r12-2026-10-02T12-13-15-872Z-5047d13e  

## What Happened

The V1 unified candidate validation run was executed but **failed correctly** due to source code instability. The validation system detected that source files were modified during test execution, which invalidated all results.

## Key Findings

- ✅ **Bindings Created**: `.herdr/v1-candidate-bindings-65d6f58.json`
- ❌ **Execution Failed**: Source drift after 3 minutes
- ❌ **All Groups Invalid**: Memory, PG, Redis, TLS, Business, Guarded
- ❌ **AC Coverage**: 0% (all results rejected)
- ⚠️ **Critical File Changed**: apps/api/src/server.mjs (runtime config)

## Root Cause

1. Repository had uncommitted changes when validation started
2. Files were modified during execution (concurrent operations)
3. Critical runtime config file changed, invalidating candidate bindings
4. Source drift detection correctly aborted the run

## What Must Be Done Next

### Prerequisites for Re-run

1. **Commit or stash all changes**
   ```bash
   git status  # Check what's modified
   git add -A && git commit -m "chore: clean baseline for V1 validation"
   # OR
   git stash push -u -m "WIP during validation prep"
   ```

2. **Create fresh bindings** for the new clean commit
   ```bash
   node scripts/create-v1-bindings.mjs
   ```

3. **Stop all concurrent operations**
   - No other Claude Code tasks modifying files
   - Dedicated environment for validation only

4. **Verify clean state**
   ```bash
   git status  # Must show "nothing to commit, working tree clean"
   ```

### Re-execution Command

```bash
export DGOS_VERIFY_ADMIN_URL="postgres://dgos:dgos@127.0.0.1:5432/dgos_v1_integrated"
export DGOS_IDENTITY_ADMIN_DATABASE_URL="postgres://dgos:dgos@127.0.0.1:5432/dgos_v1_integrated"
export DGOS_EXTENSION_TEST_DATABASE_URL="postgres://dgos:dgos@127.0.0.1:5432/dgos_v1_extensions"
export DGOS_EXT_PUBLIC_ADMIN_DATABASE_URL="postgres://dgos:dgos@127.0.0.1:5432/dgos_v1_extensions_r3final"
export DGOS_PACKAGE_HTTP_ADMIN_DATABASE_URL="postgres://dgos:dgos@127.0.0.1:5432/dgos_v1_packages"

node scripts/v1-candidate-run.mjs --bindings <NEW_BINDINGS_PATH>
```

### Expected Duration
- **8-12 minutes** uninterrupted execution
- Must complete all 6 groups without source changes

## Files Generated (This Run - INVALID)

### Bindings
- `.herdr/v1-candidate-bindings-65d6f58.json` (needs recreation for clean commit)

### Evidence (Invalidated)
- `docs/05-测试与发布/端到端验收/报告/V1-candidate-r12-*-memory-manifest.json`
- `docs/05-测试与发布/端到端验收/报告/V1-candidate-r12-*-memory.md`
- Plus 5 other group manifests (all invalid due to drift)

### Reports
- `.herdr/V1-UNIFIED-CANDIDATE-EXECUTION.md` (detailed failure report)

## Success Criteria for Next Run

- ✅ Clean git working tree before start
- ✅ No modifications during 8-12 minute execution
- ✅ All 6 groups execute successfully
- ✅ No source drift detected
- ✅ Valid AC coverage percentage calculated
- ✅ Evidence manifests accepted

## Impact

**No valid AC coverage data** from this run. Must re-execute with stable source to get release-ready validation results.

---

**Full Details**: See `.herdr/V1-UNIFIED-CANDIDATE-EXECUTION.md`
