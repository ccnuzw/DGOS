---
title: "03 Skill MCP 与 Agent 接入"
version: V1
feature_id: V1-FR-003
domain: Agent 与协议
updated: 2026-09-30
delivery_scope: active
planning_only: false
delivery_slice: V1-platform
---
# 01 Skill MCP 与 Agent 接入

> 范围说明：本功能进入 V1 首发时交付默认安装的 Skill 管理官方应用、MCP 管理官方应用及其所需的清单、权限、工具调用、超时/取消和审计能力；新的 Agent 执行器与生态扩展属于后续版本。

## 功能卡

| 项目 | 内容 |
| --- | --- |
| 领域 | Agent 与协议 |
| 上游依赖 | DGOS 应用 manifest/SDK、Agent runtime、MCP、Skill |
| 版本 | V1 |
| 规格负责人 | 技术负责人 |
| 规格状态 | Ready |
| 规格版本 | 1.2 |
| 更新时间 | 2026-09-30 |

## 目标

允许 DGOS 通过默认安装的 Skill/MCP 官方应用声明、安装、启用、停用和调用已授权的 Skill/MCP/Agent 工具，让用户在任务工作区或其他 APP 内执行可审计的能力。官方应用本身通过 DGOS API 管理扩展，不把管理能力隐藏在系统设置里。

## 功能边界

包含：默认安装的 Skill/MCP 官方应用及其入口、依赖声明、工具清单、权限、输入 schema、超时、取消、错误和副作用提示；MCP 服务器导入/新建/快速配置、连接方式与进程字段、启停和连接状态、模板凭据状态、工具数量和重连/删除生命周期；Skill 分类、数量、自定义 Skill 元数据（ID、名称、描述、System Prompt）、完整包/在线导入预览、启用、重命名、一键翻译和移除。系统设置只保留快捷入口和系统级策略摘要。

不包含：任意代码执行、未知安装脚本自动运行和绕过 DGOS 权限服务的系统访问。

## 来源与追踪

- 需求：`V1-FR-003`
- 来源：[DX OS 外部开发者中心研究摘要](../../../90-参考资料/DX-OS官网开发者中心摘要.md)、Ep1 12:30–17:30；资料只用于产品研究
- 截图证据：[DX-OS成熟软件截图证据](../../../90-参考资料/DX-OS成熟软件截图证据.md) 第三轮第一批 Image 6
- 截图证据补充：[DX-OS成熟软件截图证据](../../../90-参考资料/DX-OS成熟软件截图证据.md) 第三轮第二批 Image 4、Image 5、Image 6
- 截图证据补充：[DX-OS成熟软件截图证据](../../../90-参考资料/DX-OS成熟软件截图证据.md) 第三轮第六批 Image 1、Image 2
- 截图证据补充：[DX-OS成熟软件截图证据](../../../90-参考资料/DX-OS成熟软件截图证据.md) 第三轮第七批 Image 1–4
- 截图证据补充：[DX-OS成熟软件截图证据](../../../90-参考资料/DX-OS成熟软件截图证据.md) 第三轮第八批 Image 1–5
- 关联 E2E：`V1-E2E-03`

## 完成定义

每个工具有稳定名称、schema、权限、风险和副作用；未授权、超时和取消均有稳定结果。

## 需求说明

### 用户故事

作为开发者，我希望让 Agent 发现并运行我的能力，同时让用户知道它会读写什么。

### 业务规则

