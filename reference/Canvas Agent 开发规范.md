# DX OS 开发通用规范（dx-app/v2）

## 交付与目录
- APP 前端必须是无需 npm 和构建即可运行的静态页面；只有按本规范封装在 mcp/ 内的 bundled MCP 可以包含服务端脚本。
- ZIP/项目根目录必须包含 dx-app.json 和 index.html，所有资源使用相对路径，建议放入 assets/。
- dx-app.json.format 必须是 dx-app/v2；id 必须匹配 ^[a-z][a-z0-9-]{2,42}$，即以英文字母开头，只能包含英文小写、数字和短横线。
- dx-app.json.version 必须使用 SemVer（例如 1.2.3）；build 必须是大于 0 且随每次发布递增的整数；releaseChannel 使用 stable、beta 或 dev。
- minSystemVersion 必须声明 APP 实际兼容的最低 DX OS 版本；它不是 APP 自身的 version，不能把 APP 的 1.0.0/1.0.1 等版本号复制到这里。当前 DX OS 系统版本为 0.3.9，可通过 GET /api/market/version 读取 systemVersion；需要限制最高兼容版本时再声明 maxSystemVersion。dataVersion 用于项目数据迁移，初始为 1。
- dx-app.json.icon 必须提供符合应用功能的图标，优先使用简洁的内嵌 SVG 和协调渐变，不要使用系统默认占位图标；也支持 image 字段保存 PNG data URL。
- entry 必须指向包内真实文件；不得包含绝对路径、file://、../ 或真实密钥。
- 所有显式声明的包内路径都必须真实存在：entry、agent.toolManifest、agent.skillDocs，以及 source=bundled 的 dependencies[].path。声明缺失文件会在安装前直接拒绝，并显示具体路径。
- 普通 APP 没有强制 assets/ 目录名；assets/ 只是推荐结构。Skill 文档固定放在 skills/，bundled MCP 固定使用 mcp/mcp.json，三类文件不能混放在 ZIP 根目录。

## 窗口尺寸与游戏缩放
- 普通响应式软件使用 `category: "software"`。iframe 会始终铺满 DX OS 内容区，页面应使用 `width/height: 100%`、Flex/Grid、`ResizeObserver` 或窗口 `resize` 事件适配尺寸变化。
- `system.context.displayScale` 用于了解当前系统倍率和调整高分辨率 Canvas/WebGL 缓冲区；普通 DOM 页面不得据此对 `html`、`body` 或 APP 根节点再次设置 `zoom`、`transform: scale(...)`，也不得把字号、宽高重复乘以倍率。系统外壳只会应用一次最终显示倍率。
- DX OS 内置或受信 APP 如果已经注册原生 Vue 组件，不得再让同 ID 的独立安装包覆盖为 iframe 运行时；同一 APP ID 必须只选择一种界面运行路径。安装包可以继续用于版本、权限和发布管理，但运行时注册必须显式保留原生组件。
- 发布前必须分别在 100%、125%、150%、175% 系统倍率下检查文字、细边框、表格和窗口四边；不得出现重复放大、裁切、空白边缘或明显的文字采样模糊。
- 默认 `backgroundMode: "release"` 会在长时间最小化或后台驻留时释放 iframe。包含长任务、未落盘编辑状态或实时会话的 APP 必须声明 `backgroundMode: "keep-alive"`；同时仍应响应 `system.lifecycle` 暂停媒体和高频绘制。
- 固定逻辑分辨率的游戏使用 `category: "games"`。此时 `defaultSize.width/height` 同时作为游戏逻辑视口；DX OS 会在窗口变化时保持宽高比，连同 iframe 和指针坐标一起等比放大或缩小并居中显示。
- 游戏应按 `defaultSize` 渲染完整画面，不要在内部再次限制只能缩小，也不要叠加第二层页面缩放；Canvas/WebGL 在逻辑视口内自行处理 devicePixelRatio 即可。

## APP 图标
- 包内图标写在 dx-app.json.icon 中，随安装包一起分发，用于 DX OS 桌面、Dock、启动台和应用窗口；后台上传的商店图标用于官网应用市场与详情页，两者互不覆盖，可以同时设置。
- 推荐使用完整的内嵌 SVG。svg 必须包含 <svg> 根元素，不得包含 script、foreignObject、iframe、object、embed、image、事件处理器或外部 href/src。
- PNG 必须写成 data:image/png;base64,... data URL，不能填写 assets/icon.png 等相对路径，解码后的文件不能超过 512 KB。
- gradient 用于图标背景；透明素材可设置 imageBackground=true 保留背景。imageScale 有效范围为 0.5–1.8，imageOffsetX/imageOffsetY 有效范围为 -50–50。

推荐的 SVG 图标：

```json
{
  "icon": {
    "gradient": "linear-gradient(145deg, #5b8cff, #7057ff)",
    "svg": "<svg viewBox='0 0 64 64'><rect x='14' y='14' width='36' height='36' rx='10' fill='white'/></svg>"
  }
}
```

使用 PNG data URL：

```json
{
  "icon": {
    "gradient": "transparent",
    "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "imageScale": 1,
    "imageOffsetX": 0,
    "imageOffsetY": 0,
    "imageBackground": false
  }
}
```

## 系统上下文
- 监听宿主推送的 system.context，并在启动时主动调用 system.getContext。
- 实时同步 appearance、interfaceLocale、formatLocale、direction、displayScale 和 colorScheme；主题和语言不能由 APP 本地设置覆盖。
- CSS 必须同时提供 :root/[data-theme="light"] 与 [data-theme="dark"] 变量；所有页面背景、面板、文字、边框和控件颜色必须引用变量，不能只修改 html 的 colorScheme。
- 所有用户可见文案必须来自至少包含 zh-CN 与 en-US 的字典；收到 interfaceLocale 后立即重新渲染，未知语言回退到 en-US。

