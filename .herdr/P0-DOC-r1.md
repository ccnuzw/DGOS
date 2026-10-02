# P0-DOC r1 回执

- delivery_id：DGOS-V1-IMPLEMENT-20261002
- work_package：P0-DOC；revision：1；owner：Planner / OpenCode
- workspace：/Users/apple/Progame/DGOS；baseline：72ab1cb
- status：ready（本次文档工作包交付；不代表产品实现/发布完成；resolve投影保留Lead查阅标记）
- 写入边界：用户本轮指定文档目录、docs-facts.json及本回执；不写V1-实现状态、缺口日期报告、docs-evidence、历史批次和冻结决策。

## 可立即推进的契约摘要

G/E均可立即实现既有规则：主体从认证上下文取得；版本/请求幂等；信任由平台授予；预览无安装副作用；来源与权限检查先于启动；取消须有实际信号和可查终态；业务状态与审计同事务/outbox；卸载不删除应用数据；引用保护及D035保留期。FR003只交付受控Skill/MCP/Tool，不建设后续新通用Agent/Canvas执行器。

## 首批字段阻塞（只阻塞相关投影）

以下保留首次发现；G/E核心字段已由后文唯一投影解除，不再作为待重新决定的业务问题。

| 对象 | 权威文档 / 当前代码差异 | 处理与交接 |
| --- | --- | --- |
| Manifest format | 文档dgos-app/v1；校验器可选dgos.app + manifestVersion | G/Lead确定新机器schema及旧本地fixture迁移；不能默默以旧校验器覆盖文档 |
| trust与来源 | 文档standard/trusted/system；代码official/admin_approved/developer/approved | 分离安装来源/审核与有效信任级别；有效信任只由平台计算；G提交迁移映射给Lead |
| build/dataVersion | 文档整数/递增；代码build字符串、dataVersion字符串 | 公共目标统一序号语义；旧库文本适配不改变不可覆盖规则；禁止字符串字典序比较版本 |
| backgroundPolicy/uninstallPolicy | release/keep-alive与none；protected-preinstall/user-removable与protected/allowed混用 | 文档与代码分别记录来源，不在HTTP同时长期保留两套枚举；G报精确序列化形状后Planner对齐 |
| App HTTP | apps operation缺路径参数、请求/完整响应；已有approve/reject/withdraw/test-install路由未登记 | 本轮补已有操作登记及受控输入schema；包上传/包句柄/签名结构由G提供实现接口后定稿，不接受任意URL或明文路径替代 |
| ExtensionInstall/State | 只有source字符串、任意config；没有preview/configVersion/连接工具/持久Run投影 | 本轮收敛共享字段安全语义；E回报精确config、preview/Run DTO和路由，未知字段/命令不作为已授权执行入口 |

## 检查与限制

本次为文档/源码静态对照，不构成产品代码测试通过；最终文档检查结果见文末。首批字段缺口已按Lead后续授权收敛，原表保留过程依据。

## G 可执行决定（2026-10-02，替代上表待确认字段）

机器权威新增`docs/04-技术架构/当前版本/V1-app-manifest.schema.json`，应用契约同步。D030业务约束优先，OpenAPI此前没有manifest schema，代码/DB旧值不构成冻结需求。

- 新输入唯一：`format=dgos-app/v1`；`trustLevel=standard|trusted|system`；`uninstallPolicy=user-removable|protected-preinstall`；`backgroundPolicy=release|keep-alive`；`build/dataVersion`为非负安全整数。catalogState保留`official/pending_review/approved/rejected/withdrawn`作为平台输出，不允许普通提交自报。
- manifest的trustLevel是请求，平台有效trustLevel由签名/来源和明确授权决定；官方不自动system，批准不自动trusted，无额外授权为standard；未授予更高请求拒绝。protected-preinstall须发行/管理员策略，开发者不能自行保护。
- 0028–0030做增量迁移：保留原manifest/digest/历史SQL；新增有效字段并重新校验旧记录。旧official/admin_approved/developer/approved不自动升权；无法证明的旧安装标需重新验证并拒绝启动，保留数据。
- 旧数字字符串仅迁移无损转整数；无效记录报告、不猜测。none→release、allowed→user-removable、protected→protected-preinstall只在迁移器且后者重新验证策略。新API不长期兼容别名。
- G可继续核心公开字段与迁移实现；签名封装/真实包DTO按已授权工程选择给Planner登记，不构成新业务选择。

