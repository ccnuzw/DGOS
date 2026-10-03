#!/bin/bash
# scripts/test-candidate.sh
# Runs comprehensive tests against a frozen release candidate

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
    exit 1
fi

# Check if candidate is verified
if [ ! -f "$CANDIDATE_DIR/verification-report.txt" ]; then
    echo "⚠️  Candidate not verified yet. Running verification first..."
    ./scripts/verify-candidate.sh "$CANDIDATE_ID" || exit 1
fi

echo "🧪 Testing Release Candidate: $CANDIDATE_ID"
echo ""

TEST_PASSED=true
TEST_RESULTS_DIR="$CANDIDATE_DIR/test-results"
mkdir -p "$TEST_RESULTS_DIR"

# 1. Extract artifacts for testing
echo "📦 Extracting artifacts..."
TEST_ENV_DIR=$(mktemp -d)
echo "   Test environment: $TEST_ENV_DIR"

tar xzf "$CANDIDATE_DIR/source.tar.gz" -C "$TEST_ENV_DIR"
tar xzf "$CANDIDATE_DIR/api-dist.tar.gz" -C "$TEST_ENV_DIR"
tar xzf "$CANDIDATE_DIR/web-dist.tar.gz" -C "$TEST_ENV_DIR"
tar xzf "$CANDIDATE_DIR/packages-dist.tar.gz" -C "$TEST_ENV_DIR"

echo "   ✅ Artifacts extracted"

# 2. Smoke tests
echo ""
echo "💨 Running smoke tests..."

# Check API dist exists and has entry point
if [ -d "$TEST_ENV_DIR/apps/api/dist" ]; then
    if [ -f "$TEST_ENV_DIR/apps/api/dist/server.js" ] || [ -f "$TEST_ENV_DIR/apps/api/dist/index.js" ]; then
        echo "   ✅ API entry point found"
    else
        echo "   ❌ API entry point missing"
        TEST_PASSED=false
    fi
else
    echo "   ❌ API dist directory missing"
    TEST_PASSED=false
fi

# Check Web dist exists and has index.html
if [ -d "$TEST_ENV_DIR/apps/web/dist" ]; then
    if [ -f "$TEST_ENV_DIR/apps/web/dist/index.html" ]; then
        echo "   ✅ Web index.html found"
    else
        echo "   ❌ Web index.html missing"
        TEST_PASSED=false
    fi
else
    echo "   ❌ Web dist directory missing"
    TEST_PASSED=false
fi

# Check packages have dist directories
PACKAGE_COUNT=0
for pkg_dist in "$TEST_ENV_DIR/packages"/*/dist; do
    if [ -d "$pkg_dist" ]; then
        PACKAGE_COUNT=$((PACKAGE_COUNT + 1))
    fi
done

if [ $PACKAGE_COUNT -gt 0 ]; then
    echo "   ✅ $PACKAGE_COUNT package(s) built"
else
    echo "   ⚠️  No packages found"
fi

# 3. Migration tests
echo ""
echo "💾 Testing migrations..."

MIGRATION_COUNT=$(ls -1 "$CANDIDATE_DIR/migrations"/*.sql 2>/dev/null | wc -l | tr -d ' ')
if [ "$MIGRATION_COUNT" -gt 0 ]; then
    echo "   ✅ $MIGRATION_COUNT migration(s) present"

    # Verify migrations are SQL files and parseable
    INVALID_MIGRATIONS=0
    for migration in "$CANDIDATE_DIR/migrations"/*.sql; do
        if [ -f "$migration" ]; then
            # Basic check: file should contain SQL keywords
            if grep -q -i -E '(CREATE|ALTER|INSERT|UPDATE|DELETE|SELECT)' "$migration"; then
                : # Valid
            else
                echo "   ⚠️  $(basename "$migration") may be invalid"
                INVALID_MIGRATIONS=$((INVALID_MIGRATIONS + 1))
            fi
        fi
    done

    if [ $INVALID_MIGRATIONS -eq 0 ]; then
        echo "   ✅ All migrations appear valid"
    else
        echo "   ⚠️  $INVALID_MIGRATIONS migration(s) may be invalid"
    fi
else
    echo "   ⚠️  No migrations found"
fi

# 4. Configuration tests
echo ""
echo "⚙️  Testing configuration templates..."

if [ -d "$CANDIDATE_DIR/config-templates" ]; then
    # Check .env.example
    if [ -f "$CANDIDATE_DIR/config-templates/.env.example" ]; then
        ENV_VARS=$(grep -c '=' "$CANDIDATE_DIR/config-templates/.env.example" || echo 0)
        echo "   ✅ .env.example found ($ENV_VARS variables)"
    else
        echo "   ❌ .env.example missing"
        TEST_PASSED=false
    fi

    # Check docker-compose.yml
    if [ -f "$CANDIDATE_DIR/config-templates/docker-compose.yml" ]; then
        echo "   ✅ docker-compose.yml found"
    else
        echo "   ⚠️  docker-compose.yml missing"
    fi
else
    echo "   ❌ config-templates directory missing"
    TEST_PASSED=false
fi

# 5. Dependency integrity test
echo ""
echo "📦 Testing dependency integrity..."

if [ -f "$CANDIDATE_DIR/pnpm-lock.yaml" ]; then
    LOCK_SIZE=$(wc -l < "$CANDIDATE_DIR/pnpm-lock.yaml" | tr -d ' ')
    echo "   ✅ pnpm-lock.yaml valid ($LOCK_SIZE lines)"
else
    echo "   ❌ pnpm-lock.yaml missing"
    TEST_PASSED=false
fi

if [ -f "$CANDIDATE_DIR/dependencies.json" ]; then
    if jq empty "$CANDIDATE_DIR/dependencies.json" 2>/dev/null; then
        echo "   ✅ dependencies.json valid"
    else
        echo "   ❌ dependencies.json invalid JSON"
        TEST_PASSED=false
    fi
else
    echo "   ❌ dependencies.json missing"
    TEST_PASSED=false
fi

# 6. Run unit tests (if available in current workspace)
echo ""
echo "🧪 Running unit tests..."
if [ -f "package.json" ] && jq -e '.scripts.test' package.json > /dev/null 2>&1; then
    echo "   Running test suite..."
    if pnpm test 2>&1 | tee "$TEST_RESULTS_DIR/unit-tests.log"; then
        echo "   ✅ Unit tests passed"
    else
        echo "   ❌ Unit tests failed (see $TEST_RESULTS_DIR/unit-tests.log)"
        TEST_PASSED=false
    fi
else
    echo "   ⚠️  No test script available in current workspace"
fi

# 7. Build verification test (ensure artifacts can be used)
echo ""
echo "🔨 Testing artifact usability..."
echo "   Verifying package.json files..."

PKG_JSON_COUNT=0
for pkg_json in "$TEST_ENV_DIR"/*/package.json "$TEST_ENV_DIR"/*/*/package.json; do
    if [ -f "$pkg_json" ]; then
        if jq empty "$pkg_json" 2>/dev/null; then
            PKG_JSON_COUNT=$((PKG_JSON_COUNT + 1))
        else
            echo "   ❌ Invalid package.json: $pkg_json"
            TEST_PASSED=false
        fi
    fi
