# V1-QUOTA-REVIEW r5 / Worker-C

C r4已停写，B r3领域停写且r4只写Compose验收。Lead将主目录 `src/quota/` 与 `tests/unit-quota.test.mjs`、`tests/integration/quota-api.test.mjs`、`tests/integration/postgres-quota.test.mjs` 及新增quota专项测试移交C。B不得同时修改该域。server/worker Lead独占。

Lead当前发现quota service reserveQuota最后分支引用未定义reservation；clock注入来自server是number但windowStart调用getTime；公开settle未校验actor拥有reservation，仅比task/attempt，query跨scope也需验证。严格数值检查amount非负/有限/安全范围、hardLimit/window/effectiveAt；策略更新与预留在同事务锁内重检，不能只早期policy快照；用量统计包含settled与needs_review冻结，不自造费用。

按FR015/ADR补边界定向单元+PG测试，明确Quota scope服务校验接口给Lead。专属dgos_v1_governance暂分配C此包（允许只建/迁移quota所需稳定SQL，不删其他域），不碰B integrated/其他DB。无支付退款。审计失败回滚和缺审计failclosed。

报告 `.herdr/V1-QUOTA-r5.md`，真实测试/余项，停写，不提交推送。
