# Day 6 V1 完整验证执行说明

## 一键入口

从仓库根目录执行：

```sh
node scripts/day6-full-verification.mjs
```

脚本按固定顺序执行 15 个矩阵条目，所有 stdout/stderr 写入同一 `.herdr/evidence/day6-full-verification/<run-id>/`，最终生成 `manifest.json`。每条结果绑定命令、退出码、输出哈希、fixture fingerprint 和 FR 编号。

## 矩阵边界

- `V1-FR-001/002/003/005/007/009/010/011/012/013/014/015` 为 Day 6 执行项。
- `V1-FR-004`、`V1-FR-006`、`V1-FR-008` 由权威追踪矩阵标记 `NOT_IN_V1`，分别属于 V2-V5、V5、V4 规划范围；该状态不是 PASS，也不应被纳入 V1 完成率。
- `BLOCKED` 表示环境或前置条件未满足；`FAIL` 表示命令执行失败；只有命令成功退出才记录 `PASS`。

## Fixture

Fixture profile 位于 `tests/fixtures/day6-v1-fixture.mjs`，fingerprint 为运行时计算值。它提供固定 Provider/model、任务 requestId、角色和负向分支名称；真实 credential 通过 `DAY6_PROVIDER_TOKEN` 注入，禁止写入 manifest 或日志。

## 预演回执

预演 run：`.herdr/evidence/day6-full-verification/day6-v1-2026-10-04T02-24-50-120Z-6129c5f6/manifest.json`。

结果为 `READY_FOR_VERIFY`：14 条命令 PASS，FR-001 Web UI Playwright 因当前环境阻塞 1 条，Native smoke 通过。该回执证明入口和证据收敛工作正常，不代表 V1 最终验收通过。
