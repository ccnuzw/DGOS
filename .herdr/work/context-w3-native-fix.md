# Context-pack：Native bridge 修复

## 基线

`f14a3c9` 已提交 Native bridge 根因诊断、preflight、driver、host/proxy 改动和多份诊断 manifest。最新 final manifest 仍为 **blocked**：`tauri://localhost/api/v1/apps/*/resources/*` iframe provisional navigation 在 Wry 0.57 触发 `url_from_webview` nil URL panic；未观察到 `dgos.app.ready` 或 bridge calls。建议验证 stable native custom protocol/resource URL，或对 Wry nil URL 路径做最小安全修复，再完整重建复跑。不得把 frame-present/WindowServer 可见当作 bridge 成功。

## 目标

补齐 API/catalog 启动链或宿主 handshake 所需环境，使当前 Workbench dist 在真实 macOS 窗口中完成 frame-present、bridge handshake 和内容显示。

## 约束

- Web MVP 不等待 Native。
- 必须绑定当前 dist/source hash；可见窗口不等于 Workbench 通过。
- 失败要保留 manifest 和清理结果。
