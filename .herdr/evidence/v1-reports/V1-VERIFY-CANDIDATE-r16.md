# V1-VERIFY-CANDIDATE r16

- `status`: `partial`
- `scope`: 独立 tooling/coverage extraction；未执行完整候选，等待 Lead 冻结 bindings。
- `workspace`: `/Users/apple/Progame/DGOS`
- `evidence_level`: local tooling

本轮只修改授权路径：`scripts/v1-regression-sweep.mjs`、`scripts/v1-candidate-run.mjs`、`tests/tooling/v1-acceptance-tooling.test.mjs` 和本报告。未修改产品 `src/`、`apps/`、`migrations/`、V1 实现状态或 docs-evidence 审批。

## 实际命令

```text
node --test tests/tooling/v1-acceptance-tooling.test.mjs tests/tooling/verify-release.test.mjs
exit 0
26 tests, 26 pass, 0 fail, 0 skipped

node --check scripts/v1-regression-sweep.mjs scripts/v1-candidate-run.mjs
exit 0

git diff --check -- scripts/v1-regression-sweep.mjs scripts/v1-candidate-run.mjs tests/tooling/v1-acceptance-tooling.test.mjs
exit 0
```

只读 registry 摘要命令 exit 0，实际发现：

```json
{
  "counts": { "AC": 62, "E2E": 12, "NFR": 7, "RG": 3 },
  "count_issues": [],
  "uncovered": { "AC": 62, "E2E": 12, "NFR": 7, "RG": 3 }
}
```

AC 从 V1 功能规格树的 `#### ACnn` 真实标题提取；E2E 从端到端用例矩阵真实行提取；NFR/RG 从稳定需求编号表提取。四类 registry 均达到目标计数，未从源码标题推断执行证据。

## Tooling 变更

- `requirementRegistry()` 建立四类稳定 ID registry，并报告目标计数与实际计数差异。
- `summarizeRequirementCoverage()` 对每个 ID 输出 `passed / failed / skipped / uncovered`；无证据默认 `uncovered`。
- 候选 plan 携带 registry；candidate summary 输出 `requirement_coverage`、`uncovered_branches` 和现有 E2E coverage。
- 保留 r15 的真实输出解析、证据路径、source identity、source drift、运行资产和 group binding 校验。
- 测试增加 registry 计数、状态优先级和缺证据默认 uncovered 断言。

## 分类结果

在没有候选 group manifest 的前提下，四类全部是 `uncovered`：

- AC：62 uncovered。
- E2E：12 uncovered。
- NFR：7 uncovered。
- RG：3 uncovered。

这只是 tooling 分类结果，不是功能状态回写，也不构成候选通过。

## 未覆盖与阻塞

- Lead 尚未冻结 bindings，因此未执行完整 candidate groups、browser、native、image 或 release gate。
- native GUI / 双宿主证据仍由 F 负责；E2E-01 和涉及 native 的 E2E-10 保持 incomplete。
- 任何已有 owner manifest 未在本轮同一 source/build/runtime identity 下重跑，不能自动并入候选。
- registry 计数已与目标一致；候选覆盖仍须等待 Lead 冻结 bindings 后，以真实回执判定。
- browser `case_passed`、assistant ask/allow、MCP first-install/connect/invoke、System context 等历史回执未绑定到本轮冻结候选，不能单凭同名测试或源码标题计入本轮覆盖。
- native GUI 与完整双宿主 E2E 没有本轮可执行证据，保持 `incomplete`/`uncovered`。

## Manifest、source identity 与限制

本轮没有生成候选 group manifest，因为执行完整候选被工作包明确禁止。工具仍保留每组 manifest 所需字段：`source_identity_start/end`、`source_drift`、`asset_sha256`、`log_sha256`、runtime bindings、cleanup、limitations 和 uncovered 列表。

`sourceIdentity` 继续只排除当前精确 evidence 输出路径；HEAD 或历史报告不能替代当前 dirty tree hash。旧 manifest 仅作为历史输入，不能改标为当前通过。

## 停止写入确认

Verify 已完成 r16 授权范围内的 tooling/test/report 写入，现停止所有脚本、测试和报告写入。Lead 可独立复验，冻结 bindings 后再运行 candidate groups。

回报字段：

```yaml
status: partial
scope:
  - V1-VERIFY-CANDIDATE-r16
checks:
  - command: node --test --test-reporter=tap tests/tooling/v1-acceptance-tooling.test.mjs tests/tooling/verify-release.test.mjs
    result: 26 passed, 0 failed, 0 skipped, exit 0
  - command: node --check scripts/v1-regression-sweep.mjs
    result: exit 0
  - command: node --check scripts/v1-candidate-run.mjs
    result: exit 0
  - command: git diff --check -- scripts/v1-regression-sweep.mjs scripts/v1-candidate-run.mjs tests/tooling/v1-acceptance-tooling.test.mjs
    result: exit 0
evidence_level: local
verified:
  - real coverage extraction and four-category requirement classification
  - source identity and candidate group binding logic remains strict
  - missing evidence defaults to uncovered
limitations:
  - no frozen bindings
  - no full candidate execution
  - native and release evidence absent
return_to_lead:
  - independently rerun tooling
  - review the exact 62/12/7/3 registry and evidence receipts
  - freeze bindings, then run candidate groups
```
