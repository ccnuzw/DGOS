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

# DX OS MCP 适配开发规范

## 核心逻辑
APP 可以像钉钉一样，把 MCP 清单、服务端实现和所需依赖一起封装进同一个 dx-app ZIP。安装器会解析并校验 `mcp/mcp.json`，把服务注册为该 APP 专属的系统托管能力；用户不需要再打开 MCP 应用重复安装。无密钥、安装后即可运行的包内服务可显式声明 `autoStart: true`，安装完成后由 DX OS 在后台自动启动，点击 APP 的“打开”应直接进入界面。

需要 API Key、Token 或 Authorization 的 MCP 不得声明 autoStart。它们仍随 APP 安装和注册，但在 APP 自己的设置页收集并安全绑定凭据后再启用；不得把用户带到 MCP 应用重新安装。安装器不会执行 npm install，因此运行代码和生产依赖必须已经放进 `mcp/`，或只使用 DX OS 明确提供的运行时。

包是 MCP 定义真源；真实密钥、Headers、启用状态和用户覆盖值不得写入 APP 包、项目文件或浏览器存储。APP 更新会刷新命令、参数和包内工作目录，同时保留已有密钥与启用状态。

## 必要文件
- mcp/mcp.json：标准导入清单，支持 mcpServers、servers 或 mcp.servers。
- mcp/*：MCP 源码或预打包依赖；stdio 的 cwd 只能指向包内 mcp/。
- dx-app.json：dependencies 中声明 type=mcp、source=bundled、path=mcp/mcp.json。
- agent.tools.json：handler.type=mcp-tool，serverId/toolName 与 mcp.json 完全一致。

完整目录结构：

```
dx-app.json
index.html
agent.tools.json
mcp/
  mcp.json
  server.js
```

`mcp.json` 和启动脚本不能放在 ZIP 根目录。对于 `command: "node"`、`args: ["server.js"]`、`cwd: "mcp"`，安装器会检查 `mcp/server.js` 是否存在。若 server.js 依赖第三方 npm 包，必须把生产依赖一并预打包到 `mcp/node_modules/`；安装阶段不会联网下载。

状态语义必须区分：
- `source: "bundled"` 且 `autoStart: true`：安装后自动启用，APP 直接打开；不得再弹出“安装 MCP”。
- `source: "bundled"` 且需要凭据：显示“内置 MCP 待配置”，在 APP 内完成凭据绑定和启用；不得显示“需要安装 MCP”。
- `source: "bundled"` 但注册表中不存在：视为安装损坏，提示重新安装 APP。
- `source: "system"` 或 `source: "external"` 且不存在：才提示前往 MCP 应用安装或配置。

## mcp/mcp.json 示例
```json
{
  "format": "dx-mcp/v1",
  "mcpServers": {
    "weather-mcp": {
      "name": "天气 MCP",
      "command": "node",
      "args": ["server.js"],
      "cwd": "mcp",
      "autoStart": true,
      "env": { "LOG_LEVEL": "info" }
    }
  }
}
```

HTTP MCP 必须使用 HTTPS url；Token、Key、Authorization、Cookie 必须使用 secret 占位符，不得写入包。包含 secret 占位符的服务不能同时声明 `autoStart: true`。

## 依赖与工具绑定示例
```json
{
  "dependencies": [{
    "type": "mcp",
    "id": "weather-mcp",
    "name": "天气 MCP",
    "required": true,
    "source": "bundled",
    "path": "mcp/mcp.json",
    "installHint": "MCP 已封装在 APP 安装包内，无需另行安装。"
  }]
}
```

agent.tools.json 的工具 handler 使用：
```json
{ "type": "mcp-tool", "serverId": "weather-mcp", "toolName": "forecast" }
```

该绑定用于 Tool Catalog 发现和就绪检查；它不是一次实际调用。目标 serverId/toolName 不存在、未启用、未连接或未授权时，工具必须保持 pending/disabled/unavailable，APP 应显示可恢复错误，不得伪造结果。

## 9. MCP 接入与运行示例

### 9.1 APP 如何发起调用并接收结果

前台 APP 使用宿主注入的 `window.dx.invoke`，不能在 iframe 内直接请求 `/api/mcp/*`。下面是当前已实现的完整调用形式：

```js
async function loadForecast(city) {
  try {
    const result = await window.dx.invoke('mcp.call', {
      permission: 'app.weather-panel.weather.read',
      serverId: 'weather-mcp',
      tool: 'forecast',
      args: { city },
      // Bridge 默认 30 秒；普通 MCP 客户端当前默认约 60 秒。
      // 这里延长的只是前端等待时间，不会改变 MCP 服务端超时。
      bridgeTimeoutMs: 65_000
    })
    // 当前返回结构为 { text: string }；非文本 MCP content 会转成 [类型] 占位文本。
    return result.text
  } catch (error) {
    // 未安装、未启用、未连接、权限拒绝、超时和 MCP isError 都会拒绝 Promise。
    throw new Error('天气查询失败：' + (error?.message || String(error)))
  }
}
```

等价的底层消息协议如下。自行实现时必须为每次请求生成唯一 id，并只接收来自 parent、且 id 相同的响应：

```js
parent.postMessage({
  dxos: 'v1',
  type: 'request',
  id: 'mcp-' + crypto.randomUUID(),
  action: 'mcp.call',
  permission: 'app.weather-panel.weather.read',
  serverId: 'weather-mcp',
  tool: 'forecast',
  args: { city: '成都' }
}, '*')

// 成功：{ dxos:'v1', id:'...', ok:true, result:{ text:'...' } }
// 失败：{ dxos:'v1', id:'...', ok:false, error:'...' }
```

`permission` 必须同时出现在 APP 清单/工具声明中并由当前账户获准。它应描述本 APP 的具体业务动作，例如 `app.weather-panel.weather.read`；不要只写宽泛的 `mcp.call`。调用方不能传任意 serverId/toolName，必须限定为本包依赖和 `agent.tools.json` 已声明的组合。

### 9.2 stdio MCP 在哪里运行、支持什么环境

- 已进入系统 MCP Runtime 的 stdio 服务由 DX OS 服务端在宿主设备上启动为子进程，不在 APP iframe 中运行。
- 子进程继承宿主服务进程环境，再叠加 MCP 配置中的 env；命令是否可用取决于正式客户端随附的运行时和宿主 PATH。当前系统连接器已验证 Node.js/npx，个别内置连接器使用随应用提供的 Python；这不等于对第三方 bundled MCP 承诺任意 Node/Python/Java/原生二进制环境。
- bundled MCP 安装后会注册为 APP 托管连接，工作目录解析到当前版本安装包内的 `mcp/`。声明 `autoStart: true` 的无密钥服务会像钉钉内置能力一样在安装后后台启动；未声明 autoStart 或需要凭据的服务保持待配置。安装器不会执行 npm install，因此所有运行代码和依赖必须已经包含在 mcp/ 中，或只使用系统明确提供的运行时。
- HTTP MCP 必须使用 HTTPS，且只有系统安全配置完成并建立连接后才能调用。

### 9.3 超时与输入输出限制

- `window.dx.invoke` 默认等待 30 秒；可用 `bridgeTimeoutMs` 调整为 1 秒至 1 小时。该值只控制前端 Promise 等待时间，不会延长底层 MCP 超时。
- 普通 MCP 工具当前使用 SDK 默认单次超时（约 60 秒）；仅系统内置的特定自动化连接器有单独的 30 分钟例外。第三方 APP 不得依赖该例外。
- MCP 直调请求经过宿主 JSON 接口，当前整个 HTTP JSON 请求体上限为 4 MB，包含 serverId、tool、args 和 JSON 编码开销；因此 args 的可用大小必须小于 4 MB。此值是当前实现上限，不是建议传输大文件的额度。
- 当前没有单独公开、稳定的 MCP 文本输出大小配额，也没有面向 APP 的二进制 MCP content 透传协议；非文本 content 只返回类型占位。大文件必须使用 Artifact/项目文件引用，不能放进 args、Base64 或工具文本结果。正式上架前，平台仍需给出稳定的输入、输出和资源配额。

### 9.4 页面关闭后如何处理

`mcp.call` 是前台请求，不是持久后台任务。关闭或刷新 APP 页面后，iframe、Promise 和响应监听器都会销毁，APP 不会再收到结果；当前宿主也没有把窗口关闭自动转换成 MCP cancel，底层调用可能继续到完成或超时，但结果会被丢弃。开发者不能假设它会继续、会被取消或可以恢复。

因此本规范只支持“页面保持打开，按步骤调用”。需要关闭页面后继续、取消、查询进度或恢复的流程，必须等待平台提供持久 MCP Task/Run 协议；不能用普通 `mcp.call` 模拟后台任务。

## 10. MCP 如何安全读写当前账号的项目

### 10.1 当前账户如何绑定

APP 必须通过 `window.dx.invoke` 进入宿主 Bridge。宿主的项目接口使用当前 DX OS 登录会话，并由服务端从会话取得 userId；APP 不能提交、覆盖或冒充 userId。项目根目录按“当前账户 + appId”确定，同时检查：

1. APP 包已声明对应的 `app.<app-id>.project.read/write/delete` 权限；
2. 当前账户已获准该权限；
3. 服务端只在该账户、该 APP 的项目根目录内解析相对路径。

当前 MCP 直调链路尚未形成可供第三方依赖的“账户身份下传给 MCP”协议，也没有向 MCP 发放可信 userId、登录 Cookie 或项目根路径。MCP 返回的数据不得据此视为已经按当前账号隔离。涉及账号私有数据的 MCP 必须使用平台托管凭据或远端 OAuth 身份，并等待平台明确发布账户绑定契约。

### 10.2 MCP 能否直接访问宿主管理的项目文件

不能假设可以。APP iframe 看不到真实磁盘路径；第三方 MCP 也不会因被 APP 声明而自动获得宿主管理的“项目/<APP 名称>”目录。不要把绝对路径、宿主内部 nodeId、登录 Cookie或整个项目目录交给 MCP。

当前安全数据流是：APP 用 `project.*` 读取最小必要数据 → 作为 MCP 参数传入 → 检查结果 → APP 用 `project.*` 保存。示例：

```js
async function processCurrentDraft() {
  const opened = await window.dx.invoke('project.read', {
    path: 'data/current.json'
  })
  const source = JSON.parse(opened.content)

  const mcp = await window.dx.invoke('mcp.call', {
    permission: 'app.weather-panel.weather.read',
    serverId: 'weather-mcp',
    tool: 'normalize_project',
    args: {
      // 只传工具实际需要的字段；不要传宿主路径或整个项目。
      title: source.title,
      items: source.items
    },
    bridgeTimeoutMs: 65_000
  })

  const normalized = JSON.parse(mcp.text)
  // 保存前由 APP 校验结构、大小和业务约束；MCP 输出不可信。
  await window.dx.invoke('project.write', {
    path: 'outputs/normalized.json',
    content: JSON.stringify(normalized, null, 2)
  })
}
```

检查点也应由 APP 保存到项目目录，例如 `checkpoints/<step>.json`。每一步成功后再写检查点；页面关闭导致调用结果丢失时，不得把该步骤标记为成功。

### 10.3 普通项目文件限制

- 单个文本文件最大 2 MB。
- 单个二进制文件或一次分片上传总量最大 24 MB。
- 分片最大 1 MB，上传会话当前有效期 10 分钟。
- 单个账户下、单个 APP 项目总配额为 256 MB。
- 路径必须是项目根内普通相对路径；禁止绝对路径、`..`、隐藏目录和以点号开头的路径段。
- 大于 MCP 参数承载范围的内容，应保存为项目文件或 Artifact；当前没有把宿主项目文件引用安全委托给任意 MCP 的通用协议，所以不能只传 path 并期待 MCP 自行读取。

## 需要平台开发者确认

下面这句话可原样发给平台开发者：

> 我准备开发一个内置MCP的APP，前台按步骤调用，不要求关闭页面后继续运行。请提供一个完整MCP调用示例，以及运行环境、超时限制、当前账号身份绑定、项目文件读写方式的说明。

开发者仍必须说明账户身份、项目访问和资源配额边界；MCP 被注册或连接成功不代表它自动获得 APP 项目目录或当前账号身份。APP 更新时不得清空项目数据或安全配置。