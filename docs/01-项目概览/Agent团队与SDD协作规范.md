# Agent 团队与 SDD 协作规范

## 1. 文档定位

本文定义 DGOS 使用 Herdr 和 `spec-docs` 进行规格驱动开发时的 Agent 协作方式。它是项目协作规范，不是产品功能规格，不定义 DGOS 的业务规则、接口字段或数据库结构。

本文只回答以下问题：

- 用户通过哪个 Agent 进入团队；
- 文档、代码、测试和证据如何在 Agent 之间流转；
- 哪些工作可以并行，哪些工作必须串行；
- 新项目、旧项目、文档不完整项目和只写文档任务如何使用同一套团队；
- Agent 中断后如何依据项目事实继续工作。

业务规则仍以 `docs/` 中对应的权威文档为准。`spec-docs` 负责提供文档结构、任务包、追踪和证据方法，不替代 DGOS 的产品、架构和工程决策。

落地状态：角色配置与启动入口见仓库 `.herdr/README.md`、`.herdr/team.json`；部署记录见 `.herdr/deployment.md`。采用 Lead 主动派发和核验回执，未部署无人值守自动接续或自动重派服务。

## 2. 核心模型

团队采用“固定责任、动态工作包”的模型：

```text
用户
  ↓
Lead
  ├── Spec/Docs Planner
  ├── Worker A
  ├── Worker B
  ├── Worker C ...
  └── Verify
```

角色数量不等于固定 pane 数量。Lead 可以根据任务创建、复用或归档 Worker；用户只直接操作 Lead。Planner 和 Verify 是 Lead 调度的协作角色，Worker 是可扩展的执行槽位。

`spec-docs` 的工具和规则是所有角色共同遵守的工作协议，不分别扩展成产品经理、架构师、安全负责人、发布经理等大量常驻 Agent。

## 3. 不可违反的协作原则

### 3.1 文档是约束链，不是聊天背景

Agent 必须从项目文档、事实注册表、任务包和代码证据建立上下文。不得把某个 Agent 的聊天记忆作为唯一任务依据。

### 3.2 Lead 对全局负责，Planner 对文档执行负责

Lead 必须知道当前目标、切片、依赖、阻塞、验证和下一步；但不需要亲自撰写所有文档段落。Planner 可以起草和维护文档，Lead 负责确认口径和最终收敛。

### 3.3 同一事实只有一个权威来源

Agent 可以提出修改建议，但不能在多个文档中复制字段、状态、错误码、权限或完成度。发现冲突时先提交决策请求，不在代码或文档中长期兼容两套语义。

### 3.4 规格状态、实现状态、生命周期和交付范围分离

- `Draft / Ready / Frozen` 表示规格输入状态；
- `规划中 / 开发中 / 基础实现 / 本地验证 / 待验收 / 已完成 / 阻塞` 表示实现状态；
- `active / future` 表示交付范围；
- `active / planned / deprecated / archived` 表示事实生命周期。

代码存在、文档写完或本地测试通过，都不能单独改变其他状态维度。

### 3.5 证据不升格

静态核验、本地自动化、门禁环境和生产验证必须分别记录。规划命令不能写成已执行；mock 或 fixture 不能写成真实外部依赖证据；旧报告不能替代当前批次证据。

## 4. 四类角色

### 4.1 Lead

Lead 是唯一的用户入口、任务调度者和最终交付负责人。

#### 输入

- 用户目标或问题；
- 当前版本、功能、交付切片和实现状态；
- `docs-facts.json`、代码、测试和已有证据；
- Planner、Worker、Verify 的报告。

#### 主要职责

1. 判断任务属于哪个版本、功能和交付切片。
2. 选择本次工作模式。
3. 调度 Planner 生成上下文、任务包和文档变更。
4. 判断是否达到 Ready，或是否需要先冻结决策。
5. 拆分工作包，分配文件和契约边界。
6. 控制并行度，处理依赖、阻塞和返工。
7. 组织整合、验证和证据检查。
8. 确认功能主文档、实现状态和 facts 的最终回写。
9. 只在无法从权威文档推导时向用户请求业务决策。

