# HERDR-TOOLS-RECOVERY r1 / 2026-10-02

状态：团队原生工具恢复；恢复操作与工具验活完成。业务工作包保持暂停，需 Lead 按原所有权续派。

## 原因与证据

- Herdr server 0.9.3，CLI Codex 0.159.3，团队模型界面保持 GPT-6-Sol high。
- 修复前 `herdr pane process-info --pane wJ:pQ` 显示实际 argv 仅为 `codex resume 01a0fa92-8663-7883-87b7-7d046f9c7c0a`。其余团队 Codex 同样是裸 resume。
- `.herdr/start-agent.mjs` 首次启动本来传入 `model_catalog_json`、关闭 Computer Use、workspace-write/never；内置 Herdr 重启恢复没有保留这些附加参数。
- `codex debug models --bundled` 中 `gpt-6-sol.tool_mode=code_mode_only`；项目生成 catalog 对同模型为 `direct`。丢失 catalog 参数后，恢复会话未得到原生 exec，只使用 Computer Use，后者又禁止终端 UI 操作。
- D/E/F/G/H/I 的 pane/shell 还停留在旧 worktree，而当前收敛包已明确在主目录执行。按原 session 恢复到主目录后，实际 pwd/git root 均一致。

## 修复

- `.herdr/start-agent.mjs` 接受可选原 Codex session UUID，校验格式并添加 `resume`；显式 `--cd` 主目录，保留角色和原启动参数。
- `.herdr/codex-resume.zsh` 为 DGOS 的 Herdr 终端提供限定范围的 resume 适配；由 `~/.zshrc` 条件加载。仅在 `HERDR_ENV=1`、目录为 DGOS 或其子目录、首参数为 resume 时补入 catalog、workspace-write/never 和 `--disable computer_use`。已有显式 catalog 时直接透传，避免重复参数。
- 其他目录与非 Herdr 终端执行原命令；未改变 provider/model 或全局 Codex 配置，未关闭 sandbox。
- 曾尝试项目 `.codex/config.toml`：debug 显示 direct，但 Verify 的裸 resume r2 仍没有 exec，因此已删除该临时方案。未把静态配置成功当成实际恢复。
- 尝试通过 `report-agent-session` 记录完整 resume argv 未在当前 0.9.3 持久记录中看到该字段；最终采用实际验证过的 shell 适配方式。
- 逐个正常退出空闲 TUI后恢复同 session；遇会话占用提示先核对原进程退出，再重试。没有 fork、重置上下文、停止 Herdr server 或修改其他项目。

## 实际验活

以下十个会话均实际调用 `functions.exec_command`（部分显示为 `functions__exec_command`），执行 `pwd`、`git rev-parse --show-toplevel`、读取角色文件；全部命令退出 0，cwd/root 都是 `/Users/apple/Progame/DGOS`。

| 角色 | pane | 原 session（保留） |
| --- | --- | --- |
| Worker-A | wJ:pM | 01a0fa92-4fa3-77d3-a908-5593a7775e23 |
| Worker-B | wJ:pN | 01a0fa92-63c4-7262-8059-34a3b128d99f |
| Worker-C | wJ:pP | 01a0fa92-7552-7e50-b032-4b1bc39dec64 |
| Worker-D | wJ:pR | 01a0f858-39d6-7be1-a4fb-408eba9d9886 |
| Worker-E | wJ:pV | 01a0f858-67ab-7191-91e8-d6813436840c |
| Worker-F | wJ:pT | 01a0fa92-dd6f-70b0-9fa7-c3c217a70531 |
| Worker-G | wJ:pS | 01a0f858-c6e8-72e2-8fa9-148369f8eb63 |
| Worker-H | wJ:pW | 01a0fa93-0800-73f2-8afb-a10b985a9504 |
| Worker-I | wJ:pX | 01a0fa93-1651-7430-ad6e-34dbd1184191 |
| Verify | wJ:pQ | 01a0fa92-8663-7883-87b7-7d046f9c7c0a |

Verify 额外执行 r3 恢复对照：调用 `herdr agent start verify --kind codex --pane wJ:pQ -- resume <原ID>`，传入命令只有裸 resume；主目录 shell 加载适配器后，实际进程 argv 含 catalog 与关闭 Computer Use 参数。该会话再次实际 exec 三项成功，确认恢复适配有效。

`node --check .herdr/start-agent.mjs`、`zsh -n .herdr/codex-resume.zsh`、`zsh -n ~/.zshrc`、`git diff --check` 均通过。新交互 shell 在 Herdr 中识别 codex 为 function，非 Herdr 为 command。非 TTY 的 `zsh -ic` 探测有既有主题 gitstatus/monitor 警告，不影响适配器检查。

限制：没有重启全局 Herdr server；验证覆盖等价的单 pane 裸恢复命令及新 shell 加载。未测试业务代码或升级任何 V1 验收状态。当前绝对路径限定本机；目录迁移/Codex 升级需按 README 更新并重新验活。
