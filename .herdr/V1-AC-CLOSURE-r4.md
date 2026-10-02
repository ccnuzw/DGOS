# V1-AC-CLOSURE r4 — 全量剩余闭环清单

- status: ready（只读核查交付；V1未宣告完成）
- work_package: V1-AC-CLOSURE / revision 4 / 2026-10-02
- slice_id: V1-platform、V1-ai-task、V1-assistant、V1-release
- objective: 12个active FR的62条AC、12个首发E2E及E2E16补充、7个NFR、3个RG的有限剩余清单与派包边界。
- authority_files: docs/03-功能规格/V1/各功能主文档及00-V1需求编号.md；docs/05-测试与发布/端到端验收/V1-端到端验收规范.md、用例矩阵.md；docs/04-技术架构/当前版本/V1-openapi.yaml、V1-界面规范.md；安全基线、发布检查清单、冻结决策D025–D035及相关ADR。
- dependencies: Lead整合与候选冻结；D独占15200–15229；Verify独立复验；I网络r6、F可见窗口r6、C真实500循环receipt r10已由Lead派发。
- parallel_work_packages: 下文P01–P10为有限边界建议；不重派上述在途任务。Lead最新授权后续P0-DOC r5先补Provider/扩展缺失投影，再由H/E/D/G实现。
- blocking_decisions: 不存在必须重定义AC的理由；外部发布材料、正式候选提交/审批由Lead组织。未提供的凭据/签名/目标环境不能伪造。
- required_writeback: 产品修复和报告由owner；Verify按候选留证；Lead统一状态/facts/正式证据和批准；Planner本包只写本文件。

## 1. 判定方法与时点

所有表为**剩余核查/实施清单**，不是第二份实现状态。证据标签：S=本次静态源码核查；L=内存/单元/Fastify注入；P=独立PG；B=真实浏览器但受控fixture；I=公开HTTP/独立进程/本地集成；X=目标部署/真实外部依赖/签名发布。本次没有运行产品测试；L/P/B/I数值均来自下列实际报告，不能升级到X。

差距分类：M=已定位实施缺口；C=权威工程投影缺项或实现不一致；V=实现或专项证据已有，但完整AC/当前候选未验；X=外部发布条件。M/C/V/X可同时存在。一次局部通过不关闭整条AC；“未找到完整证据”不等于断言没有任何实现。

读取主目录HEAD基线72ab1cb加并发未提交文件。最新推进：I网络r6、F可见窗口r6、C receipt r10在途；D原Task读回在途。以下静态差距绑定本次读到的文件；后续owner修复须用新报告更新，旧报告保留。

### 证据索引（表内短名）

| 短名 | 实际报告/资产 | 已有证据与边界 |
| --- | --- | --- |
| B5 | .herdr/V1-TASK-r5.md；docs/05-测试与发布/端到端验收/报告/V1-core-2026-10-01T23-47-19-990Z.md及配对manifest | I：11/11、source_drift=false；schema到0040，0041在批次后应用，不能当0043/0044后候选。两worker在运行不证明领取分布 |
| G8 | .herdr/V1-PACKAGES-r8.md；G5/G7报告 | L/B：16/16及签名浏览器fixture1/1；G7真实opaque静态资源无Cookie成功/撤销与更新拒绝；G8修业务receipt浮点/undefined。D真实原Task复验待回执 |
| H4 | .herdr/V1-PROVIDER-r4.md | L/P：协议重放/历史/跨owner、no-export API；Profile→Responses→Task→Artifact为内嵌worker+HTTP fixture；独立PG worker未验 |
| E5 | .herdr/V1-EXT-r5.md；V1-EXT-http-2026-10-02T00-15-58-226Z.json及manifest；E4 | I：公开签名安装/权限/Skill/MCP/独立daemon恢复12场景，定向25/25；macOS本地，未证Linux/生产。公开双有效主体尚无可用签发路径 |
| C9 | .herdr/V1-PERMISSION-SETTINGS-r9.md；V1-SYSTEM-r7.md | P：14/14含真实main buildServer及版本10→11、幂等审计；未复现D500。Lead现已另派C r10循环receipt修复，不能把C9当D问题已关闭 |
| C6 | .herdr/V1-QUOTA-r6.md | L7/P2：amount、权限、过期预留仍占额度、needs_review，不是完整当前E2E |
| C4 | .herdr/V1-GOV-r4.md | L10/P6：退避、step-up、Key有限重叠、审计失败、保留确认。其历史Provider500已由H4专项通过校正 |
| A5/V4 | .herdr/V1-ACTIONS-r5.md、v1-verify-integrated-r4.md | A P20/L8；Verify隔离PG A/G/H组及memory候选通过；首次错误环境命令exit1保留。当前候选公开risk/多能力已验证子集 |
| F5 | .herdr/V1-DESKTOP-r5.md及manifest | I：debug打包Webview→独立API/worker/Provider fixture五场景、relaunch；System Events窗口数0，无像素/手工操作截图，非Developer ID签名 |
| I4/I5 | .herdr/V1-OPS-r4.md、V1-NETWORK-r5.md | I4本地生产镜像/Secret跨进程/故障readiness/备份/本地CA；I5 CONNECT/TLS factory4/4。共享网络注入由在途I r6完成 |
| D3 | .herdr/V1-UI-r3.md、apps/web/e2e/workbench.spec.mjs、real-workbench.spec.mjs | B：14 fixture通过、1真实API跳过；r4正在真实环境执行，不能把D3旧deployment/handler缺失当当前事实 |
| VR5/VR6 | docs/05-测试与发布/端到端验收/报告/V1-regression-2026-10-02T00-25-27-532Z-f0c18b98.md及manifest；.herdr/V1-REGRESSION-TARGETED-r6.md | VR5 179pass/2fail/5skip且source_drift=true；VR6两原失败文件9/9、四资产前后hash一致，仅定向，非全源冻结/全扫通过 |

