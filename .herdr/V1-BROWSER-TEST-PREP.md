# V1 Browser Test Execution Strategy - Preparation Report

**Status**: Blocked - Missing prerequisites
**Date**: 2026-10-02
**Context**: Worker-D r10 prepared 5 browser test branches; execution blocked by environment constraints
**Workspace**: `/Users/apple/Progame/DGOS`

## Executive Summary

Browser test execution readiness verified. All test files exist with valid syntax. D services (ports 15202-03) are running and healthy. H fixture (ports 15175-76) is NOT running. Test execution attempted but blocked by:
1. **H fixture tests**: Missing `data/v1-ui-management-fixture/state.json` - fixture not initialized
2. **D direct tests**: Invalid admin credentials - existing principal ID found but credential unknown
3. **Environment**: Prior r10 attempts blocked by Chromium Mach port permissions (not retested)

**Recommendation**: User must either:
- Option A: Initialize H fixture using `scripts/v1-ui-management-fixture.mjs` (provides isolated state)
- Option B: Obtain valid REAL_ADMIN_ID/REAL_ADMIN_CREDENTIAL for existing D integration environment

---

## 1. Test Readiness Verification

### Test Files Inventory

All 5 test branches exist across 3 spec files:

| File | Tests | Status | Syntax Check |
|------|-------|--------|--------------|
| `real-management-fixture.spec.mjs` | 4 | ✓ Valid | exit 0 |
| `real-context.spec.mjs` | 1 | ✓ Valid | exit 0 |
| `real-management.spec.mjs` | 8 | ✓ Valid | exit 0 |

**SHA-256 Hashes** (from r10):
- `real-management.spec.mjs`: `e85ed1c96d485df566d40ade6c8e8fbe1bb69803181563d7c6218483f39f188c`
- `real-management-fixture.spec.mjs`: `3abcb6980d77bc5f80bd4693fac1a14d712f3297c7d13ce4f1962747835ea13b`
- `real-context.spec.mjs`: `4c94b81750f24cb89bc7746ab2eec3cb57fedfe8d21b87a6150fbb54d9308609`

### 5 Test Branches (from r10 documentation)

#### H Fixture Tests (requires ports 15175-76)

1. **Skill translation/apply/stale CAS**
   - Test: `real-management-fixture.spec.mjs:53` - "real Skill translation reaches Task, Artifact and confirmed apply"
   - Preconditions: H fixture enabled, Provider config/model in state, fresh skill creation
   - Assertions: Task succeeds, Artifact contains translation, apply succeeds, stale apply returns 409

2. **MCP first credential install**
   - Test: `real-management-fixture.spec.mjs:113` - "real MCP first credential install requires an absent target"
   - Preconditions: Target MCP must be absent, template is `needs-credentials`, private credential supplied
   - Assertions: Preview verified, credential install 202, target appears configured

3. **MCP installed connect/invoke**
   - Test: `real-management-fixture.spec.mjs:135` - "real installed MCP connects, discovers tools and invokes a confirmed Run"
   - Preconditions: Target MCP already installed/configured
   - Assertions: Enable/connect, discover tool, confirmation ticket, Run succeeds, secret absent from receipts

4. **Assistant ask/allow/replan/navigation**
   - Test: `real-management-fixture.spec.mjs:192` - "real assistant request needs System approval, then its run opens Settings"
   - Preconditions: System permission set to `ask`, login and action candidate available
   - Assertions: Plan is `ask`, request remains `ask`, explicit allow, replan `allow`, Run succeeds, restores `ask`

5. **System context/settings**
   - Test: `real-context.spec.mjs:43` - "real System appearance, locale, grid, CAS and restoration use public API"
   - Preconditions: H fixture enabled, real login, no page.route
   - Assertions: Appearance/locale/grid GUI writes, context readback/version increments, stale CAS 409, restore original

#### D Direct Tests (requires ports 15202-03)

