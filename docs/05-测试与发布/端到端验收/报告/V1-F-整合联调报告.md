# V1 任务 F 整合联调报告

日期：2026-10-01。环境：macOS / Node 22 / pnpm 9 / Docker Compose PostgreSQL 16、Redis 7、Node 22；外部依赖为受控 OpenAI-compatible HTTP fixture。

结论：**本地跨进程任务闭环已运行；V1 发布门禁仍阻塞，不能标记 Release Candidate。** 最终源码提交和执行批次在本报告“最终证据”登记。实现状态以 [V1 实现状态](../../../02-产品与版本/当前版本/V1-实现状态.md) 为准。

## A–E 交付复核

| 任务 | 输入提交 | 实际交付与缺口 |
| --- | --- | --- |
| A | b7e8950 | HTTP fixture/PG API 与 Web 测试资产；原 Web harness 使用 quota stub/providerRunner，未构成完整跨进程证据。 |
| B | f682cd2 | 独立 worker 构造；默认内存秘密无法跨进程，API PG 分支仍会 queueMicrotask。F 已修复并实际启动两个消费者。 |
| C | 2064b83、cff3a4f | 助手 UI、lease 字段与内存 inject 测试；缺 handler_claimed DDL，PG 权限异步处理错误，尚无完整 restart/re-dispatch。 |
| D | 411f506 | Origin 校验、Key 事务封装与内存治理测试；PG Key state 映射、renew 同事务和审计分页在 F 补修。 |
| E | 13713d6 | Tauri 配置与 Rust 源码可构建；GUI E2E 脚本始终 skip/exit 2，缺真实窗口任务/登录恢复证据。 |

所有输入分支均已合并。早期整合曾产生冲突残留、重复声明、缺参数与无效 route 调整；后续已修复，并恢复曾被放宽的治理审计严格断言。失败批次保留，不能引用早期宽松断言的通过结果作为发布证据。

## 本轮修复与验证范围

- PG API 只排队；API/worker 共享带主体/purpose 校验的 Redis Secret；CLI 关闭 pool/Redis；fixture transport 明确限制为测试环境和 synthetic origin。
- 两 worker 竞争领取；跨进程取消通过 heartbeat 检查中止请求；finishAttempt SQL 参数与状态条件修复。
- Adapter 按流读取/校验 SSE；Web 持续读取事件游标与快照；修复模型 Enable 事件绑定与 policyVersion。
- 代理部署支持显式 Origin allowlist；恢复内存 Identity 到 Audit 的连接；PG Key rotation 状态与审计分页修复；Session renew 使用事务 client。
- PG Action/Permission 读取等待异步结果；Action schema 校验、claim 防止回退重复执行；助手对象参数解析为 JSON。
- 增量 migration `0014-audit-runtime-targets.sql` 将审计目标扩展为文本，支持已公开的 actionId/permission key；`0015-action-handler-claim.sql` 补齐 C 代码依赖字段。历史 SQL 未修改。回滚 0014 前须确认不存在非 UUID target；0015 回滚须先停止 Action 执行器。

## 重复执行

```sh
pnpm install --frozen-lockfile
docker compose -f docker-compose.integration.yml up -d --wait --scale worker=2
pnpm run test:release
node scripts/verify-release.mjs
docker compose -f docker-compose.integration.yml down
```

首次命令要求该专用 Compose 环境为空库。重跑先对 `dgos-release` 执行 down，再 up；其 PostgreSQL 使用 tmpfs，专用端口为 15432/16379/13000/14173/14080。不要对用户原环境运行清空操作。脚本只把业务 ID、状态、源码摘要、截图写入报告，不保存令牌或备份正文。

## 发布判定

| 门禁 | 判定 | 原因 |
| --- | --- | --- |
| V1-RG-001 | Blocked | 规格/证据机器门禁需运行复核，首发 FR-003 Agent runtime 与对应验收资产仍缺；没有延期批准。 |
| V1-RG-002 | Partial / release blocked | Web→真实 API/PG/worker/adapter→fixture→SSE/Artifact 本地链路成立；缺真实外部 Provider/TLS 和 macOS 对应闭环。 |
| V1-RG-003 | Blocked | 本地权限/设置/Key/审计/数据库恢复有证据；Action restart recovery、桌面窗口/包签名、生产 KMS、生产灾备及完整治理失败封闭仍未达发布要求。 |

