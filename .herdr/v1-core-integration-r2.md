# V1-ACTIONS / V1-TASK r2 受控整合

A、B r1 已交付并明确停写。Lead 显式授权原执行者在主目录仅整合下列领域路径，原 worktree 主目录只读限制在本修订这些路径上例外。来源仍各自已停止写入的 r1 worktree；主目录 cwd `/Users/apple/Progame/DGOS`。

共同规则：核对目标基线与未提交修改，不覆盖意外变更；apply_patch 转入，核对来源 SHA；不复制 AGENTS/依赖/DELIVERY 到根，不提交推送，不操作 DB。server/worker/SDK 等公共入口由 Lead 单独接线。写 `.herdr/V1-ACTIONS-r2.md` 或 `.herdr/V1-TASK-r2.md` 后停写。

## A

来源 `.worktrees/v1-actions`。允许 `src/actions/{repository,service,routes,system-actions,worker}.mjs`，`migrations/0016-action-input-recovery.sql`、`0017-action-recovery-guard.sql`、`0018-action-cancel-guard.sql`、`tests/integration/action-recovery.test.mjs`。**不要转入 tests/unit/runtime.test.mjs**（与G同文件重叠），报告它的精确 Action 断言补丁由Lead合并。

## B

来源 `.worktrees/v1-task`。允许 `src/ai-task/{repository,service}.mjs`、`src/quota/{repository,service}.mjs`、`migrations/0019-ai-task-dispatch-fence.sql`、`tests/integration/ai-task-api.test.mjs`、`tests/integration/postgres-ai-task-atomic.test.mjs`。H 同一测试的 egress fixture 改动由Lead随后做精确补丁，不覆盖B拒绝无Task断言。

本修订只整合和语法/差异检查，跨域依赖同时变化，领域/数据库回归由Lead在全部入口及迁移就位后统一执行。明确报告未执行测试与r1先前真实结果，不因语法通过宣称整合验收完成。
