# V1 剩余任务书 r18 — Planner / 2026-10-02

- status: ready（依赖与限定工作可派发；后续包仍须Lead登记修订/移交，未宣布产品完成）
- work_package: V1-GAP-RECONCILE / revision 18
- delivery_id: DGOS-V1-IMPLEMENT-20261002
- slice_id: V1-platform、V1-ai-task、V1-assistant、V1-release
- objective: 将62AC剩余验证、已观察阻塞和发布输入按依赖收敛，避免重开已证实修复或合并不同批次为当前通过。
- authority_files: [版本总览][VERSION]、[唯一状态][STATE]、[编号][IDS]、下列F01–F15主规格、[E2E规范][SPEC]与[发布清单][RELEASE]。
- dependencies: [r18现行派包][PACK]、[本轮事实核对][REPORT]、[R8逐AC历史底稿][R8]及本页引用的已落盘证据。
- parallel_work_packages: 当前仅Verify r15、B r10、F r11、D r8；本页P1–P6为Lead后续调度建议，不自动恢复历史working包。
- blocking_decisions: 已冻结产品语义无新增问题；尚缺实际目标环境、真实Provider、发行身份、批准负载/恢复目标与发布审批。
- required_writeback: Lead依据独立验证更新唯一状态、功能证据导航、facts、正式evidence/批准；Planner本轮只交两份r18报告。

## 1. 来源、范围与依赖顺序

基线HEAD `72ab1cb98b064a6e27b9f60a9f8f00881a827a99` 加共享未提交源码。V1为12 active功能、62AC、12首发E2E、7NFR、3RG；47冻结SQL截止0051。规格Ready不等于验收通过。R8表及AC资产盘点作为历史来源，D7/I8/B8/N10增量优先；最终实现状态仍只读[STATE]。

| 引用 | 精确来源与证明范围 |
| --- | --- |
| R8 | [状态核对r8][R8]第1/4/5/6节，原62AC已有子集、剩余分支和未批准发布输入；其过时“待修”由下列增量修正 |
| D7 | [浏览器r7][D7]、[配对manifest][D7M]；真实管理7+受控取消1、隔离管理3、工作台4/参数skip；UI2和普通workbench30含route-mock，见REPORT |
| I8 | [探测失败矩阵][I8]及其修后原始JSON/log/manifest；8/8本地真实PG/Redis/TLS/独立worker，非付费外部Provider |
| B8/B9 | [ops r8][B8]真实镜像运行与最终E hash Linuxcanary；[r9安全记录][B9]和[完整r9扫描][SCAN]，不能跨镜像转移结果 |
| N10 | [r10原生][N10]及[失败manifest][N10M]；四个准备阶段成功，GUI timeout，未获签名工作台业务证据 |
| C16 | [47迁移harness修订][C16]，工具2/2；新版identity/performance实际运行待安排 |
| V14 | [覆盖r14目标][V14]由r18 Verify r15继承；[r13 binding][V13]定义完整dist/config/envelope/image身份 |

顺序：**当前三恢复包 + D只读盘点 → 补未覆盖业务断言/局部诊断 → 全部停写 → 最终source/dist/包/native/image/config/47SQL身份冻结 → 独立五组及公开业务harness + Web/native → 62AC/12E2E/7NFR逐项核验 → 真实目标/性能恢复/签名与发布材料 → 权威回写和release门禁**。过程中任何实际失败仅重开相应owner边界并产生新批次；不把旧失败擦成成功。

## 2. 62AC逐项剩余出口

下表每行对应一个稳定AC；Fxx指该功能权威主规格及其测试映射，R8指该AC已记录的局部证据。全部行都还须最终候选身份与真实报告/日志绑定，因此“已有”不是当前AC Passed。`V`=验证/断言资产待补或重绑，`M`=已有实际失败需修复/诊断，`X`=真实外部或发布输入。P1–P6责任边界见第4节。