### Lead确认后的G最终统一字段/签名投影

已审查G的`DELIVERY-V1-PACKAGES-r1.md`并补主OpenAPI：POST apps接收`requestId + {manifest,files,resourceDigests,keyId,signature}`；响应`AppPackageRecord`顶层`source=official/admin/developer`、`catalogState`、有效`trustLevel`、有效`uninstallPolicy`均平台生成。manifest内部trustLevel只是请求；body不得提供source/catalogState/publicKey。canonical JSON规范见应用契约§2.1，Ed25519签名64字节base64，digest重算；普通JSON.stringify的整数键枚举不能破坏逐层排序。

已补getApp/approveApp/rejectApp/withdrawApp/testInstallApp及既有install/launch/update/uninstall/health的路径参数与DTO。`AppReleaseMutation`含requestId/version/build(integer)/releaseChannel；现有记录变更须baseVersion，审核reason脱敏；`AppMutation`不接受deleteData。发行唯一键含releaseChannel，G当前三元查找须补渠道，不可返回另一渠道同版本包。

32MiB/1000文件为可配置默认值；签名/来源/资源验证先于安装注册，缺包字节不能退回manifestDigest冒充packageDigest。已有响应/测试资产需要按新投影升级；主契约已同步，G可解锁公共字段实现。

## E 可执行工程投影

`V1-openapi.yaml`已引用`V1-extension.openapi.yaml`，旧ExtensionInstallRequest/StateRequest/Record也指向同一权威。

- POST `/api/v1/extensions/previews` → previewExtension：requestId/kind/source/version；返回previewId/digest/expiresAt/trustState/脱敏summary。只读解析，安装必须提交同owner/来源/摘要有效的previewId+previewDigest+confirmed=true；布尔值不能单独授权。
- POST `/api/v1/mcp/{mcpId}/connect|disconnect` → connectMcp/disconnectMcp：requestId+baseVersion；返回独立connectionState/attempt，不从enabled推断connected。GET/POST `/api/v1/mcp/{mcpId}/tools` → listMcpTools/discoverMcpTools，POST带版本，返回sourceId/catalogVersion/items。
- POST `/api/v1/extensions/runs` → invokeExtensionTool：requestId/appId/kind/extensionId/operationId/extensionVersion/input，按策略带confirmationId；持久化先于副作用。GET/DELETE `/api/v1/extensions/runs/{runId}`查询/取消，GET `/events`为带Last-Event-ID的SSE。取消未下游确认保持cancel_requested。
- DTO统一stateVersion为正整数、Run用state+sequence；秘密/credentialRef/原始input不出普通Record/Run；config只允许transport(stdio/streamable-http)、runnerProfileId/endpointRef和schema约束的非秘密settings。raw command/cwd/env不得从任意config透传；管理表单可经受控配置服务解析到profile/ref。
- 工具risk=low/medium/high、sideEffects=boolean为扩展工具投影（与Action的不同DTO不混用）；低risk也不能跳过副作用确认。身份从认证上下文取，appId校验安装/依赖/权限，不相信请求自报。
- 未新增业务范围；E可推进对应DTO/路由，若已有内部形状不同在单一公开投影层归一，禁止长期双枚举。提供实际实现/测试后回写资产，不标已通过。

## A/B新增工程投影（供Lead查阅再接UI）

- 已登记`upstream_outcome_unknown`：Task failed、reservation needs_review、同taskId可查、retryable=false，禁止自动重发/伪造usage或成功Artifact。query HTTP可成功携带失败快照；未知调用不自动释放额度。A/B工作树报告仅作待整合证据，不写主目录已完成。
- OpenAPI新增POST `/api/v1/actions/resolve`草案，标`lead-review-before-ui-wiring`。输入requestId/text（初始长度上限4096为工程限制）；action.read；返回requestId/candidates[]，每项actionId/actionVersion/input/risk/permission/executable:false。只返回已注册且授权/版本/schema有效候选，deny不暴露；ask仍须后续确认。
- resolver不直接执行，不创建Plan/Run；Provider候选处理本身如涉及模型副作用仍走原授权/确认/额度，action.read不授权付费模型调用。
- `ActionRun.resultSummary.navigation.target`唯一五值：system.settings→dgos://system/settings；provider.settings→dgos://system/providers；skill.management→dgos://app/skills；mcp.management→dgos://app/mcp；app.catalog→dgos://app/catalog。D只映射这五项，不打开任意URL。