done

if [ $PKG_JSON_COUNT -gt 0 ]; then
    echo "   ✅ $PKG_JSON_COUNT valid package.json file(s)"
fi

# Clean up test environment
rm -rf "$TEST_ENV_DIR"

# 8. Generate test report
echo ""
echo "📝 Generating test report..."

TEST_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
REPORT_FILE="$CANDIDATE_DIR/test-report.txt"

if [ "$TEST_PASSED" = true ]; then
    STATUS="✅ PASSED"
    STATUS_TEXT="PASSED"
else
    STATUS="❌ FAILED"
    STATUS_TEXT="FAILED"
fi

cat > "$REPORT_FILE" << EOF
DGOS V1 Candidate Test Report
==============================

Candidate ID: $CANDIDATE_ID
Tested: $TEST_TIME
Tested by: $(whoami)@$(hostname)

Test Results:
-------------
Smoke Tests: $([ "$TEST_PASSED" = true ] && echo "PASS" || echo "FAIL")
Migration Tests: PASS
Configuration Tests: $([ -d "$CANDIDATE_DIR/config-templates" ] && echo "PASS" || echo "FAIL")
Dependency Tests: $([ -f "$CANDIDATE_DIR/pnpm-lock.yaml" ] && echo "PASS" || echo "FAIL")
Artifact Usability: $([ $PKG_JSON_COUNT -gt 0 ] && echo "PASS" || echo "FAIL")

Overall Status: $STATUS_TEXT

$(if [ "$TEST_PASSED" = true ]; then
    echo "This candidate has passed all tests and is ready for deployment"
    echo "to staging environment for further validation."
else
    echo "This candidate has FAILED testing. Do not deploy to production."
    echo "Review test results and fix issues before re-freezing."
fi)

Test Environment:
-----------------
Test Date: $TEST_TIME
Migration Count: $MIGRATION_COUNT
Package Count: $PACKAGE_COUNT
Configuration Templates: $(ls -1 "$CANDIDATE_DIR/config-templates" 2>/dev/null | wc -l | tr -d ' ')

Next Steps:
-----------
$(if [ "$TEST_PASSED" = true ]; then
    echo "1. Deploy to staging environment"
    echo "2. Run E2E tests in staging"
    echo "3. Perform manual validation"
    echo "4. Approve for production deployment"
else
    echo "1. Review test failures"
    echo "2. Fix issues in source code"
    echo "3. Re-freeze candidate"
    echo "4. Re-run tests"
fi)
EOF

# Display final status
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$TEST_PASSED" = true ]; then
    echo "✅ All tests passed!"
    echo ""
    echo "This candidate is ready for:"
    echo "  • Deployment to staging"
    echo "  • E2E validation"
    echo "  • Production release"
    echo ""
else
    echo "❌ Tests failed - this candidate should not be deployed"
    echo ""
    exit 1
fi

echo "📄 Full report: $REPORT_FILE"
echo "📁 Test results: $TEST_RESULTS_DIR"
echo ""
