---
title: "API Key 生命周期"
version: V1
feature_id: V1-FR-011
domain: 身份与会话
updated: 2026-09-30
delivery_scope: active
planning_only: false
delivery_slice: V1-platform
---
# API Key 生命周期

## 功能卡

| 项目 | 内容 |
| --- | --- |
| 领域 | 身份与会话 |
| 上游依赖 | Admin Identity、Secret、Permission、Audit、Provider Account |
| 版本 | V1 |
| 规格负责人 | 产品负责人/技术负责人 |
| 规格状态 | Ready |
| 规格版本 | 1.0 |
| 更新时间 | 2026-09-30 |

## 来源与追踪

- 需求：`V1-FR-011`
- 关联 E2E：`V1-E2E-12`
- 依赖：`V1-FR-012` Provider 账号与连接、`V1-FR-014` 审计

## 目标

管理 DGOS 管理面或受控集成使用的 API Key 生命周期，并保证密钥最小权限、一次性展示、轮换和撤销可审计。

## 功能边界

管理 DGOS 管理面或受控集成使用的 API Key 生命周期：创建、作用域授权、一次性展示、轮换、撤销、到期和审计。上游 Provider 凭据是 Provider Secret，由 `V1-FR-012` 管理；该 API Key 规格不把上游 API Key 当作 DGOS 调用者身份，也不执行连接测试。

V1 Key 属于明确主体/部署，禁止匿名发行、通配管理权限、凭据导出和恢复已展示明文。

## 需求说明

### 业务规则

1. 创建时由 DGOS 密码学安全随机生成高熵值；明文只在创建/轮换响应中展示一次，之后仅返回前缀、末尾短标识和状态。
2. 持久化仅保存不可逆校验摘要和密钥元数据；Secret service 可使用受控封装实现验证，但任何普通读 API 不返回明文。
3. 每个 Key 必须绑定 owner、用途、明确 scopes、创建者和可选过期时间；scope 按最小权限校验并不能授予創建者本身没有的权限。
4. 轮换采用新旧 Key 有限重叠窗口：先签发新 Key，再允许调用方验证切换，随后撤销旧 Key；窗口到期自动撤销旧 Key。不得原位覆盖导致无法恢复。
5. 撤销立即使缓存、并发请求和后续认证失效；删除元数据不能代替撤销状态和审计记录。
6. 使用 Key 执行写操作仍受主体权限、能力范围和目标资源策略约束；API Key 不是权限绕过机制。
7. 创建/轮换/撤销使用 requestId 幂等；同一 requestId 参数不同返回 `idempotency_conflict`。

### 前置依赖与执行边界

前置：调用者有 `apiKey.manage`，owner 和 scopes 合法，Secret 服务和审计可用。创建 -> 一次性显示 -> 调用方安全保存 -> 轮换时验证新 Key -> 撤销旧 Key；撤销或过期后所有新请求拒绝。

错误：`permission_denied`、`invalid_scope`、`key_not_found`、`key_expired`、`key_revoked`、`idempotency_conflict`、`service_unavailable`。失败不产生部分 Key、不扩展 scope、不撤销错误对象。

### 主流程

创建 -> 一次性显示 -> 调用方保存 -> 轮换时验证新 Key -> 撤销旧 Key；撤销或过期后所有新请求拒绝。

### 异常与边界

错误包括 `permission_denied`、`invalid_scope`、`key_not_found`、`key_expired`、`key_revoked`、`idempotency_conflict`、`service_unavailable`。失败不产生部分 Key、不扩展 scope、不撤销错误对象。

### 页面与交互

列表只显示 keyId、名称、前缀、scope 和状态；创建/轮换成功页提供一次性展示，之后不提供恢复明文或导出。

### 领域数据语义

`ApiKeyRecord`：keyId、owner principal、name、prefix、scopes、createdAt、expiresAt、lastUsedAt、status、rotationGroupId、secretDigest/SecretRef、createdBy、revokedAt。不得存明文。

状态：`active` -> `rotation_pending` -> `active`/`revoked`；终态 `expired`、`revoked`。访问日志只存 keyId 和 scope 命中摘要，不记录 bearer 值。

### 本版本不做

不提供匿名 Key、通配管理员权限、凭据导出、支付密钥或上游 Provider 连接测试。

## 接口契约

### 接口清单