## H r3 / D 协议页可接线投影

已核对主OpenAPI既有GET `/api/v1/provider/protocols`→listProviderProtocols和GET `/api/v1/provider/capability-protocols`→listCapabilityProtocols，均响应`{items:[]}`，读取用provider.config.read或已有等价registry读取能力；无条目返回空数组，不404、不伪造活动协议。H内部protocolVersion映射公开adapterVersion，补configSchemaRef/capabilityDescriptorSchemaVersion；不可返回内部endpointRules或凭据URL。

FR007拥有协议目录/Profile，FR012/013消费而不拥有第二套注册表。主OpenAPI收紧V1 `CapabilityProtocolRegistration`：id/version；executor={type:declarative,engine:dgos-text-v1}；capabilities=[text.chat]；operations对象键为operationId，值仅profile(chat.completions/responses)、method=POST、匹配path；workflows只允许text.chat.submit引用已声明键；modelProfiles为稳定profileId到精确modelNames/workflow/defaults/limits/uiSchemas映射。defaults仅temperature/maxOutputTokens且须匹配真实descriptor，limits限制文本输入/输出，assets空对象；不允许script/url/header/poll/download/upload，不能靠additionalProperties绕过。

既有POST `/capability-protocols`仍是validateCapabilityProtocol，输入requestId/declaration，**只校验，不发布、不改模型**。新增POST `/{protocolId}/versions`→registerCapabilityProtocolVersion，输入requestId/declaration/validationDigest/confirmationId；管理员新鲜认证+provider.protocol.write、同事务审计、不可覆盖id/version；active仅在检查/确认通过后平台写入。POST `/{protocolId}/versions/{version}/state`→setCapabilityProtocolState带requestId/baseVersion/state/confirmationId，停用不改已有task或配置。D普通读取仅见active；H内部数组operations/modelNames在公开投影单向规范化，不建立第二份公共schema。

身份/retention核对：主契约已有`RetentionSweepRequest.previewDigest`必填；C当前服务兼容confirmDigest且缺失也可执行，公开接口不新增别名，非dryRun必须提供previewDigest并与当前预览匹配。新鲜认证和确认在真正run时重检，不因创建job已授权而绕过。新增参数如r3确需超出该形状，C回报精确DTO后再登记；不自设新保留期限或法务例外。

## H账号启用与E确认出票接线

- ProviderAccountStateRequest新增connectionTestId并注明ready前置：credential_pending→受控probe succeeded→显式state ready；baseVersion/current accountVersion与probe绑定一致，凭据/版本变更使旧probe失效。readiness不自动刷新模型或使ProviderConfig active。
- E公开POST `/api/v1/extensions/confirmations`→createExtensionConfirmation已由主OpenAPI引用；输入requestId/appId/kind/extensionId/operationId/extensionVersion/input，kind.execute+当前资源权限。用户先审阅已注册工具、输入摘要、风险和副作用，再显式调用，只出票不Run/不进程/不上游；安装preview确认不能代替执行确认。
- 返回confirmationId/inputDigest/expiresAt及工具版本绑定信息、executable:false；服务器保存/认证票据并绑定登录主体，后续invoke必须相同输入/版本/主体/APP，原子消费与Run落盘。同requestId重放返回原Run，新请求重用已消费票据拒绝；无恒true hook，Cookie写入保留CSRF/Origin。

## 最终文档变更与交付

| 范围 | 本包变更 |
| --- | --- |
| docs/01-项目概览/工程与本地环境.md | 源码/迁移/测试入口及局部证据边界，删除当前“无源码”判断 |
| docs/02-产品与版本/当前版本 | V1-版本总览、V1-产品需求的工程/证据摘要；V1-下一阶段计划的旧缺口标题明确历史时点 |
| docs/03-功能规格/V1 | 编号/追踪补NFR004–007；12项active主文档的证据/真实资产映射与FR002/003/007/009机器投影引用；风险/设计索引补FR010–015 |
| docs/03-功能规格/V1/10-身份与治理 | 新增六份独立技术设计，B10–B15分支覆盖事务、授权、恢复与AC；D035无保留例外，不引入支付/多用户 |
| docs/03-功能规格/V1/V1-AC资产核对-2026-10-02.md | 全active AC对应主目录真实资产、未覆盖/skip/名称误导的限制；不以存在性标通过 |
| docs/04-技术架构/当前版本 | 新增manifest schema、extension OpenAPI及工程核查；主OpenAPI补包/扩展/确认/resolve/Provider text-only注册/恢复errorKey；应用/扩展/接口/数据模型同步 |
| docs/05-测试与发布 | E2E验证证据页日期化旧摘要；发布检查清单按FR015排除支付/退款；恢复手册区分本地PG与生产灾备。未覆盖历史报告/manifest |
| docs-facts.json | 保留既有NFR004–007事实，补编号表references及updated日期；不新建重复ID、不批量改变实现状态/证据字段 |
| .herdr/P0-DOC-r1.md | 本回执及可转发的G/E/A/B/H/C接口摘要 |

