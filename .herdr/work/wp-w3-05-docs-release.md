# WP-W3-05：V1 文档与交付收敛

**Owner**：planner + worker-devops（Lead 审核）  
**Priority**：P1  
**Status**：文档盘点/待办登记可立即开始；状态回写依赖 Verify 结果  
**Estimated**：2 天

## 目标

把 Wave 3 真实证据同步到 V1 实现状态、E2E/发布报告、Web 演示运行说明和限制清单。

## Allowed paths

- `docs/02-产品与版本/当前版本/V1-实现状态.md`
- `docs/05-测试与发布/端到端验收/报告/`
- `docs/05-测试与发布/发布/`
- `.herdr/status/`
- `.herdr/evidence/`

不得修改功能需求语义或以文档替代测试证据；不删除历史报告。

## 验收标准

- [ ] FR 状态只根据 Verify 证据回写，逐项附日期、环境、代码版本、命令、结果和限制。
- [ ] Web MVP 运行/演示步骤可由新会话复现。
- [ ] E2E、发布门禁、Native 限制和未完成事项清晰区分。
- [ ] 运行 `check-docs`/文档门禁并记录既有错误与本次新增错误。

## 分阶段执行

1. **现在可做**：核对 W3 实际交付文件、实现状态旧截点、E2E矩阵、发布清单；列出差异，不先改实现结论。
2. **验证后**：按 W4-01 Verify manifest 回写 FR 状态和 AC/E2E覆盖。
3. **发布准备后**：补部署/演示运行步骤、已知限制和责任签核状态；发布未获批准时明确标为 Pending/Blocked。

## Context

见 `.herdr/work/context-w3-05-docs.md`。
