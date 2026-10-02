# P0-DOC r6 — 手动代理秘密配置小投影

- status: ready（规格交付，非实现/路由/发布通过；回报后停写）
- work_package: P0-DOC / revision 6 / 2026-10-02
- slice_id: V1-platform
- objective: FR001 AC06用户录入代理→受控SecretRef→独立Settings PATCH与重启的最小HTTP工程入口。
- authority_files: docs/03-功能规格/V1/01-桌面与系统/01-桌面与应用工作区.md；docs/06-决策记录/ADR/0007-V1秘密管理与Provider出站安全.md；主V1-openapi.yaml；新增V1-手动代理秘密配置契约.md。
- dependencies: .herdr/v1-proxy-provisioning-doc-r6.md、I候选.herdr/v1-proxy-input-proposal.md、当前network-route/proxy-transport/SecretService与I r7任务。
- parallel_work_packages: I r7专用route/service/Secret补偿与network tests，D网络录入UI，Lead共享server接线；Planner未另派Worker。
- blocking_decisions: 无新增业务选择；若持久意图需SQL由Lead分配编号。本包不分SQL、不自动批准性能提案或外部release条件。
- required_writeback: I实际实现/命令/hash/限制→D真实用户流程→Verify候选验证；Lead统一状态/事实/正式证据，后续文档回写另派。

## 唯一投影与I建议对应

I建议POST proxy-credentials、endpoint+可选username/password、固定network-proxy/system用途、HMAC幂等、失败撤销补偿和独立PATCH/restart；Lead同时授权非秘密displayName候选及普通工程收敛。本投影采用唯一POST `/api/v1/system/network/proxy-configurations`，operationId=`provisionManualProxy`，不保留另一个路径别名。理由：该操作同时支持无需Basic认证的代理配置，存的是完整受控代理配置而非单个密码。I候选未成为权威，最终以主OpenAPI为准，已通过Herdr回Lead供I/D实施。

请求：requestId、displayName、writeOnly endpoint；username/password可选但必须成对、writeOnly，不接受secretRef/subject/purpose/authorization/allowlist/TLS override。HTTPS代理origin、既有部署host/CIDR/port策略；HTTP仅显式隔离本地测试profile。Basic材料服务端构造，有界UTF-8/base64长度与控制字符验证；无凭据时省略认证header。

成功：201/no-store，仅requestId、manualProxyRef、displayName、status=stored、credentialStatus=not_required|configured。引用服务端随机生成，不能用于通用Secret读取。stored仅表示提交时持久保存，非连通/认证成功/当前路由状态。fresh active管理员Session + system.settings.write + CSRF；API Key/APP bridge拒绝。

幂等：主体+requestId+受控HMAC请求指纹；prepared持久意图→Secret put→receipt/audit/outbox同事务提交。相同committed重放原receipt且不延长/重写秘密；改参409 version_conflict，prepared/compensating 409 request_conflict。Secret或DB/audit失败不返回可用引用，临时ref禁止Settings使用；持久撤销补偿处理崩溃/撤销失败，旧ref始终保留。每个新意图创建新ref，不覆盖正在使用的旧ref。Secret持久期限与短句柄TTL分开，不能直接采用测试put默认60秒TTL。

provisioning无连接/探测，无Settings/context版本变更，无Task、lease确认或route激活。D随后用另一个requestId和当前baseVersion显式PATCH network；旧有效路由及待重启状态沿既有语义；受影响进程重启/全实例确认后才生效。后续PATCH冲突不能误撤旧可用秘密或把新receipt当失败。

## 实际写入（仅四文件）

1. docs/04-技术架构/当前版本/V1-openapi.yaml：新增唯一operation、请求/响应schema和稳定失败描述。
2. docs/04-技术架构/当前版本/V1-手动代理秘密配置契约.md：输入/Secret边界、幂等补偿、TTL/轮换、无激活与I/D最小验收。
3. docs/03-功能规格/V1/01-桌面与系统/01-桌面与应用工作区.md：新增operation与逐操作工程映射，原AC未变。
4. 本回执。r5及此前报告保持封存。

## 实际检查

| 命令/核验 | 结果 | 限制 |
| --- | --- | --- |
| node scripts/check-docs.mjs | exit0；0 errors / 3既有模板warnings | 结构检查 |
| node scripts/review-docs.mjs --phase planning | exit0；SPEC_READY；0 errors / 3原测试资产warnings / 0 blockers | 不证明产品通过，不增占位测试 |
| Python3/PyYAML解析、本地ref、operationId唯一性 | exit0；6机器文件 / 521 refs / 105唯一操作 | 非完整OpenAPI lint |
| Python解析主OpenAPI→仓库AJV8结构正反例及Session-only断言 | exit0；19 payload案例 | 无认证/有Basic合法形状、半对/空值/越长/任意ref/subject/fixture/header拒绝；响应禁止endpoint/password/active/任意ref/restart字段。validateFormats=false，URL/密码内容语义、fresh/CSRF、运行补偿需I测试 |
| git diff --check -- docs | exit0 | whitespace |
| shasum -a 256 facts/实现状态/正式证据 | 与r5封存一致，见下表 | 本包未写状态/事实/审批 |

实际未运行产品测试、网络连接、数据库/迁移、服务重启、Secret写入、依赖安装、提交或推送。I建议文件在本轮后段落盘后已完整读取核对，不等待r7整报告；性能/外部release内容不属于本包审批。

| 保持不变的文件 | SHA256 |
| --- | --- |
| docs-facts.json | 556b5f9a13c692ebc19b2a7f511ae684261164416514e2270064a223f0848de0 |
| docs/02-产品与版本/当前版本/V1-实现状态.md | 816866d68f4b3d40014654ff347e89f132514619f3fece9e9af263aea9537cc7 |
| docs-evidence.json | 968f5517c17580131b00fdbb9c1944bbf299eaa5ea22b466b2ca5511002a1eaa |

next_action：Lead转交I/D按唯一schema实现；I申请必要迁移号并验证持久意图/补偿和无隐式激活。Planner r6封存停写，运行证据回写另派。
