# macOS UI CSS 重构方案

## 当前问题
1. **10个CSS文件**混乱叠加，样式冲突严重
2. 大量使用 `!important` 覆盖
3. 同一属性在多个文件中重复定义
4. 没有明确的加载顺序和优先级
5. 修改一个样式需要检查多个文件

## 新架构设计

### 文件结构（按加载顺序）
```
macos/
├── 0-variables.css          # CSS变量和设计令牌
├── 1-base.css               # 基础样式和重置
├── 2-system-bar.css         # 系统栏
├── 3-dock.css               # Dock（合并所有Dock相关）
├── 4-launchpad.css          # 程序墙
├── 5-window.css             # 窗口系统
├── 6-components.css         # 其他组件（通知、命令面板等）
└── 7-utilities.css          # 工具类和覆盖
```

### 设计原则

#### 1. 单一职责
- 每个文件只负责一个模块
- 不跨文件重复定义

#### 2. 层级清晰
```
Layer 0: Variables (CSS变量)
Layer 1: Base (基础、重置)
Layer 2-6: Components (组件，按渲染层级)
Layer 7: Utilities (工具类，最高优先级)
```

#### 3. 禁止 !important
- 除了 utilities.css 外，禁止使用 !important
- 通过选择器优先级和层级控制

#### 4. 命名规范
```css
/* BEM命名 */
.macos-[module]__[element]--[modifier]

/* 示例 */
.macos-dock                    /* 模块 */
.macos-dock__item              /* 元素 */
.macos-dock__item--active      /* 修饰符 */
```

#### 5. 主题支持
```css
/* 统一使用 data-theme */
[data-theme="light"] { }
[data-theme="dark"] { }

/* 避免分散在各处 */
```

## 重构步骤

### Phase 1: 创建新架构（不破坏现有）
1. 创建新的 7 个CSS文件
2. 从现有文件中提取和合并样式
3. 消除冲突和重复

### Phase 2: 整合和测试
1. 在 index.tsx 中按顺序导入新文件
2. 保留旧文件作为备份
3. 测试所有功能

### Phase 3: 清理
1. 删除旧的混乱文件
2. 更新文档
3. 验收

## 迁移映射

### 旧文件 → 新文件
```
macos.css (1100行)
  → 拆分到所有新文件

premium-macos.css (600行)
  → 3-dock.css (Dock相关)
  → 5-window.css (窗口相关)
  → 0-variables.css (变量)

ultra-realistic-macos.css (300行)
  → 合并到对应组件文件

premium-dock.css (200行)
  → 完全合并到 3-dock.css

premium-visual-boost.css
  → 分散到各组件或删除

其他7个小文件
  → 按功能合并
```

## 新文件内容预览

### 0-variables.css
```css
:root {
  /* 颜色 */
  --macos-bg-light: rgba(255, 255, 255, 0.7);
  --macos-bg-dark: rgba(30, 30, 30, 0.7);
  
  /* 阴影（统一定义，避免分散） */
  --macos-shadow-none: none;
  --macos-shadow-sm: 0 2px 8px rgba(0,0,0,0.1);
  
  /* 模糊 */
  --macos-blur-light: blur(80px);
  
  /* 圆角 */
  --macos-radius-icon: 22%; /* Squircle标准 */
  
  /* 动画 */
  --macos-transition-fast: 0.15s ease;
}
```

### 3-dock.css
```css
/* 合并所有 Dock 相关样式 */
/* 来源: macos.css + premium-macos.css + ultra-realistic-macos.css + premium-dock.css */

.macos-dock {
  /* 只在这里定义一次 */
}

.macos-dock__item {
  /* 只在这里定义一次 */
}

.macos-dock__icon {
  /* 关键：所有图标样式集中在这里 */
  /* 无需到处寻找和覆盖 */
}
```

## 好处

1. **清晰度** - 一眼看出样式在哪个文件
2. **可维护性** - 修改只需编辑一个文件
3. **性能** - 减少冲突，浏览器计算更快
4. **可扩展** - 新增模块只需新增文件
5. **团队协作** - 规范明确，减少冲突

## 时间估算
- Phase 1: 2-3小时（创建新架构）
- Phase 2: 1小时（测试）
- Phase 3: 30分钟（清理）

**总计: 3-4小时完成完整重构**

## 立即开始？
我现在可以开始执行 Phase 1，创建规范化的新CSS架构。是否开始？
