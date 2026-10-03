# V1-TASK-REGRESSION r20 — Worker-A 回执

- status: 静态修复完成；等待 Lead 在真实 PostgreSQL 环境复验。
- work_package: `V1-TASK-REGRESSION`，revision `20`，slice `V1-ai-task`，FR005/007/015。
- files_changed: `tests/integration/postgres-ai-task.test.mjs`、`tests/integration/postgres-ai-task-atomic.test.mjs`、`test-support/ai-task-regression.mjs`；产品源码未改。
- tests_added: 无新增测试文件；既有两个 PG 测试保留业务断言并更新隔离与 fixture。
- contract_changes_proposed: []
- docs_to_update: []

## 实现事实

- 两个测试各自从 `dgos_v1_task` 或严格 `dgos_v1_verify_<32hex>` 父库建立随机 Verify 子库，校验实际连接库名；只在成功创建后删除该子库，互不领取遗留队列。父库不执行清理。
- helper 仅应用版本不超过 0051 的冻结 47 项迁移，核对 0043–0051 checksum，拒绝未知冻结区迁移，并在子库核对实际迁移记录。
- 队列测试保留“审计提交前不能 claim、提交后只能 claim 当前任务”的原断言；atomic 测试保留 quota 拒绝、审计失败回滚、竞态、唯一终态/usage、dispatch fence 与未知上游结果不重发断言。
- atomic admission fixture 现在提供当前快照所需的 config/account 版本、model sourceDigest、policyVersion、catalogVersion、adapter descriptor 及 `normalizeTextExecution` 结果。

## 命令与结果

- `pwd`、`git rev-parse --show-toplevel`：均为 `/Users/apple/Progame/DGOS`；原生命令可用，角色文件为 Worker。
- `node --check test-support/ai-task-regression.mjs`、`node --check tests/integration/postgres-ai-task.test.mjs`、`node --check tests/integration/postgres-ai-task-atomic.test.mjs`：全部 exit 0。
- `node --input-type=module -e "...discoverMigrations..."`：47 项，末项 `0051-proxy-provisioning`，0047 checksum `22b6e9e886943f2b660de4d54989e0587c58cb67e373fbd45b7140849f6f15f6`。
- `node --input-type=module -e "...guard and profile normalization..."`：`guard and profile normalization: ok`。
- `git diff --check -- tests/integration/postgres-ai-task.test.mjs tests/integration/postgres-ai-task-atomic.test.mjs`：exit 0。
- `shasum -a 256 tests/integration/postgres-ai-task.test.mjs tests/integration/postgres-ai-task-atomic.test.mjs test-support/ai-task-regression.mjs`：分别为 `5531a98c30dd7c12ca387cef86f39acf581b1df281f71c53cd52bb98be97ebed`、`acbcde16af3620d398471b5f1e6963827658f3478c807957f8d9722e02af958a`、`2b54b7c46495ea6d66ac43d304f7f2ef5d95ddf418d784011002dc36bf118418`。

## 限制与交接

- open_risks: 沙箱连接 5432 已知 EPERM；未执行真实 PG 测试，修复效果、子库权限与完整回归组仍待实际运行。当前静态结果不可视为 PG 通过。
- unfinished: Lead 在可访问 PG 的环境，以专用或严格 Verify 父库作为 `DGOS_DATABASE_URL`，分别运行 `node --test --test-reporter=tap tests/integration/postgres-ai-task.test.mjs`、`node --test --test-reporter=tap tests/integration/postgres-ai-task-atomic.test.mjs`，随后重放 r19 PG/guarded 组并记录 zero-skip 实际结果。
- lead_or_planner_decisions: []
- 未提交、未推送、未清理其他人的修改。
