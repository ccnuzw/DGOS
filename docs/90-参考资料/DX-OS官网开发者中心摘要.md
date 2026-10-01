# DX-OS 官网开发者中心摘要

来源：`https://dx-os.com` 的开发者文档 manifest（`/v1/developer/docs/manifest?locale=zh-CN`）及已缓存文档 JSON。文档版本统一显示 `2026.09.17-3`，最低系统版本 `0.3.9`。

本地复核来源：`reference/完整开发规范.md`、`reference/DX OS Skill 开发规范.md`、`reference/DX OS MCP 开发规范.md`、`reference/Canvas Agent 开发规范.md`、`reference/无限画布插件与节点 SDK.md`。这些文件用于校对开发者中心的专门章节，不改变“DX OS 仅为研究来源、DGOS 自行定义公共契约”的边界。

| 文档 | 协议/主题 | 对 DGOS 的约束 |
| --- | --- | --- |
| APP 完整开发规范 | `dx-app/v2`、`dx-ai-task/v2` | 静态包根目录含 `dx-app.json`、`index.html`；Bridge 使用 `window.dx.invoke`；声明权限；发布用 SemVer/build/签名 |
| Canvas 插件 quickstart | `dx-canvas-nodes/v2`、`dx-canvas-templates/v1` | 节点、端口、执行器、模板和宿主映射走公开 SDK |
| Canvas Agent development | `dx-agent-tools/v1` 等 | Agent 可发现、连接、运行 Canvas 节点和工作流 |
| Skill development | `dx-app/v2` | `dependencies` 声明 Skill，`agent.tools.json` 声明 `handler.type=skill` |
| MCP development | `mcp` | MCP 运行边界、超时、账号绑定和项目文件安全读写 |

## 关键协议结论

1. APP 运行在受限 iframe，只调用注入的 `window.dx`，不能读取 `window.parent`。
2. 项目数据使用 `project.info/list/read/write/mkdir/remove`；协作使用 `collab.project.*`，更新携带 `baseVersion`。
3. 图片、视频、音频和转录使用 `ai.models.list/resolve`、`ai.task.submit/query/get/events/cancel` 和 `ai.artifact.read`；`task.*` 与 `ai.task.*` 不混用。
4. AI 输入使用标准 `inputs` 引用，APP 不拼接供应商 endpoint、Authorization、轮询地址或下载地址。
5. APP/插件清单权限是运行前提；外部链接、文件导出、网络、AI 和项目写入都要声明对应权限。
6. 发布包的 `version`、`build`、`releaseChannel`、SHA-256 和签名由宿主校验；数据版本变更要有迁移。

## APP + MCP 研究补充

开发者中心展示的 APP + MCP 包把 MCP 描述和服务代码放在应用包的受控目录中。示例包使用包内 MCP 配置描述服务，应用依赖清单将其标记为 bundled 来源，Agent 工具声明再把一个已声明的 MCP 服务和工具绑定起来。文件名和字段只属于 DX OS 研究样本，DGOS 需要使用自己的 manifest 和扩展 schema。

观察到的运行规则如下：

- 无密钥、安装后即可运行的 bundled MCP 可以申请自动启动；需要 API Key、Token、Authorization 或 Cookie 的服务不能自动启动，安装后应显示待配置。
- 安装器不运行未知安装脚本；生产依赖必须随包提供，或使用平台明确提供的运行时。
- stdio 服务由宿主 MCP Runtime 启动，不在 APP iframe 内启动；工作目录只能落在受控安装包目录。
- 更新可以刷新命令、参数和包内工作目录，但保留用户已有密钥、启用状态和用户覆盖配置。包内声明丢失时按安装损坏处理。
- 启用状态、连接状态、工具发现结果和凭据状态分开显示。未安装、未启用、未连接或未授权时，工具只能显示 pending、disabled 或 unavailable。
- APP 只能通过宿主能力代理申请已声明的 MCP 工具组合；不能直接访问内部 MCP API，也不能把任意服务器标识和工具名传给宿主。
- 前台调用依赖页面存活。页面关闭后，前端 Promise 和监听器会消失，底层调用即使继续完成也不能把结果标成已交付；持久任务需要独立的任务协议。
- MCP 不自动获得用户身份、登录 Cookie、项目根目录或真实磁盘路径。APP 先读取最小项目字段，调用 MCP 后再以项目能力写回结果。大文件使用 Artifact/文件引用，不放进工具参数或文本结果。

## Canvas Agent 与 Skill 研究补充

Canvas Agent 使用系统 Agent Runtime、节点适配器和统一执行器。节点声明语义角色、能力版本、参数和可接受的画布输入，宿主负责注册、渲染状态和运行快照。手动运行与 Agent 运行进入同一个执行器；缺失或停用依赖显示为可恢复的状态，不通过注入页面组件解决。

Skill 需要包级和子 Skill 级身份，声明权限、风险、输入 schema 和副作用。在线来源必须先预览包、子 Skill、版本和权限，再确认安装和授权；稳定调用 ID 与展示名分离，斜杠调用不能绕过权限服务。上述结论用于 DGOS 的边界设计，不表示 DGOS 兼容 DX OS 的协议或字段。

## 本地规范复核后的 DGOS 转译

- 普通应用采用静态入口和宿主托管能力；MCP 等服务代码不能在应用页面内自行启动。
- 应用隔离、外链、导出、网络、项目读写和实时通信必须通过 DGOS 能力代理，具体容器实现留待 DGOS ADR。
- 特权应用需要管理员安装和精确白名单，普通应用不能通过改名或改 ID 获得系统能力。
- AI 运行必须经过目标目录和动态参数握手；宿主任务 ID、供应商任务 ID 和 requestId 分开。
- 协作房间的创建/加入/离开/关闭和成员状态要独立建模，属于后续协作版本。
- Canvas 节点声明、Agent 动作和统一执行器要同一份能力快照，第三方节点不能注入主画布 UI。
