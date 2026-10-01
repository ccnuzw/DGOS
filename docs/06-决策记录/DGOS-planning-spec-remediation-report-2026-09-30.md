# DGOS planning 规格阻断分类与收口记录

## 1. 报告范围

本报告记录 2026-09-30 在 DGOS 文档库上执行的 planning 规格检查结果，以及后续规格修复批次。报告不代表实现、测试或发布通过，也不改变任何 Pending 证据状态。

检查范围为当前版本中真正被检查器识别为 active 的六个功能：

| 稳定功能 ID | 当前权威功能名称 | 规格文档 |
| --- | --- | --- |
| `V1-FR-001` | 桌面与应用工作区 | `docs/03-功能规格/V1/01-桌面与系统/01-桌面与应用工作区.md` |
| `V1-FR-002` | 开发者中心与 APP 生命周期 | `docs/03-功能规格/V1/02-开发者体验/01-开发者中心与APP生命周期.md` |
| `V1-FR-003` | Skill MCP 与 Agent 接入 | `docs/03-功能规格/V1/03-Agent与协议/01-SkillMCP与Agent接入.md` |
| `V1-FR-005` | 多模态 AI 任务工作流（V1 文本任务切片） | `docs/03-功能规格/V1/05-AI工作流/01-多模态AI任务工作流.md` |
| `V1-FR-007` | 模型平台与工作流配置（V1 Provider/模型配置切片） | `docs/03-功能规格/V1/07-模型与配置/01-模型平台与工作流配置.md` |
| `V1-FR-009` | 系统智能助手与快捷指令 | `docs/03-功能规格/V1/09-系统助手/01-系统智能助手与快捷指令.md` |

用户请求中提到的“用户注册、用户登录与会话、管理员登录、API Key 生命周期、服务商管理、上游账号连接测试”与上述稳定 ID 当前登记的 DGOS 语义不一致。不得据此重命名稳定 ID 或把登录/API Key 业务写入现有功能；若产品范围确实需要调整，应先由产品和技术负责人确认新的功能拆分、稳定 ID 和版本归属。

## 2. 原始检查命令

```text
node scripts/docs-gate.mjs --repo /Users/apple/Progame/DGOS --phase planning --json
node scripts/review-docs.mjs --repo /Users/apple/Progame/DGOS --phase planning --json
```

原始 JSON 快照：

- `/tmp/dgos-docs-gate-planning-before.json`
- `/tmp/dgos-review-planning-before.json`

原始结果：

| 检查 | 状态 | 数量 |
| --- | --- | ---: |
| `docs-gate --phase planning` | `ok=false` | 82 errors，61 warnings |
| `review-docs --phase planning` | `SDD_NOT_READY` | 0 errors，136 warnings，82 blockers，6 features |

`docs-gate` 的 82 个 error 与 `review-docs` 的 82 个 blocker 是同一组 planning 阻断项在两个输出层的表现，不应相加计算。

## 3. 阻断分类

| 错误类别 | issue code | 数量 | 是否阻断 planning | 需要修改的权威文档 | 人工确认 |
| --- | --- | ---: | --- | --- | --- |
| operation 前置/后置条件缺失 | `FEATURE_CONTRACT_GAP` | 12 | 是 | 六个功能主文档的“需求说明/接口契约”及公共接口契约 | 各 operation 的调用主体和依赖边界 |
| 契约字段缺失 | `FEATURE_CONTRACT_GAP` | 10 | 是 | V1-FR-001、003、005、007、009 功能主文档及 OpenAPI 字段权威 | 字段约束最终是否冻结在 OpenAPI |
| 成功响应或失败终态缺失 | `FEATURE_CONTRACT_GAP` | 10 | 是 | 六个功能主文档的接口契约、错误矩阵和 OpenAPI | 稳定响应/错误键及状态终态 |
| 幂等、并发、重试、超时缺失 | `FEATURE_CONTRACT_GAP`、`PUBLIC_CONTRACT_IDEMPOTENCY_MISSING` | 62 | 是 | 六个功能主文档、`docs/04-技术架构/当前版本/V1-接口契约.md` | 每个写 operation 的幂等键、版本条件、重试预算和超时 |
| 观测和恢复约束缺失 | `FEATURE_CONTRACT_GAP` | 10 | 是 | 六个功能主文档及公共接口契约 | requestId、审计、指标、告警和恢复责任 |
| AC 缺少失败无副作用断言 | `AC_NO_SIDE_EFFECT_ASSERTION` | 20 条 AC（gate 输出计为 40 条含两个来源） | 是 | 六个功能主文档的验收标准 | 失败时必须保持不变的实体和外部调用 |
| AC 缺少可观察最终事实 | `AC_NOT_OBSERVABLE` | 10 条 AC（gate 输出计为 20 条含两个来源） | 是 | 六个功能主文档的验收标准 | 需要检查 HTTP、状态、审计、事件或调用次数中的哪一种 |
| 测试资产规划状态 | `TEST_ASSET_MISSING` | 54 | 否（planning 可保持规划中） | 六个功能主文档、E2E 矩阵和 E2E 规范 | 负责人、补齐时点和真实测试命令 |
| AC 仍为规划中 | `AC_PENDING` | 6 | 否（planning 允许） | 六个功能主文档和 E2E 矩阵 | AC 是否仍属于当前 active slice |
| commandRegistry 缺失 | `COMMAND_REGISTRY_OFF` | 1 | 否，当前为治理 warning | `docs-gate.json` | 当前项目是否有统一测试/检查命令 |
| 当前/未来版本混用 | 本轮原始阻断中未发现 | 0 | 否 | 当前/后续版本规划和事实注册表 | 保持 V2-V6 不进入 V1 AC |

