# 窗口拖动问题 - 完整修复方案

## 问题现象
在你的电脑上，DGOS WEB端的窗口无法拖动，但在测试页面中可以正常拖动。

## 根本原因分析

拖动功能在纯HTML页面中工作正常，说明浏览器和基础逻辑没有问题。
问题很可能出在React应用的特定配置或事件处理上。

## 完整修复清单

### ✅ 已完成的修复

1. **移除Electron专用CSS属性**
   - 文件: `packages/app-shell/src/macos/5-window.css`
   - 移除了 `-webkit-app-region: drag` 和 `-webkit-app-region: no-drag`
   - 这些属性在Web端会干扰鼠标事件

2. **添加正确的cursor样式**
   - 标题栏: `cursor: move`
   - Traffic lights: `cursor: default`
   - 最大化窗口标题栏: `cursor: default`

3. **阻止最大化窗口拖动**
   - 文件: `packages/app-shell/src/macos/window.tsx`
   - 在 `handleTitleBarMouseDown` 中添加 `if (state === 'maximized') return;`

4. **修复z-index叠加问题**
   - 移除CSS中的固定z-index
   - 让inline style完全控制z-index

5. **修复全屏和标签栏**
   - Dock在全屏时自动隐藏
   - 标签栏在全屏时显示
   - 标签栏关闭按钮尺寸优化

## 需要你验证的关键点

### 检查点 1: 清除缓存并重新构建

```bash
cd /Users/apple/Progame/DGOS

# 清除所有缓存
rm -rf node_modules/.vite
rm -rf apps/web/dist

# 重启开发服务器
# 如果已经在运行，先停止（Ctrl+C）
npm run dev
```

### 检查点 2: 硬刷新浏览器

在浏览器中打开 `http://127.0.0.1:15133`，然后：

**Chrome/Edge:**
- Windows: `Ctrl + Shift + R` 或 `Ctrl + F5`
- Mac: `Cmd + Shift + R`

**Firefox:**
- Windows: `Ctrl + F5`
- Mac: `Cmd + Shift + R`

**Safari:**
- Mac: `Cmd + Option + R`

### 检查点 3: 检查浏览器控制台

1. 打开开发者工具 (F12)
2. 切换到 Console 标签
3. 尝试拖动窗口
4. 查看是否有任何红色错误信息

**如果有错误，请复制完整的错误信息**

### 检查点 4: 验证CSS是否加载

在浏览器控制台执行：

```javascript
const titleBar = document.querySelector('.macos-window__title-bar');
if (titleBar) {
  const styles = window.getComputedStyle(titleBar);
  console.log({
    cursor: styles.cursor,
    pointerEvents: styles.pointerEvents,
    userSelect: styles.userSelect,
    webkitAppRegion: styles.webkitAppRegion || 'not set'
  });
} else {
  console.log('❌ 找不到标题栏元素');
}
```

**期望的输出:**
```javascript
{
  cursor: "move",
  pointerEvents: "auto",
  userSelect: "none",
  webkitAppRegion: "not set" // 或者 undefined
}
```

### 检查点 5: 测试事件监听

在浏览器控制台执行：

```javascript
const titleBar = document.querySelector('.macos-window__title-bar');
if (titleBar) {
  titleBar.addEventListener('mousedown', function(e) {
    console.log('🎯 Mousedown detected!', {
      button: e.button,
      clientX: e.clientX,
      clientY: e.clientY,
      target: e.target.className
    });
  });
  console.log('✅ 测试监听器已添加，请尝试点击标题栏');
} else {
  console.log('❌ 找不到标题栏');
}
```

然后点击窗口标题栏，看控制台是否输出 `🎯 Mousedown detected!`

## 可能的额外问题

### 问题A: React StrictMode导致的问题

**检查**: 打开 `apps/web/src/main.tsx`，查找是否有 `<React.StrictMode>`

**如果有，临时注释掉测试:**
```typescript
// 将这样的代码:
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 改为:
createRoot(document.getElementById("root")!).render(<App />);
```

### 问题B: 浏览器扩展干扰

**测试步骤:**
1. 打开浏览器的隐私/无痕模式
2. 在无痕模式下访问 `http://127.0.0.1:15133`
3. 测试窗口是否能拖动

如果无痕模式下可以拖动，说明是某个浏览器扩展导致的问题。

### 问题C: 操作系统或浏览器特定问题

**提供以下信息:**
- 操作系统: Windows / macOS / Linux
- 操作系统版本:
- 浏览器: Chrome / Firefox / Safari / Edge
- 浏览器版本:

## 最终验证步骤

### 步骤1: 测试纯HTML页面
```bash
# 在浏览器中打开
file:///Users/apple/Progame/DGOS/test-drag-diagnosis.html
```

如果这个页面可以拖动 ✅，继续下一步
如果这个页面不能拖动 ❌，说明是浏览器或系统问题

### 步骤2: 测试React应用

1. 确保开发服务器正在运行
2. 清除浏览器缓存并硬刷新
3. 打开开发者工具监控Console
4. 尝试拖动窗口

## 调试模式 - 添加详细日志

如果以上都无法解决，在 `packages/app-shell/src/macos/window.tsx` 中添加调试日志：

```typescript
const handleTitleBarMouseDown = (e: React.MouseEvent) => {
  // ===== 添加这些日志 =====
  console.log('🔍 Title bar mousedown triggered', {
    button: e.button,
    clientX: e.clientX,
    clientY: e.clientY,
    target: (e.target as HTMLElement).className,
    state: state,
    bounds: bounds
  });
  // ===== 日志结束 =====

  if (e.button !== 0) {
    console.log('❌ Not left click');
    return;
  }
  
  if ((e.target as HTMLElement).closest('.macos-traffic-lights')) {
    console.log('❌ Clicked on traffic lights');
    return;
  }
  
  if (state === 'maximized') {
    console.log('❌ Window is maximized');
    return;
  }

  console.log('✅ Starting drag');
  e.preventDefault();
  setIsDragging(true);
  setDragStart({
    x: e.clientX - bounds.x,
    y: e.clientY - bounds.y,
  });
  console.log('📍 Drag start offset:', {
    x: e.clientX - bounds.x,
    y: e.clientY - bounds.y
  });
  onFocus?.();
};
```

然后在 `useEffect` 中添加：

```typescript
useEffect(() => {
  if (!isDragging) return;
  
  console.log('🎯 Drag effect activated');

  const handleMouseMove = (e: MouseEvent) => {
    const newX = e.clientX - dragStart.x;
    const newY = Math.max(44, e.clientY - dragStart.y);
    
    // 每100次移动才打印一次，避免日志太多
    if (Math.random() < 0.01) {
      console.log('🖱️ Moving:', { newX, newY });
    }

    onBoundsChange?.({
      ...bounds,
      x: newX,
      y: newY,
    });
  };

  const handleMouseUp = () => {
    console.log('🏁 Drag ended');
    setIsDragging(false);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  return () => {
    console.log('🧹 Cleaning up drag listeners');
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}, [isDragging, dragStart, bounds, onBoundsChange]);
```

重新启动开发服务器，然后在浏览器中测试并观察控制台输出。

## 联系我时请提供

如果问题仍然存在，请提供：

1. ✅ 浏览器和操作系统信息
2. ✅ 浏览器控制台的完整输出（包括任何错误）
3. ✅ 检查点4的CSS验证结果
4. ✅ 检查点5的事件监听测试结果
5. ✅ test-drag-diagnosis.html 是否能正常拖动
6. ✅ 是否在无痕模式下测试过
7. ✅ 是否清除了缓存并硬刷新

这样我可以更准确地定位问题！