## 2. 四个重点及新增实质缺口

### Profile与参数（C/M/V）

- src/provider-config/service.mjs:5–22、repository及0040已有capabilityProtocolId/capabilityProtocolVersion成对绑定；H4证明精确已发布版本解释。但主OpenAPI ProviderConfigInput/ProviderConfig/ProviderConfigUpdate约2266–2296行没有这两字段，Update也未登记实际必需baseVersion。必须补唯一create/update/response投影，不能让UI靠未登记字段。
- src/provider-config/text-profile.mjs:5–35校验/返回temperature、maxOutputTokens、maxInputCharacters、defaults/limits/uiSchemas；src/provider-adapters/openai-compatible.mjs:32–43执行仅消费operationProfile，发固定model/messages或input/stream，未应用上述默认值/限制。apps/api/src/app-capabilities.mjs:18–20和bridge schema只接受options.providerConfigId/modelId；apps/ai-workbench-package/workbench.js:80–83只从resolve取config/model。动态参数渲染、确定合并顺序、服务端边界校验和执行字段需实现，不能以resolve返回JSON证明生效。
- src/provider-config/service.mjs:47刷新先replaceCatalog再audit；需要并发刷新和审计故障回滚证据。UI main.tsx/hardening.tsx模型策略固定defaultFor=[]，尚未提供完整分类/设置默认模型交互。不是单补schema便可关闭AC05/07/08。

### proxy activation（M/V，I r6已派）

- I5 factory有真实CONNECT/TLS和Secret撤销测试；本次搜索API/worker只见旧egress构造，未见activateFromSnapshot的共享启动注入。System PATCH保存desired并保留旧effectiveRoute正确，但缺运行进程生效回执/状态落库。
- 按已派.herdr/v1-network-integrated-r6.md：启动捕获持久设置、Provider validate/catalog/Task/probe与MCP HTTP同一受控路由、保持每host策略；API重启但旧worker仍运行时不能清空全局restartRequired。system proxy须有部署受控来源，已配置但不可用不得当未配置直连。
- main.tsx:447–449只接受manualProxyRef；普通用户合法代理地址如何进入受控SecretRef并确认不是明文日志，需要D/I完整用户路径。在线扩展导入实现后也要走同一egress。

### Desktop可见性（V/X，F r6已派）

F5证明执行中的Webview和native bridge，不证明可聚焦/最大化窗口、像素、Dock/重开交互。F r6补真正可见窗口/工作区/主题语言倍率/键盘证据；签名notarization属于独立X材料，不能因缺Developer ID停止本地GUI验证，也不能把ad hoc改称发布签名。

### source identity与release gate（M/V/X）

- scripts/verify-release.mjs:76–98对dirty tree使用commit=null、head_commit+working_tree_sha256，正确不冒充HEAD。但hash只包含限定路径的修改项，需与HEAD共同识别；.herdr签名envelope、外部运行配置、Web dist、容器镜像和运行时加载源码须单列hash/digest，不能只靠这一个值。
- sourceIdentity将docs报告目录纳入dirty hash，生成测试证据自身可能改变hash；须由Verify在**不放宽源码漂移拒绝**前提下定义精确的证据输出排除/候选资产集合并测试。verify-release主入口仅开始取identity，executeVerification没有独立结束快照；B core/release-integration有前后检查，不能据B能力推定总runner也已闭合。rename的porcelain -z双路径也需工具用例。
- docs-gate.mjs:351–401/713–728要求真实历史commit、无非证据后改动、manifest与证据commit一致；当前dirty hash不满足此正式门禁。必须源冻结后由Lead在既有授权边界安排真实候选提交/制品及独立批次，不能填HEAD掩盖未提交实现，也不能为通过降低门禁。Planner本包不提交。
- 当前docs-evidence.json的commit/report/审批为空，且“非Git/无源码”说明陈旧；应由Lead在真实证据齐备后回写，不能用r3规格Ready填补。

### 其他实质缺口（已通知Lead）

