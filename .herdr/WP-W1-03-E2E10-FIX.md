# WP-W1-03: E2E-10 修复

**Work Package ID**: WP-W1-03  
**Owner**: Worker-C  
**Priority**: P0  
**Status**: queued → working  
**Estimated**: 2-3 天  
**Created**: 2026-10-03  
**Baseline**: 6c6a80b3780d3af71a825f1608246dc17e7b0b32

## Objective

修复 E2E-10 并发会话测试的 3/6 失败项，使其从部分通过变为完全通过。

## Background

根据 `.herdr/V1-E2E-EXECUTION-COMPLETE.md`，E2E-10 当前状态：
- 总测试：6 个
- 通过：3 个
- 失败：3 个

失败的具体问题：
1. **授权作用域拒绝**：返回 500 而非 403
2. **会话访问控制**：返回 422 而非 201  
3. **速率限制**：未触发

## Scope

### In Scope
1. 修复作用域验证中间件的错误处理
2. 修复 provider account 创建的请求验证逻辑
3. 配置速率限制器的时钟依赖

### Out of Scope
- 修改数据库 schema (migrations 冻结)
- 修改前端代码 (apps/web/src)
- 添加新的业务功能

## Allowed Paths

```
apps/api/src/identity-service.mjs
apps/api/src/identity-routes.mjs
apps/api/src/provider-routes.mjs
src/security/rate-limiter.mjs
tests/security/v1-auth-authz.test.mjs
.herdr/WP-W1-03-*.md
```

## Forbidden Paths

```
migrations/*
apps/web/src/*
apps/web/dist/*
```

## Dependencies

- PostgreSQL 可用 (docker compose up)
- Redis 可用 (docker compose up)

## Detailed Tasks

### Task 1: 修复作用域验证返回 500 → 403

**Current Issue**:
```
Test: "Authorization - insufficient scope rejected"
Expected: 403 Forbidden with errorKey='insufficient_scope'
Actual: 500 Internal Server Error
```

**Investigation Steps**:
1. 读取 `apps/api/src/identity-routes.mjs` 和 `apps/api/src/identity-service.mjs`
2. 找到 scope 验证中间件
3. 检查错误处理逻辑
4. 确保 scope 不足时返回 403 而非抛出未捕获异常

**Expected Fix**:
```javascript
// 伪代码示例
if (!hasRequiredScope(token, requiredScope)) {
  return reply.code(403).send({
    errorKey: 'insufficient_scope',
    message: 'Token does not have required scope'
  });
}
```

### Task 2: 修复会话访问控制返回 422 → 201

**Current Issue**:
```
Test: "Authorization - session-based access control"
Expected: 201 Created
Actual: 422 Unprocessable Entity
```

**Investigation Steps**:
1. 读取 `apps/api/src/provider-routes.mjs`
2. 找到 provider account 创建路由
3. 检查请求参数验证
4. 根据 E2E 报告，修复参数映射：
   - `protocol` → `protocolType`
   - `label` → `displayName`
   - `endpoint` → `scope.endpoint`

**Expected Fix**:
确保请求体验证和参数映射一致。

### Task 3: 修复速率限制未触发

**Current Issue**:
```
Test: "Rate limiting - login attempts limited"
Expected: 429 Too Many Requests
Actual: 未触发速率限制
```

**Investigation Steps**:
1. 读取 `src/security/rate-limiter.mjs`
2. 检查速率限制器配置
3. 确认时钟依赖（可能需要 fake clock for tests）
4. 读取测试文件 `tests/security/v1-auth-authz.test.mjs`
5. 确保测试使用正确的 login endpoint: `/api/v1/identity/admin/login`

**Expected Fix**:
配置速率限制器使其在测试中正确触发。

## Acceptance Criteria

1. ✅ `tests/security/v1-auth-authz.test.mjs` 全部通过 (当前 3/6 → 目标 6/6)
2. ✅ "Authorization - insufficient scope rejected" 返回 403 + errorKey='insufficient_scope'
3. ✅ "Authorization - session-based access control" 返回 201 Created
4. ✅ "Rate limiting - login attempts limited" 返回 429 Too Many Requests
5. ✅ 回归测试通过：`pnpm run test:integration` 不引入新失败
6. ✅ 代码风格检查通过：`pnpm run check`

## Commands to Execute

```bash
# 启动依赖服务
docker compose up -d postgres redis

# 执行目标测试
node --test tests/security/v1-auth-authz.test.mjs

# 回归验证
pnpm run test:integration

# 代码检查
pnpm run check
node --check apps/api/src/identity-service.mjs
node --check apps/api/src/identity-routes.mjs
node --check apps/api/src/provider-routes.mjs
```

## Writeback

完成后更新以下文件：
1. `.herdr/WP-W1-03-E2E10-FIX-REPORT.md` - 工作报告
2. `docs/05-测试与发布/端到端验收/用例矩阵.md` - 更新 E2E-10 状态为 ✅ 完全通过 (6/6)
3. `docs/02-产品与版本/当前版本/V1-实现状态.md` - 更新 FR-010 状态

## Report Template

完成后提交报告，包含：

```yaml
work_package: WP-W1-03
status: completed | partial | blocked
owner: worker-c
files_changed:
  - apps/api/src/identity-routes.mjs
  - apps/api/src/provider-routes.mjs
  - src/security/rate-limiter.mjs
tests_executed:
  - command: node --test tests/security/v1-auth-authz.test.mjs
    result: 6/6 passed
    evidence: /tmp/e2e-10-fix-*.log
contract_changes: none
open_risks: []
next_steps: []
```

## Context References

- E2E 执行报告: `.herdr/V1-E2E-EXECUTION-COMPLETE.md` (2026-10-02)
- 用例矩阵: `docs/05-测试与发布/端到端验收/用例矩阵.md`
- FR-010 规格: `docs/03-功能规格/V1/10-身份与治理/01-管理员登录与会话.md`

## Notes

- 不要修改数据库 schema，47 条 migration 已冻结
- 不要修改前端，UI 证据在 Wave 2
- 只修复测试失败，不添加新功能
- 所有修改必须有对应的测试验证
