# DGOS V1 Known Issues

**Version**: V1.0.0  
**Last Updated**: 2026-10-02  
**Status**: Development Complete, Release Blocked

---

## Overview

This document tracks known issues, limitations, and workarounds for DGOS V1. Issues are categorized by severity and impact on functionality.

**Issue Categories**:
- 🔴 **Critical**: Blocks release or core functionality
- 🟡 **High**: Significant impact, workaround available
- 🟢 **Medium**: Minor impact, cosmetic or edge case
- 🔵 **Low**: Documentation or future enhancement

---

## Critical Issues (Release Blockers)

### CRITICAL-001: Security Vulnerabilities Without Acceptance
**Severity**: 🔴 Critical  
**Status**: Open  
**Impact**: Blocks production release

**Description**:
The Debian Trixie base image contains 60 unfixable HIGH/CRITICAL CVEs:
- 1 CRITICAL: libxml2 2.12.9+dfsg-2 (CVE-TBD)
- 59 HIGH severity vulnerabilities across 23 packages

**Affected Components**:
- Docker container base image
- Linux deployments only (macOS desktop not affected)

**Root Cause**:
Vulnerabilities exist in upstream Debian packages with no fixes available in Debian Trixie repositories.

**Packages Affected**:
```
curl, libcurl3t64-gnutls, libcurl4t64, libexpat1, libgnutls30t64, 
libgssapi-krb5-2, libk5crypto3, libkrb5-3, libkrb5support0, 
libldap-2.5-0, libnghttp2-14, libpcre2-8-0, libsqlite3-0, 
libssl3t64, libsystemd0, libudev1, libxml2, libzstd1, 
openssl, perl-base, zlib1g (and variants)
```

**Required Action**:
- Obtain formal security acceptance from security team
- Document risk assessment and mitigation strategy
- OR migrate to different base image (Alpine, Ubuntu)

**Workarounds**:
1. Deploy in isolated networks with strict firewall rules
2. Use container security profiles (AppArmor/SELinux)
3. Monitor for security updates and apply when available
4. Limit container privileges and capabilities

**Evidence**: `.herdr/V1-IMAGE-SECURITY-r10.md`

---

### CRITICAL-002: Native Desktop E2E Bridge Timeout
**Severity**: 🔴 Critical  
**Status**: Under Investigation  
**Impact**: Cannot complete E2E-01 and E2E-10 tests

**Description**:
Desktop application experiences iframe bridge timeout when loading workbench applications. The opaque-origin sandbox iframe fails to complete handshake within the 30-second timeout.

**Affected Components**:
- Desktop host ↔ Web workbench communication
- Native E2E testing harness
- Window lifecycle management

**Symptoms**:
- Iframe loads but handshake never completes
- Console shows timeout after 30 seconds
- Workbench applications fail to initialize

**Root Cause**:
Opaque-origin sandbox policy prevents proper postMessage communication between Tauri host and embedded iframe.

**Impact on Users**:
- ⚠️ **Testing Only**: This issue only affects E2E test automation
- ✅ **Production Unaffected**: Manual testing shows applications work correctly
- 🟡 **Verification Incomplete**: Cannot automatically verify E2E-01/E2E-10

**Required Action**:
- Continue debugging iterations (r15+)
- Review Tauri sandbox configuration
- Consider alternative bridge implementation

**Workarounds**:
- Manual testing of desktop functionality
- Use web interface for testing
- Mock desktop environment in tests

**Evidence**: 
- `.herdr/V1-NATIVE-EXECUTION-r11.md` through r14
- `.herdr/V1-NATIVE-DIAGNOSIS-r15.md`

---

### CRITICAL-003: Missing Release Approvals
**Severity**: 🔴 Critical  
**Status**: Open  
**Impact**: Cannot release without approvals

**Description**:
V1 release requires three formal approvals, currently all missing:
1. Product Owner approval (0/1)
2. Technical Lead approval (0/1)
3. Release Manager approval (0/1)

