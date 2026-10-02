# V1-EXT r2 受控主目录整合回报

- status: transferred_for_lead_integration
- work_package: V1-EXT / r2
- date: 2026-10-02
- source: `.worktrees/v1-extensions` r1 冻结工作树
- target: `/Users/apple/Progame/DGOS`
- commit/push: none

## files_changed

以 `apply_patch` 新增 18 个授权文件：`src/extensions/*.mjs` 4 个、`apps/extension-runner/src/*.mjs` 4 个、`apps/api/src/extension-routes.mjs`、`migrations/0025-extension-registry.sql` 至 `0027-extension-run-events.sql` 3 个、`tests/extensions/*.mjs` 6 个。未带入 AGENTS、r1 DELIVERY、依赖、构建目录或其他路径。

## tests_added

r2 仅转入 r1 已交付测试资产，未新增测试案例。r1 的测试结果见来源 worktree `DELIVERY-V1-EXT-r1.md`；本修订没有复跑领域测试或数据库测试。

## commands_run

| 命令/检查 | 结果 |
| --- | --- |
| 主目录目标路径 `git status --short` 和存在性检查 | 转入前无目标路径修改、目标文件不存在 |
| `apply_patch` 新增授权文件 | exit 0；18 个文件 |
| `shasum -a 256` 源/目标逐文件核对 | exit 0；18/18 相同 |
| `node --check` 全部新 `.mjs` | exit 0；15/15 通过 |
| `git diff --no-index` 样本源/目标；`git diff --check` | exit 0；无差异或空白错误 |

## implementation_facts

主目录现有独立 `registerExtensionRoutes` 模块、`ExtensionRunDaemon`、受控 runner、扩展领域模块及 0025–0027 migration。转入文件与 r1 冻结来源逐字节一致。本修订未触碰 `apps/api/src/server.mjs`、`apps/worker/src/worker.mjs`、根依赖/锁文件、Compose 或共享文档。

## contract_changes_proposed

[]；沿用 Planner 的 `V1-extension.openapi.yaml`。公共路由和 worker 接线仍由 Lead 后续整合。

## open_risks

- r2 仅语法和 SHA/diff 核验，未在主目录执行数据库、领域或 E2E 测试，不代表整合候选通过。
- 引用保护、凭据、确认、应用依赖 hooks 与 MCP 跨进程协调仍待下一修订；未在本次补写或宣称实现。
- OS 级文件/网络沙箱与生产出站策略仍需独立证据；r1 受控子进程 fixture 不等于 OS sandbox。

## docs_to_update

Lead/Planner 后续回写 FR003 实现状态、E2E-03 与公开错误矩阵；本次只写本回报。

## 未完成事项与 Lead/Planner 决定

- 未完成：公共入口接线、主目录整合实跑、跨进程 MCP 协调和生产隔离证据。
- 需 Lead 决定：公共 API/worker 接线顺序及下一修订的 hooks/进程协调边界。
