# V1 DGOS 应用清单与运行时契约

> 状态：设计基线，待 ADR 和字段级 schema 冻结。本文定义 DGOS 应用平台的公共语义，不代表当前仓库已经有对应实现。

## 1. 目标与范围

本文为 DGOS 独立系统定义应用包、manifest、信任级别、运行时上下文、权限、数据边界、安装生命周期和 SDK 能力边界。应用商店、文件/文件夹、天气、对话智能体、Skill 管理、MCP 管理和无限画布都可以作为遵守本契约的应用。V1 的 Skill 管理与 MCP 管理以默认安装的官方应用交付，应用自身通过 DGOS API 管理扩展；设置页不替代这两个应用。

本文不定义具体前端框架、桌面容器、IPC 实现、HTTP 路径或签名算法；这些属于后续 ADR。DX OS 的清单和 Bridge 只作为研究来源，不是 DGOS 的兼容协议。

## 2. 应用包结构

V1 应用包是可校验、可安装、可回滚的归档。包根目录至少包含 manifest 指定的入口文件和资源；运行时数据不能写回安装包目录。

```text
example.dgosapp/
  dgos-app.json
  entries/
    main.html
  assets/
  agent/                 # 仅声明 agent 能力时存在
  skills/                # 仅声明 bundled skill 时存在
  mcp/                   # 仅声明 bundled MCP 描述时存在
  migrations/            # dataVersion 迁移脚本或声明
```

包校验必须确认：manifest 可解析、`appId`/版本合法、入口和资源存在、声明的依赖可解析、权限和能力白名单格式正确、包内容未超出允许路径、签名/来源校验（启用时）通过。未知安装脚本不得在校验或安装阶段自动执行。

## 3. Manifest 设计基线

以下示例是 DGOS 自有字段草案。字段名在 ADR 冻结前可以调整，但语义不能被省略或改成隐式约定。

```json
{
  "format": "dgos-app/v1",
  "appId": "com.example.writer",
  "version": "1.0.0",
  "build": 12,
  "releaseChannel": "stable",
  "minRuntimeVersion": "0.1.0",
  "dataVersion": 1,
  "name": { "zh-CN": "示例应用", "en-US": "Example App" },
  "description": { "zh-CN": "应用说明", "en-US": "Application description" },
  "category": "creative",
  "trustLevel": "standard",
  "entrypoints": {
    "main": "entries/main.html"
  },
  "defaultWindow": {
    "width": 960,
    "height": 720,
    "minWidth": 640,
    "minHeight": 480,
    "resizable": true,
    "maximizable": true
  },
  "backgroundPolicy": "release",
  "icon": "assets/icon.png",
  "permissions": ["system.context.read", "project.read"],
  "capabilityAllowlist": ["dgos.system.context.read", "dgos.project.read"],
  "dependencies": {
    "apps": [],
    "skills": [],
    "mcp": []
  },
  "actions": [],
  "agent": null,
  "dataMigration": {
    "from": [0],
    "entry": "migrations/1.js"
  }
}
```

### 3.1 字段语义

