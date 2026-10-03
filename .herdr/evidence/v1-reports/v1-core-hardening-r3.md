# V1-ACTIONS / V1-TASK r3 主目录剩余可靠性

A/B r2已主目录交接并停写。r3在主目录精确路径继续，不从旧worktree整域覆盖；不碰server/worker/其他领域/Planner文件。先读本轮主目录依赖和Verify静态报告。

## A / V1-ACTIONS r3

授权 `src/system/service.mjs`、`src/system/repository.mjs`、`src/actions/*.mjs`及新增 `tests/integration/system-cross-process.test.mjs`、本Action专项测试。Lead将创建公共 `src/actions/runtime.mjs`，该文件Lead独占。

真实跨进程问题：SystemService只启动load一次，API/两个Worker各缓存settingsVersion；Worker更新后API snapshot永远旧值，另一Worker旧baseVersion永远冲突。snapshot/context/patch需要读当前持久版本，数据库条件更新保留并发语义；设置写入和审计同事务/可恢复outbox，audit失败无无审计成功，内存不提前发布状态。补两个service实例相互更新、旧版本冲突、audit故障测试。检查ActionWorker轮询无界并发与停机、已冻结结果/输入投影，勿扩大能力。专属dgos_v1_actions顺序PG测试，原库禁止。

## B / V1-TASK r3

授权 `src/ai-task/*.mjs`、`src/quota/*.mjs`及本包测试。Lead会改ai-task-api fixture egress，因此暂不编辑该test，新增测试独立命名。

r1报告明确Task submit/terminal audit在业务commit之后，audit失败留无审计成功。将必需Task审计/Outbox纳入同PG transaction或可靠同事务intent，内存路径先审计再发布副作用；审计失败不得留下可dispatch task或丢失终态证据。检查Provider账号删除引用竞态：Task创建与account/config准入事实需要锁/原子重检，和H将提供的删除/状态事务一致。精确接口先回Lead/H，不改H文件。保留不确定dispatch禁止重发和needs_review语义。专属dgos_v1_task顺序PG故障注入/并发验证。

完成报告 `.herdr/V1-ACTIONS-r3.md` / `.herdr/V1-TASK-r3.md`，真实命令结果与限制，停写。不提交推送。
