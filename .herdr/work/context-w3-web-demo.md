# Context-pack：Wave 3 Web 完整演示

## 基线

- Commit：`f14a3c9`
- Wave 2 已有 Provider→Task→SSE→Artifact 真实证据和 W2-03 E2E 框架。
- 当前优先目标是 Web MVP；Native 不阻塞 Web。

## 权威规格

- `docs/03-功能规格/V1/05-AI工作流/01-多模态AI任务工作流.md`
- `docs/03-功能规格/V1/07-模型与配置/01-模型平台与工作流配置.md`
- `docs/03-功能规格/V1/10-身份与治理/01-管理员登录与会话.md`
- `docs/02-产品与版本/当前版本/V1-实现状态.md`

## 目标链路

登录 → Provider 配置/验证 → 模型目录/选择 → 文本 Task → SSE → Artifact → 刷新/断线恢复。

## 约束

- 真实 API 默认路径；mock 仅开发 fallback。
- requestId/taskId/cursor 必须复用；不重复提交。
- 不泄露 API Key、SecretRef、Provider endpoint、上游 task ID。
- 失败/取消/超时必须有可解释 UI 状态。
