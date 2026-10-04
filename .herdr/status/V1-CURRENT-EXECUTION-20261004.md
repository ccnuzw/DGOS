# V1 当前执行状态（2026-10-04）

## 当前结论

- 正式 V1 Release：`BLOCKED`。
- V1 Web MVP Local Preview：当前工作树已通过，证据见 `.herdr/evidence/local-mock-mvp/` 最新 manifest。
- V1 当前工作树最终集成：`PASS`，证据见 `.herdr/evidence/w4-final-runs/w4-final-20261004075157-46148/manifest.json`。
- 本次 W4 分组：Web、FR-002、FR-003、FR-009、Native、migration/docs/secret 全部 `PASS`，`source_drift=false`，`mvp_demo_ready=true`。
- 当前候选仍为 dirty working tree，不能宣称正式 Release。

## 已完成本轮推进

- Web Playwright 支持 `WEB_HOST` / `WEB_PORT` / `WEB_BASE_URL`，并复用健康 WebServer。
- WebServer 增加 SIGINT/SIGTERM 清理。
- Local Mock runner 增加动态端口、显式 Web build 前置和 server/build 日志。
- FR-002 同一 app/version/build/channel 发布不可覆盖；stable 与 beta 可并存。
- 修复 macOS Dock 固定容器覆盖底部内容区的问题：Dock 容器不再拦截背景点击，仅图标保留交互；FR-003 MCP connect/invoke 当前候选 4/4 通过。
- 新增候选冻结、release gate、Local Preview Compose 生命周期工具。

## 本轮验证

- `pnpm --filter @dgos/web build`：PASS。
- `pnpm test:web:local-mock`：PASS。
- `node --test --test-concurrency=1 tests/unit/runtime.test.mjs`：10/10 PASS。
- AI/Task/Extension/Action/Provider 定向测试：47 PASS，4 SKIP（隔离 PostgreSQL 未配置）。
- 候选工具定向测试：2/2 PASS。
- migration / secret scan / docs check：PASS。
- `node scripts/w4-final-integration.mjs`：PASS（W4 run `w4-final-20261004075157-46148`）。
- `node apps/desktop/scripts/candidate-preflight.mjs`：PASS（47 migrations，package digest `sha256:1a46448233d7ec48adebd29d95cbdb8f4c82e254b3f6d577c740f53d8b6d4c39`）。
- `node scripts/v1-desktop-real.mjs`：PASS（Native Workbench Task/Artifact/reload/provider/GUI entry/close/session restore）。
- release docs gate：FAIL，具体为 `APPROVAL_STALE` 与 `SOURCE_CHANGED_SINCE_COMMIT`；不是通过修改门禁规避的失败。

## 当前阻塞

1. Native 当前工作树链已通过，但仍是 debug/loopback + local Provider fixture；不能替代正式签名、公证、目标环境和独立 Verify。
2. release docs gate 需要重新生成权威文档审批 digest，并以最终冻结 commit 重新绑定；当前错误：`docs-evidence.json` 审批过期，`docs-gate.json` 绑定后存在非证据文件变化。
3. 隔离 PostgreSQL/Redis、真实 Provider/TLS/CA/DNS/KMS、生产 Secret backend 与目标部署证据仍未配置；相关测试的 `4 SKIP` 不能计为通过。
4. 当前工作树包含既有 UI/Native/测试改动，需由 Lead/用户决定冻结边界后形成单一候选 commit；不得清理或覆盖其他人的未提交修改。

## 下一步

- 保留当前 W4 PASS 作为本地 MVP 当前候选证据，不拼接旧 Native/FR-003 结果。
- 形成干净冻结 commit，重新生成 `candidate:freeze`、权威文档审批和 `release:gate`。
- 由独立 Verify 在该冻结 commit 上复跑 W4；补齐隔离 PostgreSQL/Redis 和真实 Provider/TLS/KMS/目标部署证据后，才评估正式 Release。
- 对 Day1 缺口评估中的 FR-001/005/007/010–015 逐项建立 AC 任务包；本地 fixture 通过不关闭外部依赖、双宿主一致性、恢复和生产治理缺口。
