# P0-DOC r5 — 工程投影补全交付

- status: ready（规格小投影全部交付；回报后停写，不代表产品完成）
- work_package: P0-DOC / revision 5 / 2026-10-02
- slice_id: V1-platform、V1-ai-task、V1-assistant
- objective: 既有FR007绑定/参数/Task快照、FR003管理、FR001 APP上下文、FR014分类预览、FR010设备会话管理的唯一工程投影及最小实施边界。
- authority_files: 主V1-openapi.yaml及其引用的extension/extension-management OpenAPI、app-bridge schema；V1-Provider绑定与文本参数契约.md、V1-扩展管理补全工程契约.md、V1-应用实例与SDK桥接契约.md、V1-设备会话管理投影.md；相应FR主规格和既有冻结决策。
- dependencies: .herdr/v1-contract-completion-r5.md及Lead本轮追加授权；H r5/0047、E r6/0049、C IDENTITY r12/0050、G retention r9/0046、I0045/0048；D统一前端r5；Lead接context双cap；F真实窗口。
- parallel_work_packages: Provider先Ready交H；FR003后Ready交E；G retention、D/G/F context、C device分别发稳定字段，未另行派Worker。写入边界见下表。
- blocking_decisions: 无需要改产品规则的新业务选择。迁移分号按Lead最终分配，早先0048建议已改；I0048已冻结。
- required_writeback: owner实际命令/源码hash/限制→Verify独立候选→Lead状态/事实/正式证据；Planner本修订不修改facts/实现状态/审批，后续回写另派。

## 先行交付及唯一投影

| 小投影 | 已交稳定规则 | 实施owner |
| --- | --- | --- |
| Provider | capabilityProtocolId/Version成对精确绑定；response.version/update.baseVersion；options.parameters仅temperature/maxOutputTokens；defaults逐键合并、limits取紧、uiSchemas真实支持；规范化参数+解析Profile/版本/digest+绑定版本原子持久；submit/dispatch重检，执行用保存快照，同requestId重放不重算defaults | H r5，0047；D配置，G签名工作台；Task代码仅Lead明确移交 |
| FR003管理 | custom create、definition get/patch、translation submit/apply、MCP templates/config共7操作；现有scope、Task/Quota/Artifact、trusted source/egress、writeOnly credentials、CAS/幂等/引用保护；不得shell执行source文本 | E r6，0049；H Task适配；D扩展视图 |
| retention | RetentionPreview.packageRetention.failedInstall/stagedPackage各eligibleCount/protectedCount，纳previewDigest；顶层audit计数与Job deleted/skipped/failure保持既有含义 | G r9，实际任务.herdr/v1-retention-packages-r9.md，0046 |
| APP上下文 | 七业务cap之外显式dgos.system.context.read/events；签名双声明+Broker，events同时需read；AppSystemContext/AppContextEventBatch，完整快照/字符串cursor/reset的有限轮询，instance/subject服务端绑定；无hello隐式赋权或raw SSE URL | Lead handler，D host白名单，G消费/签名，F双宿主 |
| 设备会话 | GET sessions只列当前admin自己的非认证sm_管理ID/脱敏device metadata；指定revoke同owner+fresh+CSRF、专用无bearer响应；普通logout DELETE singular session无需fresh；认证/管理ID不可混用 | C r12，0050；D设备页；两API独立验证 |

Provider小投影12例通过后即向Lead发送Ready，未等待扩展；FR00310例及引用核查通过后即发Ready；retention和device/context也已分别通过Herdr回Lead（工具返回agent_prompted）。Lead已确认H/E/C/D开始实施。既有AC不删减；改的是工程输入/映射，不根据代码缺项放宽验收。

## 文件清单

新增docs/04-技术架构/当前版本下：

- V1-Provider绑定与文本参数契约.md
- V1-extension-management.openapi.yaml
- V1-扩展管理补全工程契约.md
- V1-设备会话管理投影.md

更新同目录：V1-openapi.yaml、V1-extension.openapi.yaml、V1-app-bridge.schema.json、V1-应用实例与SDK桥接契约.md、V1-DGOS扩展声明与执行契约.md、V1-公共HTTP投影与内部适配.md、V1-接口契约.md。

功能工程映射更新：FR001桌面与应用工作区、FR003 SkillMCP与Agent接入、FR007模型平台与工作流配置、FR010管理员登录与会话、FR014审计与管理员系统治理。FR010撤销成功响应工程描述同步非认证管理ID，原AC03指定设备/其他保持不变。只新增本回执；r3及V1-AC-CLOSURE r4保持封存。

## 最小任务包边界

