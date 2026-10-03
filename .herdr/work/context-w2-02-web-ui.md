# Context-pack：WP-W2-02 Web 完整 UI 演示

## 目标

完成 Web 主线演示：管理员登录 → Provider 配置/验证 → 模型选择 → 文本 Task 提交 → SSE 增量 → 终态/Artifact → 刷新恢复。

## 当前事实

- `apps/web` 已有 Workbench Task/SSE cursor recovery/cancel/artifact 投影；WP-W1-04 已通过 Web check/build 和 2 个定向 Playwright，但 mock 证据不能代替真实后端。
- WP-W2-01（Worker-AI）正在完成 Provider→Task 持久化链，是实时联调依赖。
- V1 FR-005/007 仍为“本地验证”，完整真实 Web/macOS 链未闭环。

## 权威规格

- `docs/03-功能规格/V1/05-AI工作流/01-多模态AI任务工作流.md`
- `docs/03-功能规格/V1/07-模型与配置/01-模型平台与工作流配置.md`
- `docs/03-功能规格/V1/10-身份与治理/01-管理员登录与会话.md`
- `docs/02-产品与版本/当前版本/V1-实现状态.md`

## 核心约束

- UI 不写死供应商/模型；使用 resolve 返回的能力与动态参数。
- API Key/SecretRef、Provider endpoint、上游 task ID 不进入 UI 日志或 Artifact。
- 重试复用 requestId/taskId；SSE 断线用 cursor/query 恢复，不创建重复任务。
- 真实 API 默认路径必须保留；mock 仅用于 UI 开发，不作为候选验收。

## 目标验证

- 登录、Provider 状态/验证失败、模型目录/选择、Task pending/running/succeeded/failed/cancelled、SSE 断线恢复、Artifact 读取均有 UI 断言。
- 真实 Web E2E 绑定 WP-W2-01 的 code/asset manifest。
