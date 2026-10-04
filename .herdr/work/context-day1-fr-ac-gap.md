# Context-pack：Day 1 15 FR / AC 缺口评估

## 基线与目标

- 基线：`d65ed78`
- 目标：完整 Web + Native 候选，时间窗 5–8 天
- 权威规格：`docs/03-功能规格/V1/` 各 FR 主文档及 AC；实现状态仅在 `docs/02-产品与版本/当前版本/V1-实现状态.md`
- 评估报告：`docs/02-产品与版本/当前版本/V1-Day1-FR-AC缺口评估-2026-10-04.md`

## 证据边界

W4 最终 manifest 仍为 FAIL；Web/FR003/FR009/Native blocked。Native loopback 证据只证明 unsigned debug/local fixture 子集。不得把历史、本地、fixture 或单域测试写成当前候选完整通过。

## 并行边界

- Web/Native 构建与 Provider/Task 主链必须共享冻结 asset manifest，但代码写入路径隔离。
- FR002/003/009 UI 可并行实现；不能修改公共任务、权限或 Provider 语义而不先更新契约。
- FR010–015 的安全/治理/额度复验应使用独立数据库、Redis 前缀和无真实 Secret 的测试环境。
- Verify 只消费冻结候选并输出 PASS/FAIL/BLOCKED；不能通过修改产品代码绕过失败。
