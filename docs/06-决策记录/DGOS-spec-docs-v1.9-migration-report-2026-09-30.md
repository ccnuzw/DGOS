# DGOS spec-docs v1.9.0 迁移审计报告

## 1. 报告边界

| 项目 | 内容 |
| --- | --- |
| 项目 | DGOS |
| 目标 Skill | `/Users/apple/.codex/skills/spec-docs`，v1.9.0 |
| 审计日期 | 2026-09-30 |
| 工作目录 | `/Users/apple/Progame/DGOS` |
| Git 状态 | 当前目录不是 Git 仓库；没有可用的 branch、commit、提交历史或提交绑定证据 |
| 迁移原则 | 保留旧文档和稳定 ID；不删除、不整体移动、不把规划或参考资料升格为实现事实 |
| 当前结论 | 已有旧版 M 档文档体系；v1.9.0 facts、契约索引和 SDD 证据链尚未完整启用；当前不能宣称 SPEC_READY、IMPLEMENTATION_READY 或可发布 |

本报告记录第一阶段只读盘点。后续阶段以追加章节方式记录，不覆盖本章的原始结果。本文不是业务规则的第二权威来源；业务规则仍回到各文档列出的权威文件。

## 2. 第一阶段命令与原始结果

| 命令 | 结果 | 关键结果 |
| --- | ---: | --- |
| `node /Users/apple/.codex/skills/spec-docs/scripts/spec-docs.mjs status --dir /Users/apple/Progame/DGOS --json` | 0 | 已初始化；tier=`m`；activeVersion=`V1`；facts `configured=false/enabled=false/present=false/valid=true`；gate 已配置 |
| `node /Users/apple/.codex/skills/spec-docs/scripts/compatibility-audit.mjs --repo /Users/apple/Progame/DGOS --json` | 0 | 0 findings、0 files；只读兼容审计未发现可识别的旧状态复制 |
| `node /Users/apple/.codex/skills/spec-docs/scripts/contract-index.mjs --dir /Users/apple/Progame/DGOS --json` | 0 | 发现 HTTP OpenAPI 与 page 契约；OpenAPI operation 的 `feature_id` 当前均为空，需迁移回写 |
| `node /Users/apple/.codex/skills/spec-docs/scripts/check-docs.mjs --repo /Users/apple/Progame/DGOS --strict` | 1 | 6 个结构错误，0 warnings |
| `node /Users/apple/.codex/skills/spec-docs/scripts/review-docs.mjs --repo /Users/apple/Progame/DGOS --phase planning --json` | 1 | `SDD_NOT_READY`；39 errors、141 warnings、126 blockers、6 个 V1 feature scope |

只读命令输出已在本次运行期间保存到临时执行目录；本报告保留摘要和真实退出码。后续阶段会重新运行项目内副本并在本文追加完整验证记录。

### 2.1 严格结构检查的真实错误

| 文件 | 缺口 |
| --- | --- |
| `docs/02-产品与版本/产品蓝图.md` | 核心业务概念缺少结构化视图或必需列：概念 ID、概念、定义、边界与易混项、首次适用版本 |
| `docs/02-产品与版本/产品蓝图.md` | 成功标准缺少结构化视图或必需列：成功标准 ID、可观察结果、指标/口径、关联能力或功能、验证方式与证据、责任人、状态 |
| `docs/02-产品与版本/当前版本/V1-产品需求.md` | 非功能需求缺少编号、目标与阈值、基线、测量窗口/环境、负责人、验证方式与证据 |
| `docs/02-产品与版本/当前版本/V1-产品需求.md` | 交付顺序与依赖缺少阶段、功能 ID、前置、可验收产物、AC、E2E、负责人、完成定义/证据、后置能力 |
| `docs/02-产品与版本/当前版本/V1-产品需求.md` | 发布门禁缺少编号、条件、责任人、阻塞级别、证据类型与位置、失败处理 |
| `docs/04-技术架构/当前版本/V1-数据模型.md` | 数据公共契约缺少“迁移顺序与验证”结构或明确不适用理由 |

### 2.2 规划审查的边界

`review-docs` 已识别的主要问题包括：产品蓝图和 V1 PRD 结构化表格不足；多个 V1 功能缺少可审计的依赖、字段规则、成功响应、幂等、并发和观测；AC 缺少可观察终态或失败无副作用断言；AC 目标测试文件尚不存在。审查结果不把这些缺口改写成通过，也不创建虚构测试资产。

## 3. 当前目录结构

