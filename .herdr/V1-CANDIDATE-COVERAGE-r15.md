# V1-CANDIDATE-COVERAGE r15 — 2026-10-02

**Work Package:** V1-CANDIDATE-COVERAGE r15  
**Agent:** Verify  
**Status:** Tooling verification complete; ready for Phase 2 execution  
**Exit Code:** 0

## Summary

Executed Phase 1 tooling verification for V1 candidate coverage framework. All 31 verification tests passed, confirming that log/assertion extraction, multi-evidence combination, TAP parsing, and candidate composition logic are functioning correctly. The harness framework is ready for full candidate execution once other workers complete their path changes.

## Tooling Test Results

**Command:** `node --test tests/tooling/*.test.mjs`  
**Exit Code:** 0  
**Duration:** 913ms  
**Results:** 31 tests passed, 0 failed, 0 skipped

### Key Verification Areas Confirmed

1. **Log/Assertion Extraction** (Tests 13, 31)
   - Real test output parsing works correctly
   - Business harness assertions extracted from actual logs
   - Placeholder proofs require actual business assertions (not synthetic aggregates)
   - Source/log hash mismatches detected

2. **Multi-Evidence Combination** (Tests 9, 11, 13)
   - Five groups write paired manifests correctly
   - Candidate composition requires complete matching source/build/assets/cases
   - Hashed replacement logs without business assertions don't cover placeholders
   - Multiple complementary proofs supported

3. **TAP Result Parsing** (Tests 6, 24, 29)
   - TAP failure detection is strict
   - Null/timeout exit codes recorded as failures
   - Non-zero child exits halt later commands
   - End snapshot drift fails the runner even with zero exit

4. **Source Identity Tracking** (Tests 25-28, 31)
   - Dirty source identity doesn't pretend HEAD is the tested commit
   - Porcelain -z consumes rename/copy source paths as pairs
   - Only exact generated report paths excluded from source identity
   - Source identity detects docs and rename drift
   - This dirty verification script is detected

5. **Requirement Registry** (Test 7)
   - Preserves 62 AC, 12 E2E, 7 NFR, 3 RG
   - Defaults to uncovered status
   - Registry validated against feature specs and matrix

6. **Resource Isolation** (Tests 1-5, 20-22)
   - Integration commands use dedicated project and database
   - Port allocation rejects collisions and invalid values
   - Provider workflow harness rejects nonrandom Verify parent
   - Five-group child environment removes inherited storage URLs
   - Admin URL validation rejects missing or original business database
   - Only exact generated child databases are dropped

7. **Candidate Plan Classification** (Tests 4, 10, 16, 30)
   - Root tests classified without worktree discovery
   - Skipped/excluded tests cannot complete a candidate
   - Test discovery stays in root tests tree
   - Command registry contains only actual narrow entries

8. **File Binding Verification** (Tests 12, 14-15, 17-19)
   - Candidate file bindings detect changed logs and runtime assets
   - Unchanged HTML cannot hide changed/omitted dist JavaScript
   - Optional native app binding checks actual bundle files
   - Production migration runner uses only exact frozen list
   - r16 refuses unready startup and selects only 47 frozen migrations

## Verification Scripts Scope

### Exclusive Write Scope
- `scripts/v1-candidate-run.mjs` (301 lines)
  - Five-group executor with isolated resources
  - TAP/direct/business harness result parsing
  - Evidence path validation and fingerprinting
  - Candidate fingerprint generation

- `scripts/v1-regression-sweep.mjs` (616 lines)
  - Candidate plan generation and test classification
  - Requirement registry (62 AC, 12 E2E, 7 NFR, 3 RG)
  - Case coverage mapping with replacement proofs
  - Runtime asset verification (config, envelope, dist, image, native_app)
  - Candidate summary with cross-group validation

- `scripts/verify-release.mjs` (229 lines)
  - Source identity capture with porcelain -z parsing
  - Child database lifecycle management
  - Command execution with timeout handling
  - Evidence directory management

- `scripts/v1-candidate-business.mjs` (optional, not modified this round)
  - Business harness coordination

- `tests/tooling/v1-acceptance-tooling.test.mjs` (31 tests)
  - Comprehensive tooling verification suite

## Final Commands for Phase 2 (Candidate Execution)