| 能力 | 方向 | 业务约束 |
| --- | --- | --- |
| Key 创建/查询 | 读/写 | 明文只在创建响应出现一次 |
| Key 轮换/撤销 | 写 | 版本化、幂等、撤销立即失效 |

### OpenAPI operation 映射

接口字段以[V1-openapi.yaml](../../../04-技术架构/当前版本/V1-openapi.yaml)为准；完成度只链接[V1实现状态](../../../02-产品与版本/当前版本/V1-实现状态.md)，不由接口登记推断。

| 业务能力 | operationId | 当前状态 |
| --- | --- | --- |
| Key 列表 | `listApiKeys` | V1 OpenAPI 已声明 |
| Key 创建 | `createApiKey` | V1 OpenAPI 已声明 |
| Key 轮换 | `rotateApiKey` | V1 OpenAPI 已声明 |
| Key 撤销 | `revokeApiKey` | V1 OpenAPI 已声明 |
| --- | --- | --- |
### 字段规则

`keyId`、`owner`、`scope`、`rotationGroupId` 和 `requestId` 必填；明文只在创建/轮换成功响应出现一次；持久化只保存 digest/SecretRef，不保存 bearer 值。

### 成功响应

创建/轮换返回一次性 secret、`keyId`、遮蔽前缀、scope、过期时间和 `requestId`；列表/撤销只返回脱敏元数据和状态。

本功能机器映射为`listApiKeys/createApiKey/rotateApiKey/revokeApiKey`；逐项运行证据见实现与验证。

### 逐操作契约约束

| operationId | 前置条件 | 成功终态 | 关键失败与无副作用 | 幂等 | 并发 | 重试/超时 | 观测/恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `createApiKey` | 有 manage 权限、scope 合法 | 返回一次明文和 keyId | Secret 失败不创建记录 | requestId+owner+digest | owner/name 唯一策略 | Secret 写一次，5s | keyId、审计、无明文 |
| `rotateApiKey` | Key active、版本匹配 | 新 Key active，旧 Key 进入窗口 | 失败不撤销旧 Key | requestId+keyId+version | rotation lock | 5s，可查询恢复 | rotationGroup、审计 |
| `revokeApiKey` | Key 存在且有权 | Key revoked | 错误对象不受影响 | requestId+keyId | 状态条件更新 | 2s，可安全重试 | 撤销审计、缓存失效 |

### 错误矩阵

| 场景 | error_key/结果 | 处理要求 |
| --- | --- | --- |
| scope 越权 | `invalid_scope`/`permission_denied` | 不创建或修改 Key |
| Key 过期/撤销 | `key_expired`/`key_revoked` | 拒绝调用，保留审计 |
| 重复参数不同 | `idempotency_conflict` | 保留第一次结果，不执行第二次 |

## 数据与事务

### 涉及数据

`ApiKeyRecord`、`KeyRotation`、`SecretRef`、`AuditEvent`。

### 约束与事务

Secret 写入、Key 元数据和审计必须原子提交或可恢复；轮换不得原位覆盖旧 Key。

### 字段读写矩阵

| 数据 | Secret | 管理应用 | Audit |
| --- | --- | --- | --- |
| 明文/摘要 | 持有 | 创建响应一次性 | 不可读 |
| Key 元数据 | 引用 | 脱敏读写 | 摘要 |

### 状态与生命周期

Key `active -> rotation_pending -> active/revoked`，并可进入 `expired`；轮换组记录旧新关联。

### 物理约束与迁移

keyId、digest 和 rotationGroup 唯一；禁止明文落库；scope 采用版本化schema。实际migration与PG验证见[F报告](../../../05-测试与发布/端到端验收/报告/V1-F-整合联调报告.md)，遵循ADR-0006/0007；有限轮换窗口与生产Secret不能由旧即时轮换证据代替。

### 数据所有权

Secret 服务拥有秘密，Identity/Permission 拥有 owner/scope，Audit 拥有事件。

### 安全与保留

不记录 bearer 值、Authorization、完整请求头或可恢复密钥；撤销/过期记录按安全基线保留。

## 验收标准

#### AC01 一次性创建

Given 有权主体请求最小 scopes 的 Key。

When 创建 Key。

Then 明文仅在成功响应返回一次；列表只显示遮蔽标识和 scope。

#### AC02 作用域校验

Given Key 请求超出其 scopes 或主体权限。

When 使用该 Key 调用公开能力。

Then 失败返回拒绝和 requestId，不触发目标副作用；审计记录不含 Key，目标资源状态不改变且不创建新资源。

