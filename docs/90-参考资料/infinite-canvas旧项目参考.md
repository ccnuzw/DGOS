# infinite-canvas-ccnuzw 旧项目参考

来源：`/Users/apple/Progame/infinite-canvas-ccnuzw`。README 明确说明该项目已停更，新版本前往 DX-OS.com；因此本文件只提取历史能力和可复用交互，不把其实现当作 DGOS V1 架构。

## 已确认能力

- Python/FastAPI 本地服务 + `static/` 多页面；包含 `canvas.html`、`smart-canvas.html`、`asset-manager.html`、`comfyui-settings.html`、`gpt-chat.html` 等。
- 支持 OpenAI/异步/Gemini/方舟协议、RunningHub、ModelScope、即梦 CLI、本地 ComfyUI 和工作流 JSON。
- 画布支持图片/文本/视频、节点连线、批量生成、图片增强、视频帧抽取、360 全景、循环节点和素材库。
- README 宣称支持 Agent、一键分层、多人协同、共享画布、APP 下载、账号和 APP 权限系统；这些是旧项目或迁移方向，需以 DGOS 自有规格为准，视频和 DX OS 外部资料只提供研究证据。

## 对 DGOS 的参考价值

| 参考点 | 旧项目证据 | V1 处理 |
| --- | --- | --- |
| 画布节点工作流 | `static/canvas.html`、`static/smart-canvas.html` | 作为交互参考，重新按 `dx-canvas-nodes/v2` 设计 |
| ComfyUI 工作流 | `workflows/*.json`、`static/comfyui-settings.html` | 作为外部执行器适配场景，不直接沿用旧 API |
| 素材与项目 | `data/asset_library.json`、`static/asset-manager.html` | V2 及后续使用 DGOS 自有项目 API 和产物引用；旧项目的 `project.*` 仅作为观察样本，不进入 DGOS 公共契约 |
| 本地服务 | `main.py`、`API/` | 不作为 DGOS V1 系统架构；仅作离线开发参考 |

## 明确不继承

- 不继承旧项目的本地服务路由、浏览器存储方案、API Key 直连、供应商私有轮询和旧 `/api/canvas/*` 语义。
- 不因 README 宣称的多人协作或 APP 权限就视为 V1 已实现；这些能力必须分别映射到 DGOS 自有协作 API（待后续版本冻结）、manifest 和权限验收。
