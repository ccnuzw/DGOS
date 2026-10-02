# P0-DOC-WRITEBACK r7 — 验证记录与资产映射回写

- status: ready_for_freeze；文档回写已完成，回执后停写。不是产品/候选/发布通过。
- work_package: P0-DOC-WRITEBACK / revision 7 / 2026-10-02
- slice_id: V1-platform、V1-ai-task及FR010–015既有治理切片
- objective: 将12个active FR的既有验证记录/AC资产映射更新到真实已交报告，替换三条旧缺资产与FR015泛化命令，保留失败、证据等级和在途边界。
- authority_files: .herdr/v1-evidence-writeback-r7.md；12份FR主文档的验证/映射章节；docs/03-功能规格/V1/V1-AC资产核对-2026-10-02.md；docs/05-测试与发布/端到端验收/验证证据.md。
- dependencies: A Actions r8/Workbench r9、C GOV r11/Identity r12/Transport r13/Secret-audit r15/Quota r6、G Packages r11/Retention r9、H Provider r4/r5/public r6、I Network r6/r7、F Desktop r6、E EXT r6、B Performance r6、Verify diagnostic r10与Lead integration r9。
- parallel_work_packages: D UI r5、H新增扩展管理公开HTTP、B ops r7继续在途；本轮未派发/重跑产品任务。
- blocking_decisions: 文档交付无新增业务决策；最终候选source freeze、在途验收与生产/外部发布仍由Lead/Verify收敛。
- required_writeback: 在途owner交最终带环境/命令/hash的报告后另派回写；Lead统一V1实现状态、facts、正式evidence/审批。本次不修改这些文件。

## 回写范围

12份主文档：FR001/002/003/005/007/009及FR010–015；只改既有测试资产映射、执行前置说明和实现与验证章节。另在日期化AC盘点新增r7增量，在E2E验证证据追加报告导航。本回执共15份文件；原r5/r6合同、OpenAPI、冻结规则/AC、旧封存报告和失败manifest未改。

- 代理旧缺资产改为I的public/runtime/context/public-provisioning同目的测试，明确本地CA/CONNECT、GUI、worker Action和生产Secret限制。
- MCP quick-config旧缺资产改为management-routes-pg与management-credential-pg，明确模板/凭据幂等补偿已存在，完整双样本GUI/Linux仍待验。
- Provider no-export旧缺资产改为provider-no-export.test.mjs，明确API否定断言与UI无导出是不同证据。
- FR015裸pnpm test改为精确unit/API与PG命令；内存组清除DGOS_DATABASE_URL，PG强制显式DGOS_QUOTA_TEST_URL、串行、已迁移独占隔离库。测试仍有原dgos默认值，变量非空检查不验证库名，前置核验明确保留。
- 旧“无FR003资产/无真实窗口/所有Task恢复必重发/无治理自审计与分类清理”等泛化说法由实际新报告校正；旧历史盘点加r7时点覆盖说明，历史材料不删除。
- 已采纳Task入口分工在验证章节登记：control-plane只管理已有Task，新任务打开签名工作台；未新增HTTP resolve或其他业务契约。

## 证据边界

Verify原诊断保留202通过/13失败/31跳过、12排除、exit1、source_drift=true、candidate_complete=false。A定向修复仅有Lead已收回执，本轮未找到独立r15最终数字/源码报告，不捏造统计；C r15有12/12与测试hash；E r6已交33/33及旧公开Skill/MCP/Run12/12，新增管理外部HTTP不能据此称通过，H仍在途。D只引用历史构建权限1/1，其当前UI候选在途。B性能16Task观测不掩source drift/exit1或未批准profile；B ops r7无最终报告不作通过记录。

F r6最终runId manifest、H r6配对证据、C identity r12和G r11配对证据均按原构建/hash引用。I、G retention等未附完整原批source manifest的缺项显式保留；迁移hash不当作被测源码hash。不同快照/环境不合并为一个候选。

## 实际执行检查

| 命令/检查 | 最终结果 |
| --- | --- |
| node scripts/check-docs.mjs | exit0；0 errors / 3既有模板warnings |
| node scripts/review-docs.mjs --phase planning | exit0；SPEC_READY；0 errors / 0 warnings / 0 blockers |
| git diff --check -- docs | exit0 |
| rg定向检查三旧资产与FR015裸pnpm test | 四份目标主文档无匹配；历史盘点仍保留旧目标 |
| git rev-parse HEAD | 72ab1cb98b064a6e27b9f60a9f8f00881a827a99；共享工作树有并发未提交变更 |
| shasum -a 256保护文件 | 开始/结束一致，见下表 |

首次planning为0错误/4warnings：检查器把反引号内以env开头的完整命令当作资产路径。只调整命令列格式、保留命令/真实资产/隔离约束后重跑为0/0/0；没有改检查器或创建占位测试。上述planning通过仅代表规格/引用检查，不代表产品或发布通过。

| 本轮未改文件 | SHA256 |
| --- | --- |
| docs-facts.json | 556b5f9a13c692ebc19b2a7f511ae684261164416514e2270064a223f0848de0 |
| docs-evidence.json | 968f5517c17580131b00fdbb9c1944bbf299eaa5ea22b466b2ca5511002a1eaa |
| docs/02-产品与版本/当前版本/V1-实现状态.md | 816866d68f4b3d40014654ff347e89f132514619f3fece9e9af263aea9537cc7 |
| docs/04-技术架构/当前版本/V1-openapi.yaml | 95e728b91526b37101cb7156b578e288acabe95b6b0583764785ca87f9898dff |

未执行产品测试、迁移、服务操作、Secret写入、提交或推送；未修改审批。next_action：Lead接收本回执后可纳入文档冻结；Planner停写，后续新增报告另派。