| 字段 | 必填 | 语义与约束 |
| --- | --- | --- |
| `format` | 是 | DGOS manifest 格式版本；不接受 DX OS 格式名 |
| `appId` | 是 | 全局稳定应用身份；发布后不可因改名而复用 |
| `version` | 是 | SemVer 兼容版本；同一渠道不得覆盖已发布版本 |
| `build` | 是 | 同一 `version` 内单调递增的不可覆盖构建号 |
| `releaseChannel` | 是 | `stable`、`beta` 或待冻结的开发渠道；必须与发布目标一致 |
| 目录准入语义（示例字段 `catalogApprovalState`，名称/类型 Draft） | 是，语义必需 | 普通用户目录仅展示 DGOS 官方发行或管理员批准版本；待审核/拒绝/撤回版本不可安装 |
| 预装卸载策略语义（示例字段 `uninstallPolicy`，名称/类型 Draft） | 预装包必需 | 区分可卸载与受保护预装；策略由发行方/管理员控制，应用不能自行放宽 |
| `minRuntimeVersion` | 是 | 能运行此包的最低 DGOS 运行时版本 |
| `dataVersion` | 是 | 应用持久数据 schema 版本；变化必须有迁移或明确拒绝升级 |
| `name`/`description` | 是 | 至少提供 `zh-CN` 和 `en-US`，运行时根据系统 locale 选择回退 |
| `category` | 是 | 应用目录分类；枚举由 DGOS 目录服务维护 |
| `trustLevel` | 是 | `standard`、`trusted`、`system`；不能由应用自行提升 |
| `entrypoints` | 是 | 命名入口到包内相对路径的映射；路径不能越出包根目录 |
| `defaultWindow` | 是 | 默认窗口边界；系统仍可最小化、最大化和恢复窗口 |
| `backgroundPolicy` | 是 | `release` 或 `keep-alive`；后台驻留须有权限和资源预算 |
| `icon` | 是 | 包内相对资源；格式和尺寸由目录校验器检查 |
| `permissions` | 是 | 面向用户和权限服务的能力声明；声明不等于获准 |
| `capabilityAllowlist` | 是 | 精确到 DGOS capability 的调用白名单；服务端再次校验 |
| `dependencies` | 否 | 应用、Skill、MCP 和运行时依赖；安装前解析版本与来源 |
| `agent` | 否 | Agent profile、工具、输入 schema、风险和副作用声明 |
| `actions` | 否 | 应用可供用户、快捷指令和系统助手发现的动作声明；每个动作仍受 capability broker 校验 |
| `dataMigration` | 条件 | `dataVersion` 变化时提供迁移范围、顺序和失败恢复信息 |

### 3.2 信任级别

| 级别 | 安装主体 | 能力范围 | 额外约束 |
| --- | --- | --- | --- |
| `standard` | 用户或管理员 | 公开 SDK、声明且获准的项目/任务/Artifact 能力 | 受沙箱和逐调用授权约束 |
| `trusted` | 管理员或受控开发环境 | 经审核的额外系统能力 | 方法白名单、审计、来源和回滚检查 |
| `system` | DGOS 发行或系统管理员 | 系统壳层和平台管理能力 | 仍需审计，不能绕过权限服务和任务协议 |

应用不能在 manifest 中自行声明更高信任级别；安装服务根据来源、签名、管理员策略和运行时版本决定最终级别。

## 4. 运行时上下文与窗口

DGOS 在应用启动和变化时提供版本化 `SystemContextSnapshot`。上下文至少包含 `contextVersion`、`appearance`、`locale`、`networkSummary`、`grid`、`displayScale`、`colorScheme`、`windowState` 和 `lifecycleState`，其中 `appearance` 包含 `appearanceMode`（`light`/`dark`/`system`）、`windowMaterial`、`interfaceMode`、明暗壁纸引用和 `wallpaperFollowsAppearance`；`locale` 区分 `uiLocale`、`effectiveLocale`、`regionFormat`、`assistantLanguage`、`projectContentLanguage` 和 `fallbackState`；`networkSummary` 只返回 `proxyMode`、脱敏有效路由、受影响服务和 `restartRequired`；`grid` 只返回宿主网格默认值和语义 token。应用必须能在浅色/深色、中文/英文、RTL（若系统启用）以及 75%、100%、125%、150%、175% 显示倍率下保持布局可用。

应用启动时读取一次上下文，并订阅后续带递增 `contextVersion` 的变更；主题、语言、地区格式、代理摘要和显示倍率由 DGOS 系统设置控制。应用可以提供内容级偏好，但不得伪装成 DGOS 系统设置。应用不能重复对普通 DOM 使用 `zoom` 或 `transform: scale` 来模拟系统倍率，也不能覆盖 DGOS 宿主窗口标题栏、最大化、最小化和关闭语义。

