# 窗口拖动问题排查指南

## 问题描述
WEB端窗口无法拖动，但测试页面显示拖动逻辑正常工作。

## 已完成的修复

### 1. CSS层面修复
✅ 移除了 `-webkit-app-region: drag` (Electron专用，在Web端干扰事件)
✅ 为标题栏添加 `cursor: move` 提示
✅ 为最大化窗口标题栏添加 `cursor: default` (最大化窗口不应拖动)
✅ 移除了所有可能阻止pointer事件的CSS

### 2. JavaScript层面修复
✅ 在 `handleTitleBarMouseDown` 中添加最大化窗口检查
✅ 拖动逻辑使用正确的事件监听和清理

## 可能的问题原因

### 1. React严格模式导致事件监听器重复
**文件**: `apps/web/src/main.tsx`

检查是否使用了 `<React.StrictMode>`，严格模式会导致组件mount两次，可能导致事件监听器问题。

**解决方案**：开发环境可以保留严格模式，但确保useEffect的cleanup正确执行。

### 2. 窗口层叠导致事件被拦截
**可能原因**：
- `.macos-window-manager` 设置了 `pointer-events: none`
- 但子元素应该有 `pointer-events: auto`

**验证方法**：
```javascript
// 在浏览器控制台执行
document.querySelector('.macos-window').style.pointerEvents
document.querySelector('.macos-window__title-bar').style.pointerEvents
```

### 3. 事件冒泡被阻止
**检查点**：
- 确保 `onClick` 事件没有调用 `e.stopPropagation()`
- 确保没有父元素拦截了mousedown事件

### 4. z-index问题导致标题栏被覆盖
**检查点**：
- 窗口内容的z-index不应该高于标题栏
- 标题栏应该始终在窗口顶部

## 诊断步骤

### 步骤1：在浏览器中打开开发者工具
1. 打开 http://127.0.0.1:15133
2. 按F12打开开发者工具
3. 切换到Console标签

### 步骤2：测试事件监听
在Console中执行：
```javascript
// 检查窗口元素
const window = document.querySelector('.macos-window');
console.log('Window element:', window);

// 检查标题栏
const titleBar = document.querySelector('.macos-window__title-bar');
console.log('Title bar:', titleBar);
console.log('Title bar cursor:', window.getComputedStyle(titleBar).cursor);
console.log('Title bar pointer-events:', window.getComputedStyle(titleBar).pointerEvents);

// 添加测试监听器
titleBar.addEventListener('mousedown', (e) => {
  console.log('🎯 Mousedown detected!', e.button, e.clientX, e.clientY);
});
```

### 步骤3：检查React组件状态
在Console中执行：
```javascript
// 检查是否有React DevTools
window.__REACT_DEVTOOLS_GLOBAL_HOOK__
```

### 步骤4：检查CSS层叠
在Elements标签中：
1. 选中窗口的标题栏元素
2. 查看Computed样式
3. 确认 `cursor: move` 是否生效
4. 确认 `pointer-events: auto` 是否生效

## 快速修复方案

### 方案A：强制启用拖动（临时调试）
在 `window.tsx` 的 `handleTitleBarMouseDown` 开头添加日志：

```typescript
const handleTitleBarMouseDown = (e: React.MouseEvent) => {
  console.log('🎯 Title bar mousedown', {
    button: e.button,
    target: e.target,
    isTrafficLights: (e.target as HTMLElement).closest('.macos-traffic-lights'),
    state: state,
  });
  
  if (e.button !== 0) return;
  if ((e.target as HTMLElement).closest('.macos-traffic-lights')) return;
  if (state === 'maximized') return;

  console.log('✅ Starting drag');
  e.preventDefault();
  setIsDragging(true);
  // ... rest of code
};
```

### 方案B：检查是否是构建问题
```bash
# 清理并重新构建
cd /Users/apple/Progame/DGOS
rm -rf node_modules/.vite
npm run dev
```

### 方案C：使用原生HTML测试
使用提供的 `test-drag-diagnosis.html` 测试：
1. 在同一个浏览器中打开测试页面
2. 测试拖动是否正常
3. 如果测试页面正常，说明是React应用的问题

## 确认问题已修复的标准

✅ 窗口可以通过标题栏拖动
✅ 点击traffic lights不会触发拖动
✅ 最大化的窗口不能拖动
✅ 鼠标悬停在标题栏显示move光标
✅ 拖动过程流畅，没有卡顿

## 需要提供的信息

如果问题仍然存在，请提供：
1. 浏览器类型和版本
2. 是否有任何JavaScript错误（在Console中）
3. `test-drag-diagnosis.html` 是否能正常拖动
4. 窗口标题栏的computed CSS样式截图

## 文件清单

修改的文件：
- ✅ packages/app-shell/src/macos/5-window.css
- ✅ packages/app-shell/src/macos/window.tsx
- ✅ packages/app-shell/src/macos/window-tabs.tsx
- ✅ packages/app-shell/src/macos/window-tabs.css
- ✅ packages/app-shell/src/macos/window-manager.tsx
- ✅ packages/app-shell/src/macos/index.tsx
- ✅ packages/app-shell/src/macos/3-dock.css
- ✅ packages/app-shell/src/macos/dock.tsx

测试文件：
- test-drag-diagnosis.html (诊断工具)
- test-window-fixes.html (完整功能演示)
