#!/bin/bash
# scripts/freeze-candidate.sh
# Freezes a V1 release candidate with complete traceability

set -euo pipefail

CANDIDATE_ID="${CANDIDATE_ID:-v1.0.0-rc.$(date +%Y%m%d.%H%M%S)}"
CANDIDATE_DIR="candidates/$CANDIDATE_ID"

echo "🧊 Freezing V1 Release Candidate: $CANDIDATE_ID"
echo ""

# 1. Check source cleanliness
echo "📋 Checking source cleanliness..."
if [[ -n $(git status --porcelain) ]]; then
    echo "❌ Error: Uncommitted changes detected"
    git status --short
    exit 1
fi
echo "   ✅ Working tree is clean"

# 2. Record commit and metadata
COMMIT=$(git rev-parse HEAD)
COMMIT_SHORT=$(git rev-parse --short HEAD)
BRANCH=$(git branch --show-current)
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo ""
echo "📝 Candidate Metadata:"
echo "   Commit: $COMMIT"
echo "   Branch: $BRANCH"
echo "   Time: $TIMESTAMP"

# 3. Create candidate directory
echo ""
echo "📁 Creating candidate directory..."
mkdir -p "$CANDIDATE_DIR"

# 4. Package source code
echo ""
echo "📦 Packaging source code..."
git archive --format=tar.gz --prefix=dgos-$CANDIDATE_ID/ HEAD > "$CANDIDATE_DIR/source.tar.gz"
SOURCE_CHECKSUM=$(sha256sum "$CANDIDATE_DIR/source.tar.gz" | cut -d' ' -f1)
echo "   ✅ Source packaged (checksum: ${SOURCE_CHECKSUM:0:16}...)"

# 5. Build all components
echo ""
echo "🔨 Building all components..."

# Backend API
echo "   Building API..."
cd apps/api
pnpm build > /dev/null 2>&1
cd ../..
 tar czf "$CANDIDATE_DIR/api-dist.tar.gz" apps/api/src apps/api/package.json
API_SIZE=$(du -h "$CANDIDATE_DIR/api-dist.tar.gz" | cut -f1)
echo "   ✅ API built ($API_SIZE)"

# Web Frontend
echo "   Building Web..."
cd apps/web
pnpm build > /dev/null 2>&1
cd ../..
tar czf "$CANDIDATE_DIR/web-dist.tar.gz" apps/web/dist apps/web/package.json
WEB_SIZE=$(du -h "$CANDIDATE_DIR/web-dist.tar.gz" | cut -f1)
echo "   ✅ Web built ($WEB_SIZE)"

# Desktop (if available)
if [ -d "apps/desktop" ]; then
    echo "   Building Desktop..."
    cd apps/desktop
    if pnpm tauri build > /dev/null 2>&1; then
        cd ../..
        if [ -d "apps/desktop/target/release" ]; then
            tar czf "$CANDIDATE_DIR/desktop-dist.tar.gz" apps/desktop/target/release
            DESKTOP_SIZE=$(du -h "$CANDIDATE_DIR/desktop-dist.tar.gz" | cut -f1)
            echo "   ✅ Desktop built ($DESKTOP_SIZE)"
            HAS_DESKTOP=true
        fi
    else
        cd ../..
        echo "   ⚠️  Desktop build skipped (may not be ready)"
        HAS_DESKTOP=false
    fi
else
    HAS_DESKTOP=false
fi

