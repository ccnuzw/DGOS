# P0-DOC r2 回执

- delivery_id: DGOS-V1-IMPLEMENT-20261002
- work_package: P0-DOC；revision: 2；owner: Planner / OpenCode
- workspace: /Users/apple/Progame/DGOS；HEAD: 72ab1cb98b064a6e27b9f60a9f8f00881a827a99（主目录并发未提交整合）
- status: ready（r2文档交付，非V1实现/发布通过）；最终回报后停写。
- 本包只写原授权docs/facts和本回执；不写实现状态、docs-evidence、Lead日期报告或历史批次。不执行产品测试或委派。

## 优先工程收敛

1. A：manifest.actions沿公开ActionDeclaration的risk=`read/write/external/destructive`、sideEffects=`none/local-write/external-call/model-call/secret-use/destructive`、confirmation=`none/required/elevated`、idempotency=`safe/required/unsupported`；manifest `version`为SemVer，运行注册`actionVersion`为平台生成的版本标识，二者不可互换。handler只是平台注册键，禁止模块路径/脚本/URL；actionId须在appId命名空间内。A当前read/write/high、none/local/external、safe/keyed仅内部适配，不能成为新公开枚举。
2. G/A权限：执行声明必须来自当前subject安装的活动包与匹配digest，求permissions∩capabilityAllowlist并按当前授权重检；请求中的declared/appId不能授予权限。manifest能力名与DGOS公开SDK字符串一一对应，HTTP管理scope由broker映射，不能把ai_task.submit和dgos.aiTask.submit当同字段两套别名。
3. E：dependencies仅object{apps,skills,mcp}；apps每项appId/version，skills每项packageId/skillId/version/operationIds，mcp每项sourceId/version/operationIds；精确SemVer、operationIds非空且唯一，不接受extensionId/ref/id别名或未声明operation通配。invoke仍用统一extensionId，入口根据kind转换并核对版本。
4. E确认：同一用户执行意图，POST confirmations与POST runs复用同requestId和相同绑定摘要；查已提交同绑定Run的重放先于检查票据consumed/expiry，重放不再执行。不同输入/APP/kind/版本冲突；首次出票重放也须比较完整绑定。创建Run+消费票据+审计同事务，失败票据不消费。
5. G迁移：dataMigration.from/entry保留，entry为签名包内JSON声明式字段移动（非JS/Shell），执行类型由受限schema决定；旧.js示例不是允许任意脚本的授权。目标无法用该子集表达时仅拒绝该升级、保留旧包/数据并回报，不启动通用脚本系统。备份/迁移记录/校验/回滚/崩溃恢复必须绑定packageDigest、主体和起止dataVersion。
6. H：声明version是不可覆盖SemVer；registryVersion是状态变更递增正整数，baseVersion比较后每次成功变更递增。初读setState缺递增；本包后续静态复核main已出现stateVersion递增及旧baseVersion拒绝测试，需Verify绑定候选验证，不能据代码变化宣称通过。内存目录历史保留仍需核查。

## Lead/D公共HTTP转换（可立即转发）

- SystemSettingsPatch保持`{requestId,baseVersion,domain,patch}`，Snapshot顶层appearance/locale/network/grid等，Context顶层appId/窗口/生命周期等，不输出settings容器。server将内部patch.domain/value适配且合并合法域字段后校验/原事务提交；旧mode/language仅内部迁移，不能伪造其他必需locale字段或生效代理。D/SDK/测试同批切换；公共请求拒旧双形状。
- Action公开风险继续read/write/external/destructive；必须保存原声明语义，不能low/medium/high一刀切或把external误标write。resolve已去拟议标记，不提升实现状态。
- ProviderConfig.adapterVersion必填，来自绑定Adapter版本，H需持久保存/关联，publicConfig不能漏或以latest/v1补假值。registryVersion每次state变更递增，与声明SemVer分离。
- 以上写入`V1-公共HTTP投影与内部适配.md`，主OpenAPI同步严格SystemSettingsPatch/Snapshot。

## G/D运行与deployment接线

- 新增GET `/api/v1/apps/{appId}/deployment`→getAppDeployment；app.catalog.read+认证主体所有权，拒subjectId覆写。响应appId/state/versionNumber整数/dataRetained/activeRelease（无活动包为null；有则version/build/releaseChannel/digest/dataVersion）及可选updatedAt。无该主体记录404；uninstalled保留记录可读。D用versionNumber作为update/uninstall baseVersion，不能用目录reviewVersion/build或硬编码1。
- launch响应AppLaunchReceipt新增明确instanceId/bridgeVersion/entrypoint/isolation/declaredCapabilities/expiresAt，bridge与resources路由已登记；SDK消息`V1-app-bridge.schema.json`，详细窗口source/session/subject/digest绑定见`V1-应用实例与SDK桥接契约.md`。origin=null不能认证子窗口；不能为加载资源加allow-same-origin或泄管理Cookie。
- G dataMigration已确认原.js只为示例，已换.json；受控签名moves schema已落盘，不引入任意JS。备份/journal绑定源目标包digest和dataVersion，恢复不能只比数据版本。现实现允许链式/重复moves及仅dataVersion恢复需对齐新的拒绝/恢复约束。