说明：上表的重复计数来自 `docs-gate` 和 `review-docs` 同时输出同一 issue；修复进度应以单一 issue code 和功能 ID 去重后统计。

## 4. 按功能的原始阻断

| 功能 ID | 原始 issue 数（跨两个 JSON 输出的去重口径） | 主要阻断 | 权威修改边界 |
| --- | ---: | --- | --- |
| `V1-FR-001` | 约 13 条 | 前置依赖、字段规则、成功响应、幂等、并发、观测；AC02/03/07/08 的失败副作用或可观察性 | 只改桌面与系统主文档、V1 公共接口契约、直接引用的 E2E/权限语义 |
| `V1-FR-002` | 约 5 条 | 前置依赖；AC01/02/03 的失败副作用或可观察性 | 只改 APP 生命周期主文档及其公共 manifest/catalog 边界 |
| `V1-FR-003` | 约 16 条 | 前置依赖、字段规则、成功响应、幂等、并发、观测；多条 AC 的失败副作用 | 只改 Skill/MCP/Agent 主文档及直接公共扩展契约 |
| `V1-FR-005` | 约 8 条 | 前置依赖、字段规则、成功响应、并发、观测；AC02 的失败副作用 | 只改 AI Task 主文档、Task/Artifact 公共契约 |
| `V1-FR-007` | 约 15 条 | 前置依赖、字段规则、成功响应、幂等、并发、重试、观测；多条 AC 可观察性 | 只改 Provider/Model 主文档、Provider 公共契约和秘密边界 |
| `V1-FR-009` | 约 13 条 | 前置依赖、字段规则、成功响应、并发、重试、观测；多条 AC 的失败副作用或可观察性 | 只改 Assistant/Action 主文档及 Action/Task 公共契约 |

功能计数是按 issue 的首个功能 ID 归属，包含 `review-docs` 的 AC 级 issue；公共接口契约的 21 个 operation 幂等 warning 单列，不重复分配给功能表。

## 5. 真实测试资产状态

原始检查发现 54 条测试资产缺失。当前文档将这些资产保持为“规划中/未创建”，没有任何 `Passed`、`已通过` 或执行证据。目标路径和命令仍需保留在各功能 AC 映射、E2E 矩阵和 E2E 规范中；本阶段不创建空测试文件、不写测试结果。

## 6. 本阶段修复原则

1. 只补规格输入完整度，不修改业务代码。
2. OpenAPI 继续作为 HTTP 字段 schema 的唯一权威；Markdown 只补业务语义、前后置条件、终态、失败副作用和验证映射。
3. 每个写 operation 必须明确幂等、并发、重试、超时、观测和恢复；确实不适用时写出理由和替代验证。
4. AC 的失败、拒绝、重复、并发、超时、回滚和权限场景必须包含无副作用断言，并指向可观察事实。
5. 测试资产不存在时保持规划状态，不伪造执行结果。
6. 不修改 `docs-facts.json` 的 relations、evidence 或 evidence_policy；只有 Markdown 派生字段确认正确后才允许 facts-sync write。
7. `docs-evidence.json` 继续保持 `pending`、`commit_binding: absent`，不生成测试、E2E、release 或审批证据。

## 7. 未决业务问题

- 用户请求中的六个功能名称与当前稳定 ID 语义不一致，需要产品/技术负责人确认是否为另一套需求输入；在确认前不改写现有功能名称和 ID。
- V1 是否真的需要身份注册、登录/会话和 API Key 生命周期能力；当前公共契约只登记主体/会话抽象和 Provider 秘密边界，未登记为独立 V1 功能。
- 开发者中心、APP 生命周期、Skill/MCP 管理和 Provider 配置的 HTTP operation 是否需要新增机器契约；本阶段不得虚构 operationId，若需要应先冻结 schema 和 ADR。
- 当前项目没有统一真实测试命令和代码仓库；是否登记 `commandRegistry` 需要负责人确认。

