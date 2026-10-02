# V1 Provider绑定与文本参数契约

2026-10-02 / P0-DOC r5 / Provider小投影。依据FR007 AC01/02/05/07/08/09、FR005 AC01/02/08、D019/D021/D023/D032及Lead明确授权。字段权威为[V1 OpenAPI](V1-openapi.yaml)和[桥输入schema](V1-app-bridge.schema.json)。本文约束已有文本能力的工程实现，不证明运行通过。

## 配置绑定

ProviderConfig create/update/response使用capabilityProtocolId和capabilityProtocolVersion，必须同时为非空ID及精确SemVer，或同时省略。create省略表示绑定已安装Adapter的内建文本Profile；update省略保留旧绑定，不能从旧配置补齐半对输入；null/空串/latest/通配均拒绝。明确换版本必须整对提交、校验主体/协议/活动版本，不能覆盖原声明或因发布自动迁移配置。此投影不提供隐式解除绑定；新建未绑定配置仍可用内建Profile。

公开ProviderConfig.version为正整数字符串；update必带requestId/baseVersion，CAS及审计同事务。绑定、地址或协议修改后按既有规则进入待验证状态；重新validate及显式refresh/policy仍独立。失败更新的禁用语义沿D032，不能因本投影改变。account归属不由body任意转移。response成对省略未绑定字段，不返回undefined/null半对。

## 参数解析：唯一合并算法

Task/bridge均采用options={providerConfigId,modelId,parameters?}。parameters只允许temperature（有限数，0–2）和maxOutputTokens（正安全整数）；不接受供应商snake_case别名、任意body/header/URL、脚本、媒体参数。参数需被绑定Adapter及该模型实际支持；协议声明不能自授予Adapter不存在的能力。平台/模型有更窄范围时取交集；不支持的参数返回capability_mismatch，类型/未知字段/范围错误为invalid_request，均在Task/Attempt/reservation及外部副作用之前拒绝，不截断、不夹取、不做字符串转数。

1. 按当前有权配置、已发布Adapter版本、精确模型和已绑定声明SemVer解析。一个模型在同声明命中多个Profile时拒绝歧义，不取第一项；无显式绑定时仍使用版本化内建Profile，不能猜模型名。
2. defaults逐键合并：Adapter内建默认 → 声明全局defaults → 命中modelProfile.defaults → 本次显式parameters。高层只覆盖同名键，未提供的键继承；不整对象替换。每层默认值也必须满足支持和最终边界，非法声明不能先发布后悄悄忽略。
3. limits逐键取各适用约束的最小上限：平台资源上限、Adapter/模型descriptor、全局limits、modelProfile.limits。后层不能放宽前层。maxInputCharacters按Unicode scalar数量计数（不按UTF-16长度，拒不合法孤立surrogate），maxOutputTokens校验显式值及合并默认。未声明某上限不能捏造已发布模型上限，仍执行既有平台body/response预算。
4. uiSchemas.parameters仅为可编辑参数名列表：模型级提供则替代全局UI列表，否则继承；最后与真实支持集相交。隐藏参数不是权限机制：服务端按真实支持/limits校验，不靠UI限制。没有声明可编辑参数就不渲染假控件。resolve返回合并且校验后的defaults/limits/uiSchemas及profile/workflow/assets，assets仍为空。
5. 上游映射由受控Adapter唯一负责：temperature→temperature；maxOutputTokens在chat.completions映射max_tokens，在responses映射max_output_tokens；只有支持相应映射的Adapter/model才启用。最终省略没有默认也没有显式值的参数；stream/模型/operation由服务器确定。请求不能覆盖这些固定字段。

## 持久执行快照与双重准入

Task options只参与digest不够。Lead分给H的0047-ai-task-parameters.sql用于持久化已有文本任务语义；本契约不创建SQL、不修改冻结迁移。新Task应在同一准入事务中保存：

| 内部字段 | 含义与约束 |
| --- | --- |
| executionSnapshotVersion | 固定1；不由客户端设置 |
| normalizedParameters | 上述合并/校验后的规范化对象；finite JSON且仅两参数 |
| resolvedProfile | protocolType/adapterVersion/descriptorVersion、operationProfile、workflow、modelId、命中Profile稳定ID；显式绑定时另存protocolId/protocolVersion/declarationDigest；内建时保存内建版本/descriptorDigest |
| effectiveDefaults/effectiveLimits/uiSchemas | 提交时解析结果，供解释/恢复；执行不重算当前defaults |
| bindingSnapshot | providerConfigId/configVersion、providerAccountId/accountVersion、模型/目录/策略版本；不含秘密、授权header或凭据明文 |
| requestDigest / executionDigest | 前者为规范化客户端意图（缺parameters等价{}，数值不强转）；后者为规范化参数和解析快照摘要。不同作用不能混用 |

提交：先按主体/requestId查既有Task并核对requestDigest，相同且当前有权读取则返回原task；不能先解析已变化defaults再把合法重放判为冲突。新请求在事务中重检账号ready、配置active、精确声明可用、catalog fresh、policy enabled/text、模型支持与额度；保存Task/Attempt/快照/reservation/审计原子提交。失败无半Task/预留/外部调用。

dispatch：再次核验当前主体授权、账号/配置/目录/策略/原声明版本仍允许新调用，并核对配置/账号绑定版本与快照兼容。配置/账号版本已变化或原声明停用时，在外发前按既有version_conflict/protocol_unavailable等终结并收敛预留，不能执行新配置/新Profile替代原意图。当前限制收紧导致旧规范化参数不再合法时拒绝，不能重算或夹取后悄悄改变请求。获得发送租约后只用已保存的normalizedParameters/resolvedProfile生成上游请求，Secret仍按受控短句柄实时获取。

已发送attempt的恢复不再当新dispatch；沿原taskId/attemptId及upstream_outcome_unknown/needs_review规则收敛，禁止重发。更新声明不覆盖历史；配置后来修改不改变已发送任务的参数解释。旧记录若缺执行快照：已发送/终态按历史收敛，未发送且无法从**已保存版本事实**准确重建时fail closed，不用当前defaults回填冒充历史。

## H/D/G最小实施交接

- H：provider-config/adapter及Lead显式移交的Task service/repository、0047、专项测试。先实现规范化纯函数及冲突/范围拒绝，再持久事务和worker读取快照；独立PG worker验证Responses/Chat真实body参数和重启不丢。共享server/worker接线由Lead授权片段处理。
- D：配置create/update读取版本、显式选择协议id/version并成对提交；编辑保留未改字段，不能把空选择提交成半对；模型分类/默认交互按既有FR007完成。
- G：签名工作台根据resolve.uiSchemas渲染支持参数及默认值/上限；把显式输入放options.parameters，重复提交/网络重试保持同requestId。包字节变动后按现有签名构建流程生成新受控fixture并报告digest，先等D原Task读回完成。
- 独立验收：全局/模型默认逐键继承、限值取紧、未知/不支持/NaN/范围拒绝且0上游0Task0reservation；同requestId重放不受defaults变化影响；提交后修改绑定/停用/收紧限制拒dispatch；进程重启保留参数快照；一次上游请求和统一Artifact；原Task未知结果不重发。resolve返回对象不是执行证据。