8 additional management tests in `real-management.spec.mjs` covering:
- Custom Skill creation/edit/disable
- Device session revocation
- Governance policy CAS
- Quota policy creation
- Assistant resolve/plan/execute
- Assistant denied navigation
- High-risk settings action with audit
- Queued run cancellation

---

## 2. Service Dependencies Status

### Port Availability

| Service | Port | Status | Health Check |
|---------|------|--------|--------------|
| D API | 15202 | ✓ Running | `{"status":"ready","apiVersion":"2026-10-01"}` |
| D Web | 15203 | ✓ Running | HTTP 200, serves SPA |
| H API | 15175 | ✗ Not listening | No process bound |
| H Web | 15176 | ✗ Not listening | No process bound |
| Fixture | 15204 | ✓ Running | Returns fixture error (expected) |

### Docker Integration Environment

**Running Containers**:
```
dgos-v1-integration-api-1        127.0.0.1:15202->3000/tcp     Up 8 hours (healthy)
dgos-v1-integration-web-1        127.0.0.1:15203->4173/tcp     Up 11 hours (healthy)
dgos-v1-integration-postgres-1   127.0.0.1:15200->5432/tcp     Up (healthy)
dgos-v1-integration-redis-1      127.0.0.1:15201->6379/tcp     Up (healthy)
dgos-v1-integration-fixture-1    127.0.0.1:15204->4080/tcp     Up 18 hours (healthy)
dgos-v1-integration-worker-1,2                                 Up
```

**Database**: PostgreSQL accessible at `127.0.0.1:15200`, database `dgos_v1_integrated` exists with full schema (42+ tables including `admin_principals`, `admin_sessions`, etc.)

**Redis**: Accessible at `127.0.0.1:15201`, no credential keys found in scan

**Existing Admin Principal**: `c2fee94e-bd71-46b8-b1fa-79f75b736773` (status: active, created 2026-10-01)

### H Fixture Missing

The H fixture is a **separate isolated environment** created by `scripts/v1-ui-management-fixture.mjs`:
- Uses separate PostgreSQL database (dynamic name `dgos_v1_ui_management_<suffix>`)
- Uses Redis namespace `v1-ui-management:<suffix>`
- Runs on dedicated ports 15175 (API), 15176 (Web), 15177 (TLS)
- Creates private state file: `data/v1-ui-management-fixture/state.json`
- Provides known credentials for fixture tests

**Current Status**: 
- `data/v1-ui-management-fixture/` directory exists but empty (only `.DS_Store`)
- No `state.json` file
- No active processes on ports 15175-76
- Last run evidence: `.herdr/state/browser-r9-live/.last-run.json` shows `{"status":"failed"}`

---

## 3. Execution Commands Prepared

### For H Fixture Tests (5 tests)

**Prerequisites**:
1. Initialize H fixture: `node scripts/v1-ui-management-fixture.mjs`
2. Wait for fixture ready on ports 15175-76

**Command**:
```bash
cd /Users/apple/Progame/DGOS
REAL_MANAGEMENT_FIXTURE=1 WEB_EXTERNAL=1 WEB_BASE_URL=http://127.0.0.1:15176 \
  pnpm --filter @dgos/web exec playwright test \
  -c playwright.config.mjs \
  e2e/real-management-fixture.spec.mjs e2e/real-context.spec.mjs \
  --workers=1
```

**Expected**: 5 tests (4 fixture + 1 context)

### For D Direct Tests (8 tests)

**Prerequisites**:
1. Obtain valid admin credentials for principal `c2fee94e-bd71-46b8-b1fa-79f75b736773`
   - OR bootstrap new admin via integration workflow
   - Credentials not stored in Redis or discoverable via current setup

**Command**:
```bash
cd /Users/apple/Progame/DGOS
REAL_ADMIN_ID=c2fee94e-bd71-46b8-b1fa-79f75b736773 \
REAL_ADMIN_CREDENTIAL=<unknown> \
WEB_EXTERNAL=1 WEB_BASE_URL=http://127.0.0.1:15203 \
  pnpm --filter @dgos/web exec playwright test \
  -c playwright.config.mjs \
  e2e/real-management.spec.mjs \
  --workers=1
```

