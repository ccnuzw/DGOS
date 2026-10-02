# V1-STATUS-RECONCILE r8 — Lead 权威状态落地草案

- status: ready（只读审查与草稿交付；完成本回执后停写；本文不是第二份权威状态，提案仍unapproved）
- work_package: V1-STATUS-RECONCILE / revision 8 / Planner / 2026-10-02
- slice_id: V1-platform、V1-ai-task、V1-assistant、V1-release
- objective: 提供12FR状态表逐行替换稿、过时现在时修正、62AC/12E2E/7NFR/3RG有限剩余出口及负载/恢复批准输入。
- authority_files: [派包r16 Planner段](v1-convergence-r16.md#planner--v1-status-reconcile-r8)、[唯一实现状态][STATE]、[稳定编号][IDS]、12FR主文档、[E2E矩阵][MATRIX]、[发布检查清单][RELEASE]。
- dependencies: Lead接收领域停写回执并冻结源码/制品；Verify五组runner；D最终真实浏览器与F同dist原生复验；B最终镜像/恢复；真实发布材料与批准。
- parallel_work_packages: A assistant-resolve r16已交PG窄修、E ext-read r9已交预期权限门槛诊断；D UI r7、B ops-release r8、H management-fixture r8、I provider-failures r8、Verify candidate-runner r12在途；看板另记C harness-schema r16、F desktop-candidate r9。仅引用派包/已落盘报告，不派发或借用环境。
- blocking_decisions: 本文交付不需新增业务决策；正式性能profile和RPO/RTO数值无法从现有规格推导，所缺输入见第6节；不阻塞已有授权内的修复与本地校准准备。
- required_writeback: Lead核对截点后将第2/3节落到唯一状态及证据导航；facts、正式evidence与批准由Lead按实际材料落地；本包只写本文件。

**最终封存增量优先于下文较早“待修/待独立复验”截点：** Lead已接受§6.4现规格解释并正式派[C V1-PERMISSION-REGRANT r17](v1-permission-regrant-r17.md)：修同owned规则显式deny→allow，旧pending approval仍不能覆盖后来deny，fresh Session/双scope/CSRF/CAS/context/audit保持。D等待C停写、受控reload后经公开Settings恢复原Skill；本文先前两步ask路径仅保留静态诊断，不是推荐给用户的永久流程，也未在15200执行。legacy permissions PATCH由Lead单独收敛。

Provider最终已读[IF8]修后独立8/8，exit0、sourceStable=true；[修后manifest](../tests/provider/evidence/V1-PROVIDER-FAILURES-r8-2026-10-02T03-23-31-103Z-7b857c39-manifest.json)绑定真实PG/Redis/TLS/独立worker。运行中取消247ms、终态时fixture响应已关闭、无终态后新请求；原5pass/3fail与15009ms保留。FR013 AC02/04的这套独立矩阵缺口已补，剩余最终候选身份比较/相关字节变化后的重放、UI及真实目标外部依赖，不再写成“独立复验待执行”。下文FR013基础实现行是Lead已落地时的状态建议来源；后续状态升级仅由Lead决定。提案所有数值继续unapproved。本文至此封存，不追逐其他在途产物。

## 1. 截点、证据等级与不能合并的批次

读取基线HEAD为 `72ab1cb98b064a6e27b9f60a9f8f00881a827a99`，共享未提交工作树持续变化。权威状态读取时仍为2026-10-01，SHA256 `816866d68f4b3d40014654ff347e89f132514619f3fece9e9af263aea9537cc7`。下面是本次读到的报告截点，不宣布候选freeze。报告若随后变化，Lead须重新核对受影响行，不能将“工作包已派/owner已回复”当作修复验收。

封存前更新：Lead已落地12FR表、迁移/资产与历史分层并同步facts；本Planner只读核对，未重写这些权威文件。第2/3节保留为供审阅的替换来源，**不应再次覆盖Lead最新状态**。FR013根据I真实5通过/3失败保留基础实现，见[IF8]；读取[A17]窄修回执时已交内存/egress double定向9/9与10/10，I修后独立复验仍待，不升级状态。看板记录D reload后resolver/plan已有进展，但未取得最终D r7配对报告，仍不替其宣布完整真实链通过。

证据分级：静态、内存/注入、本地PG、本地公开HTTP/独立进程、本地浏览器/原生、目标部署/真实外部依赖分别陈述。所有历史通过只属于其原构建；相同HEAD不代表相同未提交源码。未完整覆盖的AC继续列有限剩余断言，不报虚构完成率。

| 索引 | 已落盘事实（日期均为2026-10-02，B5批次始于10-01） | 精确边界 |
| --- | --- | --- |
| [F6] | debug可见窗口3/3；本地API/独立worker/HTTPS fixture链7/7；[最终manifest](V1-DESKTOP-r6-2026-10-02T01-36-42-004Z-660e7f7b-manifest.json)绑定binary/dist，原批无漂移 | 可见/聚焦/最大化/关闭重开和原生几何恢复有证据；自动化非人工验收，ad hoc非Developer ID/公证，最终D dist尚待F复验 |
| [A9] / [D5] | 签名包1.0.1/build2，digest `sha256:0440088ded07140699950453704a5328b4a48e7046564216b6408d3d8a852eef`；A桥fixture1/1；D真实参数Task1/1，delta、Artifact、reload且一个submit/上游调用 | D真实链用 `index-C3h0mSRo.js`，随后focus修复和r6又换dist；D最终r5 fixture30/30、5skip，40张截图只绑定r5。不能把前后JS当同一候选 |
| [D6] | 真实设备撤销、Quota策略、治理策略各1/1；fixture30/30、10个真实环境skip；[manifest](V1-UI-r6-manifest.json) | manifest为混合结果，commit字段带“base only”，不是冻结提交；最终r6 JS `23a7a5029f5730d6bd4aeafbdf5c2470282a1e2439508428e880da66fe1b8eb5`。Skill 201后definition GET409；assistant resolve500，未发plan/execute |
| [G11] / [G9] | 包unit/route16/16、PG3/3、公开12阶段；47冻结迁移至0051；[G11 manifest](state/package-http-evidence/V1-package-http-2026-10-02T02-00-26-746Z-667e1fe6-manifest.json)；retention PG10/10、内存14/14 | 同app锁、坏输入、健康回滚、真实Task/Artifact引用保护及磁盘清理子集；单API并发非跨进程锁压力；旧未登记孤儿目录不扫描 |
| [E6] / [H7] | E领域33/33、旧公开Run12/12；H新管理HTTP8/8，独立OS worker，47冻结迁移；[H7 manifest](../tests/extensions/evidence/V1-EXT-PUBLIC-r7-2026-10-02T02-12-38-366Z-6a4bea24-manifest.json) | H已证明custom Run/翻译Task+Artifact+CAS apply/模板凭据/受信在线暂存字节；不再写“新增管理HTTP未交”。该批早于sandbox修订和D真实读取故障，不能关闭E r9/D r7 |
| [ES8] | r7原macOS7通过/1失败保留；附录r8两文件10/10，正常MCP与私有文件/写入/网络canary；transport SHA `73dae1558ac3b1e55f8ece4a9de4efc1d823f0966529ed514e7236ef7f26131a` | 当前host上的窄沙箱通过，B旧Linux通过用 `07ce3e80…`，不能转移到最终transport或新镜像；不删除早期dyld失败 |
| [H6] | `node scripts/v1-provider-http.mjs`9/9，公开HTTP/PG/Redis DB5/TLS fixture/不同PID worker；[manifest](../tests/provider/evidence/V1-PROVIDER-r6-2026-10-02T01-37-05-899Z-13a59b2f-manifest.json) | 原45迁移快照：参数/首delta/重启/dispatch拒绝/已发送未知不重发；后来脚本47迁移适配仅静态。不是全部连接测试失败矩阵或外部Provider |
| [B5] / [Q6] | B核心11/11、原快照无漂移；C quota内存/API7/7、PG2/2 | B批至0040，0041在后；两worker存活不证明领取分布；C缺失usage/过期reserved/needs_review子集不能代整域验收 |
| [A8] / [C12] | A freshness PG2/2、无PG组合26pass/9skip；C两个buildServer共享PG/Redis20/20，[manifest](evidence/V1-IDENTITY-r12-manifest.json) | C为同进程两个监听实例，不是两个OS进程；有限Key overlap/撤销/renew/freshness已证，跨owner负例在PG领域层。A r16新resolver故障与这些通过并存 |
| [C11] / [C15] | C audit query PG5/5、内存8pass/3skip；C Secret audit fixture12/12 | 自审计/分页脱敏、event+outbox和双fresh政策CAS有证据；C15是假pool事务测试，非真实PG；不得推导全部高风险入口已闭合 |
| [I7] / [L9] | I公开provision→显式PATCH→API重启→CONNECT/TLS1/1；context2/2、provision/context5/5；Lead记录API和worker Action committed-ref gate均已接线 | “worker未接线”已被Lead接线记录校正，但该Action实际PG+代理链未由I1/1证明；被动失效下次读取才发事件；guard后改仅静态 |
| [O4] / [O8] | O4历史镜像中持久加密Secret跨进程、PG/Redis故障readiness恢复、密文备份隔离恢复、local CA；O8正在修镜像且已保存[完整旧Trivy JSON](../deployment/V1-OPS-r7-trivy-full.json) | 旧镜像 `sha256:4c76f93ed6ae02e96e136cdde90453f39c06a2844f0ccb251b65ba1482031686`：OS7 CRITICAL/85 HIGH，Node2 CRITICAL/43 HIGH；FixedVersion空/缺为7 CRITICAL/82 HIGH。旧镜像阻塞发布，最终r8启动/扫描/canary未交 |
| [P6] / [VR10] | 性能最后16/16 Task不变量观测正常但source_drift=true、exit1、profile未批准；诊断86文件202pass/13fail/31skip、12excluded、candidate_complete=false、source_drift=true | 后续定向通过不改旧诊断；A r15只引用Lead已收修复回执，不造独立统计；C15/E6有各自定向结果；Verify r12工具任务不等于全候选已执行 |
| [IF8] / [A17] | I独立PG/Redis/TLS/多OS worker8场5pass/3fail、exit1、sourceStable=true；[原manifest](../tests/provider/evidence/V1-PROVIDER-FAILURES-r8-2026-10-02T03-16-29-684Z-3abfcf64-manifest.json)；A17窄修定向9/9及10/10 | 429错分upstream_unavailable、畸形200误成功、running_cancel15009ms三失败原样保留；7000ms是该harness断言不是新SLA，原失败未记录socket状态。A内存/double不代I真实复验；两worker重启用例2次上游、1次终态审计，不能写成上游至多一次 |
| [O7]（封存复核补读） | 本地47迁移；多存储fixture一个Secret、两个包文件与PG引用恢复：backup210ms/restore307ms/首校验517ms、观测RPO0ms；显式production-authority模式仍在本地fixture，199/308/507ms | 有本地多存储子集，不能继续泛称“完全没有多存储恢复”；该报告未附同等完整不可变run manifest，微型fixture实测不当批准RTO/RPO。根密钥不在普通archive，备份要求止写且无pending跨存储intent |
| [VR12]（封存复核补读） | executable五组runner tooling23/23、无skip；plan为当次101主测试文件，未执行五组产品候选 | host Node五组即便绑定image digest也不是image内测试；最终浏览器/native和替代用例缺失则candidate_complete=false。不再写“runner尚未实现”，保留待freeze执行 |

本轮后续已读[A16]与[ER9]正式回执，以下替换稿按此修正：A补传requestId，隔离PG先复现500再2/2通过，严格Verify父库另2/2；这是Fastify注入+真实PG，不是D浏览器通过。E确认install与read是独立能力，ask产生409属预期；新增PG路由测试2/2通过（ask409→allow200/no-store→deny403且私有Prompt不泄漏），未改产品，D实际有效授权仍待复验。第1节D6原失败/受阻结果原样保留。

Lead已修正[正式evidence清单](../docs-evidence.json)两条“非Git/无源码”旧限制，读取时generatedAt为 `2026-10-02T03:09:28Z`，仍为pending且commit/report/审批为空。Lead回报最新release gate为10 errors/1 warning、facts-sync 0 drift；这是Lead检查结果，本文封存检查另列自己的实际结果，不将空审批改为通过。

### 新修在途与落地前条件

| 工作包 | 本次确有的证据 | 仍需的交接 |
| --- | --- | --- |
| A V1-ASSISTANT-RESOLVE r16 | [A16]定位漏传requestId，窄修candidate-routes/system-actions；隔离PG复现后2/2，严格Verify父库2/2；显式deny过滤与审计故障无plan/run副作用 | D/Lead受控reload后真实导航/确认/deny/cancel；A未动D15200。产品窄修已交，当前浏览器候选尚未证明 |
| E V1-EXT-READ r9 | [ER9]create需skill.install，definition独立需skill.read；ask409是预期且未改产品；PG路由2/2验证ask/allow/deny和审计 | D用原Skill、同主体显式授权后复测；随后D将skill.read设deny，Settings直接allow403的恢复核查见第6.4节。不得自动grant或SQL绕过 |
| D V1-UI r7 / H fixture r8 | D6只有三条live成功及两条阻塞；H7为短时后端harness | H15175–15177真实API/worker/daemon/TLS可信fixture，D真实翻译apply和MCP双样本；不能以拦截响应替代。D15200独占，Planner不操作 |
| B V1-OPS-RELEASE r8 | O8在途及完整旧扫描；封存补读O7确认已有本地微型多存储恢复子集 | 完整最终image的API/worker依赖启动、非root Chromium、相同E hash Linux正常+负canary、完整最终扫描及无修复条目；目标规模/一致恢复点与批准RPO/RTO另需实际批次 |
| Verify r12 / C / F | VR12工具23/23、五组可执行但产品未跑；C/F按各自工作包 | owner停写后Lead freeze，Verify正式五组，D/F同候选浏览器/原生；绑定镜像不等于host测试在镜像内执行 |
| I V1-PROVIDER-FAILURES r8 / A probe r17 | IF8真实独立矩阵5pass/3fail，无源码漂移；A17产品窄修已停写，定向内存/double通过 | I加载新API/worker后同8场独立重放，分类/取消/socket事实与Task/catalog/quota不变；失败case原批在首断言停止，后续不变量不能补称已验证 |

## 2. 12FR权威状态表精确替换稿

应用目标：[V1-实现状态.md][STATE]的“状态总表”12行（开始读取为11–22行，Lead已落地后为13–24行）。以下为**替换来源草稿，已交Lead用于落地，不再次覆盖权威文件**。FR003/009真实完整链未闭合、FR013真实错误矩阵失败，均保守“基础实现”：E409是预期权限门槛，A16与A17窄修分别按实际等级记录。其他行“本地验证”明确子集/当前候选缺证，不用“待验收/已完成”。后续只由Lead依据新增完整报告更新权威。

表内链接使用本文文末引用定义；复制到权威文件时将这些定义的仓库根相对路径重定位为 `../../../.herdr/…`，或在该表直接链接相应报告，不能把本文成为新的状态维护入口。

| 功能 ID | 功能 | 实现状态 | 后端/前端与验证摘要 | 当前主要差距 |
| --- | --- | --- | --- | --- |
| `V1-FR-001` | 桌面与应用工作区 | 本地验证 | [F6] debug可见窗口3/3及本地API/worker/Task链7/7；[I7]代理provision/PATCH/重启/CONNECT子集；[D5]/[D6]真实权限与设备管理子集；[L9]APP context与worker代理校验接线 | 最终同dist双宿主UI-AC001–006、APP上下文/地区/助手语言分离、代理GUI和worker Action实际链、完整能力拒绝；Developer ID/公证及目标部署另验 |
| `V1-FR-002` | 开发者中心与 APP 生命周期 | 本地验证 | [G11]签名包严格输入、审核/安装/升级/健康回滚/数据引用保护公开12阶段、PG3/3和unit/route16/16；[D5]已安装签名工作台真实调用 | 当前候选五类目录/角色与失败回滚的浏览器/原生完整入口、跨进程锁及中断恢复证据、operator正式信任根/不可覆盖发布验收 |
| `V1-FR-003` | Skill/MCP/Agent 接入 | 基础实现 | [E6]管理/Run/凭据33/33、[H7]独立worker管理HTTP8/8、[ES8]macOS受限MCP10/10；[ER9]PG路由2/2确认definition独立skill.read的ask409/allow200/deny403 | D显式权限恢复与真实管理/翻译/MCP双样本及页面恢复待复验；Settings deny重新授权路径一致性需核对；最终image相同transport Linux正常/负canary及当前候选待B/Verify |
| `V1-FR-005` | 多模态 AI 任务工作流 | 本地验证 | [H6]PG快照参数、TLS首delta、独立worker重启/SIGKILL已发送未知不重发9/9；[D5]签名工作台真实参数Task、Artifact/reload一个上游调用；[F6]原生本地链7/7 | D/F最终同候选签名包全链、断线/取消/stream.reset及未知提交恢复边界复验；真实外部Provider和发布证据未闭合 |
| `V1-FR-007` | 模型平台与工作流配置（V1 基础子集） | 本地验证 | [H6]精确Profile/参数快照与dispatch前版本/停用重检；[D5]真实账号probe/显式ready、validate、刷新目录、模型策略及参数Task；API无导出证据见[H4] | 当前候选失败准入/选择器同步、分类默认与刷新并发/审计、完整Profile/UI负例和无导出检查；目标TLS/真实外部Provider及发布验收 |
| `V1-FR-009` | 系统智能助手与快捷指令 | 基础实现 | [A8]fresh/确认/双scope与原子receipt PG2/2；[A16]漏requestId导致PG23502已窄修，真实PG复现后2/2、Verify父库2/2；[B5]历史设置链与恢复专项 | D受控reload后的真实自然语言导航/生命周期/显式确认/拒绝取消，以及持久Run跨进程/下游取消完整链未闭合；PG定向通过不代浏览器 |
| `V1-FR-010` | 管理员登录与会话 | 本地验证 | [C12]双API/PG/Redis20/20含并发引导、共享限速、撤销/renew及fresh gate；[D6]真实设备列表/指定撤销/登出1/1；[O4]持久Secret为另一历史本地镜像子集 | 最终候选两宿主会话/全部高风险入口再认证、实际部署拓扑与生产Secret/传输；C双实例不能表述为双OS进程，独立最终E2E未完成 |
| `V1-FR-011` | API Key 生命周期 | 本地验证 | [C12]受限scope、跨实例认证、有限重叠轮换、过期/撤销及审计脱敏已验证；[C11]审计event/outbox原子性子集 | 当前候选一次性明文UI/浏览器存储与日志扫描、全入口主体资源授权和轮换失败原子性、实际部署缓存/Secret及完整E2E |
| `V1-FR-012` | Provider 账号与连接 | 本地验证 | [H6]真实公开账号/Secret引用/连接成功/配置绑定及任务准入；[D5]真实UI probe与显式启用；[H4]精确绑定/准入及脱敏专项 | 当前候选账号级停用传播、跨主体/协议/CAS拒绝、所有活动引用删除保护和Secret撤销补偿完整矩阵；生产Secret与外部Provider |
| `V1-FR-013` | 上游账号连接测试 | 基础实现 | [IF8]原独立矩阵5通过/3失败保留；[A17]窄修后I真实PG/Redis/TLS多worker8/8、源码稳定，取消247ms | Lead已落地的保守状态不由本稿升级；最终候选身份比较与相关字节变化后复验、完整SSRF/UI及目标TLS/真实外部依赖未闭合 |
| `V1-FR-014` | 审计与管理员系统治理 | 本地验证 | [C11]自审计/脱敏分页、event+outbox原子性和双fresh策略CAS PG5/5；[G9]/[G11]清理恢复子集；[D6]治理requestId关联/preview1/1；[A16]resolver审计窄修PG已证 | A修复后的D真实入口复验；全部高风险写入口故障原子性与策略冲突UI的当前候选矩阵；生产规模保留、Secret和多存储恢复证据 |
| `V1-FR-015` | 用量与额度管理 | 本地验证 | [Q6]内存/API7/7、PG2/2；[B5]/[H6]唯一结算、SIGKILL已发送未知保持needs_review且不重发；[H7]翻译与custom Run结算子集；[D6]真实Quota策略1/1 | 当前候选全入口最后额度竞争/全部终态与reconciliation、可信usage来源和完整用量UI隔离；性能profile未批准且[P6]漂移exit1，真实Provider/发布门禁未闭合 |

## 3. 过时现在时的精确修正位置

### 3.1 同一权威状态文件

1. 首段以“更新时间：2026-10-01。”开头、到“详细任务与证据见各功能主文档的‘实现与验证’章节。”的四句替换为：

> 更新时间：2026-10-02。状态依据各轮实际报告及其构建标识；当前已有本地公开HTTP、PG/Redis、独立worker、签名工作台浏览器和macOS debug可见窗口子集证据。各批源码、迁移、dist和镜像不一致，尚无统一冻结候选全量验收；A/E/D/B等修复与验收按本表差距继续跟踪。本地通过不代表真实外部依赖或发布门禁通过。详细命令、构建与限制见各功能主文档验证记录及所链接报告。

原首段“V1由平台控制面……”起的版本范围与助手规则原样保留。

2. 将 `### 2026-10-01 F 轮验证增量` 标题改为 `### 2026-10-01 F 轮验证增量（历史批次）`；在标题后插入：

> 本节仅记录10月1日F批次。其GUI exit2、crash重发、限速/轮换缺项等结论受各自原构建限制，不代表10月2日当前实现；当前事实以状态总表和下列日期化增量为准。原失败不改写为成功。

历史五条原文及原报告链接保留。在其后新增 `### 2026-10-02 状态收敛增量`，使用第1节证据索引及在途表的事实，尤其列明F6、H6、H7、ES8、D6与旧诊断失败；不能仅改日期让旧批次变成新证据。

3. “当前代码落点（非验收结论）”Identity行的末列替换为：

> 本地验证子集：身份、设备会话和Key的PG/Redis双API公开链见C r12，真实设备页面见D r6；生产Secret与最终候选验收仍缺。

4. “数据库迁移”首条替换为：

> 当前候选输入按Lead冻结清单为47个migration文件，截止0051；G r11与H扩展公开r7在各自隔离子库实际执行该集合。其他历史批次可能只执行其原allowlist，不能统一改称47迁移后验收。各文件checksum、兼容与执行证据以物理migration、分配清单及各批manifest为准；生产规模迁移/恢复仍待验。

保留“Migration收尾结论”对0008/0010历史alias的说明，不修改任何SQL。

5. “当前工程资产”五行建议替换为（路径增量由Lead以真实代码核对后落地；下列能力语句不沿用旧数量）：

| 资产行 | 当前能力与限制替换文本 |
| --- | --- |
| SecretService | 内存/Redis测试适配之外，已有持久加密Secret后端及历史镜像API/Worker跨进程读取、撤销、密文备份隔离恢复证据（O4）；目标部署根密钥、轮换、最新镜像和完整灾备仍待验。 |
| Identity repository/service | PG主体、Session设备管理ID、Key有限轮换窗口、事务audit/outbox及共享Redis退避已有C12公开双实例证据；D6设备页面子集通过，最终候选与生产后端另验。 |
| ProviderEgress | HTTPS pinned transport、本地TLS/首delta与代理CONNECT已有H6/I证据；各host策略与实际生产DNS/CA/网络隔离仍需最终候选和目标环境验证。 |
| PostgreSQL migration | 当前冻结输入47文件至0051；G11/H7隔离库已有执行证据，旧报告保留各自原迁移集合；生产规模升级/失败恢复未完成。 |
| 自动化测试 | 多领域单元、PG、公开HTTP、浏览器和原生专项已存在，不能沿用“8项/无网络沙箱测试”；最新全局诊断为202通过/13失败/31跳过且源码漂移，尚非完整冻结候选。 |

6. `### 已执行验证` 改为 `### 已执行验证（2026-10-01历史批次）`，段首“2026-10-01 本轮真实执行”改为“2026-10-01 该轮真实执行”，段内“当前……通过”改为“该批次……通过”。段后追加：

> 本段34/34、58pass/1skip及其未完成项仅属于该轮，不能作为当前全量结果。10月2日诊断失败、专项成功和在途修复分别见最新增量；旧默认数据库命令仅作历史原文，不作为当前执行指令。

7. `# 本轮运行时长任务实现（2026-10-01）` 改为 `### 2026-10-01 运行时长任务实现（历史批次）`；末段“本轮证据是……”改为“该轮证据是……”，并在段尾追加：

> 此处运行环境与缺项描述限于原批次；当前已有PG、签名包公开HTTP、浏览器和macOS可见窗口子集，见状态总表。历史报告保持不变。

8. 其他带日期的历史条目中“无产品代码/当前仍规划中/未实现轮换”等不批量替换。于 `## 版本实现详情` 开头补一句：

> 下方日期化条目均为当时快照，包含当时成立的失败和缺项；带“当前/仍/尚未”的旧句不覆盖本页最新状态总表。

### 3.2 Lead后续证据导航的定点修正建议

以下不是本轮写入授权，只是随权威状态落地时的有限联动清单。

| 位置/旧表述 | 精确新口径 | 保留项 |
| --- | --- | --- |
| [E2E矩阵][MATRIX] E2E01 `Blocked：exit 2` | 旧F批次exit2保留；新增F6 debug可见3/3、本地链7/7；最终同dist、人工/辅助技术与签名未验 | 不把F6整个E2E01改Passed |
| E2E03 `Agent runtime 未实现` | 旧批次无资产；当前E6/H7已有Skill/MCP/持久Run与管理证据，ER9确认D6读取409属预期ask门槛，D显式授权恢复与最终sandbox/GUI待验 | 不扩展未来通用Agent |
| E2E12 `重叠窗口未实现` | C12本地双API有限重叠/到期/撤销已验证；当前候选完整UI/实际拓扑仍缺 | 历史立即撤旧测试不改写 |
| E2E05/07/09/13/14旧“无独立worker/失败禁用/恢复/自审计” | 用H6独立worker/准入、C11自审计、D5/D6各构建子集作日期化补充；A16原500与PG窄修分列，I新错误/取消矩阵在途 | 连接测试完整错误矩阵与Action恢复不借Task证据关闭 |
| r7 AC盘点“D r5仅历史权限1/1”“H管理链在途” | 新增r8截点：D5已有参数Task1/1但随后换JS；H7已交管理8/8；D6真实3成功/2阻塞；新的H8为不同长时fixture任务 | r7正文作为历史，不覆盖其当时结论 |
| [部署配置][DEPLOY]首句“尚未进入部署实现阶段” | 已有本地Compose、macOS debug及O4镜像/Secret运行子集；目标部署资源/网络/根配置与最终r8镜像验收待冻结 | 单机定位和“非HA/非容量承诺”保留 |
| [恢复手册][RESTORE]开头仅列PG恢复子集 | 另补O4密文恢复/撤销版本及O7一个Secret/两个包文件/PG引用本地多存储恢复；目标规模PG+包/Artifact+Secret根配置同恢复点完整演练及批准RPO/RTO仍缺 | 原RPO/RTO待定不填已批准数 |
| [性能入口][PERF]“无有效批次” | 该结论仍成立；补P6漂移smoke历史观测及未批准profile，不称“从未跑过” | PERF01–05模板归属与批准待落地 |

## 4. 62AC逐项有限剩余清单

本节对[既有62条盘点][AC4]作截至本轮的证据更新，不改AC文字。每行一个稳定AC：8+3+8+3+8+6+4+4+4+4+5+5=62。未来FR004/006/008、FR005 AC03–07和FR007 AC03不计入。所有行共用一个候选前置：最终source/build/dist/package/image/migration身份一致、实际用例报告+manifest+必要断言可追溯；只列这个前置而没有新的业务缺陷时，不要求重写产品。

标记：V=剩余验证；M=已观察缺陷/待诊断修复；X=目标部署/真实外部材料。下表“已有”是局部证据，不逐AC宣告通过。owner为当前责任/Lead后续协调建议，不是本Planner新派包。

| FR/AC | 已有且不再重复称缺实现的证据 | 剩余具体出口（及责任） |
| --- | --- | --- |
| FR001/AC01 | [F6]可见/聚焦/最大化/关闭重开恢复 | V：F最终D dist同候选原生重放，包含拒绝不创建窗口；X：发行签名另验 |
| FR001/AC02 | [G11]签名/严格输入/旧版本保护子集 | V：D/F真宿主篡改资源/manifest拒绝、稳定requestId且原窗口/版本保持 |
| FR001/AC03 | [D5]/[F6]真实系统/窗口入口子集 | V：系统信息/我的软件来自实际服务，不可用状态与诊断ID、两宿主结果一致 |
| FR001/AC04 | [A9]/[L9]APP context桥；D5主题/倍率截图 | V：D/F最终build实际APP订阅主题/材质/原生倍率传播，非CSS单独替代 |
| FR001/AC05 | A9语言上下文、D5中英文截图 | V：英文UI/大陆地区格式/中文助手独立消费，旧APP回退且不改私有内容，双宿主 |
| FR001/AC06 | I7公开代理1/1、context；L9 worker gate接线 | V：D代理录入与部分重启状态；Lead/Verify worker Action committed-ref真实PG/CONNECT链。X：实际proxy/Secret/TLS |
| FR001/AC07 | A8权限原子receipt，D5旧PATCH500已复验，A16 resolver窄修PG通过 | V：最终候选deny文件/扩展/Action副作用前拒绝且审计；D真实resolver与第6.4节同规则显式重新授权复验，管理路径一致性另核 |
| FR001/AC08 | G/H真实安装依赖；A9撤权停止轮询 | V：D/F同APP继续启动、MCP denied、可授权context可读，外部调用计数0且UI不崩 |
| FR002/AC01 | G11 signed包16/16+公开坏字段无stage/安装写入 | V：开发者UI字段定位、坏资源/越权无运行；X：operator正式信任根制品 |
| FR002/AC02 | G11健康失败回滚/PG锁和Task引用 | V：当前候选升级中断恢复旧包/兼容数据、两入口和跨进程竞争；不得用skip占位rollback资产关闭 |
| FR002/AC03 | G11生命周期公开12阶段，D5签名工作台启动 | V：五类目录/角色、受保护预装拒卸载、测试安装与审核区分、更新CAS及数据保留真实UI |
| FR003/AC01 | E6权限/安装，H7精确依赖/确认Run | V：最终sandbox后缺安装/禁用/deny无Run/进程与资源主体边界；X：B最终Linux镜像canary |
| FR003/AC02 | E6公开Run/独立daemon恢复12项子集 | V：D实际超时/查询/取消/关页恢复，无第二Run或handler调用，最终环境重放 |
| FR003/AC03 | H7受信模板凭据与真实daemon工具调用 | V：D配置编辑/错误保留原状态/脱敏与合法命令/cwd边界；B最终镜像准确hash正常/负例 |
| FR003/AC04 | H7 rename/翻译Task/Artifact/CAS，ER9独立read权限PG2/2 | V：D显式授权后用原Skill改名/翻译/启停、/技能名调用和引用影响；deny恢复见6.4，不自动grant或新造Skill绕原序列 |
| FR003/AC05 | E6模板needs-credentials/补偿，H7凭据连接发现调用 | V：D/H8无凭据及需凭据双样本，缺凭据拒保存/连接，凭据一次性与无导出 |
| FR003/AC06 | H7独立daemon两工具发现/调用，E6引用子集 | V：D enabled/connection/count独立显示，重连唯一、活跃Run/依赖删除拒绝，最新transport |
| FR003/AC07 | H7custom Prompt/签名preview，ER9 ask409/allow200/deny403 | V：D创建与独立授权读取、在线风险预览/确认/拒不可信全UI；权限所致409不列服务缺陷，shell输入无执行副作用 |
| FR003/AC08 | E6后台daemon与凭据，ES8窄macOS沙箱10/10 | V：bundled需/无需凭据启动条件、页面关闭/reload后同Run查询/取消；B最新Linux完整镜像 |
| FR005/AC01 | D5真签名包Task/Artifact1/1；H6/F6各自链 | V：D/F最终同候选握手→文本任务→结果实际可见；X：真实外部Provider |
| FR005/AC02 | B5/H6幂等、取消、sent-unknown不重发；A9重试 | V：最终UI双击/失败重试/取消/断线无第二Task/Provider/Artifact；未知提交丢失原ID时不自动重发，不宣称已有自动调和 |
| FR005/AC08 | H6首delta早于EOF；D5delta/reload原Task | V：D/F最终签名包有序增量/游标去重/断线重订/stream.reset与权威终态一致 |
| FR007/AC01 | D5实际probe/ready/validate/refresh分步 | V：最终UI失败不自动启用、凭据无回显、requestId与独立两步语义 |
| FR007/AC02 | H6版本/策略变更dispatch前拒绝、释放预留 | V：更新/验证失败即停用，模型选择器立即移除，新submit/dispatch拒绝而旧Task可查的全矩阵 |
| FR007/AC04 | H6 Responses/Chat受控TLS与descriptor | V：统一UI错误映射、无需新增前端协议分支；X：实际外部TLS Provider |
| FR007/AC05 | D5启用文本策略与选模型 | V：分类、每能力默认、非文本/过期/未分类排除与CAS冲突无副作用真实UI |
| FR007/AC06 | H4 no-export API负例/脱敏 | V：D/F界面无导出或可导入秘密摘要，响应/日志/浏览器存储扫描；不借API404证明UI |
| FR007/AC07 | D5显式refresh、策略使用；H领域资产 | V：并发refresh唯一、失败旧目录/策略保留与审计原子性，分类/default完整UI |
| FR007/AC08 | H6精确Profile版本/参数持久快照，D5实际动态参数 | V：最终完整defaults/limits/uiSchemas合并与未映射待配置/冲突拒绝；r6改47迁移后当前链重放 |
| FR007/AC09 | H6参数实际body/非法输入0Task0预留0外发，重启读原快照 | V：当前候选旧Task不偷换版本，媒体/脚本仍拒，Profile全负例；X：实际Provider |
| FR009/AC01 | A16 resolver产品窄修、实际PG复现后通过；D6旧500保留 | V：D/F受控reload后无Provider快捷指令真正导航及权限拒绝，不只返回候选 |
| FR009/AC02 | A8身份/权限重检，A16 deny过滤真实PG审计 | V：最终missing/disabled/denied/unavailable目录与历史UI，不能替换同名动作且handler0 |
| FR009/AC03 | A8 fresh/确认/过期/伪造拒绝，A16修复已交 | V：D reload后自然语言→plan→显式确认，取消/过期/改input不执行与审计 |
| FR009/AC04 | 包Action lifecycle专项；G11真实包子集 | V：D实际签名包安装/升级/卸载与Action目录/历史missing联动、主体隔离，当前候选 |
| FR009/AC05 | A恢复专项、B5旧公开跨worker子集 | V：D关页/断线、独立进程恢复及下游Task取消，同Run/task无重复副作用；A8的9skip不能当PG通过 |
| FR009/AC06 | A8敏感域双scope/同receipt/版本冲突PG2/2，A16窄修 | V：D真实确认、deny/cancel与公开应用配置；worker网络gate真实链；不放宽freshness绕过审计错误 |
| FR010/AC01 | C12双API竞争一principal/session/audit且清loser Secret | V：最终47迁移/实际目标启动拓扑复验、失败无半会话；不新增第二管理员 |
| FR010/AC02 | C12源/主体共享Redis退避与相同失败结果 | V：最终部署Redis断连/认证依赖fail-closed、实际入口传输；不是只改限速存储 |
| FR010/AC03 | C12撤销/renew竞态；D6sm_设备与登出1/1 | V：F/D同主体不同Session及桥票据撤销即时失效，当前候选/独立进程需求按目标拓扑测 |
| FR010/AC04 | C12+A8 stale敏感HTTP拒绝且无状态变化 | V：全高风险入口清单与D再认证恢复（含修后Action/权限/代理），过期会话不续活 |
| FR011/AC01 | C12 Key生命周期/审计扫描子集 | V：D真实一次性展示、刷新不可再读、失败无残留及浏览器存储/日志脱敏；X：部署Secret |
| FR011/AC02 | C12约束scope、key-delegation资产 | V：每公开能力的scope∩资源归属、不接客户端admin/owner，全拒绝副作用0和审计 |
| FR011/AC03 | C12有限重叠后旧Key失效 | V：最终UI显式撤旧/窗口到期、rotationGroup与审计；轮换失败保持旧有效Key的事务/Secret补偿 |
| FR011/AC04 | C12跨实例过期/显式撤销拒绝 | V：实际部署缓存/独立进程失效与资源不变，当前候选；Secret handle撤销不替代Key |
| FR012/AC01 | H6账号Secret引用和D5账号探测UI | V：创建一次性输入/脱敏、Secret故障无可用账号；X：正式Secret/Provider |
| FR012/AC02 | H精确绑定/准入，D5Profile关联 | V：跨归属/协议不兼容/CAS并发无部分绑定，完整公开管理断言 |
| FR012/AC03 | H6 config/策略dispatch拒绝 | V：账号级disable传播到全部绑定/选择器，新任务拒绝，已发送原task可查，历史目录不删 |
| FR012/AC04 | 领域引用保护资产已有 | V：配置/queued-running Task/ConnectionTest各活动引用拒删及脱敏摘要，解除后Secret撤销补偿恢复 |
| FR013/AC01 | H6独立worker设置链，D5UI probe成功 | V：test版本/耗时/成功分类与目录/Task计数不变，最终build诊断关联ID |
| FR013/AC02 | IF8原429/畸形200失败保留；A17修后I独立8/8，真实鉴权/限流/协议/TLS/网络分类正确且无秘密/Task/catalog/quota变化 | V：最终候选比较原批source identity、相关字节变化才重放，真实UI/目标依赖另验；不再列待修分类缺陷 |
| FR013/AC03 | H/I本地TLS、pinned/CONNECT专项 | V：同候选共享路由下DNS混合/IPv6/重定向/越权请求前拒绝、网络计数0；X：生产CA/DNS |
| FR013/AC04 | IF8修后8/8，取消247ms且fixture响应关闭/终态后无新请求；timeout与双worker重启终态唯一 | V：最终候选身份比较、D实际UI；重启用例2次上游不可写至多一次；原15009ms失败不覆盖 |
| FR014/AC01 | A/C/G/H事务子集，D6治理requestId，A16补requestId真实PG通过 | V：D加载A修复后真实复验；全高风险设置/权限/Provider/审核/扩展逐入口状态+audit/outbox关联 |
| FR014/AC02 | C11读取自审计/脱敏分页PG5/5；D6实际查询 | V：最终候选权限范围/游标/审计失败不返回页面与真实UI；旧“无自审计”删除当前口径 |
| FR014/AC03 | C11真实outbox失败回滚；C15假pool12/12 | V：全部高风险域的故障矩阵和父事务回滚，含Provider refresh/扩展管理/Secret；假pool不代PG |
| FR014/AC04 | G9分类/30天/引用/磁盘故障恢复；G11HTTP保护 | V：最终build完整preview/execute/checkpoint/引用复查与Task/Artifact保留；X：生产规模，旧孤儿目录限制保留 |
| FR014/AC05 | C11两fresh同baseVersion一200一409；D6实际PUT | V：D最终双写冲突显示/刷新与审计各一次；不重开已完成领域CAS实现 |
| FR015/AC01 | B5硬额度、H6非法参数零副作用、H7翻译结算 | V：所有task/Skill翻译入口quota拒绝无attempt/Provider/残留Task/预留，UI稳定错误；未知参数拒绝不冒充额度负例 |
| FR015/AC02 | Q6 PG原子竞争，B5双worker运行 | V：最终候选最后额度跨事务竞争无半Task/reservation、明确实际worker领取观察 |
| FR015/AC03 | B5/H6 sent-unknown保持needs_review，不重发 | V：成功/失败/取消/超时/未知全终态唯一结算/释放和reconciliation从原Task恢复；P6无漂移替代证据尚无 |
| FR015/AC04 | Q6缺失usage状态资产 | V：可信实际usage/estimated/unavailable来源各有断言，无可信值明确unavailable；X：实际Provider回报不凭fixture推定 |
| FR015/AC05 | Q6scope/伪admin拒绝，D6当前subject策略1/1 | V：真实用量筛选汇总/策略CAS、API Key资源范围和拒绝无审计外副作用；D6策略1/1不代查询全链 |

## 5. 12E2E、7NFR、3RG的收敛出口

### E2E（12首发，16仅补充）

按[规范](../docs/05-测试与发布/端到端验收/V1-端到端验收规范.md)和[MATRIX]执行；不是用局部统计相加得Passed。关联AC的细项即第4节，不另增业务条件。

| ID | 可引用历史增量 | 本轮剩余出口 |
| --- | --- | --- |
| V1-E2E-01 | F6可见窗口/恢复 | 最终D/F同dist窗口、拒绝/系统信息与双宿主证据；正式发行材料另列 |
| V1-E2E-02 | G11公开12阶段、D5安装签名工作台 | 完整目录角色/生命周期真实UI、宿主坏包/健康失败/中断回滚及旧数据引用 |
| V1-E2E-03 | E6公开12/12、H7管理8/8、ES8 macOS10/10、ER9权限PG2/2 | D显式授权及deny恢复、D7真管理/翻译/MCP双凭据/Run关闭恢复；B final Linux/Verify当前transport |
| V1-E2E-05 | H6参数快照/早delta/不重发，D5真实Task/reload，F6原生链 | 最终同候选签名包握手、流式/断线/取消/终态/Artifact可见；真实外部Provider补证 |
| V1-E2E-07 | D5实际配置与参数；H6准入子集 | 所有失败停用/策略分类默认/刷新原子/Profile负例和UI无导出；最终schema重放 |
| V1-E2E-09 | A8 fresh/receipt，B5设置动作 | A16修复后D/F自然语言导航/计划确认/拒绝取消/应用配置及Run恢复真实链 |
| V1-E2E-10 | I7代理公开链、L9context/worker接线、D5权限 | 双宿主APP上下文/语言/倍率/网络部分重启和worker Action gate真实副作用边界 |
| V1-E2E-11 | C12双实例20/20子集、D6设备1/1 | 目标拓扑首次引导/失败保护/会话/再认证完整入口与F会话；同候选真实Secret |
| V1-E2E-12 | C12有限Key重叠/撤销/过期 | 一次性UI/资源scope/轮换失败与缓存失效、秘密扫描及最终部署 |
| V1-E2E-13 | H6设置链、IF8原5pass/3fail及A17修后独立8/8 | 独立错误/取消矩阵已补，原失败保留；最终候选身份、账号引用/停用、SSRF与UI按AC逐项，不预报整项通过 |
| V1-E2E-14 | C11自审计/CAS、G9/G11清理、D6治理1/1 | 全高风险fail-closed、真实分类清理及冲突UI、生产保留/恢复 |
| V1-E2E-15 | Q6/B5/H6/H7分段quota，D6策略 | 最新候选所有Task/翻译入口原子准入/唯一结算/缺失usage/查询隔离与worker实际分布 |
| V1-E2E-16（补充） | Runtime/Settings/Permission PG资产 | 最终47迁移独立重启/权限/包API补充，不替代上面真实业务入口 |

### NFR与RG

| ID | 已有输入 | 有限剩余/责任 |
| --- | --- | --- |
| V1-NFR-001 | A8/C12权限、H7凭据、ES8沙箱、O4 Secret、A16/ER9定向PG | D最终全入口拒绝/跨iframe/撤权及显式权限恢复，不能隐式grant；B相同transport的最终Linux镜像正常/负canary与高危处理；D/F秘密扫描 |
| V1-NFR-002 | B5/H6不重发、E daemon、G恢复 | 同候选Task/Action/扩展/retention全部故障窗口、持久receipt/引用与多存储恢复；D关页恢复 |
| V1-NFR-003 | G11签名/不可覆盖/回滚子集 | 最终operator信任根与制品、UI/宿主升级失败中断恢复，旧数据与历史保护；F发行签名 |
| V1-NFR-004 | H4无导出、O4持久Secret/撤销恢复 | D/F真实无秘密导出/日志/浏览器存储，正式根密钥轮换/旧句柄失效与目标Secret恢复，不能由local CA替代 |
| V1-NFR-005 | D5 40截图及键盘fixture、F6可见窗口 | UI-AC001–006最终同dist双宿主、地区/助手语言、主题/倍率、键盘与实际辅助技术；D5未人工VoiceOver，不预报通过 |
| V1-NFR-006 | H6版本化Profile参数/Chat/Responses | 47迁移当前候选独立worker、声明式参数负例、不可变绑定与UI，实际外部Provider；不扩媒体/任意脚本 |
| V1-NFR-007 | H6首delta、D5reload/一个Task | 最终签名包/两宿主断线游标去重、stream.reset、取消/权威终态与Artifact一致 |
| V1-RG-001 | r5/r6契约封存，r7三旧资产替换及planning0/0/0 | Lead回写唯一状态、facts派生与正式证据，当前spec-diff/冻结来源和AC对应无漂移；planning只是规格检查 |
| V1-RG-002 | A9/D5/H6/F6各自工作台链 | 最终同候选签名工作台完整握手/文本任务/流式/恢复/结果展示，真实外部依赖；第6节Task性能证据引用此门禁 |
| V1-RG-003 | G/C/A/H/I/E平台多域子集，A16窄修和ER9权限诊断已交 | D真实加载/授权恢复、B/I/Verify实际结果；平台全部对应AC、当前源回归、目标部署/恢复/安全/批准。性能PERF01–05建议从属此门禁，不另建RG编号 |

Verify r12须保留memory/PG/Redis/TLS/guarded五组的逐文件exit/TAP/log/hash、真实skip/exclusion及前后source identity；工作流>90s与随机child/Redis命名空间属于执行安全输入，不是业务延迟目标。仅tooling通过不关闭RG。原[VR10]202/13/31失败批次永久保留；最终结果另写新run_id，浏览器/native尚缺时candidate_complete继续false。

## 6. 负载与恢复批准输入：先推导，后补无法推导的值

### 6.1 已有规格能直接确定的部分

依据[性能入口][PERF]、[PERF场景][PERFM]、[发布清单][RELEASE]、[部署配置][DEPLOY]、[ADR-0006][ADR6]、[恢复手册][RESTORE]、[接口契约][API]及[统一错误码][ERRORS]：

| 输入 | 可直接推导的填法 | 不得混淆 |
| --- | --- | --- |
| 交付形态 | macOS Desktop + Docker Compose本地Web、V1单机受控主体，PG权威事务、Redis短期队列/限流、包与Artifact对象引用及受控Secret；不要求新增HA或云拓扑 | 仍须记录实际CPU/内存/架构/OS、API/worker数、资源限制、存储/网络、TLS/Secret适配的目标清单，不能拿某次测试机器自动作目标 |
| 范围 | V1文本Task/流式/结果、系统与治理读写；不含支付、财务账本、画布、媒体、批量队列或通用Agent | 恢复手册中的“订单/流水”通用例子在V1按Task/Quota/Usage/Audit及引用关系落实，不扩功能 |
| 核心负载操作 | 复用P6 Settings read、Usage query、Task submit→events→get→Artifact；扩展翻译/Run与治理/包生命周期按现AC作为混合或并行一致性场景 | 可推导必须覆盖的路径，不能推导请求比例、流量、会话数或将16Task变成发布负载 |
| PERF归属建议 | `V1-RG-003/PERF01`冒烟、02阶梯/饱和、03稳态、04过载恢复、05一致性；Task链指标同时追踪RG002/FR005/015 | 这是既有门禁下模板ID实例化建议，Lead后续落地；不改RG定义、不新增性能SLA |
| 测量语义 | 各请求原始样本算p50/p95/p99/吞吐；Task admission、首delta、终态各自计时；逐秒或明确采样周期记录API/worker/生成器资源、队列、PG连接 | 不能用聚合分位数相减估算，也不能拿超时预算当p95指标；采样频率具体值须profile记录 |
| 错误分类 | `quota_exceeded`与`rate_limited`遵循现契约429和各自retry语义；预期额度/限流拒绝、非预期4xx/5xx、transport/timeout分开统计；拒绝无下游调用/残留副作用 | 未找到独立通用“容量满”公共码的冻结目标，不 invent overload错误码；若队列/连接池达到上限，按实际现契约验证并由Lead明确profile预期，不把quota拒绝冒充物理饱和 |
| 不变量与停止条件 | 按run_id/owner核Task/attempt/terminal event/Artifact、reservation/usage唯一、audit/outbox、无负用量/越权；任一失败即不通过；漂移、生成器饱和未量化、采样中断、缺身份或未批准profile均不能Passed | P6 16/16只说明当次小样本；没触发容量拒绝就没证明过载恢复 |
| 执行阶段 | PERF01 local-smoke；02 calibration/staging；03–05 staging或明确目标等价隔离环境。冻结source+profile前后摘要，工具/fixture版本、health/ready前后、资源余量、清理证据 | 现B工具只是受限smoke；C冻结迁移harness改动也不是有效性能新批次 |
| 恢复范围 | PG全量/增量/WAL及migration；全部被引用包/Artifact字节与元数据；精确image/dist/package/trust配置；Secret密文、根配置/版本和受控根密钥恢复流程（含proxy HMAC版本） | 普通备份不放Secret明文；根密钥与密文分开受控。缓存不能作任务/额度/授权终态恢复源；已撤销凭据/Session/Key恢复后不得重新有效 |
| 恢复顺序 | 隔离环境/已知一致时间点→恢复PG/对象/受控Secret引用→部署相同版本→只读完整性/摘要/引用/撤销/审计/Quota核对→隔离写入smoke→记录缺失范围与实际RPO/RTO→显式开放写入 | 容器重启、readiness恢复、单Secret备份都不等于多存储灾备；不能手工覆盖数据修结果 |

### 6.2 给Lead/负责人的有限批准表（未批准）

以下为待批准输入，不预填批准人/时间；第6.3节给出可评审的工程建议值和理由，全部unapproved。Lead可依既有授权自行确定普通技术配置；真实性能/恢复目标和签署须有实际责任人依据。不能静默采纳P6或本稿建议为冻结阈值。

| 批准输入 | 已有材料/默认推导 | 必须补齐的具体值或证据 |
| --- | --- | --- |
| 目标环境清单 | V1单机macOS/Compose；B目标final image，不能用旧漏洞镜像 | 两种发布形态实际OS/arch/CPU/RAM、资源限制、worker数、PG/Redis/存储/Secret/TLS版本与拓扑、数据规模、fixture与真实Provider标识；责任人确认适用范围 |
| 负载profile | [P6]和[工程profile](v1-performance-profile-r6.json)可作为受限校准起点 | profile_id/version、操作mix及比例、Task输入/输出大小与流式消费、并发/到达率、ramp/阶梯/稳态/过载/冷却时长、预置数据量、故障点和生成器上限；批准后的文件digest |
| 性能阈值 | 现接口超时只作为功能终止预算；既有invariant失败阈值为0 | 各操作/阶段的分位数/吞吐与单位/比较符、非预期错误率、资源/队列上限与增长标准、恢复回稳阈值和观察窗口；必须与负载/拓扑相配 |
| 过载预期 | 现quota/限流拒绝语义与“无副作用”可直接使用 | 要触发的实际瓶颈、期望的现有公开错误、拒绝比例及下游计数、回稳条件；禁止仅以8并发未拒绝称完成 |
| 恢复策略与RPO | PG权威+对象/密文/根配置一致恢复集；Redis可重建 | 备份/PITR频率、保留/加密/离线或隔离位置、跨存储一致点方法、容许数据损失时间和对象范围、操作者与密钥托管/访问材料 |
| RTO与验证窗口 | 先只读校验后开放写入；生产Secret/引用不可省 | 故障种类与规模、检测/宣布恢复/恢复执行/校验/重新可写的计时边界、最大恢复时间、恢复后观察窗口及容量、失败回退负责人；实测与批准目标逐项比较 |
| 批准绑定 | 发布清单F要求产品/技术/发布角色，财务在V1支付不适用 | 实际proposal_id、profile/恢复策略/权威文档SHA256、确认人/角色/时间、候选commit/build/image、适用窗口；修改后重新校验摘要，不复制旧批准 |

P6提案8并发、16Task、45秒总窗口、阶段累计10秒，Settings/Usage/admission/terminal p95建议300/400/800/5000ms、非预期错误0.5%、恢复30秒均保持 `engineering_proposal_unapproved`。可供校准比较，不能写成已冻结阈值。第6.3节的新发布输入建议与该历史profile分开，未经批准不回写其JSON。

RPO建议测量记录：故障/选定恢复点时间、恢复后最后完整可证明持久业务事实时间、丢失的run/task/object范围，跨存储按最差可恢复一致点计算；RTO记录从批准定义的故障起点到只读校验完成并允许写入的时间，阶段耗时分别保留。具体起止语义须随恢复profile正式确认，不能只取容器启动耗时。

O4覆盖本地加密记录恢复/撤销版本、PG/Redis依赖readiness；封存补读O7确认已有微型PG/两包文件/一Secret多存储恢复，首校验517ms、另production-authority本地模式507ms，observed RPO0ms；均非批准RTO/RPO或目标环境证明。O8尚未交目标规模的新恢复验收。必须区分实测、目标、环境与签署；旧镜像扫描阻塞不能因“无修复版本”自动豁免，RELEASE要求无阻断级问题，处理由实际安全/发布评审留证。

### 6.3 可一次性呈现的发布输入提案（全部 engineering_proposal_unapproved）

提案标识建议 `V1-RELEASE-INPUTS-r8-proposal`，仅为本工作包内评审标识，不登记新需求/ADR，也不写profile或approval文件。下面数值是**工程建议、未经执行/批准**；Lead应在候选实际结果齐备后一次呈现“建议值—实测值—差距—批准人”，而不是现在中断用户。任一硬规格失败先修复，不以签署豁免。

**先复用已经冻结的约束，不请求重复批准：**

| 已冻结项 | 来源和可直接复用值 | 边界 |
| --- | --- | --- |
| 权限/副作用/一致性 | FR001/003/005/014/015：拒绝无目标副作用；重复请求/终态无第二次执行或计量；审计失败不得无审计成功 | 任何此类异常数必须为0，不是允许0.5%业务错误 |
| 运行超时与重连预算 | [API]：设置读取2s、设置PATCH3s、Task submit10s、Task查询2s、流订阅5s及1/2/4s重连、Provider validate15s、目录refresh30s、连接测试15s | 属具体操作预算，不能改称p95/SLA；选定profile/adapter更严格时照原契约，不因压测放大 |
| 保留周期 | [D033/D035](../docs/06-决策记录/V1-冻结决策.md)：缓存/失败安装/撤销会话各事件起算30天，审计180天；Task/已提交Artifact保留到显式删除且引用优先 | 不是RPO/RTO，也不是备份必须只保留30天的推导 |
| 发行/恢复安全 | [RELEASE]/[ADR6]：无阻断级扫描问题、受控秘密/旧值失效、真实依赖/备份恢复不豁免，恢复先只读 | 产品/技术/发布批准必需，不能由Planner/脚本填名 |

**建议值和工程依据（可直接评审的字段）：**

| 待批准字段 | 工程建议值（unapproved） | 理由、适用边界和需附实测 |
| --- | --- | --- |
| `target_topology` / `resource_envelope` | 单机Compose：1 API + 2独立OS worker + 1 PG + 1 Redis +实际受支持包/Artifact存储与持久加密Secret；测试资源预算4 vCPU、8 GiB RAM、40 GiB可用SSD。macOS在一台支持的Apple Silicon机器、16 GiB RAM上验证同前端，实际OS/arch精确版本由F/B登记 | 贴合既有单机发行和跨worker恢复路径；资源是评审起点，不称最低配置。预算不足/性能不达时先给实测曲线，再修改提案；不强行新增对象存储适配或HA |
| `dataset_profile` | 单受控主体；种子数据1万条历史Task/Usage/Audit关联、100个安装/发行记录、合计1 GiB包/Artifact，正确摘要/引用；另用5 GiB对象集做恢复容量验证 | 覆盖非空分页、引用和磁盘恢复，范围有界。种子须走合法fixture/可验证导入，不制造第二管理员；若接近实际使用的数据更大，以实际规模重新评审 |
| `traffic_mix` / `task_shape` | 复用P6的7:2:1（Settings read:Usage query:Task submit），Task全部text.chat；输入≤1024字符、maxOutputTokens=128且不得超过所选冻结Profile限值，每Task持续读流、终态查询一次、Artifact读取一次 | 简化首次可复现比较且覆盖唯一示范APP；7:2:1只指主请求，后续事件/get/Artifact另统计，不能漏算实际负载 |
| `release_load` | 稳态主请求5 req/s，即目标0.5 Task/s；上限8个活跃Task/事件订阅，独立2 worker；真实外部Provider仅执行有预算的功能验收，不默认承担此合成负载 | 单主体多窗口的小规模起点，30分钟约900次提交，明显强于16Task smoke；不会把fixture性能许诺为商业Provider性能。生成器排队/达不到目标必须报告，不伪装为限流达标 |
| `stage_schedule` | 冒烟60s@1 req/s；校准2/5/10 req/s各120s；稳态30min@5 req/s；过载10/20/40 req/s各60s，最多32活跃Task，之后5min@2 req/s回稳观察；总Task提交硬上限3000 | 阶梯/稳态/恢复均有足够独立样本，资源仍有界。属于后续harness增强建议，**当前P6仅45s不能执行该计划**；先校准，再确认批准的发布负载。未触发实际容量拒绝须报告PERF04未证，不靠增压循环直到机器损坏 |
| `platform_latency_bands` | 复用P6建议：Settings p95≤300ms、Usage≤400ms、Task admission≤800ms；新增受控fixture首delta p95≤1000ms、Task终态p95≤5000ms；p99只观测报告，初版不伪定SLA | 只适用于上述资源/数据/固定TLS fixture（建议首delta固定延迟100ms、终态500ms并记hash），保留明显平台余量。实际Provider首delta/终态单列原始实测与所选协议超时预算，不能套5s fixture目标；用户得到的平台承诺与外部服务可变延迟须分清 |
| `errors_and_resources` | 稳态非预期错误≤0.5%；权限/审计/重复/丢失/负用量异常=0；1s采样；生成器CPU<70%，整机/服务预算内无OOM，PG连接峰值<配置上限80%；稳态最后10min RSS相对预热后10min均值增长≤10% | 延续P6错误建议但不允许安全/数据错误；资源斜率用持续采样判断泄漏，不能因GC单点抖动判定。若生成器饱和或采样漏失，批次无效而非调高阈值 |
| `overload_recovery` | 停止过载后30s内队列回到过载前基线区间（建议≤基线+1 Task），并在随后5min保持≤1.2×稳态p95、无异常残留Task/Quota | 30s沿用P6工程建议，给出可核对“回稳”定义。容量/限流拒绝码仅用已冻结实际入口语义；物理饱和未触发时须另外执行受控容量满场景并留证，不能用quota最后额度测试代饱和 |
| `backup_strategy` / `rpo_target` | 建议RPO≤15min：PG每日全量+持续WAL归档（归档滞后≤5min）；包/Artifact/Secret密文及必要版本配置增量同步≤5min，恢复集以一致manifest绑定；加密隔离存储保留7个每日完整集和最近24h增量 | 给单机受控数据合理且可验证的损失上限；必须全部存储满足同一恢复点。现工具未必支持该备份频率/对象版本保留，B应实测并报告实施差距，不能直接宣称能力已有；保留策略仍受引用/审计硬约束 |
| `rto_target` / `recovery_scope` | 建议RTO≤60min，范围为可取得已备份密钥材料/镜像的单节点重建、PG+5 GiB对象+Secret恢复及只读校验；故障注入/宣布恢复时刻计时，到允许隔离写入成功为止；根密钥不可恢复的情形必须单列失败 | 一小时是小型单机的工程起点，不是原规格SLA。不得从计时中扣掉服务启动/完整性检查，不包括未事先保管材料的无限等待；实际更大数据/远端恢复需重测提案 |
| `observation_windows` | 性能稳态30min、过载后5min；恢复后15min观察权限/撤销/队列/usage/audit健康；正式发行后60min有人值守，出现秘密泄漏/重复副作用/数据不一致立即止写并按回滚手册处理 | 窗口有限、可执行，区分性能与灾备/发行观察；没有现存冻结数字，不将本建议标已批准；Lead呈现实测后责任人一并确认 |
| `approval_record` | `status=unapproved`，`approved_by=null`，`approved_at=null`，`authority_digest=null`，`candidate_commit=null`（待实际候选）；建议提案ID如本节首行 | 只描述待填字段，不写正式evidence。最终填实际人/时间/hash/候选，不能拿baseline代commit，不能先审批后静默换profile |

给最终用户的最小批准项建议合并为三项：①实际部署/资源/数据规模及支持范围；②基于有效校准结果的负载、延迟/错误/回稳阈值和观察窗口；③备份恢复策略、RPO15min/RTO60min及恢复/发行窗口。技术负责人附实测与差距，产品确认适用边界，发布负责人确认实际窗口。必要的安全/一致性/签名/真实依赖证据是完成条件，不作为可选豁免项。当前无需向用户提问，Lead可先完成授权内候选并准备该一次性审阅包。

### 6.4 有界只读：Settings deny后的显式重新授权

**结论：冻结的“deny优先”描述当前有效规则的优先级，不是历史上出现过deny便永久不可授权。** [FR001规则8、主流程6及AC07](../docs/03-功能规格/V1/01-桌面与系统/01-桌面与应用工作区.md)同时要求“用户按能力和范围调整allow/ask/deny；下一次调用重新判定”以及“当前决定为deny时执行请求不得改变权限或产生副作用”。[D025](../docs/06-决策记录/V1-冻结决策.md)写的是“deny在执行层优先”；[运行时契约4.3](../docs/04-技术架构/当前版本/V1-DGOS应用清单与运行时契约.md)写的是“按有效策略重新计算，任一更高优先级deny直接拒绝”。因此低权限APP、manifest声明或旧ask确认票据不能覆盖仍有效的高优先级deny；有权管理者显式修改其可管理的同一规则，是另一种被鉴权/审计的操作。本文不新增规则层级、永久封禁或管理员越权能力。

本次事件来自Lead转达：D在15200将同主体 `dgos.extensions / skill.read / *` 设deny后，Settings直接allow403。Planner没有读取D数据库、调用API或复现；下列运行行为均标为源码静态推导，真实结果由D/Verify记录。

| 静态落点 | 实际行为 | 与冻结语义的关系 |
| --- | --- | --- |
| [PG权限repository](../src/permissions/postgres-repository.mjs) `writeDecision` L25–34、`writeSystemRules` L36–39 | 只有 `denyPrecedence && new=allow && prior=deny` 才403；同键UPSERT递增policyVersion并同事务audit/outbox；Settings固定开denyPrecedence | 把同条**旧状态**当deny阻止新allow，未区分当前并存规则/历史状态；这不是永不可恢复，因为deny→ask不被此条件挡 |
| [System权限适配](../src/system/permission-rules.mjs) L25–58、L67–89 | PG/内存均检查主体、声明、System baseVersion和幂等receipt；同一个batch重复tuple拒绝；更新Settings/context版本、事件和审计原子提交 | 可用两个分别显式确认的版本化请求替换同条管理规则；不能一个batch放ask+allow绕唯一tuple校验，也不能复用旧requestId改变意图 |
| [System公开路由](../apps/api/src/system-routes.mjs) L34–51 | appPermissions要求system.settings.write + permission.manage、fresh管理员Session、CSRF、body主体等于认证主体；GET读真实Permission rows | 已在主OpenAPI声明的管理路径，具有现有权限/新鲜度/CAS/context语义；不能免掉这些前置 |
| [Broker](../src/permissions/broker.mjs) L7–34；PG `resolveRequest` L66–73 | check当前tuple和声明；deny不创建ask请求；审批pending请求仍启用denyPrecedence | 旧ask请求不能在后来deny后approve；request本身不等于写allow。D不应靠重复request解锁deny |
| [API server](../apps/api/src/server.mjs) L154–169、L241–248：PATCH `/api/v1/permissions`→decide | route可达，scope/CSRF及主体约束后直接decide，未调requireFreshSession；PG decide未开denyPrecedence，也不更新System版本/context | 本次主[OpenAPI](../docs/04-技术架构/当前版本/V1-openapi.yaml)仅有permissions/check、request，未登记此PATCH；不能把它作为已冻结等价管理捷径。缺fresh/CAS/context的一致性需Lead窄核验，不据可调用就推荐给D |

**现有已声明的公开恢复路径（静态可行、尚未运行）：** 同一已认证主体以仍有管理权限的fresh Session打开Settings，读最新System快照确认目标tuple及`settingsVersion=V`。显式将该条从deny改为ask，等待200与返回真实appPermissions/新版本；这一步仍不授予Skill读取。随后由管理者另一次显式设置allow，带新的requestId和当前版本（必要时重新GET），等待200后才重新发原Skill definition GET。示意payload如下，`<…>`是运行时真实值，不得原样发送：

```json
{
  "requestId": "<new-id-ask>",
  "baseVersion": "<current-settingsVersion>",
  "domain": "appPermissions",
  "patch": {
    "rules": [{
      "appId": "dgos.extensions",
      "subjectType": "user",
      "subjectId": "<authenticated-principalId>",
      "capability": "skill.read",
      "scope": { "value": "*" },
      "decision": "ask"
    }]
  }
}
```

第二个PATCH仍为 `/api/v1/system/settings`，同一rule只将decision改为allow，requestId改成新ID，baseVersion取第一步返回或最新GET值。Cookie请求使用现有CSRF头/合法Origin，不把会话或秘密记入证据；skill.manage若后续需要仍须单独明确授权，不能因为read允许自动赋予manage。若出现409版本冲突，重新读当前值再由管理者确认；若存在另一个仍生效的更高优先级deny或管理权限自身不满足，不能以该序列覆盖其来源。D可继续隔离fixture，不影响15200；实际恢复仅由Lead协调D公开入口执行，无SQL修改。

复验出口：读到deny时原Skill GET403且无Prompt；ask提交后读取产生预期409/无Prompt；显式allow成功后原Skill GET200/no-store并只有真实成功读取审计；两次设置各有新policyVersion/System/context版本、permission.change与system.settings.patch/audit outbox，重复同意图不重复审计；中间失败保留当时ask或原deny，不声称完成。观察到两个200仍须核实际生效规则与原请求，不只看UI按钮。

**需Lead窄收敛的实现/契约差异：** 同一管理者同一tuple，Settings禁止直接deny→allow、允许deny→ask→allow，而未登记permissions PATCH可直接allow，产品体验和fresh/CAS/context约束不一致。已有文档足以排除“永久不可重新授权”；不足以将“必须两步ask”升级成新的业务规则。建议Lead按现有“用户可调整三态、执行时deny优先”解释，交原owner统一直接管理规则变更与旧确认请求防覆盖的边界，补公开路径/事务与负向测试；如果选择保留强制两步，则需明确该额外管理流程的依据后窄澄清，不能以现代码反写规则。本文仅提供可用现有路径及差异，不修改权限产品/测试/OpenAPI，不申请SQL旁路，不宣称D原环境已恢复。

## 7. Lead落地顺序与本包检查

1. Lead已完成第2/3节对应权威落地；本文保留审阅来源，不重复覆盖。新增IF8/A17/VR12/O7只按其实际等级核对剩余差距；历史报告/manifest原样保留。
2. 依第4/5节将每个AC剩余断言分配到当前owner报告/最终候选case；已完成的领域实现不再重派，缺完整证据则补验证。批准输入按第6节收敛，规格已可推导项无需再次询问用户。
3. owner停写后冻结source/package/dist/native/image/config与47迁移集合；Verify执行实际五组，D/F补同候选真实入口。保留失败/skip/排除原因，对修复生成新修订与新批次。
4. Lead再写权威状态、facts、正式evidence和实际审批；候选提交及发布操作另依用户授权。本Planner不执行产品、迁移、服务、网络链路、提交或推送。

实际检查（均未执行产品测试/SQL/服务/网络链路）：

| 命令/检查 | 结果与边界 |
| --- | --- |
| `node scripts/check-docs.mjs` | exit0，0 errors/3既有模板warnings |
| `node scripts/review-docs.mjs --phase planning` | exit0，SPEC_READY，0 errors/0 warnings/0 blockers |
| `node scripts/spec-docs.mjs facts-sync --check --json` | exit0，read_only=true，12 derived features、0 findings/drift、written=false；Lead已落地facts，Planner未写 |
| `node scripts/docs-gate.mjs --phase release --json` | ok=false，10 errors/1 warning；审批digest/proposal/3角色/date共6、commit缺1、development/e2e/release缺3；spec-diff48项、0 unbound。此为实际文档门禁失败，不是产品测试失败计数 |
| Python只读本稿链接/稳定ID/空白检查；`git diff --check -- .herdr/V1-STATUS-RECONCILE-r8.md` | 最终exit0；65个链接目标无缺失；62唯一AC、12FR、12首发E2E+16补充、7NFR、3RG覆盖；空白错误0。未写检查脚本文件 |

边界摘要：本轮所有apply_patch只作用于 `.herdr/V1-STATUS-RECONCILE-r8.md`。共享目录的权威状态/facts/evidence由Lead并发修改，不能再声称它们全程hash未变；没有回滚或覆盖。读取到Lead落地后的SHA256：状态 `171693de2c98c70c66aed5a5bc9b4c5104533e7a4c1a56f4072263bba3bf98ff`；facts `24e536b7c2e9247152e8a5e2c942cc07b235174bd4feb9acfa22268b71acb2f5`；evidence `6d9ceacd461b7123d3175fe9b7954412ddb212dca8611238df467b1f4e68bd9c`；主OpenAPI仍 `95e728b91526b37101cb7156b578e288acabe95b6b0583764785ca87f9898dff`。这是读取时点，不是候选冻结签名。

权限只读结论绑定的源码SHA256：PG repository `a2a7aa4be9ce2ad6ddc1541886ef4af3d87c16d5a18dc489ff2529f87314e411`；Broker `49b125e11a7f748ce3a48f795f96dcb4e773752759b7cbe93b032817d88f2425`；System权限适配 `76dd0f956225232e15abb8fd5273c3f9c4510b87fdde2284c4b9f0a53666070e`；System routes `9b1b6b56494a3b848ed5a1178c684a37b24704b2161988797adbdbe0a1242290`。后续改代码须新报告；本文不宣称D15200 deny已恢复。

next_action：Lead接收本稿第6.4节权限结论与第6.3节unapproved具体提案；当前继续已分派候选工作，之后一次呈现实际结果与最小批准项。Planner完成引用核验后停写，新增结果另派回写。

### 引用定义（本文相对路径）

[STATE]: ../docs/02-产品与版本/当前版本/V1-实现状态.md
[IDS]: ../docs/03-功能规格/V1/00-V1需求编号.md
[MATRIX]: ../docs/05-测试与发布/端到端验收/用例矩阵.md
[RELEASE]: ../docs/05-测试与发布/发布/检查清单.md
[DEPLOY]: ../docs/05-测试与发布/发布/部署配置.md
[RESTORE]: ../docs/05-测试与发布/发布/恢复手册.md
[PERF]: ../docs/05-测试与发布/性能与容量/README.md
[PERFM]: ../docs/05-测试与发布/性能与容量/场景矩阵.md
[ADR6]: ../docs/06-决策记录/ADR/0006-V1事务存储与迁移恢复.md
[API]: ../docs/04-技术架构/当前版本/V1-接口契约.md
[ERRORS]: ../docs/04-技术架构/统一错误码.md
[AC4]: V1-AC-CLOSURE-r4.md
[F6]: V1-DESKTOP-r6.md
[A9]: V1-WORKBENCH-r9.md
[D5]: V1-UI-r5.md
[D6]: V1-UI-r6.md
[G11]: V1-PACKAGES-r11.md
[G9]: v1-retention-packages-r9.md
[E6]: V1-EXT-r6.md
[H7]: V1-EXT-PUBLIC-r7.md
[ES8]: V1-EXT-SANDBOX-r7.md
[H6]: V1-PROVIDER-r6.md
[H4]: V1-PROVIDER-r4.md
[B5]: V1-TASK-r5.md
[Q6]: V1-QUOTA-r6.md
[A8]: V1-ACTIONS-r8.md
[C12]: V1-IDENTITY-r12.md
[C11]: V1-GOV-r11.md
[C15]: V1-SECRET-AUDIT-TEST-r15.md
[I7]: V1-NETWORK-r7.md
[L9]: V1-INTEGRATION-r9.md
[O4]: V1-OPS-r4.md
[O8]: V1-OPS-RELEASE-r8.md
[P6]: V1-PERFORMANCE-r6.md
[VR10]: ../docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T01-52-18-203Z-82727f18.md
[A16]: V1-ASSISTANT-RESOLVE-r16.md
[ER9]: V1-EXT-READ-r9.md
[IF8]: V1-PROVIDER-FAILURES-r8.md
[A17]: v1-provider-probe-fix-r17.md
[O7]: V1-OPS-RELEASE-r7.md
[VR12]: V1-CANDIDATE-RUNNER-r12.md
