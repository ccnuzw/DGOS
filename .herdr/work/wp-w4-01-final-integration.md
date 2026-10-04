# WP-W4-01：V1 最终集成验证

**Owner**：worker-test + verify  
**Priority**：P0  
**Status**：completed（2026-10-04；当前工作树最终集成批）
**Estimated**：2–3 天

## 目标

建立一个可审计的最终候选验证批，确认 V1 MVP 是否达到“可演示”，并明确哪些 FR 仍为本地验证/阻塞。

## Allowed paths

- `tests/`
- `apps/web/e2e/`
- `apps/desktop/scripts/`
- `scripts/`
- `.herdr/evidence/`
- `docs/05-测试与发布/端到端验收/报告/`

禁止通过修改产品代码绕过失败；发现缺陷转回对应 Worker。

## 验收标准

- [ ] Web：登录→Provider→模型→Task→SSE→Artifact→刷新/断线恢复真实通过。
- [ ] FR-002：目录、安装/更新/卸载、不可卸载拒绝、健康失败回滚有证据。
- [ ] FR-003：skill.read 授权、MCP凭据/连接、Run恢复关键分支有证据。
- [ ] FR-009：动作发现、计划、确认、拒绝、取消/恢复有证据。
- [ ] FR-001：Web一致性和 Native handshake/frame/Workbench smoke 分开报告。
- [ ] 秘密扫描、权限拒绝、重复提交、无副作用和清理检查通过或明确阻塞。
- [ ] Verify 输出最终 PASS/FAIL、阻塞项和是否满足 MVP，不宣布超出证据范围的 FR 完成。

## 依赖

- W3-01/W3-03 代码完成记录
- W3-02 Native 修复结果
- W3-04 集成验证批次
- WP-W2-01 Provider fixture/server 环境

## 实际结果（2026-10-04）

- Manifest：`.herdr/evidence/w4-final-runs/w4-final-20261004075157-46148/manifest.json`
- 结果：`PASS`，`source_drift=false`，`mvp_demo_ready=true`
- Web、FR-002、FR-003、FR-009、Native、migration/docs/secret 全部 `PASS`。
- 限制：local Provider fixture、debug/loopback Native、无正式签名/公证/目标部署证据；不等价于正式 Release。