| Owner | 可实现边界（以Lead实际派发为准） | 必须给出的结果 |
| --- | --- | --- |
| H | provider-config/adapter、Lead移交Task service/repository/参数tests、0047；不代改扩展管理 | 独立PG worker请求body实际参数、重启snapshot不丢、limits拒绝0Task/0quota/0外发、dispatch版本变化不偷换、未知已发送不重发 |
| E | extensions/runner/extension-routes/tests/extensions、0049；Task通过H接口，server共享注入Lead | 稳定Skill身份/Prompt编辑、翻译Task权限与apply源版本、模板双凭据/Secret补偿、online可信预览远端变更拒装、Run引用/持久幂等 |
| D | Web主/扩展/设备/Provider视图与schema类型/e2e，重叠文件统一r5 | 真实DTO及秘密一次输入、翻译显式确认、参数控件、设备ID管理、context授权/版本消费；UI与路由fixture证据分级 |
| G | 签名工作台参数/上下文消费；独立已派retention/0046 | 新manifest声明/签名digest；原Task复验后协调换包；分类preview/保护/30天清理两阶段恢复与作业计数 |
| C/F/Lead | C设备0050和两API；F可见窗口；Lead context handler/共享接线 | sm_不能认证、列表无bearer、同owner指定撤销/其他不变；APP上下文不借宿主权限、双声明撤权拒绝；双宿主真实显示 |

普通技术细节已在工程契约收敛。Schema不能验证的语义（当前授权、秘密补偿、数值finite、defaults交集、snapshot不变、受信签名/网络、原子receipt）均明确给owner动态断言；本包没有用schema测试代替它们。

## 实际检查

| 命令/核验 | 实际结果 | 边界 |
| --- | --- | --- |
| node scripts/check-docs.mjs | exit0，0 errors / 3既有模板warnings | 最终结果；中间出现5个字段误识别operation警告，移出英文表格说明后消除，未改检查器 |
| node scripts/review-docs.mjs --phase planning | exit0，SPEC_READY；0 errors / 3 warnings / 0 blockers | 保留network-settings.spec.ts、mcp-quick-config.spec.ts、provider-no-export.spec.ts原引用缺口；没有新建占位测试消警告 |
| Python3/PyYAML/JSON解析、全本地ref、HTTP operationId唯一性、capability三处映射核查 | exit0；6文件 / 514 refs / 104唯一操作 / 9 capability | 非全量OpenAPI lint；六文件含主/扩展/管理OpenAPI及bridge/manifest/migration schema |
| Provider schema AJV正反例 | exit0，12例 | paired binding、CAS必需、参数范围/未知拒绝 |
| FR003管理schema AJV正反例 | exit0，10例 | custom ID/字段/确认、patch/翻译apply禁止伪造文本 |
| 最终跨文件AJV正反例 | exit0，19例 | Provider options、翻译、模板credential、非认证device/禁止bearer/IP、retention分类、context cursor |
| Draft2020 bridge AJV正反例 | exit0，7例 | 新context读取/订阅/禁止app覆盖、文本参数范围 |
| git diff --check -- docs | exit0 | whitespace |
| git diff --exit-code -- V1-实现状态.md docs-evidence.json docs/06-决策记录（实际用完整路径） | exit0 | 独占状态/证据/决策未改 |

共48个schema正反例实际通过。AJV采用仓库已有8.20.0，strict=false、validateFormats=false；UUID/date-time/URI格式与运行语义不在这些案例的通过范围。首次批量apply_patch含不存在上下文而整体拒绝，重新定位后成功；失败尝试不算变更。没有产品测试、数据库/迁移执行、依赖安装、提交/推送。事实同步0drift是r4只读核对结果，不冒充r5新测试。

## 封存摘要

| 文件 | SHA256 |
| --- | --- |
| V1-openapi.yaml | 1a5a2a9d1a9415f5ab2cd323e7e1cc2067acbdccd993e757bedf8b659e0f3d91 |
| V1-extension.openapi.yaml | 41ba4f84fa25e2e37fc843cf4190aa278000cbd57fd3dbc8da07df3f6ca5cb67 |
| V1-extension-management.openapi.yaml | d4da381cd72e91244fffbffc26dd8c2f4def6ce7d117a8a162c740001283e58c |
| V1-app-bridge.schema.json | 6282a3cf2105d29dccb99f69acee618996c0e51e5cc482ccfb3c3f4d28f1c9da |
| docs-facts.json（与r4读取一致） | 556b5f9a13c692ebc19b2a7f511ae684261164416514e2270064a223f0848de0 |
| V1-实现状态.md（与此前读取一致） | 816866d68f4b3d40014654ff347e89f132514619f3fece9e9af263aea9537cc7 |
| docs-evidence.json（与r4读取一致） | 968f5517c17580131b00fdbb9c1944bbf299eaa5ea22b466b2ca5511002a1eaa |

next_action：Lead按已派H/E/C/D/G/F实施与独立验证；本包Ready封存并停止写入。后续真实证据回写另派，规格通过与产品/发布证据始终分开。
