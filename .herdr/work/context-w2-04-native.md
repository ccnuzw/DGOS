# Context-pack：WP-W2-04 Native Bridge 诊断

## 目标

独立定位 macOS Workbench native iframe/bridge handshake 超时，输出可复现根因、最小修复建议和下一包边界；不阻塞 Web MVP。

## 事实

- FR-001 目前“本地验证”，native r13/r14 能见窗口/iframe 资源部分加载，但 handshake、Workbench 完整 bridge/Task/Artifact/reload 链仍未通过。
- 主线策略是 Web 优先；native 属于并行副线。

## 权威规格/证据

- `docs/03-功能规格/V1/01-桌面与系统/01-桌面与应用工作区.md`
- `apps/desktop/scripts/`
- `.herdr` 中 native r13/r14 manifest（历史证据只读参考）

## 诊断问题

1. 当前最终 dist 与 iframe URL/资源是否一致？
2. API/catalog 启动顺序、origin、CSP、sandbox、postMessage target/source 是否匹配？
3. handshake 超时前后 native PID、WindowServer、WebView console/network 的真实状态是什么？
4. 清理和重试是否无残留进程/Redis/临时目录？
