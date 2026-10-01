---
title: "Provider 官方协议调研"
updated: 2026-09-26
status: "research"
---
# Provider 官方协议调研

本文只记录官方文档可确认的协议事实和 DGOS 的接入结论，不把“能调用某个模型”写成“已经实现”。具体实现状态仍以 `V1-实现状态.md` 和 E2E 证据为准。

## 结论摘要

DGOS 应该一次性冻结统一的 `ProviderAdapter`、`ModelCatalog`、能力分类、流式事件和错误映射边界，但不应该为每一家供应商复制一套前端配置和任务 API。Provider 支持分三层：

1. **通用兼容协议**：`openai-compatible`。适用于能提供 OpenAI 风格 `/models`、chat/completions 或等价媒体接口的服务。Grok、DeepSeek、通义百炼，以及部分智谱、Moonshot、火山方舟、MiniMax 部署形态可先通过此层接入；每个预设仍需单独验证模型目录和能力映射。
2. **原生模型协议**：Anthropic Messages、Gemini native 等。需要独立 adapter，因为工具调用、内容块、多模态输入、缓存、思考输出、异步媒体任务或模型目录语义不能保证与 OpenAI 兼容层完全一致。
3. **本地 Agent/CLI 集成**：Claude Code 等。它们不是普通 Provider；需要命令启动、终端/文件权限、工作目录、进程生命周期、输出采集和审计，进入 `Agent/MCP/Skill` 扩展边界。

OpenAI Docs 对 DGOS 适配器设计还有三点直接约束：模型目录、模型能力和任务接口必须分开；Responses API 的 HTTP 流式传输是 SSE 事件流；工具调用和远程 MCP 是按模型/集成声明的可选能力，不能从“支持文本生成”自动推断。DGOS 因此只把这些事实映射到统一 descriptor 和 AI Task 事件，不把 OpenAI 的具体事件名暴露给应用。

## OpenAI 官方文档核对

