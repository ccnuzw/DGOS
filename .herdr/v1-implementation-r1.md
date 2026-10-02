# V1 实施工作包 r1 — 2026-10-02

用户已授权 Lead 持续推进整个 V1，统一安排任务并动态增加 Worker。交付 ID：`DGOS-V1-IMPLEMENT-20261002`。基线：`72ab1cb98b064a6e27b9f60a9f8f00881a827a99`。产品范围保持 12 项 active 功能和既有冻结决策。

## 通用边界

- 每个 Worker 只在下表指定 worktree 执行文件写入、依赖安装和本包测试；主工作区 `/Users/apple/Progame/DGOS` 由 Lead/Planner/Verify 使用。
- 必须读取主工作区 AGENTS.md、`.herdr/roles/worker.md`、docs/README.md、功能开发流程、对应功能与设计、冻结决策、OpenAPI/数据/ADR 和日期化缺口计划。worktree 内 AGENTS.md 是本工作包入口。
- 已冻结规则内的实现细节自行推进；先核对 Ready 和实际接口，遇到影响权限/删除/状态/幂等的真实契约冲突，回报 Lead，仅暂停受影响子切片。不得用新规则掩盖缺陷。
- 不提交、推送、变更客户端/模型、开启其他 Agent 或清理其他工作区。交付未提交 diff 和新增资产。Lead 整合后安排 Verify，不能自报整体 V1 完成。
- 可运行 `pnpm install --frozen-lockfile`（UI 依赖变更例外，见下）、本领域 unit/integration、构建。数据库测试使用本包独立测试数据库；不得对原 dgos 库做清空、迁移回滚或变更共享服务。没有数据库先跑不依赖服务的测试并回报。
- 真实付费上游、生产密钥/签名等外部资源未明确配置时用受控 fixture，明确证据等级，不能伪造生产证据。
- 公共 `apps/api/src/server.mjs`、`apps/worker/src/worker.mjs`、contracts/sdk、Compose 和原有 migration 序列由 Lead 串行整合。Worker 在独立新模块提供路由/worker 注册函数并回报接线点；不要各自在共享入口做大规模修改。
- 新 migration 保留历史 checksum，按下表区间分配。依赖未落地主表时提交设计和可幂等前置检查，Lead 确认顺序。
- 每包报告写入本 worktree 的 `DELIVERY-<ID>-r1.md`，含 ID/修订、源码差异、命令及退出码、验收分支、集成方法、遗留问题。完成后停止写入待 Lead 新修订。

## 任务分工

| ID / Worker | worktree（根目录下 `.worktrees/`） | 主要写入边界 | 目标与验收出口 |
| --- | --- | --- | --- |
| V1-ACTIONS / A | v1-actions | src/actions、src/system；新增 actions 路由/worker 模块；本领域测试；0016–0018 migration | FR009/001：持久输入、独立可恢复 Action worker、lease/claim、取消信号、确认/版本/幂等、脱敏审计；受控自然语言→已注册动作候选（不任意执行），公开设置/导航动作；进程重启及取消不得伪终态或重复副作用。UI交D。 |
| V1-TASK / B | v1-task | src/ai-task、src/quota；本领域测试；0019–0021 migration | FR005/015：预检拒绝无任务副作用；Task/Attempt/Event/Artifact/Quota可恢复一致终态；上游提交不确定时不得盲重发，按已有契约显式失败/待核对并留证；reconciliation基于任务事实；取消/超时/重复/SIGKILL。Provider准入与H协调接口。 |
| V1-GOV / C | v1-governance | src/identity、src/security/secret-service.mjs、src/security/rate-limiter.mjs、src/permissions、src/audit、apps/api/src/identity-service.mjs、governance-service.mjs；新增治理路由模块；0022–0024 migration | FR010/011/014：Key有限轮换窗口/资源scope/撤销一致性、会话再认证/限速边界、生产Secret接口与加密受控backend/fail-closed、治理policy及retention事务审计和30/180天边界；权限broker与A协调。缓存不是必建项，不增加多用户/法务保留。 |
| V1-UI / D | v1-ui | apps/web、packages/design-tokens、packages/dgos-ui、packages/app-shell、packages/host-adapter/web；root package/lock只为UI依赖；UI测试 | FR001/002/003/005/007/009–015：React/TS/Vite + 共用Shell和路由；应用目录/设置/开发者/Skill/MCP/助手/Provider/AI/Key/治理用量页面；中英文/双主题/键盘/倍率；显式validate/refresh；taskId和表单重载恢复。现有API工作流保持兼容，对待接新路由显示真实不可用状态，不假造成功。 |
| V1-EXT / E | v1-extensions | apps/extension-runner、src/extensions、新增扩展路由模块；扩展测试；0025–0027 migration | FR003：按OpenAPI提供Skill/MCP管理、来源预览/信任、安装启停/连接/工具发现/调用/取消、最小权限与Secret/Audit接口、隔离runner和持久Run；未确认/无权不启动进程，重复启动/超时/关闭页面恢复可验。不扩大到未来通用Agent/Canvas。 |
| V1-DESKTOP / F | v1-desktop | apps/desktop、packages/host-adapter/macos；桌面测试与宿主文档 | FR001/002/005/010：Tauri打包API路由/CSP/Origin、宿主窗口和工作区恢复、独立Session/钥匙串适配；真实原生GUI执行路径与可运行e2e替换固定exit2；安全签名构建准备。不得伪造签名/GUI证据，前端由D提供dist，保持开发回退可说明。 |
| V1-PACKAGES / G | v1-packages | src/apps；新包存储/安装路由模块；包测试；0028–0030 migration | FR002：真实包资源digest/签名/信任根验证、审核目录、暂存/切版/健康检查/回滚/卸载保留数据、不可卸载预装策略；静态包隔离与公开动作注册联动接口；篡改包/路径穿越/无授权拒绝且旧版无损。 |
| V1-PROVIDER / H | v1-provider | src/provider、src/provider-config、src/provider-adapters、src/security/provider-egress.mjs、apps/api/src/provider-service.mjs、apps/worker/src/provider-test-worker.mjs；新增provider路由模块；0031–0033 migration | FR007/012/013：失败停用和新任务准入、账号/config归属/协议/引用、connection独立worker/续租/取消/错误；文本Profile/声明式白名单、DNS/TLS/重定向/网络；不隐式刷新启用，已提交任务按原taskId收敛。向B暴露准入函数并给Lead接线。 |