DGOS 当前保留完整的旧版编号目录，根目录为 `docs/`：

```text
docs/
  01-项目概览/          工程环境、Git 文档规范
  02-产品与版本/        产品蓝图、路线图、V1 入口、V2-V6 规划
  03-功能规格/          功能流程、V1 功能规格、V2/V4/V5 规划登记稿
  04-技术架构/          架构、接口、OpenAPI、数据、路由、运行时契约
  05-测试与发布/        测试策略、E2E、性能、发布、回滚、恢复、证据
  06-决策记录/          冻结决策、ADR、文档审计、变更记录
  90-参考资料/          DX OS、视频、截图、Provider 外部研究
  99-历史归档/          README 和文档迁移映射
```

第一阶段统计：`docs/` 下约 106 个 Markdown 文件；`03-功能规格/V1` 下 19 个 Markdown 文件；V2 2 个、V4 2 个、V5 3 个功能/技术设计文件；V2-V6 各有独立版本规划文档。当前没有项目源码、测试资产或 migration 目录。

## 4. 当前脚本、policy 和证据配置

### 4.1 根 policy

当前 `docs-policy.json`：

| 字段 | 当前值 | 迁移判断 |
| --- | --- | --- |
| `root` | `docs` | 与实际根目录一致，保留 |
| `tier` | `m` | DGOS 涉及桌面、权限、AI、Provider、异步任务、发布回滚；目标治理 profile 应为 `regulated`/L 档，但切换不等于功能 Ready |
| `activeVersion` | `V1` | 与当前范围一致 |
| `projectName` | `DGOS` | 与项目一致 |
| `requireDeliveryMetadata` | `true` | V1 与未来功能已有部分元数据；需继续校验全部规划入口 |
| `quality.enabled/strict` | `true/true` | 已启用质量检查 |
| 根级 `strict` | `false` | 当前调用 `--strict` 才阻断；迁移期间保留并逐步校正错误 |
| `facts` | 未配置 | 第一阶段确认 facts 未启用；第二/三阶段补齐并显式启用 |
| `contracts` | 未形成 v1.9 非 HTTP source registry | Driver、Skill、MCP、Provider、AI Task、页面和 migration 需登记来源 |

### 4.2 项目内脚本

当前 `scripts/` 只有：

- `scripts/check-docs.mjs`
- `scripts/docs-gate.mjs`
- `scripts/build-doc-viewers.mjs`

当前缺少 v1.9 要求的 `review-docs.mjs`、`context-pack.mjs`、`task-pack.mjs`、`spec-docs.mjs`、`compatibility-audit.mjs`、`facts-sync.mjs`、`contract-index.mjs`、`spec-diff.mjs`、`evidence-freshness.mjs`、`traceability-report.mjs`。现有脚本没有统一的 v1.9 release metadata；必须先执行 `init-docs --refresh` 更新脚本副本，不能以旧脚本结果代替新版本验证。

### 4.3 现有 gate 与证据限制

`docs-gate.json` 已存在，但 `requireCommitBinding=true`。`docs-evidence.json` 仍是模板值，报告路径未指向真实报告，审批为空，且其中的 `commit` 不能在本项目中被验证。DGOS 不是 Git 仓库，因此：

- 不生成、不填写伪造 commit SHA；
- 不把 workspace snapshot 当作提交绑定；
- 不把 local/mock 结果写成 staging 或 production-gate；
- 发布和开发证据必须显式写 `commit_binding: absent`（或等价限制）；
- 需要真实提交绑定的 gate 保持 `Pending`/`Blocked`。

## 5. V1-V6 文档分布与边界

### 5.1 V1 当前输入

V1 当前入口和实现状态位于：

- `docs/02-产品与版本/当前版本/V1-版本总览.md`
- `docs/02-产品与版本/当前版本/V1-产品需求.md`
- `docs/02-产品与版本/当前版本/V1-实现状态.md`
- `docs/03-功能规格/V1/00-V1需求编号.md`
- `docs/03-功能规格/V1/00-V1需求追踪矩阵.md`
- `docs/03-功能规格/V1/功能查找表.md`
- `docs/03-功能规格/V1/技术设计索引.md`
- `docs/06-决策记录/V1-冻结决策.md`

当前实现状态表明确记录 V1 功能为“规划中”，并明确没有 DGOS 产品源码、构建或可执行测试。首发候选功能为 `V1-FR-001`、`V1-FR-002`、`V1-FR-003`、`V1-FR-005`、`V1-FR-007`、`V1-FR-009`；`V1-FR-004/006/008` 的实现和交付不计入 V1 当前统计。