# Packages
echo "   Building Packages..."
pnpm build --filter=./packages/* > /dev/null 2>&1
tar czf "$CANDIDATE_DIR/packages-dist.tar.gz" packages/*/dist packages/*/package.json
PACKAGES_SIZE=$(du -h "$CANDIDATE_DIR/packages-dist.tar.gz" | cut -f1)
echo "   ✅ Packages built ($PACKAGES_SIZE)"

# 6. Collect dependency manifest
echo ""
echo "📄 Collecting dependency manifest..."
pnpm list --json --depth=0 > "$CANDIDATE_DIR/dependencies.json" 2>/dev/null || echo "[]" > "$CANDIDATE_DIR/dependencies.json"
cp pnpm-lock.yaml "$CANDIDATE_DIR/"
echo "   ✅ Dependencies captured"

# 7. Collect migration files
echo ""
echo "💾 Collecting migrations..."
cp -r migrations "$CANDIDATE_DIR/"
MIGRATION_COUNT=$(ls -1 migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
echo "   ✅ $MIGRATION_COUNT migrations collected"

# 8. Collect configuration templates
echo ""
echo "⚙️  Collecting configuration templates..."
mkdir -p "$CANDIDATE_DIR/config-templates"
cp .env.example "$CANDIDATE_DIR/config-templates/"
cp docker-compose.yml "$CANDIDATE_DIR/config-templates/"
[ -f docker-compose.production.yml ] && cp docker-compose.production.yml "$CANDIDATE_DIR/config-templates/"
[ -f docker-compose.test.yml ] && cp docker-compose.test.yml "$CANDIDATE_DIR/config-templates/"
echo "   ✅ Configuration templates collected"

# 9. Compute all checksums
echo ""
echo "🔐 Computing checksums..."
API_CHECKSUM=$(sha256sum "$CANDIDATE_DIR/api-dist.tar.gz" | cut -d' ' -f1)
WEB_CHECKSUM=$(sha256sum "$CANDIDATE_DIR/web-dist.tar.gz" | cut -d' ' -f1)
PACKAGES_CHECKSUM=$(sha256sum "$CANDIDATE_DIR/packages-dist.tar.gz" | cut -d' ' -f1)

if [ "$HAS_DESKTOP" = true ]; then
    DESKTOP_CHECKSUM=$(sha256sum "$CANDIDATE_DIR/desktop-dist.tar.gz" | cut -d' ' -f1)
    DESKTOP_ARTIFACT=",
    \"desktop\": {
      \"file\": \"desktop-dist.tar.gz\",
      \"checksum\": \"$DESKTOP_CHECKSUM\"
    }"
else
    DESKTOP_ARTIFACT=""
fi

echo "   ✅ All checksums computed"

# 10. Generate manifest
echo ""
echo "📋 Generating manifest..."
cat > "$CANDIDATE_DIR/manifest.json" << EOF
{
  "candidateId": "$CANDIDATE_ID",
  "version": "1.0.0-rc",
  "commit": "$COMMIT",
  "commitShort": "$COMMIT_SHORT",
  "branch": "$BRANCH",
  "timestamp": "$TIMESTAMP",
  "buildHost": "$(hostname)",
  "buildUser": "$(whoami)",
  "artifacts": {
    "source": {
      "file": "source.tar.gz",
      "checksum": "$SOURCE_CHECKSUM"
    },
    "api": {
      "file": "api-dist.tar.gz",
      "checksum": "$API_CHECKSUM"
    },
    "web": {
      "file": "web-dist.tar.gz",
      "checksum": "$WEB_CHECKSUM"
    },
    "packages": {
      "file": "packages-dist.tar.gz",
      "checksum": "$PACKAGES_CHECKSUM"
    }$DESKTOP_ARTIFACT
  },
  "migrations": {
    "count": $MIGRATION_COUNT,
    "directory": "migrations/"
  },
  "dependencies": {
    "manifest": "dependencies.json",
    "lockfile": "pnpm-lock.yaml",
    "package_manager": "$(node -p "require('./package.json').packageManager")",
    "node": "$(node --version)",
    "pnpm": "$(pnpm --version)",
    "cargo": "$(cargo --version | sed 's/"/\\"/g')",
    "rust_lockfile": "apps/desktop/src-tauri/Cargo.lock",
    "root_package_sha256": "$(sha256sum package.json | cut -d' ' -f1)",
    "pnpm_lock_sha256": "$(sha256sum pnpm-lock.yaml | cut -d' ' -f1)",
    "cargo_manifest_sha256": "$(sha256sum apps/desktop/src-tauri/Cargo.toml | cut -d' ' -f1)",
    "cargo_lock_sha256": "$(sha256sum apps/desktop/src-tauri/Cargo.lock | cut -d' ' -f1)"
  },
  "knownLimitations": [
    "Desktop artifact is unsigned unless a Developer ID identity and notarization credentials are provisioned.",
    "Local candidate build is not production deployment, performance approval, or target-host recovery evidence.",
    "API package contains checked source because this workspace build has no API dist output."
  ]
}
EOF
echo "   ✅ Manifest generated"

# 11. Generate README
cat > "$CANDIDATE_DIR/README.md" << EOF
# DGOS V1 Release Candidate

**Candidate ID:** $CANDIDATE_ID
**Commit:** $COMMIT
**Frozen:** $TIMESTAMP

## Contents

- \`source.tar.gz\` - Complete source code
- \`api-dist.tar.gz\` - Built API server
- \`web-dist.tar.gz\` - Built web frontend
- \`packages-dist.tar.gz\` - Built shared packages
- \`migrations/\` - Database migrations ($MIGRATION_COUNT files)
- \`config-templates/\` - Configuration templates
- \`manifest.json\` - Complete build metadata

## Verification

\`\`\`bash
./scripts/verify-candidate.sh $CANDIDATE_ID
\`\`\`

## Testing

\`\`\`bash
./scripts/test-candidate.sh $CANDIDATE_ID
\`\`\`

## Deployment

See deployment guide in docs/release/
EOF

# 12. Create git tag
echo ""
echo "🏷️  Creating git tag..."
git tag -a "$CANDIDATE_ID" -m "Release candidate $CANDIDATE_ID" 2>/dev/null || echo "   ⚠️  Tag already exists"

echo ""
echo "✅ Candidate frozen successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Location: $CANDIDATE_DIR"
echo "🆔 ID: $CANDIDATE_ID"
echo "📝 Commit: $COMMIT_SHORT"
echo "⏰ Frozen: $TIMESTAMP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Verify: ./scripts/verify-candidate.sh $CANDIDATE_ID"
echo "  2. Test: ./scripts/test-candidate.sh $CANDIDATE_ID"
echo "  3. Deploy: Deploy to staging for validation"
echo ""