## 8. 修复批次记录

本节在每个功能批次完成后追加：修改文件、检查命令和退出码、剩余阻断、测试资产状态及人工确认项。空白不表示已解决。

## 9. 实际修复批次

### Batch V1-FR-001

- 修改：`docs/03-功能规格/V1/01-桌面与系统/01-桌面与应用工作区.md`。
- 补齐：系统服务/Session/权限/版本设置前置依赖；六个 operation 的前置、成功终态、失败无副作用、幂等、并发、重试、超时、观测和恢复；AC02、AC03、AC07、AC08 的可观察事实和失败副作用断言。
- 状态：规格状态已更新为 `Ready`；实现状态仍为 `planned`；测试资产仍为未创建/规划中。

### Batch V1-FR-002

- 修改：`docs/03-功能规格/V1/02-开发者体验/01-开发者中心与APP生命周期.md`。
- 补齐：manifest、签名、审核、安装服务和健康检查前置依赖；本地生命周期动作的成功/失败、幂等、并发、重试、超时、观测和恢复约束；AC01、AC02、AC03 的验证结果和无副作用断言。
- 保留事实：当前没有冻结的开发者中心公共 HTTP operationId，没有虚构 operationId。
- 状态：规格状态已更新为 `Ready`；实现状态仍为 `planned`；测试资产仍为未创建/规划中。

### Batch V1-FR-003

- 修改：`docs/03-功能规格/V1/03-Agent与协议/01-SkillMCP与Agent接入.md`。
- 补齐：manifest、Agent runtime、Capability Broker、凭据服务和 Task/Run 前置依赖；Skill/MCP operation 的完整运行约束；AC01、AC02、AC03、AC04、AC06、AC08 的拒绝、超时、脱敏、重复进程和引用保护断言。
- 状态：规格状态已更新为 `Ready`；实现状态仍为 `planned`；测试资产仍为未创建/规划中。

### Batch V1-FR-005

- 修改：`docs/03-功能规格/V1/05-AI工作流/01-多模态AI任务工作流.md`。
- 补齐：Provider/Model、Permission、Task、Worker、Artifact 和 SSE 前置依赖；submit/get/events 的任务终态、并发、幂等、重试、超时、观测和恢复；AC02 的重复任务、重复 Provider 调用和 Artifact 副作用断言。
- 状态：规格状态已更新为 `Ready`；实现状态仍为 `planned`；测试资产仍为未创建/规划中。

### Batch V1-FR-007

- 修改：`docs/03-功能规格/V1/07-模型与配置/01-模型平台与工作流配置.md`。
- 补齐：Config、Secret、Provider Adapter Registry、Model Catalog 和 Permission 前置依赖；11 个 Provider/Model operation 的字段权威、成功/失败、幂等、并发、重试、超时、观测和恢复；AC01、AC04、AC05、AC07、AC08 的状态、目录、策略和协议映射事实。
- 状态：规格状态已更新为 `Ready`；实现状态仍为 `planned`；测试资产仍为未创建/规划中。

### Batch V1-FR-009

- 修改：`docs/03-功能规格/V1/09-系统助手/01-系统智能助手与快捷指令.md`。
- 补齐：Action Registry、Capability Broker、Permission、Task/Run 和公开动作 schema 前置依赖；五个 Action operation 的计划/确认/执行/查询/取消约束；AC01–AC06 的 ActionRun、权限、确认、版本冲突、长任务和无副作用断言。
- 状态：规格状态已更新为 `Ready`；实现状态仍为 `planned`；测试资产仍为未创建/规划中。

### 公共契约与工具修复

- 修改：`docs/04-技术架构/当前版本/V1-接口契约.md`。
- 公共逐操作索引现在包含 35 个 operation 的前置条件、成功终态、失败无副作用、字段权威、AC/E2E 和运行治理；运行治理明确幂等、并发、重试、超时、观测和恢复。
- 修改：`scripts/facts-sync.mjs`。
- 修复：facts-sync 现在复用 `docs-policy.json` 的 feature 文件排除规则，不再把 `功能风险分级.md` 误识别为功能主文档；明确 `delivery_scope=future` 的 facts 不作为当前 V1 文档 orphan。
- facts registry：`docs-facts.json` 仅写回 6 个 active feature 的 `spec_status=ready` 派生字段；relations、evidence 和 evidence_policy 未修改。
- baseline：重新写入 `.spec-docs/baselines/V1.json`，digest 为 `9e5ba53c42b81f0852c0ac1dc91af7ddec8410a397badf7a6df3882b9316fc7f`。

