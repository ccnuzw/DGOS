# macOS 图标样式改进总结

## 修改日期
2026-10-04

## 问题描述
1. 程序墙（Launchpad）和 Dock 的图标样式不一致
2. 图标圆角不符合最新 macOS 设计规范
3. Dock 图标四周有白边
4. 程序墙中标签文字过长时会将图标顶上去

## 解决方案

### 1. 统一图标样式
**修改文件**: `packages/app-shell/src/macos/macos.css`

#### Dock 图标
- 移除了 `background: var(--surface)` 白色背景
- 移除了 `box-shadow` 和 `::before` 伪元素的高光效果
- 图标现在直接填充整个容器：`width: 100%; height: 100%`
- 使用 `object-fit: cover` 确保图标正确缩放

#### 程序墙图标
- 同样移除了白色背景和多余的阴影效果
- 使用 `filter: drop-shadow()` 添加微妙的阴影以保持视觉深度
- 图标填充方式与 Dock 保持一致

### 2. 现代化圆角设计
采用 macOS Sequoia/Sonoma 的 **Squircle** 圆角设计（约22%）：

- **Dock 图标** (48px): `border-radius: 10.5px` (≈22%)
- **程序墙图标** (64px): `border-radius: 14px` (≈22%)
- **响应式适配**:
  - 850px以下: Dock 44px → 9.5px radius
  - 520px以下: Dock 40px → 8.8px radius
  - 850px以下: 程序墙 56px → 12.3px radius

### 3. 修复标签布局问题
为 `.macos-launchpad__item` 添加固定高度：

```css
.macos-launchpad__item {
  height: 100px;  /* 固定高度防止标签推动图标 */
  justify-content: flex-start;
}
```

为 `.macos-launchpad__label` 添加布局控制：

```css
.macos-launchpad__label {
  flex-shrink: 0;
  min-height: 32px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  word-break: break-word;
}
```

## 改进效果

### 视觉统一性
✅ Dock 和程序墙图标样式完全一致
✅ 无白边，图标直接展示
✅ 符合最新 macOS 设计语言

### 布局稳定性
✅ 标签文字无论多长都不会影响图标位置
✅ 程序墙网格布局保持整齐
✅ 响应式断点下样式保持一致

### 性能优化
✅ 移除了不必要的 `::before` 伪元素
✅ 简化了阴影计算
✅ 使用更高效的 `drop-shadow` 滤镜

## 测试建议

1. 在不同屏幕尺寸下测试程序墙和 Dock
2. 测试长标签和短标签的显示效果
3. 验证深色模式和浅色模式下的表现
4. 检查图标放大动画是否正常工作

## 相关文件
- `packages/app-shell/src/macos/macos.css` - 主样式文件
- `packages/app-shell/src/macos/dock.tsx` - Dock 组件
- `packages/app-shell/src/macos/launchpad.tsx` - 程序墙组件