## 必须采用的上下文接入模式
```js
const i18n = {
  'zh-CN': { title: '我的应用', save: '保存' },
  'en-US': { title: 'My App', save: 'Save' }
}
let system = { appearance: 'light', interfaceLocale: 'zh-CN', direction: 'ltr', displayScale: 1 }
function applySystemContext(context = {}) {
  system = { ...system, ...context }
  const root = document.documentElement
  root.dataset.theme = system.appearance === 'dark' ? 'dark' : 'light'
  root.lang = system.interfaceLocale || 'zh-CN'
  root.dir = system.direction || 'ltr'
  root.style.colorScheme = system.appearance === 'dark' ? 'dark' : 'light'
  root.style.setProperty('--dx-display-scale', String(system.displayScale || 1))
  renderText(i18n[system.interfaceLocale] || i18n['en-US'])
}
addEventListener('message', event => {
  const message = event.data
  if (message?.dxos === 'v1' && message.type === 'system.context') applySystemContext(message.context)
  if (message?.dxos === 'v1' && message.id === 'initial-context' && message.ok) applySystemContext(message.result)
})
parent.postMessage({ dxos: 'v1', type: 'request', id: 'initial-context', action: 'system.getContext' }, '*')
```

```css
:root, :root[data-theme="light"] { --bg:#f5f5f7; --surface:#fff; --text:#1d1d1f; --muted:#6e6e73; --line:rgba(0,0,0,.12); }
:root[data-theme="dark"] { --bg:#101114; --surface:#1c1d22; --text:#f5f5f7; --muted:#a1a1aa; --line:rgba(255,255,255,.14); }
body { background:var(--bg); color:var(--text); }
```

## 项目数据与持久化
- 项目、文档、存档和用户创作内容必须通过 project.info/list/read/write/mkdir/remove 保存到宿主管理的“项目/<APP 名称>”目录。
- project.* 的 path 必须是项目根目录内的普通相对路径，例如 'data/game.json'；路径及任一级目录不能以点号开头，不能使用 '../'、绝对路径或隐藏目录（例如 './data'、'.app-data'）。
- localStorage、sessionStorage、IndexedDB 只能保存可丢失的 UI 偏好或缓存，不能作为主数据源。
- 服务端或 MCP 生成的下载中转文件、上传暂存文件等短期产物必须放在系统临时目录（例如 Node.js 的 os.tmpdir()），不能写入安装包目录，也不要混入持久数据目录。
- APP 的安装/卸载状态由 DX OS 按登录账号在服务端持久化，APP 不得自行用浏览器存储模拟安装状态。
- APP 更新只替换经过校验的安装包；项目数据、用户设置和 MCP/网络安全配置与安装包分离，升级代码不得清空项目目录。
- stable/beta 发布必须提高 version 或 build；系统会拒绝相同 Release 和意外降级。dataVersion 变化必须同时提供受支持的数据迁移，否则更新会为保护项目数据而停止。
- DX Developer 中“正式安装”只安装到当前系统，“发布版本”才会创建应用市场 Release；发布渠道必须与 dx-app.json.releaseChannel 一致。
- Release 发布后不可覆盖；修复同一 version 必须增加 build。服务器会保存包大小和 SHA-256，并使用 Ed25519 签名；APP 不得自行伪造 packageUrl、sha256 或 signature。
- 发布 dev/beta/stable 前填写 releaseNotes；灰度比例和强制更新属于市场发布策略，不应写入浏览器本地存储。被撤回的 Release 不再提供新安装。
- 安装器会检查 index.html 引用的本地 src/href 资源；不得发布引用缺失 assets 文件的包。更新后健康检查失败会恢复旧代码。
- 历史版本回滚默认只切换 APP 代码并保留项目、设置和 MCP 配置；dataVersion 不一致且没有声明式迁移/数据快照时，系统会拒绝回滚。
- 普通开发者 APP 安装后使用 dev- 命名空间。声明 appApi 的包属于“特权 APP”：可以在 Claude、Codex 或任意本地开发环境中按本文档制作，不要求使用 DX Developer，也不要求先上架应用商店，但只能由管理员安装、更新和启用。
- 特权 APP 必须同时声明 app.<app-id>.app-api.call 权限和精确的 appApi 方法/路径白名单；未声明的宿主接口一律拒绝。普通用户不能安装特权 APP，也不能通过修改包 ID 冒用系统内置 APP。
- 按实际操作在 dx-app.json.permissions 或 permissions.json 中声明 app.<app-id>.project.read、app.<app-id>.project.write、app.<app-id>.project.delete；不要把 project.info 等桥接动作名直接当作权限名。