## 10. 最终验证

| 命令 | 退出码 | 最终结果 |
| --- | ---: | --- |
| `node scripts/facts-sync.mjs --dir /Users/apple/Progame/DGOS --json` | `0` | 6 derived features，0 findings、0 drift、0 orphan |

## 11. 2026-10-01 后续收口

本报告记录的是 2026-09-30 的规划修复批次，不能覆盖后续契约变更。2026-10-01 已追加 [ADR-0005](ADR/0005-V1身份秘密Provider治理与用量机器契约.md)，并将 `V1-FR-010`–`V1-FR-015` 的机器 operation、核心 schema、公共错误/鉴权/幂等规则登记到 [V1-openapi.yaml](../04-技术架构/当前版本/V1-openapi.yaml)、V1 接口契约和 V1 数据模型。六份功能规格的 OpenAPI 映射已从“不适用”改为明确 operationId，全部仍为 planned；这不改变本报告中“无产品实现、无 migration、无 E2E 证据”的事实。

本轮同时将 `V1-E2E-11`–`V1-E2E-15` 纳入 V1 首发退出门禁，补充公开 operation、fixture、可观察事实、失败无副作用断言和安全基线；测试资产仍未创建，状态仍为未执行。
| `node scripts/traceability-report.mjs --dir /Users/apple/Progame/DGOS --profile sdd --strict` | `0` | 93 facts、9 slices、175 relations；0 errors、0 warnings，覆盖率 100% |
| `node scripts/contract-index.mjs --dir /Users/apple/Progame/DGOS --strict --json` | `0` | 2 contract sources，35 operations，35 mapped，0 errors、0 warnings |
| `node scripts/evidence-freshness.mjs --dir /Users/apple/Progame/DGOS --json` | `0` | evidence 0，valid/stale/invalid 皆为 0 |
| `node scripts/spec-diff.mjs --dir /Users/apple/Progame/DGOS --json` | `0` | baseline/current digest 一致，0 changes、0 unbound changes |
| `node scripts/review-docs.mjs --repo /Users/apple/Progame/DGOS --phase planning --json` | `0` | `SPEC_READY`，0 errors、0 blockers、54 warnings |
| `node scripts/docs-gate.mjs --repo /Users/apple/Progame/DGOS --phase planning --json` | `0` | `ok=true`，0 errors、61 warnings |
| `node scripts/check-docs.mjs --repo /Users/apple/Progame/DGOS --strict` | `0` | 0 errors、3 个模板占位 warning |

planning gate 的 61 个 warning 为：54 个尚未创建的真实测试资产、6 个 AC 仍为规划中、1 个 `commandRegistry` 未配置。它们没有被标记为 Passed，也没有创建空测试文件。

## 11. 当前状态与剩余风险

- 当前规格状态：`SPEC_READY`。
- 六个 active 功能的规格状态：`Ready`。
- 六个功能的实现状态：仍为 `planned`；本阶段没有修改业务代码。
- `docs-evidence.json` 仍保持 `status=pending`、`commit=null`、`commit_binding=absent`。
- development、E2E、release 报告路径仍为 `null`；审批字段仍为空。
- 测试资产仍未创建，不能宣称测试通过、本地验证通过、E2E 通过或发布通过。
- 当前目录不是 Git 仓库；没有生成或伪造 commit SHA。
- 模板 warning 保持原状；没有删除模板或关闭检查。
- 用户请求中的“注册/登录/API Key/上游账号”命名仍与当前稳定功能 ID 语义不一致，已作为人工确认项保留，未重命名稳定 ID。

## 12. 下一批实现切片建议

规格已经可以进入实现输入评审，建议按以下顺序冻结机器契约并再开发：

1. `V1-platform`：Session/主体、权限、系统设置、APP manifest/catalog、Skill/MCP schema 和统一错误。
2. `V1-ai-task`：Provider/Model descriptor、Task/Artifact、SSE 事件和声明式能力协议。
3. `V1-assistant`：Action Registry、计划/确认/执行、Task/Run 和审计。

进入 development/E2E/release 阶段时，必须在真实源码、测试环境、构建标识和 Git 可用后生成对应 evidence manifest；当前 Pending 状态不得提前升级。

## 13. V1-FR-001 / V1-FR-002 功能批次复核

### 批次范围

本批次只复核以下两个稳定功能 ID 及其直接引用：

- `V1-FR-001`：`docs/03-功能规格/V1/01-桌面与系统/01-桌面与应用工作区.md`
- `V1-FR-002`：`docs/03-功能规格/V1/02-开发者体验/01-开发者中心与APP生命周期.md`