### 5.2 后续版本

| 版本 | 当前入口 | 当前边界 |
| --- | --- | --- |
| V2 | `docs/02-产品与版本/后续版本/V2-规划.md`；V2 功能登记稿 | 项目、基础画布和图编辑；`delivery_scope=future`、`planning_only=true` |
| V3 | `docs/02-产品与版本/后续版本/V3-规划.md` | 画布执行、运行快照、结果回写；规划骨架，无当前实现统计 |
| V4 | `docs/02-产品与版本/后续版本/V4-规划.md`；V4 资产功能登记稿和技术设计 | 表格、资产、授权、引用/复制导入；`delivery_scope=future`、`planning_only=true` |
| V5 | `docs/02-产品与版本/后续版本/V5-规划.md`；V5 插件/3D 登记稿和技术设计 | 3D 导演台、Canvas 插件与模板；`delivery_scope=future`、`planning_only=true` |
| V6 | `docs/02-产品与版本/后续版本/V6-规划.md` | 组织协作、生态分发、批量运行、移动端；尚无正式功能编号、可编码接口或实现证据 |

已有 V2/V4/V5 功能规格文件是稳定编号的历史设计输入例外，不能因为存在文件就视为已进入 V1。后续版本独立规划文档中的 `planning_only`、`delivery_scope=future` 和交付切片必须在 facts registry 中保持一致。

## 6. 当前权威来源候选

以下是盘点时识别的权威来源候选，不代表所有内容已达到 Ready：

| 事实 | 候选权威来源 | 当前限制 |
| --- | --- | --- |
| 产品范围与版本边界 | `docs/02-产品与版本/产品蓝图.md`、`版本路线图.md` | 产品蓝图缺少 v1.9 要求的概念所有权和成功标准结构化表 |
| V1 体验、交付和排除项 | `docs/02-产品与版本/当前版本/V1-版本总览.md`、`V1-产品需求.md` | 交付依赖、NFR、发布门禁表需结构化补齐 |
| 当前实现状态 | `docs/02-产品与版本/当前版本/V1-实现状态.md` | 当前全部为规划中；不能从设计文档继承完成状态 |
| 功能行为、AC | 各功能主文档 | 多功能存在契约、依赖、可观察终态、失败无副作用和测试资产缺口 |
| HTTP 字段 | `docs/04-技术架构/当前版本/V1-openapi.yaml` | OpenAPI operation 尚未通过机器索引关联功能 ID；schema 仍是 Draft |
| HTTP 语义、权限和失败边界 | `docs/04-技术架构/当前版本/V1-接口契约.md` | 逐操作表已有功能列，但机器索引尚未解析关联；鉴权/错误/幂等仍未完整冻结 |
| 数据逻辑模型 | `docs/04-技术架构/当前版本/V1-数据模型.md` | 逻辑模型 Draft；无 migration/DDL/执行证据 |
| 架构取舍 | `docs/06-决策记录/V1-冻结决策.md`、`docs/06-决策记录/ADR/` | 仍需将待冻结工程输入分别关联到事实和切片 |
| E2E 业务条件 | `docs/05-测试与发布/端到端验收/V1-端到端验收规范.md` | 当前执行矩阵均未执行；需核实矩阵、规范双向映射 |
| E2E 执行证据 | `docs/05-测试与发布/端到端验收/验证证据.md`、`报告/` | 当前无有效批次、报告或 manifest |
| 外部研究 | `docs/90-参考资料/` | 只作为研究输入，不能成为 DGOS 当前契约、实现或发布证据 |

## 7. 旧版状态写法、重复事实与潜在冲突

兼容审计在第一阶段返回 0 findings，但这只表示脚本没有识别到明确的旧状态复制，不表示全体系已经消除语义重复。当前仍需迁移/治理：