## 必须采用的宿主 API 调用模式
运行时会提供 `window.dx.invoke(action, args)`（`window.dx.call` 是兼容别名）。它返回 Promise，并把参数转换成带唯一 id 的 postMessage 请求。新 APP 应优先使用该接口；也可以自行实现同一协议，但必须等待带相同 id 的响应，不能只发送不处理结果。
- APP 运行在 opaque-origin 跨域 iframe 中。禁止读取 `window.parent.dx` 或父窗口的任何属性；只能调用当前 iframe 内注入的 `window.dx`，或使用 `parent.postMessage(...)` 协议通信。
- 沙箱不开放 allow-same-origin、allow-popups 或 allow-downloads。禁止直接使用 window.open、target=_blank、a download，localStorage/IndexedDB 读取必须捕获 SecurityError 并回退，不能阻止 APP 启动。
- 导出文件调用 file.export 并声明 app.<app-id>.file.write；普通 HTTPS 外链调用 ui.openExternal 并声明 app.<app-id>.ui.external；OAuth 使用 oauth.authorize/status。
- 不要嵌入依赖 Cookie、localStorage、IndexedDB 或 Service Worker 的完整第三方网站；嵌套 iframe 会继承外层沙箱限制并可能永久停在加载页。
- 不要直接依赖 Cookie 鉴权的 WebSocket/EventSource；实时协作使用 realtime.room.*，外部请求使用 network.request/download。
- 游戏与协作 APP 使用 realtime.room.create/list/join/leave/send/setState/getState/members/close，并声明 app.<app-id>.realtime.room；DX Developer 的模拟运行与正式安装后的 APP 使用同一协议。create 传 discoverable: true 后，同一 DX OS 服务的局域网设备可通过 list 发现房间。
- realtime.room.create 只创建房间，不会自动加入；create 与 join 是两个独立调用。APP 必须为每个运行实例生成一个符合 ^[a-zA-Z0-9_.-]{3,100}$ 的稳定 clientId，并在 join 时显式传入。局域网普通 HTTP 页面不要依赖 crypto.randomUUID()，因为非安全上下文或旧 WebView 可能不提供该函数。
- 如果 create 成功但 join 失败，房主应立即调用 realtime.room.close 清理刚创建的房间。否则零成员房间可能在 list 中保留，直到服务端完成约 30 分钟的空闲回收；房间大厅也应隐藏 members 为 0 的遗留房间。
- realtime.room.leave 只断开当前成员；realtime.room.close 仅房主可调用并会关闭整个房间。用于重连的 clientId 应在当前 APP 运行期间保持不变，但不属于项目持久数据。

```js
const clientId = 'game-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
let roomId = null
try {
  const created = await window.dx.invoke('realtime.room.create', {
    name: '好友对局', discoverable: true, maxMembers: 4, state: { phase: 'waiting' }
  })
  roomId = created.room.id
  await window.dx.invoke('realtime.room.join', { roomId, clientId })
} catch (error) {
  // create 与 join 不是原子操作；加入失败时避免留下零成员房间。
  if (roomId) await window.dx.invoke('realtime.room.close', { roomId }).catch(() => undefined)
  throw error
}
addEventListener('message', (event) => {
  const message = event.data
  if (message?.dxos === 'v1' && message.type === 'realtime.event' && message.roomId === roomId) {
    // message.data.type: joined | message | state | members | owner | closed | error
  }
})
await window.dx.invoke('realtime.room.send', { roomId, data: { type: 'player-input', direction: 'left' } })
```

## AI 模型与 Agent 协议接入
- 生成类 APP 必须使用公开 Bridge 的 `ai.*` 动作，不得直接请求 `/api/ai/*`、`/api/canvas/*`，不得自己拼接上游 endpoint、Authorization、请求体、轮询地址或下载地址。
- 平台协议负责鉴权与公共规则；模型协议负责能力、动态参数、素材传输、提交、轮询、下载和结果解析。APP 只提交 `dx-ai-task/v2` 标准任务。
- APP 必须声明 `app.<app-id>.ai.read`（目录、握手、状态、事件、产物）和 `app.<app-id>.ai.generate`（提交、推进查询、取消）。API Key 永远不会返回给 APP。
- `task.*` 是 Agent 后台工作任务；`ai.task.*` 是图片、视频、音频、转录等模型任务，二者不能混用。
- 普通开发者 APP 只执行 `declarative` 或受信 `native` 模型。模型握手返回 unavailable/legacy 时，应禁用运行并提示完善 Agent 协议，不能改调旧 Canvas 接口。
- 收到宿主 `system.providers-changed` 消息后重新执行模型目录和当前模型握手，避免继续使用管理员已经停用或改绑协议的旧选项。

标准流程：

1. `ai.models.list` 获取无密钥 Target 目录，按 capability 筛选。Target 统一表示普通模型、AI 应用或工作流。
2. `ai.models.resolve` 按 target、intent 和参考素材数量握手；用 `descriptor.parameters.fields/defaults` 渲染参数，用 `descriptor.inputs` 校验素材。旧 providerId/model 参数仅用于兼容。
3. 创建一次 UUID requestId，通过 `ai.task.submit` 提交。相同逻辑任务重试必须复用原 requestId，不能新建 ID 重复扣费。
4. pending 时调用 `ai.task.query` 推进同一 taskId；`ai.task.get` 只读状态，`ai.task.events` 增量读取轨迹。
5. succeeded 后读取 `result.outputs[].artifactId`，再用 `ai.artifact.read` 获取 ArrayBuffer；可预览或通过 project.writeBinary/project.upload.* 保存。

常用 Intent 与输出：

- `image.generate` / `image.edit` / `image.blend` → `output.kind=image`；
- 已生成任务的后续图片操作使用 `image.upscale`、`image.variation`、`image.low_variation`、`image.high_variation`、`image.reroll`、`image.zoom`、`image.pan`、`image.inpaint`、`image.remix_subtle` 或 `image.remix_strong`，仍然返回 `output.kind=image`；
- `video.text_to_video` / `video.image_to_video` / `video.first_last_frame` / `video.multi_reference` / `video.video_to_video` / `video.audio_reference` / `video.multimodal` → `output.kind=video`；
- `audio.tts` / `audio.music` → `output.kind=audio`；
- `audio.transcribe` / `audio.translate` → `output.kind=text`。

`output` 只描述标准结果（kind、count、size、quality）；模型专用字段放入 `params`，但字段名和值必须来自握手返回的动态 Schema。不得构造 `/v2/general` 等虚构地址；APP 根本不提交 endpoint。