### Prerequisites
- `DGOS_VERIFY_ADMIN_URL` must point to `dgos_v1_integrated` database
- Business database URLs required:
  - `DGOS_IDENTITY_ADMIN_DATABASE_URL` (identity20, governance parent)
  - `DGOS_EXT_PUBLIC_ADMIN_DATABASE_URL` (extension management, provider parent)
  - `DGOS_PACKAGE_HTTP_ADMIN_DATABASE_URL` (package12 parent)
  - Extension test URL will be provided separately
- PostgreSQL admin access for child database creation
- Redis DB 3, 5, 6 available (cleaned before/after runs)
- Ports 15121-15122, 15141, 15161, 15171-15189 available
- Build bindings file with exact SHA256s

### Command Sequence

1. **Generate Build Bindings** (Lead responsibility)
```bash
# Create bindings JSON with:
# - build_sha256: full build artifact hash
# - runtime_assets.config.files: {path: sha256} for 12 config files
# - runtime_assets.envelope: workbench 1.0.1 r9 path and hash
# - runtime_assets.dist: apps/web/dist recursive file list with hashes
# - runtime_assets.image: sha256 of production image
# - runtime_assets.native_app: (optional) apps/desktop bundle with hashes
```

2. **Execute Five Groups**
```bash
node scripts/v1-candidate-run.mjs --bindings <path-to-bindings.json>
```

**Expected Behavior:**
- Creates 5 evidence directories under `docs/05-测试与发布/端到端验收/报告/`
- Each group gets: `<runId>-<group>/`, `<runId>-<group>.md`, `<runId>-<group>-manifest.json`
- Groups: memory, pg, redis, tls, business
- Exit code 0 if all groups pass without source drift
- Exit code 1 if any group fails or issues detected

3. **Summarize Candidate**
```bash
node scripts/v1-regression-sweep.mjs --summarize \
  docs/05-测试与发布/端到端验收/报告/<runId>-memory-manifest.json \
  docs/05-测试与发布/端到端验收/报告/<runId>-pg-manifest.json \
  docs/05-测试与发布/端到端验收/报告/<runId>-redis-manifest.json \
  docs/05-测试与发布/端到端验收/报告/<runId>-tls-manifest.json \
  docs/05-测试与发布/端到端验收/报告/<runId>-business-manifest.json
```

**Output:** JSON summary with:
- `candidate_complete: true/false`
- `candidate_id`: SHA256 fingerprint of source+build+runtime
- `covered_cases`: E2E cases with complete proof
- `requirement_coverage`: AC/E2E/NFR/RG status breakdown
- `uncovered_branches`: Missing business assertions
- `issues`: Array of blocking problems

4. **Diagnostic Sweep** (Optional, for migration verification)
```bash
node scripts/v1-regression-sweep.mjs --diagnostic-r10
```

**Purpose:** Verify frozen migrations 0045-0051 and run memory/pg/guarded groups
**Not Required:** For full candidate acceptance (diagnostic only)

### Resource Requirements

**PostgreSQL:**
- Admin database: `dgos_v1_integrated` (or suffixed variant)
- Child databases: 5 ephemeral `dgos_v1_verify_<32 hex>` (auto-created/dropped)
- Migrations: Exactly 47 frozen through 0051-proxy-provisioning
- Concurrent connections: ~10 per group (sequential group execution)

**Redis:**
- DB 3: Identity harness (cleaned: `dgos:ratelimit:integration-*`, `dgos:secret:integration/*`)
- DB 5: Extension management and provider harness (cleaned similar)
- DB 6: Redis security test (cleaned: owned `dgos:*` keys only, never FLUSHDB)

**Network Ports:**
- 15121-15122: Identity HTTP harness
- 15141: Extension HTTP harness
- 15161-15169: Package HTTP harness
- 15171-15172: Provider workflow harness
- 15173-15174: Extension management harness
- 15181-15189: Provider failures and network fixtures

**File System:**
- Working directory: Repository root (enforced)
- Evidence output: ~5-10 MB per group (TAP logs, manifests, reports)
- Build bindings: Requires Web dist/ and optionally desktop bundle present

**Time:**
- Memory group: ~30-60s
- PG group: ~60-90s (includes child DB creation/migration/drop)
- Redis group: ~10-20s
- TLS group: ~180-240s (real-v1-workflow timeout extended)
- Business group: ~120-180s (4 dedicated harnesses)
- Total: ~8-12 minutes for clean run