1. `V1-实现状态.md` 是实现状态唯一来源，功能规格和索引应只保留规格状态/范围链接；后续 facts registry 的 `implementation_status` 必须与该表和真实证据一致。
2. V1 产品总览、V1 PRD、功能索引、功能查找表、追踪矩阵和接口契约同时表达首发范围，需用稳定 ID、`delivery_scope` 和 authority 链接避免重复维护。
3. OpenAPI 机器索引目前无法得到 `feature_id`；这与 `V1-接口契约.md` 的人工映射形成两种导航视图，需要补 source mapping 或索引解析规则。
4. OpenAPI 当前 operation 集合缺少产品场景已声明的 APP 安装/启动、AI Task 取消、artifact 读取、身份会话、权限撤销等可调用契约；这些应保持 Draft/契约缺口，不得为了索引完整而虚构 schema。
5. `V1-接口契约.md`、`V1-数据模型.md` 和功能文档分别描述权限、状态、幂等、删除、异步恢复和 Provider 失败边界；它们需要由公共契约和冻结决策收敛，不能让 facts registry 复制规则。
6. 历史版本迁移映射已存在，但仅覆盖部分旧 V1 路径；需要补齐旧功能 ID、E2E 编号、规划登记稿和未来版本边界的迁移映射。
7. `90-参考资料` 含 DX OS、截图、视频和旧项目研究；这些内容必须继续保留参考属性，不能因文字中出现协议、路径或版本而被纳入 DGOS 公共契约。

## 8. 缺失或未验证的能力

| 能力 | 当前观察 | 状态 |
| --- | --- | --- |
| 功能规格 | V1 有 6 个当前 scope 功能文档，部分契约字段/依赖/AC 结构未满足 v1.9 审查 | `SDD_NOT_READY` |
| HTTP 契约 | 有 V1 OpenAPI 和人工接口契约；机器索引 operation→功能为空，部分 V1 场景所需 operation 缺失 | `Draft/Pending` |
| Driver/Skill/MCP/AI Task/Provider 机器契约 | 主要存在于 Markdown 语义文档和 OpenAPI 目标描述，未登记完整机器 source | `Pending` |
| 数据契约 | 有 Draft 逻辑实体和不变量，但无 migration/DDL/物理约束 | `Draft` |
| E2E | 规范、矩阵和执行空间存在；目标测试资产不存在，当前无批次 | `EVIDENCE_PENDING` |
| 性能与容量 | 场景矩阵存在，但无已批准 profile、实测值和 manifest | `EVIDENCE_PENDING` |
| 发布 | 部署、回滚、恢复、检查清单和证据规范存在；无真实报告、制品、审批或提交绑定 | `BLOCKED` |
| 代码与测试 | 当前工作目录没有 DGOS 产品源码、测试文件或 migration | `IMPLEMENTATION_PENDING` |
| Git/commit | 目录不是 Git 仓库 | `commit_binding: absent`，发布 gate 必须阻断 |

## 9. 当前阻断项

1. 事实注册表不存在且未启用，无法由 v1.9 工具提供稳定的机器导航、切片绑定和关系传播。
2. 项目内缺少 v1.9 脚本副本，无法依赖项目内统一入口执行 facts sync、contract index、traceability、evidence freshness 和 spec diff。
3. 严格结构检查的 6 个错误未修复。
4. planning review 为 `SDD_NOT_READY`，包含 126 个 blockers；未达到全局规格 Ready。
5. OpenAPI operation 尚未关联功能 ID，且当前 OpenAPI/接口契约存在缺失操作。
6. DGOS 无源码、测试、migration、构建和运行环境，所有 V1 实现状态只能保持“规划中”。
7. 无 Git 仓库，无法满足当前 docs-gate 的提交绑定要求；不得伪造 SHA 或审批摘要。
8. V1 AC/E2E 目标测试资产未创建，不能生成通过报告。
9. 产品蓝图、V1 PRD、数据模型缺少 v1.9 review 所需结构化表和迁移验证闭环。

## 10. 推荐迁移批次

| 批次 | 范围 | 目标 | 不应宣称 |
| --- | --- | --- | --- |
| M1 | 工具和配置 | 刷新项目脚本；保留 docs root/policy；补 `docs-facts.json`、contracts source、gate evidence 限制 | 不宣称事实已完成 |
| M2 | V1 平台基础 | FR-001/002/003、主体/权限、应用 manifest/安装、Skill/MCP 机器契约和 AC 依赖 | 不宣称可运行或已验收 |
| M3 | V1 AI 纵向切片 | FR-007 Provider、FR-005 文本 AI Task、模型目录、SSE、Artifact 读取契约 | 不宣称真实 Provider 证据 |
| M4 | V1 助手切片 | FR-009 动作目录、计划/确认/执行/取消、审计和设置写入公共契约 | 不宣称高风险动作已安全验证 |
| M5 | E2E/性能/发布 | 创建真实测试资产和受控环境，追加报告与 manifest；在可用代码版本下运行 | 无提交绑定时不进入 release-ready |
| M6 | V2-V6 迁移 | 逐版本维护规划、交付切片和关系；正式门禁前才拆可编码功能 | 不把已写文档视为实现 |