- FR003：src/extensions/source-resolver.mjs:3–14仅部署注册lookup；validation.mjs:11明确拒systemPrompt，routes没有custom/rename/translation/template接口；advanced.tsx:331–343安装不带config。受控源安全子集已有，但既有AC04/05/07的自定义Skill/展示名/翻译/在线预览/模板凭据不是“未跑测试”而是C/M。
- FR009：src/actions/routes.mjs:5只有writeAuth及confirmed；service.execute:53–72没有fresh session校验，关键动作再认证缺口需修。system-actions.mjs:1–14六域都直system.patch，appPermissions需要共享真实事务adapter；C的HTTP PATCH成功不覆盖Action路径。
- FR001：system/context只返回dgos.system/headless；七项业务桥未承载APP上下文注入订阅，不能证明已安装APP主题/语言/倍率传播。
- FR014：server audit/events直接audit.query，尚未见查询自身审计；retention.mjs只处理audit/revoked session，失败安装/暂存缓存30天清理及引用闭包缺实现。依D033/D035补，不能删除冻结类别。

## 3. 62条AC逐项清单

表中FR路径以docs/03-功能规格/V1/为根；编号对应主文档“验收标准”，资产是现存测试/报告入口，不声称覆盖全部AC。每行的P号指第6节有限工作包。

### V1-FR-001（8条）

权威：01-桌面与系统/01-桌面与应用工作区.md:180–250；E2E01/10。

| AC | 已有证据/精确资产 | 剩余完成条件 | 类别/包 |
| --- | --- | --- | --- |
| AC01 | F5；apps/desktop/scripts/e2e-macos.mjs、scripts/v1-desktop-real.mjs | 真实可见应用窗口打开/聚焦/最大化、关闭重开恢复；拒绝无窗口副作用 | V/X P03 |
| AC02 | G8；tests/unit/app-packages.test.mjs | 篡改签名/资源后真实宿主拒启动，稳定错误/requestId、旧版本/窗口保持；当前候选复验 | V P03/P07 |
| AC03 | D3、G5 deployment；tests/integration/runtime-api.test.mjs | 系统信息/我的软件真实服务状态来源和requestId、不可用终态，不以缓存覆盖；Web+桌面 | M/V P02/P03 |
| AC04 | C9；tests/integration/system-http-projection.test.mjs | APP实例上下文注入订阅、主题材质倍率跟随；宿主缩放而非CSS替代 | M/V P02/P03 |
| AC05 | C9 locale分离、D3 fixture | 英文UI/大陆格式/中文助手实际消费，未迁移APP回退、两宿主不改私有内容 | M/V P02/P03 |
| AC06 | I5；tests/integration/network-settings.test.mjs | 地址→SecretRef用户路径、保存旧有效路由、启动激活、部分重启不虚报、Provider/MCP实际出口 | M/V P01/P02 |
| AC07 | A5/C9/E5；tests/integration/system-permission-rules.test.mjs | C r10原500真实回执/事务复验；deny文件/扩展/Action副作用前拒绝、脱敏审计 | M/V P02/P05 |
| AC08 | G7/E5；tests/integration/app-package-routes.test.mjs | 同APP启动成功且MCP denied、上下文可读，真实UI保持运行且外部调用0 | M/V P02/P04 |

### V1-FR-002（3条）

权威：02-开发者体验/01-开发者中心与APP生命周期.md:184–212；E2E02。

| AC | 已有证据/精确资产 | 剩余完成条件 | 类别/包 |
| --- | --- | --- | --- |
| AC01 | G8、V4；tests/unit/app-packages.test.mjs、tests/integration/postgres-app-packages.test.mjs | 真实开发者入口字段定位、坏资源/越界权限拒绝且无安装/运行副作用；签名release级验证 | V/X P07/P09 |
| AC02 | G5 digest journal、P回滚 | 真实升级health失败及中断恢复到旧包/数据；不可覆盖release；tests/e2e/release-rollback.spec.mjs仍占位不能关闭 | V/X P07/P09 |
| AC03 | G5 deployment、E5真实安装 | 五类目录/角色样本、受保护预装拒卸载、测试安装与审核区分、更新CAS，完整浏览器/桌面入口 | V P07/P03 |

### V1-FR-003（8条）

权威：03-Agent与协议/01-SkillMCP与Agent接入.md:217–291；E2E03。

| AC | 已有证据/精确资产 | 剩余完成条件 | 类别/包 |
| --- | --- | --- | --- |
| AC01 | E5；scripts/v1-extension-http.mjs、tests/extensions/hardening-r3.test.mjs | 缺安装/禁用/deny入口拒绝无Run/进程，双资源主体边界；生产scope/sandbox复验 | V/X P04/P09 |
| AC02 | E5 daemon重启/取消；tests/extensions/daemon-r3.test.mjs | UI超时/查询/取消，Run唯一与handlerCalls，关闭页面/断线不重发，真实超时终态 | V P04/P02 |
| AC03 | E4/E5 transport、config白名单 | 受控命令/参数/cwd/env编辑入口映射，不开放任意shell；Secret录入与脱敏、失败保留原状态 | C/M/V P04 |
| AC04 | E5 install/enable/ref protection | 改名/一键翻译与/技能名调用，稳定ID/包子Skill区别、移除引用影响UI；翻译需Task授权 | C/M/V P04 |
| AC05 | config/credentials拒绝子集；旧tests/e2e/mcp-quick-config.spec.ts缺 | 模板列表及非秘密填充、无需/需凭据双路径、补凭据前拒保存连接、秘密无导出 | C/M/V P04 |
| AC06 | E5 connect/tools/disconnect/daemon | 浏览器独立enabled/connection/tool count、并发重连唯一、删除引用保护完整分支 | V P04/P02 |
| AC07 | E5部署源preview与确认 | 自定义ID/name/description/System Prompt；受信在线获取/包子摘要/风险预览；来源输入不执行shell | C/M/V P04 |
| AC08 | E5独立daemon结果持久 | bundled双凭据样本自动启动条件、真实页面关闭后查询/取消/恢复，不伪造前台交付 | M/V P04/P02 |

