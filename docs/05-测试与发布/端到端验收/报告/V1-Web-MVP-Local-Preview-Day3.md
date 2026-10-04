# V1 Web MVP Local Preview：Day 3 本地 E2E

## 执行

```sh
node scripts/local-mock-mvp-e2e.mjs
```

入口执行 `local-mock-mvp.spec.mjs` 与既有 `workbench.spec.mjs`。测试使用 `?mock=1`/`VITE_DGOS_MOCK=1`，由 Web API mock task adapter 产生确定性任务、文本增量、终态和 artifact 引用；设置 API 仅 mock version conflict，未连接外部 Provider、PG、Redis 或 macOS 宿主。

## 覆盖

- Workspace 核心导航和本地响应式无横向溢出。
- AI Task：Prompt → Submit → streamed events → succeeded → artifact reference。
- 取消：任务进入 terminal `cancelled`，无重复提交。
- Settings：旧版本写入返回 `version_conflict`，提交 payload 保持 `baseVersion` 和 domain/patch 契约。
- 既有 Workbench：任务恢复、Provider/model 选择、助手确认/取消、Skill translation、MCP credential redaction。

每次运行生成唯一 run-id、stdout/stderr 哈希和 manifest，位于 `.herdr/evidence/local-mock-mvp/<run-id>/`。`PASS` 仅表示本地 mock E2E 通过，不代表真实 Provider、生产发布或 macOS 验收通过。

## Day 3 回执

最新最小可复现批次：`.herdr/evidence/local-mock-mvp/local-mock-mvp-2026-10-04T03-25-52-700Z-4c0a8cbe/manifest.json`，结果 `PASS`。执行的是既有稳定的 `workbench.spec.mjs` mock task 主流程：Prompt → Submit → streamed result。

扩展资产 `local-mock-mvp.spec.mjs` 已准备 Settings version-conflict、Workspace 和取消场景；其中 Settings conflict 已独立通过，Workspace/取消仍需与当前 Web shell 的认证/Status DOM 契约同步后纳入强制批次。它们未被本次 PASS manifest 隐瞒或拼接。
