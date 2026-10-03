#!/bin/bash
# DGOS团队启动脚本

cd /Users/apple/Progame/DGOS

echo "🚀 启动DGOS Agent团队..."
echo ""

# 读取team.json获取角色配置
ROLES=(
  "planner:opencode"
  "worker-platform:codex"
  "worker-ai:codex"
  "worker-web:codex"
  "worker-native:codex"
  "worker-test:codex"
  "worker-devops:codex"
  "verify:codex"
)

echo "团队配置："
echo "  Lead (当前会话) - Claude Code"
for role_info in "${ROLES[@]}"; do
  IFS=':' read -r role kind <<< "$role_info"
  echo "  $role - $kind"
done
echo ""

echo "📝 使用herdr创建agents..."
echo ""
echo "请在Herdr中手动创建以下agents："
echo ""
echo "1. Planner (OpenCode):"
echo "   herdr agent create planner --kind opencode --role .herdr/roles/planner.md"
echo ""
echo "2. Worker-Platform (Codex):"
echo "   herdr agent create worker-platform --kind codex --role .herdr/roles/worker-platform.md"
echo ""
echo "3. Worker-AI (Codex):"
echo "   herdr agent create worker-ai --kind codex --role .herdr/roles/worker-ai.md"
echo ""
echo "4. Worker-Web (Codex):"
echo "   herdr agent create worker-web --kind codex --role .herdr/roles/worker-web.md"
echo ""
echo "5. Worker-Native (Codex):"
echo "   herdr agent create worker-native --kind codex --role .herdr/roles/worker-native.md"
echo ""
echo "6. Worker-Test (Codex):"
echo "   herdr agent create worker-test --kind codex --role .herdr/roles/worker-test.md"
echo ""
echo "7. Worker-DevOps (Codex):"
echo "   herdr agent create worker-devops --kind codex --role .herdr/roles/worker-devops.md"
echo ""
echo "8. Verify (Codex):"
echo "   herdr agent create verify --kind codex --role .herdr/roles/verify.md"
echo ""
echo "✅ 或者：使用team.json自动创建"
echo "   herdr team load .herdr/team.json"
