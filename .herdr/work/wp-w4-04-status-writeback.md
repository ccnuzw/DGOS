# WP-W4-04：最终状态与追踪回写

**Owner**：planner  
**Priority**：P0（与最终 Verify 同步）  
**Status**：阻塞：当前未发现 WP-W4-01 最终候选证据；禁止正式回写 FR 完成状态

## 目标

将最终候选的真实结果回写 `V1-实现状态.md`、需求追踪、E2E矩阵和发布报告，保持规格/实现/交付状态分离。

## Allowed paths

- `docs/02-产品与版本/当前版本/V1-实现状态.md`
- `docs/03-功能规格/V1/00-V1需求追踪矩阵.md`（仅追踪关系变化）
- `docs/05-测试与发布/端到端验收/报告/`
- `.herdr/status/`

## 验收标准

- [ ] 每个状态变化有日期、环境、代码版本、命令、结果、证据和限制。
- [ ] W3 任务完成不自动等于 FR 完成；未通过项保留真实状态。
- [ ] Web/Native/外部 Provider/发布门禁边界明确。
- [ ] 不覆盖历史证据；新增批次追加并绑定 manifest。

## 当前门禁检查（2026-10-04）

- `.herdr/evidence/` 未发现 `WP-W4-01` manifest 或 Verify 最终报告。
- 现有最新集成批次属于 `WP-W3-04`，run `w3-20261003180728-89569`：source drift=true、Web 组 FAIL、FR-002 API/Task 组 PASS、Native smoke PASS，但不证明 Native Workbench bridge/Task/Artifact，也不满足 W4-01。
- `WP-W3-02-native-bridge-fix-2026-10-04.json` 为 `partial`：iframe load 0、`dgos.app.ready` 0、bridge calls 0；不能将 FR-001 升格。
- 因此本任务当前只完成“证据盘点/回写准备”，不修改 `V1-实现状态.md` 的完成度结论。

## 缺口评估关联

完整评估已写入 `docs/02-产品与版本/当前版本/V1-真实缺口评估-2026-10-04.md`。该报告依据 d65ed78 与 W4-01 manifest，结论为正式 V1 发布阻塞；本文件仍保持“不得将局部证据升格为 FR 完成”的门禁。
