# WP-W1-03：统一候选回归与证据收敛

**Owner**：Worker-Test/Worker-DevOps；Verify 独立执行  
**Estimated**：3–5 天滚动执行  
**Priority**：P0

## 目标

为 WP-W1-01/W1-02 建立单一可复现运行批次，避免不同源码、dist、数据库或历史报告拼接成候选“通过”。

## Allowed paths

- `tests/`
- `scripts/`
- `docs/05-测试与发布/端到端验收/报告/`
- `.herdr/evidence/`

不修改产品业务语义；测试夹具变化必须写明边界。

## 依赖

随 WP-W1-01/W1-02 每个可验证增量立即运行，不等待整周。

## 验收标准

- [ ] 每批 manifest 有 code_version、asset_sha256、环境、命令、结果、limitations。
- [ ] Web text-only 与 native Workbench 分开报告，不互相替代。
- [ ] `check-docs`、类型检查、目标单元/集成测试实际执行并保存输出。
- [ ] 失败批次保留，不能覆盖旧失败或升格局部证据。
- [ ] Verify 输出独立 PASS/FAIL、阻塞项和下一步。
