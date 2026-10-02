# V1-OPS r2 受控整合交接

- status: source_transferred_syntax_verified; awaiting Lead integration
- work_package: `V1-OPS` / `r2`
- source: `/Users/apple/Progame/DGOS/.worktrees/v1-ops`
- target: `/Users/apple/Progame/DGOS`
- date: 2026-10-02

## files_changed

按 `.herdr/v1-platform-integration-r2.md` 的 I 列表用 `apply_patch` 新增 13 个文件：

- `src/security/durable-secret-service.mjs`, `src/security/runtime-config.mjs`
- `scripts/v1-ops-api.mjs`, `scripts/v1-ops-worker.mjs`, `scripts/v1-ops-backup.mjs`, `scripts/v1-ops-restore.mjs`, `scripts/v1-ops-rotate.mjs`, `scripts/v1-ops-clear-stale-locks.mjs`
- `deployment/Caddyfile`, `deployment/Dockerfile`, `deployment/README.md`, `docker-compose.production.yml`
- `tests/security/v1-ops-durable-secret.test.mjs`

未转入 worktree `AGENTS.md`、`DELIVERY-V1-OPS-r1.md`、依赖目录、密钥、备份或生成制品。未覆盖主目录已有文件；转入前逐一确认上述 13 个目标路径不存在。主目录当时有大量其他路径未提交修改，均未改动。未提交、推送或更改公共 server/worker。

## tests_added

- 本轮只转入 r1 的 `tests/security/v1-ops-durable-secret.test.mjs`，没有新增测试内容；依 r2 指令未运行领域测试。

## commands_run

| 命令/检查 | 退出码 | 结果 |
| --- | ---: | --- |
| `pwd && git status --short`（worktree）及 `git -C /Users/apple/Progame/DGOS status --short` | 0 | 确认来源和主目录状态；主目录 I 目标文件均不存在 |
| `rg` 扫描待转文件的私钥、令牌、本机路径模式 | 0 | 无秘密/本机绝对路径命中；仅 `database.password` 代码字段名命中。首次扫描参数误置退出 2，随即更正后完成扫描 |
| `node` 生成 patch 流并交给 `apply_patch` | 0 | 只新增 I 授权的 13 个文件 |
| Node `crypto` 对来源/目标逐文件 SHA-256 比较 | 0 | 13/13 `MATCH`，无内容差异 |
| `node --check` 对 9 个转入 `.mjs` 模块逐一检查 | 0 | `NODE_CHECK_OK 9 modules` |
| `git diff --check`、目标路径 `git status --short`、`git diff --no-index` 抽查 | 0 | 无空白错误；13 个目标为新增未跟踪文件；抽查无内容差异 |

## implementation_facts

- r1 的 Secret 接口、生产包装层、HTTPS Compose、恢复和轮换脚本原样转入，SHA-256 全部一致。摘要清单可用 `shasum -a 256` 对上述 13 文件复核；本次逐文件 Node SHA 比较结果为全匹配。
- API wrapper 使用 `createRequire(new URL('../apps/api/package.json', import.meta.url))` 解析 API 域 `redis`/`pg` 依赖，不更改根依赖。
- `buildServer` 和 `startWorkerProcess` 公共入口保持原状；由 Lead 接入后续 Action、Provider test、extension worker 循环。

## contract_changes_proposed

- 无新增 r2 契约。延续 r1 内部 `rootKeyHandle.getCurrentKey/getKey` 接口，供 F/外部密钥句柄适配。

## open_risks

- 按 r2 限制，本轮未运行测试、Compose、镜像、数据库或生产部署；本报告仅证明转入一致性与语法。
- 公共 API/Worker 接线、持久访问审计 requestId、Web dist 生产服务和正式 TLS/KMS/恢复门禁证据仍由 Lead 整合验证。不得把本地加密文件 backend 写为外部 KMS 验收。

## docs_to_update

- Lead 整合后在发布/恢复文档记录最终根密钥来源、访问审计、Web dist、备份协调和真实演练证据。

## unfinished_items

- Lead 绑定公共入口并安排领域/集成实跑；本包 r2 已停止写入。

## lead_planner_decisions_needed

- 无新增业务决策。生产根密钥提供方和持久访问审计接线按 r1 交接继续收敛。
