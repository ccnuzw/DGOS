# V1-EXT / V1-PACKAGES r3：独立审查返工

E/G r2已主目录转入并停写，Lead显式授权在主目录本领域修复；不复制旧worktree覆盖。先读 `.herdr/v1-independent-review-r1.md`，静态发现须以定向测试重现并修复。

## E

独占 `src/extensions/`、`apps/extension-runner/`、`apps/api/src/extension-routes.mjs`、`tests/extensions/`；不改Lead的server/worker。修：

- MCP transport必须subject/kind/extension/version或不可变配置绑定，两个主体同ID不能复用/互断。
- API进程connect与worker执行分离，持久connected不等于当前process有transport。提供由统一独立runner消费connect/disconnect/invoke intent或同等真实跨进程机制；API不能假connected，重启可恢复连接而不盲重放工具副作用。双实例定向测试。
- 连接/运行终态与审计event/outbox同事务；audit故障不被误判handler失败。Secret revoke在DB事务内造成回滚不一致需持久撤销intent并可恢复。
- 提供生产可配置来源/runner profile与公共hooks可接线实现，不以空resolver、恒false确认或不可用handler代替交付。实际OS sandbox+网络限制需部署可执行配置与本地验证，保留真实限制。

现有0025–0027已转入不要再改checksum；新SQL用0034-extension-recovery.sql。专属dgos_v1_extensions，测试同时接受Verify专属随机库，不操作integrated。

报告 `.herdr/V1-EXT-r3.md`，给Lead精确组合接口和未完项，停写。

## G

独占 `src/apps/`、`apps/api/src/package-routes.mjs`、本包package测试；不动tests/unit/runtime.test.mjs、Lead入口。修：

- 审核/submit/install/uninstall业务状态+audit/outbox事务，不能仅补独立audit调用；磁盘外部副作用用持久operation收敛。
- restart前枚举部署与prepared操作，恢复pointer/DB/actions一致；在提供launch/resource前完成恢复。真实kill或精确故障注入覆盖pointer写与DB提交两窗。
- 统一包路由与旧记录再验证/拒绝策略；公开launch应返回可受控打开的入口，资源服务经主体安装检查、path/digest验证，不将任意包同源高权限执行。与D/F通过Lead接口协调。
- 已声明dataMigration必须可逆受控执行或明确实现剩余，不能把永久data_migration_required当完整生命周期。健康probe区分静态完整与运行成功，提供可实际启动/验证的工程接口。

现有0028–0030已转入不改checksum；新SQL用0035-package-recovery.sql。专属dgos_v1_packages，不操作integrated。先解决独立审查阻断、再交可运行子片，报告 `.herdr/V1-PACKAGES-r3.md` 停写。

禁止提交推送，测试和证据按实际，所有公共字段变化报Planner/Lead。此包是既有V1规则可靠性，不新增业务范围。