| 稳定AC | 已有证据及来源 | 有限剩余出口 / 承接 |
| --- | --- | --- |
| V1-FR-001/AC01 | [F01]；R8 F6窗口；N10可见窗口但桥timeout | M/V：F r11真实启动/聚焦/最大化/恢复与拒绝不新建窗口；P3同候选原生 |
| V1-FR-001/AC02 | [F01]；R8 G11包校验子集 | V：真宿主坏签名/资源拒绝，requestId、旧安装/窗口保持，0新运行/外发；P1/P3 |
| V1-FR-001/AC03 | [F01]；D7目录与设置读子集 | V：系统信息/我的软件权威状态及来源、service_unavailable不写空状态；P1/P3 |
| V1-FR-001/AC04 | [F01]；R8 A9 context fixture；D7 UI布局fixture | V：真实APP订阅同context版本，主题/材质/125%原生倍率传播；Web与native均验，CSS缩放不代原生；P1/P3 |
| V1-FR-001/AC05 | [F01]；D7双语布局只含fixture | V：英文UI+大陆格式+中文助手独立消费、旧APP明确回退、私有内容不变；P1/P3 |
| V1-FR-001/AC06 | [F01]；R8 I7公开provision/PATCH/CONNECT子集 | V：真实GUI秘密provision/保存脱敏、restartRequired/部分重启与各消费者路由；worker Action实际PG/CONNECT；X目标代理/Secret；P1/P2/P5 |
| V1-FR-001/AC07 | [F01]；D7原Skill显式重授权及助手deny已有 | V：APP/助手文件写deny、MCP/目标文件/权限/状态副作用0与审计；重授权无需重复修复；P1/P2/P3 |
| V1-FR-001/AC08 | [F01]；R8 A9撤权轮询、包HTTP权限子集 | V：APP仍启动/context可读、MCP denied、0外调、状态保持；真实双宿主而非仅桥fixture；P1/P3 |
| V1-FR-002/AC01 | [F02]；R8 G11严格包输入/签名 | V：真实开发者入口字段定位，坏资源拒绝0安装/目录/进程；X正式信任根；P1/P2/P5 |
| V1-FR-002/AC02 | [F02]；R8 G11公开健康回滚/锁 | V：同候选不可覆盖发布、健康失败和中断恢复旧包/数据，跨进程竞争；P2/P3；不采信旧skip |
| V1-FR-002/AC03 | [F02]；G11五类目录公开链、D7签名包启动 | V：五类包/角色浏览器入口、未审核普通用户不可见/开发测试、预装拒卸载及更新CAS/数据保持；P1/P2 |
| V1-FR-003/AC01 | [F03]；R8 E/H领域及公开Run | V：最终sandbox后missing/disabled/deny不建Task/Run/进程、精确依赖/主体；B r10 Linux正负例；P2/P3 |
| V1-FR-003/AC02 | [F03]；R8 E超时/恢复子集 | V：真实UI超时标识、查询/取消/关页恢复，同Run及调用/Artifact不重复；P1/P2 |
| V1-FR-003/AC03 | [F03]；D7真实需凭据MCP连接发现 | V：真实配置编辑非法命令/cwd/env保持旧状态、错误脱敏/可重试不重复进程；X目标OS；P1/P2/P5 |
| V1-FR-003/AC04 | [F03]；D7原Skill改名/启停及翻译Task→Artifact→CAS apply | V：完整导入/`/技能名`调用/引用移除保护；同候选重放；不再列翻译全无证据；P1/P2 |
| V1-FR-003/AC05 | [F03]；D7需凭据首装历史结果，R8后端模板 | V：无需凭据与需凭据双GUI样本、缺凭据拒保存/连接、日志/存储脱敏；首装分支必须真实执行；P1 |
| V1-FR-003/AC06 | [F03]；D7启用/连接/工具发现和Run | V：独立状态/工具数、重复重连唯一、活跃Run/依赖拒删除且数据保持；P1/P2 |
| V1-FR-003/AC07 | [F03]；D7自定义Skill，R8 H7可信在线preview | V：真实在线风险/权限预览→确认、拒不可信/无确认不安装；稳定ID与显示名，shell输入不执行；P1/P2 |
| V1-FR-003/AC08 | [F03]；R8 daemon恢复，D7受控MCP调用 | V：bundled双凭据/健康条件、关页后同Run查询取消/无重复；最终Linux正常/负例；P1/P2/P3 |
| V1-FR-005/AC01 | [F05]；D7签名包真实Task/Artifact；N10业务链失败 | M/V：F r11修复后与Web同候选握手/终态/展示；X真实Provider；P3/P5 |
| V1-FR-005/AC02 | [F05]；R8 H6已发送未知不重发，D7旧Task零submit恢复 | V：双击/中断/失败重试/取消完整UI，无第二Task/Provider/Artifact；未知ID不盲重发；P1/P2/P3 |
| V1-FR-005/AC08 | [F05]；R8首delta早EOF，D7reload恢复 | V：有序流、游标去重/断线重订/stream.reset及权威终态同Task，秘密扫描；native真实链；P1/P3 |
| V1-FR-007/AC01 | [F07]；D7公开配置入口、R8 D5probe/显式ready/validate/refresh | V：同候选独立验证与刷新两步，失败不启用/不回显秘密，requestId/digest；P1/P2 |
| V1-FR-007/AC02 | [F07]；R8 H6dispatch前重检 | V：更新/验证失败原子disabled、selector同步、新submit/dispatch拒绝、旧Task可查；刷新失败保留目录/策略；P1/P2 |
| V1-FR-007/AC04 | [F07]；R8 H6 Responses/Chat/Profile | V：统一descriptor和未注册/不兼容协议拒绝，0新模型/外调；X真实TLS Provider；P2/P5 |
| V1-FR-007/AC05 | [F07]；R8 D5文本策略，D7模型列表子集 | V：分类/每能力默认，非文本/未分类/过期不进选择器、CAS冲突无副作用真实UI；P1/P2 |
| V1-FR-007/AC06 | [F07]；R8 H4 API no-export | V：真实Web/native无导出入口或可导入秘密摘要，响应/日志/浏览器存储检查；P1/P3 |
| V1-FR-007/AC07 | [F07]；R8 H目录/策略、D5显式刷新 | V：重复刷新并发唯一、失败旧目录/历史保留、audit原子；完整分类/default UI；P1/P2 |
| V1-FR-007/AC08 | [F07]；H6参数快照，D7参数Task测试未运行 | V：当前47SQL的Profile defaults/limits/uiSchemas/assets映射与待配置/冲突负例；真实参数Task新批次；P1/P2 |
| V1-FR-007/AC09 | [F07]；R8 H6白名单执行/非法输入0副作用 | V：旧Task不可偷换Profile、脚本/任意URL/未声明字段/媒体拒绝、失败无成功Artifact；X真实Provider；P2/P5 |
| V1-FR-009/AC01 | [F09]；D7真实解析/执行/导航，A resolver修复已加载 | V：无Provider的快捷指令真实入口与失败0模型/副作用，原生；不用重复修requestId；P1/P3 |
| V1-FR-009/AC02 | [F09]；D7真实deny无candidate/plan/run | V：missing/disabled/unavailable、历史稳定引用及同名不替换，handler0；P1/P2 |
| V1-FR-009/AC03 | [F09]；D7真实高风险privacy确认审计、H权限申请 | V：未确认/取消/过期/改input不执行，fresh重检；ask分支新批次确实进入；P1/P2 |
| V1-FR-009/AC04 | [F09]；R8包Action lifecycle领域/公开包 | V：签名包安装/更新/卸载联动目录/registryVersion/历史missing、主体隔离；P1/P2 |
| V1-FR-009/AC05 | [F09]；D7排队取消+刷新终态已有 | V：running/关页/断线、独立进程恢复及下游Task取消，原Run/handler不重复；排队取消不替代running；P1/P2 |
| V1-FR-009/AC06 | [F09]；D7privacy显式确认审计、R8 A原子receipt | V：低风险与公开APP配置、高风险过期/CAS/能力冲突保持原值，双scope/freshness/网络worker真实链；P1/P2 |
| V1-FR-010/AC01 | [F10]；R8 C12引导竞争20项子集 | V：C16新版47迁移harness引导一主体/审计，失败无半会话；真实首次UI；P1/P2 |
| V1-FR-010/AC02 | [F10]；R8 C12双API共享Redis退避 | V：新版候选登录不可枚举、依赖fail-closed，目标实际拓扑/传输；P2/P5；双API不称双OS |
| V1-FR-010/AC03 | [F10]；D7两设备指定撤销/登出 | V：native/Web会话与bridge票据撤销即时失效、非目标Session保留、renew竞态；P2/P3 |
| V1-FR-010/AC04 | [F10]；R8 C12/A8 stale gate、Lead legacy gate窄修 | V：全高风险入口再认证清单与真实UI恢复、expired不续活、无状态变化；P1/P2/P3 |
| V1-FR-011/AC01 | [F11]；R8 C12一次性明文/脱敏 | V：真实UI仅一次展示、刷新不可再读、日志/浏览器存储与Secret故障无残留；P1/P2/P5 |
| V1-FR-011/AC02 | [F11]；R8 C12 scope和委派负例 | V：完整公开能力scope∩资源归属，伪admin/owner拒绝、0副作用并审计；P2 |
| V1-FR-011/AC03 | [F11]；R8 C12有限overlap已实现验证 | V：新版harness/UI显式撤旧或窗口到期，rotationGroup/audit、失败保旧Key/补偿；P1/P2 |
| V1-FR-011/AC04 | [F11]；R8 C12跨实例过期/撤销 | V：目标部署缓存/实际进程失效、资源不变及可审计；P2/P5 |
| V1-FR-012/AC01 | [F12]；R8 H6账号/Secret，D7设置子集 | V：一次性输入/脱敏、Secret故障无可用账号；X正式Secret/外部Provider；P1/P2/P5 |
| V1-FR-012/AC02 | [F12]；R8 H精确绑定/准入 | V：跨主体/协议不兼容/并发CAS不部分绑定、管理UI稳定错误；P1/P2 |
| V1-FR-012/AC03 | [F12]；R8 H6配置/策略禁用dispatch拒绝 | V：账号disable传播所有绑定/selector，新submit/dispatch拒绝、运行任务与历史可查；P1/P2 |
| V1-FR-012/AC04 | [F12]；R8领域引用保护 | V：配置/queued-running Task/ConnectionTest活动引用拒删、脱敏摘要、解除后Secret撤销补偿；P2 |
| V1-FR-013/AC01 | [F13]；H6成功设置链，D7读取测试状态 | V：精确test/config/protocol版本、耗时/requestId、目录/Task无变化，当前UI与候选；P1/P2 |
| V1-FR-013/AC02 | [F13]；I8修后真实8/8 | V：后续server变化后重绑/重放错误分类和无Task/catalog/quota/秘密副作用；无需重修429/畸形200；P2 |
| V1-FR-013/AC03 | [F13]；R8 TLS pinned/CONNECT资产 | V：混合DNS/IPv6/重定向/主体拒绝请求前0网络、审计脱敏；X真实CA/DNS；P2/P5 |
| V1-FR-013/AC04 | [F13]；I8取消247ms/timeout/重启终态唯一 | V：最终候选重放和UI状态；保留重启2次上游的不确定性边界，非至多一次宣称；P1/P2 |
| V1-FR-014/AC01 | [F14]；D7治理/privacy审计，R8事务子集 | V：全部设置/权限/Provider/审核/扩展高风险入口requestId与audit/outbox对应，失败目标不变；P2 |
| V1-FR-014/AC02 | [F14]；C11自审计/分页、D7治理查询 | V：当前权限/游标/脱敏及审计失败不返回数据，真实UI；P1/P2 |
| V1-FR-014/AC03 | [F14]；C11真实PG回滚，C15假pool另列 | V：全高风险域Audit/outbox故障矩阵与父事务原子性，含Provider refresh/扩展/Secret；P2 |
| V1-FR-014/AC04 | [F14]；R8 G9/G11分类/引用/磁盘恢复，D7preview | V：最终preview→execute/checkpoint/引用复查及Task/Artifact保护；X生产规模/恢复；P1/P2/P4 |
| V1-FR-014/AC05 | [F14]；C11双fresh CAS，D7政策更新 | V：真实双写冲突UI/刷新、单版本单审计；已有CAS实现无需重开；P1/P2 |
| V1-FR-015/AC01 | [F15]；R8 B/H原子准入与翻译结算 | V：Task/Skill翻译各入口quota拒绝0attempt/外调/残留Task/reservation，旧任务保持；P2 |
| V1-FR-015/AC02 | [F15]；R8 Q6真实PG竞争 | V：最终最后额度竞争无半Task/预留，记录实际多worker领取而非仅存活；P2/P4 |
| V1-FR-015/AC03 | [F15]；R8 B/H已发送未知needs_review | V：全终态唯一结算/释放及reconciliation按原Task恢复不重发；当前源无漂移；P2/P4 |
| V1-FR-015/AC04 | [F15]；R8缺失usage资产 | V：可信usage/estimated/unavailable各有来源断言，无值不造实测；X真实Provider；P2/P5 |
| V1-FR-015/AC05 | [F15]；D7真实策略表单，Q6scope负例 | V：真实用量筛选汇总/策略CAS、Key范围与拒绝无目标副作用；策略创建不代查询全链；P1/P2 |

