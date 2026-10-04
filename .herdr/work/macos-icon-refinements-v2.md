# macOS 图标样式优化 V2 - 基于真实 macOS Sequoia 参考

## 修改日期
2026-10-04 (第二轮优化)

## 参考来源
真实 macOS Sequoia 截图：
- 程序墙（Launchpad）布局
- Dock 样式和透明度

---

## 🎨 核心改进

### 1. 图标尺寸调整（更接近真实macOS）

#### 程序墙图标
- **从 64px 增大到 80px** - 更显眼，更符合真实比例
- 圆角：17.6px (22% squircle)
- 悬停时放大到 105% 并增强阴影

#### Dock图标
- **从 48px 增大到 56px** - 更大更易点击
- 圆角：12.3px (22% squircle)
- 添加微妙的投影效果

### 2. 布局和间距优化

#### 程序墙网格
```css
grid-template-columns: repeat(7, 1fr);  /* 7列布局 */
gap: 40px 48px;  /* 行间距40px，列间距48px */
padding: 60px 80px;  /* 更宽松的边距 */
max-width: 1100px;
```

#### 程序墙项目容器
```css
height: 120px;  /* 固定高度防止标签影响布局 */
gap: 12px;  /* 图标和标签间距 */
padding: 12px;
```

### 3. 文字样式改进

```css
.macos-launchpad__label {
  font-size: 13px;  /* 从12px增大 */
  font-weight: 400;
  line-height: 1.2;  /* 更紧凑的行高 */
  letter-spacing: -0.01em;  /* 轻微负字距 */
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);  /* 更强的阴影 */
  max-width: 90px;
}
```

### 4. Dock 透明度和模糊效果升级

#### 浅色模式
```css
background: linear-gradient(
  to bottom,
  rgba(255, 255, 255, 0.25),
  rgba(255, 255, 255, 0.2),
  rgba(255, 255, 255, 0.18)
);
backdrop-filter: blur(80px) saturate(180%) brightness(1.15);
border-radius: 20px;  /* 从24px减小，更现代 */
```

#### 深色模式
```css
background: linear-gradient(
  to bottom,
  rgba(50, 50, 50, 0.35),
  rgba(40, 40, 40, 0.3),
  rgba(35, 35, 35, 0.28)
);
backdrop-filter: blur(80px) saturate(180%) brightness(0.95);
```

### 5. 阴影和深度效果

#### 程序墙图标阴影
```css
filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.25)) 
        drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15));

/* 悬停时 */
filter: drop-shadow(0 6px 20px rgba(0, 0, 0, 0.3)) 
        drop-shadow(0 3px 6px rgba(0, 0, 0, 0.2));
```

#### Dock图标阴影
```css
filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));

/* 悬停时 */
filter: drop-shadow(0 3px 10px rgba(0, 0, 0, 0.25));
```

### 6. 响应式断点优化

#### @media (max-width: 850px) - 中等屏幕
- 程序墙图标：70px (radius: 15.4px)
- 程序墙布局：5列
- Dock图标：50px (radius: 11px)
- 间距：32px×40px

#### @media (max-width: 520px) - 小屏幕
- 程序墙布局：4列
- Dock图标：44px (radius: 9.7px)
- 间距：24px×32px

---

## 🎯 视觉效果对比

### 优化前
- ❌ 图标偏小（64px程序墙，48px Dock）
- ❌ 间距紧凑
- ❌ Dock背景过于明显
- ❌ 阴影不够自然

### 优化后
- ✅ 图标尺寸符合真实macOS（80px程序墙，56px Dock）
- ✅ 宽松舒适的间距（7列布局）
- ✅ 超透明模糊Dock，更现代
- ✅ 多层次投影，更有深度
- ✅ 悬停交互更细腻

---

## 🔍 关键设计原则

### 1. 22% Squircle 圆角
所有图标统一使用图标尺寸的22%作为圆角半径：
- 80px → 17.6px
- 70px → 15.4px
- 56px → 12.3px
- 50px → 11px
- 44px → 9.7px

### 2. 多层阴影系统
使用 `drop-shadow` 实现多层阴影，而非传统 `box-shadow`：
- 主阴影：模糊范围更大，透明度更低
- 辅助阴影：模糊范围小，增加边缘锐度

### 3. 超级模糊背景
Dock使用80px模糊半径 + 180%饱和度 + 亮度调整，达到macOS级别的玻璃态效果

### 4. 固定高度布局
程序墙项目使用固定高度，配合 `flex-shrink: 0`，确保标签永远不会影响图标位置

---

## 📊 性能考虑

- ✅ 使用 `will-change: transform` 优化动画
- ✅ `filter` 属性启用GPU加速
- ✅ `transition` 限制在必要属性
- ✅ 避免重绘，使用transform实现缩放

---

## 🧪 测试清单

- [x] 浅色模式下Dock透明度
- [x] 深色模式下Dock对比度
- [x] 程序墙7列布局
- [x] 长标签文字不影响图标
- [x] 悬停动画流畅度
- [x] 响应式断点适配
- [x] 图标阴影自然度
- [x] 放大动画效果

---

## 📁 修改文件
- `packages/app-shell/src/macos/macos.css`

## 兼容性
- ✅ Chrome/Edge (Chromium)
- ✅ Safari (Webkit)
- ✅ Firefox
- ✅ 支持 `-webkit-backdrop-filter`

---

## 下一步建议

1. **图标资源**: 确保提供80×80的高清图标资源
2. **动态模糊**: 可考虑根据壁纸亮度动态调整Dock透明度
3. **触控优化**: 为触摸屏设备增加更大的点击区域
4. **无障碍**: 添加键盘导航焦点样式