Target 是服务端目录返回的稳定能力身份，可能代表 model、app 或 workflow。提交时应原样复用 `candidate.target`，包括可选的 `metadataRef`；不得自行拼接、持久化或猜测 metadataRef。目录或协议更新后重新握手，并以新的 Target 与参数 Schema 创建新任务。

Midjourney 等异步动作协议会在首次成功结果中返回服务商任务标识。后续 upscale、variation、reroll、zoom、pan、inpaint 或 remix 必须创建新的 requestId，选择对应 Intent，并把握手 Schema 要求的 `task_id`、`index`、`direction`、`zoom_ratio` 等字段放入 `params`。服务商任务标识不是 DX OS taskId；轮询当前动作仍使用本次 `ai.task.submit` 返回的 DX OS taskId。

清单权限：

```json
{
  "permissions": [
    "app.my-generator.ai.read",
    "app.my-generator.ai.generate",
    "app.my-generator.project.write"
  ]
}
```

模型握手与动态参数：

```js
const catalog = await window.dx.invoke('ai.models.list', {})
const candidate = catalog.models.find(model => model.capabilities.includes('image.generate'))
if (!candidate) throw new Error('没有可用的图片模型')

const resolved = await window.dx.invoke('ai.models.resolve', {
  target: candidate.target,
  intent: 'image.generate',
  references: { images: 0, videos: 0, audios: 0, files: 0 }
})
const descriptor = resolved.descriptor
if (!descriptor.execution.available || !['declarative', 'native'].includes(descriptor.execution.mode)) {
  throw new Error(descriptor.execution.reasons.join('；') || '该模型尚未开放 Agent 执行')
}
const params = { ...(descriptor.parameters?.defaults || {}) }
// 根据 descriptor.parameters?.fields 渲染控件，并把用户值合并到 params。
```

提交并只轮询同一任务：

```js
const task = {
  format: 'dx-ai-task/v2',
  requestId: crypto.randomUUID(),
  context: { surface: 'app' }, // 宿主会强制绑定为当前 APP
  intent: 'image.generate',
  target: candidate.target,
  // 兼容期保留；新旧执行器完全统一后由宿主根据 target 生成。
  provider: { platform: 'api', providerId: candidate.providerId, model: candidate.model },
  prompt: '白色背景上的红苹果，产品摄影',
  params,
  inputs: [],
  output: { kind: 'image', count: 1, size: '1024x1024' }
}

let response = await window.dx.invoke('ai.task.submit', { task })
while (response.status === 'pending') {
  await new Promise(resolve => setTimeout(resolve, 3000))
  response = await window.dx.invoke('ai.task.query', { taskId: response.taskId })
}
if (response.status !== 'succeeded') throw new Error(response.error || '生成失败')

for (const output of response.result.outputs || []) {
  const artifact = await window.dx.invoke('ai.artifact.read', { artifactId: output.artifactId })
  const blob = new Blob([artifact.data], { type: artifact.mime })
  // 使用 blob 预览，或把 ArrayBuffer 交给项目存储 Bridge。
}
```

后续图片动作示例（字段必须以当前模型握手返回的 Schema 为准）：

```js
const actionRequestId = crypto.randomUUID()
const actionTask = {
  ...task,
  requestId: actionRequestId,
  intent: 'image.upscale',
  target: candidate.target,
  prompt: '',
  inputs: [],
  params: { task_id: providerTaskId, index: 1 },
  output: { kind: 'image', count: 1 }
}
const action = await window.dx.invoke('ai.task.submit', { task: actionTask })
// pending 时继续对 action.taskId 调用 ai.task.query；不要拿 providerTaskId 当作 DX OS taskId。
```

参考素材只提交标准引用。普通 APP 当前允许 `source.type=url` 或 `remote`，不能传宿主 fs-node 或本地路径。协议需要 Data URL/multipart 时，执行器按模型声明安全转换；协议需要公网 URL 时原样使用。图床由用户或 APP 选择，协议不绑定图床名称。

```js
task.intent = 'image.edit'
task.inputs = [{
  assetId: 'reference-1', kind: 'image', role: 'reference_image',
  source: { type: 'url', id: 'https://cdn.example.com/reference.png' }
}]
```

动作摘要：`ai.models.list`、`ai.models.resolve`、`ai.task.submit`、`ai.task.get`、`ai.task.query`、`ai.task.events`、`ai.task.cancel`、`ai.artifact.read`。提交后出现网络或轮询错误时继续使用原 taskId 查询，严禁回退其他接口再次提交。

## 持久协同项目
- 剧本、视频工程、白板、文档等需要“一个项目、多人访问”的 APP 使用 collab.project.*，并声明 app.<app-id>.collab.project。
- 每个协同项目拥有 owner、read/edit 成员、邀请口令、通用 JSON document、单调递增 version 和独立实时房间。document 最大 2 MB，只保存业务结构与媒体引用，不能保存大型 Base64。
- 当前 collab.project.* 尚未映射到“项目/<APP 名称>/<项目名称>”文件夹，也未开放成员共享二进制附件；普通 project.* 与 APP Agent 仍使用当前账户的“项目/<APP 名称>”根目录。不要把普通 project.* 文件误写成已由协同项目 ACL 共享。
- 更新必须传 baseVersion。版本冲突时结果包含 conflict: true、code: "VERSION_CONFLICT" 和最新 current，APP 应合并或提示用户重载，不能静默覆盖他人修改。

