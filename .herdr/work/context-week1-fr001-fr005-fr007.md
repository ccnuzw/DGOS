# Context-pack：Week 1 Wave 1（FR-001 / FR-005 / FR-007）

## 目标

单机 macOS/本地 Web 可演示最小闭环：DGOS 启动并显示 Workbench；配置已验证 Provider，选择可用文本模型，提交文本任务，获得 SSE 增量、同一 taskId 终态和结果展示。

## 当前事实

- FR-001：状态为本地验证。桌面 r6、网络 r7、UI r6 有局部证据；native r13/r14 仍有 handshake/frame-present/Workbench 完整链阻塞。
- FR-005：状态为本地验证。Provider r6、Workbench r9、UI r5 有局部证据；最终 Web/macOS 签名链、断线/取消/未知提交恢复和完整终态矩阵未闭环。
- FR-007：状态为本地验证。Provider r5/r6 有 Profile、参数、快照、准入；UI r5 有真实配置和动态参数任务；分类默认、失败禁用、刷新并发/审计和完整 UI 负例待补。
- 所有局部证据均不等于统一候选、外部 Provider 或发布通过。

## 权威规格

- `docs/03-功能规格/V1/01-桌面与系统/01-桌面与应用工作区.md`
- `docs/03-功能规格/V1/05-AI工作流/01-多模态AI任务工作流.md`
- `docs/03-功能规格/V1/07-模型与配置/01-模型平台与工作流配置.md`
- `docs/04-技术架构/当前版本/V1-openapi.yaml`
- `docs/02-产品与版本/当前版本/V1-实现状态.md`

## 核心 AC

### FR-001

- AC01：已安装且兼容的 APP 可从桌面入口启动并创建可聚焦窗口。
- AC03：系统/应用状态来自 DGOS 权威服务，服务不可用不得用缓存冒充。
- AC04/AC05：系统外观、倍率、语言/地区上下文由 DGOS 统一注入。
- AC06：代理路由统一，修改后显示待重启状态。
- AC07/AC08：权限三态和 APP/Agent 能力授权分离，副作用前重新判定。

### FR-005

- AC01：文本模型握手成功后提交任务，查询同一 taskId 至终态并展示结果。
- AC02：失败/重复提交不产生第二 taskId、重复 Provider 调用或重复 Artifact。
- AC08：SSE 增量有序，断线可恢复，不泄露凭据/Provider 私有字段。

### FR-007

- Provider 配置通过 Secret 引用，验证成功后才可拉取模型。
- 只允许 active、available、enabled 且能力匹配的模型进入任务选择器。
- 目录刷新失败保留旧目录并标 stale；策略更新使用版本/CAS。
- 首发协议为 `openai-compatible`，V1 仅交付 `text.chat`。

## 关键不变量

1. 不把 Provider endpoint、API Key、供应商任务 ID 放入 APP、日志、SSE 或 Artifact 预览。
2. `requestId + subject + target + inputDigest` 保证提交幂等；未知上游结果禁止盲目重发。
3. Task 终态只写一次，旧轮询/旧事件不能覆盖新终态。
4. Provider 验证和模型目录刷新是两个动作；失败不自动启用或伪造可用。
5. native 与 Web 共用前端语义，但 Web 证据不能替代 native GUI 证据。

## 依赖

- FR-010 Session/权限主体
- FR-012 Provider 账号与 Secret 引用
- FR-013 连接测试/ProviderEgress
- FR-015 quota reservation/settlement/release
- FR-002 应用包/安装/健康检查
- FR-003 Capability Broker/扩展协同（仅使用既有契约）

## 建议命令入口

命令必须由 Worker/Verify 按当前仓库脚本确认后写入 manifest，不得照抄旧批次命令。目标至少包括：

```sh
node scripts/check-docs.mjs
pnpm run check
node --test tests/integration/ai-task-api.test.mjs
node --test tests/provider/openai-compatible-stream.test.mjs
```

native 真实执行使用当前 `apps/desktop/scripts/` 入口；最终 manifest 必须绑定当前源码/构建 hash、资产 hash、环境、命令、结果和限制。

## 禁止越界

- 不实现 V2 Project、V3 Canvas、V4 媒体/资产、V5 插件。
- 不把 mock/fixture/静态审查写成真实候选通过。
- 不重写公共字段、状态机、错误码或 migration；发现冲突先回 Lead/Planner 形成冻结决策。