任务包已生成并保存在临时输出：

- `/tmp/dgos-fr001-task-before.json`
- `/tmp/dgos-fr002-task-before.json`

### 语义冲突

用户本批次描述将 `V1-FR-001` 指定为“用户注册”、将 `V1-FR-002` 指定为“用户登录与会话”。当前仓库权威追踪矩阵、功能主文档、facts registry 和公共接口契约均登记为：

- `V1-FR-001` = 桌面与应用工作区；
- `V1-FR-002` = 开发者中心与 APP 生命周期；
- 身份/会话在公共契约中只是 V1 主体与会话抽象，正式登录/续期属于 V2；当前没有用户注册、登录或会话生命周期的 V1 operationId。

本批次没有重命名稳定 ID、没有把登录/注册规则写入桌面或 APP 生命周期文档，也没有虚构 OpenAPI operation。需要产品负责人和技术负责人确认新的功能拆分、稳定 ID、V1/V2 归属和公共身份契约后，才能另开身份功能修复批次。

### 阻断变化

| 功能 | 修复前 blockers | 修复后 blockers | 修复前自身 warning | 修复后自身 warning | 变化 |
| --- | ---: | ---: | ---: | ---: | --- |
| `V1-FR-001` | 0 | 0 | 9 | 9 | 无变化；规格已 Ready，保留 9 个未创建测试资产 warning |
| `V1-FR-002` | 0 | 0 | 4 | 4 | 无变化；规格已 Ready，保留 4 个未创建测试资产 warning |

“自身 warning”按 issue ID 过滤；feature review 命令仍输出全局 54 warnings，但本表只统计对应功能。当前两个功能没有 docs-gate planning 阻断项可修复。

### 本批次实际命令与退出码

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `node scripts/spec-docs.mjs task --dir /Users/apple/Progame/DGOS --feature V1-FR-001 --phase planning --objective "按当前权威语义补齐桌面与应用工作区契约、数据、AC 和验证输入"` | `0` | 任务包生成；稳定 ID 语义为桌面与系统 |
| `node scripts/spec-docs.mjs task --dir /Users/apple/Progame/DGOS --feature V1-FR-002 --phase planning --objective "按当前权威语义补齐开发者中心与 APP 生命周期契约、数据、AC 和验证输入"` | `0` | 任务包生成；稳定 ID 语义为 APP 生命周期 |
| `node scripts/review-docs.mjs --repo /Users/apple/Progame/DGOS --phase planning --feature V1-FR-001 --json` | `0` | `SPEC_READY`，0 blockers |
| `node scripts/review-docs.mjs --repo /Users/apple/Progame/DGOS --phase planning --feature V1-FR-002 --json` | `0` | `SPEC_READY`，0 blockers |
| `node scripts/check-docs.mjs --repo /Users/apple/Progame/DGOS --strict` | `0` | 0 errors、3 模板 warning |
| `node scripts/docs-gate.mjs --repo /Users/apple/Progame/DGOS --phase planning --json` | `0` | `ok=true`，0 errors、61 warnings |

### 未解决问题

- 用户注册、用户登录、会话续期、会话撤销是否属于 V1，当前没有权威功能 ID 或机器契约。
- 若确认进入 V1，需要新增或重新分配稳定功能 ID，建立身份/会话主文档、技术设计、OpenAPI schema、错误码、AC/E2E 和 facts relations；不得复用当前 `V1-FR-001/002` 的既有语义。
- 两个当前功能引用的测试资产仍未创建，保持规划中/未执行，没有生成通过证据。
- `docs-evidence.json` 仍保持 `pending`、无 Git commit binding；本批次没有改动证据、审批或发布状态。

## 14. V1-FR-003 / V1-FR-005 / V1-FR-007 / V1-FR-009 功能批次复核

### 权威语义与本轮边界

本批次核对了需求追踪矩阵、四份功能主文档、facts registry 和 V1 公共接口契约。稳定 ID 的当前权威语义为：

| 稳定功能 ID | 当前权威名称 | 用户本轮提供的名称 |
| --- | --- | --- |
| `V1-FR-003` | Skill MCP 与 Agent 接入 | 管理员登录 |
| `V1-FR-005` | 多模态 AI 任务工作流（V1 文本任务切片） | API Key 生命周期 |
| `V1-FR-007` | 模型平台与工作流配置（V1 Provider/模型配置切片） | 服务商管理 |
| `V1-FR-009` | 系统智能助手与快捷指令 | 上游账号连接测试 |