```js
const created = await window.dx.invoke('collab.project.create', {
  name: '第一集', kind: 'video', document: { scenes: [], timeline: [] }
})
const project = created.project
await window.dx.invoke('collab.project.connect', { projectId: project.id })

const saved = await window.dx.invoke('collab.project.update', {
  projectId: project.id,
  baseVersion: project.version,
  document: { ...project.document, scenes: nextScenes }
})

const invitation = await window.dx.invoke('collab.project.invite.create', {
  projectId: project.id, access: 'edit'
})
// 另一位已登录用户：
await window.dx.invoke('collab.project.invite.redeem', { code: invitation.code })
```

协同项目动作：collab.project.create/list/get/update/delete、members.set、directory、invite.create/revoke/redeem、connect/disconnect/send。connect 后服务端版本变化通过 realtime.event 的 state 事件通知，收到后重新 get 项目即可取得最新文档。

## 特权 APP 与 app.api
- 只有确实需要复用 DX OS 现有内部业务接口时才使用 app.api；能用 Skill、MCP、Agent、task.*、project.* 或 network.* 完成时优先使用公开 Bridge。
- 图片、视频、音频和转录等模型任务即使在特权 APP 中也必须使用 `ai.*` Bridge；不得把 app.api 当作旧生成接口的逃生通道。
- 是否可以使用 app.api 由“管理员安装的特权包 + 清单声明”决定，不由是否上架应用商店决定。开发者可在外部完成代码和 ZIP，交给管理员审查后直接安装测试。
- 清单必须声明 permissions 中的 app.<app-id>.app-api.call，并在 appApi 中逐项列出 method 和 path。path 只写 /api 之后的宿主路径，例如宿主请求 /api/library/tracks 时声明 /library/tracks。
- APP 仍然不能在 iframe 内 fetch('/api/...')；必须通过 window.dx.invoke('app.api', ...) 让宿主执行白名单检查、账户权限检查和审计。
- app.api 默认等待 30 秒。有限耗时的前台调用可传 bridgeTimeoutMs，宿主最多接受 3600000 ms；需要关闭窗口后继续或可能运行数十分钟的视频任务仍应使用 task.*，不能依赖延长 Bridge 等待。
- multipart 上传应把 File/Blob 直接放入 app.api 的 parts（字段使用 blob），不要转成 Base64。系统通过结构化克隆传递 Blob，并由 fetch 流式发送；/fs/upload 单文件上限 2 GB、单次总量 8 GB、最多 30 个文件。旧版 content Base64 格式仅为兼容保留，仍限制为 24 MB。

```json
{
  "permissions": ["app.my-tool.app-api.call"],
  "appApi": [
    { "method": "GET", "path": "/library/tracks" }
  ]
}
```

```js
const result = await window.dx.invoke('app.api', {
  method: 'GET',
  path: '/library/tracks'
})
```

```js
async function loadDocument() {
  await window.dx.invoke('project.mkdir', { path: '存档' })
  try {
    const result = await window.dx.invoke('project.read', { path: '存档/current.json' })
    return JSON.parse(result.content)
  } catch (error) {
    return null
  }
}
async function saveDocument(value) {
  return window.dx.invoke('project.write', {
    path: '存档/current.json',
    content: JSON.stringify(value, null, 2)
  })
}
```

项目桥动作与清单权限的对应关系：
- project.info/list/read → app.<app-id>.project.read
- project.write/mkdir → app.<app-id>.project.write
- project.remove → app.<app-id>.project.delete

## Agent 与依赖
- 如 APP 暴露 Agent 工具，提供 agent.tools.json，声明 name、title、description、whenToUse、inputSchema、permission、risk、sideEffects 和 handler。
- Skill/MCP 依赖写入 dx-app.json.dependencies；上传与安装阶段不得自动执行未知安装脚本。
- 完成前必须在源码中检查 light/dark 两套 CSS 变量、zh-CN/en-US 两套文案以及 context 消息监听；再逐文件核对清单、入口、资源引用、权限和持久化实现，通过后才调用 finish_task。

# DX OS Canvas Agent 与节点插件开发规范

## 1. 先理解三层边界

开发“自己的画布 Agent”不是复制一套模型循环，也不是让插件直接调用某个 API。正确结构是：

1. **系统 Agent Runtime**：理解意图、渐进发现能力、根据参考素材与输出规格选择 Target、执行权限与风险控制。
2. **Canvas Agent Adapter**：读取当前画布快照，根据节点声明创建、连接、运行和回写节点；不保存 API Key，不按模型名写死逻辑。
3. **APP/节点声明**：只声明这个 APP 有哪些小能力、端口、参数、动作和执行器。新增节点通过清单加入，不修改系统 Agent。

因此，第三方通常不需要实现 `capability_discover`。宿主会把节点声明转成渐进披露能力，并在真正运行时接入统一 Agent Runtime。

### 开发前必须完成的框架阅读

不要只参考某个节点的表面 JSON。先选择一个与新节点职责最接近的内置节点和一个第三方示例，沿着同一条链路理解它为什么能被创建、连接、运行和恢复：

1. `shared/canvasPlugin.ts` 与 `shared/canvasPluginValidation.ts`：字段、端口、执行器、Agent action、operation 和安装期约束的协议真源。
2. `src/apps/canvas/builtinCanvasNodes.ts`：内置节点如何声明语义角色、端口、动作和操作；只参考能力建模，不复制仅供内置节点使用的 binding。
3. `src/apps/canvas/canvasNodeRegistry.ts` 与 `canvasNodeCompatibility.ts`：节点注册、命名空间、版本、缺失占位和状态迁移。
4. `src/apps/canvas/canvasGraphRuntime.ts`、`canvasNodeExecutionRuntime.ts` 与 `canvasPluginOperationRuntime.ts`：拓扑计划、统一执行入口、细粒度 operation 和取消信号。
5. `src/apps/canvas/CanvasApp.vue` 中的插件节点渲染与 `canvasAgentRuntime.ts`：宿主如何从相同声明生成 UI、Agent 工具，收集端口输入并回写 outputs。
6. `examples/canvas-plugin-story-tools`：生成节点和 app-bridge 节点的最小可安装纵向示例。