## 11. 不允许自动判断的业务问题

- DGOS manifest 的信任根、签名/来源、审核状态机和预装卸载字段的最终 schema。
- 每个助手动作的风险级别、确认/增强确认规则、权限 scope、幂等和取消边界。
- Provider 验证失败、既有任务收敛、目录刷新 stale 和新任务准入之间的原子状态转换。
- Identity/Session 物理字段、正式账号进入 V2 的迁移策略和会话撤销传播。
- RetentionSweep、AuditEvent、Artifact 引用闭包的物理实现、DDL、备份恢复和清理责任。
- HTTP 鉴权、错误码、幂等键、并发版本和桌面 IPC/SDK schema。
- 真实 Provider、MCP、Skill、Agent、外部权限和生产环境的可用性与证据等级。
- V2-V6 的正式功能编号、接口和 E2E 编号；当前规划文档中的拟定编号不能自动冻结。

## 12. 第一阶段迁移结论

第一阶段完成了只读盘点并建立了本报告。DGOS 当前具备清晰的 V1 与 V2-V6 文档分层和真实的“无代码、无测试、无 Git 绑定”限制，但尚未达到 spec-docs v1.9.0 的 SDD Ready 或证据就绪要求。下一步只能在保留既有文档和稳定 ID 的前提下刷新工具、补齐事实导航、修复结构错误、建立契约索引和按切片推进；所有未验证状态继续保持 `Draft`、`Pending`、`IMPLEMENTATION_PENDING` 或 `EVIDENCE_PENDING`。

## 13. 第二阶段：工具升级与存量接入结果

### 13.1 工具刷新

执行：

```text
node /Users/apple/.codex/skills/spec-docs/scripts/init-docs.mjs --target /Users/apple/Progame/DGOS --refresh
```

退出码：`0`。

项目内已更新 v1.9.0 副本：`check-docs.mjs`、`review-docs.mjs`、`policy-utils.mjs`、`change-impact.mjs`、`policy-calibrate.mjs`、`context-pack.mjs`、`facts-utils.mjs`、`traceability-report.mjs`、`evidence-freshness.mjs`、`spec-diff.mjs`、`compatibility-audit.mjs`、`spec-docs.mjs`、`task-pack.mjs`、`facts-sync.mjs`、`contract-index.mjs`、`golden-sample.mjs`、`docs-gate.mjs`。命令输出确认没有修改 `docs/` 和配置文件。

### 13.2 adopt dry-run 与执行

dry-run：

```text
node /Users/apple/.codex/skills/spec-docs/scripts/init-docs.mjs --target /Users/apple/Progame/DGOS --name "DGOS" --version V1 --profile regulated --adopt --dry-run
```

退出码：`0`。计划新增 6 个文件，保留 89 个同名文件：facts registry、变更切片模板/README 和一组功能文档模板。

实际 adopt 同参数但去掉 `--dry-run`，退出码：`0`。没有使用 `--force`，没有删除或覆盖既有业务文档，没有整体移动 `docs/`。新生成的占位模板被明确命名为模板，并保留占位警告；它们不被当作业务事实。

`docs-policy.json` 已切换为 `profile=regulated`、`tier=l`，保留 `root=docs`、`activeVersion=V1`；facts、change governance 和现有门禁配置已登记。

## 14. 第三阶段：事实注册表迁移结果

### 14.1 facts sync

只读检查：

```text
node scripts/spec-docs.mjs facts-sync --dir /Users/apple/Progame/DGOS --json
```

首次退出码：`0`，发现 11 项模板漂移/缺失，原因是 adopt 初始模板只登记 `V1-FR-001`，且旧功能使用描述性切片值。

显式写入：

```text
node scripts/spec-docs.mjs facts-sync --dir /Users/apple/Progame/DGOS --write --json
```

退出码：`0`。随后统一将功能 frontmatter 和后续版本规划的 `delivery_slice` 改为稳定切片 ID：`V1-platform`、`V1-ai-task`、`V1-assistant`、`V2-foundation`、`V3-workflow`、`V4-assets`、`V5-ecosystem`、`V6-collaboration`。

facts sync 仍会把 `V1-FR-004/006/008` 报为 orphan，因为该脚本只扫描 active V1 feature directory，而这三个稳定编号故意位于 V2/V4/V5 future 规划空间。它们已在 registry 中保留为 `lifecycle=planned`、`delivery_scope=future`，没有被移入 V1 统计；这是工具扫描边界提示，不是关系图错误。

### 14.2 registry 内容

