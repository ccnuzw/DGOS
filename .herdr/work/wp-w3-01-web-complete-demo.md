# WP-W3-01：Web 完整演示

**Owner**：worker-web  
**Priority**：P0  
**Status**：立即启动  
**Estimated**：2 天

## 目标

基于 `f14a3c9` 已打通的 Provider→Task 链，完成可录制、可复现的 Web MVP 演示。

## Allowed paths

- `apps/web/src/`
- `apps/web/e2e/`
- `packages/dgos-ui/`（必要 UI 组件）
- `apps/web/evidence/`

不得修改 Provider/Task 服务契约、migration、native 宿主；发现契约问题单独回报。

## 验收标准

- [ ] 管理员登录后可配置/验证 Provider。
- [ ] 可查看模型目录并选择可用文本模型。
- [ ] 可提交文本 Task，显示 queued/running、SSE 增量、终态和 Artifact。
- [ ] 刷新/SSE 断线后使用同一 taskId/cursor 恢复。
- [ ] failed/cancelled/provider unavailable 有稳定提示和可控重试。
- [ ] 真实 Web E2E、截图/录屏和 manifest 绑定 `f14a3c9` 或后续修订。
