#!/bin/bash
# Build DGOS Desktop App (macOS)

set -e

echo "🖥️  Building DGOS Desktop App with macOS UI..."
echo ""

# Step 1: Build web app first
echo "📦 Building web app..."
cd "$(dirname "$0")"
npm run build --workspace=@dgos/web

# Step 2: Build Tauri desktop app
echo "🔨 Building desktop app (this may take a few minutes)..."
cd apps/desktop
npm run build:macos

echo ""
echo "✅ Desktop app built successfully!"
echo ""
echo "📍 Location:"
echo "   apps/desktop/src-tauri/target/release/bundle/macos/"
echo ""
echo "🚀 To run:"
echo "   open apps/desktop/src-tauri/target/release/bundle/macos/DGOS.app"
echo ""
