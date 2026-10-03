# V1-REGRESSION-SWEEP r5 — Verify 回执

status: partial
scope:
  - 主工作区 `tests/` 77 个显式 Node 文件发现与分组；主产品及领域测试只读
  - 无 DB 阶段清除 `DGOS_DATABASE_URL` 等 PG/Redis URL；PG 阶段在 `dgos_v1_integrated` 管理库生成随机 `dgos_v1_verify_*` 子库，迁移冻结 SQL <=0044
checks:
  - `node --check scripts/v1-regression-sweep.mjs`：退出码 0
  - `DGOS_VERIFY_ADMIN_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_integrated node scripts/v1-regression-sweep.mjs` 首轮：退出码 1；61 文件，171 pass / 2 fail / 1 skip；子库 `dgos_v1_verify_1433bbca013e4e92b7d289b7a0f3158e` 已删除。首轮不覆盖，作为分组修正前历史。
  - 同一命令第二轮：退出码 1；64 文件，179 pass / 2 fail / 5 skip；其中无 DB 49 文件 143 pass / 2 fail / 5 skip，PG 15 文件 36 pass / 0 fail / 0 skip；子库 `dgos_v1_verify_37eb480f120a4f458b9008acac69ab57` 已删除。
  - `git diff --check`：退出码 0；`node --check scripts/v1-regression-sweep.mjs`：退出码 0；管理库只读查询 `pg_database` 中 `dgos_v1_verify_%`：空数组，退出码 0。
  - 收尾只读核对 `git diff -- tests/integration/usage-settlement.spec.mjs` 与 `git diff -- tests/unit/runtime.test.mjs`：退出码 0。未执行第三轮全扫或定向复跑。
evidence_level: local
verified:
  - 第二轮 77 文件清单中 64 执行、13 排除；5 个 skip 来自 `runtime-api` PG 子测试及三个 System 混合文件的 4 个专用治理库 PG 子测试，均不计作通过。13 排除含 6 个浏览器 E2E、3 个专用库名 guard、2 个浏览器/签名包 fixture、1 个 Redis DB0、1 个会生成非 Verify 前缀子库的全链路 fixture；详见 manifest 逐文件清单。
  - 实际迁移 40 个版本，末尾为 0041、0043、0044；0042 空档，0045 未迁。0043/0044 校验和与冻结值匹配。每个 Node 子进程上限 60 秒，无超时、空退出或未清理数据库。
  - 两轮源码身份起止摘要不同，第二轮 `source_drift=true`；HEAD `72ab1cb98b064a6e27b9f60a9f8f00881a827a99` 不代表本次未提交源码。manifest 记录起止工作树 SHA256 和主 `tests/` 资产 SHA256。
  - 首轮成对证据：`docs/05-测试与发布/端到端验收/报告/V1-regression-2026-10-02T00-23-50-857Z-bf4fdf0f.md`、对应 `-manifest.json` 与 61 份 TAP 日志。
  - 第二轮成对证据：`docs/05-测试与发布/端到端验收/报告/V1-regression-2026-10-02T00-25-27-532Z-f0c18b98.md`、对应 `-manifest.json` 与 64 份 TAP 日志。
  - 收尾时确认 Lead 已在 `tests/integration/usage-settlement.spec.mjs` 仅为 `settleUsage`/`releaseQuota` 调用传入同主体 `authContext`；`usageEventId` 重放一致、release/replay 状态断言仍在。Lead 回报修订后单文件 1/1 通过，此结果为 Lead 回报，Verify 未独立执行，不能回写为 r5 全扫通过。
  - `tests/unit/runtime.test.mjs` 当前工作树已见 A 方向改动，包括 network 字段及并发、脱敏断言；A r7 的完成回执和定向执行结果尚待 Lead 收集，本包不升格为通过。
limitations:
  - 历史两轮均有 2 个真实失败；后续修订不改变已保存的 TAP 结果。Lead 报告 Quota 单文件通过，System 待 A r7 收敛，Verify 未在当前源码重验；并行源码漂移阻止将旧全轮结果归于单一冻结源码快照。
  - D/F 独占浏览器、桌面、15200 组，本轮未运行；专用库名 guard 不绕过；Redis DB0 与非 Verify 前缀全链路 fixture 未运行。此轮本地回归不能替代 12 项 V1 E2E 或发布门禁。
  - `source_identity_start/end` 覆盖产品构建输入的 Git 改动摘要，脚本自身生成的本轮证据目录从比较中排除；运行中其他 Agent 写入会触发 drift。
return_to_lead:
  - Worker-B（Quota）：第二轮 `028.tap.txt` 的 `insufficient_scope` 为旧快照失败；Lead 已修 fixture 并回报单文件 1/1，通过证据须由 Lead 的实际日志绑定，Verify 此次未复跑。
  - Worker-A（System）：第二轮 `049.tap.txt` 的 `invalid_request` 为旧快照失败；A r7 正处理旧 network 字段断言，待当前修订的定向结果。
  - Lead：待 A/G/C 当前 bug 收敛后派定向复跑，主源码冻结后再开独立全扫。r5 此处停写，不以 179/2/5 或 Lead 单文件回报宣称完整 V1 通过。
