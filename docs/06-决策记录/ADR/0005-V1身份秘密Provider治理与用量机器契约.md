# ADR-0005 V1 身份、秘密、Provider、治理与用量机器契约

- 状态：Accepted
- 日期：2026-10-01
- 决策人角色：产品负责人、技术负责人、安全负责人
- 关联需求/决策：`V1-FR-010`–`V1-FR-015`、D018、D019、D020、D025、D027、D034、D035

## 背景

V1 新增管理员会话、DGOS API Key、Provider 账号、上游连接测试、审计治理和用量额度六个功能。原有规格已经描述了业务规则和验收方向，但没有统一的机器 operation、错误响应、鉴权传输、Secret 边界、版本并发和终态恢复契约。继续实现会导致前后端、Provider Adapter、Secret 服务和测试夹具对同一字段产生不同解释。

本 ADR 只冻结跨功能的逻辑机器契约和安全边界，不宣称产品代码、数据库 migration、运行环境或测试证据已经存在。

## 备选方案

### 方案 A：各功能自行定义接口和错误

- 优点：初期文档修改量小，功能团队可以独立推进。
- 缺点：鉴权、幂等、错误、脱敏和版本条件会分叉；跨功能 E2E 无法稳定关联 requestId、eventId、taskId 和 reservationId。

### 方案 B：公共规则加领域 operation（采用）

- 优点：保留领域边界，同时统一 requestId、错误响应、Secret 脱敏、版本并发、审计和恢复语义；OpenAPI 可以成为前后端和测试的共同输入。
- 缺点：需要一次性协调六个功能、接口契约、数据模型和 ADR；物理 schema 仍需后续工程决策。

### 方案 C：先冻结物理数据库，再反推 API

- 优点：可以较早确定索引和事务实现。
- 缺点：在数据库选型、migration 和部署拓扑尚未有实现证据时容易把 Draft 物理设计伪装成已验证事实，也会让外部 Provider 和 Secret 边界被数据库结构绑死。

## 决策

采用方案 B。V1 采用以下机器契约边界：

1. `V1-openapi.yaml` 登记六个功能的公共 HTTPS JSON operation；所有 operation 仍标记为 `planned`，实现状态与契约状态分离。
2. 每个 JSON 写请求使用 `requestId`。重复请求必须返回第一次业务结果或稳定 `idempotency_conflict`，不得重复外部副作用。
3. 需要并发保护的资源使用 `baseVersion`、`sessionVersion`、`policyVersion` 或明确的状态条件更新；冲突不部分写入。
4. 错误响应统一包含 `errorKey`、安全 `message` 和 `requestId`，可选 `retryable/details`；错误不得枚举主体、资源、Secret 或 Provider 内部信息。
5. 首次管理员引导和登录是公共认证入口；受保护 operation 使用可撤销 `dgosSession` 或最小权限 `dgosApiKey`。Session 只表示身份上下文，不能绕过领域 capability、scope 和实时授权重算。
6. 管理员凭据、Provider 凭据、代理凭据和 DGOS API Key 进入 Secret 边界。API Key 明文只在创建/轮换成功响应中出现一次；持久化和查询只返回 digest、SecretRef、prefix 或脱敏状态。
7. ProviderAccount 负责凭据归属、作用域、绑定和账号状态；ProviderConfig 继续负责协议参数、Adapter、模型目录和模型策略。连接测试只能调用已发布 Adapter 的受控探测，不刷新模型、不启用模型、不创建 AI Task。
8. 连接测试在外部请求前执行出站策略，阻止任意 URL、私网、link-local、localhost、云元数据地址和越界重定向；错误只返回稳定分类，不保存上游原始 body。
9. AuditEvent 只追加。必须审计的高风险副作用与审计事件同事务提交，或通过 eventId 去重的可恢复 outbox 提交；审计不可用时按功能契约 fail closed 或进入受控 outbox。
10. QuotaReservation 在 Provider 调用前建立硬额度边界；`taskId+attemptId` 是 UsageEvent 的去重键。任务失败、取消、超时和 usage 缺失都必须形成可查询终态，不得猜测 token/费用或重发 Provider 请求。
11. 审计、连接测试和用量查询只返回授权范围内的脱敏数据；不得保存完整 Prompt、Cookie、Token、Authorization、完整代理凭据、绝对路径或上游原始响应。

## operation 范围

| 功能 | OpenAPI operation |
| --- | --- |
| `V1-FR-010` | `bootstrapAdmin`、`adminLogin`、`getAdminSession`、`renewAdminSession`、`revokeAdminSession` |
| `V1-FR-011` | `listApiKeys`、`createApiKey`、`rotateApiKey`、`revokeApiKey` |
| `V1-FR-012` | `listProviderAccounts`、`createProviderAccount`、`bindProviderAccount`、`setProviderAccountState`、`deleteProviderAccount` |
| `V1-FR-013` | `startProviderConnectionTest`、`getProviderConnectionTest`、`cancelProviderConnectionTest` |
| `V1-FR-014` | `queryAuditEvents`、`getGovernancePolicy`、`updateGovernancePolicy`、`executeRetentionSweep`、`getRetentionSweep` |
| `V1-FR-015` | `preflightQuota`、`reserveQuota`、`settleUsage`、`queryUsage`、`listQuotaPolicies`、`updateQuotaPolicy` |

## 后果

- 前端、SDK、Provider Adapter 和测试可以共享稳定的 operation、错误和脱敏规则。
- 领域服务仍然拥有自己的状态和副作用；公共契约不会把 Provider、Secret、Audit 或 Quota 合并成一个万能管理服务。
- 认证传输、密钥封装、Secret backend、数据库唯一约束、事务隔离、outbox 实现和出站网络组件仍需实现阶段冻结。
- 既有文档中“V1 没有身份 operation”或“正式登录统一归 V2”的表述必须区分为：V1 提供 DGOS 部署管理员控制面会话；V2 才提供正式终端用户账号中心、跨设备身份和个人账号生命周期。
- 所有新增 operation 仍然不能被标记为已实现，直到有真实代码、测试、构建和 commit binding 证据。

## 验证

实现阶段至少需要：

- OpenAPI lint 和 `$ref` 解析检查。
- Contract test：成功响应、稳定 errorKey、requestId、版本冲突和幂等重放。
- Security test：Secret/Key/Token/Prompt/路径脱敏、API Key 一次性展示、Session 撤销传播、Provider 出站 SSRF 防护。
- Concurrency test：管理员会话续期/撤销、Provider 默认账号、治理策略、Quota reservation 和 `taskId+attemptId` 结算。
- E2E：`V1-E2E-11`–`V1-E2E-15`，并将 eventId、testId、reservationId、usageEventId 与报告关联。
- Migration/recovery test：outbox、RetentionJob checkpoint、reservation reconciliation 和服务重启后的终态恢复。

当前仓库没有产品源码、migration、运行环境或上述测试证据；本 ADR 只证明文档决策已登记。
