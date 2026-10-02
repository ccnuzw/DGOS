# V1-GOV r3：剩余领域可靠性

r2已主目录交接停写。Lead授权 Worker-C 在主目录继续以下精确领域路径：`src/identity/repository.mjs`、`apps/api/src/identity-service.mjs`、`src/security/rate-limiter.mjs`、`src/audit/retention.mjs`、`apps/api/src/governance-service.mjs`及本包新增专项测试。Lead仍独占server/worker，现有公开路由由Lead接线。

主目录已经有其他域整合，不用旧worktree整域覆盖。Lead在r2后修了InMemory findPrincipalByHint支持principalId与credentialRef，与PG一致，保留该改动。读新增 `tests/integration/governance-wiring.test.mjs` 只读；Lead实跑4/4。

按FR010/014现有规则完成：

1. 登录创建session和audit同事务；审计失败不留下可用session；内存同样先audit后发布状态。bootstrap失败Secret孤儿受控撤销但不误撤销其他请求。
2. 提供按主体与来源组合的共享失败限速/递增退避类，Redis原子更新、无秘密/原始来源暴露，保持既有createRateLimiter接口可兼容；给Lead明确构造和调用模式。单元真实时间控制、DB3专属prefix跨实例测试，不碰他人redis。
3. retention预览必须服务器生成并绑定digest，执行不能缺确认或跨策略版本；当前start允许缺digest创建计划可保留计划语义，但run破坏性清理必须确认。给Lead参数契约，别用直接手填digest。按已有保留规则补可在已存在实体安全执行的分类，引用保护明确。不能删除Task/Artifact作自动清理，不能增加法务保留。

独占专属 dgos_v1_governance/Redis DB3/15121–15129；可从主目录应用新migration到该专属测试库（历史checksum若有差异先停核对）。不操作integrated库，不改他包SQL。公共机器schema需要变化先报Planner/Lead。不自行扩大业务。

报告 `.herdr/V1-GOV-r3.md` 真实测试、余项和接线，完成后停写。
