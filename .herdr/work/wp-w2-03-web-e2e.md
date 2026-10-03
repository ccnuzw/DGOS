# WP-W2-03：Web 主链 E2E 与证据

**Owner**：worker-test  
**Priority**：P0  
**Status**：可立即启动（与 W2-01/W2-02 并行）  
**Estimated**：2 天

## 目标

为 Web MVP 建立真实 API/Worker/PG/Redis 条件下的主链 E2E 和可审计证据。

## Allowed paths

- `tests/integration/`
- `tests/provider/`
- `apps/web/e2e/`
- `scripts/`（仅测试 runner/fixture）
- `tests/**/evidence/`

不得修改产品实现；fixture 变化必须标注与真实外部依赖的差异。

## 依赖

- 测试设计、fixture 和失败断言立即开始。
- 真实主链执行依赖 WP-W2-01 暴露稳定的持久化 Task/SSE/Artifact 入口。

## 验收标准

- [ ] 登录→Provider→模型→Task→SSE→Artifact 主流程真实执行。
- [ ] 重复提交、断线恢复、取消、Provider 失败和未知提交有无副作用断言。
- [ ] 运行 manifest 绑定源码、dist、migration、环境和命令。
- [ ] 失败批次保留；mock、fixture、真实依赖分层报告。

## 并行边界

与 W2-02 并行；可先写测试和夹具。不得将测试临时绕过写入 Worker-AI 或 Web 生产代码。
