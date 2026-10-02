# V1 应用实例与SDK桥接契约

2026-10-02 / P0-DOC r3（承接r2）。依据D025/D027/D028/D030收敛工程投影；HTTP以[OpenAPI](V1-openapi.yaml)、消息及逐能力输入以[bridge schema](V1-app-bridge.schema.json)、包以[manifest schema](V1-app-manifest.schema.json)为权威。本文不证明实现或sandbox通过。

## 应用与控制面

官方DGOS AI工作台是可签名、安装、启动、更新、卸载的独立业务包，源码入口apps/ai-workbench-package。复用SDK/UI/设计token，不把整页Web控制面放进同权限iframe。Provider/凭据/治理仍由平台管理；工作台只在有权范围内选文本模型、提交、读事件/结果、取消和恢复任务。官方来源不自动获得system权限；operator签名，生产不自动生成自信任根。

| 工作台公开SDK capability | 精确input（必填除标注可选） | 领域映射 / 唯一成功结果schema | 服务端权限与范围 |
| --- | --- | --- | --- |
| dgos.model.list | {}或{providerConfigId}，筛选项可选 | 主体内目录/策略受控聚合；ModelSelectionList | provider.model.read；仅返回可选文本模型，不返回Provider管理配置 |
| dgos.model.resolve | {providerConfigId,modelId,intent:"text.chat"} | 已登记Adapter及文本Profile只读解析；ModelResolution | provider.model.read；当前可用性/归属重检，不自动刷新、启用、发布 |
| dgos.aiTask.submit | {target,intent:"text.chat",input:{text},options:{providerConfigId,modelId,parameters?}} | submitAiTask；AITaskReceipt | ai_task.submit；目标、输入、额度与准入重检，外层requestId注入；parameters以[文本参数契约](V1-Provider绑定与文本参数契约.md)为准 |
| dgos.aiTask.get | {taskId} | getAiTask；AITaskSnapshot | ai_task.read；同主体原taskId |
| dgos.aiTask.events | {taskId,cursor?}；cursor为非负安全整数，默认0 | streamAiTaskEvents的脱敏领域事件；AppTaskEventBatch {items:AITaskEvent[]} | ai_task.read；仅返回sequence大于cursor的有权事件 |
| dgos.aiTask.cancel | {taskId} | cancelAiTask；AITaskSnapshot | ai_task.cancel；原taskId，取消不生成新任务 |
| dgos.artifact.read | {artifactId} | readArtifact；ArtifactContent | artifact.read；有效任务/引用授权，不返回Secret/文件路径/临时URL |
| dgos.system.context.read | {} | 绑定当前实例的System快照；AppSystemContext | dgos.system.context.read；当前APP声明及Broker判定 |
| dgos.system.context.events | {cursor}，非负整数字符串 | AppContextEventBatch | dgos.system.context.events和dgos.system.context.read；两项声明及当前授权均需满足 |

应用permissions和capabilityAllowlist均使用同一公开SDK字符串。先以该字符串检查当前manifest交集和Broker授权，再以表内scope约束认证主体及领域资源；不能从dgos前缀猜scope，也不能因宿主是管理员就跳过APP权限。同名APP或请求中的declared不授予能力。七项业务能力加r5两项上下文能力均通过单一bridge操作注册；dgos.provider.list/models不作为平行SDK别名，包无需读取Provider管理页配置来发现模型。

model.list可跨当前主体有权配置聚合；未指定providerConfigId时也不得越主体。选择资格必须同时满足账号ready、配置active、协议可用、目录fresh、模型available、policy.enabled及text分类；无候选返回items=[]，不选硬编码默认模型。返回providerConfigId/modelId足够后续resolve/submit，禁止baseUrl、account/SecretRef、凭据、headers泄漏。resolve返回的defaults/limits/uiSchemas由绑定Adapter descriptor及精确Profile产生；无可用匹配返回现有capability_mismatch/model_not_allowed等错误，不猜Profile。显式声明命中时protocolId/protocolVersion成对返回并与执行链绑定；旧任务不被新声明覆盖。工作台完整AC仍须验证模型/动态输入、事件/结果、reload恢复和失败UI。

bridge HTTP成功直接返回表内结果，不额外套result；宿主把它装入dgos.host.result.result。事件桥是有限JSON批次，HTTP原streamAiTaskEvents继续为SSE；宿主可受控订阅SSE后按游标供桥读取，不能把原始SSE字符串/EventSource/认证URL交给包。下一游标取已接收最大sequence，空批次保留原cursor；stream.reset按原taskId重读快照。每次新读取生成新requestId，同requestId重放返回该次原批次，不能用同ID持续轮询。断线恢复不重新submit。