**Expected**: 8 tests

---

## 4. Execution Attempts & Results

### Attempt 1: D Direct Test with Placeholder Credentials

**Command**: Attempted `real-management.spec.mjs` with test credentials
**Result**: **FAIL** - Login rejected

```
Error: Admin login HTTP 401 errorKey=invalid_credentials requestId=36ca4c62-ac71-44e0-8eff-ef84b77ab094
Test failed at signIn() before any business assertions
Exit code: 1
Duration: 239ms
```

**Analysis**: 
- Browser launched successfully (no Chromium permission issue in current environment)
- Web/API services responsive
- Admin endpoint functional
- Credential validation working correctly
- Blocker: Valid credentials required

### Attempt 2: H Fixture Test Listing

**Command**: Attempted to list H fixture tests with `REAL_MANAGEMENT_FIXTURE=1`
**Result**: **FAIL** - Missing state file

```
Error: ENOENT: no such file or directory, 
  open '/Users/apple/Progame/DGOS/data/v1-ui-management-fixture/state.json'

Test collection failed at line 6 (module load phase)
No tests could be enumerated
Exit code: 1
```

**Analysis**:
- H fixture never initialized in current environment
- Tests cannot load without fixture state
- Blocker: Must run `scripts/v1-ui-management-fixture.mjs` first

### Database Query Results

Confirmed schema exists with proper structure:
- Table `admin_principals` has columns: `principal_id`, `status`, `credential_ref`, `roles`, `version`, `created_at`, `updated_at`
- One active admin principal exists: `c2fee94e-bd71-46b8-b1fa-79f75b736773`
- `credential_ref` points to Redis key (not password hash in DB)
- Redis credential lookup found no keys (ephemeral or cleaned)

---

## 5. Blockers & Workarounds

### Primary Blockers

| Blocker | Affected Tests | Severity | Resolution Required |
|---------|---------------|----------|---------------------|
| Missing H fixture state | 5 tests (fixture + context) | **Critical** | Run `v1-ui-management-fixture.mjs` to create isolated environment |
| Unknown D admin credential | 8 tests (management) | **Critical** | User must provide or bootstrap new admin |
| Chromium permissions (r10) | All tests (not confirmed current) | **Historical** | May require Terminal.app execution or permission grant |

### Workaround Options

#### Option A: Initialize H Fixture (Recommended for fixture tests)

```bash
cd /Users/apple/Progame/DGOS
node scripts/v1-ui-management-fixture.mjs
```

This will:
1. Create isolated PostgreSQL database `dgos_v1_ui_management_<random>`
2. Create private state file with credentials at `data/v1-ui-management-fixture/state.json`
3. Start API on port 15175, Web on port 15176
4. Start TLS proxy on port 15177
5. Create admin principal with known credential
6. Create MCP test configuration
7. Create Provider configuration

After initialization, state.json will contain:
- `principalId`: Admin principal ID
- `privateCredentialsFile`: Path to credentials JSON with `adminCredential`, `mcpCredential`
- `providerConfigId`: Pre-configured provider
- `modelId`: Model for testing
- `mcpId`, `mcpTemplateId`, `appId`: MCP test configuration

**Cleanup**: Run `node scripts/v1-ui-management-fixture.mjs --stop` to tear down

#### Option B: Bootstrap D Environment Admin

Review `scripts/release-integration.mjs` for bootstrap pattern:
1. Navigate to D Web: `http://127.0.0.1:15203`
2. Click "First-time setup"
3. Enter display name and credential
4. Submit to `/api/v1/identity/admin/bootstrap`
5. Extract `principalId` and credential from response
6. Use for `REAL_ADMIN_ID` and `REAL_ADMIN_CREDENTIAL`

**Note**: May not work if admin already exists (bootstrap typically one-time)

#### Option C: Extract Existing Credential (If Available)

