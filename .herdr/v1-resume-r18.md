# V1 恢复收敛 r18 — 2026-10-02

Delivery: DGOS-V1-IMPLEMENT-20261002。用户再次授权分析当前缺口并继续完成 V1。Lead 已核对当前主目录、已有未提交改动、看板及 Herdr wJ 各会话空闲入口；保留全部既有工作。沿用已 Ready 的 V1-platform / V1-ai-task / V1-assistant / V1-release 范围、47 条冻结迁移及既有业务契约。没有提交、推送或发布授权。

开始先实际执行 pwd/git root 并读取角色、docs 入口、功能开发流程及以下原任务包；若工具不可用，立即回执阻塞。共享主目录采用下列互不重叠的独占写入边界；不恢复其他历史 working 包。报告必须含工作包修订、实际命令/退出码、文件摘要、限制及停止写入确认。

## Planner — V1-GAP-RECONCILE r18

只写 `.herdr/V1-GAP-RECONCILE-r18.md` 与 `.herdr/v1-remaining-plan-r18.md`。读取12功能/62AC、最新实现状态、AC资产核对、r8状态报告、r14覆盖、r10原生及r9安全记录。核实尚缺功能、验收资产和外部发布输入，按依赖输出可执行任务包；逐项标来源，不能将旧批次算当前通过。复核现有三个恢复工作包Ready与边界。执行只读结构/planning/release门禁并摘要，禁止改变权威状态或审批。

## Verify — V1-CANDIDATE-COVERAGE r15

继承 `.herdr/v1-candidate-coverage-r14.md` 的完整目标与验收，原r14未执行。独占 `scripts/v1-candidate-run.mjs`、`scripts/v1-regression-sweep.mjs`、`scripts/verify-release.mjs`、可选 `scripts/v1-candidate-business.mjs`、相关 `tests/tooling/` 验收工具测试；报告 `.herdr/V1-CANDIDATE-COVERAGE-r15.md`。落实真实日志/断言提取、多证据组合、缺项显式失败；不可用虚构聚合标题或单元测试声称E2E通过。先工具测试，返回最终命令/资源及停止回执，当前其他路径仍变动，暂不全量候选执行。

## Worker-B — V1-IMAGE-SECURITY r10

继承 `.herdr/v1-image-security-r9.md` 和 convergence r16 的 B 边界，独占 `deployment/`、`docker-compose.production.yml`、`scripts/v1-ops-*.mjs`、对应ops测试及自身证据；报告 `.herdr/V1-IMAGE-SECURITY-r10.md`。先核对已存r9扫描，按实际包/可达依赖分类；通过受支持的基础镜像/包版本修复可修项，不能削弱sandbox、删除必需库或伪造例外。有变化才重建扫描；使用自身15310–19、隔离PG/Redis资源。验证非root Chromium、API/worker、Linux MCP与负例，明确剩余无修复项。可做可逆构建，不做生产部署。

## Worker-F — V1-NATIVE-EXECUTION r11

Lead 将 r10 native driver 写入权交还 F。独占 `apps/desktop/scripts/`、`apps/desktop/src-tauri/`、`scripts/v1-desktop-real.mjs` 和自身工具测试/证据，报告 `.herdr/V1-NATIVE-EXECUTION-r11.md`。读取r10真实失败，诊断Tauri子frame自动化注入与桥接。修复调试测试入口时须只在debug构建启用，不改变权限/隔离或签名包内容。可使用当前不变Web dist重建、真实窗口操作和隔离资源执行局部native业务链，记录Task/SSE/Artifact/reload/上下文权限证据；这属于局部诊断，最终同候选另验。不得重建Web或改dist。没有可证明的真实GUI路径则保留失败并给出具体根因。

## Worker-D — V1-UI-INVENTORY r8

只读产品/旧证据，仅写 `.herdr/V1-UI-INVENTORY-r8.md`。继承UI r7与真实management测试上下文，核对已完成/失败/未运行标题及source/dist绑定、目前服务和资源。输出余下浏览器分支、必要修复文件和准确重跑命令；本轮不启动/重启服务、不改Web/dist，保证F输入稳定。

## Lead

维护看板及权威状态；复核回执/真实产物后进行独立测试。产品/工具写入停止后再生成候选身份并执行全量组和双宿主验收。外部Provider、Developer ID/公证、目标部署、负载与恢复目标审批等输入按事实记录，不能用本地fixture代替。
