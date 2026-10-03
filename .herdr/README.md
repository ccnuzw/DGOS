# DGOS Agent团队

**版本**: v4.0 - 基于真实架构  
**更新**: 2026-10-03  
**状态**: Ready to Start

## 团队结构（9角色）

基于DGOS真实架构和领域边界设计：

```
Lead (Claude) - 战略协调
    ↓
Planner (OpenCode + spec-docs) - 规格驱动
    ↓
    ├─ Worker-Platform (Codex) - Identity/Permission/Apps/System后端
    ├─ Worker-AI (Codex) - Provider/Model/AI Task/Extensions后端
    ├─ Worker-Web (Codex) - React UI全栈前端
    ├─ Worker-Native (Codex) - Tauri/Desktop/构建打包
    ├─ Worker-Test (Codex) - 编写测试/fixture（新增）
    └─ Worker-DevOps (Codex) - 部署/运维/CI/CD
    ↓
Verify (Codex) - 独立验证，运行测试
```

## 核心特点

### 1. 领域驱动划分
- **不是简单的Backend/Frontend**
- **按DGOS真实领域独立**：Platform、AI、Web、Native、Test、DevOps
- 每个Worker有明确的代码路径和功能规格

### 2. 真正的并行能力
- **最大并行度：5-6个任务**
- Worker-Platform和Worker-AI完全独立（不同数据库表、不同API路由）
- Worker-Web可以Mock开发，不阻塞
- Worker-Test可以和实现并行（TDD）

### 3. 测试是一等公民
- **Worker-Test专门编写测试**（不是Verify附带）
- Verify只负责运行测试和独立验证
- 测试是工程资产，需要维护

### 4. Spec-docs驱动
- **Context-pack有价值**（从3000行提炼200行关键信息）
- Work-package明确边界
- 不是流程文档垃圾

## 工作流程

### 周循环

**周一上午** (Lead + Planner):
- Lead定义本周目标（1-2个FR）
- Planner使用spec-docs生成context-pack和work-package
- 分配给对应Worker

**周二-周四** (Worker + Verify):
- Worker并行工作（5-6个任务）
- 完成后提交 → Verify验证（4小时内）
- PASS → 合并main
- FAIL → 当天修复

**周五** (Verify + Lead):
- Verify运行完整测试
- Lead验收，更新V1-实现状态.md
- 向用户汇报

## 领域映射

```yaml
Platform: Identity/Permission/Apps/System/Audit
  - src/identity, src/permissions, src/apps, src/system, src/audit
  - FR-010, FR-011, FR-002, FR-014

AI: Provider/Model/AI Task/Extensions/Actions
  - src/provider, src/provider-adapters, src/ai-task, src/extensions, src/actions
  - FR-012, FR-013, FR-007, FR-005, FR-003, FR-009

Web: React UI全栈
  - apps/web, packages/dgos-ui
  - 所有FR的前端部分

Native: Tauri/Desktop
  - apps/desktop, apps/ai-workbench-package
  - FR-001桌面集成

Test: 测试工程
  - tests/, fixtures/
  - 所有FR的测试资产

DevOps: 运维部署
  - scripts/, deployment/, docker/
  - 构建/打包/部署
```

## 并行示例

**典型Week：完成FR-012 Provider账号管理**

```
并行度=5

WP-001: Provider账号API      (Worker-Platform, 2天)
WP-002: Provider适配器       (Worker-AI, 2天)      ║ 同时进行
WP-003: Provider配置UI       (Worker-Web, 2天, Mock先行)
WP-004: Provider测试         (Worker-Test, 1天, TDD)
WP-005: 测试环境配置         (Worker-DevOps, 1天)

每个完成 → Verify 4小时内反馈
```

## 文档策略

- **权威文档**: `docs/` (功能规格、OpenAPI、架构设计)
- **工作文档**: `.herdr/work/` (context-pack、work-package，每周清理)
- **状态记录**: `.herdr/status/` (current.yaml实时更新)
- **证据**: `.herdr/evidence/` (截图、测试报告、日志)

## 配置

- **团队配置**: `team.json` (9角色)
- **当前状态**: `status/current.yaml`
- **角色定义**: `roles/*.md` (9个文件)

## 历史

- **2026-10-03**: 
  - 从8角色混乱模型重组
  - 经过v2(3角色太简单)、v3(5角色不够并行)
  - 最终v4(9角色)基于DGOS真实架构
  - 清理426→232个文档
  - 备份: `~/DGOS-herdr-backup-20261003.tar.gz`

## 成功指标

### 第一周
- 5-6个work-package并行
- 每个Worker交付2-3个包
- Verify验证10+次
- 80%包4小时内通过

### 第一个月
- 完成6-8个FR
- V1-实现状态.md显著进展
- 团队流畅协作

---

**准备就绪，可以启动！**
