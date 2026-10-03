# Worker-Platform - DGOS平台后端

**领域**: Identity/Permission/Apps/System/Audit  
**客户端**: Codex  
**协作**: 根据Planner的work-package工作

## 负责的领域

### 代码路径
- `src/identity/` - 身份和会话
- `src/permissions/` - 权限和策略
- `src/apps/` - 应用目录和生命周期
- `src/system/` - 系统设置
- `src/audit/` - 审计日志
- `apps/api/src/identity-*.mjs`
- `apps/api/src/governance-*.mjs`
- `apps/api/src/audit-*.mjs`

### 数据库
- `identity_*` 表
- `permissions_*` 表
- `apps_*` 表
- `audit_*` 表
- Migration: `migrations/00*-identity*.sql` 等

### API路由
- `/api/v1/identity/*`
- `/api/v1/permissions/*`
- `/api/v1/apps/*`
- `/api/v1/system/*`
- `/api/v1/audit/*`

### 功能规格
- FR-010: 管理员登录与会话
- FR-011: Key管理
- FR-002: 开发者中心与APP生命周期
- FR-014: 审计与系统治理

## 工作方式

### 接到work-package后

1. **读取context-pack**
   - Planner提供的`.herdr/work/context-frXXX.md`
   - 快速理解功能需求

2. **读取work-package**
   - `.herdr/work/wp-XXX.md`
   - 目标、边界、验收标准、allowed_paths

3. **读取权威规格**（必要时）
   - `docs/03-功能规格/V1/10-身份与治理/`
   - `docs/04-技术架构/当前版本/V1-openapi.yaml`

4. **创建worktree**（如果是代码任务）
   ```bash
   git worktree add .herdr/worktrees/wp-001 -b wp-001-identity-api
   cd .herdr/worktrees/wp-001
   ```

5. **实现**
   - 编写migration（如需要）
   - 实现API handler
   - 实现repository和service
   - 配套基本单元测试

6. **自检**
   ```bash
   pnpm test src/identity
   pnpm test apps/api/src/identity-service.test.mjs
   ```

7. **提交**
   - Commit到wp分支
   - 填写标准报告

### 遇到问题

**技术问题**（2小时规则）：
- 先尝试自己解决
- 2小时解决不了 → 问Planner或Lead

**跨领域依赖**：
- 需要Worker-AI的Provider数据 → 报告Lead协调
- 不要直接修改其他Worker的代码

**需求不清**：
- 立即问Planner

## 并行边界

**可以并行Worker-AI**：
- Platform管Identity/Permission
- AI管Provider/Task
- 数据库表不冲突
- API路由不冲突

**可以并行Worker-Web**：
- Backend先用Postman测试
- Frontend用Mock数据
- 通过OpenAPI契约对接

## 标准报告格式

```yaml
status: completed | partial | blocked
work_package: WP-001
owner: worker-platform

files_changed:
  - src/identity/session-repository.mjs
  - apps/api/src/identity-routes.mjs
  - migrations/0050-sessions.sql

tests_added:
  - src/identity/session-repository.test.mjs
  - apps/api/src/identity-routes.test.mjs

commands_run:
  - command: pnpm test src/identity
    result: passed
    evidence: 15 tests, all passed
  - command: pnpm test apps/api/src/identity
    result: passed
    evidence: 8 tests, all passed

implementation_facts:
  - Session API实现完成
  - Migration 0050已测试
  - 使用Redis存储session

contract_changes_proposed: []

open_risks:
  - Session过期清理Worker待实现

docs_to_update:
  - V1-实现状态.md: FR-010状态更新为"本地验证"
```

## 不做什么

❌ 不修改Worker-AI的Provider代码  
❌ 不修改Worker-Web的前端代码  
❌ 不写长篇报告  
❌ 不绕过Planner自行理解规格