本轮保留稳定 ID 和现有权威语义，没有将管理员登录/API Key 生命周期/上游账号连接测试改写进不相干功能，也没有虚构 operationId。V1-FR-007 的 Provider 配置当前确实包含 DGOS Secret 管理及 Provider 连通性验证，但不等价于新增“上游账号连接测试”身份功能；V1-FR-005 通过 V1-FR-007 使用托管凭据，不负责 API Key 生命周期。

### 功能级结果与剩余测试缺口

| 功能 | 修复前 blockers | 修复后 blockers | 修复前自身 warning | 修复后自身 warning | 当前状态 |
| --- | ---: | ---: | ---: | ---: | --- |
| `V1-FR-003` | 0 | 0 | 15 | 15 | `SPEC_READY`；测试资产未创建 |
| `V1-FR-005` | 0 | 0 | 5 | 5 | `SPEC_READY`；测试资产未创建 |
| `V1-FR-007` | 0 | 0 | 13 | 13 | `SPEC_READY`；测试资产未创建 |
| `V1-FR-009` | 0 | 0 | 8 | 8 | `SPEC_READY`；测试资产未创建 |

四个功能的 operation 契约已覆盖前置条件、鉴权主体、成功响应/最终状态、失败和无副作用、幂等、并发、重试/超时、观测和恢复；涉及风险的 AC 已有可观察 Then 和失败副作用断言。上述 warning 全部是目标测试/fixture 文件尚不存在；没有创建空文件，也没有把任何测试标记为通过。

### 本批次验证命令与退出码

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `node scripts/spec-docs.mjs task --dir /Users/apple/Progame/DGOS --feature V1-FR-003 --phase planning --objective "按当前权威语义补齐 Skill MCP 与 Agent 接入规格输入"` | `0` | 任务包生成 |
| `node scripts/spec-docs.mjs task --dir /Users/apple/Progame/DGOS --feature V1-FR-005 --phase planning --objective "按当前权威语义补齐多模态 AI 任务工作流规格输入"` | `0` | 任务包生成 |
| `node scripts/spec-docs.mjs task --dir /Users/apple/Progame/DGOS --feature V1-FR-007 --phase planning --objective "按当前权威语义补齐模型平台与工作流配置规格输入"` | `0` | 任务包生成 |
| `node scripts/spec-docs.mjs task --dir /Users/apple/Progame/DGOS --feature V1-FR-009 --phase planning --objective "按当前权威语义补齐系统智能助手与快捷指令规格输入"` | `0` | 任务包生成 |
| `node scripts/review-docs.mjs --repo /Users/apple/Progame/DGOS --phase planning --feature V1-FR-003 --json` | `0` | `SPEC_READY`，该功能 0 blockers、15 测试资产 warning |
| `node scripts/review-docs.mjs --repo /Users/apple/Progame/DGOS --phase planning --feature V1-FR-005 --json` | `0` | `SPEC_READY`，该功能 0 blockers、5 测试资产 warning |
| `node scripts/review-docs.mjs --repo /Users/apple/Progame/DGOS --phase planning --feature V1-FR-007 --json` | `0` | `SPEC_READY`，该功能 0 blockers、13 测试资产 warning |
| `node scripts/review-docs.mjs --repo /Users/apple/Progame/DGOS --phase planning --feature V1-FR-009 --json` | `0` | `SPEC_READY`，该功能 0 blockers、8 测试资产 warning |
| `node scripts/check-docs.mjs --repo /Users/apple/Progame/DGOS --strict` | `0` | 0 errors、3 模板 warning |
| `node scripts/docs-gate.mjs --repo /Users/apple/Progame/DGOS --phase planning --json` | `0` | `ok=true`，0 errors、61 warnings |

### 未解决的业务确认

- `V1-FR-003` 是否要新增“管理员登录”功能，角色模型、认证主体、权限边界和版本归属待产品/技术负责人确认。
- `V1-FR-005` 是否要独立承接 API Key 生命周期，还是继续由 `V1-FR-007` 的 DGOS Secret/Provider 配置能力管理，待确认密钥所有权、轮换/撤销与审计边界。
- `V1-FR-007` 的现有范围是 Provider/Model 配置和适配器验证；“服务商管理”是否指此能力、是否还包含账号实体/连接测试，待产品/技术负责人确认。
- `V1-FR-009` 当前是系统助手动作，不是上游账号功能；上游账号连接测试若属于目标范围，应先确认新增稳定功能 ID、与 Provider 验证的边界及 V1/V2 版本归属。
- 前述决策未冻结前，不改稳定 ID，不扩写现有主文档，不增加机器 operation，也不调整 facts relations。
- 四功能目标测试资产仍未创建；evidence 继续为 Pending，不能据此宣称测试、E2E 或发布通过。

## 15. V1-FR-001 / V1-FR-002 功能批次复核（2026-09-30）