明确限制：SIGKILL 发生在上游请求后会重发，虽然本轮只产生一个 reservation/usage，不能宣称上游 exactly-once。Action lease/reclaim 没有保存输入和重新派发 handler；执行中取消也不保证已发生副作用可撤销。当前 Web SSE 是游标轮询快照，页面重载不恢复 taskId。浏览器助手测试通过重新载入已认证页面执行；整页 Refresh/重绘会清空未提交表单。Provider connection worker 尚未纳入独立进程主循环；API Key 即时轮换没有重叠窗口。System/Permission 等写入与审计仍需全面同事务失败注入。Redis Secret 不是生产 KMS；本地 PG dump/restore 不含 Secret 恢复。

桌面：`pnpm -r build` 包含 `cargo check`，另实跑 `cargo build --manifest-path apps/desktop/src-tauri/Cargo.toml` 成功。`cargo tauri --version` 报未安装；`pnpm --filter @dgos/desktop e2e:macos` exit 2。打包后相对 `/api` 的路由与 CSP/Origin 尚需完成；不能用浏览器截图替代原生窗口验收。

## 最终证据

被测源码提交：`d20f0fb45795eab65b1422927b47fc390c5a18f0`（整合实现 `156ed72` + 初始化关闭顺序修复）。运行时仅文档待回写，源码无未提交差异；后续证据提交只包含文档/报告。

| 验证 | 结果 | 证据 |
| --- | --- | --- |
| Compose 真实浏览器/API/PG/双 worker | 14/14，exit 0；耗时约 25 秒 | [批次报告](F-2026-10-01T14-57-48-215Z.md)、[manifest](F-2026-10-01T14-57-48-215Z-manifest.json) |
| 隔离 PG 全量 Node 测试 | 65/65，0 fail、0 skip | [原始输出](F-checks-2026-10-01T14-56-48-258Z/1.txt) |
| Web Playwright | 1 passed、1 skipped（旧 A harness 缺 API_BASE_URL；真实 Web 由 F 覆盖） | [输出](F-checks-2026-10-01T14-56-48-258Z/2.txt) |
| 助手专项 | 1/1（内存 API contract 补充证据） | [输出](F-checks-2026-10-01T14-56-48-258Z/3.txt) |
| check / workspace build / migrate:check | 全部 exit 0；build 包含 Tauri cargo check | [验证 manifest](F-checks-2026-10-01T14-56-48-258Z-manifest.json) |
| migration 空库与重复执行 | 0014/0015 在隔离 PG、Compose 均真实执行；未更改旧 checksum | Compose manifest 中 migrations；verify-release 初始化重复执行 |
| 文档结构 | exit 0，3 条已有模板占位 warning | [输出](F-checks-2026-10-01T14-56-48-258Z/7.txt) |
| release docs-gate | exit 1，发布阻塞 | [当时原始输出](F-checks-2026-10-01T14-56-48-258Z/8.txt)；最终文档回写后重跑记录另存 |

截图：[工作台](F-2026-10-01T14-57-48-215Z/workbench.png)、[助手](F-2026-10-01T14-57-48-215Z/assistant.png)。备份正文仅在进程内存中用于恢复，没有落盘秘密。最后一次 run 后已执行专用 Compose down；临时回归数据库和 restore DB 均删除，原 dgos 依赖服务仍保留。

历史失败记录包括：CSRF 代理 Origin、Enable 绑定、取消不生成收费 usage 的断言修正、Runtime 文本审计目标、缺 handler_claimed、settings 输入契约、浏览器 Refresh 表单重绘、API pool 关闭顺序。`F-2026-10-01T14-25-43-537Z` 和 `F-checks-2026-10-01T14-49-56-976Z` 被命令超时中断，仅残留输出/截图，无最终 manifest，不算通过。调试期 manifest 的 commit+dirty 摘要不代替最终源码证据。

后续顺序：先完成 Action 输入持久化/恢复及终态事务、Provider 失败准入与 connection worker；再补 macOS 宿主路由/签名/GUI、Agent runtime；最后接真实 Provider 与生产 Secret、完整灾备和治理失败封闭，再运行 release gate。当前没有任何延期审批被自动填入。

最终文档门禁重跑：`node scripts/docs-gate.mjs --phase release --json` exit 1，22 个阻断，原始结果见 [F-final-docs-gate.json](F-final-docs-gate.json)。矩阵结构问题已消除；剩余为 AC_PENDING、commandRegistry 未配置、正式审批缺失、docs-evidence 清单缺 commit/正式 development/e2e/release 报告。F 本地 manifest 已绑定源码，但尚不满足该发布机器报告协议；不能把本地报告伪装为审批齐备的 release report。文档结构检查为 0 error、3 个既有模板 warning。