## 3. E2E/NFR/RG的完成出口

| 首发E2E | 本页AC归属与必要证据 |
| --- | --- |
| V1-E2E-01 | F01 AC01/03；F真实窗口/工作区恢复及拒绝，N10失败必须保留 |
| V1-E2E-02 | F02 AC01–03；公开package12固定case_passed与真实宿主/目录角色/回滚组合 |
| V1-E2E-03 | F03 AC01–08；公开扩展8/12、GUI管理/双模板/持久Run、最终OS隔离 |
| V1-E2E-05 | F05 AC01/02/08；签名工作台Web/native真实Task/SSE/Artifact/恢复，真实外部依赖另验 |
| V1-E2E-07 | F07八AC；Provider显式两步、失败准入/Profile/策略/无导出完整断言 |
| V1-E2E-09 | F09六AC；D真实导航/deny/高风险/queued-cancel/ask批准至少五标题合取，生命周期/running恢复不可遗漏 |
| V1-E2E-10 | F01 AC04–08及F09配置；Web/native各自真实context/权限，mock标题或native入口一条不足 |
| V1-E2E-11 | F10四AC；C16新版identity20与双宿主/高风险入口/目标拓扑 |
| V1-E2E-12 | F11四AC；当前有限overlap/撤销/一次性UI/Secret及权限矩阵 |
| V1-E2E-13 | F12/F13八AC；账号完整管理/探测8场/SSRF/UI与目标TLS |
| V1-E2E-14 | F14五AC；全域审计原子性/查询/清理/冲突与目标保留 |
| V1-E2E-15 | F15五AC；全部入口准入、结算/未知/查询隔离和可信usage |

