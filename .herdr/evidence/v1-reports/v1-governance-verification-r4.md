# V1-GOV r4 公共入口与留存回归

C r3已停写，Lead已接loginBackoff与retention confirmation，修Fastify onReady问题，公开candidate/governance3/3通过。r4只授权主目录 `tests/integration/identity-api.test.mjs`、`retention-api.test.mjs`、`postgres-retention.test.mjs`、`tests/security/v1-governance-e2e.test.mjs`及新增专项测试，**产品只读**。

将旧固定五次401断言适配已冻结主体/来源递增退避（首错401、阻断429，受控clock后可重试；不得全放宽任何错误码）。留存必须先服务器preview与确认，再run，旧直接repo.runJob缺确认不得恢复宽松语义。验证过期/轮换Key、session renewal不刷新authFresh、撤销主体范围、audit故障无副作用。现有governance-wiring保持Lead独占不动。

先内存公开API测试，再专属dgos_v1_governance顺序PG；不得用integrated/15200组（B独占Compose验收）。缺主目录新SQL不要盲迁移，沿已有专属schema本包测试即可。报告.herdr/V1-GOV-r4.md列真实通过/失败与源码变化时间点，产品缺陷报Lead，不静默改实现。完成停写，不提交推送。
