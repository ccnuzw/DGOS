# WP-W1-02：FR-005/FR-007 Provider → Task 核心链

**Owner**：Worker-AI（Worker-Web 可并行）  
**Estimated**：2–3 天  
**Priority**：P0  
**Slice**：DGOS-V1-MVP-20261003 / Wave 1

## 目标

在现有 Provider/Workbench 资产上收敛 text-only 可演示链：Provider 配置/验证 → 模型目录/默认选择 → AI Task 提交 → SSE → 终态 → Artifact/result。

## Context

见 `.herdr/work/context-week1-fr001-fr005-fr007.md`。

## Allowed paths

- `src/provider/`
- `src/provider-adapters/`
- `src/ai-task/`
- `apps/api/`
- `apps/web/`
- 相关 `tests/provider/`、`tests/integration/`、`apps/web/e2e/`

不得扩展到媒体、画布、项目或 Provider 私有 endpoint。

## 依赖

- FR-010 Session、FR-012 Secret/账号、FR-013 probe、FR-015 quota。
- WP-W1-01 完成后做 native 联调；Web/mock 可先行，但最终必须回到真实 DGOS API 语义。

## 验收标准

- [ ] Secret/Adapter 边界正确，响应、日志、APP 不泄露秘密/private endpoint。
- [ ] 仅 active、available、enabled、能力匹配模型可提交。
- [ ] 重复 requestId 返回同一 taskId，不重复调用 Provider。
- [ ] SSE 增量单调有序，断线后 cursor/query 可恢复，终态不倒退。
- [ ] 覆盖演示需要的 succeeded/failed/cancelled/timed_out 终态及 artifact/result 读取。
- [ ] quota reservation/settlement/release 与 Task 终态 exactly-once。

## 交付

- 代码/测试变更
- Web 演示或 API 执行证据
- 当前候选限制：真实外部 Provider、最终 macOS signed APP 是否纳入本批必须明确记录
