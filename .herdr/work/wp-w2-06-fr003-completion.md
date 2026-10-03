# WP-W2-06：FR-003 Skill/MCP/Agent 完整实现

**Owner**：worker-platform  
**Priority**：P1  
**Status**：可立即启动  
**Estimated**：3 天

## 目标

补齐 FR-003 的读取权限、UI 正反例、翻译/MCP/Run 恢复闭环，并为 V1 E2E-03 提供真实候选证据。

## Allowed paths

- `src/extensions/`
- `src/skills/`
- `src/mcp/`
- `src/actions/`（仅扩展调用边界）
- `apps/api/src/`（扩展相关）
- `apps/web/src/`（扩展管理 UI）
- `tests/extensions/`
- `apps/web/e2e/`（扩展相关）

禁止修改 Provider/Task 核心和 native 路径；跨域契约变化先登记。

## 验收标准

- [ ] `skill.read` 独立授权；deny/ask/allow 有真实 UI 正反例。
- [ ] Skill 翻译预览→确认→Task/Artifact→apply 使用稳定版本/CAS，不伪造结果。
- [ ] MCP 首装/凭据缺失/连接/工具发现/断开/删除状态可解释，秘密不回显。
- [ ] 持久 Run 支持查询、取消、页面刷新/重启恢复，终态不重复。
- [ ] 公开 HTTP、浏览器 UI 和必要 PG 测试通过，证据绑定当前候选。

## 并行边界

与 W2-01/02/04/07 并行；仅可消费既有 Task/Quota/Artifact 契约，不修改其状态机。
