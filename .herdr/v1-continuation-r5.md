# V1 持续开发接续 r5

用户再次明确立即持续推进完成V1。Lead已逐会话核验全部交接/停止，F上游429原会话恢复。所有人沿用原客户端、主目录和领域所有权；公共server/worker仍Lead唯一写入。以下是新的明确工作包，不重复执行旧修订。无需再询问普通技术实施许可，不提交推送，不删除他人产物。

| Owner / ID | 新修订 | 任务与唯一写入路径 |
|---|---|---|
| A / V1-ACTIONS | r5 | 对照P0-DOC-r2严格ActionDeclaration risk/sideEffects/confirmation/idempotency投影，修src/actions（排除Lead runtime/candidate-routes）与permissions相关适配；tests/unit/runtime.test.mjs由Lead移交A，修真实安装/声明fixture和manifest必填，不放宽规则。补actionId绑定不能被body.appId覆盖，给Lead公共投影factory；专项通过交.herdr/V1-ACTIONS-r5.md。 |
| B / V1-TASK | r5 | 独占Compose15200组继续核心HTTP验收，Lead已修confirmations注入。允许核SHA应用冻结0039=07259111a3c3808c5e6070b0189bd0bf74dcd040623b137590b17bd452bd8b12，重启API/worker后跑scripts/v1-core-compose.mjs；只写该脚本及V1-core追加报告，产品只读。若11项过立即报告并归还环境以供D真实浏览器。 |
| C / V1-QUOTA-REVIEW | r6 | Quota API阻塞已修，跑已授权quota测试并处理本域真实缺陷，不碰Verify所有ai-task-api。缺调用方authContext报Lead。继续按FR015验有效窗口/amount/needs_review/越权和审计回滚，给.herdr/V1-QUOTA-r6.md。 |
| D / V1-UI | r4 | 原D前端路径，读P0-DOC-r2唯一HTTP投影，准备同步Settings顶层快照与{domain,patch}请求，旧嵌套不能长期保留；G deployment路径冲突按主OpenAPI独立GET。补协议确认出票UI按H报告；G桥/包完整Task流程待Lead接，fixture先通过，B归还后真实API独占联调。报告.herdr/V1-UI-r4.md。 |
| E / V1-EXT | r4 | 对照P0-DOC-r2精确dependencies包/skill/source/version/operationIds，消除别名和通配；扩展confirmation重放早于expiry与消费比较全部字段；HTTP MCP接真实共享ProviderEgress避免HTTPS仍SSRF；原E源码测试路径。补mcp quick config真实场景；配置loader Linux隔离限定执行profile。报告.herdr/V1-EXT-r4.md。 |
| F / V1-DESKTOP | r4 | 恢复原会话429后，从r3真实无API请求失败定位原生fetch bridge/权限配置，原desktop/macos领域；不要归因未签名就停。可做ad hoc本地构建和测试专用钥匙串，不造DeveloperID。真实窗口/API请求失败修至fixture可复现或精确宿主阻断，报告.herdr/V1-DESKTOP-r4.md。 |
| G / V1-PACKAGES | r5 | 依P0-DOC-r2主OpenAPI实现GET /apps/{appId}/deployment唯一投影，撤销自拟installations平行接口；源目标digest绑定moves journal、拒绝链式/重复moves；官方AI工作台必须经桥完成真实Task/SSE/Artifact不只握手demo。原G域+apps/ai-workbench-package，Lead runtime-config不动。报告.herdr/V1-PACKAGES-r5.md。 |
| H / V1-PROVIDER | r4 | confirmations主server已修，跑本域/协议公开回归；text profile声明必须实际接Task operation profile，不仅存目录；旧历史SemVer不可覆写/状态版递增/confirmation重放契约。原H路径，补provider-no-export场景。0039已冻结不改。报告.herdr/V1-PROVIDER-r4.md。 |
| I / V1-OPS | r4 | D已build成功，重跑生产镜像并检查API/worker命令可启动，原I路径；读最新package/extension配置依赖。用专属端口15181–89/临时资源实测持久秘密重启恢复与依赖不可用readiness，真实HTTPS本地受控CA可验证但不得称公网/生产。报告.herdr/V1-OPS-r4.md。 |
| Planner / P0-DOC | r3 | 原授权docs/facts，仅新增H协议confirmations操作/schema、收敛G自拟installations与主deployment、SDK桥capability逐项映射、Settings/Action唯一投影；向Lead/D先给稳定字段。检查当前AC缺口而不升完成态。报告.herdr/P0-DOC-r3.md。 |
| Verify / V1-VERIFY-INTEGRATED | r3 | 主目录产品只读，独立审查本轮B11项证据及新API构造；现有临时库harness在5432/dgos_v1_integrated生成独有子库，可跑targeted PG（不要B15200组）；只写.herdr/v1-verify-integrated-r3.md及追加V1-verify报告/manifest。按实际缺陷返Lead，不偷偷改产品/旧证据。 |

所有测试不得用原dgos库。B独占15200–29；A15101–09/actions，C15121–29/governance，D15131–39，E15141–49/extensions_r3final，F15151–59，G15161–69/packages，H15171–79/provider，I15181–89。Verify子库精确cleanup。主目录文件仍变，报告源码摘要及漂移，不把旧批次升级当前通过。