#### Lead 不得做的事

- 以代码现状默默覆盖冻结需求；
- 为了推进任务自行选择冲突口径；
- 把 Worker 的自报结果当作验证证据；
- 把 future 能力计入当前版本；
- 让多个 Agent 同时修改同一份权威状态而不设整合边界。

### 4.2 Spec/Docs Planner

Planner 是 `spec-docs` 的主要执行角色，也是持续文档维护者，不只是开发前的评审者。

#### 主要职责

- 读取并整理项目权威文档；
- 生成 `context-pack` 和 `task-pack`；
- 创建或维护交付切片；
- 编写功能规格、技术设计、AC 和测试映射；
- 维护 OpenAPI、接口语义、数据契约和追踪关系的草案或变更；
- 执行 `review-docs`、`change-impact`、`spec-diff` 和 `traceability-report`；
- 进行旧项目兼容审计和文档迁移映射；
- 根据真实实现和验证结果回写文档；
- 发现冲突时向 Lead 提交决策请求。

#### 权限边界

Planner 可以写文档草案和已授权的文档变更，但不能未经 Lead 确认：

- 冻结新的业务规则；
- 改变当前版本范围；
- 宣布功能实现完成；
- 把测试计划改为测试通过；
- 以文档修改消除代码缺陷。

### 4.3 Worker

Worker 是通用执行角色，不固定绑定前端、后端、Provider 或某个产品领域。工作包决定 Worker 当前的专业范围。

Worker 可以执行：

- 代码实现；
- migration 和基础设施；
- 测试资产；
- 文档盘点和补写；
- 旧文档迁移；
- 接口、数据或现状审计；
- 指定的重构和修复。

Worker 必须遵守任务包的范围、输入、允许路径、禁止路径和验收条件。遇到公共契约、权限、状态机、删除、幂等、并发或安全语义冲突时，停止自行决策并报告。

Worker 的结果必须区分：

- 已修改的文件；
- 已执行的命令及真实结果；
- 提出的契约或文档变化；
- 未完成事项和限制；
- 需要 Lead 或 Planner 处理的决策。

### 4.4 Verify

Verify 负责阶段性检查、整合和证据，不只在项目最后运行。

#### 可以执行的工作

- 检查文档结构、链接、编号和追踪；
- 检查代码、契约、migration、测试和文档的一致性；
- 运行目标测试、集成测试和 E2E；
- 检查 AC 到测试资产、命令和证据的映射；
- 运行 `check-docs`、`review-docs`、`evidence-freshness` 和 `docs-gate`；
- 生成报告和 manifest；
- 标记阻塞、证据限制和需要返工的工作包。

Verify 不应为了让检查通过而偷偷重写业务实现或降低验收标准。发现问题后，返回 Lead，由 Lead 决定返工、拆分或创建修复工作包。

## 5. Lead 的工作模式

工作模式是 Lead 的运行方式，不是新的 Agent 角色。

### 5.1 Bootstrap：新项目初始化

适用于尚无完整 docs 体系的项目。

```text
Lead 确认项目目标、活跃版本和规模
Planner 建立文档骨架、范围、编号和公共入口
Verify 检查结构、链接、占位和初始化结果
```

没有明确功能输入时，不强行创建大量编码任务。

### 5.2 Adoption：旧项目接入

适用于已有代码和旧文档，但还没有稳定 SDD 体系的项目。

```text
Planner 做兼容审计和文档/代码盘点
Lead 确认保留、迁移和新建的边界
Planner 建立新旧路径、状态和编号映射
Verify 检查历史是否保留、当前权威是否明确
```

不删除历史材料，不把旧文档全部自动升格为当前权威。

### 5.3 Specification：只写或完善文档

