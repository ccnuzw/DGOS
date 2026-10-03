# DGOS UI/UX 组件使用指南

本文档介绍 DGOS 设计系统的核心组件和使用方法。

## 目录

1. [macOS 核心视觉组件](#macos-核心视觉组件)
2. [AppShell 系统](#appshell-系统)
3. [数据展示组件](#数据展示组件)
4. [可访问性工具](#可访问性工具)
5. [设计 Token](#设计-token)

---

## macOS 核心视觉组件

### WindowFrame 组件

macOS 风格的窗口框架，带交通灯按钮。

```tsx
import { MacOSWindow } from '@dgos/app-shell';

<MacOSWindow
  id="my-window"
  title="Settings"
  onClose={() => console.log('Close')}
  onMinimize={() => console.log('Minimize')}
  onMaximize={() => console.log('Maximize')}
  bounds={{ x: 100, y: 100, width: 800, height: 600 }}
  focused={true}
>
  <div>Window content here</div>
</MacOSWindow>
```

**特性**：
- 可拖拽标题栏
- 可调整窗口大小（8个调整点）
- 自动处理焦点和 z-index
- 支持最大化/还原
- macOS 风格的交通灯按钮

### Dock 组件

底部应用启动器，带图标放大效果。

```tsx
import { MacOSDock } from '@dgos/app-shell';

const apps = [
  {
    id: 'catalog',
    name: 'Catalog',
    icon: <CatalogIcon />,
    isRunning: true,
    badge: 3,
    onClick: () => navigate('/catalog'),
  },
  // ... 更多应用
];

<MacOSDock apps={apps} />
```

**特性**：
- 鼠标悬停放大效果（macOS 风格）
- 运行指示器（底部圆点）
- 徽章支持（通知数量）
- 系统区域分隔符
- 完整键盘导航

### SystemBar 组件

顶部系统栏，带毛玻璃效果。

```tsx
import { MacOSSystemBar } from '@dgos/app-shell';

<MacOSSystemBar
  currentApp="Settings"
  onMenuClick={() => setLaunchpadVisible(true)}
  onSearchClick={() => setCommandPaletteVisible(true)}
  onNotificationsClick={() => setNotificationCenterVisible(true)}
  theme="light"
  onThemeToggle={() => toggleTheme()}
/>
```

---

## AppShell 系统

### 完整的 macOS Shell

集成所有组件的完整桌面环境。

```tsx
import { MacOSShell } from '@dgos/app-shell';

<MacOSShell
  currentRoute="settings"
  labels={{
    catalog: 'Catalog',
    settings: 'Settings',
    // ... 更多标签
  }}
  onNavigate={(route) => navigate(route)}
  theme="light"
  onThemeToggle={toggleTheme}
>
  <YourAppContent />
</MacOSShell>
```

**包含**：
- SystemBar（顶部栏）
- Dock（底部启动器）
- WindowManager（窗口管理）
- CommandPalette（⌘K 命令面板）
- NotificationCenter（通知中心）
- Launchpad（应用网格）

### 命令面板（⌘K）

快速访问应用和操作。

```tsx
import { CommandPalette } from '@dgos/app-shell';

const commandItems = [
  {
    id: 'open-settings',
    type: 'app',
    label: 'Settings',
    description: 'Open system settings',
    icon: <SettingsIcon />,
    keywords: ['preferences', 'config'],
    onExecute: () => navigate('/settings'),
  },
  // ... 更多命令
];

<CommandPalette
  visible={commandPaletteVisible}
  items={commandItems}
  onClose={() => setCommandPaletteVisible(false)}
  placeholder="Search apps and actions..."
/>
```

**键盘快捷键**：
- `⌘K` / `Ctrl+K` - 打开/关闭
- `↑↓` - 导航
- `Enter` - 执行
- `Esc` - 关闭

### 通知中心

系统通知管理。

```tsx
import { NotificationCenter, ToastNotification } from '@dgos/app-shell';

const notifications = [
  {
    id: '1',
    title: 'Provider Connected',
    message: 'OpenAI provider is now available',
    severity: 'success',
    timestamp: new Date(),
    appName: 'System',
    actions: [
      {
        id: 'view',
        label: 'View Details',
        primary: true,
        onAction: () => navigate('/providers'),
      },
    ],
  },
];

<NotificationCenter
  visible={notificationCenterVisible}
  notifications={notifications}
  onClose={() => setNotificationCenterVisible(false)}
  onNotificationDismiss={(id) => removeNotification(id)}
/>

// Toast 弹窗通知（右上角）
<ToastNotification
  notification={notification}
  onDismiss={() => removeNotification(notification.id)}
  duration={5000}
/>
```

---

## 数据展示组件

### DataTable

虚拟滚动的数据表格（由 subagent 实现）。

```tsx
import { DataTable } from '@dgos/dgos-ui';

<DataTable
  columns={[
    { id: 'name', label: 'Name', sortable: true },
    { id: 'status', label: 'Status', filterable: true },
  ]}
  data={rows}
  onSort={(column, direction) => handleSort(column, direction)}
  onRowSelect={(row) => handleSelect(row)}
/>
```

### Tree 组件

层级数据展示（由 subagent 实现）。

```tsx
import { Tree } from '@dgos/dgos-ui';

<Tree
  data={treeData}
  onNodeExpand={(nodeId) => handleExpand(nodeId)}
  onNodeSelect={(nodeId) => handleSelect(nodeId)}
/>
```

### SplitPane 分割面板

可调整大小的分割面板（由 subagent 实现）。

```tsx
import { SplitPane } from '@dgos/dgos-ui';

<SplitPane
  orientation="horizontal"
  defaultSize={300}
  minSize={200}
  maxSize={500}
>
  <Sidebar />
  <MainContent />
</SplitPane>
```

---

## 可访问性工具

### Focus Management Hooks

```tsx
import {
  useFocusTrap,
  useFocusReturn,
  useRovingTabindex,
  useFocusVisible,
  useAnnouncer,
} from '@dgos/dgos-ui';

// 焦点陷阱（模态框、对话框）
function Dialog() {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, isOpen);
  useFocusReturn(isOpen);

  return <div ref={dialogRef}>...</div>;
}

// 循环 Tabindex（列表、菜单）
function Menu() {
  const menuRef = useRef<HTMLDivElement>(null);
  useRovingTabindex(menuRef, 'vertical', true);

  return <div ref={menuRef} role="menu">...</div>;
}

// 屏幕阅读器通知
function MyComponent() {
  const announce = useAnnouncer();

  const handleSave = () => {
    // ... 保存逻辑
    announce('Settings saved successfully', 'polite');
  };
}

// 焦点可见性检测
function App() {
  useFocusVisible(); // 全局应用
  return <div>...</div>;
}
```

### 可访问性 CSS 类

```tsx
// 屏幕阅读器专用
<span className="sr-only">Additional context for screen readers</span>

// 跳转链接
<div className="skip-links">
  <a href="#main-content" className="skip-link">
    Skip to main content
  </a>
</div>

// 键盘快捷键显示
<kbd>⌘</kbd>+<kbd>K</kbd>
```

---

## 设计 Token

### 使用颜色 Token

```tsx
import { colors } from '@dgos/design-tokens';

// 在 TypeScript 中
const primaryColor = colors.light.primary; // '#0F5FD9'

// 在 CSS 中
.my-component {
  background: var(--primary);
  color: var(--text);
  border: 1px solid var(--border);
}
```

### 可用的语义 Token

```css
/* 颜色 */
--canvas: 画布背景
--surface: 面板背景
--raised: 浮动元素背景
--text: 主要文字
--muted: 次要文字
--border: 边框
--primary: 主操作色 (DGOS Blue #0F5FD9)
--secondary: 次要色 (Electric Teal #06B6D4)
--success: 成功色
--warning: 警告色
--danger: 危险色
--info: 信息色

/* 间距（4px 系统）*/
--spacing-1: 4px
--spacing-2: 8px
--spacing-3: 12px
--spacing-4: 16px
--spacing-5: 20px
--spacing-6: 24px
--spacing-8: 32px

/* 圆角 */
--radius-sm: 4px
--radius-md: 6px
--radius-lg: 8px
--radius-xl: 12px

/* 阴影 */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05)
--shadow-md: 0 4px 8px rgba(0, 0, 0, 0.1)
--shadow-lg: 0 12px 24px rgba(0, 0, 0, 0.15)
```

### macOS 特定 Token

```tsx
import { macOSTokens } from '@dgos/design-tokens';

// 窗口
macOSTokens.window.titleBarHeight // '32px'
macOSTokens.window.borderRadius // '12px'
macOSTokens.window.shadow // 窗口阴影

// Dock
macOSTokens.dock.iconSize // '48px'
macOSTokens.dock.iconSizeHover // '58px'
macOSTokens.dock.hoverScale // '1.21'

// 动画
macOSTokens.animations.spring // 'cubic-bezier(0.34, 1.56, 0.64, 1)'
macOSTokens.animations.windowOpen // '300ms cubic-bezier(...)'

// 玻璃态效果
macOSTokens.glass.light.background // 'rgba(255, 255, 255, 0.75)'
macOSTokens.glass.light.backdropFilter // 'blur(20px) saturate(180%)'
```

---

## 主题切换

```tsx
// 设置主题
document.documentElement.setAttribute('data-theme', 'dark');

// 检测系统偏好
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

// 监听系统主题变化
window.matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', (e) => {
    const theme = e.matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
  });
```

---

## 最佳实践

### 1. 始终使用语义 Token

❌ 不要：
```css
.button {
  background: #0F5FD9;
  color: #ffffff;
}
```

✅ 应该：
```css
.button {
  background: var(--primary);
  color: var(--surface);
}
```

### 2. 确保键盘可访问性

```tsx
// 所有交互元素都应支持键盘
<button
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
  aria-label="Descriptive label"
>
  Action
</button>
```

### 3. 提供适当的 ARIA 标签

```tsx
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Confirmation</h2>
  <p>Are you sure?</p>
</div>
```

### 4. 处理加载和错误状态

```tsx
<button disabled={isLoading} aria-busy={isLoading}>
  {isLoading ? 'Saving...' : 'Save'}
</button>

{error && (
  <div role="alert" className="error-message">
    {error.message}
  </div>
)}
```

### 5. 支持减少动画偏好

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 完整示例

```tsx
import React, { useState } from 'react';
import { MacOSShell, CommandPalette, NotificationCenter } from '@dgos/app-shell';
import { useFocusVisible, useAnnouncer } from '@dgos/dgos-ui';

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [currentRoute, setCurrentRoute] = useState('desktop');
  const announce = useAnnouncer();
  
  useFocusVisible();

  const handleNavigate = (route: string) => {
    setCurrentRoute(route);
    announce(`Navigated to ${route}`, 'polite');
  };

  return (
    <MacOSShell
      currentRoute={currentRoute}
      labels={{
        desktop: 'Desktop',
        settings: 'Settings',
        catalog: 'Catalog',
      }}
      onNavigate={handleNavigate}
      theme={theme}
      onThemeToggle={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
    >
      <YourAppContent />
    </MacOSShell>
  );
}
```

---

## 浏览器兼容性

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ macOS 原生（Tauri）

## 性能建议

1. **虚拟滚动**：大型列表使用 DataTable 的虚拟滚动
2. **懒加载**：窗口内容按需加载
3. **防抖搜索**：CommandPalette 自动防抖
4. **CSS 变量**：主题切换无需重新渲染

---

更多信息请参考：
- [V1-界面规范.md](../../docs/04-技术架构/当前版本/V1-界面规范.md)
- [ADR-0004 统一设计系统](../../docs/06-决策记录/ADR/0004-V1统一设计系统与跨应用交互契约.md)
