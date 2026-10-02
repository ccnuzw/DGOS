# DGOS Herdr 协作运行区

本目录保存 DGOS Agent 团队的角色协议和轻量调度记录。它不是产品需求、接口、数据或实现状态的权威来源；业务事实仍以 `docs/`、代码、测试和证据报告为准。

## 角色

- `lead`：用户唯一入口，负责全局调度、授权、整合和最终回写。
- `planner`：使用 `spec-docs` 生成上下文、任务包和文档变更。
- `worker-a` / `worker-b` / `worker-c`：按任务包执行代码、测试、迁移或文档工作。
- `verify`：执行整合、测试、文档检查和证据检查。

## 使用约束

1. 任何工作先绑定版本、功能或交付切片；无法绑定时先做规格/盘点任务。
2. Worker 不在没有 Lead 任务包和工作区边界时修改代码。
3. 代码工作优先使用独立 Git worktree；共享主工作区只用于明确无写入冲突的文档或只读任务。
4. Agent 的聊天内容不是交接依据；交接依据是任务包、报告、代码状态和文档证据。
5. 运行时调度记录只记录任务流转，不复制业务规则或功能实现状态。

规范正文：`docs/01-项目概览/Agent团队与SDD协作规范.md`

## 固定客户端与显示名称

以 `team.json` 为准：Lead、Planner 为 OpenCode；Worker-A、Worker-B、Worker-C、Verify 为 Codex。名称不带数字前缀。Herdr 自身显示的 tab 序号与角色名无关。

## 启动与重新接入

在 Herdr 内，为目标角色准备本项目的空 shell pane，然后运行：

```sh
node .herdr/start-agent.mjs worker-a <实际空pane-ID>
node .herdr/start-agent.mjs worker-b <实际空pane-ID>
node .herdr/start-agent.mjs worker-c <实际空pane-ID>
node .herdr/start-agent.mjs verify <实际空pane-ID>
node .herdr/start-agent.mjs planner <实际空pane-ID>
```

启动器按 `team.json` 选客户端，拒绝覆盖已有 Agent 或当前 Lead。Codex 通过启动指令注入角色；OpenCode 启动后由 Lead 明确派发角色读取指令。启动成功只代表交互入口可用，仍须执行读取角色文件、命令验证和 READY 回执。不要将旧 pane ID 当作永久地址，恢复前查询 `herdr pane list --workspace "$HERDR_WORKSPACE_ID"`。

Codex 0.159.3 在当前 `gpt-6-sol` 配置下，默认 `code_mode_only` 未向本次会话提供可调用的原生命令工具。`prepare-codex-catalog.mjs` 从本机安装版本生成忽略跟踪的 `state/codex-models.json`，仅将工具呈现方式切为 `direct`；保留模型 ID、原有指令、审批策略及其他模型元数据。启动器仅通过本次进程的 `model_catalog_json` 引用该文件，并关闭本次进程的 Computer Use。供应商、模型、全局配置和 TLS 校验不变。Codex 升级后可重新生成并复核。

### Herdr 重启后的 Codex 工具恢复

Herdr 0.9.3 内置恢复会执行 `codex resume <session-id>`，不会保留首次启动的附加参数。2026-10-02 已确认，这会丢失 `model_catalog_json` 和 `--disable computer_use`，导致本项目模型恢复为 `code_mode_only`、只剩 Computer Use 可用。会话上下文仍在，问题是启动配置未恢复。

实际对照验证：仅用项目 `.codex/config.toml` 时，`codex debug` 显示 direct，但裸 `resume` 的实际会话仍没有 exec。因此不依赖该配置。当前 `~/.zshrc` 在 Herdr 内加载 `.herdr/codex-resume.zsh`；此适配器只对 DGOS 目录内的 `codex resume` 补入 direct catalog、关闭 Computer Use，并保留原 `workspace-write` / `never` 策略。其他项目和非 Herdr 终端按原命令执行。路径是当前机器绝对路径；迁移工作区时须同步更新，Codex 升级后须重新生成 catalog。

受影响会话恢复流程：

1. 核对真实回执和进程，确认 Agent 已停止业务写入；保存角色、pane ID 和原 session UUID。
2. 正常退出该 Codex，核实 pane 已回到空闲 shell。当前收敛工作包在主目录执行，应把该 shell 的目录也切到 `/Users/apple/Progame/DGOS`；独立 worktree 任务须另行明确目录及项目配置，不能假设主目录配置会跨 worktree 继承。
3. 运行 `node .herdr/start-agent.mjs <role> <empty-pane-id> <original-session-uuid>`。启动器保留会话、注入完整参数并显式 `--cd` 到主目录。
4. 如遇临时 `This conversation is open in another app`，先确认原 TUI 已退出，再重试；不 fork，不启动第二份同 session。
5. 必须让 Agent 实际调用原生命令工具执行 `pwd`、`git rev-parse --show-toplevel` 并读取角色文件，核验命令和退出码后才恢复业务任务。`agent start` 返回 idle 本身不证明 session 已解锁或工具可用。

当前 Worker-A 至 Worker-I 和 Verify 的会话都按原 session 恢复到主目录；旧 worktree 内容保留。操作记录见 `HERDR-TOOLS-RECOVERY-r1.md`。

当前 Codex 使用 workspace-write / never：常规工作区操作无需人工审批，超出权限时回报 Lead，不自动提升权限。派发独立 worktree 任务时应在对应工作区启动会话。

## 派发与收敛

Lead 先登记 `delivery-board.yaml` 的工作包、修订号、工作区、写入边界及下一步，再通过 `herdr agent prompt <内部名> <任务文本>` 派发。Worker 返回工作包及修订号，Lead 用 `herdr agent read <内部名> --source visible` 检查真实回复；长历史需等会话空闲后使用 `recent-unwrapped`。现有 Codex hook 可能在工具间隙短暂报告 done，必须以最终回执和真实结果验收。

当前采用 Lead 主动协调方式；未安装后台自动重派或无人值守守护进程。没有明确工作包时所有协作 Agent 待命。