适用于产品蓝图、版本规划、功能规格、技术设计、AC、E2E 或 ADR。

通常只需要：

```text
Lead + Planner + Verify
```

此模式默认只更新规格和追踪信息；若任务明确包含实现核查，可以依据已有真实证据校正实现状态，但不得把 Ready 文档写成已实现。

### 5.4 Incremental：文档不完整但推进独立切片

适用于整体项目仍为 Draft，但一个交付切片已经具备独立边界。

Lead 只要求目标切片及其直接依赖达到 Ready。无关功能的 Draft 不阻塞当前切片；影响当前切片的契约、权限、删除、幂等、并发和跨系统状态问题必须先处理。

### 5.5 Implementation：执行开发工作包

适用于规格已达到 Ready/Frozen 的切片。

```text
Planner 生成任务包
Lead 分配工作包
Worker 并行实现
Verify 在里程碑处检查
Lead 组织整合和回写
```

### 5.6 Reconciliation：代码先行或文档滞后

适用于已有代码，但需求、文档、测试和实现状态不一致。

先建立三类事实：

1. 已冻结需求；
2. 当前代码实际行为；
3. 代码、文档、测试之间的差距。

代码现状可以作为实现事实，但不能反向覆盖需求。之后由 Lead 决定继续实现、补文档、创建决策或返工。

### 5.7 Verification：验证和证据收敛

适用于已有实现，需要补测试、E2E、性能、发布或证据。

Verify 生成真实报告和 manifest；Planner 回写验证章节；Lead 根据证据更新实现状态和交付结论。

### 5.8 Maintenance：持续文档和治理维护

适用于开发过程中持续补充文档、修复索引、同步事实和更新追踪关系。

维护任务可以很小，不需要等待完整功能结束，也不需要每次启动全部 Agent。

### 5.9 Recovery：中断和恢复

适用于 Agent 失败、会话丢失、任务超时或工作区发生变化。

Lead 根据任务包、仓库实际状态、Worker 报告和已有证据重新建立上下文，替换失败 Worker，不依赖旧聊天记录继续。

## 6. 通用任务包

每个交付工作包至少包含以下信息：

```yaml
delivery_id: DGOS-DELIVERY-YYYY-NNN
mode: specification | implementation | reconciliation | verification
version: V1
slice_id: V1-CS-NNN
feature_ids:
  - V1-FR-NNN
objective: 本次唯一目标
in_scope:
  - 明确包含的工作
out_of_scope:
  - 明确不包含的工作
read_order:
  - AGENTS.md（如有）
  - docs/03-功能规格/功能开发流程.md
  - 目标功能和公共契约
allowed_paths:
  - 允许修改的路径或目录
blocked_by:
  - 未决决策、依赖或环境限制
acceptance:
  - AC01
commands:
  - node scripts/check-docs.mjs
writeback:
  - 需要同步的文档和证据
```

任务包是工作边界，不是新的业务权威来源。业务规则仍回到任务包列出的权威文档。

以上字段值为格式示意，派发前必须替换。纯文档初始化可将尚未分配的功能和切片标为不适用并说明原因，不为了运行团队而虚构产品功能 ID。业务变更使用已有或正式登记的切片 ID。

并行开发任务还需记录工作区路径、基线提交、任务包修订号和交付方式。每个写代码的 Worker 默认使用独立 Git worktree；共享目录仅用于明确无重叠的任务。数据库、服务端口和测试输出也应按工作包隔离，无法隔离的资源由 Lead 排队使用。Git 提交、合并、推送仍须遵守用户既有授权。

## 7. 标准交付报告

### 7.1 Planner 报告

```yaml
status: ready | draft | blocked
slice_id: V1-CS-NNN
objective: ...
authority_files:
  - ...
dependencies:
  - ...
parallel_work_packages:
  - id: WP-001
    boundary: ...
blocking_decisions:
  - ...
required_writeback:
  - ...
```

### 7.2 Worker 报告

