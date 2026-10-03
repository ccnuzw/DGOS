# WP-W1-01：FR-001 Native/Workbench 启动闭环

**Owner**：Worker-Native（Worker-Web 仅做必要联调）  
**Estimated**：2–3 天  
**Priority**：P0  
**Slice**：DGOS-V1-MVP-20261003 / Wave 1

## 目标

修复 macOS native 宿主加载当前候选 Workbench 的阻塞，取得可复现的真实窗口、iframe/frame-present 和 bridge handshake 证据；同时保证本地 Web 入口可启动。

## Context

见 `.herdr/work/context-week1-fr001-fr005-fr007.md`，重点读取 FR-001 主规格、技术设计、V1 实现状态和当前 desktop 脚本。

## Allowed paths

- `apps/desktop/`
- `apps/ai-workbench-package/`
- `apps/desktop/scripts/`
- `apps/web/`（仅必要联调）
- 对应 `tests/`、`.herdr/evidence/`、`docs/05-测试与发布/端到端验收/报告/`

不得擅自修改 Provider/Task 公共契约或 unrelated migrations。

## 依赖

- 使用现有 FR-002 安装/健康检查和 FR-010 Session 能力。
- WP-W1-02 可并行；最终 Workbench Task 联调依赖 WP-W1-02 的可运行接口。

## 验收标准

- [ ] 真实 macOS 前台窗口由正确 native PID/WindowServer owner 持有。
- [ ] 当前候选 dist 可加载 Workbench，完成 iframe/bridge handshake 和 frame-present。
- [ ] Web 入口启动后显示相同 Workbench 关键入口。
- [ ] 超时、握手失败、清理失败均有可诊断结果，不伪造成功。
- [ ] manifest 绑定 code version、asset hash、环境、命令、结果和限制。

## 交付

- 代码/测试变更
- 日期化执行 manifest
- 已知限制与未关闭的 FR-001 AC 列表
