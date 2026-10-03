# V1-GOV r2：受控整合

Worker-C 已明确 V1-GOV r1 停写，报告 `.worktrees/v1-governance/DELIVERY-V1-GOV-r1.md`。Lead 授权同一执行者将该工作树的已测试领域 diff 整合到主工作区；这是原工作树只读主目录限制的显式例外。

先逐个核对目标 `git diff`，只接受目标仍与基线相同的路径；意外改动报 Lead，不覆盖。使用 apply_patch 整合以下精确文件：

- apps/api/src/governance-service.mjs、identity-service.mjs、governance-auth.mjs、governance-routes.mjs
- src/audit/retention.mjs、src/identity/repository.mjs、src/security/rate-limiter.mjs、secret-service.mjs
- migrations/0022-api-key-rotation.sql、0023-governance-policy.sql、0024-admin-session-freshness.sql
- tests/integration/postgres-identity.test.mjs、postgres-retention.test.mjs、postgres-governance-policy.test.mjs
- tests/security/v1-governance-e2e.test.mjs、encrypted-secret-handle.test.mjs、key-delegation.test.mjs

不复制 worktree AGENTS、依赖或 DELIVERY 到根；不修改 server.mjs/worker.mjs、其他领域、Planner/Verify 文件。不提交推送。

主目录运行原不需数据库的定向 8 项测试（不要继承 DGOS_DATABASE_URL）。数据库全量迁移和公共入口由 Lead 串行完成。本修订不延展新领域修改，整合完成后写 `.herdr/V1-GOV-r2.md` 含精确文件、命令结果、与来源摘要一致性并停写。剩余限速/CSRF/retention 分类缺口保留，不宣称整体 FR 完成。