## Launch、资源与失效

宿主只用GET /api/v1/apps/{appId}/deployment读取当前主体部署，需app.catalog.read；AppDeployment的versionNumber用于update/uninstall.baseVersion，activeRelease为包版本摘要。无安装历史404；uninstalled保留记录200且activeRelease=null、dataRetained反映保留数据。目录reviewVersion/build不是部署修订。G旧r4建议/apps/installations被r5授权收敛到此入口，D/API/测试同批切换，不保留列表式兼容路径，不接受subjectId覆盖。

认证宿主POST apps/{appId}/launch后取得随机instanceId、bridgeVersion=1、entrypoint、isolation=opaque-origin-sandbox、declaredCapabilities、expiresAt。服务端绑定subjectId、宿主sessionId、appId、活动packageDigest、实例与到期；declaredCapabilities是静态上限而非授权。客户端不能自选主体/实例。

entrypoint仅为该APP受控相对资源路由，可含短时launchTicket。票据只授权对应包静态字节，不授权API/bridge；资源逐次核对路径/digest/安装/会话/到期，票据不得进入日志、截图、Referer或持久历史。子资源由票据或受控加载机制取得，不能为解决opaque加载问题添加allow-same-origin、通配CORS或把管理Cookie交给包。HTML采用sandbox allow-scripts及受限CSP，connect-src/form-action/base-uri拒绝旁路；缓存no-store、nosniff、no-referrer。

更新/卸载、会话撤销、权限回收、实例关闭/过期使旧实例失效。API重启丢失临时launch登记后重新launch，不能凭旧instanceId重建授权。长Task继续由服务持有，新有权实例可按原taskId查询。实际模块/样式加载与CSP效果由真实浏览器/桌面验证，不以响应头字符串宣称隔离完成。

## opaque-origin 消息握手

1. 宿主创建sandbox="allow-scripts" iframe，保存contentWindow与launch receipt绑定，发送dgos.host.hello（instanceId/bridgeVersion）。opaque目标要求postMessage targetOrigin="*"时只向保存的WindowProxy发送，不携带Session、Secret或launchTicket。
2. 子窗口只接受event.source===parent的首次hello，锁定父origin/instanceId并回复dgos.app.ready。宿主校验event.source===已登记iframe.contentWindow；origin="null"本身不能证明身份，其他opaque iframe不能冒充。
3. 握手完成前拒invoke；版本/实例不符拒绝。导航/重载销毁旧绑定和pending响应并重新launch，不能复用过期通道。
4. 子窗口发dgos.app.invoke；宿主校验窗口、schema、实例、能力后以自身认证调用bridge。API再次校验session/subject/app/instance/digest、当前声明及Permission Broker，ask未确认/deny不得调用handler。禁止任意URL/method/header代理。
5. dgos.host.result只返回相同requestId/instanceId的脱敏领域结果或ErrorResponse。子窗口验证父source/origin及pending项；不接收未知请求的结果。输入/输出沿用注册capability的领域schema，submit仍需target/intent/input等，不允许仅prompt绕过。
6. requestId绑定实例/能力/输入digest，重放原结果，参数变化冲突。超时不盲换requestId重发；事件使用原taskId/游标恢复。版本1request/result可承载受控事件片段查询；新增push消息须另登记版本，不暴露SSE认证句柄/任意URL。

## Permission、Action与依赖

### r5 APP上下文读取与订阅

采用上述两个已命名dgos.system.context capability，仍为bridgeVersion=1的invoke/result，不新增host push或在hello中偷塞上下文。APP须在签名manifest的permissions和capabilityAllowlist中显式声明并获得当前Broker授权；events同时需要read，缺任一声明/授权即拒。宿主内部的管理设置读取权限不能授予APP。manifest更新需重新签名/launch，不能向旧声明实例补权限。

read结果AppSystemContext只含contextVersion、instanceId/appId、appearance、locale、grid、脱敏networkSummary、issuedAt。主体/APP从launch及当前Session取；不能由input覆盖，不传全局权限规则、其他主体数据、manualProxyRef、地址、秘密或虚构窗口状态。前端宿主负责材质/实际显示倍率，APP只按token/locale渲染内容，不用CSS放大重写宿主倍率。

