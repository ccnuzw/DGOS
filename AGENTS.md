# DGOS 团队入口

本项目采用 spec-docs 驱动的 SDD。先读 `docs/README.md` 和 `docs/03-功能规格/功能开发流程.md`，再按功能/切片读取权威规格、契约、实现状态与测试。文档规划、写作、核查与回写使用已安装的 spec-docs skill。

## Herdr 角色

用户指定的客户端映射以 `.herdr/team.json` 为准：Lead、Planner 使用 OpenCode；Worker-A/B/C、Verify 使用 Codex。不得自行换客户端或模型。显示名称不加数字前缀；Herdr 内部 agent 名使用小写 `lead`、`planner`、`worker-a/b/c`、`verify`。

开始会话时先确认 Lead 派发的角色；不明确时只做只读盘点，不能自认 Lead。读取 `.herdr/roles/<角色>.md`（Worker 共用 worker.md）、`.herdr/README.md` 与协作规范。当前用户直接交谈的主会话担任 Lead，其他会话只接受明确工作包。

## 执行与恢复

- 从 `.herdr/delivery-board.yaml` 恢复任务流转，文档/代码/真实证据才是业务事实依据。
- 独立 worktree 是并行代码任务的默认方式；共享目录必须限定不重叠写入路径。没有任务包先待命。
- Planner 主写规格，Worker 实现及测试，Verify 独立核验证据，Lead 统一收敛。只写文档也可独立交付。
- 原有决策及用户授权内的普通技术选择自行推进；仅无法推导的关键业务变更提交 Lead/用户。不要反复询问已授权事项。
- 不擅自提交、推送、清理其他人的修改。超时先核对执行者、工作区、回执，不能盲目重派。
- Herdr 的 idle/done 不是验收通过。结果需包含工作包 ID、修订号、命令结果和限制。

完整协议：`docs/01-项目概览/Agent团队与SDD协作规范.md`。
