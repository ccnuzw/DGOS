# V1-EXT r4 交付回报

- status: IMPLEMENTED_LOCAL_VERIFIED；已停写，未提交、推送或委派。
- work_package: V1-EXT r4，主目录 `.herdr/v1-continuation-r5.md` E 段；E 独占源码和测试路径。
- files_changed: `src/extensions/runtime.mjs`、`src/extensions/service.mjs`、`src/extensions/repository.mjs`、`apps/extension-runner/src/mcp-transport.mjs`、`tests/extensions/hardening-r3.test.mjs`、`tests/extensions/mcp-transport.test.mjs`、`tests/extensions/postgres-extension.test.mjs`、`tests/extensions/runtime-loader-r3.test.mjs`、本报告。未修改 `migrations/0034-extension-recovery.sql`。
- tests_added: G manifest 精确 Skill packageId/skillId/version/operationIds 与 MCP sourceId/version/operationIds；同 requestId 出票字段冲突、过期、Run 消费后精确重放；HTTP MCP 私网 HTTPS 目标拒绝；加载配置后真实 stdio MCP 预览、安装、启用、连接和工具调用。

## 实现事实

- `createDeploymentAppAccess` 现在只接受冻结 manifest 的结构化依赖字段。Skill 必须匹配 packageId、skillId、version、operationIds；MCP 必须匹配 sourceId、version、operationIds。移除 `extensionId/sourceId/skillId` 别名和单一可选 `operationId` 通配行为。Service 传入已安装记录的 packageId 与扩展版本。
- HTTP MCP 的生产 profile 由 loader 注入共享 `ProviderEgress`，每次 POST 和断开 DELETE 均经 HTTPS、DNS 地址过滤、固定解析目标、TLS 校验、禁止重定向和响应上限路径。测试 fixture 的显式 `allowHttpFixture` 继续只在直接构造测试 runner 时使用；部署配置 loader 不传播该字段。
- 确认出票同 subject/requestId 重放比较 app、kind、extension、operation、version 和 inputDigest，字段不同返回 `request_conflict`，已过期票据不续期。已有 Run 在新执行校验之前按完整公开执行身份与 input digest 比较并返回原 Run；UUID 票据同时比较已消费状态和绑定。新 Run 仍只接受未过期 approved 票据并原子消费。
- 配置 loader 在非测试环境要求 macOS `macos-restricted` 或 Linux `linux-bwrap` profile；Linux runner 使用 `bwrap` 的只读根、网络命名空间、独立 `/proc` 和 `/dev`。生产是否具备可执行 `bwrap`、内核 namespace 权限和目标二进制依赖仍须在目标宿主验证。

## 命令与证据

- `DGOS_EXTENSION_TEST_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_extensions_r3final node --test tests/extensions/*.test.mjs`：25 passed、0 failed、0 skipped。仅用 E 专属库，未操作 B 的 15200 Compose。
- E 模块及测试逐文件 `node --check`：退出 0；`git diff --check`：退出 0。
- `shasum -a 256 migrations/0034-extension-recovery.sql`：`9a6c2e429aa756435d2d8bc885277275c47a547851c1ae0ba60f2bda2c6ff81e`，与 r3 冻结值一致。

## 限制与移交

- open_risks: `.herdr/P0-DOC-r2.md` 在本轮主目录中未找到；实现按已冻结 `V1-app-manifest.schema.json` 和 `V1-extension.openapi.yaml` 核对。HTTP SSRF 测试覆盖私网解析拒绝，未做真实公网/生产网络测试。Linux `bwrap` 分支未在本 macOS 宿主运行，不能称 OS 隔离已跨平台验证。
- contract_changes_proposed: 无。若 Planner 的 P0-DOC-r2 存在其他路径，请 Lead 对照此报告检查字段漂移。
- docs_to_update: Lead/Planner 在集成环境验证后回写 FR003 状态与证据，保留 fixture、专属 PG 和生产部署证据分级。
- incomplete_items: 目标 Linux 宿主 `bwrap` 启动与拒绝文件/网络 probe；生产 MCP HTTPS 端点的 TLS、出站策略和真实调用验证。
- decisions_needed: 批准的生产 MCP endpoint/egress policy 清单与 Linux sandbox 部署依赖。
