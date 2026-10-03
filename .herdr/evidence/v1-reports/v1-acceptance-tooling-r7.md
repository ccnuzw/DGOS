# V1-ACCEPTANCE-TOOLING r7 — Verify 回执

status: partial
scope:
  - `docs-gate.json` 的 `commandRegistry`、`scripts/v1-regression-sweep.mjs` 候选只读计划/完成判据、`tests/tooling/v1-acceptance-tooling.test.mjs`；产品源码与权威状态只读。
checks:
  - `node --test tests/tooling/v1-acceptance-tooling.test.mjs tests/tooling/verify-release.test.mjs tests/tooling/release-environment.test.mjs`：退出码 0；13 pass / 0 fail / 0 skip。仅工具测试；未运行产品全扫。
  - `node scripts/v1-regression-sweep.mjs --plan`：退出码 0；当前主 `tests/` 显式发现 86 文件；memory 55、PG 15、Redis 1、TLS 3、browser 3、guarded 4、blocked 1、placeholder 4。另列 Web 2、macOS 1 个独立资产。
  - `node scripts/docs-gate.mjs --phase release --json`：退出码 1；10 errors（缺审批 6、commit 1、development/e2e/release 报告 3），5 warnings（缺测试资产 3、spec-diff 1、未登记 `pnpm test` 1）。`COMMAND_REGISTRY_OFF` 已消失；未放宽提交、manifest、审批和 pending AC 规则。
  - `node --check scripts/v1-regression-sweep.mjs`、`git diff --check -- docs-gate.json scripts/v1-regression-sweep.mjs tests/tooling/v1-acceptance-tooling.test.mjs`：均退出码 0。
evidence_level: local
verified:
  - 登记 19 个已存在的精确命令入口：构建/检查、受控发布/浏览器/桌面入口、有限 Node 内存测试、回归 `--plan` 与 r6 定向命令。未登记裸 `pnpm test`、泛化 `node --test` 或默认连接原 `dgos` 的 PG 文件；登记只是允许门禁核对，不代表执行通过。
  - 候选计划用 `discoverRootTests()` 限定主目录测试，不枚举 `.worktrees`；单独列随机 Verify PG 子库、Redis DB6、TLS/固定端口、D 浏览器、F 原生及 guard/placeholder。`--plan` 不连接数据库或启动服务。执行入口仍只迁移 <=0044；0045+ 须先由 Lead 冻结精确清单和摘要，不能静默纳入。
  - 执行入口新增 `candidate_complete`：任何源码漂移、失败/超时、0 测试、skip、排除或 setup error 均不能完成候选。历史 r5 成对报告保持不变。
  - 发布门禁 manifest 必填：`run_id/environment/code_version/commit/command/working_directory/exit_code/stats/started_at/test_report/asset_sha256/cleanup/sanitization/scope/limitations/prior_attempts`；报告须有配对 manifest，`test_report` 指向该报告，统计、环境、资产 SHA256 与当前文件吻合，退出码 0。`docs-evidence.json` 的真实完整 commit 与 manifest.commit 一致且属于当前分支历史；提交后只允许所选配对证据文件变化。脏树 hash 只能标识本地批次，不能替代正式提交绑定。
  - 本包最终 SHA256：`docs-gate.json` `2f06ecd62ba0a2432faed91502308568f754292456bf48abc64994d45ef2f976`；`scripts/v1-regression-sweep.mjs` `8f4e70c42abeb41c1ca37dcd74c200b17bdd9a244bbc2adda2642f4afbc00875`；`tests/tooling/v1-acceptance-tooling.test.mjs` `5604cf288460b023fb15fb06ad4ad51d1ef273c4edc561abc2e948035b66b8cb`。HEAD 为 `72ab1cb98b064a6e27b9f60a9f8f00881a827a99`，工作树仍脏。
limitations:
  - r7 不执行全量产品测试、D 15200、原生 GUI 或 Redis/PG 写入；86 文件是运行 `--plan` 时的快照，仍有并行写入。
  - 4 个专用库名 guard、混合文件中的 PG 子测试和 4 个无条件 skip 占位不得计作通过。`real-v1-workflow` 自建 `dgos_test_*` 并迁移全部 SQL，需 owner 适配后才可纳入 Verify 前缀运行。
  - 当前回归执行脚本只覆盖 memory/PG 两组；`--plan` 给出 Redis/TLS/browser/native 的待执行分组和隔离要求，不是已经执行的完整候选。生产 TLS、性能批准负载、正式审批和 release commit 均未产生。
return_to_lead:
  - Planner：将 FR015 中 5 处裸 `pnpm test` 改为存在、隔离且能证明对应 AC 的命令；处理 3 条缺失资产引用（network-settings、mcp-quick-config、provider-no-export），不可用其他子集冒充完整 AC。
  - 各 domain owner/Lead：收敛专用库名 guard 与 `real-v1-workflow` 的 Verify 隔离入口，冻结 0045+ 精确迁移校验和；D/F 各自归还 browser/native 证据。源冻结后按 `--plan` 分组执行，缺失/skip 保留为未通过，随后由 Lead 组织正式提交绑定、审批和发布报告。