节点的标准生命周期是：安装校验 → Registry 注册 → 实例保存 nodeType/version/stateVersion → Agent 或用户选择 action → Graph Runtime 校验端口和上游依赖 → Execution Adapter 调用唯一 executor → outputs 按端口回写 → 画布持久化与失败恢复。新节点必须进入这条公共链路；不得在页面按钮、Agent 提示词或模型名判断中增加一条私有旁路。

开始编码前先写一张“参考节点对照”：新节点的 semanticRoles、输入、输出、参数、动作、执行器、结果落点分别参考哪个现有节点，以及哪些差异必须由新声明表达。复制外观不是参考完成，运行、取消、错误、重开恢复和 Agent 调用均一致才算完成。

## 2. 可交付的两种 Agent

### APP 自己的对话 Agent

在 APP 页面中调用 `agent.create/run/send/history/stream`，由系统托管会话、模型 fallback、Run 树、权限和 Artifact。`dx-app.json.agent` 与 `agent.tools.json` 用于把 APP 的小能力加入 Tool Catalog。

### 可被 Canvas Agent 操作的节点

在 `dx-app.json.canvas` 中登记 `canvas.nodes.json`。每个节点通过 `agent.aliases/actions` 声明 Canvas Agent 如何发现和运行它；通过 inputs/outputs 声明连线规则；通过 executor 声明真实执行方式。

两者可以同时存在，但含义不同：`dx-app.json.agent` 是整个 APP 的 Agent Capsule；`canvas.nodes.json.nodes[].agent` 是某一种画布节点的操作能力。

## 3. 最小包结构

```text
my-canvas-agent/
├─ dx-app.json
├─ index.html
├─ canvas.nodes.json
├─ canvas.templates.json
├─ agent.tools.json          # APP 级 Agent 工具，可选
└─ assets/
```

### 节点 UI 与交互基线

当前第三方节点由 Canvas 宿主统一渲染，不开放插件向主画布注入 Vue 组件、HTML 或 CSS。`index.html` 是 app-bridge 的隔离运行容器，不是节点卡片模板。这样选择、拖动、缩放、连线、主题、权限、运行状态和缺失恢复都能保持与其他节点一致。

开发者通过声明控制 UI：

- `title/description/category` 控制节点身份与入口信息；`icon` 作为身份元数据保留，当前标准插件卡片允许宿主回退为标题首字。名称应短、可辨识，description 说明输入和结果，不写营销口号。
- `defaultSize` 是真实布局边界。内容必须在边界内自适应或滚动；不得依赖溢出元素改变连线、框选或自动整理的视觉边界。
- `inputs/outputs` 生成左右端口及提示；端口按数据职责命名，例如 prompt、references、images，不使用 input1/output1。
- `parameters` 的 JSON Schema 生成标准表单。string、number/integer、boolean 和 enum 使用宿主控件；平台、模型和生成规格使用 `host.generation.fields`，不要在 iframe 内再造一套选择器。
- `host.output` 决定结果留在节点内，还是物化为文本/表格节点；媒体生成结果继续使用画布原生结果节点或结果组。
- idle、running、ready、error 状态以及 cancel、disabled/missing 流程均由宿主管理。执行器只返回数据或错误，不直接操纵节点 DOM。

选择参考风格时按职责而不是颜色：纯文本输入参考 `builtin.prompt/sticky`，结构化数据参考 `builtin.table`，模型生成参考 image/video/audio generator，素材输入输出参考 asset，通用第三方业务节点参考扩展中心示例的标准插件卡片。第三方可以拥有自己的 icon、标题和参数组合，但应复用宿主间距、控件、端口、状态和主题，不仿制另一个节点的内部专用 UI。

UI 验收至少覆盖：默认尺寸与最小可用尺寸、长标题/长参数/长错误、浅色与深色、运行与取消、空输出与多输出、连接多端口、插件停用后的缺失占位、重开画布后的状态恢复。键盘焦点和按钮必须可操作，运行中不得产生重复提交。

## 4. dx-app.json

```json
{
  "format": "dx-app/v2",
  "id": "brand-canvas",
  "version": "1.0.0",
  "build": 1,
  "releaseChannel": "dev",
  "minSystemVersion": "0.3.5",
  "dataVersion": 1,
  "name": "品牌画布助手",
  "description": "提供可由 Canvas Agent 操作的品牌图片生成节点。",
  "category": "software",
  "entry": "index.html",
  "backgroundMode": "keep-alive",
  "permissions": [
    "app.brand-canvas.open",
    "app.brand-canvas.agent.run"
  ],
  "agent": {
    "summary": "用户需要规划品牌视觉或整理品牌素材时使用。",
    "toolManifest": "agent.tools.json"
  },
  "canvas": {
    "nodeManifests": ["canvas.nodes.json"],
    "templateManifests": ["canvas.templates.json"]
  }
}
```

仅提供画布节点时可以省略 APP 级 `agent` 和 `agent.tools.json`。只有 APP 页面需要主动发起系统 Agent 时才声明 `app.brand-canvas.agent.run`。

## 5. 声明一个可被 Canvas Agent 发现的生成节点

推荐使用 `dx-canvas-nodes/v2`。v2 清单中的每个节点都必须声明 `capabilityVersion: 2`。

