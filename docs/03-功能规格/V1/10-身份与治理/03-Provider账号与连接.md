---
title: "Provider 账号与连接"
version: V1
feature_id: V1-FR-012
domain: Provider 与凭据
updated: 2026-09-30
delivery_scope: active
planning_only: false
delivery_slice: V1-ai-task
---
# Provider 账号与连接

## 功能卡

| 项目 | 内容 |
| --- | --- |
| 领域 | Provider 与凭据 |
| 上游依赖 | `V1-FR-007` Provider/Model 配置、Secret、Permission、Audit |
| 版本 | V1 |
| 规格负责人 | 产品负责人/技术负责人 |
| 规格状态 | Ready |
| 规格版本 | 1.0 |
| 更新时间 | 2026-09-30 |

## 来源与追踪

- 需求：`V1-FR-012`
- 关联 E2E：`V1-E2E-13`
- 依赖：`V1-FR-007` 模型平台与工作流配置、`V1-FR-013` 上游账号连接测试

## 目标

为 DGOS 中的服务商凭据和账号连接建立稳定账号实体、主体归属、使用范围和生命周期，并将其绑定到 `V1-FR-007` 的 ProviderConfig。

## 功能边界

为 DGOS 中的服务商凭据和账号连接建立稳定账号实体、主体归属、使用范围和生命周期，并将其绑定到 `V1-FR-007` 的 ProviderConfig。`FR-007` 继续拥有协议适配、配置参数、模型目录和模型策略；本功能拥有账号级别的凭据归属、作用域、连接状态和使用授权。

Provider account 表示用户/管理员配置的上游服务账号，不表示 DGOS 登录账号、Provider 企业后台账号实体同步或供应商 OAuth 目录同步。V1 不提供配置凭据跨部署导出。

## 需求说明

### 业务规则

1. `providerAccountId` 稳定且与展示名分离；账号绑定 owner、providerProtocol、SecretRef、allowedConfigIds 和作用域。
2. 多个 ProviderConfig 可以按明确策略引用同一 ProviderAccount；默认禁止跨主体共享，管理员共享必须显式授予并审计。
3. 同一主体/协议/账号指纹可防止无意重复，但指纹不可逆且不用于跨部署识别。
4. 凭据写入只进入 Secret service；读取只返回 `credentialState`、脱敏提示和 SecretRef 状态，不返回明文。
5. 启停账号会立即影响绑定配置的新任务资格；已运行任务按 `V1-FR-005` 的 taskId 语义收敛，不伪造成功或删除历史。
6. 删除前检查 ProviderConfig、任务和测试运行引用；有活动引用时要求先解绑/停用，保留审计摘要。
7. 默认账号按主体与协议唯一；切换默认值为原子版本化操作，不自动改写既有任务或模型策略。

### 前置依赖与执行边界

前置：主体具有 Provider account 权限，protocol 已发布，Secret service 可用。创建账号并写入凭据 -> 绑定/新建 ProviderConfig -> 由 `FR-013` 执行连接测试 -> 将测试通过的账号配置交给 `FR-007` 验证与显式模型刷新。

账号连接测试通过不等于模型目录已刷新或 ProviderConfig 已 active；FR-007 的 validate 与 models/refresh 流程仍是权威。

### 主流程

创建账号并写入凭据 -> 绑定/新建 ProviderConfig -> 由 FR-013 执行连接测试 -> 由 FR-007 验证并显式刷新模型目录。

### 异常与边界

账号或 Secret 服务不可用时不得创建可用状态；删除仍被引用账号返回 `account_in_use`，不删除历史。

### 页面与交互

账号页显示账号归属、协议、脱敏凭据状态、绑定配置、启停和默认账号状态；不显示明文凭据。

### 领域数据语义

`ProviderAccount`：id、owner、protocolType、displayName、credentialRef、scope、status、defaultForProtocol、version、createdBy、auditRef。`ProviderBinding`：accountId、providerConfigId、policyVersion。`credentialRef` 不可直接序列化给普通 APP。

状态：`draft` -> `credential_pending` -> `ready`/`error` -> `disabled` -> `revoked`。错误含 `permission_denied`、`credential_unavailable`、`account_in_use`、`version_conflict`、`service_unavailable`。

### 本版本不做

不实现供应商企业账号注册、跨部署凭据导出、Provider 账单和自动账号发现。

## 接口契约

### 接口清单

| 能力 | 方向 | 业务约束 |
| --- | --- | --- |
| 账号与绑定 | 读/写 | owner、protocol 和作用域必须明确 |
| 启停/默认/删除 | 写 | 版本化、引用保护、审计 |

### OpenAPI operation 映射

以下接口已登记于 [V1-openapi.yaml](../../../04-技术架构/当前版本/V1-openapi.yaml)，实现状态仍为规划中，不代表已有实现。

| 业务能力 | operationId | 当前状态 |
| --- | --- | --- |
| 账号列表/创建 | `listProviderAccounts` / `createProviderAccount` | V1 OpenAPI 已声明 |
| 配置绑定 | `bindProviderAccount` | V1 OpenAPI 已声明 |
| 账号启停 | `setProviderAccountState` | V1 OpenAPI 已声明 |
| 账号删除 | `deleteProviderAccount` | V1 OpenAPI 已声明 |
| --- | --- | --- |
### 字段规则

`providerAccountId`、owner、protocolType、scope、credentialRef、version 和 `requestId` 必填；credentialRef 只能是 Secret 引用；绑定必须引用已存在的 ProviderConfig。

### 成功响应

成功创建/绑定返回 accountId、bindingId（如适用）、protocolType、脱敏 credentialState、version 和 requestId；不返回凭据明文或上游响应。

