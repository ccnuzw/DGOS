# 图标圆角和背景问题修复

## 问题
用户反馈图标有丑陋的外围背景，看起来像是图标被压缩在一个小框里。

## 根本原因
SVG图标本身使用了 `rx="14"` 的圆角，这是针对58x58的固定尺寸设计的。当图标被放大到96px时，圆角比例不对了（14/58 = 24%，而macOS标准是22%）。

## 解决方案

### 1. 调整圆角半径
将所有图标的 `rx` 从 `14` 改为 `12.8`，保持22%的标准比例：
- 58 × 22% = 12.76 ≈ 12.8

### 2. SVG响应式设计
```tsx
<svg 
  width="100%" 
  height="100%" 
  viewBox="0 0 58 58"
  style={{ borderRadius: 'inherit' }}
>
```

关键改动：
- `width="58"` → `width="100%"` - SVG填充父容器
- `height="58"` → `height="100%"` - SVG填充父容器  
- 添加 `style={{ borderRadius: 'inherit' }}` - 继承CSS圆角

### 3. CSS层面的圆角控制
CSS已经设置了正确的圆角：
```css
.macos-launchpad__icon {
  width: 96px;
  height: 96px;
  border-radius: 21px;  /* 96 × 22% = 21.12 */
}
```

## 修复的图标
✅ CatalogIcon - 应用目录
✅ AssistantIcon - AI助手
✅ TasksIcon - 任务列表
✅ SettingsIcon - 设置齿轮
✅ ProvidersIcon - 云服务
✅ ModelsIcon - 模型层
✅ SkillsIcon - 技能拼图
✅ MCPIcon - 连接节点
✅ DeveloperIcon - 代码符号
✅ SystemIcon - 系统信息
✅ DownloadsIcon - 下载文件夹
✅ TrashIcon - 垃圾桶

## 效果对比

### 修复前
- ❌ 固定58x58尺寸，放大时模糊
- ❌ 圆角比例不对（24%）
- ❌ 图标看起来被压缩

### 修复后
- ✅ 100%填充容器，清晰锐利
- ✅ 标准22% squircle圆角
- ✅ 图标完美填充，无外框

## 技术细节

### SVG viewBox的作用
`viewBox="0 0 58 58"` 定义了SVG的坐标系统，保持不变。配合 `width="100%"` 和 `height="100%"`，SVG会自动缩放以填充任意大小的容器。

### 圆角计算公式
```
CSS圆角 = 容器尺寸 × 22%
SVG圆角 = viewBox尺寸 × 22%

96px容器 → 21px CSS圆角
58px viewBox → 12.8px SVG圆角
```

### 为什么保留SVG内部的rect圆角
即使CSS设置了圆角，SVG内部的渐变背景也需要圆角才能完美贴合。两者配合：
- CSS `border-radius` - 裁剪整个SVG容器
- SVG `rx` - 让渐变背景本身就是圆角

## 构建状态
✅ 编译成功
✅ 所有图标已更新
✅ 样式生效

## 测试建议
1. 在96px（程序墙）和56px（Dock）尺寸下测试
2. 验证圆角是否平滑一致
3. 检查图标是否清晰，无压缩感
4. 确认渐变背景完美填充
