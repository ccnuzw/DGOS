# Release Candidate Freeze Guide

## Overview

The unified candidate freeze system ensures that **"what we test is what we ship"** by creating immutable, traceable release candidates with complete artifact integrity verification.

## Key Principle

Every V1 release must go through the candidate freeze process. This eliminates the "no unified candidate execution" blocking issue by establishing a single source of truth for all release artifacts.

## System Components

### 1. Freeze Script (`scripts/freeze-candidate.sh`)
Creates a frozen release candidate containing:
- Complete source code archive
- All built artifacts (API, Web, Packages, Desktop)
- Database migrations
- Configuration templates
- Dependency manifests
- SHA-256 checksums for all artifacts
- Complete metadata and traceability

### 2. Verification Script (`scripts/verify-candidate.sh`)
Verifies candidate integrity:
- Manifest presence and validity
- All required artifacts present
- Checksum verification
- Migration integrity
- Extraction tests
- Configuration completeness

### 3. Test Script (`scripts/test-candidate.sh`)
Runs comprehensive tests:
- Smoke tests
- Migration validation
- Configuration tests
- Dependency integrity
- Unit tests (if available)
- Artifact usability

### 4. CI/CD Workflow (`.github/workflows/freeze-candidate.yml`)
Automated freezing via GitHub Actions with artifact storage and tagging.

---

## Quick Start

### Freeze a Candidate

```bash
./scripts/freeze-candidate.sh
```

This creates a new candidate in `candidates/v1.0.0-rc.YYYYMMDD.HHMMSS/` with:
- Unique timestamped ID
- Git commit reference
- All built artifacts
- Complete checksums
- Git tag for traceability

### Verify the Candidate

```bash
# Get the candidate ID from freeze output
CANDIDATE_ID=v1.0.0-rc.20261003.010000

# Verify integrity
./scripts/verify-candidate.sh $CANDIDATE_ID
```

Verification checks:
- ✅ All artifacts present
- ✅ Checksums valid
- ✅ Migrations complete
- ✅ Extraction works
- ✅ Configuration present

### Test the Candidate

```bash
./scripts/test-candidate.sh $CANDIDATE_ID
```

Testing validates:
- ✅ Smoke tests pass
- ✅ Migrations are valid SQL
- ✅ Configuration templates complete
- ✅ Dependencies intact
- ✅ Unit tests pass (if available)

---

## What Gets Frozen

### Source Code
- Complete git archive with commit reference
- Tagged in git for traceability
- SHA-256 checksum

### Built Artifacts
- **API**: `apps/api/dist` + `package.json`
- **Web**: `apps/web/dist` + `package.json`
- **Packages**: All `packages/*/dist` + `package.json`
- **Desktop**: (optional) `apps/desktop/target/release`

Each with SHA-256 checksum.

### Database Migrations
- All SQL files from `migrations/`
- Count verification
- Integrity checks

### Dependencies
- `pnpm-lock.yaml` (exact versions)
- `dependencies.json` (full tree)

### Configuration
- `.env.example`
- `docker-compose.yml`
- `docker-compose.production.yml` (if exists)
- `docker-compose.test.yml` (if exists)

### Metadata
- Candidate ID (unique timestamp-based)
- Git commit SHA
- Branch name
- Build timestamp (UTC)
- Build host and user
- Complete manifest JSON

---

## Candidate Directory Structure

```
candidates/
└── v1.0.0-rc.20261003.010000/
    ├── README.md                    # Candidate overview
    ├── manifest.json                # Complete metadata
    ├── verification-report.txt      # Verification results
    ├── test-report.txt             # Test results
    ├── source.tar.gz               # Source code
    ├── api-dist.tar.gz             # Built API
    ├── web-dist.tar.gz             # Built Web
    ├── packages-dist.tar.gz        # Built packages
    ├── desktop-dist.tar.gz         # Built desktop (optional)
    ├── dependencies.json           # Dependency tree
    ├── pnpm-lock.yaml             # Lock file
    ├── migrations/                 # Database migrations
    │   ├── 001_initial.sql
    │   ├── 002_add_users.sql
    │   └── ...
    ├── config-templates/           # Configuration files
    │   ├── .env.example
    │   ├── docker-compose.yml
    │   └── docker-compose.production.yml
    └── test-results/               # Test outputs
        └── unit-tests.log
```

---

## Traceability

### Git Tagging
Every candidate is automatically tagged:
```bash
git tag -a v1.0.0-rc.20261003.010000 -m "Release candidate"
```

### Manifest Contents
```json
{
  "candidateId": "v1.0.0-rc.20261003.010000",
  "version": "1.0.0-rc",
  "commit": "058d240abcdef...",
  "branch": "main",
  "timestamp": "2026-10-03T01:00:00Z",
  "buildHost": "ci-runner-01",
  "buildUser": "github-actions",
  "artifacts": {
    "source": {
      "file": "source.tar.gz",
      "checksum": "sha256:..."
    },
    "api": {
      "file": "api-dist.tar.gz",
      "checksum": "sha256:..."
    }
    // ... more artifacts
  }
}
```

---

## CI/CD Integration

### Manual Trigger via GitHub Actions

