# V1-EXT r3 交付回报

- status: IMPLEMENTED_LOCAL_VERIFIED；停写交 Lead，未提交或推送。
- work_package: V1-EXT r3，FR003/V1 扩展切片；主目录 E 独占路径。
- code_version: `72ab1cb` 加主目录未提交改动，2026-10-02。此版本标识不是可复现提交哈希。
- files_changed: `src/extensions/`、`apps/extension-runner/`、`apps/api/src/extension-routes.mjs`、`tests/extensions/`、`migrations/0034-extension-recovery.sql`、本报告。旧 `0025`–`0027` 未改。Lead 的 `server.mjs`、`worker.mjs` 接线由 Lead 修改，本包未写。
- tests_added: subject 相同 MCP ID 隔离；API/worker 双实例连接 intent 与恢复；Run 取消与审计回滚；确认票据绑定、消费和相同请求重试；daemon 并发及关闭；受控 stdio/HTTP MCP transport；macOS sandbox fixture。

## 实现事实

- Live MCP 连接以 subject、kind、extension ID、version、config digest 绑定。API `connect` 持久记录 `connecting` intent，由 worker 的 daemon 执行 MCP initialize、tools/list、tools/call、断开；API 不把本进程不存在的 transport 报为已连接。worker 重启后先恢复连接再 claim queued Run，已 claim 的工具调用不盲重放。
- Run 终态/事件/audit 和连接状态/audit 在 PostgreSQL 事务内收敛；Secret 撤销采用持久 intent。跨进程取消可使运行中的 handler 收到取消。
- `POST /api/v1/extensions/confirmations` 使用冻结公开 receipt 形状，票据绑定 subject、app、kind、tool、version、input digest 和 requestId，在 Run 创建事务中单次消费。同一请求和输入重试返回原 Run；改输入或换 requestId 被拒。
- API 路由只接受声明的 body 字段，路径 kind/id 和鉴权 subject 在 spread 后赋值。公开 `stateVersion`、Run state/sequence 与路由响应有真实 API 测试。
- `src/extensions/runtime.mjs` 异步读取绝对路径配置，提供 `loadExtensionRuntime({configPath,packageRepository,audit,permissions,secretService,pool})` 和 `loadIntoExtensionRuntime({configPath,sourceResolver,runner})`。`src/extensions/v1-default-runtime.json` 是可加载的一方 Skill 来源；部署方需把 `DGOS_EXTENSION_CONFIG_FILE` 指向此绝对路径或批准的生产配置。`createDeploymentAppAccess(packageRepository)` 检查 G 的 active deployment、包 digest/catalog、manifest `dependencies.{apps,skills,mcp}` 与 capability 允许项。
- Lead 的 API `buildServer` 同步注册 `registerExtensionRoutes`，Fastify `onReady` 异步加载配置；worker 配置存在时异步加载 runtime、建立 `ExtensionService` 和 `ExtensionRunDaemon`。daemon 限制每轮并发，捕获 tick 失败，`stop()` 等待活动 tick 并关闭 runner，然后 worker 才关闭 pool。

## 命令与证据

- 专属 PostgreSQL `dgos_v1_extensions_r3final` 已应用最终 0034；执行 `DGOS_EXTENSION_TEST_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_extensions_r3final node --test tests/extensions/*.test.mjs`：23 passed、0 failed、0 skipped。本次最终重试回归也在该库通过。Lead 的 15200 integrated DB 未操作。
- `for f in src/extensions/*.mjs apps/extension-runner/src/*.mjs apps/api/src/extension-routes.mjs tests/extensions/*.test.mjs; do node --check "$f" || exit 1; done`：退出 0。
- `git diff --check`：退出 0。
- `shasum -a 256 migrations/0034-extension-recovery.sql`：`9a6c2e429aa756435d2d8bc885277275c47a547851c1ae0ba60f2bda2c6ff81e`。0034 SQL/checksum 已冻结，可由 Lead 应用；开发期旧 `dgos_v1_extensions` 有中间 checksum，最终证据仅取 `dgos_v1_extensions_r3final`。

## 限制与移交

- open_risks: macOS `sandbox-exec` 受控 fixture 已实际运行独立 stdio MCP 进程，fixture 内文件写和 localhost 网络尝试被拒；此证据不等于所有生产 host 的 OS sandbox 保证。生产 stdio profile 应指定已批准的绝对 command/cwd、参数、最小环境与 `macos-restricted` sandbox；非 macOS 部署需另行提供等效隔离。HTTP endpoint profile 已校验 HTTPS 和 `egressPolicyId`，但生产网络 egress policy 的实际强制执行仍由部署层负责。
- open_risks: 默认 JSON 只有一方 Skill 来源，外部 MCP profile/endpoint 需部署明确配置；当前 profile 不是任意 command/cwd/env 的用户透传。
- contract_changes_proposed: 无。公开 DTO 按 `docs/04-技术架构/当前版本/V1-extension.openapi.yaml`。
- docs_to_update: Lead/Planner 在集成验收后更新 V1 实现状态与 FR003 验收证据；本地 fixture 和生产隔离证据需分别登记。
- incomplete_items: 生产 OS/HTTP egress 部署验证、Lead integrated DB 应用冻结 0034 与全链路验收。
- decisions_needed: 生产平台的 sandbox/egress 部署策略和批准的外部 MCP profile 清单。
