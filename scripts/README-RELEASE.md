# Release Candidate Scripts

Core scripts for the V1 unified candidate freeze and verification system.

## Overview

These scripts implement the "freeze → verify → test → deploy" workflow that ensures **"what we test is what we ship"**.

---

## Scripts

### `freeze-candidate.sh`
**Purpose**: Creates an immutable release candidate with complete traceability.

**Usage**:
```bash
./scripts/freeze-candidate.sh
```

**What it does**:
1. Checks working tree is clean
2. Records git commit, branch, timestamp
3. Creates timestamped candidate directory
4. Packages source code as tar.gz
5. Builds all components (API, Web, Packages, Desktop)
6. Collects migrations and config templates
7. Generates SHA-256 checksums
8. Creates manifest.json with metadata
9. Creates git tag for traceability

**Output**: Candidate ID (e.g., `v1.0.0-rc.20261003.010000`)

**Requirements**:
- Clean git working tree
- pnpm installed
- All dependencies installed

---

### `verify-candidate.sh`
**Purpose**: Verifies integrity of a frozen candidate.

**Usage**:
```bash
./scripts/verify-candidate.sh <candidate-id>
```

**Example**:
```bash
./scripts/verify-candidate.sh v1.0.0-rc.20261003.010000
```

**What it does**:
1. Verifies manifest.json exists
2. Checks all required artifacts present
3. Validates SHA-256 checksums
4. Verifies migration count and integrity
5. Checks dependency files present
6. Tests artifact extraction
7. Verifies configuration templates
8. Generates verification report

**Output**: 
- Exit code 0 = ✅ VERIFIED
- Exit code 1 = ❌ FAILED
- Verification report in candidate directory

---

### `test-candidate.sh`
**Purpose**: Runs comprehensive tests on a frozen candidate.

**Usage**:
```bash
./scripts/test-candidate.sh <candidate-id>
```

**Example**:
```bash
./scripts/test-candidate.sh v1.0.0-rc.20261003.010000
```

**What it does**:
1. Runs verification first (if not already done)
2. Extracts artifacts to temp directory
3. Runs smoke tests (entry points, files exist)
4. Validates migrations (SQL syntax)
5. Tests configuration templates
6. Checks dependency integrity
7. Runs unit tests (if available)
8. Verifies artifact usability
9. Generates test report

**Output**:
- Exit code 0 = ✅ PASSED
- Exit code 1 = ❌ FAILED
- Test report in candidate directory
- Test logs in test-results/ subdirectory

---

## Workflow

### Standard Release Flow

```
1. Freeze
   ↓
2. Verify (automated)
   ↓
3. Test (automated)
   ↓
4. Deploy to Staging
   ↓
5. E2E Validation
   ↓
6. Deploy to Production
```

### Command Sequence

```bash
# 1. Freeze
./scripts/freeze-candidate.sh
# Output: v1.0.0-rc.20261003.010000

# 2. Verify
./scripts/verify-candidate.sh v1.0.0-rc.20261003.010000
# Output: ✅ VERIFIED

# 3. Test
./scripts/test-candidate.sh v1.0.0-rc.20261003.010000
# Output: ✅ PASSED

# 4. Deploy (manual or scripted)
# ... deployment steps ...
```

---

## Candidate Structure

```
candidates/v1.0.0-rc.20261003.010000/
├── manifest.json              # Metadata + checksums
├── README.md                  # Candidate overview
├── verification-report.txt    # Verification results
├── test-report.txt           # Test results
├── source.tar.gz             # Source code (SHA-256)
├── api-dist.tar.gz           # Built API (SHA-256)
├── web-dist.tar.gz           # Built Web (SHA-256)
├── packages-dist.tar.gz      # Built packages (SHA-256)
├── desktop-dist.tar.gz       # Built desktop (optional)
├── dependencies.json         # Dependency tree
├── pnpm-lock.yaml           # Lock file
├── migrations/               # Database migrations
│   └── *.sql
├── config-templates/         # Configuration templates
│   ├── .env.example
│   ├── docker-compose.yml
│   └── docker-compose.production.yml
└── test-results/             # Test outputs
    └── unit-tests.log
```

