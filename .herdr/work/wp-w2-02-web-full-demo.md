# WP-W2-02：Web 完整 UI 演示

**Owner**：worker-web  
**Priority**：P0  
**Status**：可立即启动准备；WP-W2-01 完成后联调  
**Estimated**：2 天

## 目标

把现有 Workbench UI 收敛为真实后端演示路径：登录、Provider 配置/验证、模型选择、文本 Task、SSE、结果与恢复。

## Allowed paths

- `apps/web/src/`
- `apps/web/e2e/`
- `packages/dgos-ui/`（确有必要时）
- `apps/web/evidence/`（仅本任务证据）

不得修改 Provider/Task 服务契约、migration 或 native 宿主。

## 依赖

- **准备工作可立即开始**：页面状态、API wiring、测试、错误态可先完成。
- **真实联调依赖 WP-W2-01**：使用其最终 endpoint/状态/事件契约和 manifest。

## 验收标准

- [ ] 管理员登录后进入 Workbench，Provider 验证与模型选择使用真实 API。
- [ ] 提交文本 Task，展示 queued/running、SSE 增量、终态和 Artifact/result。
- [ ] 刷新或 SSE 断线后仍使用同一 taskId/cursor 恢复，不重复提交。
- [ ] failed/cancelled/provider unavailable 有稳定 UI 状态和重试/取消入口。
- [ ] Secret、endpoint、Provider 私有字段不进入日志、页面调试输出或截图。
- [ ] 真实 Playwright E2E 通过；mock 测试单独标记，不升格。

## 并行边界

与 WP-W2-04、WP-W2-06、WP-W2-07 完全并行；仅在 WP-W2-01 联调阶段读取其稳定契约，不改其代码路径。
