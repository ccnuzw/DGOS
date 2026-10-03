#!/bin/bash
# scripts/verify-candidate.sh
# Verifies a frozen release candidate's integrity

set -euo pipefail

if [ $# -eq 0 ]; then
    echo "Usage: $0 <candidate-id>"
    echo ""
    echo "Example: $0 v1.0.0-rc.20261003.010000"
    exit 1
fi

CANDIDATE_ID=$1
CANDIDATE_DIR="candidates/$CANDIDATE_ID"

if [ ! -d "$CANDIDATE_DIR" ]; then
    echo "❌ Candidate not found: $CANDIDATE_ID"
    echo ""
    echo "Available candidates:"
    ls -1 candidates/ 2>/dev/null || echo "  (none)"
    exit 1
fi

echo "🔍 Verifying Candidate: $CANDIDATE_ID"
echo ""

VERIFICATION_PASSED=true

# 1. Verify manifest exists
echo "📋 Checking manifest..."
if [ ! -f "$CANDIDATE_DIR/manifest.json" ]; then
    echo "   ❌ manifest.json missing"
    VERIFICATION_PASSED=false
else
    echo "   ✅ manifest.json found"

    # Display metadata
    COMMIT=$(jq -r '.commit' "$CANDIDATE_DIR/manifest.json")
    TIMESTAMP=$(jq -r '.timestamp' "$CANDIDATE_DIR/manifest.json")
    echo "   📝 Commit: ${COMMIT:0:7}"
    echo "   ⏰ Frozen: $TIMESTAMP"
fi

# 2. Verify all artifacts exist
echo ""
echo "📦 Checking artifacts..."
MISSING=0
REQUIRED_ARTIFACTS=(
    "source.tar.gz"
    "api-dist.tar.gz"
    "web-dist.tar.gz"
    "packages-dist.tar.gz"
)

for artifact in "${REQUIRED_ARTIFACTS[@]}"; do
    if [ ! -f "$CANDIDATE_DIR/$artifact" ]; then
        echo "   ❌ Missing: $artifact"
        MISSING=$((MISSING + 1))
        VERIFICATION_PASSED=false
    else
        SIZE=$(du -h "$CANDIDATE_DIR/$artifact" | cut -f1)
        echo "   ✅ Found: $artifact ($SIZE)"
    fi
done

# Check optional desktop artifact
if [ -f "$CANDIDATE_DIR/desktop-dist.tar.gz" ]; then
    SIZE=$(du -h "$CANDIDATE_DIR/desktop-dist.tar.gz" | cut -f1)
    echo "   ✅ Found: desktop-dist.tar.gz ($SIZE)"
fi

if [ $MISSING -gt 0 ]; then
    echo ""
    echo "   ❌ $MISSING required artifacts missing"
    VERIFICATION_PASSED=false
fi

# 3. Verify checksums
echo ""
echo "🔐 Verifying checksums..."
cd "$CANDIDATE_DIR"

# Create temporary checksum file
jq -r '.artifacts | to_entries[] | "\(.value.checksum)  \(.value.file)"' manifest.json > expected-checksums.txt

CHECKSUM_FAILED=0
while IFS= read -r line; do
    EXPECTED_CHECKSUM=$(echo "$line" | cut -d' ' -f1)
    FILE=$(echo "$line" | cut -d' ' -f3)

    if [ -f "$FILE" ]; then
        ACTUAL_CHECKSUM=$(sha256sum "$FILE" | cut -d' ' -f1)
        if [ "$EXPECTED_CHECKSUM" = "$ACTUAL_CHECKSUM" ]; then
            echo "   ✅ $FILE"
        else
            echo "   ❌ $FILE (checksum mismatch)"
            CHECKSUM_FAILED=$((CHECKSUM_FAILED + 1))
            VERIFICATION_PASSED=false
        fi
    fi
done < expected-checksums.txt

rm expected-checksums.txt
cd - > /dev/null

if [ $CHECKSUM_FAILED -gt 0 ]; then
    echo ""
    echo "   ❌ $CHECKSUM_FAILED checksum(s) failed"
    VERIFICATION_PASSED=false
fi

# 4. Verify migration integrity
echo ""
echo "💾 Verifying migrations..."
if [ -f "$CANDIDATE_DIR/manifest.json" ]; then
    EXPECTED_MIGRATION_COUNT=$(jq -r '.migrations.count' "$CANDIDATE_DIR/manifest.json")
    ACTUAL_MIGRATION_COUNT=$(ls -1 "$CANDIDATE_DIR/migrations"/*.sql 2>/dev/null | wc -l | tr -d ' ')

    if [ "$EXPECTED_MIGRATION_COUNT" -eq "$ACTUAL_MIGRATION_COUNT" ]; then
        echo "   ✅ All $ACTUAL_MIGRATION_COUNT migrations present"
    else
        echo "   ❌ Migration count mismatch: expected $EXPECTED_MIGRATION_COUNT, found $ACTUAL_MIGRATION_COUNT"
        VERIFICATION_PASSED=false
    fi
else
    echo "   ⚠️  Cannot verify migrations (manifest missing)"
fi

# 5. Verify dependency files
echo ""
echo "📦 Verifying dependencies..."
if [ -f "$CANDIDATE_DIR/pnpm-lock.yaml" ]; then
    echo "   ✅ pnpm-lock.yaml present"
else
    echo "   ❌ pnpm-lock.yaml missing"
    VERIFICATION_PASSED=false
fi

if [ -f "$CANDIDATE_DIR/dependencies.json" ]; then
    echo "   ✅ dependencies.json present"
else
    echo "   ❌ dependencies.json missing"
    VERIFICATION_PASSED=false
fi

# 6. Test artifact extraction
echo ""
echo "🧪 Testing artifact extraction..."
TEST_DIR=$(mktemp -d)
EXTRACTION_FAILED=0

for artifact in source.tar.gz api-dist.tar.gz web-dist.tar.gz packages-dist.tar.gz; do
    if [ -f "$CANDIDATE_DIR/$artifact" ]; then
        if tar tzf "$CANDIDATE_DIR/$artifact" > /dev/null 2>&1; then
            echo "   ✅ $artifact extracts successfully"
        else
            echo "   ❌ $artifact extraction failed"
            EXTRACTION_FAILED=$((EXTRACTION_FAILED + 1))
            VERIFICATION_PASSED=false
        fi
    fi
done

rm -rf "$TEST_DIR"

if [ $EXTRACTION_FAILED -gt 0 ]; then
    echo ""
    echo "   ❌ $EXTRACTION_FAILED artifact(s) failed extraction"
    VERIFICATION_PASSED=false
fi

# 7. Verify configuration templates
echo ""
echo "⚙️  Verifying configuration templates..."
if [ -d "$CANDIDATE_DIR/config-templates" ]; then
    TEMPLATE_COUNT=$(ls -1 "$CANDIDATE_DIR/config-templates" | wc -l | tr -d ' ')
    echo "   ✅ $TEMPLATE_COUNT configuration template(s) present"
else
    echo "   ❌ config-templates directory missing"
    VERIFICATION_PASSED=false
fi

# 8. Generate verification report
echo ""
echo "📝 Generating verification report..."

REPORT_FILE="$CANDIDATE_DIR/verification-report.txt"
VERIFICATION_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

if [ "$VERIFICATION_PASSED" = true ]; then
    STATUS="✅ VERIFIED"
    STATUS_TEXT="PASS"
else
    STATUS="❌ FAILED"
    STATUS_TEXT="FAIL"
fi

cat > "$REPORT_FILE" << EOF
DGOS V1 Candidate Verification Report
======================================

Candidate ID: $CANDIDATE_ID
Verified: $VERIFICATION_TIME
Verified by: $(whoami)@$(hostname)

Verification Results:
---------------------
Manifest Check: $([ -f "$CANDIDATE_DIR/manifest.json" ] && echo "PASS" || echo "FAIL")
Artifact Integrity: $([ $MISSING -eq 0 ] && echo "PASS" || echo "FAIL")
Checksum Verification: $([ $CHECKSUM_FAILED -eq 0 ] && echo "PASS" || echo "FAIL")
Migration Integrity: $([ -d "$CANDIDATE_DIR/migrations" ] && echo "PASS" || echo "FAIL")
Extraction Test: $([ $EXTRACTION_FAILED -eq 0 ] && echo "PASS" || echo "FAIL")

Overall Status: $STATUS_TEXT

$(if [ "$VERIFICATION_PASSED" = true ]; then
    echo "This candidate has passed all verification checks and is ready"
    echo "for testing and deployment."
else
    echo "This candidate has FAILED verification. Do not deploy."
    echo "Review the errors above and re-freeze if necessary."
fi)

Verified Artifacts:
-------------------
$(ls -lh "$CANDIDATE_DIR"/*.tar.gz 2>/dev/null | awk '{print $9, "(" $5 ")"}' | xargs -n2)

Metadata:
---------
$(cat "$CANDIDATE_DIR/manifest.json" 2>/dev/null | jq -r '"Commit: \(.commit)\nBranch: \(.branch)\nFrozen: \(.timestamp)\nBuilder: \(.buildUser)@\(.buildHost)"' || echo "Manifest not available")
EOF

echo "   ✅ Report generated"

# Display final status
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$VERIFICATION_PASSED" = true ]; then
    echo "✅ All verification checks passed!"
    echo ""
    echo "This candidate is ready for:"
    echo "  • Testing: ./scripts/test-candidate.sh $CANDIDATE_ID"
    echo "  • Deployment to staging"
    echo ""
else
    echo "❌ Verification failed - this candidate should not be deployed"
    echo ""
    echo "Please review the errors above and:"
    echo "  • Fix any issues in the source"
    echo "  • Re-freeze the candidate"
    echo ""
    exit 1
fi

echo "📄 Full report: $REPORT_FILE"
echo ""
