# V1 Release Candidate System - Quick Reference

## 🚀 Quick Commands

### Create a Release Candidate
```bash
./scripts/freeze-candidate.sh
```
**Output**: Candidate ID (e.g., `v1.0.0-rc.20261003.010000`)

### Verify Integrity
```bash
./scripts/verify-candidate.sh v1.0.0-rc.20261003.010000
```
**Status**: ✅ VERIFIED or ❌ FAILED

### Run Tests
```bash
./scripts/test-candidate.sh v1.0.0-rc.20261003.010000
```
**Status**: ✅ PASSED or ❌ FAILED

### List All Candidates
```bash
ls -lt candidates/
```

---

## ✅ Release Checklist

- [ ] Clean working tree (`git status`)
- [ ] Freeze candidate (`./scripts/freeze-candidate.sh`)
- [ ] Verify candidate (✅ VERIFIED required)
- [ ] Test candidate (✅ PASSED required)
- [ ] Deploy to staging
- [ ] Run E2E tests in staging
- [ ] Manual validation
- [ ] Deploy to production (same artifacts)
- [ ] Tag production release

---

## 📦 What's in a Candidate?

```
candidates/v1.0.0-rc.YYYYMMDD.HHMMSS/
├── source.tar.gz           # Complete source code
├── api-dist.tar.gz         # Built API server
├── web-dist.tar.gz         # Built web frontend
├── packages-dist.tar.gz    # Built packages
├── migrations/             # Database migrations
├── config-templates/       # Configuration files
├── manifest.json           # Metadata + checksums
└── README.md              # Candidate info
```

---

## 🔍 Key Principles

1. **Immutable**: Never modify a frozen candidate
2. **Traceable**: Every candidate has git commit + tag
3. **Verified**: All checksums must pass
4. **Tested**: All tests must pass before deployment
5. **Identical**: Staging and production use same artifacts

---

## 🚨 Troubleshooting

### "Uncommitted changes detected"
```bash
git add . && git commit -m "Prepare for freeze"
```

### "Verification failed"
Re-freeze (candidate may be corrupted):
```bash
./scripts/freeze-candidate.sh
```

### "Tests failed"
Check test output, fix issues, re-freeze:
```bash
cat candidates/*/test-results/unit-tests.log
```

---

## 📚 Full Documentation

See: `docs/release/candidate-freeze-guide.md`

---

## 🤖 GitHub Actions

**Workflow**: `.github/workflows/freeze-candidate.yml`

1. Go to **Actions** tab
2. Select **Freeze Release Candidate**
3. Click **Run workflow**
4. Enter version number
5. Download artifacts from workflow run

Artifacts retained for **90 days**.

---

## ⭐ Critical Rules

❌ **NEVER** modify a frozen candidate
❌ **NEVER** skip verification
❌ **NEVER** deploy without testing
❌ **NEVER** deploy different artifacts to staging vs production

✅ **ALWAYS** freeze from clean working tree
✅ **ALWAYS** verify checksums
✅ **ALWAYS** run tests before deploy
✅ **ALWAYS** use same artifacts for staging and production