```yaml
status: completed | partial | blocked
work_package: WP-001
files_changed:
  - ...
tests_added:
  - ...
commands_run:
  - command: pnpm test
    result: passed | failed
    evidence: ...
implementation_facts:
  - ...
contract_changes_proposed:
  - ...
open_risks:
  - ...
docs_to_update:
  - ...
```

### 7.3 Verify 报告

```yaml
status: passed | failed | partial | blocked
scope:
  - WP-001
checks:
  - command: node scripts/check-docs.mjs
    result: ...
evidence_level: static | local | gate | production
verified:
  - ...
limitations:
  - ...
return_to_lead:
  - ...
```

报告只陈述实际执行和观察到的事实。没有执行的命令必须标记为未执行。

## 8. 文档写入权限

为避免多个 Agent 同时修改权威文档，采用以下边界：

| 文档内容 | 主要写入者 | Lead 职责 |
| --- | --- | --- |
| 产品范围和交付边界 | Planner | 确认范围和决策 |
| 功能规格、技术设计、AC | Planner | 批准进入 Ready/Frozen |
| 代码和测试 | Worker | 接受结果并安排整合 |
| 实现事实和验证建议 | Worker / Verify | 判断能否回写 |
| 测试报告、manifest、证据 | Verify | 检查等级和限制 |
| 版本实现状态 | Lead | 依据真实证据统一更新 |
| `docs-facts.json` 派生字段 | Planner 执行，Lead 确认 | 确保与权威来源一致 |
| 冻结决策和重大变更 | Planner 起草 | Lead 或用户确认 |

同一份权威文档在同一时段只允许一个主动写入者。其他 Agent 提交建议或报告，不直接覆盖正在整合的内容。

## 9. 并行规则

### 可以并行

- 输入契约已经冻结；
- 工作包有清晰的文件和模块边界；
- 不修改同一 migration 序列或状态机；
- 不同时写同一公共契约；
- 每个工作包有独立测试和回写目标。

### 必须串行

- 公共字段、枚举、状态或错误码尚未冻结；
- 权限、秘密、删除、幂等、并发或资金语义存在冲突；
- 多个 Agent 会修改同一核心 repository 或 migration；
- 需要根据实现结果重新决定产品行为；
- 最终整合、全量验证和实现状态回写。

并行度由 Lead 根据整合成本控制。大型任务优先增加 Worker 槽位，不增加新的管理层级。

## 10. 决策和阻塞

Agent 发现冲突时使用以下流程：

```text
Worker 或 Verify 发现冲突
  ↓
提交证据和影响面
  ↓
Planner 整理选项、建议和受影响切片
  ↓
Lead 判断是否已有决策
  ↓
无既有决策时请求用户确认
  ↓
写入冻结决策并同步权威文档
  ↓
恢复受影响工作包
```

阻塞只应作用于受影响的切片。无关功能可以继续，但不得绕过影响当前切片的关键未决项。

上述用户确认适用于超出既有授权、无法从已确认目标与约束推导的业务选择。Lead 可以依据既有决策处理冲突，在授权范围内决定普通实现细节；不因缺少独立决策编号就将所有技术选择升级给用户。

## 11. 完成判断

四类结果必须分开：

```text
Worker 完成
  ≠ 工作包已整合

工作包已整合
  ≠ 功能已验证

功能已验证
  ≠ 版本已发布

文档已 Ready
  ≠ 功能已实现
```

对于包含代码实现的交付切片，Lead 只有在以下内容都被真实确认后，才能结束本次约定的交付范围：

- 目标和范围没有越界；
- 代码、migration 和测试已经整合；
- 相关 AC 有对应测试和真实结果；
- 文档、公共契约和追踪关系已同步；
- 实现状态与证据等级一致；
- 遗留风险和未完成外部依赖已明确记录。

结束本次工作不等于功能整体“已完成”；尚缺该功能验收所需证据时，功能保持相应的部分实现、本地验证或阻塞状态。

