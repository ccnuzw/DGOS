# V1-TASK r5 交付报告

status: completed; Worker-B 已停写，Compose 15200–15229 已归还 Lead 并交 D 使用
work_package: V1-TASK r5 / DGOS-V1-IMPLEMENT-20261002
worker: Worker-B / Codex
workspace: /Users/apple/Progame/DGOS
baseline_head: 72ab1cb98b064a6e27b9f60a9f8f00881a827a99

## 验收结果

最新可用批次为 `V1-core-2026-10-01T23-47-19-990Z`：[报告](../docs/05-测试与发布/端到端验收/报告/V1-core-2026-10-01T23-47-19-990Z.md)、[manifest](../docs/05-测试与发布/端到端验收/报告/V1-core-2026-10-01T23-47-19-990Z-manifest.json)。在独立 Compose fixture、PostgreSQL `dgos_v1_integrated`、API/Web 与两 Worker 下运行 `DGOS_CORE_CREDENTIAL=<redacted> node scripts/v1-core-compose.mjs`，退出码 0，11/11 通过，0 跳过，`source_drift=false`。Manifest 的 `commit=null` 表示脏工作树，`head_commit` 与 `working_tree_sha256` 单独标识运行源码；不能将 HEAD 称作冻结验收提交。

11 项覆盖独立环境/schema、管理员登录、Provider probe 后带 `connectionTestId` 显式 ready、config validate/catalog/model policy、Quota preflight、Task replay/SSE/Artifact/唯一结算、取消、两 Worker 运行下的竞争、SIGKILL 后 `upstream_outcome_unknown` 且单次上游调用和 `needs_review`、硬额度拒绝无新 Task、Action 跨 Worker 设置写入与版本冲突/deny。审计和 outbox、终态事件、用量及 Artifact 的逐 Task 计数见 manifest。

## 授权迁移与命令

- `pwd`：`/Users/apple/Progame/DGOS`；`git rev-parse --short HEAD`：`72ab1cb`。
- 使用 `discoverMigrations()` 仅筛 `0039-provider-protocol-confirmations`，核文件 SHA `07259111a3c3808c5e6070b0189bd0bf74dcd040623b137590b17bd452bd8b12`，仅向 `postgresql://dgos:dgos@127.0.0.1:15200/dgos_v1_integrated` 执行 `buildMigrationSql([item])`；回读库内 checksum 一致，退出 0。
- 使用同样的单条筛选和校验，仅向该库应用 `0040-provider-profile-bindings`，SHA `761b4b96d3a7c509198dbdd1cd1d958b92a28f6b8f4cee449ebf99b080050343`；回读 checksum 与 `capability_protocol_id/version` 两列一致，退出 0。
- 在上述迁移后，执行 `docker compose -p dgos-v1-integration -f docker-compose.integration.yml restart api worker`；随后完成最新 11/11 批次。首轮 Web 因并行构建时缺 `dist/index.html` 退出，文件存在后仅对该 Compose 执行 `start web`。先前连接失败、源码漂移和 Provider Config 500 批次均作为追加报告保留，未覆盖。
- 验收结束后按 Lead 后续单独授权，核 SHA `9ab4865298fab5f7be79f0906bf82ed176bf844a96e03b42daf8e5d579a09090`，仅向同一独立库应用 `0041-app-data-migration-package-digests`；回读库内 checksum 与 `source_package_digest/target_package_digest` 两列一致，退出 0。**0041 在 11/11 通过批次之后应用，未重启或重跑；不把该批次表述为 0041 后验收。**
- `node --check scripts/v1-core-compose.mjs` 与 `git diff --check -- scripts/v1-core-compose.mjs`：退出 0。

## 边界与交接

本轮仅修改 `scripts/v1-core-compose.mjs`、追加 `V1-core-*` 成对证据及本报告；产品代码只读。未应用 H 后续 0043，未执行全目录迁移、原 `dgos` 库命令、真实外部 Provider/TLS、提交或推送。两 Worker 竞争用例证明两实例在运行且任务各只有一次终态/结算，不证明两实例各自实际领取过任务。主目录仍有其他 Agent 写入；本批次仅证明 manifest 所绑定的脏树快照在运行窗口无漂移，最终冻结候选由 Lead/Verify 单独验收。

files_changed: [`scripts/v1-core-compose.mjs`, 追加 `docs/05-测试与发布/端到端验收/报告/V1-core-*` 成对证据, `.herdr/V1-TASK-r5.md`]
tests_added: [`scripts/v1-core-compose.mjs` 真实 HTTP/数据库验收脚本]
commands_run: [0039/0040/0041 单条 SHA 校验与独立库迁移通过, 定向 Compose restart/start 通过, 核心 11/11 退出 0, 脚本语法与 diff 检查通过]
implementation_facts: [0039 与 Provider 0040 已进入 11/11 批次的 schema, 0041 在该批次之后应用, 核心 Task/Quota/Action 不变量见 manifest]
contract_changes_proposed: []
open_risks: [0041 后未重跑, 真实外部 Provider/TLS 未验证, 未冻结提交, Worker 领取分布未单独证明]
docs_to_update: [Lead/Planner 在最终冻结验收后回写 V1 实现状态和追踪证据]
unfinished_items: []
lead_or_planner_decisions: [最终冻结候选与 Verify 门禁范围由 Lead 决定]