### V1-FR-005（3条）

权威：05-AI工作流/01-多模态AI任务工作流.md:174–200；AC03–07后置，不计V1；E2E05。

| AC | 已有证据/精确资产 | 剩余完成条件 | 类别/包 |
| --- | --- | --- | --- |
| AC01 | B5、F5、G8、H4；tests/provider/profile-task-wiring.test.mjs | D以新launch只读原bf49b606-6309-49a8-a012-6dba87f0c520的get/events/Artifact和结果展示；Profile参数后再独立worker全链 | V/X P02/P06/P09 |
| AC02 | B5重复/取消/SIGKILL未知终态；tests/integration/postgres-ai-task-atomic.test.mjs | 包内submit生成ID后失败重试必须保持原意图，不靠每次新UUID；UI断线/重复点击/取消与无第二Task/Provider/Artifact断言 | M/V P02/P06 |
| AC08 | B5 SSE游标、包有限事件读取 | 包UI当前只推进cursor/显示快照，需有序增量展示、断线重订/stream.reset、reload原task恢复；宿主手填task恢复不是自动历史证明 | M/V P02/P06/P03 |

### V1-FR-007（8条）

权威：07-模型与配置/01-模型平台与工作流配置.md:235–309；AC03后置；E2E07/05。

| AC | 已有证据/精确资产 | 剩余完成条件 | 类别/包 |
| --- | --- | --- | --- |
| AC01 | B5/H4/F5；tests/integration/ai-task-api.test.mjs | 当前真实UI validate/refresh分离、失败不自动启用、秘密与requestId；统一配置DTO包括版本 | C/V P06/P02 |
| AC02 | H4；tests/provider/provider-config-disabled.test.mjs、provider-admission-profile.test.mjs | 独立worker在停用/失败/并发更新后阻新submit/dispatch且旧task收敛，页面选择器同步 | V P06/P02 |
| AC04 | H4 Responses与chat fixture；tests/provider/openai-compatible-fixture.test.mjs | descriptor驱动统一UI/真实Adapter错误映射；真实外部TLS链用于release | V/X P06/P09 |
| AC05 | H4准入/策略；B5 | 实际分类/每能力默认模型交互、非文本/过期/未分类排除、冲突无副作用 | M/V P06/P02 |
| AC06 | tests/provider/provider-no-export.test.mjs，H4 API负向通过 | UI无导出/可导入摘要，日志/错误/浏览器存储无秘密；旧.spec.ts缺引用需按真实覆盖回写 | V P02/P10 |
| AC07 | B5显式目录；service.refresh静态 | 刷新并发唯一/失败保留目录策略、审计原子性、默认策略可观察与新版本；完整UI | M/V P06 |
| AC08 | H4精确绑定/ModelResolution | paired config字段+CAS机器契约、选择UI、参数合并/默认/限制/uiSchemas、未映射待配置，独立PG worker | C/M/V P06 |
| AC09 | H4内嵌Responses→Artifact | 白名单参数实际执行/限值副作用前拒绝、独立worker相同精确版本、旧Task恢复不得偷换配置，媒体/脚本仍拒 | M/V P06 |

### V1-FR-009（6条）

权威：09-系统助手/01-系统智能助手与快捷指令.md:210–268；E2E09/10。

| AC | 已有证据/精确资产 | 剩余完成条件 | 类别/包 |
| --- | --- | --- | --- |
| AC01 | V4候选、D3五导航fixture | 无Provider快捷指令真实打开有权APP/设置窗口，导航结果+审计，不止executable:false候选 | V P05/P03 |
| AC02 | A5/V4全能力与spoofing | missing/disabled/denied/unavailable完整目录/历史UI；同名不替代、无handler调用 | V P05 |
| AC03 | A5 plan/confirm；D3 fixture | 真实自然语言→计划→显式确认，取消/过期/改input拒执行；plan/run公开DTO与OpenAPI差异核验 | C/V P05 |
| AC04 | tests/integration/permission-action-lifecycle.test.mjs P5 | 真实签名包安装/更新/卸载的Action注册及历史missing；浏览器跨主体/版本联动 | V P05/P07 |
| AC05 | tests/integration/action-recovery.test.mjs P12、B5 | 关闭助手/断线、跨进程恢复、取消下游Task，稳定Run/task关联与不重派副作用，真实UI | V P05/P02 |
| AC06 | B5设置跨worker与deny | execute高风险新鲜认证；appPermissions走真实事务adapter；公开应用配置动作场景、版本冲突与重复ID无副作用 | M/C/V P05 |

### V1-FR-010（4条）

