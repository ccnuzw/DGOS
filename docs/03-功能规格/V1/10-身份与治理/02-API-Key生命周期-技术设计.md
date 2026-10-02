---
title: API Key生命周期技术设计
version: V1
feature_id: V1-FR-011
updated: 2026-10-02
---
# API Key 生命周期：技术设计

来源：[功能主文档](02-API-Key生命周期.md)，ADR-0005–0007。Key是DGOS调用者凭据，不是Provider凭据；字段以OpenAPI为准。

## 单元契约

| 单元 | 前置条件 | 返回/后置条件 | 副作用 |
| --- | --- | --- | --- |
| createKey(owner, scopes, requestId) | 创建者拥有目标资源及所授全部权限 | 一次性明文、持久化digest与元数据 | Key与outbox同事务 |
| authorizeKey(key, resource) | Key未过期/撤销，主体与scope仍有效 | 当前目标的允许/拒绝 | 拒绝无目标副作用 |
| rotateKey(key, baseVersion) | 所属主体、新鲜授权、窗口策略有效 | 新Key与rotationGroup，旧Key有限有效 | 原子新旧关系与审计 |
| revoke/expire(key) | 目标授权和版本通过 | 所有实例后续请求拒绝 | 状态与审计同事务 |

## 伪代码

```text
createKey(input): Result<OneTimeSecret>
  // B11-01
  generate high entropy secret; compute irreversible digest
  BEGIN TRANSACTION; validate request replay and owner; persist digest + outbox
  COMMIT OR ROLLBACK; return plaintext only for original successful issuance
authorize(input): Decision
  // B11-02
  recheck key state, expiry, owner's current permissions and target resource scope
  if scope exceeds creator or resource authority: deny before side effect
rotate(input): Result<Rotation>
  // B11-03
  BEGIN TRANSACTION; lock rotation group; check version and idempotency
  create new key and bounded overlap metadata; preserve old key on failure
  append audit; COMMIT OR ROLLBACK
  explicit switch confirmation or window expiry revokes old key with audit
revoke(input): Result<Key>
  // B11-04
  BEGIN TRANSACTION; conditional revoke + outbox; COMMIT OR ROLLBACK
  every instance rechecks authoritative state before protected action
```

## 分支到测试追踪

| 分支 | 功能 AC | 跨功能验收 | 现存资产与限制 |
| --- | --- | --- | --- |
| B11-01 | AC01 | V1-E2E-12 | identity-api、postgres-identity有明文/digest/事务子集 |
| B11-02 | AC02 | V1-E2E-12 | 现有scope断言需补创建者资源授权与收权竞态 |
| B11-03 | AC03 | V1-E2E-12 | 旧治理测试轮换后立即拒旧Key，不能证明重叠窗口 |
| B11-04 | AC04 | V1-E2E-12 | 撤销子集已有；完整过期/跨实例一致性待验 |

## 约束备注

既有Key事务审计复用，缺陷修复不能通过降低断言完成。一次性秘密的幂等重放不重新生成或恢复明文；丢失创建响应需显式重新签发/轮换，不把Secret写入日志或普通结果缓存。轮换窗口长度由受控策略配置并记录到期时间，不无限双有效；无缓存不强制建缓存。新增窗口字段采用expand/backfill/switch，旧已撤销Key不恢复有效。完整资产映射见[AC资产核对](../V1-AC资产核对-2026-10-02.md)。