manifest schema还保留既有应用契约必填的description/category/icon/defaultWindow，以及界面规范允许的UI声明字段；调用方不能因为基础schema通过就跳过资源/权限/UI声明的语义验证。普通DELETE扩展仍须requestId/baseVersion，已补引用。所有新增机器声明都不是已整合实现标签。

## 已执行命令与真实结果

| 命令/检查 | 最终结果 | 限制 |
| --- | --- | --- |
| `node scripts/check-docs.mjs` | exit 0；0 errors、3 warnings | 3条为既有模板占位；结构通过不代表交付 |
| `node scripts/review-docs.mjs --phase planning` | exit 0；SPEC_READY；0 errors、24 warnings、0 blockers | 24条为TEST_ASSET_MISSING引用警告，不等于24独立资产/AC；仍未创建的完整场景保留为缺口 |
| Python3/PyYAML/JSON解析与本地JSON Pointer检查 | exit 0；3份机器文件解析、372个引用解析、90个唯一operationId | 检查V1-openapi.yaml、V1-extension.openapi.yaml、V1-app-manifest.schema.json；不是完整OpenAPI lint或runtime contract test |
| `git diff --check -- docs docs-facts.json` | exit 0，无输出 | whitespace检查 |
| `git diff --exit-code -- "docs/02-产品与版本/当前版本/V1-实现状态.md" docs-evidence.json docs/06-决策记录` | exit 0，无输出 | 本包未写Lead独占状态/正式证据/冻结决策 |

首轮check曾因本包重复添加已有NFR facts而失败（4 errors），已删除重复项、保留原事实并补引用；首轮review因FR002字段规则/成功响应缺节产生2 blockers，已补齐。曾将反引号node测试命令误识别为资产的警告通过清晰分列修正。解析检查首次把schema属性operationId对象当作操作名计数而报TypeError，校正检查脚本只采字符串后通过；未据失败轮次宣称通过。未运行本轮产品测试、生产/真实Provider、release gate或提交。

## 后续整合责任与剩余限制

Lead可按前述摘要转发G/E/H/D及A/B/C。resolve接口保留Lead-review-before-ui-wiring；所有写接口的确认票据、资源授权、版本校验和审计须由实际服务实现，不得用恒true确认替身发布。H的Profile持久化和目录、C的previewDigest强制校验、E的确认出票均需整合后contract/E2E。worktree局部测试报告只作为各包待验输入，本文未更新主目录实现状态。

旧ADR末尾时点记录、唯一实现状态内陈旧摘要、docs-evidence清单和Lead接管的日期化计划均留给Lead授权的下一轮，不越权修改。docs-facts既有implementation_status=planned等派生漂移也未在没有Lead状态收敛前批量升格。

### Planner稳定字段

- status：ready（本包文档交付）
- slice_id：V1-platform、V1-ai-task、V1-assistant
- objective：补工程机器契约、修正文档漂移与风险/AC追踪，为分域实现提供输入
- authority_files：主OpenAPI/引用schema、功能主文档、D029–035及ADR-0005–0007；正文链接权威而不另建完成度
- dependencies：Lead确认的G/E/H/A/B工程形状；本轮实现尚待整合与Verify
- parallel_work_packages：A–I领域实施由Lead调度；本包未委派
- blocking_decisions：无新增业务选择；resolve待Lead查阅；生产秘密/签名/真实上游条件仍不得自填证据
- required_writeback：Lead整合后由Verify核验新资产与报告，再授权功能记录/facts/唯一状态和正式证据清单回写
- next_action：交Lead/Verify复核本次文档差异；Planner停止本修订写入，等待后续明确工作包
