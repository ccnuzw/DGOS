# V1-PROVIDER r3

H r2转入已完成，主目录原H领域独占继续，禁止覆盖新公共入口。读取 `.herdr/v1-independent-review-r1.md` finding 4及FR014，修account state/delete、config create/update/remove/policy的audit/outbox事务；Secret撤销要持久intent可恢复，避免DB回滚后已撤销。新SQL用0036-provider-operations.sql，已整合0031–0033不改。

B在主目录r3修Task提交事务与引用删除竞态，约定一致锁顺序（account→config→task→attempt→quota 或依据现状协调，先向Lead回报），account/config删除与新Task创建必须不能穿过引用保护；不影响原taskId查询/收敛。给B可注入transaction-aware admission或锁后快照接口，勿改B文件。

FR012/013现有text-profile只有校验模块，按已冻结text subset补可用持久声明/协议目录查询接口，供D协议中心，禁止通用脚本执行/媒体。公共新增机器字段先提交Planner/Lead，Lead掌握server/worker。若未Ready仅报告具体字段阻塞，其他事务修复继续。

专属dgos_v1_provider/15171–15179定向PG故障测试，主目录代码变化已并发，测试资产只H域，B ai-task-api.test不动。报告 `.herdr/V1-PROVIDER-r3.md` 后停写。
