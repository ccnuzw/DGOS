# 用户反馈修复清单

## 问题 1: 交通灯按钮不够像 ✅ 修复中

**问题描述**：
- 交通灯按钮太大
- 是方形的，不是圆形
- 不符合 macOS 的精确样式

**修复方案**：
- ✅ 强制设置为 12px 圆形 (border-radius: 50%)
- ✅ 精确的颜色：#FF5F57, #FEBC2E, #28C840
- ✅ 悬停时显示符号 (× − ⤢)
- ✅ 窗口失焦时变灰色 (#E0E0E0, opacity: 0.5)
- ✅ 创建 `perfect-traffic-lights.css` 强制覆盖样式

---

## 问题 2: 交通灯功能不正常 ✅ 修复中

**问题描述**：
- 很多窗口无法关闭
- 无法最小化

**修复方案**：
- ✅ 检查 `WindowManager` 的 `closeWindow` 函数
- ✅ 确保从 windows 数组中正确移除
- ✅ 检查 `minimizeWindow` 函数
- ✅ 确保状态正确更新为 'minimized'
- ✅ 验证所有回调函数正确连接

---

## 问题 3: 标签栏要集成到顶部 ✅ 修复中

**问题描述**：
- 单独的标签栏不好看
- 应该和系统栏共用顶部空间

**修复方案**：
- ✅ 标签显示在 SystemBar 内部
- ✅ 布局：[Logo] [Tabs...] [Right Icons]
- ✅ 只在有最大化窗口时显示标签
- ✅ 标签样式精美：
  - 小圆角 (6px)
  - 悬停背景色
  - 活动标签有阴影
  - 关闭按钮 (×) 悬停时显示
- ✅ 创建 `integrated-tabs.css`

---

## 问题 4: DGOS Logo 太大 ✅ 修复中

**问题描述**：
- Logo 和文字太大
- 超出顶部栏空间
- 有突兀感

**修复方案**：
- ✅ Logo 图标缩小到 16px
- ✅ 文字字号 13px
- ✅ 紧凑布局 (padding: 4px 8px)
- ✅ 悬停效果 (轻微背景色)
- ✅ 与 SystemBar 一体化设计
- ✅ 视觉权重降低

---

## 问题 5: 桌面右键菜单 ✅ 修复中

**问题描述**：
- 浏览器右键菜单会出现
- 破坏 macOS 体验

**修复方案**：
- ✅ 创建 `disable-context-menu.css`
- ✅ JavaScript 监听 contextmenu 事件
- ✅ 只在桌面区域阻止默认行为
- ✅ 窗口内容区域保留右键菜单（允许复制粘贴）
- ✅ 代码实现：
```tsx
useEffect(() => {
  const handleContextMenu = (e: MouseEvent) => {
    // Only prevent on desktop area, not in windows
    if ((e.target as HTMLElement).closest('.macos-desktop') && 
        !(e.target as HTMLElement).closest('.macos-window__content')) {
      e.preventDefault();
    }
  };
  
  document.addEventListener('contextmenu', handleContextMenu);
  return () => document.removeEventListener('contextmenu', handleContextMenu);
}, []);
```

---

## 修复后的效果预期

### 交通灯按钮
- 🔴 红色圆点 (12px) - 关闭窗口
- 🟡 黄色圆点 (12px) - 最小化
- 🟢 绿色圆点 (12px) - 最大化/还原
- 悬停显示符号，失焦变灰

### 顶部系统栏
```
[🎯DGOS] [Tab1] [Tab2] [Tab3] ... [搜索] [通知] [主题]
```

### 右键菜单
- 桌面右键 → 无反应（已屏蔽）
- 窗口内容右键 → 正常（可复制文字）

---

## 实施状态

**Agent 正在工作中...**

修复内容：
1. ✅ 创建 perfect-traffic-lights.css
2. ✅ 创建 integrated-tabs.css  
3. ✅ 创建 disable-context-menu.css
4. 🔄 修复 WindowManager 功能
5. 🔄 更新 MacOSShell 集成标签
6. 🔄 添加右键菜单阻止
7. 🔄 优化 Logo 样式

预计完成时间：1-2 分钟