V1-E2E-16仅API补充，不替代以上12项。归属以[SPEC]与编号为准，不把回归文件总数或一个聚合标题当完成率。

| 横向项 | 待闭合内容 / 对应包 |
| --- | --- |
| V1-NFR-001 | 全入口权限/秘密/iframe撤权、Linux/macOS sandbox正常和负例、最终漏洞处理；P1/P2/P3/P5及B/F当前包 |
| V1-NFR-002 | Task/Action/扩展/清理故障窗口、receipt/引用及多存储恢复；P2/P4 |
| V1-NFR-003 | 包校验/不可覆盖/真实宿主回滚、正式信任根/签名；P2/P3/P5 |
| V1-NFR-004 | 凭据无导出/日志存储不泄漏、正式根密钥轮换/撤销/恢复；P1/P4/P5 |
| V1-NFR-005 | UI-AC-001–006双宿主、主题/地区/助手语言/材质/原生倍率、键盘及辅助技术；P1/P3；fixture2/2不足 |
| V1-NFR-006 | 精确版本Profile/统一descriptor、白名单/负例/不可变Task快照与真实Provider；P2/P5 |
| V1-NFR-007 | 签名APP同Task有序增量/断线游标/reset/权威终态与Artifact；P1/P3 |
| V1-RG-001 | 本轮SPEC_READY及62映射已核；Lead仍需审48项spec-diff来源和实际证据回写，不重置基线消告警；P6 |
| V1-RG-002 | 双宿主同候选工作台握手/文本终态/可读展示及真实Provider；P3/P5 |
| V1-RG-003 | 平台全AC与治理/安全/回滚/目标恢复和真实审批；P1–P6；现release10错误仍阻断 |