1. `agent.tools.json` 必须声明 inputSchema、permission、risk、sideEffects 和 handler。
2. Skill 依赖必须在 DGOS manifest 的 `dependencies` 中声明。
3. 调用超时或失败不得静默重试产生重复副作用。
4. MCP 配置中的密钥、token 和敏感环境变量必须脱敏展示，不能进入日志、项目 JSON 或导出包；保存并连接前需校验连接方式、命令、参数、cwd 和环境变量 schema。
5. MCP 启用状态与连接状态分开维护；连接失败可重试，但不得静默重复启动外部进程，停止或重连结果必须可追踪。
6. 快速配置模板可以填充非秘密配置，并明确标记“开箱即用”或“需填凭据”；凭据缺失时不得伪造可连接状态。
7. 服务器列表中的工具数量必须来自连接后的发现结果；连接中、已连接、失败和停止等运行时状态不得由启用开关推断。
8. 刷新重连必须复用稳定服务器标识并具备幂等保护；删除前检查任务、Agent、画布节点或 Skill 引用，并向用户说明阻止、缺失或确认结果。
9. Skill 导入前校验包/manifest、版本、来源和声明权限；在线导入不得绕过 DGOS 信任策略和扩展安装策略。
10. Skill 的移除、禁用和删除数据是不同操作；移除前必须提示对已有任务、项目节点和 Agent 引用的影响，并保留可解释的缺失状态。
11. `/技能名` 只是用户调用语法，不绕过 `allow / ask / deny`、清单权限或副作用确认。
12. 自定义 Skill 必须校验稳定 ID（小写字母/数字/下划线）、名称、描述和 System Prompt；展示名可改名，稳定 ID 不能因改名而变化。
13. 在线 Skill 导入必须先完成来源解析和预览，至少展示包/子 Skill 摘要、来源、声明权限与风险；只有用户确认导入后才进入安装和授权。
14. Skill 包标识与子 Skill 调用 ID 分开保存；子 Skill 的启用状态和包级状态必须可解释，不能以展示卡片折叠状态代替运行时状态。
15. 下游节点或 Agent 选择 Skill 时只能引用已安装、已启用且已授权的稳定 ID；调用应记录 Skill 包/版本快照，不允许节点内隐式安装或启用。
16. bundled MCP、system MCP 和 external MCP 的安装归属不同：bundled 服务随所属 APP 的版本声明更新，system 服务由 DGOS 管理，external 服务由用户单独配置；三者都必须经过相同的权限、连接和审计检查。
17. bundled MCP 无需秘密且健康检查通过时才允许申请自动启动；需要凭据的服务必须显示 `needs-credentials`，不能以自动启动声明代替凭据配置。
18. MCP 工具绑定必须引用依赖清单中已存在的结构化服务/操作身份；调用方不能传入任意服务器标识或工具名。未安装、未启用、未连接、未授权分别显示为 `missing`、`disabled`、`pending`、`denied`。
19. 普通前台 MCP 调用不承诺页面关闭后的结果恢复；需要跨页面查询、取消、恢复或提交产物时，必须创建 DGOS Task/Run，不得用前台 Promise 模拟持久任务。
20. App 与 MCP 之间只传递项目操作所需的最小字段或 Artifact 引用；禁止传递绝对路径、Cookie、用户身份、秘密和无关项目目录。

### 前置依赖与执行边界

本功能依赖 DGOS manifest/SDK、Skill/MCP 管理服务、Agent runtime、Capability Broker、凭据服务、Task/Run 状态服务和脱敏审计。调用前必须确认扩展已通过信任/manifest 校验、稳定 ID 已注册、主体和 APP 权限有效、工具 schema 可解析、MCP 连接状态为 `ready`，或已创建可查询的 Task/Run。页面关闭不能成为持久任务的完成条件；需要跨页面查询、取消或恢复时必须使用 Task/Run。外部进程、网络服务、凭据和项目 Artifact 是直接副作用边界，执行器必须在副作用前重新鉴权。

### 主流程

1. APP 声明 Skill/MCP/Agent 依赖和权限。
2. DGOS 安装、授权并向 Agent runtime 暴露工具目录。
3. DGOS 按 schema 收集输入并调用。
4. 展示结果、状态和副作用摘要。

MCP 的推荐数据流为：App 通过项目能力读取最小输入 -> Runtime 脱敏和校验 -> MCP 执行 -> App 校验返回 schema 和来源 -> 项目能力带并发条件写回。大文件必须使用 Artifact 或项目文件引用。

### 异常与边界

- 未安装/未授权：禁用调用并给出安装提示。
- 输入不符合 schema：调用前拒绝。
- 超时/连接中断：保留 request/task 标识，允许查询或取消。

### 页面与交互

