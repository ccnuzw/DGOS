# Context-pack：WP-W2-06 FR-003 完整实现

## 目标

补齐 Skill/MCP/Agent V1 管理与受控调用的关键缺口：skill.read 独立授权、真实 UI 正反例、翻译/MCP/持久 Run 恢复，并保持秘密和权限边界。

## 当前事实

- FR-003 为“基础实现”；已有 PG/公开 HTTP、Skill/MCP 管理、翻译 Task/Artifact、模板凭据、可信预览和 macOS sandbox 局部证据。
- 主要差距是读取权限独立授权、真实 UI 分支、翻译/MCP/Run 恢复及最终镜像/候选回归。

## 权威规格

- `docs/03-功能规格/V1/03-Agent与协议/01-SkillMCP与Agent接入.md`
- `docs/04-技术架构/当前版本/V1-扩展管理补全工程契约.md`
- `docs/02-产品与版本/当前版本/V1-实现状态.md`

## 核心约束

- `allow/ask/deny` 和 `skill.read` 独立计算；未授权不返回内容。
- MCP 连接状态与启用状态分离；凭据 write-only、日志脱敏。
- 长任务使用 Run/Task，页面关闭不等于完成；取消/重连/恢复必须可查询。