## 24条引用警告归属

已写`docs/03-功能规格/V1/V1-AC资产核对-2026-10-02.md` r2节：24条是引用记录，对应17个旧路径。明确D/F locale、A/H/D/I网络代理、E/D扩展管理/模板/凭据、E/G引用生命周期、H/B/D协议/Profile、A/G动作安装、C治理policy的真实场景出口。已有真实目的资产按子集替换，未新增占位测试。

仍保留无足够资产的network-settings、mcp-quick-config、provider-no-export目标；其他警告消除不等于完整AC通过，真实UI/多进程/依赖/沙箱仍列缺口。

## 最终变更

- 新增：V1-app-bridge.schema.json、V1-app-data-migration.schema.json、V1-应用实例与SDK桥接契约.md、V1-公共HTTP投影与内部适配.md（均在docs/04-技术架构/当前版本）；本回执。
- 更新机器契约：V1-app-manifest.schema.json（actions/dependencies/dataMigration）、V1-extension.openapi.yaml（同意图requestId与原子票据重放）、V1-openapi.yaml（已审resolve、deployment/launch/resource/bridge、严格SystemSettings投影、Provider adapter/registry版本）。
- 同步：应用运行时/接口主契约、FR009 resolve描述；FR001/003/007/009/014 AC映射及V1-AC资产核对r2节。r1回执/历史记录不覆盖，本包未改facts派生状态。
- G/D最小deployment接口已确定独立GET，公开响应没有subjectId查询控制权，activeRelease=null明确未安装；旧目录与安装修订不得混用。
- A/G/E/H旧报告只作其轮次依据；main仍并发变更，H状态版本等本轮新增已注明时点，不能拿早期阅读宣称最终实现缺失或通过。

## 实际检查与结果

| 命令/核验 | 结果 | 限制 |
| --- | --- | --- |
| node scripts/check-docs.mjs | exit 0，0 errors / 3 warnings | 原有模板占位，非发布门禁 |
| node scripts/review-docs.mjs --phase planning | exit 0，SPEC_READY；0 errors / 3 warnings / 0 blockers | 剩余network-settings/mcp-quick-config/provider-no-export引用警告；完整AC缺口超过这三条 |
| Python/PyYAML/JSON + 本地引用指针/operation唯一性 | exit 0；5机器文件、411个ref、93个唯一operation | 解析/引用检查，不是全量OpenAPI lint、JSON Schema语义验证或runtime contract test |
| git diff --check -- docs docs-facts.json | exit 0，无输出 | whitespace检查 |
| git diff --exit-code -- V1-实现状态路径 docs-evidence.json docs/06-决策记录 | exit 0，无输出 | Lead独占状态/证据/决策没有本包修改 |

本轮仅文档静态/结构审查，无产品测试/生产依赖/部署/提交。部分apply_patch上下文定位失败后重新读取准确段落并按序重试，未据失败尝试记作成功。

## 后续可派发建议与稳定字段

- status：ready；slice_id：V1-platform/V1-ai-task/V1-assistant；objective：r2整合公共契约及AC缺资产owner收敛。
- authority_files：主OpenAPI/引用schemas、应用/扩展/功能契约、D025/D028/D030/D033/D035及ADR；不以内部DTO覆盖冻结语义。
- dependencies：Lead组织A/G/E/H/D接口转换、F实际窗口、I受控外部环境；Planner未委派。
- blocking_decisions：无新增业务选择；JSON moves为既有可恢复迁移的有界工程实现，无法表达的单个升级保留旧数据并报精确需求。
- parallel_work_packages：A声明/权限转换；G包实例/SDK/迁移/deployment；E精确依赖/确认重放/模板；H Adapter字段/版本/Profile；D唯一HTTP/UI/真实包；F双宿主；I代理/Secret目标环境；Verify候选独立验证。
- required_writeback：Lead整合后授权Verify产出真实报告，Planner据确切结果回写AC/功能验证；唯一实现状态、docs-evidence、日期化报告仍由Lead。
- next_action：Lead转发本回执和两份公共投影，按剩余owner场景派发；Planner r2停写，交后续明确修订。