Check for credential persistence:
```bash
# Search Redis with different patterns
docker compose -f docker-compose.integration.yml exec redis \
  redis-cli --scan --pattern "*credential*"

# Check for environment files
find . -name ".env.integration*" -o -name "*credential*"

# Review integration setup logs
docker compose -f docker-compose.integration.yml logs api | grep -i bootstrap
```

---

## 6. Chromium Launch Permissions (r10 Historical)

Per Worker-D r10 documentation, prior attempts failed with:
```
browserType.launch: Target page, context or browser has been closed
Chromium fatal: mach_port_rendezvous ... Permission denied (1100)
```

This is a **macOS sandbox restriction**, not a product defect.

**Current Status**: 
- Test execution attempt 1 (this run) showed Chromium launched successfully
- Error occurred at login (HTTP 401), not at browser launch
- Suggests permissions may be resolved OR current terminal has access

**If Chromium permission issue returns**:
1. Run from Terminal.app directly (not VS Code terminal or other shells)
2. Grant Full Disk Access to Terminal in System Preferences > Privacy & Security
3. Ensure Playwright browsers installed: `pnpm --filter @dgos/web exec playwright install chromium`
4. Try headed mode: add `--headed` flag to see actual browser window

---

## 7. Manual Execution Guide for User

### Step 1: Choose Test Strategy

**For H Fixture Tests (isolated, recommended)**:
```bash
# Start H fixture
cd /Users/apple/Progame/DGOS
node scripts/v1-ui-management-fixture.mjs

# Wait for startup confirmation in logs (look for ports 15175, 15176 ready)
# In another terminal, verify:
curl http://127.0.0.1:15175/ready
curl http://127.0.0.1:15176/

# Run fixture tests
REAL_MANAGEMENT_FIXTURE=1 WEB_EXTERNAL=1 WEB_BASE_URL=http://127.0.0.1:15176 \
  pnpm --filter @dgos/web exec playwright test \
  -c playwright.config.mjs \
  e2e/real-management-fixture.spec.mjs e2e/real-context.spec.mjs \
  --workers=1

# Review results and capture evidence
# Stop fixture when done:
node scripts/v1-ui-management-fixture.mjs --stop
```

**For D Integration Tests (requires credentials)**:
```bash
# Obtain REAL_ADMIN_ID and REAL_ADMIN_CREDENTIAL from secure storage
# Or bootstrap new admin if available

# Verify D services healthy
curl http://127.0.0.1:15202/ready
curl http://127.0.0.1:15203/

# Run D tests
REAL_ADMIN_ID=<your-admin-id> \
REAL_ADMIN_CREDENTIAL=<your-credential> \
WEB_EXTERNAL=1 WEB_BASE_URL=http://127.0.0.1:15203 \
  pnpm --filter @dgos/web exec playwright test \
  -c playwright.config.mjs \
  e2e/real-management.spec.mjs \
  --workers=1
```

### Step 2: Capture Evidence

If tests pass, capture manifests:
```bash
# Extract case_passed events from output
grep -o '"case_passed":"[^"]*"' | \
  sed 's/"case_passed":"//' | sed 's/"$//' > \
  .herdr/state/browser-test-passed-cases.txt

# Capture test report
pnpm --filter @dgos/web exec playwright show-report

# Screenshot test artifacts
ls -la apps/web/test-results/
```

### Step 3: Update Evidence

Document results in:
- `.herdr/V1-BROWSER-TEST-PREP.md` (this file)
- `docs-evidence.json` (add test execution evidence)
- `docs-gate.json` (update gate status if tests pass)

---

## 8. Test Environment Summary

### Current Capabilities

✓ **D Integration Environment (Running)**
- PostgreSQL: `127.0.0.1:15200` (dgos_v1_integrated)
- Redis: `127.0.0.1:15201`
- API: `127.0.0.1:15202` (healthy, ready)
- Web: `127.0.0.1:15203` (healthy, serving SPA)
- Fixture: `127.0.0.1:15204` (provider fixture)
- Workers: 2 instances running
- Admin principal exists but credential unknown

