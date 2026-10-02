---
title: Provider账号与连接技术设计
version: V1
feature_id: V1-FR-012
updated: 2026-10-02
---
# Provider 账号与连接：技术设计

来源：[功能主文档](03-Provider账号与连接.md)，D032、ADR-0005–0007。ProviderConfig已有实体与PG实现，不重建平行模型。

## 单元契约

| 单元 | 前置条件 | 返回/后置条件 | 副作用 |
| --- | --- | --- | --- |
| createAccount(input) | 主体/协议有效、Secret可用 | 脱敏账号，秘密不出普通响应 | Secret写入及失败补偿、账号/outbox |
| bind(account, config, version) | 两实体归属/协议/授权相容 | 单一版本化绑定 | 绑定与审计同事务 |
| setState(account, version) | 所属范围、版本和授权通过 | 停用阻断新任务，旧task可查 | 状态与准入失效同事务 |
| delete(account) | 无活动配置/任务/探测引用 | 撤销记录，历史保留 | 引用锁内变更，Secret清理可恢复 |

## 伪代码

```text
create(input): Result<Account>
  // B12-01
  authorize owner; write secret using scoped handle
  BEGIN TRANSACTION; insert account + outbox; COMMIT OR ROLLBACK
  on failure compensate unbound secret without exposing it
bind(input): Result<Binding>
  // B12-02
  BEGIN TRANSACTION; lock account/config; verify owners, protocols, versions
  if incompatible: ROLLBACK; return permission_denied/version_conflict
  write binding + audit; COMMIT OR ROLLBACK
disable(input): Result<Account>
  // B12-03
  BEGIN TRANSACTION; conditional state update + outbox; COMMIT OR ROLLBACK
  submit and dispatch both re-read effective account/config eligibility
delete(input): Result<Account>
  // B12-04
  BEGIN TRANSACTION; recheck ownership and active references under locks
  if referenced: ROLLBACK; return account_in_use
  revoke binding/account + outbox; COMMIT OR ROLLBACK
  run idempotent secret cleanup; preserve task/catalog/audit history
```

## 分支到测试追踪

| 分支 | 功能 AC | 跨功能验收 | 现存资产与限制 |
| --- | --- | --- | --- |
| B12-01 | AC01 | V1-E2E-13 | provider-api/postgres-provider有脱敏持久化子集 |
| B12-02 | AC02 | V1-E2E-13 | 需补跨归属/协议不匹配/并发版本失败断言 |
| B12-03 | AC03 | V1-E2E-13、V1-E2E-07 | 需验证UI选择与submit/dispatch同步阻断，旧task仍收敛 |
| B12-04 | AC04 | V1-E2E-13 | 需配置/Task/ConnectionTest引用竞态、Secret补偿证据 |

## 约束备注

source/协议不是授权；不引入V2普通多用户或共享账号业务。默认账号唯一性由数据库作用域约束兜底。迁移与回填不得级联删除Task/Artifact/Audit；既有无效绑定隔离并报告，不能自动跨主体授权。实际测试映射见[AC资产核对](../V1-AC资产核对-2026-10-02.md)。
