---
title: "03 Skill MCP 与 Agent 接入技术设计"
version: V1
feature_id: V1-FR-003
---
# 03 Skill MCP 与 Agent 接入：技术设计

来源：[功能主文档](01-SkillMCP与Agent接入.md)。

## 单元契约

| 函数 | 前置条件 | 返回 | 副作用 |
| --- | --- | --- | --- |
| `loadToolManifest()` | 清单已安装 | 工具目录 | 无 |
| `validateInvocation(input)` | 工具已授权 | 校验结果 | 无 |
| `runTool(invocation)` | schema 和权限通过 | 状态/结果 | 可能调用外部能力 |
| `validateMcpConfig(config)` | 用户提交新建/导入/模板配置 | 校验结果与脱敏摘要 | 无，不启动进程 |
| `connectMcpServer(serverId)` | 配置已保存且启用 | `connecting/connected/failed` | 可能启动 DGOS 连接器 |
| `previewSkillSource(source)` | 来源格式可解析 | 包/子 Skill 摘要与风险 | 只读解析，不安装 |
| `installSkillPreview(previewId)` | 用户确认且来源/权限校验通过 | 已安装清单 | 可能写入 DGOS Skill 存储 |

## MCP 配置与连接边界

MCP 配置实体与运行时连接实体分离。配置可持久化的字段包括稳定 `serverId`、展示名、连接类型、非秘密命令/地址、参数、cwd、非秘密环境变量名、启用状态和模板来源；秘密值只进入 DGOS 秘密存储，以引用或脱敏摘要关联，不进入日志、项目 JSON、审计明文或导出包。具体字段名、连接类型和秘密存储接口待 DGOS API schema 确认。

建议的连接状态机（DGOS 扩展运行时内部状态）：

```text
disabled -> stopped
enabled + saved -> connecting -> connected
connecting -> failed
connected -> failed | stopped
failed -> connecting (explicit refresh/reconnect)
```

启用状态决定是否允许连接，不能直接伪造 `connected`。工具数量只能来自连接后的发现结果；刷新重连必须使用同一 `serverId`，对并发重连做幂等去重。删除前查询任务、Agent、画布节点和 Skill 引用；存在引用时返回阻止/缺失/确认所需的结构化结果，不能静默清理。

快速配置模板只提供非秘密默认值、字段提示和凭据状态（`ready`/`needs_credentials` 等内部抽象）；模板解析不得自动执行任意安装脚本。模板具体来源、版本和安装策略待 DGOS 目录/安装服务确认。

### bundled MCP 与调用生命周期

MCP 来源分为 `bundled`、`system` 和 `external`。bundled 服务的包声明是命令、参数、工作目录和工具声明的真源，更新时刷新这些字段，但不覆盖用户秘密、启用状态和覆盖配置。只有不需要秘密且健康检查通过的服务可申请自动启动；需要 API Key、Token、Authorization 或 Cookie 的服务保持 `needs-credentials`。

工具目录以结构化 `{ sourceId, operationId }` 绑定，不接受前端任意传入的服务/工具名。注册器在发现、启用、连接和授权均通过后才返回 ready；其他情况返回 `missing`、`disabled`、`pending` 或 `denied`。普通前台调用的响应监听器随页面销毁，跨页面的取消、查询、恢复和产物提交必须走独立 Task/Run。

## Skill 数据与导入边界

Skill 包和子 Skill 使用分层身份：包记录 `packageId`、来源、版本、声明权限和包级状态；子 Skill 记录稳定 `skillId`、展示名、描述、System Prompt 摘要、启用状态和继承关系。展示名可改名，`skillId` 不因改名变化。System Prompt 和导入内容需按 DGOS 安全策略过滤秘密或危险指令，完整内容不得写入普通日志。

在线导入分为 `parse -> preview -> user_confirm -> install -> authorize -> enable` 阶段。预览结果至少包含来源、包/子 Skill 摘要、版本、声明权限、风险和潜在依赖；预览阶段不写入已安装清单。画布节点或 Agent 只能引用已安装、已启用、已授权的 `packageId/skillId`，执行时记录包/版本快照，不在节点内隐式安装或启用。

## 伪代码

```text
runTool(invocation):
  REQUIRE manifest permission is granted
  // B3-01
  validate inputSchema or RETURN Err(INPUT_INVALID)
  create stable requestId
  // B3-02
  invoke DGOS handler with timeout
  IF timeout:
    RETURN Pending(requestId)  // 不自动重复副作用
  // B3-03
  redact secrets and persist audit summary
  RETURN result

connectMcpServer(serverId):
  REQUIRE server is enabled and config is valid
  IF an active connection attempt exists: RETURN existing attempt
  persist status=connecting
  result = dgosConnector.connect(serverId, secretRef)
  IF result.failed: persist status=failed; RETURN result
  tools = dgosConnector.discoverTools(serverId)
  persist status=connected, toolCount=count(tools)
  RETURN Connected(serverId, toolCount)

previewSkillSource(source):
  parsed = trustedSourceResolver.parse(source) or RETURN Err(SOURCE_INVALID)
  preview = manifestReader.inspect(parsed)
  redact secrets and return preview without installation

installSkillPreview(previewId):
  REQUIRE explicit user confirmation
  validate source, manifest, permissions and risk
  persist package and child skills with stable ids
  RETURN Installed(packageId, skillIds)

runPersistentExtensionRun(input):
  REQUIRE input declares task kind and recovery policy
  create taskId and immutable extension/version snapshot
  persist state=queued before starting external side effect
  execute through the owning executor
  persist checkpoints, cancellation and artifact references
  RETURN taskId for query/events/resume
```

## 分支到测试追踪

| 分支 | 功能 AC | 跨功能验收 |
| --- | --- | --- |
| B3-01 | AC01 | V1-E2E-03 |
| B3-02 | AC02 | V1-E2E-03 |
| B3-03 | AC02 | V1-E2E-03 |
| B3-04 | AC03、AC05、AC06 | V1-E2E-03 |
| B3-05 | AC07 | V1-E2E-03 |

## 约束备注

不得把 API Key、MCP 环境变量秘密、System Prompt 秘密或完整敏感输入写入日志；取消和重试语义必须由具体执行器协议定义。连接状态、工具发现、Skill 预览和安装结果必须可审计但只保存脱敏摘要。上述状态机和字段为 DGOS 设计边界，待 DGOS API schema 确认后再冻结。