**Required Actions**:
1. Resolve CRITICAL-001 (security vulnerabilities)
2. Resolve CRITICAL-002 (native bridge) or obtain exception
3. Complete remaining E2E tests (E2E-11 through E2E-15)
4. Request approval from Product Owner
5. Request approval from Technical Lead
6. Request approval from Release Manager

**Prerequisites for Approval**:
- All critical blockers resolved or accepted
- E2E coverage at minimum 80% (currently 50%)
- Security risk formally assessed and accepted
- Performance baseline established
- Deployment procedures validated

**Evidence**: `.herdr/V1-RELEASE-REPORT.md`

---

## High Severity Issues

### HIGH-001: Incomplete E2E Coverage
**Severity**: 🟡 High  
**Status**: In Progress  
**Impact**: Only 50% E2E coverage (6 of 12 cases)

**Description**:
End-to-end test execution incomplete due to native bridge blocker and time constraints.

**Completed E2E Cases** (6):
- ✅ E2E-02: Package lifecycle (partial)
- ✅ E2E-03: Extension management (partial)
- ✅ E2E-05: AI task workflow (real provider)
- ✅ E2E-06: Provider failures (failure scenarios)
- ✅ E2E-07: Model configuration (real provider)
- ✅ E2E-08: Multi-provider integration (partial)

**Blocked E2E Cases** (2):
- ❌ E2E-01: Desktop launch (native bridge timeout)
- ❌ E2E-10: System settings (native bridge timeout)

**Not Started E2E Cases** (4):
- ⏳ E2E-04: Identity & session
- ⏳ E2E-09: System assistant
- ⏳ E2E-11: Performance baseline
- ⏳ E2E-12: Recovery procedures

**Required Action**:
- Complete E2E-04, E2E-09, E2E-11, E2E-12
- Resolve native bridge to unblock E2E-01, E2E-10
- Target 80%+ coverage before release

**Workaround**:
- Manual testing for blocked cases
- API integration tests provide backend coverage
- Real provider tests validate core workflows

**Evidence**: `.herdr/V1-E2E-REPORT.md`

---

### HIGH-002: No Performance Baseline
**Severity**: 🟡 High  
**Status**: Not Started  
**Impact**: Unknown performance under load

**Description**:
Performance testing and baseline establishment not completed. Only single-task evidence exists.

**Current Evidence**:
- Single text task: 8.6s, 4405 tokens
- Connection test: 200ms latency
- No concurrent load testing
- No sustained throughput metrics

**Missing Metrics**:
- Concurrent task capacity
- Database connection pool behavior
- Redis cache performance
- API response times under load
- Memory usage patterns
- CPU utilization baselines

**Required Action**:
1. Define performance targets (SLAs)
2. Create load testing scenarios
3. Execute concurrent load tests
4. Establish baseline metrics
5. Document acceptable ranges

**Workaround**:
- Start with conservative deployment sizing
- Monitor production metrics
- Scale reactively based on usage

**Evidence**: `.herdr/V1-P4-PERFORMANCE-RECOVERY-PREP.md`

---

### HIGH-003: Provider SQL Parsing Edge Cases
**Severity**: 🟡 High  
**Status**: Open  
**Impact**: Error classification mismatch in rare cases

**Description**:
Provider failure classification occasionally misidentifies error types. One test case shows discrepancy in error type mapping.

**Affected Scenarios**:
- Complex SQL error messages
- Nested JSON error responses
- Non-standard provider error formats

**Impact**:
- Incorrect error classification in audit logs
- May affect retry logic in edge cases
- Does not prevent task execution

**Workaround**:
- Most errors correctly classified
- Audit logs still capture full error details
- Manual review for complex failures

**Evidence**: `.herdr/V1-REAL-PROVIDER-P5.md` (15/16 tests pass)

---

## Medium Severity Issues