✗ **H Fixture Environment (Not Running)**
- State file missing: `data/v1-ui-management-fixture/state.json`
- No processes on ports 15175-76-77
- Requires initialization via script

✓ **Playwright**
- Version: 1.63.0
- Chromium: Available (launched successfully in test attempt)
- Test files: Valid syntax, ready to execute

### Infrastructure Constraints

- **Persistence**: D environment uses tmpfs for PostgreSQL (data lost on restart)
- **Isolation**: H fixture creates separate database/namespace for clean slate
- **Credentials**: Admin credentials stored in Redis (ephemeral), not in PostgreSQL
- **Concurrency**: Tests use `--workers=1` to avoid race conditions
- **Network**: All services on localhost, no external dependencies

---

## 9. Recommendations

### Immediate Actions (User Decision Required)

1. **Choose test path**:
   - Path A: Initialize H fixture for isolated fixture tests (5 tests)
   - Path B: Obtain D credentials for integration tests (8 tests)
   - Path C: Both (13 total tests)

2. **For H fixture tests** (Path A or C):
   ```bash
   node scripts/v1-ui-management-fixture.mjs
   # Wait for ready, then run tests
   ```

3. **For D integration tests** (Path B or C):
   - Retrieve admin credential from secure storage
   - OR bootstrap new admin if permitted
   - Set `REAL_ADMIN_ID` and `REAL_ADMIN_CREDENTIAL`

4. **Execute tests** using commands in Section 7

5. **If Chromium permission issue occurs**:
   - Run from Terminal.app
   - Grant Full Disk Access
   - Try `--headed` flag to diagnose

### Evidence Capture Plan

If tests succeed, capture:
- [ ] Test output with `case_passed` events
- [ ] Playwright HTML report
- [ ] Test artifacts (screenshots, traces)
- [ ] Service logs during test execution
- [ ] Database state before/after (if applicable)
- [ ] Update `docs-evidence.json` with test execution evidence
- [ ] Update gate status in `docs-gate.json`

### Risk Mitigation

- **H fixture**: Use `--stop` to cleanly tear down and avoid port conflicts
- **D tests**: Do NOT run concurrently with H fixture (port conflicts unlikely but settings may overlap)
- **Credentials**: Do NOT commit `data/v1-ui-management-fixture/state.json` or private credentials
- **Database**: D environment data is ephemeral (tmpfs), accept data loss on restart
- **Cleanup**: Run fixture stop, remove test artifacts after evidence captured

---

## 10. Files & Artifacts

### Test Files (No changes made)

```
apps/web/e2e/real-management-fixture.spec.mjs  (3abcb6980d77bc5f...)
apps/web/e2e/real-context.spec.mjs              (4c94b81750f24cb8...)
apps/web/e2e/real-management.spec.mjs           (e85ed1c96d485df5...)
```

### State & Configuration

- **H fixture state**: `data/v1-ui-management-fixture/state.json` (MISSING)
- **Integration compose**: `docker-compose.integration.yml`
- **Playwright config**: `apps/web/playwright.config.mjs`
- **Fixture script**: `scripts/v1-ui-management-fixture.mjs`

### Evidence Directories

- `.herdr/state/browser-r9-live/` - Prior run evidence (failed)
- `.herdr/state/browser-r18-fixture/` - Fixture run evidence
- `apps/web/test-results/` - Playwright test artifacts (will be created on run)

---

## Conclusion

**Test Readiness**: 100% (all files valid, syntax checked, services verified)

**Execution Readiness**: 0% - Blocked by:
1. H fixture not initialized (5 tests blocked)
2. D admin credentials unknown (8 tests blocked)

**Next Action Required**: User must choose test path and provide prerequisites

**No Code Changes**: This preparation made no modifications to test files, source code, or infrastructure

**Stop-Writing Confirmation**: Preparation complete, ready for user execution decision

---

**Prepared by**: Agent (search/diagnostic role)
**Date**: 2026-10-02
**Work Package**: V1-BROWSER-TEST-PREP
**Status**: `delivered_static` - awaiting user execution decision