| 本功能机器映射 | `listProviderAccounts`、`createProviderAccount`、`bindProviderAccount`、`setProviderAccountState`、`deleteProviderAccount` | 已登记；实现状态仍为规划中 |

### 逐操作契约约束

| operationId | 前置条件 | 成功终态 | 关键失败与无副作用 | 幂等 | 并发 | 重试/超时 | 观测/恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `createProviderAccount` | protocol 已发布、SecretRef 合法 | 返回 accountId 和脱敏状态 | 失败不保存明文、不创建 ready | requestId+owner+digest | owner/protocol 指纹唯一策略 | Secret 写一次，5s | account 审计、credentialState |
| `bindProviderAccount` | 账号与 config 属于授权范围 | 返回 bindingVersion | 协议不兼容不建立绑定 | requestId+account+config+version | bindingVersion 乐观锁 | 3s，可安全重试 | 绑定审计、当前引用 |
| `setProviderAccountState` | 账号存在且有权 | 返回新 state/version | 冲突不改变旧状态 | requestId+account+version | 状态版本条件更新 | 3s | 状态传播指标和审计 |
| `deleteProviderAccount` | 无活动引用或已完成解绑 | account=`deleted` | 引用存在不删除 Secret/历史 | requestId+account+version | 删除锁/引用检查 | 10s，可查询恢复 | 引用检查审计 |

### 错误矩阵

| 场景 | error_key/结果 | 处理要求 |
| --- | --- | --- |
| 凭据不可用 | `credential_unavailable` | 不创建 ready，不发起任务 |
| 仍有引用 | `account_in_use` | 保留账号和历史，返回引用摘要 |
| 版本冲突 | `version_conflict` | 返回当前版本，不部分覆盖 |

## 数据与事务

### 涉及数据

`ProviderAccount`、`ProviderBinding`、`CredentialRef`、`AuditEvent`。

### 约束与事务

账号、绑定和状态变更使用版本条件；Secret 只保存引用；停用传播不得删除任务和模型历史。

### 字段读写矩阵

| 数据 | Provider Account | Config/Model | 应用 |
| --- | --- | --- | --- |
| 账号元数据 | 读写 | 读取绑定 | 脱敏读写 |
| SecretRef | 引用 | 短时句柄 | 不可读 |
| 绑定状态 | 权威写入 | 消费 | 展示 |

### 状态与生命周期

账号 `draft -> credential_pending -> ready/error -> disabled -> revoked/deleted`；绑定 `active/unbound`。

### 物理约束与迁移

accountId、bindingId 和作用域唯一；credentialRef 不得展开为明文；物理唯一约束和 migration 遵循 ADR-0006，Secret 访问遵循 ADR-0007；当前仍无 migration 证据。

### 数据所有权

Provider Account 服务拥有账号/绑定，Secret 服务拥有凭据，FR-007 拥有 ProviderConfig 和模型策略。

### 安全与保留

审计只保留 accountId、主体、协议、结果和 requestId；Secret 句柄最小权限、短时有效。

## 验收标准

#### AC01–AC04 Provider 账号与连接

Given 主体拥有 Provider account 管理权限且协议已发布。

When 创建账号、绑定配置、停用或删除账号。

Then 返回脱敏账号状态和版本；引用冲突、权限失败或 Secret 不可用时不建立部分绑定、不删除历史。

| AC | Given / When | Then 与无副作用断言 |
| --- | --- | --- |
| AC01 账号与凭据创建 | 主体创建账号并提交凭据 | 返回 accountId 和脱敏 credentialState；响应/日志不含凭据明文 |
| AC02 明确绑定 | 账号绑定到一个授权 ProviderConfig | 绑定和版本可查询；无权或协议不兼容时不建立部分绑定 |
| AC03 禁用传播 | 被绑定账号停用 | 绑定配置的新任务资格被移除，运行任务仍按原 taskId 可查，模型/历史记录不删除 |
| AC04 引用保护 | 删除仍被配置或任务引用的账号 | 返回 `account_in_use` 和引用摘要，不删除账号、SecretRef 或历史 |

### 自动化测试映射

| AC 范围 | 自动化重点 | 建议测试文件 | 建议命令 | 当前状态 |
| --- | --- | --- | --- | --- |
| AC01–AC04 | 账号创建、绑定、停用传播和引用保护 | `tests/integration/provider-account-binding.spec.ts`、`tests/security/provider-account-isolation.spec.ts` | `npm test -- provider-account-binding` | 规划中 |

### AC 逐项测试设计

| AC | 验收重点 | 测试层级 | 目标资产 | 目标命令 | 初始资产状态 |
| --- | --- | --- | --- | --- | --- |
| AC01 | 账号和 Secret 引用创建 | Integration | `tests/integration/provider-account-binding.spec.ts` | `npm test -- provider-account-binding` | 未创建 |
| AC02 | 配置绑定隔离 | Security/Integration | `tests/security/provider-account-isolation.spec.ts` | `npm test -- provider-account-isolation` | 未创建 |
| AC03–AC04 | 停用传播和引用保护 | Integration | `tests/integration/provider-account-binding.spec.ts` | `npm test -- provider-account-binding` | 未创建 |

## 安全、观测与恢复

审计账号创建、凭据更新、绑定、默认切换、启停和删除；审计仅含主体、accountId、protocol、结果与 requestId。Secret 解析只在 Adapter 执行期按最小权限提供短时句柄。Secret 或 Provider 服务不可用时不得创建可用账号状态；恢复后由显式连接测试和 FR-007 验证重新启用。

## 实现与验证

当前无 Provider Account 实现、测试资产或运行证据；FR-007 的物理外键、共享策略和 migration 遵循 ADR-0006/0007，仍待工程验证。
