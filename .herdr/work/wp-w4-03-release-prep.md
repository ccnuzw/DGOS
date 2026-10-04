# WP-W4-03：V1 发布准备

**Owner**：worker-devops + verify  
**Priority**：P1（发布门禁阻塞项）  
**Status**：立即盘点，门禁执行等待最终候选  
**Estimated**：2 天

## 目标

准备 V1 MVP 的发布/Tech Preview 门禁：制品、迁移、配置、回滚、恢复、安全和审批证据齐全；未达成时明确 Blocked 原因。

## Allowed paths

- `scripts/`
- `deployment/`
- `docker/`
- `apps/desktop/` 构建脚本
- `docs/05-测试与发布/发布/`
- `.herdr/evidence/`

禁止提交真实密钥；不得把本地 mock、旧镜像或无审批报告写成发布通过。

## 验收标准

- [ ] 生成最终 Web/native 制品并绑定 commit、hash、版本和依赖。
- [ ] migration dry-run/upgrade/rollback 或明确环境限制均有证据。
- [ ] fresh image 安全扫描、配置检查、Secret/日志扫描有结果。
- [ ] 回滚和恢复步骤在批准环境可执行，或标记阻塞并列出补偿方案。
- [ ] 发布检查清单、审批、责任人、时间和限制完整。
- [ ] 若仍缺 Developer ID/公证、真实目标环境或性能批准，最终状态明确为 Pending/Blocked。
