#!/bin/bash

# Complete CLI workflow example

set -e

echo "=== DGOS CLI Workflow Example ==="
echo ""

# 1. Configure CLI
echo "Step 1: Configuring CLI..."
dgos config set baseUrl http://localhost:5000
dgos config set outputFormat table
echo "✓ Configuration complete"
echo ""

# 2. Login (if not using API key)
# echo "Step 2: Logging in..."
# dgos auth login
# echo "✓ Login complete"
# echo ""

# 3. Create API key (alternative to session)
echo "Step 2: Creating API key..."
dgos auth create-key
echo ""
echo "⚠️  Save the API key shown above!"
echo "Press Enter to continue..."
read
echo ""

# 4. Configure provider
echo "Step 3: Configuring AI provider..."
dgos providers configure
echo "✓ Provider configured"
echo ""

# 5. List providers
echo "Step 4: Listing providers..."
dgos providers list
echo ""

# 6. Refresh model catalog
echo "Step 5: Refreshing model catalog..."
PROVIDER_ID=$(dgos providers list --format json | jq -r '.[0].providerId')
dgos providers models "$PROVIDER_ID" --refresh
echo ""

# 7. List available models
echo "Step 6: Available models..."
dgos providers models "$PROVIDER_ID" --format table
echo ""

# 8. Create a simple task
echo "Step 7: Creating a simple task..."
TASK_OUTPUT=$(dgos tasks create "What is the capital of France?" --format json)
TASK_ID=$(echo "$TASK_OUTPUT" | jq -r '.taskId')
echo "✓ Task created: $TASK_ID"
echo ""

# 9. Wait for task to complete
echo "Step 8: Waiting for task to complete..."
sleep 3
dgos tasks get "$TASK_ID"
echo ""

# 10. Create a task and wait
echo "Step 9: Creating task with wait..."
dgos tasks create "Write a haiku about programming" --wait --format json
echo ""

# 11. List completed tasks
echo "Step 10: Listing completed tasks..."
dgos tasks list --status completed --format table
echo ""

# 12. Install a package
echo "Step 11: Installing package..."
dgos packages list --format table
echo ""
echo "Install a package? (y/n)"
read -r response
if [ "$response" = "y" ]; then
    echo "Enter package ID:"
    read -r package_id
    dgos packages install "$package_id"
    echo "✓ Package installed"
fi
echo ""

# 13. System info
echo "Step 12: System information..."
dgos system info --format json
echo ""

# 14. Health check
echo "Step 13: Health check..."
dgos system health
echo ""

# 15. List API keys
echo "Step 14: API keys..."
dgos auth list-keys --format table
echo ""

# Summary
echo "=== Workflow Complete ==="
echo ""
echo "You've successfully:"
echo "  ✓ Configured the CLI"
echo "  ✓ Authenticated with DGOS"
echo "  ✓ Configured an AI provider"
echo "  ✓ Created and ran tasks"
echo "  ✓ Checked system status"
echo ""
echo "For more information, run: dgos --help"