权威：10-身份与治理/01-管理员登录与会话.md:169–174；E2E11。

| AC | 已有证据/精确资产 | 剩余完成条件 | 类别/包 |
| --- | --- | --- | --- |
| AC01 | C4/P、B5；tests/integration/postgres-identity.test.mjs | 多进程首次引导竞争只有一active主体、失败Secret补偿/审计无半Session | V P08 |
| AC02 | C4退避、I4Redis断连ready | 隔离Redis两API共享subject/source限速及认证依赖fail-closed；旧redis-security默认DB0不直接执行 | V P08 |
| AC03 | F5重启/撤销fixture、G7资源撤销、C4 | 真实两API/桌面设备会话指定撤销、其他会话不变，renew/revoke竞态与票据即时失效 | V P08/P03 |
| AC04 | C4 step-up/续期不刷新authFresh | 高风险全入口矩阵（含Action/权限/网络）过期/不新鲜拒绝且无副作用，UI再认证恢复 | M/V P05/P08 |

### V1-FR-011（4条）

权威：10-身份与治理/02-API-Key生命周期.md:170–175；E2E12。

| AC | 已有证据/精确资产 | 剩余完成条件 | 类别/包 |
| --- | --- | --- | --- |
| AC01 | C4、tests/integration/identity-api.test.mjs | 真实UI一次性展示/不再读/脱敏列表、失败无秘密残留，目标Secret backend | V/X P08/P09 |
| AC02 | tests/security/key-delegation.test.mjs、E5/G权限子集 | API Key scopes∩主体资源授权，禁止扩大owner/自报admin；跨入口副作用0与审计脱敏 | V P08 |
| AC03 | C4已有限重叠；postgres-identity回滚 | 真实两个实例重叠窗口、明确撤旧/到期、rotationGroup可查及失败保留旧Key | V P08 |
| AC04 | key-delegation expiry/cutoff、I4Secret撤销 | Key本身跨实例缓存失效与过期真实HTTP、资源不变；Secret handle撤销不替代Key验收 | V P08 |

### V1-FR-012（4条）

权威：10-身份与治理/03-Provider账号与连接.md:174–179；E2E13。

| AC | 已有证据/精确资产 | 剩余完成条件 | 类别/包 |
| --- | --- | --- | --- |
| AC01 | H4审计P/no-export；B5账号创建 | 真实UI凭据一次性输入/脱敏、Secret故障无可用账号，生产后端X | V/X P06/P09 |
| AC02 | H4绑定/同账号版本ready；tests/integration/provider-api.test.mjs | 双资源主体/协议不匹配/CAS并发公开路径，无部分绑定，完整UI来源 | V P06/P08 |
| AC03 | H4 admission门禁 | 独立worker停用传播、当前选择器移除、已发送Task按原ID恢复，目录历史不删 | V P06 |
| AC04 | H4事务审计/Secret revoke intent | 账号被config/queued-running task/connection test引用时拒删，解除后Secret撤销恢复幂等 | V P06/P08 |

### V1-FR-013（4条）

权威：10-身份与治理/04-上游账号连接测试.md:168–173；E2E13。

| AC | 已有证据/精确资产 | 剩余完成条件 | 类别/包 |
| --- | --- | --- | --- |
| AC01 | B5/F5独立worker探测ready | 当前候选成功test版本/耗时与目录Task计数不变；实际UI诊断可追踪 | V P06/P02 |
| AC02 | provider-worker、H4 fixture | 独立进程认证/限流/网络/协议分类完整矩阵，响应/日志无原始秘密，不写目录 | V P06 |
| AC03 | provider-egress-transport、I5 CONNECT | 共享路由后DNS/重定向/IPv6/host策略仍拒绝，实际网络副作用0；生产TLS X | V/X P01/P09 |
| AC04 | tests/integration/postgres-provider-lease.test.mjs、provider-test-loop.test.mjs | 独立两进程heartbeat/取消/超时/重启终态唯一且停止后续请求，UI查询非伪成功 | V P06 |

### V1-FR-014（5条）

权威：10-身份与治理/05-审计与管理员系统治理.md:171–177；E2E14。

| AC | 已有证据/精确资产 | 剩余完成条件 | 类别/包 |
| --- | --- | --- | --- |
| AC01 | C9/H4/G/E事务子集 | 设置/权限/Provider/审核等全高风险请求→状态→audit/outbox矩阵；失败冲突不改状态 | V P08 |
| AC02 | C4查询范围；server:194静态 | 审计读取自身留痕、分页/权限/脱敏；当前query路径缺读取审计 | M/V P08 |
| AC03 | tests/integration/postgres-audit-outbox.test.mjs、provider-audit-atomic、C9 | 对全部高风险入口故障注入证明原子回滚/outbox，含目录刷新和扩展管理；不能局部证明全域 | M/V P08/P06 |
| AC04 | C4 audit180天/撤销Session30天+引用保护 | 失败安装/暂存缓存30天真实清理、分类预览与引用闭包、失败checkpoint恢复；Task/Artifact保留规则 | M/V P08/P07 |
| AC05 | tests/integration/postgres-governance-policy.test.mjs | 同旧baseVersion并发双写一成功一冲突+审计无丢失、真实UI刷新冲突 | V P08 |