### 权威语义与本轮边界

本批次按当前需求追踪矩阵、功能主文档、技术设计、V1 应用清单契约和公共接口契约复核两个稳定功能 ID：

| 稳定功能 ID | 当前权威名称 | 收口范围 |
| --- | --- | --- |
| `V1-FR-001` | 桌面与应用工作区 | DGOS 桌面、Dock/启动台、窗口与工作区摘要、系统设置/上下文、权限前置和应用状态展示；不包含 V2 Project 文档 |
| `V1-FR-002` | 开发者中心与 APP 生命周期 | manifest/资源校验、开发者测试安装、管理员审核、受信目录、普通用户安装/更新/卸载、Release 不可覆盖和失败回滚 |

本轮不将用户注册、用户登录或会话身份体系写入这两个既有稳定 ID；这些需求仍需后续建立独立权威规格。

### 功能级结果与剩余测试缺口

| 功能 | 修复前 blockers | 修复后 blockers | 修复前自身 warning | 修复后自身 warning | 当前状态 |
| --- | ---: | ---: | ---: | ---: | --- |
| `V1-FR-001` | 0 | 0 | 9 | 9 | `SPEC_READY`；测试资产未创建 |
| `V1-FR-002` | 0 | 0 | 4 | 4 | `SPEC_READY`；测试资产未创建 |

两份规格已具备前置条件、主体/权限边界、成功终态、失败无副作用、幂等、并发、重试/超时、观测/恢复、数据所有权、AC 可观察断言和 E2E 映射。剩余 warning 是目标测试与 fixture 尚未创建，不是规划规格 blocker；没有创建空测试文件，也没有生成通过证据。

### 本批次实际命令与退出码

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `node scripts/spec-docs.mjs task --dir /Users/apple/Progame/DGOS --feature V1-FR-001 --phase planning --objective "按当前权威语义补齐桌面与应用工作区契约、数据、AC 和验证输入"` | `0` | 任务包生成 |
| `node scripts/spec-docs.mjs task --dir /Users/apple/Progame/DGOS --feature V1-FR-002 --phase planning --objective "按当前权威语义补齐开发者中心与 APP 生命周期契约、数据、AC 和验证输入"` | `0` | 任务包生成 |
| `node scripts/review-docs.mjs --repo /Users/apple/Progame/DGOS --phase planning --feature V1-FR-001 --json` | `0` | `SPEC_READY`，0 blockers；9 个自身测试资产 warning |
| `node scripts/review-docs.mjs --repo /Users/apple/Progame/DGOS --phase planning --feature V1-FR-002 --json` | `0` | `SPEC_READY`，0 blockers；4 个自身测试资产 warning |
| `node scripts/check-docs.mjs --repo /Users/apple/Progame/DGOS --strict` | `0` | 0 errors、3 个模板 warning |
| `node scripts/docs-gate.mjs --repo /Users/apple/Progame/DGOS --phase planning --json` | `0` | `ok=true`，0 errors、61 warnings |

### 未解决问题

- 两个功能仍处于 `implementation_status: planned`；仓库没有 DGOS 产品源码、运行构建或实际 E2E 执行证据。
- `FR-001` 的测试资产 `desktop.spec.ts`、系统设置/网络/语言/权限相关测试尚未创建；`FR-002` 的无效包 fixture、发布回滚和目录生命周期测试尚未创建。
- `docs-evidence.json` 保持 `pending`、`commit: null`、`commit_binding: absent`；本批次未改变证据、审批或发布状态。

## 16. FR-004/006/007/008 与身份治理扩展批次复核（2026-09-30）

### 范围决策

本批次将用户提出的范围拆成当前稳定 ID 可承接的规划边界：

| 用户请求 | 当前处理 | 结论 |
| --- | --- | --- |
| `V1-FR-004` Agent 调用、运行状态和协议边界 | `V1-FR-003` 主文档补充 Agent Tool Registry、统一 Executor、Task/Run 状态、协议适配和文件/知识库最小字段访问边界 | `V1-FR-004` 保持 V2 无限画布与项目历史编号，不改语义 |
| `V1-FR-006` 文件和知识库依赖 | 补入 DGOS 总体架构、应用运行时和 Agent/MCP 数据流：V1 只允许文件/索引服务提供授权引用、最小元数据/检索片段；Project/Canvas 写入后置 | `V1-FR-006` 保持 V5 Canvas 插件与模板扩展历史编号 |
| `V1-FR-007` Provider 账号边界 | 保留 `V1-FR-007` 的 ProviderConfig、协议、模型目录和策略；新增 `V1-FR-012` 负责 ProviderAccount、凭据归属、绑定和启停，`V1-FR-013` 负责连接诊断 | 配置、账号、测试三层分离；测试不隐式刷新模型 |
| `V1-FR-008` 用量与额度 | 新增 `V1-FR-015`，消费 FR-005/007/012 的 task、模型、账号和 attempt 事实；不改 V4 资产与生成历史规格 | 用量/额度不复用 V4 资产历史 ID，不承接支付计费 |
| 管理员登录/API Key/Provider 账号/上游连接测试/审计治理 | 新增 `V1-FR-010` 至 `V1-FR-014`，统一登记到编号、矩阵、README、查找表、facts、数据模型、接口动作清单和 E2E 规范 | 新规格均保持 `implementation_status: planned`；未虚构 OpenAPI operation |

