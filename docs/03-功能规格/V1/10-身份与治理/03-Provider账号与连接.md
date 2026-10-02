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

2026-10-02工程前置：凭据创建后credential_pending；受控ConnectionTest成功后，调用者显式setProviderAccountState请求ready并提交connectionTestId/baseVersion。服务端核对测试succeeded、同accountVersion与协议/配置快照和所属权限；版本或凭据变化后旧测试不可复用。成功诊断不自动ready，更不自动ProviderConfig validate或模型refresh。

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

接口字段以[V1-openapi.yaml](../../../04-技术架构/当前版本/V1-openapi.yaml)为准，完成度只链接[V1实现状态](../../../02-产品与版本/当前版本/V1-实现状态.md)。

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

本功能机器映射为`listProviderAccounts/createProviderAccount/bindProviderAccount/setProviderAccountState/deleteProviderAccount`；登记不代表完整验收。

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

accountId、bindingId和作用域唯一；credentialRef不展开为明文。物理事实以migrations为准，遵循ADR-0006/0007；ProviderAccount与ProviderConfig已有PG资产，归属/协议和引用完整约束需专项验证。

### 数据所有权

Provider Account 服务拥有账号/绑定，Secret 服务拥有凭据，FR-007 拥有 ProviderConfig 和模型策略。

### 安全与保留

审计只保留 accountId、主体、协议、结果和 requestId；Secret 句柄最小权限、短时有效。

## 验收标准

#### AC01 账号与凭据创建

Given 主体拥有 Provider account 管理权限且协议已发布。

When 创建账号并提交凭据。

Then 返回可查询的 accountId、credentialState 和 accountVersion；响应和日志不含凭据明文。Secret 不可用时失败，不改变账号状态、不创建绑定、不产生外部调用。

#### AC02 明确绑定

Given 账号和授权 ProviderConfig 均存在。

When 将账号绑定到 ProviderConfig。

Then 返回可查询的 bindingId 和 bindingVersion；无权或协议不兼容时失败，返回 errorCode、requestId 和当前配置版本，查询确认原配置版本未变且无新 binding 记录；失败不建立部分绑定、不改变原配置。

#### AC03 禁用传播

Given 账号已绑定到配置。

When 停用该账号。

Then 绑定配置的新任务资格被移除，运行任务仍按原 taskId 可查，模型和历史记录不删除。

#### AC04 引用保护

Given 账号仍被配置或任务引用。

When 请求删除账号。

Then 返回 `account_in_use` 和引用摘要，不删除账号、SecretRef 或历史。

| AC | Given / When | Then 与无副作用断言 |
| --- | --- | --- |
| AC01 账号与凭据创建 | 主体创建账号并提交凭据 | 返回 accountId 和脱敏 credentialState；响应/日志不含凭据明文 |
| AC02 明确绑定 | 账号绑定到一个授权 ProviderConfig | 绑定和版本可查询；无权或协议不兼容时不建立部分绑定 |
| AC03 禁用传播 | 被绑定账号停用 | 绑定配置的新任务资格被移除，运行任务仍按原 taskId 可查，模型/历史记录不删除 |
| AC04 引用保护 | 删除仍被配置或任务引用的账号 | 返回 `account_in_use` 和引用摘要，不删除账号、SecretRef 或历史 |

### 自动化测试映射

| AC 范围 | 自动化重点 | 建议测试文件 | 建议命令 | 当前状态 |
| --- | --- | --- | --- | --- |
| AC01–AC04 | 账号创建、绑定、停用传播和引用保护 | `tests/integration/provider-api.test.mjs`、`tests/integration/postgres-provider.test.mjs` | node --test tests/integration/provider-api.test.mjs tests/integration/postgres-provider.test.mjs | 已有创建/持久化子集；完整传播/引用保护待验 |

### AC 逐项测试设计

| AC | 验收重点 | 测试层级 | 目标资产 | 目标命令 | 初始资产状态 |
| --- | --- | --- | --- | --- | --- |
| AC01 | 账号和Secret引用创建 | HTTP/PG/TLS fixture | `tests/integration/provider-api.test.mjs`、`scripts/v1-provider-http.mjs` | env -u DGOS_DATABASE_URL node --test tests/integration/provider-api.test.mjs；node scripts/v1-provider-http.mjs | H r6真实账号/连接/配置创建属于9/9链路子集；生产Secret待验 |
| AC02 | 配置绑定隔离 | Security/Integration | `tests/provider/provider-admission-profile.test.mjs`、`tests/integration/provider-admission-wiring.test.mjs` | env -u DGOS_DATABASE_URL node --test tests/provider/provider-admission-profile.test.mjs tests/integration/provider-admission-wiring.test.mjs | 已有owner/协议/准入资产；完整跨主体公开管理仍待候选 |
| AC03–AC04 | 停用传播和引用保护 | Integration/独立worker | `tests/provider/provider-config-disabled.test.mjs`、`tests/integration/provider-api.test.mjs`、`scripts/v1-provider-http.mjs` | env -u DGOS_DATABASE_URL node --test tests/provider/provider-config-disabled.test.mjs tests/integration/provider-api.test.mjs；node scripts/v1-provider-http.mjs | H r6版本/策略停用拒dispatch及预留释放已证；账号删除全部活动引用/历史保护另验 |

## 安全、观测与恢复

审计账号创建、凭据更新、绑定、默认切换、启停和删除；审计仅含主体、accountId、protocol、结果与 requestId。Secret 解析只在 Adapter 执行期按最小权限提供短时句柄。Secret 或 Provider 服务不可用时不得创建可用账号状态；恢复后由显式连接测试和 FR-007 验证重新启用。

## 实现与验证

2026-10-02 / r7回写：H r5共享准入与持久快照已交；H r6 `node scripts/v1-provider-http.mjs`在本地PG、Redis DB5、公开HTTP、独立worker和TLS fixture下9/9，含账号创建、连接验证后显式ready、配置绑定/validate/refresh/policy，以及提交后版本变化或策略停用使dispatch无外发且释放预留。脚本当时SHA256为61ef41b0de8ecac7ad7f0a9d1773e915215940dbe4559814e60e5e5336eb3109，配对源码前后相同；见[本轮证据索引](../V1-AC资产核对-2026-10-02.md#r7-证据回写2026-10-02)。

这些场景修正早期“传播尚无证据”的泛化描述，但不等于FR012全部AC：账号删除的所有活动引用/历史保护、真实跨主体管理与D界面、生产Secret/Provider仍需候选核验。后改47项迁移脚本仅静态通过，不复用历史45项迁移的9/9为当前构建证明。

## 技术设计

见[Provider账号与连接技术设计](03-Provider账号与连接-技术设计.md)。