```json
{
  "format": "dx-canvas-nodes/v2",
  "nodes": [{
    "type": "brand-canvas.image-generator",
    "version": 1,
    "stateVersion": 1,
    "capabilityVersion": 2,
    "title": "品牌图片生成",
    "description": "根据提示词和可选参考图生成品牌图片。",
    "category": "品牌创作",
    "semanticRoles": ["generator", "sink"],
    "defaultSize": { "width": 420, "height": 380 },
    "inputs": [
      { "id": "prompt", "title": "文字要求", "type": "text" },
      { "id": "references", "title": "参考图片", "type": "media.image[]", "multiple": true }
    ],
    "outputs": [
      { "id": "images", "title": "生成图片", "type": "media.image[]", "multiple": true }
    ],
    "parameters": {
      "type": "object",
      "properties": {
        "prompt": { "type": "string", "title": "补充要求", "default": "保持品牌识别一致" }
      }
    },
    "host": {
      "generation": {
        "kind": "image",
        "parameterPanel": "standard",
        "outputPort": "images",
        "fields": ["platform", "model", "ratio", "resolution", "quality", "count", "seed"]
      },
      "output": {
        "targets": ["inline"],
        "defaultTarget": "inline",
        "defaultPort": "images"
      },
      "cancellable": true
    },
    "agent": {
      "aliases": ["品牌出图", "品牌图片助手"],
      "actions": [
        {
          "id": "run",
          "title": "生成品牌图片",
          "kind": "run",
          "description": "根据已连接的文字和参考图片运行系统图片模型。",
          "promptParameter": "params.prompt",
          "acceptsCanvasInputs": true
        },
        { "id": "read", "title": "读取生成设置", "kind": "read" }
      ]
    },
    "executor": { "type": "agent-tool", "toolName": "canvas.ai.generate" }
  }]
}
```

关键字段：

- `semanticRoles` 描述节点在图中的职责，不是模型类型；可用 asset、source、transform、generator、agent、data、sink、control、layout。
- `agent.aliases` 是 Agent 用于语义定位节点的名称，不要放自然语言正则。
- `agent.actions[].kind=run` 会调用节点自己的 executor；`read` 只返回节点声明、参数和连接。
- `promptParameter: "params.prompt"` 允许 Agent 把本轮明确要求写入节点提示词。
- `acceptsCanvasInputs: true` 允许 Agent 按端口类型连接用户指定的上游节点。
- 端口必须使用 `media.image`、`media.video`、`media.audio` 等正式类型；不能写 image、video 或 media。

### Agent 声明是节点交付的一部分

每个希望被 Agent 使用的节点都必须同时声明“是什么、能做什么、如何调用”：

- `capabilityVersion: 2 + semanticRoles + title/description/category` 负责发现和候选筛选；`agent.discoverable: false` 只用于明确不应被 Agent 发现的内部节点。
- `agent.aliases` 放用户真实会说的稳定名称；alias 应互补且少量，不能与无关节点争抢宽泛词。
- `agent.actions` 只声明实际支持的 `run/read/configure`。run 进入唯一 executor；read 返回声明、参数和连接；configure 只允许 Schema 字段或 `configurableParameters` 白名单。
- `promptParameter` 只在节点确实有标准提示词时声明；`acceptsCanvasInputs` 只在执行前允许宿主按端口连接素材时声明。
- 需要让 Agent 读取或修改节点内部业务数据时，再声明 `operations` 的输入/输出 Schema、reads/writes、副作用、风险、幂等、确认策略与 executorBinding。第三方 operation 当前仅开放给 `app-bridge`，binding 使用 `canvas.plugin.operation` 或 `canvas.plugin.operation.<action>`；不要复制 `canvas.text.*` 等内置 binding。

声明必须与运行时对称：每个 action/operation 都有真实处理器，每个 handler 只接受声明字段，每个输出都落到已声明端口。手动点击“运行节点”和 Agent 的 run 必须进入同一执行器，Agent 不得拥有 UI 中不存在的隐式特权。

## 6. 接入统一 V2 模型协议

生成节点优先声明 `host.generation`，不要在插件中手写 `ai.models.list/resolve` 和轮询：

- Canvas 宿主读取 inputs、prompt 和标准参数；
- 系统根据任务是文生、参考图编辑、图片/视频/音频以及分辨率要求选择 Target；
- 宿主执行 `ai.models.list → ai.models.resolve → dx-ai-task/v2 → Artifact`；
- API Key、Authorization、metadataRef、幂等 requestId、任务查询和结果回写全部由系统管理；
- 生成结果沿 Canvas 原生连接进入结果节点/结果组，并跟随画布保存和布局规则。

`host.generation.kind` 可用 text、image、video、audio。当前第三方声明开放基础生成；图片 upscale、variation、inpaint 等后续动作尚不能伪装成基础生成，也不能通过 app-bridge 绕过宿主旧接口。

如果开发的是普通 APP 而不是 Canvas 节点，才直接使用公开的 `ai.models.list`、`ai.models.resolve`、`ai.task.submit/query` 和 `ai.artifact.read`。提交的标准任务必须是 `dx-ai-task/v2`，且参数只能来自握手 Schema。

## 7. 自定义业务节点执行器

不调用模型的业务节点可以使用：

- `app-bridge`：由插件 iframe 接收 `dx-canvas-plugin:execute`，适合本地转换和 UI 业务逻辑；
- `skill`：调用已安装功能 Skill；
- `mcp-tool`：调用已授权 MCP 工具；
- `workflow`：调用已登记工作流；
- `agent-tool`：调用宿主开放的 Canvas 工具，例如 `canvas.ai.generate`。

`nodes[].operations` 是更细粒度的节点操作清单。当前第三方运行时适配器仍在扩展中；第三方节点应以 `agent.actions + executor` 作为稳定入口，不要复制内置节点的 `canvas.text.*` executorBinding。