`backgroundPolicy=release` 表示窗口不可见且无后台任务时可释放运行实例；`keep-alive` 只表示允许后台驻留，不保证永远驻留。长任务必须转交 DGOS Task/AI Task 服务，不能依赖前台窗口常驻。

### 4.1 静态入口与应用隔离基线

普通应用的首选交付形态是无需在用户机器上执行 npm/build 的静态入口包。应用代码可以使用浏览器标准能力，但进程启动、文件导出、外部链接、网络访问、项目读写和实时通信必须经过 DGOS SDK/capability broker。应用不得读取宿主窗口对象、其他应用私有目录、安装包写目录或运行时秘密。

DGOS 不把某一种 iframe 实现写成公共协议，但桌面容器和 HTTPS Web 容器都必须提供等价的隔离保证：应用不能通过父窗口属性、任意弹窗、直接下载、Cookie 会话或未声明的第三方嵌入绕过能力边界。容器差异、降级能力和 Web 安全策略由后续 ADR 冻结。

### 4.2 普通、受信和系统应用

`standard` 应用只能调用公开且已授权的 SDK 能力；`trusted` 应用可在管理员策略下获得额外的受控能力；`system` 应用负责壳层和平台管理。需要访问系统内部业务方法的受信/系统应用必须声明精确的能力或方法白名单，并由安装服务授予，不能通过修改 `appId` 或展示名称取得更高信任级别。白名单调用仍须经过权限检查和审计，不能成为 AI、项目或秘密边界的旁路。

### 4.3 系统设置、声明与授权

系统设置是 DGOS 系统级平台服务，不是某个 APP 的私有配置页。V1 的系统设置分为：外观（主题、材质、界面模式、倍率、壁纸）、语言与地区（界面/生效语言、地区格式、助手回复语言、项目内容语言）、网络（系统/手动/关闭代理及重启状态）、网格（点/线样式、间距、主网格频率、坐标轴、吸附和透明度）、隐私与安全（文件、MCP、Skill 等通用能力的 `allow / ask / deny`）和 APP 权限（打开 APP 与 Agent 能力分离）。Provider 设置仍由系统设置提供入口，但 Provider/模型的具体管理属于 Provider 官方能力面。

APP manifest 的 `permissions` 是“我需要什么”的声明，`capabilityAllowlist` 是“我允许调用哪些 DGOS API”的静态白名单；二者都不授予运行时权限。系统权限页面中的授权对象由 `subject + appId + capability + scope` 唯一定位，并支持用户策略与管理员策略的来源标识。执行请求到达 capability broker 后，必须按有效策略重新计算：任一更高优先级 `deny` 直接拒绝；`ask` 只有在没有副作用发生时展示确认；`allow` 也不能绕过 manifest、安装状态、信任级别和资源作用域校验。

“允许打开 APP”只控制启动/聚焦能力。写文件、删除文件、调用 MCP、运行 Skill、发送通知、打开外部页面等 Agent 能力需要单独的声明和授权。系统应用、官方应用和第三方应用可以有不同的默认策略，但所有最终调用仍由同一 broker、执行器和审计链强制执行。

## 5. SDK 与 capability broker

应用只能通过 DGOS SDK 或等价的 capability broker 请求系统能力。公共调用应具备稳定 capability 名、requestId、可追踪响应、结构化错误和权限检查结果。应用不能读取父窗口、内部服务地址、密钥、供应商凭据或其他应用私有目录。V1 文件/知识库访问只能返回授权的稳定文件/文档引用、最小元数据或检索片段；不得返回宿主绝对路径、任意目录句柄或未授权全文。

V1 逻辑能力命名沿用现有 DGOS 约定：