| OpenAI Docs 页面 | 可确认事实 | DGOS 设计影响 |
| --- | --- | --- |
| [Models](https://developers.openai.com/api/docs/models) | OpenAI 将模型作为独立目录资源；模型页面展示可用模型及其用途/能力信息 | `ModelCatalog` 必须是 Provider 验证后的独立快照；模型 ID、显示名、输入/输出模态和限制进入 descriptor，不能由供应商名称或 UI 文案推断 |
| [Streaming API responses](https://developers.openai.com/api/docs/guides/streaming-responses) | Responses API 支持 `stream=true`，HTTP 传输使用 SSE；官方示例处理 `response.output_text.delta`、`response.completed` 和 `error` | `ProviderAdapter` 需要把供应商增量事件映射为 DGOS `text.delta`、`task.completed`、`task.failed`；客户端断线恢复和最终状态仍使用 DGOS task 查询，不依赖某一家事件名 |
| [Using tools](https://developers.openai.com/api/docs/guides/tools) | 工具入口包括内置工具、函数调用、工具搜索和远程 MCP；工具可用性取决于模型和具体集成；严格 schema 可用于函数参数 | `ProviderCapabilityDescriptor` 增加可选 `tools` 能力组；V1 只冻结声明、权限和审计边界，MCP 连接管理仍由 DGOS 官方 MCP 应用负责，Provider 不得绕过 DGOS 工具授权 |

OpenAI Docs 的模型目录和工具页面没有证明所有模型都支持图像、视频、音频、函数调用或 MCP。DGOS 必须以实际模型 descriptor、适配器 contract test 和用户启用策略共同决定任务入口；仅完成 `/models` 拉取不等于模型已经可以执行某类任务。

## 官方资料与接入判断

| 产品/服务 | 官方资料 | 官方接口事实 | DGOS 接入建议 |
| --- | --- | --- | --- |
| Anthropic Claude API | [Messages API](https://docs.anthropic.com/en/api/messages)、[Models API](https://docs.anthropic.com/en/api/models-list) | 原生 Messages API；消息是内容块；支持流式事件；模型列表和能力由 Anthropic API 返回 | 增加 `anthropic-messages` adapter；复用 DGOS AI Task/Model 契约，不把 Anthropic 内容块暴露给前端 |
| Claude Code | [Claude Code overview](https://docs.anthropic.com/en/docs/claude-code/overview) | 本地编码 Agent/CLI，涉及终端、文件、项目上下文和权限确认 | 作为 `AgentRuntime`/官方应用集成；不作为 Provider 模型协议，不在 V1 Provider 配置页伪装成 API 模型 |
| Google Gemini | [OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai)、[Models API](https://ai.google.dev/api/models) | 提供 OpenAI 兼容的基础调用方式，同时保留 Gemini 原生 API；模型目录和多模态能力由 Google API 定义 | V1 先支持 OpenAI 兼容入口；将 `gemini-native` 作为同一 ProviderAdapterRegistry 的独立适配器，补齐原生能力后再开放高级参数 |
| xAI Grok | [xAI API overview](https://docs.x.ai/docs/overview)、[OpenAI compatibility](https://docs.x.ai/docs/guides/openai-compatibility) | 提供 OpenAI 兼容调用；模型和能力以 xAI 官方目录为准 | 先作为 `openai-compatible` Provider preset；只有兼容层无法表达的能力才增加 `xai-native` |
| DeepSeek | [DeepSeek API docs](https://api-docs.deepseek.com/) | 官方文档明确说明 API 兼容 OpenAI/Anthropic 格式；模型和推理模式有供应商特定字段 | 先支持 `openai-compatible` preset；将 reasoning、上下文和模型别名作为 descriptor/outputSpec 扩展，不改公共任务契约 |
| 阿里云百炼/通义千问 | [OpenAI 兼容调用](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope) | 提供 OpenAI 兼容 Chat/模型调用；区域、Base URL、模型名和多模态接口按百炼文档区分 | 先支持 `openai-compatible` preset；按区域和能力 descriptor 维护模型目录，不把“通义”写死在前端 |
| 智谱 GLM | [BigModel API 文档](https://docs.bigmodel.cn/) | 提供 HTTP/SDK 模型调用，部分能力遵循 OpenAI 风格，模型和多模态能力由智谱目录定义 | 先做兼容性探测；只有通过 contract test 的模型才进入可选目录，不能仅凭供应商名称标记能力 |
| Moonshot/Kimi | [Moonshot API 文档](https://platform.moonshot.cn/docs) | 提供 Chat/模型接口，常见调用方式兼容 OpenAI 风格，模型上下文和文件能力有自身限制 | 先支持 `openai-compatible` preset；模型上下文限制进入 `limits` |
| 火山方舟/豆包 | [火山方舟文档](https://www.volcengine.com/docs/82379) | 提供 OpenAI 兼容模型调用，同时有供应商自己的模型、Endpoint 和多模态能力配置 | 先支持兼容协议 preset；Endpoint、区域和模型部署状态由 Provider 配置与目录保存 |
| MiniMax | [MiniMax 开放平台文档](https://platform.minimaxi.com/document) | 文本、语音、视频等能力可能使用不同接口和模型目录 | 文本先走兼容协议；语音/视频只有 adapter descriptor 验证后才进入对应能力入口 |

## 版本建议

### V1 首发必须具备

- 通用 `openai-compatible` adapter：Base URL、API Key、模型拉取、SSE 文本流、能力分类、启用/停用、默认模型。
- Provider preset 机制：预置服务只提供默认 Base URL、协议提示、模型目录策略和文档链接，不改变公共 API。
- 首批兼容性回归：OpenAI、xAI Grok、DeepSeek、通义百炼至少各有一个受控模型夹具；国产厂商的图片/视频能力必须逐模型验证，不能从文本模型自动推断。
- 原生协议适配器接口已经冻结，允许 V1 后续小版本接入 Anthropic Messages 和 Gemini native。

### V1.1 / Provider Pack

- `anthropic-messages`：Claude API、内容块转换、工具调用映射、流式事件和模型目录。
- `gemini-native`：原生内容块、多模态输入、工具声明和模型能力映射。
- 兼容协议厂商预设：Grok、DeepSeek、通义、智谱、Moonshot、火山方舟、MiniMax；每个预设必须通过独立 contract test。

### V2 及以后

- Claude Code 官方 Agent 应用：本地 CLI、项目目录、终端命令、权限询问、进程取消、输出 artifact 和审计。
- Gemini/Anthropic 的高级缓存、思考输出、批量任务、长任务和供应商专用媒体能力。
- 不同供应商的图像/视频/音频异步任务 adapter；只有 descriptor 声明并通过真实夹具验证的模型才出现在对应任务入口。

## 不冻结的事项

- 不把 Claude Code、Gemini CLI、Grok CLI 等 CLI 产品当作普通 API Provider。
- 不承诺所有供应商的所有模型都支持生图、生视频、工具调用或流式输出。
- 不在前端维护供应商名称判断；模型是否可用只由 Provider descriptor、ModelCatalog 和用户策略共同决定。
- 不因增加一个 Provider 而复制一套 `AI Task`、权限、秘密或错误状态机。

### OpenAI 接入备注

- V1 的 `openai-compatible` 适配器同时保留 `responses` 与 `chat-completions` 两种 operation profile 的扩展位；实际服务由 descriptor/探测结果声明，不能假设所有兼容服务都实现 Responses API。
- OpenAI Responses 的事件名只在适配器内部使用。DGOS 公共事件保持 `task.accepted`、`text.delta`、`task.progress`、`task.completed`、`task.failed`、`task.cancelled` 和 `stream.reset`。
- OpenAI 的函数调用、工具搜索和远程 MCP 不自动成为 V1 线性 AI 任务的必选能力；只有 descriptor 声明、权限授予、工具 schema 校验和 contract test 全部通过时，才可在后续 Agent/画布任务中启用。
