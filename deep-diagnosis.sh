#!/bin/bash

echo "🔍 DGOS 深度诊断脚本"
echo "================================"
echo ""

cd /Users/apple/Progame/DGOS

echo "📋 1. 检查Dock组件代码..."
if grep -q "style={{" packages/app-shell/src/macos/dock.tsx; then
  echo "  ✅ 内联样式已添加"
else
  echo "  ❌ 内联样式未添加"
fi

echo ""
echo "📋 2. 检查开发服务器..."
if lsof -ti :15133 > /dev/null 2>&1; then
  echo "  ✅ 开发服务器正在运行 (端口 15133)"
else
  echo "  ❌ 开发服务器未运行"
fi

echo ""
echo "📋 3. 检查构建产物..."
if [ -d "node_modules/.vite" ]; then
  echo "  ⚠️  Vite缓存存在，可能使用旧代码"
  echo "     缓存路径: node_modules/.vite"
else
  echo "  ✅ 没有Vite缓存"
fi

echo ""
echo "📋 4. 查找所有Dock样式定义..."
echo "  CSS文件中的Dock定义:"
grep -l "\.macos-dock" packages/app-shell/src/macos/*.css 2>/dev/null | while read file; do
  echo "    - $(basename $file)"
done

echo ""
echo "📋 5. 检查是否有覆盖样式..."
if grep -r "\.macos-dock.*{" apps/web/src --include="*.css" 2>/dev/null | grep -v node_modules; then
  echo "  ⚠️  应用层有Dock样式覆盖"
else
  echo "  ✅ 应用层没有覆盖"
fi

echo ""
echo "================================"
echo "🔧 建议的修复步骤:"
echo "================================"
echo ""

if lsof -ti :15133 > /dev/null 2>&1; then
  echo "1. 停止开发服务器"
  echo "   在运行 npm run dev 的终端按 Ctrl+C"
  echo ""
fi

if [ -d "node_modules/.vite" ]; then
  echo "2. 清除Vite缓存"
  echo "   rm -rf node_modules/.vite"
  echo ""
fi

echo "3. 启动开发服务器"
echo "   npm run dev"
echo ""

echo "4. 在浏览器中:"
echo "   - 打开 http://127.0.0.1:15133"
echo "   - 按 Cmd+Option+I (Mac) 或 F12 打开开发者工具"
echo "   - 右键点击刷新按钮，选择 '清空缓存并硬性重新加载'"
echo ""

echo "5. 登录后，在Console执行以下代码检查:"
echo ""
echo "   const dock = document.querySelector('.macos-dock');"
echo "   if (dock) {"
echo "     console.log('Dock元素:', dock);"
echo "     console.log('内联样式:', dock.style.cssText);"
echo "     console.log('计算样式 left:', getComputedStyle(dock).left);"
echo "     console.log('计算样式 zIndex:', getComputedStyle(dock).zIndex);"
echo "   } else {"
echo "     console.log('❌ 未找到Dock元素');"
echo "   }"
echo ""

echo "================================"
echo "💡 诊断完成"
echo "================================"