当前 `docs-facts.json` 登记：

| 类型 | 数量 | 结论 |
| --- | ---: | --- |
| feature | 9 | V1 active 六项；V2/V4/V5 future 三项，稳定 ID 保留 |
| nfr | 7 | 全部 active、planned，权威来源已登记 |
| release_gate | 3 | 全部 blocked/pending，不计为通过 |
| acceptance | 7 | V1 当前 E2E，全部 planned、无 evidence |
| operation | 35 | OpenAPI 当前 35 个 operation，全部 planned |
| entity | 13 | V1 逻辑实体导航，不表示物理表已存在 |
| decision | 15 | 冻结决策和 ADR 导航，D031 supersedes D022 |
| migration | 4 | M0-M3 规划/blocked，无 migration 文件 |

事实关系图包含 `contains`、`defines_operation`、`reads_entity`、`writes_entity`、`verified_by`、`decided_by`、`supersedes` 和 `depends_on`。最终 `traceability-report --profile sdd --strict`：退出码 `0`，facts/slices/authority/relations 覆盖率均为 `1`，0 errors、0 warnings。

## 15. 第四阶段：版本边界与结构校正

已完成的文档校正：

- V1 实现状态继续作为唯一实现状态来源；所有六个 V1 候选功能保持 `规划中`，没有因为设计文档存在而升格。
- V2/V4/V5 稳定编号登记稿继续保留，但 `delivery_scope=future`、`planning_only=true` 和 future 切片保持隔离；V3/V6 保持独立规划入口。
- 产品蓝图补齐概念 ID、创建/拥有者、概念关系、权威定义、版本责任人和成功标准表；非功能目标补齐质量属性、目标/待冻结条件、适用版本、验证和权威约束。
- V1 PRD 补齐逐交付单元依赖闭环、NFR 审计列和发布门禁责任/阻塞/证据/失败处理列；未知阈值和证据明确保持 `未测`/`Pending`。
- V1 数据模型将未来实体移到“未来实体注册表”，V1 核心实体表不再混入 V2-V6 交付版本标识；迁移表补齐回滚/失败处理和负责人。
- `check-docs --strict` 最终输出 0 errors、3 warnings；3 个 warning 仅来自新生成模板占位内容，没有业务文档结构错误。

## 16. 第五阶段：契约与 E2E 空间校正

### 16.1 HTTP/OpenAPI

为 V1 OpenAPI 的 35 个 `operationId` 增加了机器可读的 `x-tag-feature` 和 `x-tag-implementation-status: planned`。映射仅表达所属功能和规格阶段，不表达实现完成。

最终：

```text
node scripts/contract-index.mjs --dir /Users/apple/Progame/DGOS --strict --json
```

退出码：`0`；`operations=35`、`mapped_operations=35`、`operation_mapping=1`，0 errors、0 warnings。

Driver、Skill、MCP、Provider、AI Task 的完整独立机器 schema、APP 安装/启动、Artifact 读取、身份会话、权限撤销和 AI Task cancel 仍是缺失契约或 Draft；没有为了提高索引覆盖率而生成虚假 schema。

### 16.2 E2E

E2E 规范的 7 个当前用例均具备独立 Given/When/Then 正文；用例矩阵补齐功能 ID、AC、断言事实类型、环境、日期、代码版本、命令、证据路径和限制列。所有行保持 `未执行`，代码版本明确为“无构建标识；`commit_binding: absent`”，目标测试资产均未创建。

项目内 `review-docs.mjs` 同步修复了 v1.9 E2E 正文解析中的多行 `$` 截断缺陷；该修复只影响检查器章节边界解析，不改变业务文档结论。

## 17. 第六阶段：证据空间与 Git 限制

`docs-evidence.json` 已从模板占位改为明确状态：`status=pending`、`commit=null`、`commit_binding=absent`、审批和报告路径为 null，并记录无源码、无构建、无测试、无 migration、无 Git 的限制。没有生成开发、E2E、性能或发布报告，也没有伪造审批、authority digest、制品或 SHA。

```text
node scripts/evidence-freshness.mjs --dir /Users/apple/Progame/DGOS --json
```

退出码：`0`；evidence=0、valid=0、stale=0、invalid=0。0 evidence 不是通过，只表示当前没有可评估证据。