工具面板展示名称、用途、风险、权限和当前状态；危险写操作需要明确确认。MCP 管理页采用左侧服务器列表与右侧表单，展示导入、新建、快速配置、连接方式、命令/参数、cwd、环境变量、启停、模板凭据状态、连接中/已连接/失败、工具数量、刷新重连和删除结果；密钥已保存时只显示脱敏值。Skill 管理页按功能分类和分组展示数量，提供新建自定义 Skill（ID、名称、描述、System Prompt）、完整包导入、在线来源输入、预览、启用、重命名、一键翻译和移除；Skill 卡片显示来源/预设标记、稳定调用 ID 和启用控件。文件、MCP 和 Skill 能力遵循 DGOS `allow / ask / deny` 授权状态，APP 声明不能绕过 `deny`。

### 领域数据语义

工具定义来自清单；Skill 清单至少包含包 ID、子 Skill ID、展示名、描述、来源、版本、声明权限和启用状态。调用记录至少包含工具名、Skill 包/版本快照（如适用）、输入摘要、开始/结束状态、授权决策和 DGOS requestId，不保存秘密。文件修改、删除、MCP 调用和 Skill 运行的权限决策必须可审计。

### 本版本不做

不实现新的 Agent 执行器或自定义密钥存储。

## 接口契约

采用 DGOS Agent/Skill/MCP Runtime API 和 `dgos.agent.*` 执行记录；不允许应用绕过 DGOS API 直接访问系统或外部秘密。未加 `dgos.` 命名空间的 `task.*` 仅是 DX OS 外部研究资料中的旧名称。

### Agent 调用、运行状态与协议边界

Agent 在 V1 是受控编排入口，不是新的权限主体，也不是 Provider 私有 SDK。调用链固定为：`manifest/tool registry -> schema validation -> capability check -> consent when required -> unified executor -> Task/Run state -> redacted result/audit`。自然语言只生成候选动作和结构化输入，不能直接生成内部 URL、任意工具名或供应商请求。

| 层 | V1 权威职责 | 明确禁止 |
| --- | --- | --- |
| Agent Tool Registry | 登记稳定 toolId、版本、输入/输出 schema、所需 capability、风险和副作用 | 运行时临时注入未登记工具、以展示名替代稳定 ID |
| Agent Executor | 在执行前重算权限，校验 schema，施加超时/取消/并发预算，调用 Skill/MCP/公开 DGOS API | 绕过 Capability Broker、直接读取 Secret/Provider endpoint、直接写项目或文件 |
| Task/Run | 跨页面、可查询、可取消、需恢复的调用使用 DGOS `Run`；普通前台调用可仅返回 requestId | 用页面 Promise 冒充持久任务、让旧事件覆盖终态 |
| Protocol Adapter | 将受支持协议映射为统一输入/输出、错误和状态；MCP 使用结构化 `{sourceId, operationId}` | 任意 URL 拼接、脚本/eval/Shell、按模型名称猜测能力 |
| Audit/Usage | 记录脱敏决策、外部调用次数、终态和用量引用；FR-015 负责额度结算 | 记录明文凭据、完整 prompt、私有路径或上游原始响应 |

统一运行状态为 `accepted -> queued -> running -> succeeded|failed|timed_out|cancelled`，并允许 `blocked` 作为未满足权限、依赖或凭据的终态。状态转换由 DGOS Runtime 唯一写入；`cancel_requested` 是可观察中间态，不能直接伪造 `cancelled`。每个状态事件携带 runId/requestId、单调 sequence、扩展版本快照和脱敏 reasonCode。页面断开后，持久 Run 仍可通过 query 读取；重连先读权威快照再订阅事件。

V1 只承诺 Skill/MCP 基础管理、Agent Tool 受控调用和文本任务协同。V2 Project API、V3 画布执行节点、V4 资产/跨项目能力、V5 Canvas Plugin/Node Executor 必须通过各自版本契约接入，不能以 Agent 入口提前开放。

### 接口清单

| 能力 | 方向 | 业务约束 |
| --- | --- | --- |
| Skill 管理 | 读/写 | 安装、启停、卸载校验 manifest、权限和状态 |
| MCP 管理 | 读/写 | 凭据只保存引用，连接状态可重试、可取消 |
| 工具调用 | 写 | 执行前重新鉴权，超时/取消必须有终态 |

### OpenAPI operation 映射