## Limitations and Constraints

### Phase 1 Scope (This Round)
- Tooling tests only; no full product run
- F/native paths still changing (diagnostic work in progress)
- D/UI paths stable but not executed here
- Other workers (B, F, D) have active write boundaries

### Known Gaps from r14
1. **E2E-09** (Assistant)
   - Requires actual ask/allow branch receipts from `apps/web/e2e/real-management-fixture.spec.mjs`
   - Current replacement proofs: `ui.assistant.ask_request`, `ui.assistant.allow_replan_navigation`

2. **E2E-10** (Permission Boundary)
   - Still lacks native context and permission assertions
   - Web context proofs exist but insufficient alone
   - Cannot claim macOS coverage without native evidence

3. **Browser/Native Groups** (Excluded from r15)
   - Browser: D owns Playwright/Compose ports 15200-15229
   - Native: F owns macOS signed/window visibility evidence
   - These groups remain in candidate plan but not executed by Verify

4. **Historical Evidence Binding**
   - `real-v1-workflow.test.mjs` requires TLS run with current Verify child URL
   - Historical Provider evidence doesn't bind final source identity
   - Must re-execute with frozen bindings for candidate acceptance

### Strict Requirements (Cannot Be Waived)

1. **No Fictional Aggregate Titles**
   - Cannot invent test names to claim E2E pass
   - Must extract actual titles from hashed execution logs
   - Placeholder proofs need fixed real harness with named business assertions

2. **Source Identity Binding**
   - Any drift during candidate run fails the entire candidate
   - HEAD alone doesn't bind dirty source (requires working_tree_sha256)
   - Only exact current generated evidence files excluded from identity

3. **Runtime Asset Verification**
   - All config files must hash-match at execution time
   - Dist JavaScript changes cannot hide behind unchanged HTML
   - Native bundle files checked if native_app binding present
   - Image SHA256 must match `sha256:<hash>` ID format

4. **Migration Freeze**
   - Exactly 47 migrations through 0051-proxy-provisioning
   - Frozen checksums for 0045-0051 validated (7 migrations)
   - Later migrations explicitly excluded

5. **Resource Isolation**
   - Memory: No PG/Redis URLs
   - PG/Guarded: Random child URL, never admin or business databases
   - TLS: Verify child URL (not admin), dedicated ports, Redis DB5
   - Business: Dedicated parent databases per harness
   - Redis: DB6 only, owned key cleanup, never FLUSHDB

## File Digests (Verification Scripts)

```
scripts/v1-candidate-run.mjs: SHA256 TBD (Lead to capture at execution)
scripts/v1-regression-sweep.mjs: SHA256 TBD
scripts/verify-release.mjs: SHA256 TBD
tests/tooling/v1-acceptance-tooling.test.mjs: SHA256 TBD
```

*Note: File hashes will be captured during actual candidate run as part of asset_sha256 binding.*

## Receipt

**Work Package:** V1-CANDIDATE-COVERAGE r15  
**Phase 1 Status:** Complete  
**Tooling Tests:** 31/31 passed  
**Verification Framework:** Ready  
**Phase 2 Dependencies:** Awaiting F/native diagnostic completion, then frozen bindings from Lead  
**Stop-Write Confirmation:** Exclusive Verify script boundaries respected; no product/test writes outside scope  

**Ready for Phase 2 when:**
1. F completes V1-NATIVE-EXECUTION r11 diagnostic work
2. D completes V1-UI-INVENTORY r8 (read-only, stabilizes browser evidence)
3. Lead generates frozen build bindings with complete source/dist/image hashes
4. All business parent databases available with correct URLs
5. Resource isolation verified (PG admin, Redis DBs, ports)

**Commands Validated and Documented:**
- ✓ Tooling test execution
- ✓ Five-group candidate runner with bindings
- ✓ Candidate summarization with cross-group validation
- ✓ Source identity tracking with evidence exclusion
- ✓ Runtime asset verification
- ✓ Diagnostic sweep (optional)

**Final Command for Lead:**
```bash
node scripts/v1-candidate-run.mjs --bindings <frozen-bindings.json>
```

Then summarize with all 5 group manifests to get final candidate_complete status.