| 能力域 | 逻辑入口 | V1 说明 |
| --- | --- | --- |
| 系统上下文 | `dgos.system.context.read` | 读取主题、语言、倍率和生命周期 |
| 系统设置 | `dgos.system.settings.read`、`dgos.system.settings.write` | 系统设置应用读取/保存外观、语言地区、网络和 DGOS 平台偏好；写入仍受主体和管理员策略限制 |
| 网格上下文 | `dgos.system.grid.read` | 向支持网格的 APP 提供统一网格 token；实际项目可见性和布局属于对应 APP/项目版本 |
| 应用目录/生命周期 | `dgos.app.catalog`、`dgos.app.install`、`dgos.app.launch` | 由系统应用或开发者中心使用 |
| 权限 | `dgos.permission.check`、`dgos.permission.request` | `allow/ask/deny`，服务端强制执行 |
| 模型/任务 | `dgos.model.list`、`dgos.model.resolve`、`dgos.aiTask.*` | 应用不直接访问供应商 API |
| 产物 | `dgos.artifact.read` | 返回受授权的稳定引用，不暴露临时下载地址 |
| 项目（V2） | `dgos.project.*` | V1 只预留边界，V2 冻结项目 schema |

具体的 JavaScript 入口、IPC 或 HTTP 传输方式待 ADR 冻结。无论传输方式如何变化，权限检查、审计、requestId、contextVersion 和错误语义保持一致。上下文订阅断线后必须先重新读取快照，再继续接收新版本事件。

## 6. 数据、秘密和缓存边界

| 数据 | 所有者 | 应用可做什么 | 禁止事项 |
| --- | --- | --- | --- |
| 安装包/代码 | DGOS 应用平台 | 读取自身静态资源 | 写入运行时数据或秘密 |
| 应用私有数据 | DGOS 数据服务 | 通过应用作用域 API 读写 | 访问其他应用私有空间 |
| 项目数据 | DGOS Project 服务 | 按项目权限读写（V2 起） | 绝对路径、`../`、隐藏目录和绕过版本校验 |
| Artifact | DGOS Artifact 服务 | 按引用和权限读取、提交 | 拼接供应商下载地址或永久保存临时 URL |
| 秘密/凭据 | DGOS 秘密边界 | 只获得验证结果或受控调用 | 读取明文 API key、Authorization 或 token |
| 缓存/临时文件 | DGOS 缓存服务 | 查询或清理自身可清理项 | 删除项目主数据或仍被任务引用的产物 |

应用卸载、停用、删除应用数据、删除项目数据是四个不同操作。默认卸载只移除代码和运行注册，不删除项目、Artifact 或用户设置；危险删除必须单独确认并写审计记录。普通用户只能从 `official` 或 `approved` 目录安装、更新和卸载；开发者未审核包仅可由有权限主体测试安装。`protected-preinstall` 应用的普通用户卸载请求在副作用前拒绝并记录原因；`user-removable` 预装应用可按普通用户策略卸载。

## 7. 安装、更新、迁移与回滚

1. `discover`：读取包元数据和来源。
2. `validate`：校验 manifest、资源、依赖、权限、签名/来源和运行时兼容性。
3. `stage`：把新包放入隔离暂存区，保存当前活动版本指针。
4. `health-check`：启动最小运行检查，确认入口、SDK 握手和声明能力可用。
5. `migrate`：按 dataVersion 执行可逆或可恢复的应用数据迁移。
6. `commit`：原子切换活动版本，记录 release/version/build 和审计事件。
7. 任何校验、健康检查或迁移失败都恢复旧版本指针；不得清空项目数据、用户设置、MCP 配置或已提交 Artifact。

同一 `appId + releaseChannel + version + build` 不可覆盖。更新失败、卸载和删除数据的结果必须可查询，且应用退出后仍能恢复到最后一个一致状态。

## 8. AI、Agent、Skill 和 MCP 约束

- 应用先通过模型/目标目录和动态 schema 完成能力握手，再提交任务；模型目录变化后必须重新握手。
- `requestId` 负责幂等提交，`taskId` 由 DGOS 生成，供应商任务 ID 只能存于 DGOS 服务内部。
- `query`、`get`、`events` 和 `cancel` 是不同操作；终态不能被旧轮询覆盖。
- Skill/MCP/Agent 依赖、权限、风险和副作用必须进入 manifest 或扩展清单；安装阶段不自动执行未知脚本。
- Agent 的长任务、上下文脱敏、工具调用和产物提交由 DGOS runtime 管理；应用不能借 Agent 运行绕过自身能力白名单。