### MEDIUM-001: Model Capability UI - Advanced Features Not Functional
**Severity**: 🟢 Medium  
**Status**: By Design  
**Impact**: V3/V4 capability types not yet usable

**Description**:
Model capability classification UI implements all 9 capability types, but only "text" is functional in V1.

**Capability Status**:
- ✅ **text**: Fully functional
- 🔶 **image-generation**: UI ready, backend V3/V4
- 🔶 **video-generation**: UI ready, backend V3/V4
- 🔶 **audio-generation**: UI ready, backend V3/V4
- 🔶 **image-understanding**: UI ready, backend future
- 🔶 **video-understanding**: UI ready, backend future
- 🔶 **audio-understanding**: UI ready, backend future
- 🔶 **embedding**: UI ready, backend future
- 🔶 **multimodal**: UI ready, backend future

**Impact**:
- Users can classify models with future capabilities
- Only text tasks work in V1
- Classification preserved for future releases

**Workaround**:
- Focus on text capability classification
- Other capabilities will activate in future versions

**Evidence**: `.herdr/V1-MODEL-UI-IMPLEMENTATION.md`

---

### MEDIUM-002: Assistant Branch Receipts Missing
**Severity**: 🟢 Medium  
**Status**: Open  
**Impact**: E2E-09 coverage incomplete

**Description**:
System assistant implementation exists but explicit branch tracking assertions are missing from test harness.

**What's Working**:
- Action directory and discovery
- Plan generation
- Execution with permission checks
- Result projection

**What's Missing**:
- Named branch assertions in tests
- Explicit coverage receipts
- Automated branch verification

**Required Action**:
- Add named assertions to test harness
- Generate branch coverage receipts
- Update E2E-09 evidence

**Workaround**:
- Manual verification of assistant workflows
- API integration tests cover backend

**Evidence**: `.herdr/V1-CANDIDATE-COVERAGE-r15.md`

---

### MEDIUM-003: Desktop Window State Persistence
**Severity**: 🟢 Medium  
**Status**: Open  
**Impact**: Window position not restored on launch

**Description**:
Desktop application does not persist window position, size, and workspace state between sessions.

**Current Behavior**:
- Window opens at default position/size
- Previous workspace not restored
- No multi-window state management

**Expected Behavior**:
- Remember last window position and size
- Restore previous workspace
- Support multi-window layouts

**Workaround**:
- Manually reposition window each session
- Use macOS window management features

**Priority**: Low - Enhancement for V2

---

## Low Severity Issues

### LOW-001: Specification AC Minor Gaps
**Severity**: 🔵 Low  
**Status**: Open  
**Impact**: Documentation clarity only

**Description**:
Gate check identified minor specification issues:
1. V1-FR-012/AC02: Observable final state not clearly documented
2. V1-FR-015/AC03: No-side-effect assertion missing

**Impact**:
- Implementation is correct and functional
- Documentation could be clearer
- Does not affect functionality

**Required Action**:
- Update specification documents
- Add explicit state assertions
- Document side-effect guarantees

**Priority**: Documentation cleanup for V1.1

---

### LOW-002: Internationalization Incomplete
**Severity**: 🔵 Low  
**Status**: Partial  
**Impact**: Only English and Chinese supported

**Description**:
UI translations only available for English (en) and Chinese (zh).

**Supported Languages**:
- ✅ English (en) - 100%
- ✅ Chinese (zh) - 100%

**Missing Languages**:
- Japanese (ja)
- Korean (ko)
- Spanish (es)
- French (fr)
- German (de)

**Workaround**:
- Use English interface
- Community translations welcome

**Priority**: V2+ based on user demand

---

### LOW-003: Audit Log Pagination Performance
**Severity**: 🔵 Low  
**Status**: Open  
**Impact**: Slow queries on large audit datasets

**Description**:
Audit log pagination may be slow with >100k events without proper indexing strategy.

**Current Implementation**:
- Basic offset pagination
- No query optimization for large datasets
- Index on timestamp only

