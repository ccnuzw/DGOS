# WP-W3-04：统一集成验证与证据

**Owner**：worker-test + verify  
**Priority**：P0  
**Status**：立即启动  
**Estimated**：2–3 天，滚动执行

## 目标

建立 Wave 3 统一候选回归：Web 完整演示、FR-003、FR-009、FR-002 入口及 Native smoke 分层验证。

## Allowed paths

- `tests/`
- `apps/web/e2e/`
- `apps/desktop/scripts/`
- `scripts/`
- `docs/05-测试与发布/端到端验收/报告/`
- `.herdr/evidence/`

## 验收标准

- [ ] Web MVP 主链 E2E 通过并产出 manifest。
- [ ] FR-003/FR-009 关键 UI 分支有真实正反例。
- [ ] FR-002 目录/生命周期主路径有独立证据。
- [ ] Native smoke 单独报告 handshake/frame/Task/Artifact 结果。
- [ ] 每批包含 code_version、asset_sha256、环境、命令、结果、限制。
- [ ] Verify 输出独立 PASS/FAIL 和剩余阻塞，不修改业务代码。
