#!/bin/bash

echo "🔧 DGOS 全面修复脚本"
echo "================================"
echo ""

cd /Users/apple/Progame/DGOS

# 1. 验证关键CSS文件
echo "📋 步骤 1: 验证CSS文件..."
echo ""

echo "检查 3-dock.css 的 z-index..."
if grep -q "z-index: 500" packages/app-shell/src/macos/3-dock.css; then
  echo "  ✅ 3-dock.css - z-index: 500"
else
  echo "  ❌ 3-dock.css - z-index 不正确"
fi

echo "检查 3-dock.css 的居中..."
if grep -q "left: 50%" packages/app-shell/src/macos/3-dock.css; then
  echo "  ✅ 3-dock.css - left: 50%"
else
  echo "  ❌ 3-dock.css - left 不正确"
fi

echo "检查 3-dock.css 的半透明..."
if grep -q "rgba(255, 255, 255, 0.25)" packages/app-shell/src/macos/3-dock.css; then
  echo "  ✅ 3-dock.css - 半透明背景"
else
  echo "  ❌ 3-dock.css - 背景不正确"
fi

echo ""

# 2. 清除所有缓存
echo "🗑️  步骤 2: 清除缓存..."
rm -rf node_modules/.vite
rm -rf apps/web/dist
rm -rf node_modules/.cache 2>/dev/null
echo "  ✅ 缓存已清除"
echo ""

# 3. 检查导入顺序
echo "📦 步骤 3: 检查CSS导入..."
if grep -q "import './3-dock.css'" packages/app-shell/src/macos/index.tsx; then
  echo "  ✅ 3-dock.css 已导入"
else
  echo "  ❌ 3-dock.css 未导入"
fi

if grep -q "import './macos.css'" packages/app-shell/src/macos/index.tsx; then
  echo "  ⚠️  macos.css 被导入（可能冲突）"
else
  echo "  ✅ macos.css 未导入（正确）"
fi
echo ""

# 4. 显示下一步
echo "✅ 修复完成！"
echo ""
echo "🚀 接下来请执行："
echo "================================"
echo ""
echo "1. 重启开发服务器："
echo "   npm run dev"
echo ""
echo "2. 在浏览器中硬刷新："
echo "   Mac:     Cmd + Shift + R"
echo "   Windows: Ctrl + Shift + R"
echo ""
echo "3. 检查效果："
echo "   - Dock应该在底部居中"
echo "   - 半透明毛玻璃效果"
echo "   - 图标圆角16px"
echo ""
echo "4. 如果还有问题，在浏览器按F12，在Console执行："
echo ""
echo "   const dock = document.querySelector('.macos-dock');"
echo "   if (dock) {"
echo "     const s = window.getComputedStyle(dock);"
echo "     console.log('left:', s.left, 'zIndex:', s.zIndex);"
echo "   }"
echo ""
