# P0-DOC r3

- status: ready（r3文档交付；不代表V1实现/发布通过，回报后停止本修订写入）
- work_package: P0-DOC / revision 3 / 2026-10-02
- slice_id: V1-platform、V1-ai-task、V1-assistant
- objective: H协议confirmations公开schema、唯一deployment与七项SDK桥接映射；保留Settings/Action唯一投影并核查当前AC缺口。
- authority_files: docs/04-技术架构/当前版本/V1-openapi.yaml、V1-app-bridge.schema.json、V1-应用实例与SDK桥接契约.md、V1-公共HTTP投影与内部适配.md；FR007主文档；原冻结决策D025/D027/D028/D030/D032。
- dependencies: .herdr/v1-continuation-r5.md Planner r3及H/G报告；Lead/A/D/E/G/H各域适配；Verify绑定候选独立验收。
- parallel_work_packages: 沿用Lead r5派发；Planner没有另派Worker。Lead/H对齐确认重放和Profile执行，G/D对齐deployment与包内桥，A/Lead/D对齐Settings/Action。
- blocking_decisions: 无新增业务选择；H/Lead实现差距按已授权唯一契约适配。
- required_writeback: Lead统一实现状态/正式证据，Verify复核完整AC；Planner仅docs/facts与本回执，不提升实现。

## 稳定投影及回Lead

1. 主OpenAPI新增issueCapabilityProtocolConfirmation：POST /api/v1/provider/capability-protocols/confirmations。严格publish/state两个分支；201回confirmationId/requestId/expiresAt/digest。Session-only、新鲜认证、CSRF、provider.protocol.write。五分钟票据，发布/启停共用出票requestId；同绑定出票不续期，业务成功重放返回原结果，原子审计/结果/消费。
2. deployment唯一GET /api/v1/apps/{appId}/deployment，app.catalog.read、认证主体。AppDeployment.versionNumber用于CAS；无历史404，卸载记录200且activeRelease=null。旧G r4 installations不注册为公共备选。
3. bridge.schema的call定义七项精确输入；主OpenAPI登记响应及scope映射。保持dgos.model.list/resolve及Task/Artifact五项，拒绝dgos.provider.list/models并行别名。模型list受控聚合可选模型摘要；resolve以真实Adapter/Profile返回解析。Task submit使用完整领域输入、外层requestId；事件为有限JSON批次，原HTTP SSE不改。
4. Settings顶层快照与{requestId,baseVersion,domain,patch}、Action公开风险/多能力/双版本沿用r2。新增confirmed UI流程、错误与AC追踪，不改已有完成态。

已通过Herdr向经只读核验的DGOS Lead wJ:p1发送两次关键投影及一次检查差距（工具确认agent_prompted）；由Lead转发D/G/H。主目录持续并发，H旧报告server未注入问题已见修复，不复述为当前阻塞。

## 实际变更文件

- docs/04-技术架构/当前版本/V1-openapi.yaml
- docs/04-技术架构/当前版本/V1-app-bridge.schema.json
- docs/04-技术架构/当前版本/V1-应用实例与SDK桥接契约.md
- docs/04-技术架构/当前版本/V1-公共HTTP投影与内部适配.md
- docs/04-技术架构/当前版本/V1-接口契约.md
- docs/03-功能规格/V1/07-模型与配置/01-模型平台与工作流配置.md
- docs/03-功能规格/V1/V1-AC资产核对-2026-10-02.md
- docs-facts.json（只新增出票operation与FR007关系，planned/draft、evidence为空）
- 本回执；r1/r2回执不覆盖。

## 限制及剩余验收