### 8.1 系统助手与动作目录

应用可以在 manifest 的 `actions` 中声明公开动作。动作必须绑定稳定 `actionId`、版本、输入/输出 schema、所需 capability、风险、副作用、幂等、取消和确认策略。安装服务将声明注册到 Action Registry，但注册不等于授权或可执行；助手和快捷指令只能选择当前主体可见、已启用、健康且授权的动作。

自然语言解析只产生动作候选和结构化输入，不能直接调用内部 API。快捷指令直接使用版本化 `actionId`。两种入口都经 Capability Broker 重新检查，并由统一 Action Executor 负责 schema、幂等、超时、取消、结果校验、任务升级和审计。动作不能读取其他应用私有状态、秘密或供应商凭据；项目/画布/资产动作必须等对应版本公开写 API 和验收通过后再注册。

### 8.2 扩展类型与声明边界

DGOS 将可安装和可调用能力拆成五类扩展。它们可以由同一个 APP 包提供，但身份、版本、权限和生命周期仍分别记录。

| 扩展类型 | 作用 | 必须声明 | 主要执行器 | 首次交付 |
| --- | --- | --- | --- | --- |
| App | 可启动的用户应用和系统工具 | 入口、窗口、权限、依赖、数据版本 | App Runtime | V1 |
| Skill | 可被 Agent 或应用引用的提示/流程能力 | 稳定 ID、输入 schema、权限、风险、副作用 | Skill Executor | V1；通过官方 Skill 应用安装和管理 |
| MCP | 受 DGOS 管理的外部工具服务 | 来源、连接配置、凭据需求、工具发现策略 | MCP Runtime | V1；通过官方 MCP 应用安装和管理 |
| Agent Tool | Agent 可发现的动作适配器 | 动作 ID、输入输出、授权、引用的 Skill/MCP/节点 | Agent Executor | V1 基础/V3 扩展 |
| Canvas Node | 画布中的可视化、可执行节点 | 类型、端口、语义角色、能力版本、执行适配器 | Canvas Executor | V2 基础/V3-V5 扩展 |

声明只加入候选注册表，不代表已经安装、启用、授权或连接。安装服务、权限服务和执行器必须在每次调用前重新确认当前状态。

### 8.3 bundled、system 与 external MCP

DGOS 采用自有来源枚举：`bundled` 表示随已安装 APP 提供的 MCP 描述和运行依赖；`system` 表示由 DGOS 管理的系统服务；`external` 表示用户单独安装或配置的服务。来源影响安装、更新和删除归属，但不改变权限检查和审计要求。

- bundled MCP 的包声明是服务定义真源，更新时刷新命令、参数、运行目录和工具声明；用户秘密、启用状态和覆盖配置留在 DGOS 数据/秘密服务。
- 无需秘密且通过健康检查的 bundled MCP 可以申请自动启动语义；需要凭据的服务必须进入 `needs-credentials`，不能因声明自动启动而伪造连接成功。
- bundled 注册丢失或包内容与声明不一致时，APP 进入安装损坏/需要修复状态；不提示用户把同一服务当作 external 重装来掩盖错误。
- system/external 服务不存在时，才引导用户进入 MCP 应用安装或配置；删除前必须检查 Agent Tool、Skill 和未来 Canvas Node 的引用。
- MCP Runtime 由 DGOS 启动受控子进程或 HTTPS 连接；APP 不能在 iframe 中启动服务或直接传递任意环境变量。

### 8.4 工具绑定与执行状态

Agent Tool 的 MCP 绑定使用 DGOS 自有的结构化引用 `{ sourceId, operationId }`，不得只保存一个可任意替换的字符串。注册器只接受依赖清单中存在的引用；服务未安装、未启用、未连接或未授权时，工具状态分别为 `missing`、`disabled`、`pending` 或 `denied`，不能生成伪造结果。