## 首轮整合约定

先交可运行垂直子切片和测试，不等待整包所有内容齐备才报告。每个 Worker 初读后反馈已接受 ID/r1、准确 cwd、拟改路径和依赖。主工作区未提交文档和 Herdr 配置不天然存在于 worktree，使用绝对路径读取上述入口。

Lead 负责维护本看板和集成入口，Planner 主写 docs 与机器契约，Verify 在里程碑独立核对。迁移、跨域事务、接口响应必须对齐；任何新增公共字段先提交 Planner/Lead 记录，按现有冻结语义实施。全局最终目标仍为 12 项业务 E2E、适用 UI/NFR 和 3 项发布门禁，局部通过不代表全版通过。

## 已准备的隔离测试资源

现有 `dgos-postgres-1` 保持运行，Lead 已创建以下空库；连接使用本地开发 PostgreSQL 的 dgos 用户，host `127.0.0.1:5432`。仅操作分配的数据库，不清空原 `dgos`。Redis 为本地开发 `127.0.0.1:6379`，指定 DB 与键前缀；禁止 FLUSHALL。

| Worker | 数据库 | 端口 | Redis DB / prefix |
| --- | --- | --- | --- |
| A | dgos_v1_actions | 15101–15109 | 1 / v1-actions |
| B | dgos_v1_task | 15111–15119 | 2 / v1-task |
| C | dgos_v1_governance | 15121–15129 | 3 / v1-gov |
| D | 不需要共享数据库 | 15131–15139 | 不适用 |
| E | dgos_v1_extensions | 15141–15149 | 4 / v1-ext |
| F | 不需要共享数据库 | 15151–15159 | 不适用 |
| G | dgos_v1_packages | 15161–15169 | 不适用 |
| H | dgos_v1_provider | 15171–15179 | 5 / v1-provider |
| Verify/Lead | dgos_v1_integrated | 15200–15229 | 6 / v1-integrated |

## Planner / Verify 首轮

P0-DOC r1：Planner 在主工作区独占 docs 当前功能、架构、工程与执行文档及 docs-facts.json，优先统一 FR002/003 机器契约；不写唯一实现状态、日期化缺口报告、docs-evidence、冻结业务决策和历史报告。报告 `.herdr/P0-DOC-r1.md`。所有新业务选择仍交 Lead。

V1-VERIFY-SETUP r1：Verify 只读现有源码/执行脚本与隔离资源，新增 `.herdr/v1-verification-plan-r1.md`，输出可复用验收入口和缺资产映射。实际整合测试待 Lead 绑定构建后派发。

## 增补 V1-OPS r1 / Worker-I

独立工作区 `.worktrees/v1-ops`，基线同前。允许新建 `src/security/durable-secret-service.mjs`、`src/security/runtime-config.mjs`、`scripts/v1-ops-*.mjs`、`deployment/`、`docker-compose.production.yml`、本领域安全/恢复测试和 `DELIVERY-V1-OPS-r1.md`。不改 C 的 `secret-service.mjs`、其他领域代码、公共入口、根依赖或 Planner 文档。

按 ADR0006/0007 实现持久受控 Secret backend 适配（文件密文或受控外部backend，根密钥由已有钥匙串/外部读取句柄提供，禁止普通env默认持久凭据），用途/主体/版本/短时句柄、撤销/轮换/并发/故障拒绝；Redis丢失不损失持久秘密。生产配置拒绝默认密码/fixture/缺backend，部署HTTPS反代/健康和恢复脚本可执行，备份只含密文与引用，根密钥走独立恢复流程；做真实临时磁盘恢复和不泄密测试。不要把本地加密backend标为外部KMS验收，不造RPO/RTO目标或签名/真实Provider证据。新增测试独立tmp目录，端口15181–15189；无需碰PG原库。与C SecretService put/resolve/revoke/inspect接口及F钥匙串接口对齐，给Lead精确启动接线。
