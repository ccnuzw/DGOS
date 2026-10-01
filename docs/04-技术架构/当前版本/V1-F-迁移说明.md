# V1 F 轮迁移说明

日期：2026-10-01。依据 [数据模型](V1-数据模型.md) 中 Audit 的 action/target 关联与公开 Action/Permission 文本标识，Runtime 审计目标需要容纳 UUID 和文本 ID。

| 迁移 | 影响 | 回滚条件 | 验证 |
| --- | --- | --- | --- |
| `0014-audit-runtime-targets.sql` | `audit_events.target_id` 从 uuid 转为 text，已有 UUID 保留字符串表示；无 API 字段改名 | 回转 uuid 前须处理非 UUID target，不能盲目降级 | Compose PG Action/Permission/Key 审计查询与 dump/restore |
| `0015-action-handler-claim.sql` | 补充 `action_runs.handler_claimed boolean`，与 C 的 claimHandler 对齐 | 停止 Action 执行器后方可移除；该字段不提供重启输入恢复 | PG settings Action handlerCalls=1，deny/冲突不覆盖 |

历史 migration 内容及已登记 checksum 不修改。`0013-action-run-recovery.sql` 仍保留；其缺失字段通过后续版本补齐。执行器 lease/reclaim 不等于持久化 handler 输入和重新派发，完整恢复仍为发布阻塞。证据见 [F 报告](../../05-测试与发布/端到端验收/报告/V1-F-整合联调报告.md)。