## 8. APP 自己的 Agent 会话

```js
const created = await window.dx.invoke('agent.create', { title: '品牌项目' })
const sessionId = created.sessionId

const run = await window.dx.invoke('agent.run', {
  sessionId,
  goal: '根据当前品牌项目规划三张主视觉',
  context: { selectedAssetIds: ['asset-1'], currentPage: 'brand-board' }
})

// 页面重载后恢复同一会话，而不是自动创建新会话。
const history = await window.dx.invoke('agent.history', { sessionId })
```

系统固定使用 Developer APP Capsule，只开放该 APP 私有项目、系统 media 能力以及该 APP 已声明且获授权的工具。APP 不能通过 context 扩大 Profile 或 Capability Boundary。context 只传稳定 ID 和必要摘要，不传 Token、Cookie 或整份内部数据库。

## 9. agent.tools.json

APP 级工具用于告诉系统 Agent 你的 APP 有哪些小能力。它不会替代 Canvas 节点清单。

```json
{
  "format": "dx-agent-tools/v1",
  "appId": "brand-canvas",
  "tools": [{
    "name": "brand_canvas_search_knowledge",
    "title": "查询品牌知识",
    "description": "从品牌知识 MCP 查询颜色、字体和视觉禁用规则。",
    "whenToUse": ["生成品牌素材前需要核对品牌规范时"],
    "permission": "app.brand-canvas.brand.read",
    "risk": "read",
    "sideEffects": ["call:mcp"],
    "handler": { "type": "mcp-tool", "serverId": "brand-kb", "toolName": "search" },
    "inputSchema": {
      "type": "object",
      "properties": { "query": { "type": "string" } },
      "required": ["query"]
    }
  }]
}
```

当前稳定可执行的 APP Tool handler 是已安装并授权的 `skill` 和 `mcp-tool`。普通 `frontend-bridge` 与 `app-api` 工具可以登记，但只有宿主提供了安全执行映射后才会进入 ready；不能仅靠声明让服务端 Agent 任意调用 iframe 或内部 API。

## 10. 工作流模板

```json
{
  "format": "dx-canvas-templates/v1",
  "templates": [{
    "id": "brand-reference-edit",
    "title": "品牌参考图编辑",
    "nodes": [
      { "id": "prompt", "nodeType": "builtin.prompt", "x": -260, "y": 0 },
      { "id": "generator", "nodeType": "brand-canvas.image-generator", "x": 220, "y": 0 }
    ],
    "connections": [{ "from": "prompt", "to": "generator", "toPort": "prompt" }]
  }]
}
```

模板只定义初始图结构。运行时 Agent 仍根据实际输入、节点能力和 V2 Target 动态判断，不应把业务自然语言解析写成正则或固定模型名单。

## 11. 验收清单

- 已记录参考节点对照，并沿 Registry → Graph Runtime → Execution Adapter → outputs/persistence 完成链路检查。
- 节点使用宿主标准卡片、参数控件、端口和状态；浅色/深色、长内容、取消、错误与缺失占位均可用。
- 安装后扩展中心能看到节点和模板，节点类型位于 `<app-id>.*` 命名空间。
- Canvas Agent 能通过 title/description/semanticRoles/alias 找到节点，并只能执行已声明的 read/run/configure/operation。
- 图片输入能进入 V2 inputs，参考图编辑不会退化为文生图。
- ratio、resolution、count 等参数进入宿主标准参数；不支持规格的高优先级 Target 会被跳过。
- 用户手动运行和 Agent 运行走同一个节点 executor 与结果回写逻辑。
- 重复 requestId 不会重复计费；关闭画布后任务可以用同一 taskId 恢复查询。
- 插件拿不到 API Key，未声明权限、端口或依赖时安装/运行会明确失败。

## 12. 发给 Codex 的提示词

请为 DX OS 开发一个可由 Canvas Agent 操作的画布插件。编码前先阅读 shared/canvasPlugin.ts、校验器、Registry、Graph/Execution Runtime、Canvas Agent Runtime 和 examples/canvas-plugin-story-tools，并列出新节点与最接近内置节点在职责、端口、参数、动作、执行器、UI 状态和结果落点上的对照。使用 dx-app/v2，并提供 dx-app.json、index.html、canvas.nodes.json、canvas.templates.json 和 assets/；节点清单使用 dx-canvas-nodes/v2，每个节点声明 capabilityVersion: 2、semanticRoles、严格类型化 inputs/outputs、agent.aliases/actions 和单一 executor。节点 UI 使用宿主标准卡片、Schema 参数控件、端口、运行/取消/错误/缺失状态和主题，不向主画布注入自定义 DOM/CSS。生成节点必须使用 host.generation + canvas.ai.generate 接入系统统一 Agent Runtime 与 dx-ai-task/v2，不保存 API Key、不写死模型或平台、不直接调用 /api/canvas 或上游 endpoint。agent action 使用 promptParameter: params.prompt 和 acceptsCanvasInputs，让 Canvas Agent 能按端口连接素材并运行节点；需要细粒度读写时声明完整 operations，第三方仅使用 app-bridge 与 canvas.plugin.operation binding。APP 级 Agent 与 Canvas 节点 Agent 分开声明；只有确有 APP 会话需求时才增加 dx-app.json.agent、agent.tools.json 和 app.<id>.agent.run。第三方自定义执行使用 app-bridge、Skill、MCP 或已开放的 agent-tool，不复制内置 canvas.text.* 绑定。最后验证手动运行与 Agent 运行共用同一执行器、参考图进入 V2 inputs、参数规格参与 Target 筛选、结果回写画布、浅色/深色和长内容可用，且项目可持久恢复。