### V1-FR-015（5条）

权威：10-身份与治理/06-用量与额度管理.md:174–180；E2E15。

| AC | 已有证据/精确资产 | 剩余完成条件 | 类别/包 |
| --- | --- | --- | --- |
| AC01 | B5硬额度无新Task、C6校验 | 新候选/新Profile/翻译路径同quota入口，拒绝无attempt/Provider调用，UI稳定错误 | V P06/P04/P10 |
| AC02 | C6 PG、B5两个worker | 最后额度竞争跨事务准入无半Task/reservation；最终候选复验并记录实际worker领取 | V P10 |
| AC03 | B5唯一settle/SIGKILL needs_review、VR6 settlement1/1 | 最新迁移源后成功/失败/取消/超时/未知结果全矩阵、reconciliation据原Task无重发 | V P10 |
| AC04 | unit-quota、VR6；provider真实usage未验 | unavailable/estimated/final对应实测来源；当前Adapter不解析可信usage须验证缺省明确unavailable，不虚构token | V/X P06/P09 |
| AC05 | C6跨主体/自报admin拒绝 | 真实管理UI筛选汇总/策略CAS、API Key/主体范围、当前候选审计无副作用 | V P02/P08 |

## 4. 全E2E剩余覆盖

权威docs/05-测试与发布/端到端验收/V1-端到端验收规范.md:40–178，执行矩阵旧状态为历史，不重写。首发12项，E2E16为补充；04/06/08未来编号不回收。

| ID | 已有等级 | 剩余有限出口 | 包 |
| --- | --- | --- | --- |
| V1-E2E-01 | F5 I-debug | 原生可见窗口/有权工作区恢复+Web同语义，截图与事件 | P03/P02 |
| V1-E2E-02 | G P/B、E I安装 | 五类目录样本全生命周期+真health回滚+数据引用，双入口 | P07/P03 |
| V1-E2E-03 | E5 I12 | 官方管理UI合法/未授权/超时/取消，当前schema与独立daemon，不扩未来Agent | P04/P02 |
| V1-E2E-05 | B5 I、G8 B、F5 I-debug | D原task实际显示、增量/断线恢复、签名包全链、真实Provider发布补证 | P02/P06/P09 |
| V1-E2E-07 | B5 I、H4 L/P | Profile配置参数、默认/分类UI、失败立即阻新任务、独立worker | P06/P02 |
| V1-E2E-09 | A P、B I、D B | 真助手计划确认/再认证/导航/长任务取消/应用配置全链 | P05/P02/P03 |
| V1-E2E-10 | C9 P、I5局部I | APP上下文双宿主传播、网络部分重启真实状态、权限500复验 | P01/P02/P03 |
| V1-E2E-11 | C4 L/P、F5 I | 独立实例登录退避/首启竞争/设备撤销/新鲜认证完整入口 | P08/P03 |
| V1-E2E-12 | C4 L/P | 一次性UI+两实例轮换窗口/过期/撤销+秘密扫描 | P08/P02 |
| V1-E2E-13 | B5/F5 I成功、H4 L/P | 错误分类/超时/SSRF/取消全独立进程矩阵，账号引用与旧Task保护 | P06/P01 |
| V1-E2E-14 | C4/C9/H4 P | 全高风险审计、读取留痕、所有保留类别、真实双写冲突 | P08 |
| V1-E2E-15 | B5 I/C6 P/VR6 L | 候选冻结后的quota全终态+scope/UI+实际worker分布 | P10/P02 |
| V1-E2E-16 | runtime-api P子集 | 当前公共Settings/Permission/包迁移后独立重启、API Key隔离；不替代上面业务入口 | P08/P10 |

## 5. NFR / RG / UI / 发布

| 编号 | 现有证据等级 | 剩余条件 / 包 |
| --- | --- | --- |
| V1-NFR-001 | A/E/G/H/C L/P/B/I | API Key与APP scope、两iframe伪造/撤权、扩展目标OS沙箱、全入口秘密扫描；P04/P05/P08/P09 |
| V1-NFR-002 | B5 Task/Quota I、A P、E daemon I | 新参数/新入口仍唯一幂等、receipt恢复/retention、最新候选故障窗口；P04/P06/P07/P10 |
| V1-NFR-003 | G签名/回滚 P/B | 真宿主包升级失败/恢复、不可覆盖release、operator根/最终包签名；P07/P09 |
| V1-NFR-004 | H no-export L、I4持久Secret I | 真实UI无导出与日志/错误/资源ticket脱敏；目标秘密轮换/旧handle失效与恢复；P02/P09 |
| V1-NFR-005 | 共用dist、D B、F I-debug | UI-AC-001–006双宿主、可见窗口、上下文/主题/语言/倍率/键盘VoiceOver；P02/P03 |
| V1-NFR-006 | H4 operationProfile/精确模型 L/P | 配置paired binding与参数公共契约、实际Adapter执行边界、独立PG worker；P06 |
| V1-NFR-007 | B5 SSE I | 签名包增量与cursor去重/断线/reload同task终态及Artifact；P02/P06 |
| V1-RG-001 | r3规格SPEC_READY、facts当前0drift | 补已存在FR007/FR003工程投影；三缺资产引用按真实覆盖回写（network-settings.test/provider-no-export.test已有子集）；正式spec-diff归属/版本冻结，P06/P04/P10 |
| V1-RG-002 | B5/H4/F5/G8分段证据 | 同候选签名工作台握手→Task→增量→恢复→结果可见完整链及真实Provider发布补证，P02/P06/P09/P10 |
| V1-RG-003 | 各域L/P/I子集 | 平台权限/包/设置/扩展/身份/审计/额度失败路径全部62AC剩余出口+目标环境，P01–P10 |