## 18. 第七阶段：最终验证

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `node scripts/check-docs.mjs --repo /Users/apple/Progame/DGOS --strict` | 1 | 0 errors、3 template placeholder warnings；严格模式将 warning 作为非零退出 |
| `node scripts/review-docs.mjs --repo /Users/apple/Progame/DGOS --phase planning --json` | 1 | `SDD_NOT_READY`；0 errors、136 warnings、82 blockers、6 V1 features |
| `node scripts/traceability-report.mjs --dir /Users/apple/Progame/DGOS --profile sdd --strict` | 0 | 0 errors、0 warnings；100% facts/slice/authority/relation coverage |
| `node scripts/contract-index.mjs --dir /Users/apple/Progame/DGOS --strict --json` | 0 | 35/35 OpenAPI operations mapped |
| `node scripts/evidence-freshness.mjs --dir /Users/apple/Progame/DGOS --json` | 0 | 无 evidence；没有伪造 freshness 结论 |
| `node scripts/spec-diff.mjs --dir /Users/apple/Progame/DGOS --version V1 --json`（首次） | 0 | baseline 缺失作为 JSON error 返回但非 strict 退出为 0 |
| `node scripts/spec-diff.mjs --dir /Users/apple/Progame/DGOS --version V1 --write-baseline` | 0 | 写入 `.spec-docs/baselines/V1.json` |
| `node scripts/spec-diff.mjs --dir /Users/apple/Progame/DGOS --version V1 --json`（基线后） | 0 | 0 changes、0 errors、0 unbound changes |
| `node scripts/docs-gate.mjs --repo /Users/apple/Progame/DGOS --phase planning --json` | 1 | 82 SDD review errors；缺契约闭环、AC 证据和真实测试资产 |
| `node scripts/spec-docs.mjs status --dir /Users/apple/Progame/DGOS --json` | 0 | profile=`regulated`、tier=`l`、facts enabled/present/valid，gate configured |

九个功能 task 包均已执行：`V1-FR-001/002/003/004/005/006/007/008/009`，每个命令退出码均为 `0`。task 包是只读上下文，不是实现或验收证据。

## 19. 最终治理结论

### 19.1 状态

- `SDD_NOT_READY`：planning review 的 82 个阻断项未清零。
- `SPEC_READY`：当前没有任何 V1 功能达到全局 SPEC_READY；六个候选功能均仍 Draft 或存在阻断契约。
- `IMPLEMENTATION_PENDING`：DGOS 没有产品源码、构建、测试或 migration；V1 实现状态全部为规划中。
- `EVIDENCE_PENDING`：facts 中 evidence 为空，E2E/性能/发布报告不存在，commit binding absent。
- 不能宣称 `RELEASE_READY` 或 `IMPLEMENTATION_READY`。

### 19.2 当前 V1 可开发功能

当前**没有**满足 v1.9 planning Ready、公共契约和 AC 闭环的可直接开发功能。V1 候选交付范围仍是：

`V1-FR-001`、`V1-FR-002`、`V1-FR-003`、`V1-FR-005`、`V1-FR-007`、`V1-FR-009`。

它们可以继续做规格收敛和任务分解，但不能以当前状态进入实现/发布门禁。

### 19.3 当前 V1 不能开发的功能及原因

| 功能 | 原因 |
| --- | --- |
| `V1-FR-001` | 缺契约依赖/字段/成功响应/幂等/并发/观测审计项；AC 有无副作用和可观察终态缺口；测试资产不存在 |
| `V1-FR-002` | 审核/信任根/安装回滚机器契约仍 Draft；AC 证据和测试资产不存在 |
| `V1-FR-003` | Skill/MCP/Agent 独立 schema、幂等/并发/观测契约缺口；测试资产不存在 |
| `V1-FR-005` | AI Task/Artifact/Provider 关键公共契约仍 Draft；AC 和真实 Provider/E2E 证据不存在 |
| `V1-FR-007` | Provider/Secret/Model descriptor 的契约测试和真实服务未建立；幂等、观测和测试资产缺口 |
| `V1-FR-009` | 动作 schema、风险/确认/取消和应用写 API 尚未逐动作冻结；AC 与测试资产缺口 |

### 19.4 V2-V6 未来功能

| 版本 | 功能/能力 | 当前状态 |
| --- | --- | --- |
| V2 | `V1-FR-004` 无限画布与项目、项目/节点/结构导入导出 | future/planned；不计入 V1 |
| V3 | 画布执行、运行快照、结果回写 | 独立规划；正式新增编号待 V3 门禁 |
| V4 | `V1-FR-008` 项目资产与生成历史、授权/引用/复制导入 | future/planned；不计入 V1 |
| V5 | `V1-FR-006` Canvas 插件与模板、3D 导演台 | future/planned；不计入 V1 |
| V6 | 组织协作、生态分发、批量运行、跨端入口 | 独立规划；无正式功能/接口/实现证据 |