### 新增稳定规格

| 功能 | 权威文档 | 状态 | 自身 blockers | 自身 warnings |
| --- | --- | --- | ---: | ---: |
| `V1-FR-010` 管理员登录与会话 | `docs/03-功能规格/V1/10-身份与治理/01-管理员登录与会话.md` | `SPEC_READY` | 0 | 5 |
| `V1-FR-011` API Key 生命周期 | `docs/03-功能规格/V1/10-身份与治理/02-API-Key生命周期.md` | `SPEC_READY` | 0 | 5 |
| `V1-FR-012` Provider 账号与连接 | `docs/03-功能规格/V1/10-身份与治理/03-Provider账号与连接.md` | `SPEC_READY` | 0 | 5 |
| `V1-FR-013` 上游账号连接测试 | `docs/03-功能规格/V1/10-身份与治理/04-上游账号连接测试.md` | `SPEC_READY` | 0 | 6 |
| `V1-FR-014` 审计与管理员系统治理 | `docs/03-功能规格/V1/10-身份与治理/05-审计与管理员系统治理.md` | `SPEC_READY` | 0 | 7 |
| `V1-FR-015` 用量与额度管理 | `docs/03-功能规格/V1/10-身份与治理/06-用量与额度管理.md` | `SPEC_READY` | 0 | 6 |

warning 主要来自目标测试/fixture 尚未创建；没有将未执行测试标记为通过。`V1-FR-004/006/008` 的 review 仍属于 future 版本范围，工具对其返回的配置边界提示不改变 V2/V5/V4 迁移结论；`V1-FR-007` 继续为 active Provider/模型配置规格。

### 本批次验证命令与退出码

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `node scripts/facts-sync.mjs --repo /Users/apple/Progame/DGOS --json` | `0` | 新增 `V1-FR-010..015` 已登记；0 findings |
| `node scripts/check-docs.mjs --repo /Users/apple/Progame/DGOS --strict` | `0` | 0 errors、3 个模板占位 warning |
| `node scripts/docs-gate.mjs --repo /Users/apple/Progame/DGOS --phase planning --json` | `0` | `ok=true`、0 errors；warning 仍为规划测试资产和模板缺口 |
| `node scripts/review-docs.mjs --repo /Users/apple/Progame/DGOS --phase planning --feature V1-FR-010 --json` | `0` | `SPEC_READY`，0 blockers、5 warnings |
| `node scripts/review-docs.mjs --repo /Users/apple/Progame/DGOS --phase planning --feature V1-FR-011 --json` | `0` | `SPEC_READY`，0 blockers、5 warnings |
| `node scripts/review-docs.mjs --repo /Users/apple/Progame/DGOS --phase planning --feature V1-FR-012 --json` | `0` | `SPEC_READY`，0 blockers、5 warnings |
| `node scripts/review-docs.mjs --repo /Users/apple/Progame/DGOS --phase planning --feature V1-FR-013 --json` | `0` | `SPEC_READY`，0 blockers、6 warnings |
| `node scripts/review-docs.mjs --repo /Users/apple/Progame/DGOS --phase planning --feature V1-FR-014 --json` | `0` | `SPEC_READY`，0 blockers、7 warnings |
| `node scripts/review-docs.mjs --repo /Users/apple/Progame/DGOS --phase planning --feature V1-FR-015 --json` | `0` | `SPEC_READY`，0 blockers、6 warnings |

### 未完成与证据边界

- `V1-FR-004/006/008` 没有被重新纳入 V1；其正式 E2E 编号、OpenAPI 和实现门禁仍由 V2/V4/V5 版本规划冻结。
- Agent、文件/知识库、管理员身份、Secret、Provider Account、连接测试、Audit/Governance 和 Usage/Quota 均无 DGOS 产品实现、构建或真实执行证据。
- 新增 E2E 用例 `V1-E2E-11..15` 只有规划矩阵，目标测试文件尚未创建；`docs-evidence.json` 继续为 `pending`、无 commit binding。
