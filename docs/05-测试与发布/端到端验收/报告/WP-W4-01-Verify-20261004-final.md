# WP-W4-01 最终集成验证回执

```yaml
status: completed
work_package: WP-W4-01
owner: worker-test
candidate_run: w4-final-20261004014716-30734
manifest: .herdr/evidence/w4-final-runs/w4-final-20261004014716-30734/manifest.json
result: FAIL
mvp_demo_ready: false
source_drift: false
candidate_commit: d65ed785f5b2775429960ed7109fa2b59bd82f1b
```

## 矩阵结果

| 分组 | 结果 | 证据 |
| --- | --- | --- |
| Web Provider→Task→SSE→Artifact/recovery | PASS，3 tests | `web/web-provider-task-recovery.stdout.log` |
| FR-002 目录生命周期 | PASS，26 tests | `fr002/fr002-catalog-lifecycle.stdout.log` |
| FR-003 skill/MCP | PASS，4 tests | `fr003/fr003-skill-and-mcp.stdout.log` |
| FR-009 动作/权限/确认/取消恢复 | PASS，2 tests | `fr009/fr009-assistant-permission-confirm-cancel-recovery.stdout.log` |
| Native static/session smoke | PASS | `native/native-desktop-static-check.stdout.log`、`native/native-session-smoke.stdout.log` |
| Native Workbench Task/Artifact | FAIL | `native/native-workbench-task-artifact.stdout.log` |
| Migration/docs/secret gates | PASS | `gates/` logs |

Native 失败原因为 `windowserver_owner_timeout`，底层诊断 manifest 为 `.herdr/evidence/native-workbench-2026-10-04T01-47-39-049Z.json`。该分支没有证明 Workbench Task/Artifact，因此最终候选不能宣布 MVP ready。

## 交 Verify

请 Verify 审核同一 manifest 及其所有分组原始日志，重点复核 Native 失败是否属于环境/WindowServer 阻塞，并在修复或提供可复现运行环境后重跑 Native 分组。Web、FR-002/003/009 及 migration gate 的通过证据不得与其他批次拼接。