UI-AC-001主题/焦点快照、002双宿主路由/错误、003键盘/VoiceOver及a11y、004异步错误恢复、005非法manifest覆盖拒绝、006中英文×75/100/125/150/175%截图均需以当前build关联；D fixture不是F像素证据。UI-AC-007为未来版本，不纳入V1。

发布检查清单A–F剩余有限项：A候选commit/build/image/migration身份、前后不漂移全回归与依赖/镜像扫描；B生产配置秘密/轮换/TLS/CORS/内部边界；C quota/数据并发补偿与跨域事务（支付退款/财务/导出公式不适用按现有适用性说明）；D依赖故障/多实例/metrics权限与脱敏、性能容量；E完整PG+包数据+Secret等多存储备份恢复与实测RPO/RTO、生产规模migration/保留；F真实范围/技术/发布负责人批准窗口。I4本地镜像/CA/Secret备份仅局部证据。

性能矩阵仍PERF01–05模板归属/负载/阈值未落定；先按目标部署落实冒烟、阶梯、稳态、过载恢复、数据一致性配置与阈值，再执行留证。不能用小型功能测试当压测，也不能新增虚构数值。真实Provider至少一条TLS调用链、operator签名根/桌面Developer ID/notarization、生产秘密与部署权限是X外部材料，需明确owner，不记为代码失败。

## 6. 可直接派发的有限工作包边界

以下P号是本报告清单标识，不新建需求编号。各包入口是所关联AC与现有唯一契约；变更产品规则不在授权内。共享代码片段必须Lead显式转交；同文件后续任务串行，迁移由Lead分号，禁止改冻结SQL。

| 包 | owner/唯一可写建议 | 明确交付与关闭断言 | 依赖/不重叠边界 |
| --- | --- | --- | --- |
| P01 共享网络生效 | **在途I r6**；按v1-network-integrated-r6.md指定网络片段 | public API+worker+MCP CONNECT/TLS；保存前后/双进程部分重启、撤销/host政策/秘密；含actual route持久事实 | 不另派；不得动D15200；新迁移需编号 |
| P02 真实Web与权限500 | **在途D r4/C r10/Lead**；D apps/web，C receipt窄路径，Lead共享诊断 | 新launch读取原task而不重提；C循环receipt修复后真实PATCH/重放/DB审计一次；UI全部负向状态及无导出证据 | D15200独占；冻结原envelope/root；其他后端不访问环境 |
| P03 可见桌面 | **在途F r6**；desktop/host-adapter-macos/专用harness | 可见窗口、聚焦最大化/恢复/撤销/截图；UI主题语言倍率键盘与Web同build；签名X单列 | 不重派；local ad hoc和release签名分级 |
| P04 扩展管理完整AC | Planner r5投影先行→E src/extensions、runner、extension-routes及tests/extensions；D扩展UI单独交接 | custom/rename/translation/在线可信preview/模板凭据/config edit；Task授权翻译；双凭据bundled/引用删除；独立daemon+UI及Linux拒文件网络probe | E不写Task/共享server，H/B提供调用适配；D同文件串行；所需存储由Lead分配迁移 |
| P05 Action高风险与配置 | A src/actions（Lead-owned片段需移交）/相关专项；Lead routes/auth factory | 高风险fresh Session副作用前拒绝；权限域调用同一事务adapter、低风险可逆/关键风险确认；plan/run唯一DTO；真实导航与长任务取消 | C r10停写后权限adapter对接，不能平行写system；D助手UI随后 |
| P06 Provider/Profile参数 | **P0-DOC r5先交小投影Ready给H**；H provider-config/adapter/tests，Task参数相关路径由Lead从B转交；G签名包UI；D配置UI | paired immutable binding+baseVersion，参数merge/bounds/拒未知、默认分类/刷新事务、独立PG worker Profile→Task→Artifact；config改变不偷换原task语义 | 不擅自给H整个Task域；共享API/worker由Lead；G改包后重新签fixture并更新digest证据 |
| P07 包升级与恢复 | G src/apps/包路由/测试，C保留接口需契约先行 | 五类目录/真实health失败/迁移digest恢复；输入秘密隔离；receipt/失败安装/暂存引用保留交接；真实浏览器/宿主用例 | D真实原Task验证后再换envelope；新迁移Lead编号 |
| P08 身份治理全矩阵 | C identity/audit/governance/tests；A权限协作；Lead共享入口 | audit读取留痕、全域audit故障原子性、保留所有类别、首启/限速/会话/Key两实例与并发政策；500回执实际是否提交可判定 | 等C r10交付；隔离Redis/PG，不用原dgos或Redis DB0；不能重复派任意第二管理员破坏冻结模型 |
| P09 目标部署与外部证据 | I ops/deployment/恢复脚本；F签名制品；Lead持有外部环境材料 | 真实Provider TLS、operator trust/签名、生产秘密轮换、多存储备份恢复/RPO/RTO、Linux sandbox、依赖扫描、可观测/性能 | 与I r6完成后串行；无付费真实凭据/签名材料则列确切阻塞，不能伪造 |
| P10 冻结候选与门禁 | Verify tooling专属任务+Lead docs-evidence/状态/批准；Planner仅后续明确文档回写 | sourceIdentity覆盖与输出排除、runner前后hash、运行镜像/包/dist绑定；正确分组全回归无失败/未解释skip/漂移，12E2E+7NFR+3RG；真实批准链 | 等领域收敛和D归还环境；保持历史失败报告；此包不授权当前Planner写事实/状态/工具 |