Skill、MCP 和 Canvas Node 的手动执行、Agent 执行都必须进入对应的统一 executor，并带有 `requestId`、扩展版本快照、授权决策、状态转换和脱敏审计摘要。普通前台调用不承诺页面关闭后的结果恢复；需要跨页面、取消、查询和断点恢复的执行必须创建 DGOS Task/Run。

### 8.5 项目文件安全数据流

扩展调用项目数据遵循“最小读取—受控调用—校验回写”：

1. App 以项目 capability 读取完成当前操作所需的最小字段或 Artifact 引用。
2. Runtime 按扩展声明过滤绝对路径、Cookie、用户标识、秘密和无关字段。
3. MCP/Skill/Agent Tool 只接收经过脱敏的数据；大文件通过 Artifact 引用传递。
4. App 校验返回 schema、来源和版本，再使用项目写能力提交，写入带 baseVersion 或等价并发条件。

MCP 不因被 bundled 或被 Agent Tool 引用就自动获得项目目录和身份上下文。

### 8.6 AI Target 与动态 descriptor

DGOS 的 AI 能力使用统一的 Target 身份。Target 可以代表模型、应用或工作流，应用不得根据展示名称自行拼接供应商地址或固定参数。运行前必须完成：读取 Target 目录 → 按 `target`、`intent`、参考素材数量和输入类型握手 → 检查执行模式与权限 → 根据返回的动态 descriptor 渲染参数 → 使用幂等 `requestId` 创建 DGOS AI Task。

descriptor 中的字段和默认值只在当前握手范围内有效；目录或协议变化后必须重新握手。DGOS 任务服务生成 `taskId`，供应商任务标识只能由 DGOS 内部保存；后续 upscale、variation、reroll 等动作创建新的 requestId 和 DGOS 任务，但不能把供应商任务标识当成 DGOS taskId。模型不可用时应用显示禁用原因，不回退到未声明的旧接口。

### 8.7 协作与实时房间预留

V1 只预留协作能力边界，不交付多人项目。后续协作版本必须把房间创建、加入、离开、关闭、成员、状态同步和项目版本写入分开建模；每个应用实例使用稳定的运行期 clientId，创建成功但加入失败时清理空房间。实时事件不能依赖 Cookie WebSocket 或页面常驻，项目一致性仍由带并发条件的项目写入负责。

## 9. 最小验收清单

| 验收项 | 结果要求 | 证据位置 |
| --- | --- | --- |
| 包结构 | 缺入口、资源或非法路径时拒绝安装 | V1-E2E-02 |
| 清单兼容 | 缺必填字段、版本不递增或 runtime 不兼容时显示具体错误 | V1-E2E-02 |
| 权限边界 | 未声明或被拒绝的 capability 无法调用，`ask` 产生用户确认 | V1-E2E-03/07 |
| 上下文适配 | 主题、语言、倍率和生命周期变化能被应用观察到 | V1-E2E-01 |
| 数据保护 | 更新、健康检查失败和卸载不删除项目/设置/Artifact | V1-E2E-02 |
| 回滚 | 安装、迁移或健康检查失败恢复旧版本和活动指针 | V1-E2E-02 |
| AI 边界 | 应用拿不到供应商密钥、endpoint、轮询地址和临时下载地址 | V1-E2E-05/07 |
| 扩展审计 | Skill/MCP/Agent 调用、权限和失败原因可追踪 | V1-E2E-03/07 |

## 10. 待 ADR 冻结

- manifest 的最终格式版本、签名和来源信任链。
- `permissions`、`capabilityAllowlist`、`backgroundPolicy` 和 `trustLevel` 的公开枚举。
- 桌面与 HTTPS Web 的容器隔离方式和能力差异。
- SDK 入口、事件订阅、错误包体、requestId/correlationId 和版本协商。
- 应用私有数据目录、迁移执行器、卸载数据删除确认和恢复点。
- Agent profile、Workspace、Artifact validate/commit 以及子 Agent 限额。