订阅为有界轮询：初次read保存contextVersion，每次events用新requestId+cursor；服务端当前版本大于cursor时返回一个最新完整快照及新cursor，否则items=[]。可合并中间设置变更，但不回退版本；游标历史不可满足时reset=true并给最新快照。字符串版本按整数比较，不能字典序比较。每次重新检查会话/实例/包digest/当前声明/Broker；撤销/更新/关闭立即停止读取，宿主清理pending和轮询。应用重开后重新launch/read，不沿用旧实例权限。此流是设置快照订阅，不复用Task增量的去重规则。

D维护host桥白名单、严格输入/结果和同窗口绑定；G在新签名包声明并消费上下文，显示uiLocale/effectiveLocale回退、独立regionFormat和assistantLanguage；F用相同build在真实可见窗口验证主题/语言/倍率更新和撤权。Lead注册两handler并把实例绑定传入System投影；全局HTTP /system/context继续是控制面上下文，不能仅替换其appId假造实例授权。该路径不需新状态机或SQL，复用现有持久settings/contextVersion与实例绑定。

声明从当前subject活动deployment关联的已验证manifest读取，安装/审核/digest一致才求permissions∩capabilityAllowlist。系统能力须受信平台登记，不因调用者自报dgos.system而放行。包Action actionId前缀为appId加点；handler仅平台注册键，不是路径/代码/URL。manifest.actions使用已发布risk/sideEffects/confirmation/idempotency枚举；内部riskLevel单向转换。requiredCapabilities全部满足；实现暂只支持单项则拒不支持声明，不能静默取首项。

manifest动作version为SemVer，actionVersion为平台运行修订标识。注册/计划/执行绑定subject、包digest及两种版本；卸载/失效后历史为missing，不替换同名动作。输入输出schema仅验证数据，禁止remote refs/可执行表达式。

dependencies唯一字段为apps[{appId,version}]、skills[{packageId,skillId,version,operationIds}]、mcp[{sourceId,version,operationIds}]；精确SemVer及非空操作白名单，不接受ref/id/extensionId别名。相同稳定ID冲突版本拒绝；缺依赖显示missing，不隐式安装。invoke通用extensionId仅在入口按kind映射为skillId/sourceId，并与当前安装版本/连接/工具目录核对。

## E确认与幂等

用户审阅工具/版本/schema/输入摘要/风险后显式POST confirmations，仅出票；安装preview不授权执行。confirmations与runs复用同requestId、主体/APP/kind/extensionId/operationId/extensionVersion/inputDigest。出票重放须核对全部绑定，不同输入冲突。

invoke先查询已存在同绑定Run：匹配则返回原Run，即使票据已consumed/expired也不再产生副作用；不匹配拒绝。无Run时才验证票据approved/expiry，创建Run+事件+审计+消费票据同事务；失败不消费。新请求重用已消费票据拒绝；重放仍须当前读取授权，执行前撤权则阻止新副作用。禁止恒true hook。

## 受控 dataMigration

manifest保留from/entry，entry为签名包内.json资源，符合[迁移schema](V1-app-data-migration.schema.json)。首批实现只做有界顶层JSON字段move并原样保值，不运行JS/Shell、不访问网络/Secret/其他APP。旧migrations/1.js示例不是通用脚本授权；不能表达的升级拒绝并保留旧包/数据，报告所需具体操作，其他切片继续。

在subject/app生命周期锁下先验证from/to和完整计划、目的冲突，再保存私有备份/beforeDigest；持久化migrationId/requestId/subject/app/源目标包digest/数据版本/prepared及审计，写暂存数据/afterDigest，做真实运行健康检查，最后切活动指针并提交部署/migration/outbox。失败从备份恢复旧数据及旧包；不运行反向脚本。恢复同时核对源目标packageDigest和dataVersion，不能只因另一包同dataVersion认作提交；缺备份/摘要不符拒绝服务，不建空数据。备份不进普通API/日志，清理按既有保留及引用策略，不擅自立即删除。

## 核验与差距（静态快照）

main已有launch实例、bridge、JSON moves、工作台源码；尚需G/D/F证实真实加载/握手、两iframe及跨主体伪造拒绝、会话/更新/卸载失效、Task全链和迁移崩溃恢复。初读bridge未完整绑定Session/broker重检、D iframe未完整消息接线、工作台仅submit；E依赖别名/版本、票据消费后重放、A动作枚举须按本文核查。并发期间H已出现registryVersion递增及对应断言，不能继续将最早静态缺陷当最终事实；所有变化由Verify绑定候选复验。此文不作运行通过声明。