---

## Exit Codes

All scripts use standard exit codes:
- **0**: Success
- **1**: Failure

Always check exit codes in automation:
```bash
if ./scripts/verify-candidate.sh "$CANDIDATE_ID"; then
    echo "Verification passed"
else
    echo "Verification failed"
    exit 1
fi
```

---

## Integration with CI/CD

### GitHub Actions

Workflow file: `.github/workflows/freeze-candidate.yml`

**Trigger manually**:
1. Go to Actions tab
2. Select "Freeze Release Candidate"
3. Click "Run workflow"
4. Enter version number
5. Choose whether to run tests

**Automated steps**:
- Freeze candidate
- Verify candidate
- Test candidate (optional)
- Upload artifacts (90-day retention)
- Create git tag
- Create GitHub release (prerelease)

---

## Troubleshooting

### freeze-candidate.sh

**Error**: "Uncommitted changes detected"
```bash
# Solution: Commit or stash changes
git status
git add .
git commit -m "Prepare for freeze"
```

**Error**: Build fails
```bash
# Solution: Fix build errors first
pnpm build
# Fix any errors, then retry freeze
```

### verify-candidate.sh

**Error**: "Candidate not found"
```bash
# Solution: Check candidate ID
ls -lt candidates/
./scripts/verify-candidate.sh <correct-id>
```

**Error**: "Checksum verification failed"
```bash
# Solution: Candidate is corrupted, re-freeze
./scripts/freeze-candidate.sh
```

### test-candidate.sh

**Error**: "Tests failed"
```bash
# Solution: Review test output
cat candidates/$CANDIDATE_ID/test-results/unit-tests.log
# Fix issues in source, then re-freeze
```

---

## Best Practices

### 1. Always Start Clean
```bash
git status  # Should show clean working tree
```

### 2. Never Skip Verification
```bash
# Always verify before testing or deploying
./scripts/verify-candidate.sh $CANDIDATE_ID
```

### 3. Test Before Deploy
```bash
# Always test before any deployment
./scripts/test-candidate.sh $CANDIDATE_ID
```

### 4. Keep Candidates Immutable
Never modify a frozen candidate. If changes needed:
```bash
# Make changes in source
git commit -m "Fix issue"
# Freeze NEW candidate
./scripts/freeze-candidate.sh
```

### 5. Use Same Artifacts Everywhere
Deploy the **exact same** artifacts to staging and production:
```bash
# Same tar.gz files from candidates/ directory
```

---

## Security

### Checksums
All artifacts have SHA-256 checksums in `manifest.json`.

Verify manually:
```bash
cd candidates/v1.0.0-rc.20261003.010000
sha256sum api-dist.tar.gz
jq -r '.artifacts.api.checksum' manifest.json
# Should match
```

### Git Tags
Every candidate is tagged:
```bash
git tag -l 'v1.0.0-rc.*'
git show v1.0.0-rc.20261003.010000
```

### Traceability
Full audit trail in `manifest.json`:
- Commit SHA
- Build timestamp
- Build host and user
- All checksums

---

## Documentation

- **Full Guide**: `docs/release/candidate-freeze-guide.md`
- **Quick Reference**: `docs/release/QUICK-REFERENCE.md`
- **GitHub Workflow**: `.github/workflows/freeze-candidate.yml`

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review `docs/release/candidate-freeze-guide.md`
3. Check script output and logs
4. Review candidate reports (`verification-report.txt`, `test-report.txt`)

---

## Version

**System Version**: 1.0.0
**Created**: 2026-10-03
**Purpose**: V1 Release Foundation - Unified Candidate Freeze System