## 4. 依赖化执行工作包

所有后续包共用读取顺序：AGENTS→角色→docs入口/开发流程→本页对应Fxx/SPEC/公共契约→原始报告/manifest→目标测试/实现。公共schema、47SQL、签名包字节保持既有冻结输入；若发现与规格冲突，回Lead收敛，不由Worker改口径。后续共享目录写入先登记精确文件并收原owner停写；默认采用独立worktree，跨包共享服务按Lead窗口串行。

### 当前已授权包

V1-CANDIDATE-COVERAGE r15、V1-IMAGE-SECURITY r10、V1-NATIVE-EXECUTION r11的Ready、允许路径、资源和验收详见[REPORT第4节](V1-GAP-RECONCILE-r18.md#4-三个恢复包-ready-与并行边界)，唯一授权仍为[PACK]。D V1-UI-INVENTORY r8只盘点，不执行下列P1。Verify只运行工具测试，B/F局部诊断都不作统一候选验收。

### P1：V1-REMAINING-BROWSER（建议D，后续修订由Lead登记）

- mode/slices: verification；platform/ai-task/assistant。
- objective/acceptance: 逐本页P1行补真实浏览器剩余分支，特别是无凭据MCP、在线Skill确认、APP上下文/语言/代理、Key、Provider失败筛选、Action运行中恢复、完整用量；已通过标题重跑用于当前候选绑定，不重开旧已修实现。
- allowed_paths（移交后）: `apps/web/e2e/real-management.spec.mjs`、`real-management-fixture.spec.mjs`、`real-workbench.spec.mjs`、必要的新 `apps/web/e2e/real-context-permissions.spec.mjs` 与自身证据。实际产品缺陷由Lead单列精确`apps/web/src/`文件窄修；本建议不预授整棵Web写权。
- dependencies: D r8盘点、F r11停止使用现dist后才可改Web/dist；H fixture变更需Lead另移交 `scripts/v1-ui-management-fixture.mjs`；模板无凭据样本在server配置真实登记，不能拦截业务响应。身份/业务修复另依P2。
- resources: D15200服务组和H15175–77由各owner协调；最终批次前固定source/dist/运行配置。凭据只通过原私有输入供执行者使用，不进入报告。
- command entry（计划，未执行）: 仓库根 `REAL_MANAGEMENT_FIXTURE=1 WEB_EXTERNAL=1 WEB_BASE_URL=http://127.0.0.1:15176 pnpm --filter @dgos/web exec playwright test -c playwright.config.mjs e2e/real-management-fixture.spec.mjs --workers=1`；D组使用已载入私有`REAL_ADMIN_ID/REAL_ADMIN_CREDENTIAL`及 `WEB_EXTERNAL=1 WEB_BASE_URL=http://127.0.0.1:15203 pnpm --filter @dgos/web exec playwright test -c playwright.config.mjs e2e/real-management.spec.mjs --workers=1`。
- execution requirements: 原Skill恢复设`REAL_SKILL_ID`为原标识；参数场景显式`REAL_PARAMETER_TASK=1`且新建本批独占Profile，signed package设`REAL_PACKAGE=1`，恢复设本批真实`REAL_TASK_ID`。queued取消只在D控制暂停worker窗口设`REAL_ACTION_CANCEL_QUEUED=1`并 `-g 'real queued assistant run'`，验后恢复ready。不得由Planner/Verify擅停D服务。
- output: 新run_id/raw Playwright日志、每分支前置与实际receipt、精确source/dist/candidate绑定、状态/调用次数/审计、清理及停写。**MCP已安装或权限已allow时，要显式标未覆盖首装/ask，不可因标题passed关闭该分支。**

### P2：V1-REMAINING-PUBLIC-AND-FAULTS（建议Verify统筹，领域owner按窄缺口补）

- mode/slices: verification；platform/ai-task/assistant。
- objective: 执行五组和真实公开harness、按本页P2行核验领域故障/并发/无副作用断言；先检查既有实际测试，确无断言才补资产，失败才派产品修复。
- allowed_paths（派发后）: Verify保持当前runner/tooling边界和新证据；必要业务断言按域分给Actions、Identity/Governance、Provider/Quota、Extensions、Packages原owner的精确测试文件，主server/worker由Lead独占。不同测试共用PG/端口仍串行。
- dependencies: Verify r15工具停写/独立通过、B/F/P1修复停写、Lead冻结binding。C16新harness必须实际执行，不沿用旧identity20。
- planned commands: `node scripts/v1-identity-http.mjs`（15121–22/Redis3）；`node scripts/v1-extension-management-http.mjs`（15173–74/Redis5）；`node scripts/v1-extension-http.mjs`（15141–49/Redis4）；`node scripts/v1-package-http.mjs`（15161–69）；`node scripts/v1-provider-http.mjs`（15171–72/Redis5）；`node scripts/v1-provider-failures-http.mjs`（15181–89/Redis5）。这些是已有入口，不是Planner已执行；实际父库/环境以各harness guard及r15最终可执行命令为准，不把统一URL强灌所有脚本。
- candidate command（已有r13形式，须采纳r15最终回执校验）: 在Lead准备真实 `.herdr/state/v1-final-candidate-bindings.json` 且私有`DGOS_VERIFY_ADMIN_URL`指向允许的独占父库后运行 `node scripts/v1-candidate-run.mjs --bindings .herdr/state/v1-final-candidate-bindings.json`。业务runner若新增，由r15给出精确命令后接入，不预填不存在的CLI。
- isolation: Verify父库127.0.0.1:5432/dgos_v1_integrated派生随机child；PG/extension同child、workflow admin传child非parent，Redis6和TLS5精确prefix，workflow超时>90秒；其他harness沿用自身parent/随机child；禁止原业务库/FLUSH/清理其他owner。命令前核实当前端口归属，P1/H活服务不能被覆盖。
- output/acceptance: 逐文件exit/TAP/pass/fail/skip/log/hash、固定业务case与结构断言、47迁移摘要、前后source identity、精确清理；缺项列uncovered并失败。内存/PG不能单独声称完整E2E；五组host Node不冒充image内执行。

### P3：V1-SAME-CANDIDATE-HOSTS（Lead组织D/F/Verify串行封存）

- mode/slices: verification；platform/ai-task/assistant/release。
- objective: 在F r11已证明可用GUI路径后，将Web与macOS业务、context/权限、会话和UI-AC绑定到同一最终候选，关闭本页P3行。
- allowed_paths: D/F仅各自测试/证据；Lead写bindings，Verify写新候选报告；所有产品写入先停止。发现必须改产品则退出冻结、窄修、新run_id。
- dependencies: 当前恢复包、P1/P2资产到位；B最终image与全部source一致。绑定完整递归dist/native文件、签名envelope/trust根和12项非秘密config输入（详V13），不只index.html；不采集fixture私密文件正文。
- planned native commands: `cargo tauri build --config '{"build":{"beforeBuildCommand":""},"bundle":{"targets":["app"]}}' --debug --bundles app -- --jobs 1`；`node apps/desktop/scripts/candidate-preflight.mjs`；`node scripts/v1-desktop-real.mjs`；必要可见窗口检查 `node apps/desktop/scripts/visible-macos.mjs`。这些是局部debug/本地验收入口，发行签名属P5。重建必须使用最终不变Web dist。
- acceptance: 两宿主实际Window/APP/context/权限/Task/SSE/Artifact/reload断言，否定分支外调/写入0，真实日志/截图及必要人工可见性/辅助技术记录。native入口标题不代context；同HTML而JS变更必须失败；全部用例不足时candidate_complete=false。
- output: 五组+公开业务+Web/native同source/build/runtime的manifest，以r15最终schema组合 `node scripts/v1-regression-sweep.mjs --summarize <本批实际manifest路径列表>`；尖括号仅表示运行后生成的路径，不能原样执行或借旧报告。报告应列12E2E和未覆盖分支；产品验收与发行证据分层。

### P4：V1-TARGET-PERFORMANCE-RECOVERY（建议B，性能脚本须C明确移交）

- mode/slice: verification；release，关联F14/F15与NFR002/004。
- allowed_paths（移交后）: `scripts/v1-performance.mjs`及其tooling由C停写后单独移交；B保持ops目录/脚本/证据。性能文档、profile/恢复策略由Lead安排Planner另包起草，不在本r18写权内。
- dependencies: P3候选、目标资源/数据集、批准profile/阈值/恢复目标；可先执行授权范围内有界校准，但结果保持工程观测。
- planned entry: `node scripts/v1-performance.mjs` 仅是现有受限smoke入口，当前不能执行R8提案的30分钟稳态/阶梯/过载计划；实现/复核对应harness后才运行正式profile。ops既有 `scripts/v1-ops-multistore.mjs` 等入口按其guard/目标配置执行，由B提供完整实际参数，不以脚本存在认定已支持PITR/持续对象备份。
- acceptance: latency/吞吐/错误分类/资源/队列/生成器余量、业务不变量、阶梯稳态过载恢复；PG+被引用包/Artifact+Secret密文/根配置/版本同一致恢复点、撤销不复活、先只读再隔离写smoke；实测RPO/RTO与批准值比较。
- output: 新profile摘要/实际环境/命令退出码/manifest/采样/恢复集/观测和清理。旧16Task漂移或517ms微型恢复不能充正式通过。

### P5：V1-EXTERNAL-AND-DISTRIBUTION（Lead汇齐输入，F/B/Provider执行者按批准窗口）

- mode/slice: verification；release/ai-task。
- dependencies: 第5节实际材料、P3候选和无阻断级安全结果。外部收费/目标部署/发行提交由Lead依据授权安排，本Planner不作发布动作。
- boundary: F正式Developer ID签名/公证及分发验证；B目标Compose/Linux启动/安全/秘密轮换/恢复；Provider执行者目标TLS/协议/文本Task/SSE/真实usage及失败分类。各自写证据，不修改版本范围。
- acceptance/output: 真实身份/制品/目标版本、命令和外部回执，Provider预算内真实终态/Artifact/usage与脱敏；operator信任根、镜像digest、TLS/DNS/Secret、部署恢复/观察窗口明确。fixture/local CA/ad hoc均不可顶替。

### P6：V1-AUTHORITY-CLOSEOUT（Lead，Planner另获精确回写包）

- mode/slice: reconciliation/release。
- allowed_paths: 由Lead独占[STATE]、`docs-facts.json`、`docs-evidence.json`、审批/看板；Planner若另派，仅更新指定功能验证章节、E2E/发布/性能/恢复证据导航。
- dependencies: 实际62AC/12E2E/7NFR/3RG、失败保留、目标/签名/性能恢复材料、责任人批准与提交授权/真实绑定。
- commands: `node scripts/check-docs.mjs`；`node scripts/review-docs.mjs --phase planning`；`node scripts/spec-docs.mjs facts-sync --check`；`node scripts/docs-gate.mjs --phase release --json`。本轮前三类结果见REPORT，最终需在真实回写后运行；不改allowPending/审批/基线来消失败。
- acceptance/output: 每条状态仅有一个权威来源、每条通过有真实当前证据；48项基线差异有既有决策/迁移/切片来源；无伪commit/签字，正式development/e2e/release及性能恢复可追溯；实际release门禁通过后仍按用户授权决定发布操作。

## 5. 外部发布输入与决策最小集

来源：[R8第6节][R8]、[RELEASE]、[恢复手册][RESTORE]、[性能空间][PERF]、[VERSION]。以下均未批准，不自动采用工程建议数值。

| 输入 | 必须交付的具体材料 | 阻塞包/不能代替的东西 |
| --- | --- | --- |
| 实际部署目标 | 支持macOS/Compose形态的OS/arch/CPU/RAM/磁盘、API/worker数、PG/Redis/对象/Secret适配及网络拓扑、TLS/DNS/数据规模和责任人 | P4/P5；测试机默认资源不等于冻结最低配置，不引入Windows/HA新目标 |
| Provider | 已授权目标endpoint/protocol/model/Profile、受控凭据供给、调用预算/限制、真实CA/DNS与usage语义 | P5；TLS fixture/假usage只能本地证明 |
| macOS发行与包信任 | Developer ID身份/Team、证书受控获取、公证材料与回执、最终app/digest；operator包信任根与轮换/不可覆盖发布材料 | P5；debug/ad hoc、临时Ed25519根不代发行 |
| 安全剩余项 | B r10实际包版本/可达依赖/修复后scan与正负例；无修复项真实安全/发布结论 | 阻断级问题未关闭则P3最终发布候选/P5受阻；Planner无权制造例外或删除必需库 |
| 负载profile及阈值 | profile_id/version/digest，操作mix/输入大小/并发到达率/各阶段时长/数据集/生成器上限，p95等指标单位/阈值、错误分类、资源/回稳目标及责任人 | P4；R8的5req/s、30min、300/400/800ms等仍仅建议，不把操作timeout当性能SLA |
| 恢复策略与目标 | 跨存储一致点、PG/WAL/对象/Secret根材料策略、备份频率/保留/密钥托管、可丢失范围、RPO/RTO计时边界/目标/观察窗口、恢复操作者 | P4；R8建议RPO15min/RTO60min未批准，已有微型restore实测不充目标达标 |
| 最终批准及绑定 | 实际proposal_id、权威/profile/恢复策略digest、候选commit/build/image、product/technical/release_manager实名/时间及发布窗口 | P6；当前HEAD不是dirty候选绑定，当前无提交/推送/发布授权；不填假签字 |

已冻结的权限拒绝无副作用、唯一结算、审计原子性、30/180天保留等不重复请求业务批准。普通技术选择由Lead按既有授权推进。支付/财务不适用沿用发布清单说明；真实依赖、秘密及备份恢复不能因此豁免。Lead先完成授权内可审阅材料，再集中处理确实缺少的目标与签署输入。

## 6. 交付限制与停止写入

封存时Lead另告：B apt可升级0项、autoremove与CVE无交集；F r11仅四setup且无主driver回执，r12在修；D r9条件分支/context资产在修；C PG37准备执行；Verify覆盖仍在修。本页P1/P2/P3是剩余出口，Lead应优先接入这些现行工作，不据建议ID重复派发。以上是Lead调度消息，未独立读取其新增报告/代码，不写成通过。

本任务书没有运行任何P1–P6产品命令；所有“planned/计划”命令均为后续执行入口。当前恢复包在途结果须以新报告和原始证据收敛，不采信中间源码为完成；D r8首次读取尚无报告，本书不编造其资源盘点。真实服务状态由owner在执行前核对，历史“保持运行”不是本轮存活证明。

本轮只写本文件及[核对回执][REPORT]。完成最终本地引用、62AC集合及空白检查后停写；Lead未另派修订前不追写在途产物，不改权威状态/审批。

[PACK]: v1-resume-r18.md
[REPORT]: V1-GAP-RECONCILE-r18.md
[VERSION]: ../docs/02-产品与版本/当前版本/V1-版本总览.md
[STATE]: ../docs/02-产品与版本/当前版本/V1-实现状态.md
[IDS]: ../docs/03-功能规格/V1/00-V1需求编号.md
[SPEC]: ../docs/05-测试与发布/端到端验收/V1-端到端验收规范.md
[RELEASE]: ../docs/05-测试与发布/发布/检查清单.md
[RESTORE]: ../docs/05-测试与发布/发布/恢复手册.md
[PERF]: ../docs/05-测试与发布/性能与容量/README.md
[R8]: V1-STATUS-RECONCILE-r8.md
[D7]: V1-UI-r7.md
[D7M]: V1-UI-r7-manifest.json
[I8]: V1-PROVIDER-FAILURES-r8.md
[B8]: V1-OPS-RELEASE-r8.md
[B9]: v1-image-security-r9.md
[SCAN]: ../deployment/V1-IMAGE-SECURITY-r9-trivy-full.json
[N10]: v1-native-execution-r10.md
[N10M]: V1-DESKTOP-CANDIDATE-r9-2026-10-02T04-00-48-603Z-5f60cd12-manifest.json
[C16]: V1-HARNESS-SCHEMA-r16.md
[V14]: v1-candidate-coverage-r14.md
[V13]: V1-CANDIDATE-RUNNER-r13.md
[F01]: ../docs/03-功能规格/V1/01-桌面与系统/01-桌面与应用工作区.md
[F02]: ../docs/03-功能规格/V1/02-开发者体验/01-开发者中心与APP生命周期.md
[F03]: ../docs/03-功能规格/V1/03-Agent与协议/01-SkillMCP与Agent接入.md
[F05]: ../docs/03-功能规格/V1/05-AI工作流/01-多模态AI任务工作流.md
[F07]: ../docs/03-功能规格/V1/07-模型与配置/01-模型平台与工作流配置.md
[F09]: ../docs/03-功能规格/V1/09-系统助手/01-系统智能助手与快捷指令.md
[F10]: ../docs/03-功能规格/V1/10-身份与治理/01-管理员登录与会话.md
[F11]: ../docs/03-功能规格/V1/10-身份与治理/02-API-Key生命周期.md
[F12]: ../docs/03-功能规格/V1/10-身份与治理/03-Provider账号与连接.md
[F13]: ../docs/03-功能规格/V1/10-身份与治理/04-上游账号连接测试.md
[F14]: ../docs/03-功能规格/V1/10-身份与治理/05-审计与管理员系统治理.md
[F15]: ../docs/03-功能规格/V1/10-身份与治理/06-用量与额度管理.md
