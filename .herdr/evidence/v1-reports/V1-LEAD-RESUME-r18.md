# V1 Lead 恢复核验 r18 — 2026-10-02

工作包 DGOS-V1-IMPLEMENT-20261002 / r18，环境为本机共享未提交主工作区；HEAD `72ab1cb98b064a6e27b9f60a9f8f00881a827a99` 仅为基线，不是当前源码提交绑定。本文记录真实命令观察，不作为完整候选验收。

- `node scripts/check-docs.mjs`：exit 0，0 errors / 3模板warnings。
- `node scripts/docs-gate.mjs --phase planning --json`：exit 0，0 errors / 1规格基线差异warning（48项变化）。
- `node scripts/docs-gate.mjs --phase release --json`：exit 1，10 errors / 1 warning；缺审批摘要/提案/三个角色/时间、commit和development/e2e/release报告。
- `pnpm run check`：exit 0；Web TypeScript、API/Worker语法与桌面配置通过，macOS adapter测试2/2。部分workspace check为占位命令，不代表相应包有全面测试。
- `git diff --check`：exit 0。
- 通过 `candidatePlan` 选择memory组并排除正在修改的tooling测试，清除PG/Redis环境后 `node --test --test-concurrency=1 <47个明确文件>`：exit 0，142 pass / 0 fail / 0 skip，9.1秒；没有运行数据库组，不声称全量验收。
- `pnpm run migrate:check`：exit 0，57项检查；该命令仅列10条早期migration，不能证明47条最新迁移已执行。47条实际迁移另由PG/native脚本核对。
- 逐项重算 `.herdr/V1-UI-r7-manifest.json` 13个源码/测试/dist/契约摘要：全部一致。r7历史浏览器结果仍受原批环境和条件分支限制。
- 使用主会话fetch查询15175/15176/15202/15203的ready或首页：均HTTP200。Worker沙箱的EPERM/连接失败不代表这些服务停机。
- `WEB_EXTERNAL=1 WEB_BASE_URL=http://127.0.0.1:15203 pnpm --filter @dgos/web exec playwright test -c playwright.config.mjs e2e/workbench.spec.mjs --workers=1 --output=../../.herdr/state/browser-r18-fixture`：exit 0，30/30，11.2秒。此资产拦截响应，证据等级为浏览器fixture交互回归。
- 在一次性r9镜像容器运行 `apt-get update -qq`、关键包 `apt-cache policy` 和 `apt-get -s upgrade`：exit 0，0 upgraded；libxml2/expat/systemd/udev/mount/gbm已为trixie仓库当前Candidate。此结果不构成新镜像扫描；原r9仍1 Critical/59 High。B核对18个可autoremove包与60条扫描记录无交集，因不能关闭CVE，本轮不为瘦身另改生产镜像。
- `node scripts/v1-desktop-real.mjs`：exit 1，四项setup通过后 `webview_result_timeout`，可见1280x840窗口、`webviewLastState=null`；源码/dist/二进制无漂移，专用Keychain/随机DB/Redis前缀全部清理。证据 `.herdr/V1-NATIVE-EXECUTION-r11-2026-10-02T04-42-58-755Z-fbe9d6bf-manifest.json`。F已收到r12返工，不将此失败写成GUI通过。

当前执行包与资源以delivery-board为准。实际PG诊断、分支确定的浏览器测试、native修复及候选覆盖提取仍在执行；正式外部Provider、Developer ID/公证、目标部署及发布审批尚缺。

## 后续真实诊断增量

- `node scripts/v1-provider-failures-http.mjs`：exit0，8/8，sourceStable=true；新批次 `tests/provider/evidence/V1-PROVIDER-FAILURES-r8-2026-10-02T04-48-06-675Z-6c04da21-manifest.json`。本地PG/Redis/TLS及独立worker；沿用脚本原r8标签，日期为本轮实际执行，不代正式外部Provider。
- `DGOS_VERIFY_ADMIN_URL=<本机专用父库> node .herdr/state/pg-diagnostic-r19/run.mjs --run`：exit1，37文件中35通过、2失败、零skip；完整批次 `.herdr/V1-PG-DIAGNOSTIC-r19-pg-diagnostic-r19-2026-10-02T04-48-42-857Z-manifest.json`。两失败为共享Task队列污染与atomic旧admission fixture缺profile字段，A r20修复；随机子库已删除。按被测文件摘要记录，仍非最终候选。
- `node scripts/v1-identity-http.mjs`：exit1，line73 secretKeys3与预期1不符；脚本finally记录databaseDropped/redisPrefixRemoved/packageRootRemoved均true。C r20核查活跃Secret与撤销墓碑语义，不把计数直接改为3。
- `node scripts/v1-extension-management-http.mjs`：exit0，公开链8/8；`tests/extensions/evidence/V1-EXT-PUBLIC-r7-2026-10-02T04-51-54-931Z-05a3a49d-manifest.json`。实际包含独立worker、Task/额度/Artifact、翻译CAS、MCP凭据及受信预览。
- r12 native由主会话启动PID49863，进程已退出；配对 `.herdr/V1-NATIVE-EXECUTION-r12-2026-10-02T04-50-44-301Z-9509aad6-manifest.json` 记录failed `signed_workbench_bridge_timeout`、sourceDrift=false、清理完成。主页面已能回传，但窗口截图为Settings，F r13继续诊断。不能将窗口可见算工作台通过。
