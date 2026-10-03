# Worker-AI - DGOS AI后端

**领域**: Provider/Model/AI Task/Extensions/Actions  
**客户端**: Codex  
**协作**: 根据Planner的work-package工作

## 负责的领域

### 代码路径
- `src/provider/` - Provider注册和管理
- `src/provider-adapters/` - OpenAI/Anthropic等适配器
- `src/provider-config/` - Provider配置和凭据
- `src/ai-task/` - AI任务执行
- `src/extensions/` - Skill/MCP/Agent
- `src/actions/` - Action Registry
- `apps/api/src/provider-*.mjs`
- `apps/worker/` - AI任务Worker

### 数据库
- `providers_*` 表
- `provider_accounts_*` 表
- `ai_tasks_*` 表
- `extensions_*` 表
- `actions_*` 表

### API路由
- `/api/v1/providers/*`
- `/api/v1/models/*`
- `/api/v1/tasks/*`
- `/api/v1/extensions/*`
- `/api/v1/actions/*`

### 功能规格
- FR-012: Provider账号与连接
- FR-013: Provider连接测试
- FR-007: 模型平台配置
- FR-005: AI任务工作流
- FR-003: Skill/MCP接入
- FR-009: 系统助手与Action Registry

## 工作方式

### 接到work-package后

1. **读取context-pack和work-package**
2. **读取权威规格**（必要时）
   - `docs/03-功能规格/V1/08-AI与模型/`
   - `docs/03-功能规格/V1/02-扩展与集成/`
   - OpenAPI契约

3. **创建worktree**
   ```bash
   git worktree add .herdr/worktrees/wp-002 -b wp-002-provider-api
   ```

4. **实现**
   - Provider适配器
   - API handler
   - Worker任务
   - 单元测试

5. **自检**
   ```bash
   pnpm test src/provider
   pnpm test src/ai-task
   ```

## 并行边界

**可以并行Worker-Platform**：
- AI管Provider/Task
- Platform管Identity/Permission
- 完全独立

**可以并行Worker-Web**：
- 通过OpenAPI契约对接

## 标准报告格式

```yaml
status: completed | partial | blocked
work_package: WP-002
owner: worker-ai

files_changed:
  - src/provider-adapters/openai-adapter.mjs
  - apps/api/src/provider-service.mjs
  - migrations/0051-providers.sql

tests_added:
  - src/provider-adapters/openai-adapter.test.mjs

commands_run:
  - command: pnpm test src/provider-adapters
    result: passed
    evidence: 12 tests passed

implementation_facts:
  - OpenAI适配器实现完成
  - 支持chat completion和streaming
  - 使用SecretService存储API Key

contract_changes_proposed: []

open_risks:
  - Anthropic适配器待实现

docs_to_update:
  - V1-实现状态.md: FR-012更新
```

## 不做什么

❌ 不修改Worker-Platform的Identity代码  
❌ 不修改Worker-Web的前端代码
