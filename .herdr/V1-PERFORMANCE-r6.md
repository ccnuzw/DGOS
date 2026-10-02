# V1-PERFORMANCE r6 交付报告

status: local_smoke_observed_with_source_drift; 受限 smoke 已运行，但源码漂移门禁使批次退出 1
work_package: V1-PERFORMANCE r6 / Worker-B / Codex
workspace: /Users/apple/Progame/DGOS
baseline_head: 72ab1cb

## 工具与口径

`scripts/v1-performance.mjs` 是短时本地校准工具。它针对公开 API 的 System Settings 读取、Usage 查询和代表性 AI Task 提交，运行 ramp、short steady、8 并发上界探针及 recovery 四段。每段按原始请求计算 p50/p95/p99、吞吐和成功、预期容量拒绝、非预期 4xx/5xx、传输/超时分类；逐秒采 API/Worker/生成器 RSS、Task 队列深度和 PG 连接/提交数。结束后按批次 owner 核对 Task 终态、唯一 attempt、quota settlement、usage、artifact、terminal event、submit audit outbox、上游调用次数及负用量。报告记录生成器活跃度、阶段超时、采样失败、源码/配置摘要与清理状态；原始凭据与响应体不输出。

`.herdr/v1-performance-profile-r6.json` 仅为 `engineering_proposal_unapproved`。本地上界 8 并发、16 次 Task 尝试、45 秒总窗口、阶段累计 10 秒。提议的本地单节点评审带宽为 Settings p95 300ms、Usage p95 400ms、Task admission p95 800ms、Task terminal p95 5000ms、非预期错误率 0.5%、恢复 30 秒；这些数字不是批准的服务目标，也不构成验收阈值。正式阈值须按选定部署拓扑、业务流量模型和观察窗口重新校准并获负责人批准。

## 安全边界

- 启动必须显式提供 `DGOS_PERF_STARTUP_READY=1`、本机 `postgres` 维护库 URL、本机 Redis `/8`、15111–15119 内 API/fixture 互异端口。脚本精确校验看板已冻结的 0045/0046/0047/0048/0050 SHA，按实际清单计算整套迁移 SHA 并写入批次 manifest；0049 未冻结，明确排除。旧版要求手工传迁移集 SHA 的门禁已由 Lead 授权改为实际冻结清单校验。
- 运行时生成 `dgos_v1_perf_<hex>` 子库、Redis DB8 的 `v1-perf:<子库>` 命名空间和私有临时目录；API/Worker 使用该命名空间的 Redis Secret、登录回退和限流键。退出时只停本脚本子进程、关闭 fixture、删除本子库、仅扫描删除该命名空间键并删除临时目录，不执行 Redis flush，不触碰 D 的 15200 组、原 `dgos` 库或真实付费 Provider。
- 脚本不会比较提案阈值后自动宣告 release pass。未获批准 profile、并发生成器饱和、资源采样失败或业务不变量异常均不能形成有效性能验收。

## 实际验证