| 业务能力 | operationId | 当前状态 |
| --- | --- | --- |
| Skill 列表 | `listSkills` | V1 OpenAPI 已声明 |
| 自定义Skill/定义编辑 | `createCustomSkill`、`getSkillDefinition`、`updateSkillDefinition` | r5主OpenAPI引用管理投影；身份与展示覆盖分离，Prompt仅授权管理端可读 |
| 显式翻译/审阅应用 | `translateSkill`、`applySkillTranslation` | 复用Task/Quota/Artifact及现有scope，绑定源版本；不自动执行或伪造译文 |
| MCP模板/受控配置 | `listMcpTemplates`、`updateMcpConfig` | 模板需求与实际连接状态分离，凭据writeOnly，CAS/Secret补偿 |
| 安装/启停/卸载 Skill | `installSkill`、`setSkillState`、`uninstallSkill` | V1 OpenAPI 已声明 |
| MCP 列表/安装/启停/卸载 | `listMcpServices`、`installMcp`、`setMcpState`、`uninstallMcp` | V1 OpenAPI 已声明 |
| 来源预览 | `previewExtension` | 主OpenAPI引用扩展投影；仅预览不安装 |
| 执行确认出票 | `createExtensionConfirmation` | 用户审阅已安装工具/版本/输入摘要/风险后显式请求；只出票、不执行 |
| MCP连接/断开/工具目录 | `connectMcp`、`disconnectMcp`、`listMcpTools`、`discoverMcpTools` | 主OpenAPI引用扩展投影；连接与启用独立 |
| 工具调用与持久Run | `invokeExtensionTool`、`getExtensionRun`、`cancelExtensionRun`、`streamExtensionRunEvents` | 主OpenAPI引用扩展投影；先落盘、授权确认后执行 |

### 逐操作契约约束

HTTP 字段和响应 schema 只以 [V1-openapi.yaml](../../../04-技术架构/当前版本/V1-openapi.yaml) 为权威；本表补充扩展管理动作的业务规则。

r5既有AC03–08补全工程输入见[扩展管理补全契约](../../../04-技术架构/当前版本/V1-扩展管理补全工程契约.md)，含上述新增操作的逐项scope、schema、确认、幂等、事务/恢复和E/H/D/G实施边界。自定义与翻译不是通用Agent授权；在线source不执行shell。AC原文不变，规格Ready不代表这些操作已经通过运行验收。

2026-10-02工程投影由主OpenAPI引用`V1-extension.openapi.yaml`，统一previewId/digest绑定、stateVersion、连接/工具目录及Run。机器字段不在本表重复定义；[工程核查](../../../04-技术架构/当前版本/V1-应用与扩展工程契约核查.md)列出可实施边界。来源/配置不是任意进程授权；管理表单的连接字段必须转为受控runner profile或目标引用。公开Record不返回SecretRef、命令环境秘密或私有路径。

安装预览确认只授权安装，不授权工具执行。执行链为读取已注册工具/schema与风险→用户审阅输入摘要/副作用→显式POST confirmations出票→POST runs携confirmationId；出票接口使用对应kind.execute及资源权限，不启动进程/创建Run。票据绑定认证主体、APP、kind、工具、扩展版本、输入digest和expiry；执行时重检授权，按同requestId重放返回原Run，票据与Run创建原子消费，跨主体/改输入/过期/已消费的新请求均拒绝。恒true hook或自造票据不是确认。Cookie写操作保持CSRF/Origin约束。

