# WP-W2-04：Native bridge 诊断

**Owner**：worker-native  
**Priority**：P1（可立即启动，不阻塞 Web）  
**Estimated**：3–5 天

## 目标

定位并尽可能修复 Workbench native handshake/frame-present 超时；若无法在首日修复，交付精确根因与 WP-W2-05 修复输入。

## Allowed paths

- `apps/desktop/`
- `apps/desktop/scripts/`
- `apps/ai-workbench-package/`
- native 专属测试与 `.herdr/evidence/` manifest

禁止重写 Web Task 业务契约或以 mock iframe 作为成功证据。

## 验收标准

- [ ] 有当前源码/构建绑定的真实诊断批次。
- [ ] 明确 iframe load、resource、origin/CSP/sandbox、postMessage、bridge handshake 各阶段结果。
- [ ] 若修复：真实窗口完成 frame-present 与 handshake，并清理完整。
- [ ] 若未修复：记录最小根因、阻塞点、下一步代码路径和不影响 Web 的 workaround。
- [ ] 不把“可见窗口”单独升格为 Workbench 通过。

## 并行边界

完全独立于 WP-W2-01/02/06/07；只读公共 API 语义，若需要改共享契约必须先回报 Planner/Lead。
