#!/bin/bash
# Quick build and launch script for DGOS with new macOS UI

set -e

echo "🚀 Building DGOS with macOS UI..."
echo ""

# Build packages
echo "📦 Building design tokens..."
cd "$(dirname "$0")"
npm run build --workspace=@dgos/design-tokens --silent

echo "📦 Building dgos-ui..."
npm run build --workspace=@dgos/dgos-ui --silent

echo "📦 Building app-shell..."
npm run build --workspace=@dgos/app-shell --silent

echo "📦 Building web app..."
npm run build --workspace=@dgos/web

echo ""
echo "✅ Build complete!"
echo ""
echo "🌐 Starting web server..."
echo "   Open: http://127.0.0.1:8642"
echo ""

cd apps/web
npm run start
