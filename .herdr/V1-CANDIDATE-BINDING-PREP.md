# V1 Candidate Binding Preparation

**Candidate ID:** v1-final-20261002-113502  
**Timestamp:** 2026-10-02T11:35:02Z  
**Git Commit:** 72ab1cb98b064a6e27b9f60a9f8f00881a827a99  
**Git Status:** DIRTY (471 uncommitted changes)

## ✅ Identity Collection Complete

### Source Identity
- [x] API source files (15 files) - SHA-256 collected
- [x] Worker source files (6 files) - SHA-256 collected
- [x] Shared src/ files (65 files) - SHA-256 collected
- [x] Rust native source (5 files) - SHA-256 collected
- [x] Web source CSS (1 file) - SHA-256 collected

**Total Source Files:** 92

### Dist Identity
- [x] Web dist built: 2026-10-02T19:34:07Z
- [x] index.html - SHA-256 collected
- [x] CSS bundle (index-BFWr4XFs.css) - SHA-256 collected
- [x] JS bundle (index-CpUC1UQM.js) - SHA-256 collected

**Total Dist Files:** 3

### Native Binary Identity
- [x] Debug binary (dgos-desktop) - SHA-256 collected
  - Path: apps/desktop/src-tauri/target/debug/dgos-desktop
  - Size: ~25.9 MB
  - Built: 2026-10-02T19:34:07Z (debug build)

### Migration Identity
- [x] All 45 migration files (0001-0051) - SHA-256 collected
- [x] Verified sequence: 0001-0051 (gaps: 0008, 0020, 0021, 0042)
- [x] Matches frozen migration baseline

**Note:** Migration count is 45, not 47 as originally mentioned. Missing files are 0008, 0020, 0021, 0042.

### Configuration Identity
- [x] Package.json files (API, Worker, Web) - SHA-256 collected
- [x] Rust Cargo.toml - SHA-256 collected
- [x] Tauri config - SHA-256 collected
- [x] Docker compose files (2 files) - SHA-256 collected
- [x] Environment template (.env.example) - SHA-256 collected

**Total Config Files:** 8

## ⚠️ Source Drift Status

### Uncommitted Changes: 471 files
**Impact:** Candidate identity reflects working tree, not committed state

**Critical drift areas:**
- Modified: .gitignore, API services, desktop app, web app
- Deleted: apps/web/src/main.js
- Documentation changes: Multiple docs/ files modified
- Test files modified: e2e specs, integration tests

**Recommendation:** This binding captures the CURRENT WORKING STATE, not the last committed state.

## 🔧 Build Reproducibility Notes

### Web Build
- Built from modified source (uncommitted changes present)
- Build timestamp: 2026-10-02T19:34:07Z
- Asset hashes are content-addressed (reproducible if source unchanged)
- **Status:** Not reproducible from git commit alone due to uncommitted changes

### Native Build
- Debug build captured (not release)
- Built from modified Rust source
- Binary timestamp: 2026-10-02T19:34:07Z
- **Status:** Not reproducible from git commit alone

### Migration Schema
- All 45 migrations have stable checksums
- **Status:** Reproducible (migrations are committed and unchanged)

## 📋 Actions Required Before Candidate Run

### Must Do:
1. **Decide on source freeze strategy:**
   - Option A: Commit all 471 changes, update bindings with new commit
   - Option B: Proceed with dirty state (document drift)
   - Option C: Stash changes, rebuild from clean commit

2. **Rebuild decision:**
   - Web dist is from modified source - acceptable?
   - Native binary is DEBUG build - should use RELEASE?

3. **Verify migration count:**
   - Confirm 45 migrations (not 47) is expected
   - Verify gaps (0008, 0020, 0021, 0042) are intentional

### Should Do:
4. **Create release binary:**
   - Current binding uses debug build
   - Release build recommended for candidate validation

5. **Document frozen configuration:**
   - Environment variables baseline
   - Runtime configuration expectations

## 🎯 Binding File Status

**Location:** `.herdr/v1-candidate-bindings.json`

**Contents:**
- candidateId: v1-final-20261002-113502
- gitCommit: 72ab1cb (dirty)
- source: 92 files with SHA-256
- webDist: 3 files with SHA-256 + build timestamp
- nativeBinary: 1 file with SHA-256
- migrations: 45 files with SHA-256
- config: 8 files with SHA-256

**Total tracked files:** 149

## 🚦 Ready for v1-candidate-run.mjs

**Prerequisites:**
- [x] Bindings file created
- [x] All SHA-256 checksums calculated
- [ ] Source drift resolution decision
- [ ] Build reproducibility strategy
- [ ] Lead review and approval

## 📝 Notes for Lead Review

1. **Git dirty state:** 471 uncommitted changes mean this candidate cannot be reproduced from git history alone. Consider committing or documenting drift.

2. **Debug vs Release:** Native binary is debug build. Recommend release build for production candidate.

3. **Migration count discrepancy:** Task mentioned 47 migrations, but only 45 exist (gaps at 0008, 0020, 0021, 0042). Verify this is expected.

4. **Web dist freshness:** Built ~8 hours before binding creation. May need rebuild if source changed.

5. **No production artifacts:** No release binaries, no optimized builds captured.

## 🔒 Freeze Recommendation

**Before candidate validation:**
1. Commit or revert the 471 changes
2. Rebuild from clean state
3. Create release builds (not debug)
4. Regenerate bindings from clean state
5. Tag the commit for traceability

**Or document acceptance of current state for V1 internal candidate only.**

---

**Binding prepared by:** Automated identity collection  
**Ready for integration:** Pending drift resolution