#### AC03 轮换

Given 旧 Key 处于 active 状态且调用者请求轮换。

When 创建轮换 Key。

Then 创建新 Key 与 rotationGroup；显式确认或窗口到期后撤销旧 Key，不出现无审计的双有效状态。

#### AC04 撤销/过期

Given Key 已撤销或已到期。

When 再次使用该 Key 调用。

Then 请求被拒绝，缓存授权失效，目标资源不变且撤销可审计。

| AC | Given / When | Then 与无副作用断言 |
| --- | --- | --- |
| AC01 一次性创建 | 有权主体创建最小 scopes 的 Key | 明文仅在成功响应返回一次；列表只显示遮蔽标识和 scope |
| AC02 作用域校验 | Key 请求超出其 scopes 或主体权限 | 返回拒绝和 requestId，不触发目标副作用；审计记录不含 Key |
| AC03 轮换 | 旧 Key active 且调用者请求轮换 | 创建新 Key 与 rotationGroup；显式确认或窗口到期后撤销旧 Key，不出现无审计的双有效状态 |
| AC04 撤销/过期 | Key 被撤销或到期后再次调用 | 请求被拒绝，缓存授权失效，目标资源不变且撤销可审计 |

### 自动化测试映射

| AC 范围 | 自动化重点 | 建议测试文件 | 建议命令 | 当前状态 |
| --- | --- | --- | --- | --- |
| AC01–AC04 | 一次性展示、轮换、撤销、scope 和脱敏 | `scripts/v1-identity-http.mjs`、`tests/security/key-delegation.test.mjs` | node scripts/v1-identity-http.mjs；env -u DGOS_DATABASE_URL node --test tests/security/key-delegation.test.mjs | C r12双实例20/20含有限重叠/过期/撤销；完整UI与当前候选待验 |

### AC 逐项测试设计

| AC | 验收重点 | 测试层级 | 目标资产 | 目标命令 | 初始资产状态 |
| --- | --- | --- | --- | --- | --- |
| AC01 | 一次性创建和展示 | Integration | `tests/integration/identity-api.test.mjs` | node --test tests/integration/identity-api.test.mjs | 已有子集；未作本轮通过声明 |
| AC02 | scope 越权与脱敏 | Security/公开HTTP | `tests/security/key-delegation.test.mjs`、`scripts/v1-identity-http.mjs` | env -u DGOS_DATABASE_URL node --test tests/security/key-delegation.test.mjs；node scripts/v1-identity-http.mjs | C r12受限scope/审计无秘密；完整资源委派按候选复验 |
| AC03–AC04 | 轮换、撤销和过期 | 双API/PG/Redis | `scripts/v1-identity-http.mjs`、`tests/security/v1-governance-e2e.test.mjs` | node scripts/v1-identity-http.mjs | C r12真实有限窗口内双Key有效、窗口后旧Key拒绝、过期/撤销拒绝；不是早期立即401断言 |

## 安全、观测与恢复

API Key 只允许 TLS 传输；UI 不提供复制后再次查看、导出或日志调试。审计记录创建/轮换/撤销主体、时间、scope 摘要、keyId 和结果。Secret 服务故障时创建、轮换和认证均 fail closed；轮换中断可查询 rotationGroup 并安全完成或撤销。

## 实现与验证

2026-10-02 / r7回写：C r12双API/PG/Redis本地公开链20/20，包含跨实例Key认证、有限overlap内新旧Key同时可用、窗口后旧Key拒绝、过期与显式撤销及审计无凭据。基线72ab1cb加报告源码摘要，manifest SHA256为714ba199cb55b5efd9d6088a2542266230a5027cee4c6c1de28b26c18f279286；命令`node scripts/v1-identity-http.mjs`及隔离15121/15122、Redis DB3/随机子库要求见[本轮证据索引](../V1-AC资产核对-2026-10-02.md#r7-证据回写2026-10-02)。旧“立即401不满足窗口”保留在历史盘点，不再代表r12路径。

这不是完整资源级委派、真实UI一次展示或生产Secret证明；D当前页面与最终候选在途。C r13可信transport单元5/5和C r15持久Secret审计fixture12/12分别证明输入判定与测试事务适配，不能互升成生产入口/真实PG可用性。

## 技术设计

见[API Key生命周期技术设计](02-API-Key生命周期-技术设计.md)。
