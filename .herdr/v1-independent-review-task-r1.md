# V1-VERIFY-REVIEW r1

交付 DGOS-V1-IMPLEMENT-20261002。Verify 保持原客户端、会话、主目录 cwd。

在等待可运行整合快照期间，只读审查 `.worktrees/v1-packages`、`v1-extensions`、`v1-governance`、`v1-provider` 的新实现，对照主目录当前机器契约和 ADR。各 Worker 仍写入，明确观察时点，发现问题提供具体文件、分支与可复现条件，不把审查当测试通过。

优先公开路由主体/能力/资源归属、入队与审计故障边界、跨进程锁与崩溃恢复、包目录单一生命周期、扩展真实执行绑定与隔离、Provider 新任务准入。Lead 已反馈包跨进程锁/审计、扩展 body 覆盖路由 kind/id、MCP 持久连接、Key 跨主体撤销与过期问题；核验实际修复或残余，不重复泛泛报告。

唯一可写 `.herdr/v1-independent-review-r1.md`。不修改产品、Worker 测试或其他文档，不使用它们正在跑的数据库，不运行全量测试，不产生付费调用。回执列阻断整合缺陷、证据限制、已覆盖无需重复项及后续定向命令，完成后停写。后续全版验收另由 Lead 绑定源码与资源。
