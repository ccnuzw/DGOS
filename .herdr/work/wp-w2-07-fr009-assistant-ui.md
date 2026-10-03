# WP-W2-07：FR-009 助手 UI

**Owner**：worker-web  
**Priority**：P1  
**Status**：可立即启动  
**Estimated**：2 天

## 目标

实现助手的快捷指令、动作目录、计划/确认、执行状态、取消和历史恢复 UI，不扩大 V1 动作范围。

## Allowed paths

- `apps/web/src/`
- `apps/web/e2e/`
- `packages/dgos-ui/`（必要 UI 组件）
- 助手相关 API client/types

禁止修改 Action Registry/Permission 后端语义；发现缺口以接口问题清单回报。

## 验收标准

- [ ] 展示可用快捷指令和已注册 actionId，不展示未授权动作。
- [ ] 生成计划时显示目标、风险、capability、输入摘要；副作用前必须确认。
- [ ] 支持 allow、deny、cancel、timeout、provider unavailable 和无匹配动作状态。
- [ ] 执行状态展示 requestId/taskId/runId；刷新后可恢复查询，不伪造完成。
- [ ] 历史脱敏；不出现 Secret、Cookie、私有 endpoint、完整 prompt。
- [ ] Playwright 覆盖导航、确认、拒绝、取消和恢复。

## 并行边界

与 W2-02 可并行，但避免同时修改同一通用路由/布局文件；若冲突，助手页面优先独立目录和组件，统一壳层变更先通知 Planner。
