# Context-pack：WP-W3-05 文档与交付收敛

## 事实基线

- Wave 2：commit `f14a3c9`，Provider→Task→SSE→Artifact 链和 E2E 框架已提交。
- Wave 3 状态来自 `.herdr/status/current.yaml`：W3-01 Web演示 UI 和 W3-03 FR-002入口标为完成；W3-02 Native修复与W3-04集成验证仍进行中。
- W3-01 的结果记录显示真实 Provider E2E 尚未在 Web 会话执行；其 check/build通过，既有定向用例通过，但不能仅凭任务状态认定完整演示验收。
- V1 实现状态文档仍保留 2026-10-02 旧截点，必须只按最新可复核证据更新，不复制 Sprint 状态作为实现事实。

## 权威来源

- `docs/02-产品与版本/当前版本/V1-实现状态.md`
- `docs/02-产品与版本/当前版本/V1-产品需求.md`
- `docs/05-测试与发布/端到端验收/用例矩阵.md`
- `docs/05-测试与发布/发布/README.md` 与发布检查清单
- `.herdr/evidence/` 和实际 Verify 报告

## 硬限制

- 不能把 W3-01/03 标记或 commit 本身直接升格为 FR 完成。
- Release 文档当前明确“不可标记可发布”；fresh image/canary、目标恢复、性能批准、发布签字缺失，须实证完成。
- 状态证据含日期、环境、code/build/asset 标识、命令、结果、限制。