1. Go to **Actions** tab in GitHub
2. Select **Freeze Release Candidate** workflow
3. Click **Run workflow**
4. Enter version (e.g., `1.0.0-rc.1`)
5. Choose whether to run tests
6. Click **Run workflow**

The workflow will:
- ✅ Freeze the candidate
- ✅ Verify integrity
- ✅ Run tests (optional)
- ✅ Upload artifacts (90-day retention)
- ✅ Create git tag
- ✅ Create GitHub release (prerelease)

### Downloading Artifacts

1. Go to the workflow run
2. Scroll to **Artifacts** section
3. Download `release-candidate-v1.0.0-rc.YYYYMMDD.HHMMSS`
4. Extract and deploy

---

## Deployment Workflow

### 1. Freeze
```bash
./scripts/freeze-candidate.sh
```
**Output**: Candidate ID and location

### 2. Verify
```bash
./scripts/verify-candidate.sh <candidate-id>
```
**Output**: Verification report (PASS/FAIL)

### 3. Test
```bash
./scripts/test-candidate.sh <candidate-id>
```
**Output**: Test report (PASSED/FAILED)

### 4. Deploy to Staging
Extract artifacts and deploy:
```bash
CANDIDATE_ID=v1.0.0-rc.20261003.010000
cd candidates/$CANDIDATE_ID

# Extract to staging server
scp *.tar.gz user@staging:/opt/dgos/
ssh user@staging "cd /opt/dgos && tar xzf api-dist.tar.gz && tar xzf web-dist.tar.gz"

# Run migrations
scp -r migrations/ user@staging:/opt/dgos/
ssh user@staging "cd /opt/dgos && pnpm migrate"

# Start services
ssh user@staging "systemctl restart dgos-api dgos-web"
```

### 5. Validate in Staging
- Run E2E tests
- Manual smoke testing
- Performance validation
- Security checks

### 6. Approve for Production
If staging validation passes:
```bash
# Tag as production-ready
git tag -a v1.0.0 <candidate-id> -m "Production release V1.0.0"
git push origin v1.0.0
```

### 7. Deploy to Production
Use the **exact same artifacts** from the candidate:
```bash
# Deploy same artifacts to production
scp candidates/$CANDIDATE_ID/*.tar.gz user@production:/opt/dgos/
# ... same deployment steps as staging
```

---

## Best Practices

### 1. Clean Working Tree
Always freeze from a clean working tree:
```bash
git status  # Should be clean
git commit -am "Prepare for freeze"
./scripts/freeze-candidate.sh
```

### 2. Always Verify
Never skip verification:
```bash
./scripts/verify-candidate.sh $CANDIDATE_ID
# Check that status is "✅ VERIFIED"
```

### 3. Test Before Deploy
Run tests before any deployment:
```bash
./scripts/test-candidate.sh $CANDIDATE_ID
# Check that status is "✅ PASSED"
```

### 4. Artifact Retention
- CI artifacts: 90 days
- Local candidates: Keep until production release
- Production candidates: Archive indefinitely

### 5. Never Modify Candidates
Candidates are **immutable**. If changes are needed:
1. Make changes in source
2. Commit changes
3. Freeze a **new** candidate
4. Verify and test the new candidate

### 6. Use Git Tags
Every candidate is tagged. Use tags for traceability:
```bash
git log --oneline --decorate  # Shows tags
git show v1.0.0-rc.20261003.010000  # Shows candidate commit
```

---

## Troubleshooting

### "Uncommitted changes detected"
```bash
git status
git add .
git commit -m "Commit message"
./scripts/freeze-candidate.sh
```

### "Checksum verification failed"
Candidate is corrupted. Re-freeze:
```bash
./scripts/freeze-candidate.sh  # Creates new candidate
```

### "Build failed"
Fix build errors first:
```bash
pnpm build  # Fix any errors
./scripts/freeze-candidate.sh
```

### "Tests failed"
Review test output:
```bash
cat candidates/$CANDIDATE_ID/test-results/unit-tests.log
# Fix issues and re-freeze
```

---

## Advanced Usage

### List All Candidates
```bash
ls -lt candidates/
```

### Compare Two Candidates
```bash
diff candidates/v1.0.0-rc.A/manifest.json candidates/v1.0.0-rc.B/manifest.json
```

### Extract Specific Artifact
```bash
cd candidates/v1.0.0-rc.20261003.010000
tar tzf api-dist.tar.gz  # List contents
tar xzf api-dist.tar.gz  # Extract
```

### Verify Checksum Manually
```bash
cd candidates/v1.0.0-rc.20261003.010000
sha256sum api-dist.tar.gz
jq -r '.artifacts.api.checksum' manifest.json
# Should match
```

---

## Summary

The unified candidate freeze system provides:

✅ **Immutability**: Frozen artifacts cannot be modified
✅ **Traceability**: Complete git and build metadata
✅ **Integrity**: SHA-256 checksums for all artifacts
✅ **Repeatability**: Same artifacts from freeze to production
✅ **Verification**: Automated integrity checks
✅ **Testing**: Comprehensive test suite
✅ **CI/CD**: GitHub Actions integration
✅ **Documentation**: Complete audit trail

This eliminates the "no unified candidate execution" blocking issue and establishes the foundation for reliable V1 releases.