### 19.5 缺失契约与证据

- APP manifest 信任根、签名/来源、审核状态机、安装/启动/更新/卸载完整 operation schema。
- Desktop IPC/SDK schema、版本协商和 contract test。
- Skill/MCP/Agent manifest、driver、event/action 和连接状态机器契约。
- Provider/Secret/Model Profile/Capability Protocol 的完整 JSON schema、真实 contract test 和错误/幂等/超时边界。
- AI Task cancel、Artifact read、Identity/Session、permission revoke 等逻辑清单已有但 OpenAPI 未提供的 operation。
- V1 数据 migration/DDL、唯一/外键/检查约束、RetentionSweep、备份恢复和回滚演练。
- `tests/` 下所有目标 E2E、集成、性能和安全资产；当前 `tests`、源码和 migration 均不存在。
- development/e2e/performance/release JSON 报告、manifest、构建标识、真实环境证据和审批绑定。

### 19.6 旧文档迁移清单

- 旧 `docs-policy.json` 的 `tier=m` 已提升为 `profile=regulated/tier=l`；`root=docs` 保留。
- 旧项目脚本副本已由 v1.9.0 刷新；旧 `check-docs`/`docs-gate` 文件未覆盖业务文档。
- 功能文档中的实现状态没有被批量改写；唯一状态仍在 V1 实现状态表，facts 只同步机器导航字段。
- V2/V4/V5 的历史稳定编号登记稿未删除，未来范围和迁移映射保留；未来实体从 V1 核心实体表移入未来实体注册表。
- 新增 `docs-facts.json`、`.spec-docs/baselines/V1.json`、变更切片模板和本迁移报告。
- OpenAPI operation 通过 `x-tag-feature` 连接到功能；人工接口契约仍是字段外的语义 Draft 来源。
- `docs-evidence.json` 的 Git/报告/审批模板占位改为显式 Pending/absent 限制。

### 19.7 仍存在的重复事实与冲突

- 功能文档、V1 PRD、接口契约和 E2E 规范仍分别叙述部分权限、状态、幂等和失败边界；facts 已建立导航关系，但尚未将全部语义收敛为单一公共契约。
- 规格审查仍发现 31 个 feature contract gap、21 个公共契约幂等缺口、20 个 AC 无副作用断言缺口和 10 个 AC 可观察性缺口。
- `facts-sync` 对 future feature 的 orphan 提示仍存在，这是 active V1 feature directory 扫描边界，不是把 future 事实混入 V1。
- 模板文件保留占位警告；它们不是业务文档，也不是 Ready 输入。

### 19.8 需要人工确认的业务决策

需要产品、架构、安全、数据和发布负责人确认：manifest 信任根/审核状态机；助手逐动作风险与确认；Provider 验证与既有任务原子收敛；Identity/Session 物理 schema；migration/RetentionSweep/AuditEvent 责任与恢复；Desktop IPC/SDK 公共契约；真实 Provider、MCP、Skill、Agent 和权限环境；以及 V2-V6 正式编号和门禁冻结。

### 19.9 推荐下一批独立交付切片

1. `V1-platform-contracts`：冻结 manifest、安装状态机、主体/Session、权限、Settings、Skill/MCP schema 和错误/幂等/观测；完成 FR-001/002/003 的 feature contract gap。
2. `V1-provider-contracts`：冻结 Provider/Secret/Model descriptor、协议 registry、验证/刷新边界和真实 fixture contract test。
3. `V1-ai-task-contracts`：冻结 submit/query/events/cancel/Artifact schema、requestId 幂等、事件序号、终态和恢复。
4. `V1-assistant-contracts`：逐动作登记 schema、风险、确认、执行器、取消、审计和公开应用写 API。
5. `V1-test-assets`：创建真实单元/集成/E2E/性能/安全测试资产，先 local，再明确 staging/production-gate；每批追加 manifest 并保留 `commit_binding: absent` 限制，直到 DGOS 进入 Git 仓库。
6. `V1-release-evidence`：在代码、migration、受控环境和人工审批真实存在后，重新计算 authority digest，补齐开发/E2E/性能/发布报告；不提前解锁 release gate。

本次迁移到此结束：文档结构、facts 导航、关系追踪、契约索引和规格基线已升级到 v1.9.0 语义；DGOS 的实现、测试和发布状态仍诚实保持 Pending/Blocked。