- H r3静态目录无成功发布/启停结果存储，内存目录只保留最新声明；出票路由允许字段全集，须严格拒绝另一分支多余字段。已有PG专项证明错Session回滚/消费一次/stateVersion子集，不覆盖全部过期/成功重放/故障回滚/真实UI。
- 新app-capabilities代码读取时仍使用provider别名；最终代码由Lead整合。SDK模型选择必须检查账号、配置、目录、policy和Profile，不能只看enabled/text。桥须以SDK字符串检查APP声明/Broker并以固定scope约束主体权限，未授权不得借管理员宿主放行。
- 三项旧测试引用仍缺：network-settings、mcp-quick-config、provider-no-export。完整AC缺口超过机器警告数。
- facts-sync只读检查报告11项功能implementation_status漂移；遵守本包“别升实现”，未运行--write，交Lead按唯一状态源与真实证据处理。
- 无产品测试、数据库操作、提交/推送；静态/schema结果不证明浏览器、双宿主、真实Provider或生产验收。

## 检查结果

| 实际命令/检查 | 结果 | 限制 |
| --- | --- | --- |
| node scripts/check-docs.mjs | exit 0；0 errors / 3既有模板warnings | 结构检查 |
| node scripts/review-docs.mjs --phase planning | exit 0；SPEC_READY，0 errors / 3 warnings / 0 blockers | 三项缺测试引用仍保留；不表示完整AC通过 |
| node scripts/spec-docs.mjs facts-sync --check | exit 0但报告11项FACT_DRIFT | FR001/002/005/007/009/010–015的implementation_status；不执行自动写回，不视为零漂移 |
| Python3/PyYAML/JSON本地ref、paths operationId及映射核验 | exit 0；5文件 / 448 refs / 94唯一操作 / 7匹配capability | 非完整OpenAPI lint；未联网解析外部schema |
| Node AJV 8.20.0 draft2020 bridge编译与正反例 | exit 0；23案例 | 含七能力有效输入、身份注入/旧别名/缺字段/错intent/负或小数游标拒绝；validateFormats=false |
| Python解析OpenAPI管道到Node AJV确认请求编译与正反例 | exit 0；9案例 | 两分支有效；跨分支字段/身份注入/无效修订/digest形状/operation/缺requestId拒绝；validateFormats=false；不验证运行时digest和身份 |
| git diff --check -- docs docs-facts.json | exit 0 | whitespace |
| git diff --exit-code -- docs/02-产品与版本/当前版本/V1-实现状态.md docs-evidence.json docs/06-决策记录 | exit 0 | 独占状态/正式证据/冻结决策未由本包修改 |

工具探测记录：Python jsonschema未安装；从apps/api直接解析AJV未成功，随后定位并复用仓库pnpm已有AJV，无依赖安装。第一版ref脚本递归误把属性schema的operationId计为HTTP操作而报错，改为仅统计paths下HTTP方法后通过；不把失败尝试记作成功。全部机器校验是本次实际临时命令，未添加镜像实现的产品测试。

## 源码快照与交接

HEAD为72ab1cb98b064a6e27b9f60a9f8f00881a827a99加并发未提交主目录。检查末尾shasum -a 256记录以下时点，后续源码漂移须重新绑定候选，不能拿本次文档检查代替产品证据：

| 路径 | SHA256 |
| --- | --- |
| apps/api/src/provider-protocol-routes.mjs | 5fcd399630e3468034019d294016db7d1d0d9cb39375bfb8d0629a09222a35ae |
| src/provider-config/protocol-confirmations.mjs | 3c105ffdde1b53e0e13d80b180bfc5072f9c17ec9bad1187aef08cffa3fdf0f7 |
| src/provider-config/text-profile-directory.mjs | 825b290d1545c6e2825d238c932ebb3915d763c788a36f8be4318830159a2597 |
| apps/api/src/app-capabilities.mjs | 5e2d16586eee9ed217901ab1face8792217cf5993c41a507d423e8c9def7b567 |
| apps/api/src/package-routes.mjs | 48dbe9ac6d5b70904e9df1313e8b1b1e93632b5012a8f7eb8e82dce542d0a2ce |

next_action：Lead按上述唯一投影整合H/G/D/A代码与tests，Verify绑定当前候选验收；facts漂移由Lead核准后再定向回写。Planner r3交付停写，后续变更使用新明确修订。