纯文档任务按另一组完成条件验收：约定文档已完成、权威来源与稳定引用一致、目标范围内的结构和语义审查已完成、未决项及其阻塞范围明确。代码、migration 和运行测试不适用时注明原因；未解决的关键规格问题仍保持 Draft，不得以结构检查通过代替 Ready。

## 11.1 持续任务记录与恢复

每个大型任务只维护一份轻量调度记录，由 Lead 更新；Worker 和 Verify 提交各自报告。记录保存任务目标、工作包 ID、负责人、任务包修订号、工作区、基线、依赖、最近进展、报告路径和下一步，不复制业务规则或功能实现状态。

工作包调度状态采用 `queued → working → review → integrated → closed`，异常使用 `blocked`。这些状态只说明任务流转，不写入功能实现状态枚举。纯文档工作包的 `integrated` 表示文档变更已汇总。

- 派发后确认目标 Agent 收到对应工作包和修订号；Herdr 显示 idle 或 done 不能单独作为任务成功证据。
- 超时或失联时，先核对原 Agent、进程及工作区，再决定是否重试；不直接重复派发同一写入任务。
- 替换 Worker 前保留未提交修改并明确移交；确认旧执行者不再写入，才转交文件所有权。
- 契约发生变化时，更新任务包修订号并通知受影响 Worker；旧修订产物须重新核对。
- Lead 中断后，从调度记录、仓库和报告恢复，先核实仍在运行的任务，再继续派发。

调度记录的存储位置和 Herdr 通信适配在部署时确定。自动执行这些规则需要实现回执、进展检查和恢复入口，并通过中断演练；仅有角色提示词不能保证持续运行。

## 12. Herdr 使用原则

- 用户只与 Lead 交互；
- Lead 可以创建、复用、暂停和归档其他 Agent；
- Worker 不需要长期保留项目全局上下文；
- 新 Agent 通过任务包接续，而不是通过读取旧聊天记录接续；
- 角色是责任边界，不要求一一对应固定 pane；
- 当前 workspace 的布局不构成本规范的一部分；
- 当前客户端固定为 Lead/Planner 使用 OpenCode，Worker-A/B/C 和 Verify 使用 Codex；显示名无数字前缀，映射维护在 `.herdr/team.json`。增减槽位按任务需要安排，客户端和模型调整遵守用户指定。

## 13. 与 spec-docs 的对应关系

| 协作环节 | 主要使用的能力 |
| --- | --- |
| 新项目或旧项目接入 | `init-docs`、`compatibility-audit`、`status` |
| 生成最小任务上下文 | `context-pack`、`task-pack` |
| 判断是否可开工 | `review-docs`、`docs-gate --phase planning` |
| 变更影响分析 | `change-impact`、`spec-diff`、`policy-calibrate` |
| 事实和契约导航 | `facts-sync`、`contract-index`、`traceability-report` |
| 开发和验证回写 | 实现状态、功能主文档、测试报告和 manifest |
| 证据检查 | `evidence-freshness`、`docs-gate --phase development` |
| 发布判断 | `docs-gate --phase release` |

这些工具是工作流中的检查点，不是额外的 Agent 角色。工具输出也不能替代业务决策或真实测试。

## 14. 最小运行循环

```text
用户提出目标
  ↓
Lead 识别模式和范围
  ↓
Planner 生成上下文、任务包和文档计划
  ↓
Lead 确认 Ready、依赖和并行边界
  ↓
Worker 执行工作包
  ↓
Verify 做阶段性检查和证据核验
  ↓
Lead 组织整合和冲突处理
  ↓
Planner / Verify 协助回写
  ↓
Lead 更新权威状态并向用户报告
```

任何阶段都可以回到 Planner 补规格、回到 Worker 修复、回到 Verify 重新验证，或进入 Recovery 模式恢复中断任务。流程是循环的，不要求所有工作从同一个起点开始。
