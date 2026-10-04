# WP-W3-02：Native bridge 最小修复与复验

**Owner**：worker-native  
**Priority**：P1  
**Status**：立即启动  
**Estimated**：2–3 天

**最新证据**：`.herdr/evidence/WP-W2-04-native-bridge-candidate-2026-10-04-final.json` 状态 blocked；根因是 WKWebView provisional iframe navigation 下 Wry 0.57 对 nil `WKWebView.URL()` unwrap panic。修复候选方向为稳定 native custom protocol/resource URL，或安全处理 nil provisional URL。

## 目标

根据 Wave 2 已知根因修复 Native Workbench 启动链/bridge handshake，并取得真实 macOS 证据。

## Allowed paths

- `apps/desktop/`
- `apps/desktop/scripts/`
- `apps/desktop/src-tauri/`
- `apps/ai-workbench-package/`
- native 专属测试和 `.herdr/evidence/`

## 验收标准

- [ ] API/catalog 启动顺序和可用性有真实诊断记录。
- [ ] iframe 资源加载、origin/CSP/sandbox、postMessage 和 handshake 均有阶段性回执。
- [ ] Workbench 完成 frame-present + bridge handshake，并显示真实内容。
- [ ] Task/Artifact/reload 至少完成基础 native smoke；失败不伪造成功。
- [ ] 无残留进程、临时目录、测试 Secret；manifest 绑定当前构建。

## 并行边界

与 WP-W3-01、WP-W3-03、WP-W3-04 独立。不得改 Web 共享业务语义；需要共享契约变更时暂停并提交决策。