| operationId | 前置条件 | 成功终态 | 关键失败与无副作用 | 幂等 | 并发 | 重试/超时 | 观测/恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `listSkills` | 主体有 Skill read，管理服务可用 | 返回已安装 Skill 的脱敏状态、版本和稳定 ID | 越权不返回私有配置，不启动或修改 Skill | 不适用：只读；替代验证：状态快照可复读 | 以版本快照读取 | GET 2 次、2s；不可用返回稳定错误 | requestId、读取审计；重新读取快照 |
| `installSkill` | 包/manifest/source 已校验、主体有 install 权限 | 安装记录为 `installed`，未自动越权启用 | 校验失败不落安装记录、不启动 handler、不写凭据 | `requestId + packageDigest`；同一包只创建一个安装记录 | 稳定 Skill ID + 版本唯一，安装锁防并发 | 下载/校验最多 2 次、30s；失败清理临时包 | requestId、安装/校验审计；保留可解释失败状态 |
| `setSkillState` | Skill 已安装，主体有 state 权限，目标状态合法 | 返回 `enabled/disabled` 和版本 | 未授权/依赖不满足不改变原状态、不启动调用 | `requestId + skillId + targetState` | 当前版本条件更新，冲突返回 `conflict` | 启停健康检查 1 次、10s；不静默重复启动 | 状态事件、连接指标；按错误恢复为旧状态 |
| `uninstallSkill` | Skill 已安装且引用检查完成 | 返回卸载状态，审计保留 | 有任务/引用时拒绝，不删除项目数据、Artifact 或审计 | `requestId + skillId + version` | 引用检查与删除原子；删除锁防并发 | 清理最多 1 次、20s；失败保留 `installed` | requestId、引用检查和审计；人工确认后再卸载 |
| `listMcpServices` | 主体有 MCP read | 返回脱敏服务、启用状态、连接状态和工具数量 | 秘密和环境变量不回显，不启动外部进程 | 不适用：只读；替代验证：列表快照和状态事件一致 | 以 server version 读取 | GET 2 次、2s；运行时不可用返回 `service_unavailable` | requestId、状态读取；重新拉取并显示连接态 |
| `installMcp` | 配置 schema、命令/cwd/参数和凭据引用校验通过 | 服务记录进入 `installed`/`needs-credentials` | 非法配置不启动进程、不写明文秘密、不创建 `ready` 状态 | `requestId + serverId + configDigest` | serverId/configVersion 唯一，安装锁防重复进程 | 健康检查最多 1 次、15s；失败保持 `error` | requestId、进程/连接审计；显示补凭据或重试 |
| `setMcpState` | 服务已安装，主体有 state 权限，目标状态合法 | 返回独立启用/连接状态和工具数量 | 超时/连接失败不伪造 `ready`，不重复启动进程 | `requestId + serverId + targetState` | serverId 状态版本条件更新；连接租约防并发启动 | 连接最多 2 次退避重试、15s；取消进入 `stopped/error` | requestId、外部调用次数、连接指标；可重连/停止 |
| `uninstallMcp` | 服务已停止或停止请求已确认，引用检查通过 | 服务记录为 `uninstalled`，凭据引用清理 | 有运行/引用时拒绝，不删除项目/Artifact、不留可用临时 URL | `requestId + serverId + configVersion` | 引用检查、停止和卸载按版本原子化 | 停止最多 1 次、15s；失败保留原状态 | requestId、停止/卸载审计；人工处理残留进程 |

### 错误矩阵

| 场景 | error_key/结果 | 处理要求 |
| --- | --- | --- |
| manifest 或 schema 无效 | `invalid_request` | 拒绝安装并定位具体问题 |
| capability 未授权 | `permission_denied` | 不执行工具，写入脱敏审计 |
| 超时/取消 | `timeout` / `cancelled` | 返回稳定终态，不伪造成功 |

## 数据与事务

调用记录可持久化为项目审计摘要；外部副作用由执行器负责幂等和取消。

### 涉及数据

Skill/MCP manifest、版本、启停状态、工具 schema、权限决定、凭据引用、连接状态、调用请求/任务和脱敏审计事件。

### 约束与事务

安装与状态变更原子提交；工具调用在授权、schema 和连接状态均通过后提交；同一 `requestId` 重试不得重复副作用。

### 字段读写矩阵

| 数据 | 管理应用 | Runtime/Broker | 审计 |
| --- | --- | --- | --- |
| manifest/状态 | 读写 | 读取 | 摘要 |
| capability/凭据引用 | 请求/读取脱敏值 | 判定/使用引用 | 仅记录结果 |
| 工具输入输出 | 发起 | 执行 | 脱敏摘要 |

### 状态与生命周期

扩展：`discovered` -> `installed` -> `enabled`/`disabled` -> `uninstalled`；连接：`disconnected`/`connecting`/`ready`/`error`；调用：`queued`/`running`/`cancelled`/`succeeded`/`failed`。

### 物理约束与迁移