优先顺序：P02真实故障与P01/P03在途继续；Planner r5 Provider小投影→H P06；FR003投影→E P04；A P05/C P08可按Lead明确边界开展。各M/C关闭后再P10冻结整批；X材料P09可独立准备但不能拖到“测试全过”后才发现缺资产。

## 7. 实际只读检查及门禁结果

- `node scripts/spec-docs.mjs facts-sync --check --json`：exit0，12 derived features、0 findings/drift、written=false。旧11漂移已由Lead校正，不再次修改。
- `node scripts/docs-gate.mjs --phase release --json`：实际失败ok=false，11 errors / 4 warnings。错误为COMMAND_REGISTRY_OFF 1、审批digest/proposal/三个role/date共6、COMMIT_MISSING 1、development/e2e/release报告缺失3。warnings为三旧测试资产引用及SPEC_DIFF_CHANGED（47项、0 unbound）。这不是产品测试失败计数，也不是可通过填模板消除的门禁。
- 只读rg/文件阅读核对12FR全部AC、E2E正文和最新报告；没有执行产品测试、迁移、服务重启、数据库读写。少数探测路径不存在（V1-OPS-r5实际为V1-NETWORK-r5、src/extensions/config/runtime-loader不存在）后以真实文件定位，不据路径错误认定业务缺失。
- 发布source gate要求与当前runner前后快照差距见第2节。测试/报告/源码均可并发变化，本报告是有界核查，不宣称候选冻结。

### 重点静态资产SHA256

| 路径 | SHA256 |
| --- | --- |
| src/provider-config/service.mjs | aed21f396153b93aac47bae78e99e0c463ea177c41841e161533c11b5912d861 |
| src/provider-adapters/openai-compatible.mjs | ea026d1e8b7e4a8a6d837584471ad5e9f2a7f17cea9749b394136d81f6285a47 |
| src/system/service.mjs | 7f45e34addbd30af8a6aad9decdbc0b6274bb1efff44567aa244a1d9ee4f9276 |
| src/security/network-route.mjs | 39180ca41a0d8f719cb156fea15a19405f357a612212162a3453cc486669096f |
| scripts/verify-release.mjs | ed3cbe5fab70598fb4fe03911377e6d91663e89b58eea5b9da4c19158f191d9a |
| scripts/docs-gate.mjs | 9e201499c5bc276d74ce691909558a795f1b316efcabb9993728513bfd34cf45 |
| docs-evidence.json | 968f5517c17580131b00fdbb9c1944bbf299eaa5ea22b466b2ca5511002a1eaa |
| docs-facts.json | 556b5f9a13c692ebc19b2a7f511ae684261164416514e2270064a223f0848de0 |
| apps/ai-workbench-package/workbench.js | ee82edff12779cbf81ed8482407f6427becb30d69499b52f020c81c7cab3513a |
| apps/web/src/catalog.tsx | 33a1f84a04740b549090f421aa61049b6afbdfe654da6885668c43d4b9bd03ab |

next_action：本r4核查封存；按Lead新授权直接进入.herdr/v1-contract-completion-r5.md，先交Provider小投影给H。本报告不改产品规则、实现状态、facts或任何审批。

### 封存前调度校正

Lead已收到中间发现并派A V1-ACTIONS r8（fresh Session/generic敏感域/permission adapter）、C GOV r11（audit query自审计/原子outbox/public policy并发）、G RETENTION r9（30天失败安装/暂存，0046）、I网络r6（0045）；F可见窗口r6、C原500 receipt r10继续。P05/P08/P07对应项按这些在途包跟踪，不重复派发。H只读确认Task options未持久、仅input_text；Lead准备分配0047-ai-task-parameters.sql，要求规范化参数及解析Profile/版本快照持久化，submit/dispatch重检、执行不读可变defaults。B性能harness/proposal、Verify commandRegistry/候选证据工具准备已派；P09/P10对应准备工作继续，门禁规则不改。本次62行覆盖校验实际通过（8+3+8+3+8+6+4+4+4+4+5+5=62，12FR），未运行产品测试。
