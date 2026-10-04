#!/bin/bash

echo "🔧 DGOS 开发服务器重启脚本"
echo "================================"

cd /Users/apple/Progame/DGOS

echo ""
echo "📦 步骤 1: 清除所有缓存..."
rm -rf node_modules/.vite
rm -rf apps/web/dist
echo "✅ 缓存已清除"

echo ""
echo "🔌 步骤 2: 停止旧的开发服务器..."
echo "请手动执行以下命令："
echo ""
echo "  # 找到所有在端口15133上运行的进程"
echo "  lsof -ti :15133"
echo ""
echo "  # 停止这些进程（需要手动确认）"
echo "  kill \$(lsof -ti :15133)"
echo ""
echo "或者直接在运行 'npm run dev' 的终端窗口按 Ctrl+C"

echo ""
echo "🚀 步骤 3: 启动新的开发服务器..."
echo "执行以下命令："
echo ""
echo "  cd /Users/apple/Progame/DGOS"
echo "  npm run dev"
echo ""

echo "🌐 步骤 4: 在浏览器中硬刷新"
echo "================================"
echo ""
echo "Chrome/Edge (Mac):  Cmd + Shift + R"
echo "Chrome/Edge (Win):  Ctrl + Shift + R"
echo "Firefox (Mac):      Cmd + Shift + R"
echo "Safari (Mac):       Cmd + Option + R"
echo ""
echo "或者："
echo "1. 打开开发者工具 (F12)"
echo "2. 右键点击刷新按钮"
echo "3. 选择 '清空缓存并硬性重新加载'"
echo ""

echo "✅ 完成后应该看到："
echo "  - Dock在屏幕底部居中"
echo "  - Dock有半透明毛玻璃效果"
echo "  - 图标有16px圆角"
echo "  - 悬停时图标放大"
echo ""