- `pwd` → `/Users/apple/Progame/DGOS`；`git rev-parse --short HEAD` → `72ab1cb`。
- `shasum -a 256 migrations/0045-network-route-activation.sql` → 上述冻结 SHA，退出 0。
- `node --test tests/tooling/v1-performance.test.mjs` → 2/2 通过、0 失败、退出 0；覆盖未批准 profile 的负载上界、原始样本分位数、未 ready/错误数据库/DB0/冻结 SQL SHA 漂移拒绝。
- `node scripts/v1-performance.mjs`（未设置 ready 回执）→ `perf_startup_ready_receipt_required`、退出 1；仅验证 fail-closed 入口，未创建服务/数据库。
- `node --check scripts/v1-performance.mjs`、`git diff --check -- scripts/v1-performance.mjs tests/tooling/v1-performance.test.mjs` → 退出 0。
- I 的网络接线本地真实链 2/2 与交付报告已记录，Lead 明确授权恢复本地 smoke。`SELECT current_database()` 对本机维护库返回 `postgres`，Redis DB8 `PING` 返回 `PONG`；15111/15112 无监听。`DGOS_PERF_STARTUP_READY=1 DGOS_PERF_ADMIN_URL=<redacted> DGOS_PERF_REDIS_URL=redis://127.0.0.1:6379/8 node scripts/v1-performance.mjs` 在本轮有四个追加批次，均退出 1：首轮脚本变量初始化错误；次轮 API 缺独立 package root；第三、四轮完成四段实测，但并行工作树源码变化触发 `source_drift=true`。前三轮及最后批次都保留，不覆盖。
- 最后批次 [报告](V1-PERFORMANCE-r6-2026-10-02T01-20-55-016Z-63397cb0.md) / [manifest](V1-PERFORMANCE-r6-2026-10-02T01-20-55-016Z-63397cb0-manifest.json)：四段分别 280/709/1230/236 请求，观测吞吐 111.59/235.77/490.17/117.38 rps，均为成功 HTTP；Settings p95 分别 9.91/10.60/8.95/8.39ms，Usage p95 为 7.43/5.88/3.89/4.31ms，Task admission 每段 4 个样本，p95 为 39.18/24.58/16.94/16.94ms。16/16 Task 进入成功终态，16 次上游调用、0 个结算/Artifact/事件/审计异常、0 重复/负用量；终态 p95 416ms。最大活跃并发 8、10 个资源采样、0 采样失败，生成器未报告饱和。随机库 `dgos_v1_perf_e0b14f6c30bf` 已删除，Redis DB8 本命名空间 2 个键已删除。
- 最后批次 profile SHA 前后一致，但 `working_tree_sha256` 前后不同，故 `source_drift=true`、退出 1。实测只用于观察，不是有效冻结校准、批准负载、staging 稳态或 production/release 通过。8 并发仅为本地上界探针，没有触发可分类的容量拒绝，因此未证明过载拒绝与恢复行为。

## 后续输入

1. Lead/Verify 在源码停写并冻结候选后安排下一轮无漂移校准；本轮并行写入期间不重复轮询重跑。
2. 性能/发布负责人确定目标部署、批准的负载 mix、流量/并发、观察窗口、阈值、过载预期拒绝语义和批准记录；再执行 staging 稳态与过载恢复验收。

files_changed: [`scripts/v1-performance.mjs`, `tests/tooling/v1-performance.test.mjs`, `.herdr/v1-performance-profile-r6.json`, `.herdr/V1-PERFORMANCE-r6.md`, 追加 `.herdr/V1-PERFORMANCE-r6-*-manifest.json` 与同名报告]
tests_added: [`tests/tooling/v1-performance.test.mjs`]
commands_run: [`pwd` 成功, `git rev-parse --short HEAD` 成功, `shasum -a 256 migrations/0050-session-management.sql` 与授权 SHA 一致, `node --test tests/tooling/v1-performance.test.mjs` 2/2 通过, `node --check scripts/v1-performance.mjs` 成功, `git diff --check` 成功, `node scripts/v1-performance.mjs` 缺 ready 时 fail-closed 退出 1, 隔离 smoke 四批均退出 1 并完成本轮资源清理]
implementation_facts: [受限性能脚本与未批准 profile 已建立, 精确冻结迁移清单通过并排除0049, 四段真实本地数据已采但源码漂移, Task 与 0047 产品源码归 H 只读]
contract_changes_proposed: []
open_risks: [共享源码并行变化使本轮批次 source_drift=true, 目标负载及阈值未批准, 未触发容量拒绝, 无 staging/生产环境结论]
docs_to_update: [Lead/Planner 在正式批准负载与有效证据后更新性能执行空间和发布门禁]
unfinished_items: [停写冻结后重跑有效校准, 目标环境稳态和过载恢复验证]
lead_or_planner_decisions: [目标环境与负载/阈值/观察窗口的正式批准]