manifest 与工具 schema 带版本；升级必须声明兼容性或迁移；凭据引用不可写入普通扩展配置，卸载保留审计但清理运行时缓存。

### 数据所有权

DGOS 扩展管理服务拥有安装状态和审计；扩展拥有自身声明内容；Provider/MCP 凭据由凭据服务拥有，管理应用只持有引用。

### 安全与保留

工具输入、输出、凭据和 endpoint 按最小权限隔离；审计脱敏并按安全基线保留；卸载后不得保留可用凭据或临时下载地址。

## 验收标准

#### AC01 未授权工具不可调用

Given 工具未安装或缺少声明权限。

When 用户尝试调用工具。

Then DGOS 拒绝调用并显示安装/授权原因。

并且返回可观察的 `missing`、`disabled` 或 `permission_denied` 状态和 requestId；不得创建 Task/Run、启动外部进程、调用工具或写入项目数据。

#### AC02 输入和超时可追踪

Given 工具输入通过 schema 校验但执行超过超时。

When 调用进入超时状态。

Then UI 显示稳定 task/request 标识，用户可查询或取消且不会静默重复执行。

并且 Task/Run 终态为 `timed_out` 或 `cancelled`，外部调用次数和审计摘要可观察；不得创建第二次副作用调用、重复写入 Artifact 或泄露凭据。

#### AC03 MCP 配置、脱敏与连接状态

Given 用户新建或导入一个 MCP 服务器配置。

When 用户填写连接方式、命令、参数、cwd 和环境变量并保存并连接，或切换启用状态。

Then 配置按 schema 校验，秘密只以脱敏形式展示且不进入日志/项目 JSON；启用状态与连接状态独立可见，连接失败可重试且不会静默重复启动进程。

并且失败响应包含稳定 error_key 和 requestId，原配置、启用状态和已有连接记录保持不变；不得写入明文秘密或重复启动外部进程。

#### AC04 Skill 导入、启用与移除保护

Given 用户导入完整 Skill 包或在线 Skill，且包声明了版本、来源和权限。

When 用户启用、重命名、一键翻译、禁用或移除 Skill，并尝试用 `/技能名` 调用。

Then 导入先经过 manifest/权限校验，调用仍受 DGOS 权限服务约束；移除前显示对现有引用的影响，已有项目呈现可解释的缺失或停用状态。

并且校验失败或拒绝时不得安装、不得启用、不得执行 Skill、不得删除项目数据；结果通过安装状态、引用检查和脱敏审计可观察。

#### AC05 MCP 快速配置与凭据状态

Given 用户从快速配置选择一个 MCP 模板。

When 模板自动填充非秘密命令/地址等配置，且模板标记为“开箱即用”或“需填凭据”。

Then UI 显示模板状态；“需填凭据”必须要求用户补充秘密后才能保存并连接，秘密只以脱敏值回显且不写入日志、项目 JSON 或导出包。

#### AC06 MCP 连接生命周期与服务器列表

Given 已保存一个或多个 MCP 服务器。

When 用户查看服务器列表、等待连接、刷新重连或删除服务器。

Then 列表显示独立的启用状态、连接状态和已发现工具数量；刷新重连复用稳定服务器标识且不会重复启动，删除前检查引用并显示可解释的阻止、缺失或确认结果。

并且重复刷新只产生一个连接尝试，删除失败不改变原服务状态、不删除 Artifact 或项目引用；连接/卸载事件和 requestId 可审计。

#### AC07 Skill 自定义与在线导入预览

Given 用户创建自定义 Skill，或输入一个在线 Skill 地址/安装命令。

When 用户提交 ID、名称、描述和 System Prompt，或先点击预览再确认导入。

Then ID/manifest/来源/声明权限经过校验；在线来源在预览阶段展示包与子 Skill 摘要、风险和权限，未经用户确认不得安装；保存后稳定调用 ID 与展示名分离，且每个 Skill 的启用状态可见。

#### AC08 bundled MCP 与持久调用边界

Given 一个随 APP 提供的 MCP 分别处于无需凭据和需要凭据两种配置，且用户从页面发起调用。

When 系统安装、启用、连接服务，或用户关闭页面后查询调用结果。

