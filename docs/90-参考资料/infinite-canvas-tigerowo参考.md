# infinite-canvas-tigerowo 深度复核参考

本文件记录对 `/Users/apple/Progame/infinite-canvas-tigerowo` 的代码和文档复核结果。它只提供产品行为、交互细节和领域建模启发；DGOS 不继承该项目的 Go/Next.js、Three.js 组织方式、iframe 边界、localforage/localStorage、本地 Blob、内部消息名或供应商接口。

## 复核范围

| 来源 | 观察重点 |
| --- | --- |
| `docs/overview/features.md` | 画布节点、全景图和 3D 导演台的功能说明 |
| `docs/canvas/canvas-node-manual.md` | 节点类型、连接和工作流使用语义 |
| `docs/backend/canvas-data-structure.md` | 画布实体、引用关系和持久化边界的产品线索 |
| `web/src/app/(user)/canvas/components/canvas-director.tsx` | 导演台入口、画布节点生命周期和输出回写入口 |
| `canvas-director-node-panel.tsx` | 导演台节点面板、打开/全屏/删除和状态操作 |
| `canvas-camera-control.tsx` | 相机属性、导演视角/机位视角和构图控制 |
| `canvas-client-page.tsx`、`types.ts`、`utils/canvas-camera.ts` | 画布选择、视口/相机状态和节点集成线索 |
| `web/public/director/assets/index-oQuo7db8.js` | 场景树、对象变换、时间线、截图和视频导出的可观察行为 |

## 可借鉴的产品语义

| 观察 | DGOS 设计输入 |
| --- | --- |
| 全景图是独立节点能力，图片可按普通背景或 equirectangular 全景使用 | 导演台使用 `panorama.in` many 端口；边保存投影模式和 artifact 引用，来源失效时显示缺失而不伪造预览 |
| 导演台是画布中的独立 3D 子工作区 | 画布节点只保存 `directorProject` 引用和能力摘要，场景对象不能展开成普通画布节点 |
| 场景树同时管理角色、模型、群众和机位 | `SceneObject`、`DirectorCamera`、`CrowdGroup` 使用稳定 ID；选择、可见性、锁定和变换状态可恢复 |
| 导演视角和机位视角是不同工作模式 | 视图切换不修改场景对象；截图和导出明确记录相机来源 |
| 视口有比例框、九宫格、方向球和阻尼控制 | 构图辅助属于场景设置/视图状态，不进入视频画面；吸附与网格显示分离 |
| 支持当前视角、当前机位、四方位、十二方位截图 | `DirectorCapture` 记录批次、模式、相机快照、时间和稳定 artifact；批量回写按稳定间距排布节点 |
| 关键帧覆盖对象变换、角色姿势、相机和群众组 | 时间线轨道按领域对象归属；自动记录只记录明确修改的可动画属性 |
| 时间线有 30 FPS 吸附、最高 60 FPS 预览、循环、曲线控制柄和范围缩放 | 时间线保存 fps、当前时间、循环和曲线数据；拖动关键帧一次提交为单个撤销单元 |
| 活动机位可以按时间线导出 MP4，导出不包含编辑器 UI | 生成 `DirectorRunSnapshot` 冻结场景/机位/时间线；默认 1280×720、30 FPS、H.264 只是产品默认值，最终以宿主能力握手为准 |
| 输出图片/视频在导演台删除后仍然存在 | 回写结果是独立 artifact 与画布节点；删除导演台只解除边，不级联删除已完成结果 |
| 本地模型缺失时仍保留布置参数 | `SceneAsset` 保存缺失状态和 transform；重新导入后恢复布置，不写入私有路径或临时下载 URL |

## 失败与边界证据

- 代码/界面中出现模型库 HTTP 404 时，只能记录为“模型能力缺失/不可用”的用户状态，不能反推出固定服务端路径或接口契约。
- 导出、截图、模型导入和云端同步是不同能力；打开导演台不自动授予上传、外部渲染或高成本任务权限。
- 导演台截图缓存可作为设备级临时记录，但发送到画布后必须转为稳定 artifact；不能用浏览器缓存键代表跨设备同步。
- 场景文件格式、多人协作合并、服务端渲染队列和真实 `project.*` 字段在参考项目中不足以形成 DGOS 公共契约。

## 不继承清单

| 参考实现 | DGOS 处理 |
| --- | --- |
| Go/Next.js/Three.js 组件组织 | 只复用行为，技术栈由 DGOS 架构另行决定 |
| iframe/postMessage 或内部事件名 | 不写入节点、artifact 或任务公共契约 |
| localforage/localStorage 和浏览器 Blob | 不作为项目主数据或长期 artifact 存储 |
| `/api/canvas/*`、供应商直连和内部模型库 URL | 不继承这些接口；未来由 DGOS 自有 Project、AI Task、Artifact 和权限协议承载同类能力，具体契约另行冻结 |
| tigerowo 内部场景文件/节点字段 | 转换为 DGOS 的 `DirectorProject`、`DirectorRunSnapshot` 和 `DirectorCapture` |

## DGOS 落盘位置

- 产品行为和 AC13：[`无限画布与项目`](../03-功能规格/V2/04-无限画布/01-无限画布与项目.md)。
- 领域与回写设计：[`3D 导演台专项技术设计`](../03-功能规格/V5/04-无限画布/03-3D导演台专项-技术设计.md)。
- 公共数据模型：[`V1 数据模型`](../04-技术架构/当前版本/V1-数据模型.md)。
- 验收执行：[`V1 E2E 用例矩阵`](../05-测试与发布/端到端验收/用例矩阵.md)。
