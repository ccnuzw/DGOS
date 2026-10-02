#!/bin/bash
# FR-003 Extensions UI - Quick Command Reference

echo "==============================================="
echo "FR-003 Extensions UI - Quick Commands"
echo "==============================================="
echo ""

# Backend Tests
echo "1. RUN BACKEND TESTS:"
echo "   cd /Users/apple/Progame/DGOS"
echo "   DGOS_EXTENSION_TEST_DATABASE_URL=\"\$DGOS_EXTENSION_ISOLATED_URL\" node --test tests/extensions/*.test.mjs"
echo ""

# Frontend Build
echo "2. BUILD FRONTEND:"
echo "   cd /Users/apple/Progame/DGOS/apps/web"
echo "   npm run build"
echo ""

# Dev Server
echo "3. START DEV SERVER:"
echo "   cd /Users/apple/Progame/DGOS"
echo "   npm run dev"
echo "   # Then open: http://localhost:5173"
echo ""

# View Components
echo "4. VIEW NEW COMPONENTS:"
echo "   ls -lh apps/web/src/mcp-*.tsx apps/web/src/permission-*.tsx"
echo ""

# Read Documentation
echo "5. READ DOCUMENTATION:"
echo "   cat .herdr/SUMMARY.txt"
echo "   cat .herdr/V1-EXTENSIONS-UI.md"
echo "   cat .herdr/V1-EXTENSIONS-UI-TESTING.md"
echo ""

# Navigation in App
echo "6. UI NAVIGATION (once dev server is running):"
echo "   - Login at http://localhost:5173"
echo "   - Navigate to: MCP Services (/mcp)"
echo "   - Navigate to: Skills (/skills)"
echo ""

echo "NEW UI FEATURES TO TEST:"
echo "------------------------"
echo "✓ Manual MCP Configuration panel"
echo "✓ Enhanced MCP server list with connection states"
echo "✓ Tool count display"
echo "✓ Permission review dialogs"
echo "✓ Risk badges (low/medium/high/critical)"
echo "✓ Delete confirmations with warnings"
echo ""

echo "TESTING CHECKLIST:"
echo "-----------------"
echo "See: .herdr/V1-EXTENSIONS-UI-TESTING.md"
echo ""

echo "REPORTS GENERATED:"
echo "-----------------"
echo "- .herdr/SUMMARY.txt                    (This summary)"
echo "- .herdr/V1-EXTENSIONS-UI.md            (Complete report)"
echo "- .herdr/V1-EXTENSIONS-UI-PLAN.md       (Implementation plan)"
echo "- .herdr/V1-EXTENSIONS-UI-TESTING.md    (Testing checklist)"
echo ""

echo "==============================================="
echo "STATUS: ✅ Implementation Complete"
echo "NEXT: Manual testing & screenshot evidence"
echo "==============================================="
