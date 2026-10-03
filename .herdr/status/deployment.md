# DGOS 团队部署记录

日期：2026-10-03（运行态复核）。工作区 `/Users/apple/Progame/DGOS`，基线 `72ab1cb`，包含未提交的团队配置。记录属于团队部署验证，不构成 DGOS 产品验收证据。

## 当前布局

| 角色标签 | 内部名 | 客户端 | pane | tab |
| --- | --- | --- | --- | --- |
| Lead | lead | OpenCode | wJ:p1 | wJ:t1 |
| Planner | planner | OpenCode | wJ:pG | wJ:tG |
| Worker-A | worker-a | Codex | wJ:pM | wJ:tM |
| Worker-B | worker-b | Codex | wJ:pN | wJ:tN |
| Worker-C | worker-c | Codex | wJ:pP | wJ:tP |
| Worker-D · Native与运行时 | worker-d | Codex | wJ:p17 | wJ:t18 |
| Worker-E · 集成与发布 | worker-e | Codex | wJ:p18 | wJ:t18 |
| Verify | verify | Codex | wJ:pQ | wJ:tQ |

工作区 ID 为 `wJ`。这些 ID 只记录本轮部署，重新创建时需实时查询。当前 Lead 会话保留，焦点回到 Lead。共 7 个 Tab；D/E 在 `wJ:t18` 横向分栏，Tab 标签为 `Worker-D/E · Native与集成发布`，单个 pane 仍使用角色标签，不加数字前缀。

## 验证

- `DEPLOY-P-r3`：Planner 实际读取 AGENTS、team.json、角色和看板，返回 READY 并确认指定客户端映射。
- `DEPLOY-A-r3`、`DEPLOY-B-r3`、`DEPLOY-C-r3`：三个 Codex 分别读取角色与 SDD 入口；原生 exec 命令得到工作目录和 `72ab1cb`，均返回 READY，并确认无任务待命和独立 worktree 约束。
- `DEPLOY-V-r3`：Codex Verify 独立运行 `node scripts/check-docs.mjs`（0 errors，3 个既有模板警告，退出码 0）、`git diff --check`、两个启动脚本的 `node --check`，均退出 0；额外执行客户端映射断言通过。

Codex 运行配置保留原有 `nextcc` / `gpt-6-sol` / high。OpenCode 会话保留既有模型；未重设全局供应商或模型。

## 故障与修复边界

前一轮将 Worker/Verify 替换为 OpenCode 不符合用户要求，相关错误客户端会话已移除。本轮保留指定客户端，修复 Codex 工具可见性：

1. 默认启动转向 Computer Use，未完成文件读取。
2. 仅禁用 Computer Use 后，模型报告没有 exec 工具；启用 code_mode 的诊断仍失败。
3. 保留当前安装版模型元数据，仅将 `tool_mode` 从 `code_mode_only` 切为 `direct`，通过本次启动的 `model_catalog_json` 引用。先用 `codex exec --ephemeral` 验证，再启动四个交互会话并分别验证成功。

生成目录不含供应商认证信息且被 Git 忽略；全局配置、TLS 和审批策略未因该兼容处理而修改。

## 运行限制

- 已验证的是角色加载、命令/文件读取和 Lead 主动派发回执；不是产品开发、合并或发布验收。
- 当前全员在主工作区待命，正式并行代码包另分配 worktree，不在共享主目录同时写业务代码。
- Herdr idle/done 可能在 Codex 工具间隙出现；必须读取最终报告，不能据状态自动验收或重派。
- 无后台自动接续守护进程。Lead 从 delivery-board 恢复任务，并检查实际 Agent、工作区和报告后继续。

## 开工复核 TEAM-PREFLIGHT-r1（2026-10-02）

本轮先登记看板，再通过 Herdr 对五个协作角色分别发送只读复核指令并读取最终回执。实际客户端、tab 和 pane 标签与 team.json 一致；Lead 为正在执行本次复核的当前会话。

| 角色 | 本轮实际核对 | 最终回执 | 遗留业务任务 / 阻塞 |
| --- | --- | --- | --- |
| Planner | team.json、角色、看板与指定 spec-docs/SKILL.md 可读取 | PREFLIGHT-r1 Planner READY | 无 / 无 |
| Worker-A | 原生 exec 执行 pwd、读取团队与角色文件 | PREFLIGHT-r1 Worker-A READY | 无 / 无 |
| Worker-B | 原生 exec 执行 pwd、读取团队与角色文件 | PREFLIGHT-r1 Worker-B READY | 无 / 无 |
| Worker-C | 原生 exec 执行 pwd、读取团队与角色文件 | PREFLIGHT-r1 Worker-C READY | 无 / 无 |
| Verify | 客户端映射、角色规则、README 和看板一致 | PREFLIGHT-r1 Verify READY | 无 / 无 |

前一错误客户端会话的 SETUP-CLI-r1 已取消，目标工具及测试文件不存在，当前 Worker-A 确认不继承执行。产品任务尚未派发；正式任务按范围准备 task-pack 和工作区即可启动。已有结构与语法检查结果沿用上一轮，本轮不声称重跑产品测试或验证无人值守能力。

结论：当前团队可进入 Lead 主动协调的 SDD 工作流程，无已知开工阻塞。复核任务已关闭，active_delivery 归零。配置仍为本地未提交改动，新 worktree 必须携带对应团队入口和任务包，不能假设未提交配置已经存在于新检出中。
