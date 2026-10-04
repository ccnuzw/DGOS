# V1 Web MVP - Local Development Preview（2-3天）

**目标**: 本地环境完整可验证的Web版MVP
**定位**: Local Development Preview，不称为Release
**时间**: 2-3天

---

## 务实的范围定义

### ✅ 我们要做的（本地可验证）

**Web版核心功能**:
- Provider配置（用Mock/local fixture）
- Task提交、SSE流式、Artifact查看
- FR-002: 应用目录浏览
- FR-003: Skill/MCP基础管理
- FR-009: Assistant基础UI
- 完整的本地演示流程

**验证标准**:
- 本地Docker Compose可启动
- Web界面完整可访问
- 核心流程本地可演示
- 有演示视频
- 有完整文档

### ⚠️ 我们不做的（需要外部环境）

- Native signed build（无签名环境）
- 真实外部Provider验证（无生产环境）
- 生产级部署（本地预览）
- 完整性能测试

### 📋 明确标记的限制

**交付物会清楚说明**:
- ✅ 适用：本地开发环境
- ⚠️ 限制：使用Mock数据
- ⚠️ 限制：Native需要签名环境
- ⚠️ 限制：真实Provider需要配置

---

## 2-3天执行计划

### Day 2下午-Day 3: Web完整演示链（1.5天）

**Worker-AI + Worker-Web（并行）**:
1. 确保Web版核心链路完整
2. Provider Mock配置就绪
3. Task提交、SSE、Artifact完整流程
4. 所有UI组件work
5. 本地E2E测试通过

**Worker-Test**:
1. 基于本地环境的E2E测试
2. 确保Mock数据完整
3. 验证本地演示流程

**产出**:
- ✅ Web版本地完整可用
- ✅ 核心流程可演示

---

### Day 4上午: 本地环境打包和验证（0.5天）

**Worker-DevOps**:
1. Docker Compose本地部署包
2. 快速开始文档
3. 本地环境验证脚本
4. 确保一键启动

**Worker-Test**:
1. 完整本地验证
2. 生成验证报告

**产出**:
- ✅ 本地部署包ready
- ✅ 验证通过

---

### Day 4下午-Day 5: 文档、演示、交付（1天）

**上午 - Planner + Worker-Platform**:
1. 更新V1-实现状态.md（标记为Local Preview）
2. 编写限制说明文档
3. 准备演示脚本

**下午 - Worker-Platform**:
1. 录制演示视频（5-10分钟）
2. 展示本地完整流程
3. 说明限制和下一步

**Worker-DevOps**:
1. 最终打包
2. README完善
3. 标记为"v1-web-mvp-local-preview"

**产出**:
- ✅ 演示视频
- ✅ 完整文档
- ✅ 本地预览包

---

## 并行度规划

### Day 2下午-Day 3（1.5天）
```
Worker-AI      → Web核心链完善
Worker-Web     → UI完善和集成
Worker-Test    → 本地E2E测试
Worker-Platform → FR-002/003/009收尾
```
并行: 4个Workers

### Day 4上午（0.5天）
```
Worker-DevOps  → 本地部署包
Worker-Test    → 完整验证
```
并行: 2个Workers

### Day 4下午-Day 5（1天）
```
Planner        → 文档
Worker-Platform → 演示视频
Worker-DevOps  → 最终打包
```
并行: 3个Workers

---

## 交付物清单

### 必须有
- ✅ Docker Compose本地部署包
- ✅ Web版完整可访问
- ✅ 核心演示流程work
- ✅ 演示视频（5-10分钟）
- ✅ 快速开始文档
- ✅ 限制说明文档

### 清楚标记
- ⚠️ "V1 Web MVP - Local Development Preview"
- ⚠️ 不是正式Release
- ⚠️ 需要本地环境
- ⚠️ 使用Mock数据
- ⚠️ Native需要签名环境
- ⚠️ 真实Provider需要配置

---

## 成功标准（务实版）

### 必须满足
- [ ] 本地Docker Compose一键启动
- [ ] Web界面完整可访问
- [ ] Provider配置→Task提交→查看结果 完整演示
- [ ] 有5-10分钟演示视频
- [ ] 有快速开始文档

### 可接受的限制
- 使用Mock Provider
- 本地环境only
- Native未包含
- 性能未优化
- 部分高级功能未完成

---

## 风险管理

### 低风险
- 聚焦本地环境（可控）
- 不依赖外部服务
- 时间短（2-3天）

### 如果遇到问题
- 优先核心演示链
- 可延后文档细节
- 可用录屏代替live demo

---

## 交付后的说明

**这是什么**:
- V1 Web版的本地开发预览
- 展示核心功能和架构
- 为正式Release打基础

**下一步**:
- 配置签名环境 → Native版本
- 配置真实Provider → 生产验证
- 性能优化和完善

**时间表**:
- 本地预览: 2-3天（现在）
- 正式Release: 需要环境配置后再评估
