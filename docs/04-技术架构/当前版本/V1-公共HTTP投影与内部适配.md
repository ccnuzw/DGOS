# V1 公共HTTP投影与内部适配

2026-10-02 / P0-DOC r3（承接r2）。权威为现有[V1 OpenAPI](V1-openapi.yaml)与D025/D028/D032；源码DTO不能反向改规则。本次固定唯一外部形状，Lead服务端投影、D前端、SDK及契约测试在同批切换。旧数据库对象仅在repository迁移/适配，不在公开API同时接受双形状。

## System Settings

| 入口/字段 | 唯一公开形状 | 内部适配与禁止 |
| --- | --- | --- |
| PATCH /system/settings | {requestId,baseVersion,domain,patch}；baseVersion为字符串版本，patch只含该域字段变更 | 内部service.patch({baseVersion,patch:{domain,value}})由server适配：读取当前域、合并合法patch后整体校验，保持原事务版本比较。HTTP不接受嵌套domain/value旧形状 |
| GET/PATCH成功 | SystemSettingsSnapshot顶层settingsVersion/appearance/locale/network/grid/privacy/appPermissions/restartRequired/affectedServices | 内部{settings:{...}}展开；不得额外输出平行settings容器让D择一 |
| appearance | appearanceMode、windowMaterial、interfaceMode、displayScale等；倍率0.75/1/1.25/1.5/1.75 | mode→appearanceMode仅内部旧数据转换；百分数显示由D格式化。必填值须真实初始化/配置，不能以投影捏造已生效状态 |
| locale | uiLocale/effectiveLocale/regionFormat/assistantLanguage/projectContentLanguage | language只能转换uiLocale，不能复制同值冒充其他四项；有效语言由平台回退计算，缺值补受控初始化；界面切换不改应用内容 |
| network | proxyMode、脱敏effectiveRoute、affectedServices、restartRequired | 手动代理只接受manualProxyRef；proxyUrl/token/proxySecretRef等内部值不回显；保存未重启仍反映旧有效路由 |
| appPermissions | PermissionRule数组，含subject/app/capability/scope/decision | 内部map转换为授权范围内数组；主体来源认证，不接受body扩大范围；deny/ask语义不改变 |
| GET /system/context | 顶层contextVersion/appId/appearance/locale/networkSummary/grid/windowState/lifecycleState/issuedAt | 不输出内部settings或runtimeVersion替代必填项；appId/窗口状态从实例绑定取，不伪造安装/窗口事实 |
| events | OpenAPI既有SSE上下文序列；断线重读快照 | 内部items轮询可作repository读取，不能直接冒充HTTP SSE；Lead/D须同步事件投影 |

缺失必需域数据时，先完成已有设置语义的初始化/迁移，不能放宽schema迎合旧最小service。错误/409中的当前快照同样通过公共投影脱敏。无效字段与版本冲突整体拒绝，审计/outbox保持原事务。

## Action 风险和版本

公开risk只允许read/write/external/destructive，内部low/medium/high不是公共枚举。已登记声明risk须保存/按动作版本恢复并原样投影；不能仅high→destructive或有副作用→write压缩真实外部/破坏语义。内建导航可read/none；系统配置写入write/local-write；外部调用external/external-call；真正不可逆删除destructive/destructive。均根据已有动作声明，不依模型猜测。

manifest.actions.version为SemVer声明版本；运行ActionDeclaration.actionVersion为字符串平台注册修订，内部整数转字符串，仅用于同注册版本并发/失效检查。requiredCapabilities、sideEffects、confirmation、idempotency完整映射，不能把manifest多个能力静默取一个。handler只服务器白名单ID。resolve已由Lead审阅并接线，本轮去掉拟议标记，但依然只返回候选executable:false，不据接线升完整验收。

## ProviderConfig 与目录

r5补全的成对capabilityProtocolId/capabilityProtocolVersion、配置CAS version/baseVersion及Task参数/解析快照规则，统一见[Provider绑定与文本参数契约](V1-Provider绑定与文本参数契约.md)；不从现有代码的可变默认值重读行为反改规则。扩展管理见[补全工程契约](V1-扩展管理补全工程契约.md)。治理预览的packageRetention采用Lead批准failedInstall/stagedPackage分类eligibleCount/protectedCount并纳previewDigest，RetentionJob计数语义不改。

ProviderConfig必须包含id/protocolType/validationState/**adapterVersion**；adapterVersion来自绑定的已发布Adapter版本，create与PG落库/读取均应保存或可验证地关联，不使用空字符串、随意v1或当前最新版本替代旧配置绑定。内部providerConfigId→公开id；内部ready→公开validationState=active，保持既有D032准入语义；目录内Adapter条目同样返回status及要求的schema引用。

CapabilityProtocolRegistration.version是不可覆盖SemVer，registryVersion是可变状态修订整数；state请求baseVersion后成功原子递增registryVersion，声明内容/digest不变。路径仍为GET protocols/capability-protocols、POST capability-protocols校验、POST {protocolId}/versions发布与{version}/state启停。初读H publicConfig遗漏adapterVersion、目录state不递增修订；本轮后续静态读取已见stateVersion递增及拒旧版本测试，属于代码增量，不代表运行通过。内存目录只保留最新声明等兼容性仍需核查，不能改schema掩盖历史丢失。

## 联动出口

H协议确认的公开入口为issueCapabilityProtocolConfirmation（POST /provider/capability-protocols/confirmations），两个严格oneOf分支和响应字段以主OpenAPI为准。D流程：校验声明取得服务器digest → 展示id/SemVer/声明摘要（状态操作展示baseVersion及新状态） → 用户显式确认后出票 → 原requestId及confirmationId发布/启停。五分钟票据绑定主体、真实session、operation、protocolId、声明version、payload digest和requestId；API Key不接受，CSRF和新鲜认证不能省。出票不会执行发布/启停，不自动重发或延长过期票据。摘要由服务器校验声明或状态字段生成；客户端只回传validationDigest，不自行实现另一种散列算法。

出票重放同绑定返回原票，变化409；已成功发布/启停的同绑定请求先返回保存的结果，不因票据已消费/到期再次执行。新操作才检查票据，业务写入、registryVersion递增、幂等结果、审计/outbox及消费同事务。失败回滚不消费；无票/错误绑定/过期为428 confirmation_required，认证不新鲜为403 step_up_required。H r3静态目录实现尚无成功操作结果保存，内存历史只保留最新声明；这些是H/Verify核查项，不是放宽唯一契约的理由。

G deployment及七项SDK capability输入、结果与scope映射集中在[应用实例与SDK桥接契约](V1-应用实例与SDK桥接契约.md)。D/G/Lead不要新增installations或dgos.provider.list/models并行别名。Settings顶层域及Action声明枚举沿用上文；无本轮新的设置/风险业务语义。

Lead指定唯一公共入口投影；A/System/H内部返回形状可暂留但只经一个适配层；D从同一OpenAPI生成/维护类型，现前端及测试一次切换。契约测试必须检查必填字段、禁止旧形状、多个语言/倍率、秘密不回显、完整risk和adapterVersion；API/PG子集通过不代表UI/宿主通过。不新增未冻结业务选择。