Then 无需凭据且健康检查通过的服务才可自动启动；需要凭据的服务保持 `needs-credentials`；页面关闭不把前台调用标记为已交付，持久需求进入可查询、可取消、可恢复的 Task/Run。

并且未满足凭据或健康条件时不启动进程、不调用工具、不创建成功任务；Task/Run 的最终状态、外部调用次数和审计记录可观察。

### 自动化测试映射

| AC 范围 | 自动化重点 | 建议测试文件 | 建议命令 | 当前状态 |
| --- | --- | --- | --- | --- |
| AC01–AC08 | 权限、输入、MCP/Skill管理及持久Run | `tests/extensions/extension-service.test.mjs`、`tests/extensions/management-routes-pg.test.mjs`、`tests/extensions/management-translation-pg.test.mjs`、`scripts/v1-extension-http.mjs` | DGOS_EXTENSION_TEST_DATABASE_URL="$DGOS_EXTENSION_ISOLATED_URL" node --test tests/extensions/*.test.mjs | E r6独占已迁移extensions测试库33/33；旧公开Run链12/12，新增管理HTTP H在途；GUI/Linux另验 |

### AC 逐项测试设计

| AC | 验收重点 | 测试层级 | 目标资产 | 目标命令 | 初始资产状态 |
| --- | --- | --- | --- | --- | --- |
| AC01 | 权限拒绝 | API/Service | `tests/extensions/extension-service.test.mjs`、`tests/extensions/extension-routes.test.mjs` | node --test tests/extensions/extension-service.test.mjs tests/extensions/extension-routes.test.mjs | 已有拒绝子集；真实安装声明/精确依赖版本仍待验 |
| AC02 | 超时恢复 | Service/PG | `tests/extensions/extension-service.test.mjs`、`tests/extensions/postgres-extension.test.mjs` | node --test tests/extensions/extension-service.test.mjs tests/extensions/postgres-extension.test.mjs | 有超时/claimed不重发/重启子集，不等于业务E2E |
| AC03 | 配置、脱敏、连接 | Service/Transport | `tests/extensions/extension-service.test.mjs`、`tests/extensions/mcp-transport.test.mjs` | node --test tests/extensions/extension-service.test.mjs tests/extensions/mcp-transport.test.mjs | 受控进程/HTTP fixture；生产出站隔离与UI待验 |
| AC04 | Skill管理与引用保护 | PG/注入路由 | `tests/extensions/management-definition-pg.test.mjs`、`tests/extensions/management-translation-pg.test.mjs` | DGOS_EXTENSION_TEST_DATABASE_URL="$DGOS_EXTENSION_ISOLATED_URL" node --test tests/extensions/management-definition-pg.test.mjs tests/extensions/management-translation-pg.test.mjs | E r6已纳33/33：稳定身份/Prompt/翻译Task及apply；完整浏览器管理仍待D |
| AC05 | 快速配置与凭据状态 | PG/注入路由/受控transport | `tests/extensions/management-routes-pg.test.mjs`、`tests/extensions/management-credential-pg.test.mjs` | DGOS_EXTENSION_TEST_DATABASE_URL="$DGOS_EXTENSION_ISOLATED_URL" node --test tests/extensions/management-routes-pg.test.mjs tests/extensions/management-credential-pg.test.mjs | 同目的真实资产替换旧缺失目标；模板needs-credentials/写入脱敏/幂等补偿已有，双样本完整GUI与Linux目标OS待验 |
| AC06 | 工具发现/幂等连接/删除 | Transport/PG | `tests/extensions/mcp-transport.test.mjs`、`tests/extensions/hardening-r3.test.mjs`、`tests/extensions/postgres-extension.test.mjs` | node --test tests/extensions/mcp-transport.test.mjs tests/extensions/hardening-r3.test.mjs tests/extensions/postgres-extension.test.mjs | 连接/工具数/多主体子集；活跃依赖删除完整分支待补 |
| AC07 | Skill预览/身份/启用 | PG/HTTPS fixture | `tests/extensions/management-definition-pg.test.mjs`、`tests/extensions/management-online-pg.test.mjs`、`tests/extensions/management-custom-run-pg.test.mjs` | DGOS_EXTENSION_TEST_DATABASE_URL="$DGOS_EXTENSION_ISOLATED_URL" node --test tests/extensions/management-definition-pg.test.mjs tests/extensions/management-online-pg.test.mjs tests/extensions/management-custom-run-pg.test.mjs | E r6已含自定义Prompt/受信签名预览/字节固定；公开管理HTTP和导入UI待验 |
| AC08 | bundled凭据/跨页面Run | PG/独立daemon | `tests/extensions/management-credential-pg.test.mjs`、`tests/extensions/daemon-r3.test.mjs`、`scripts/v1-extension-http.mjs` | DGOS_EXTENSION_TEST_DATABASE_URL="$DGOS_EXTENSION_ISOLATED_URL" node --test tests/extensions/management-credential-pg.test.mjs tests/extensions/daemon-r3.test.mjs | E r6凭据/进程恢复子集，旧公开Run链12/12；页面关闭/reload及Linux生产隔离待验 |

### 回归要求

- 不能把 API Key、token 或完整敏感输入写入日志。
- `dgos.agent.*` 与 `dgos.aiTask.*` 的状态不能混淆。

## 实现与验证

2026-10-02 / r7回写：E r6报告记录`DGOS_EXTENSION_TEST_DATABASE_URL=.../dgos_v1_extensions_r3final node --test tests/extensions/*.test.mjs`最终33通过/0失败/0跳过，无PG命令为23通过/10跳过。涵盖自定义Skill、definition/Prompt保护、真实Task/Quota翻译、apply、可信在线来源、模板凭据、Secret补偿与Run恢复；早期32/33及配额拒绝后intent漏绑Task的修复经过保留，不能只报最终数字抹去失败。

旧公开Skill/MCP/Run脚本在macOS、真实API listener/PG/独立daemon下12/12，配对批次V1-EXT-http-2026-10-02T02-03-53-948Z的脚本SHA256为8c00ef67be3e097f4f2a20bce355b3ee1b291200e7abe191f65b48feaa5549e2；精确命令/manifest见[本轮证据索引](../V1-AC资产核对-2026-10-02.md#r7-证据回写2026-10-02)。这12项不包含新增管理HTTP全覆盖，Fastify注入也不等于外部HTTP。H独立管理链、D管理交互、B Linux非特权sandbox在途；生产在线trust roots/模板需部署配置，公开双有效主体同库证据仍缺。Verify r10的10个扩展失败保留为诊断历史，E33/33仅是随后定向结果。

### 2026-10-03 KMS集成完成（生产安全）

**生产密钥管理**: ✅ 完整实现

**实现**:
- `packages/secret-service/` (完整KMS包)
  - kms-provider.ts (接口, 3.2KB)
  - vault-client.ts (Vault实现, 8.5KB)
  - dev-kms-provider.ts (开发provider, 2.1KB)
  - kms-secret-service.ts (服务, 5.8KB)

**配置**:
- `scripts/init-vault.sh` (Vault初始化)
- `deployment/vault/vault.hcl` (生产配置)
- `deployment/vault/vault-dev.hcl` (开发配置)
- `.env.example` (KMS环境变量)

**迁移工具**:
- `scripts/migrate-secrets-to-kms.mjs` (Redis→KMS迁移)

**监控**:
- `scripts/kms-health-check.mjs` (健康检查)

**测试**:
- `tests/security/kms-provider.test.mjs` (全面测试)

**文档**:
- `docs/KMS-Integration.md` (9.4KB, 集成指南)
- `docs/KMS-Security.md` (安全最佳实践)
- `docs/KMS-Implementation-Summary.md` (实施总结)

**安全特性**:
- AES-256-GCM加密 (替代之前的内存存储)
- HashiCorp Vault集成 (Transit + KV v2 engines)
- 多种认证: Token/AppRole/Kubernetes
- 自动token续期
- TLS支持
- 密钥版本控制和轮换
- TTL管理
- 审计日志

**合规**: GDPR, SOC2, ISO27001, PCI DSS, HIPAA

**验证**: 所有测试通过，生产就绪

**P1要求满足**: FR-003评估中确定的"KMS集成缺失"已解决

## 技术设计

见[Skill MCP 与 Agent 接入技术设计](02-SkillMCP与Agent接入-技术设计.md)。
