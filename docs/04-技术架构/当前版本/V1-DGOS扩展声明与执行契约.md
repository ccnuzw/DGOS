# V1 DGOS 扩展声明与执行契约

> 状态：设计基线，服务于 V1 平台和 V2-V5 扩展规划。本文使用 DGOS 自有概念，不承诺兼容任何外部平台字段。

## 1. 目标

为 App、Skill、MCP、Agent Tool 和 Canvas Node 提供统一的声明、注册、授权、执行和审计边界。扩展可以由一个应用包提供，也可以独立安装；用户看到的是可发现能力，系统保存的是相互独立的身份、版本和生命周期状态。

## 2. 扩展矩阵

| 类型 | 稳定身份 | 来源 | 声明重点 | 执行器 | 版本归属 |
| --- | --- | --- | --- | --- | --- |
| App | `appId` | system/registry/local | 入口、窗口、权限、依赖、数据版本 | App Runtime | V1 |
| Skill | `skillId` + `packageId` | bundled/registry/local | 输入 schema、权限、风险、副作用、提示资源 | Skill Executor | V1 |
| MCP | `sourceId` | bundled/system/external | 连接方式、凭据需求、工具发现和健康检查 | MCP Runtime | V1 |
| Agent Tool | `operationId` | App/Skill/MCP/Node | 输入输出、动作风险、引用目标 | Agent Executor | V1 基础 |
| Canvas Node | `nodeType` + `nodeVersion` | system/plugin/app | 端口、语义角色、能力版本、执行适配器 | Canvas Executor | V2-V5 |

身份不可由展示名替代。改名、升级、停用和重新安装不能无提示地改变稳定身份。

## 3. 注册流程

```text
discover -> inspect -> validate -> install/stage -> register
         -> permission decision -> enable -> health check -> ready
```

任何阶段失败都保留结构化原因，并且不创建“看起来已就绪”的注册记录。在线 Skill 先停在 `preview`，MCP 先停在配置/凭据校验，Canvas Node 先停在协议和端口校验。

注册表保存声明快照；运行时状态单独保存。应用更新刷新声明快照和代码指针，但保留用户秘密、授权决策和可迁移的用户设置。

## 4. 统一状态模型

### 4.1 安装与启用状态

`discovered -> staged -> installed -> enabled -> disabled -> removed`。

`installed` 不代表 `enabled`，`enabled` 不代表 `ready`。移除前检查引用，已有项目和 Agent 以 `missing` 或 `disabled` 状态继续可打开。

### 4.2 运行状态

通用运行状态为 `idle`、`pending`、`running`、`ready`、`error`、`cancelled`、`denied`、`missing`。扩展可提供更细的内部状态，但对宿主和 UI 必须映射到上述集合。

MCP 额外区分 `configured`、`needs-credentials`、`connecting`、`connected`、`stopped` 和 `failed`。启用开关不直接改变连接结果；重复连接请求必须合并为同一个 attempt。

Canvas Node 额外记录 `input-valid`、`output-ready` 和 `runId`，不能把上一次结果当成当前运行成功。

## 5. 三层 Agent/Canvas 边界

1. **声明层**：扩展提供身份、版本、输入输出、权限、风险和副作用。
2. **适配层**：Agent Tool 或 Canvas Node 把声明映射到 Skill、MCP、任务或 Artifact，不暴露 DGOS Runtime 内部 API。
3. **执行层**：统一 executor 负责授权、输入校验、幂等、超时、取消、结果校验、状态和审计。

手动运行和 Agent 运行必须调用同一个执行层。Agent 只能从已注册且已授权的动作目录选择目标，不能在提示词里拼接任意 `sourceId`、工具名、项目路径或秘密。

### 5.1 Canvas Node 声明最小集合

希望被 Canvas Agent 发现或操作的节点，必须随节点声明提供稳定的 `nodeType`、节点版本、`capabilityVersion`、`semanticRoles`、输入/输出端口、参数 schema、可接受的画布输入、动作清单和执行器绑定。`run`、`read`、`configure` 等动作只能访问声明字段；每个动作必须有真实处理器并落到已声明端口。

宿主统一负责节点卡片、端口、运行状态、取消、缺失占位和恢复。第三方扩展不能向主画布注入框架组件或样式。节点的手动操作和 Agent 操作必须共享同一个执行器，因此权限、幂等、超时、取消、结果校验和审计语义一致。

## 6. MCP 与 Skill 引用规则

- MCP 服务定义和运行连接分开保存；秘密只保存为秘密引用，普通配置只保存非敏感字段。
- Agent Tool 使用结构化 `{ sourceId, operationId }` 绑定 MCP 操作；绑定目标不在运行时由用户输入替换。
- Skill 以 `{ packageId, skillId, version }` 快照引用；展示名、翻译文本和 System Prompt 摘要不作为稳定身份。
- 任何引用必须声明在所属 App/Agent/Canvas 扩展的依赖清单中，且安装、启用、授权和健康检查全部通过。
- 引用缺失时保留配置和原始版本快照，禁止静默降级为同名新扩展。

## 7. 项目与 Artifact 数据流

扩展不能直接读取项目目录。App 先读取最小字段或 Artifact 引用，Runtime 执行脱敏和大小检查，扩展返回后由 App 校验 schema 和来源，再带并发条件写回。秘密、Cookie、绝对路径、临时下载 URL 和供应商任务 ID不得进入项目结构。

跨页面的执行使用 `Task/Run` 实体：任务状态、取消、查询、恢复和产物引用独立于窗口生命周期。普通前台调用只返回当前页面仍可接收的结果，不得在页面关闭后补写“已交付”。

## 8. 审计最小字段

每次安装、授权、启用、连接、调用、取消、失败和移除至少记录：`eventId`、扩展稳定身份、版本快照、调用者 App/Agent、授权决策、时间、状态转换、错误分类和脱敏输入摘要。禁止记录 API Key、Authorization、Cookie、System Prompt 全文和项目绝对路径。

## 9. 版本边界

- V1：App Runtime、Skill/MCP 基础管理、声明注册、权限、连接状态、工具目录和审计。
- V2：项目作用域、Artifact 引用、Canvas 基础和缺失节点恢复。
- V3：统一 Canvas Executor、工作流运行、Agent 驱动画布动作。
- V4：结构化资产、多维表格、Canvas Agent Workspace 和供应商节点。
- V5：第三方 Canvas Plugin SDK、模板、3D 导演台和更完整的扩展市场。

## 10. 待冻结

最终 manifest JSON Schema、签名和信任链、权限枚举、MCP 连接协议、Task/Run 传输、Canvas Node 端口 schema、跨版本迁移和桌面/Web 能力差异仍需单独 ADR 与实现证据。