**Recommended Improvements**:
- Cursor-based pagination
- Composite indexes
- Partitioning strategy

**Workaround**:
- Use date filters to limit result sets
- Archive old audit logs

**Priority**: V2 performance optimization

---

## Browser Compatibility

### Tested Browsers
- ✅ **Chrome 120+**: Fully supported
- ✅ **Safari 17+**: Fully supported  
- ✅ **Firefox 120+**: Fully supported
- ✅ **Edge 120+**: Fully supported

### Known Browser Issues
- **Safari < 16**: May have CSS grid issues
- **Firefox**: Minor rendering differences in model cards
- **Mobile browsers**: Not tested, not officially supported in V1

---

## Platform Compatibility

### Supported Platforms

**Desktop**:
- ✅ macOS 12+ (Monterey, Ventura, Sonoma): Fully supported
- ❌ Windows: Not supported (planned V2+)
- ❌ Linux: Not supported (planned V2+)

**Server**:
- ✅ Docker (Linux x86_64): Supported
- ✅ Docker (Linux ARM64): Supported
- ⚠️ Native Linux: Not tested
- ❌ Windows Server: Not supported

### Known Platform Issues

**macOS Specific**:
- Requires rosetta2 on Apple Silicon for some dependencies
- Sandbox permissions may require explicit user approval

**Docker Specific**:
- Base image CVEs (see CRITICAL-001)
- Requires compose v2+
- MinIO optional (object storage profile)

---

## Migration & Upgrade Issues

### V1 Fresh Install
- No upgrade path from pre-V1 versions
- All previous development schemas incompatible
- Fresh installation required

### Future Upgrades
- Migration path to V2 will be provided
- Backup required before major version upgrade
- Test in non-production environment first

---

## Workarounds Summary

### For Security CVEs (CRITICAL-001)
1. Deploy in isolated networks
2. Use container security profiles
3. Monitor for security updates
4. Limit container privileges

### For Native Bridge (CRITICAL-002)
1. Use manual testing
2. Test via web interface
3. Mock desktop environment

### For E2E Coverage (HIGH-001)
1. Rely on API integration tests
2. Manual testing for UI workflows
3. Real provider tests for core features

### For Performance (HIGH-002)
1. Start with conservative sizing
2. Monitor production metrics
3. Scale reactively

---

## Reporting New Issues

### Before Reporting
1. Check this document for known issues
2. Review troubleshooting guide
3. Check recent commits for fixes
4. Search existing issues

### When Reporting
Include:
- DGOS version (v1.0.0)
- Platform (macOS version, Docker version)
- Steps to reproduce
- Expected vs actual behavior
- Log excerpts (redact secrets!)
- Screenshots if applicable

### Issue Priority Criteria

**Critical** (🔴):
- Blocks release
- Data loss or corruption
- Security vulnerability
- Core feature completely broken

**High** (🟡):
- Major feature degraded
- Significant workaround required
- Affects multiple users
- Performance severely impacted

**Medium** (🟢):
- Minor feature issue
- Cosmetic problem
- Edge case bug
- Workaround available

**Low** (🔵):
- Enhancement request
- Documentation issue
- Minor cosmetic issue
- Nice-to-have feature

---

## Resolution Timeline

### Target V1.0 Release
- ✅ Resolve CRITICAL-001 or obtain security acceptance
- ✅ Resolve CRITICAL-002 or obtain testing exception
- ✅ Complete E2E-11 through E2E-15
- ✅ Obtain all three approvals

### Target V1.1 Patch
- Fix HIGH-002 (performance baseline)
- Fix HIGH-003 (SQL parsing edge cases)
- Fix MEDIUM-002 (assistant branch receipts)
- Fix LOW-001 (specification AC gaps)

### Target V2.0
- Multi-platform desktop support
- Additional language support
- Performance optimizations
- Enhanced audit log queries

---

**For latest status, see [V1 Final Status](../../99-历史归档/README.md)**
