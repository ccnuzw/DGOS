# V1-EXT r5 交付回报

- status: IMPLEMENTED_LOCAL_VERIFIED；停写交 Lead，未提交、推送或委派。
- work_package: V1-EXT r5，`.herdr/v1-extensions-http-r5.md`，主目录 E 域。
- files_changed: `src/extensions/service.mjs`、`scripts/v1-extension-http.mjs`、`tests/extensions/extension-http-daemon.mjs`、本报告及追加式 HTTP 证据。共享 `apps/api/src/server.mjs` 由 Lead 修，本包未写。
- tests_added: 独立 HTTP harness 使用真实 `buildServer` 路由、PostgreSQL、签名包提交/安装、公开权限决策、一方 Skill 和受控 stdio MCP；daemon 在独立 Node 进程启动、停止、重启。

## 实现事实

- 修复 daemon 执行前 `appAccess` 重检漏传 Skill `packageId` 的问题。此前真实公开 Run 已入队但以 `permission_denied` 终结；补字段后签名应用的精确 packageId/skillId/version/operationIds 依赖可完成执行。
- HTTP 脚本以专属 `dgos_v1_extensions_r3final` 和 15141 运行。通过公开 `/apps` 提交 Ed25519 签名包并安装；扩展执行使用 G 的 active deployment、digest 和 manifest 依赖，不注入恒 true `appAccess` 或确认 hook。管理及应用执行权限均走公开 `/permissions` 显式 `allow`。
- Skill、MCP 均走公开 preview、install、enable、confirmation、invoke、Run query/events；MCP 额外走 connect/tools，随后独立 daemon 进程退出并以新 PID 重启，持久连接恢复后再次调用成功。旧已派 Run 的 `handler_calls=1`。
- 负向路径覆盖非 UUID/未知 UUID session 拒绝、显式权限 deny、排队 Run 取消、活跃 Run 的卸载引用保护、MCP disconnect、Skill/MCP disable/uninstall、session revoke 后读取拒绝。两主体同 ID 的隔离保留在 E 域定向测试；V1 数据库只允许一个 active admin principal，无法用当前公开身份 API 在同一数据库生成两个有效主体，因此没有声称公开 HTTP 双主体通过。

## 命令与证据

- `node scripts/v1-extension-http.mjs`：最终 12 个记录场景通过；最终追加证据 `.herdr/V1-EXT-http-2026-10-02T00-15-58-226Z.json` 与配对 `-manifest.json`（含源码 SHA256）。脚本结束时 API、daemon 和 MCP 子进程均关闭；D 的 15200 环境未操作。
- `DGOS_EXTENSION_TEST_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_extensions_r3final node --test tests/extensions/*.test.mjs`：25 passed、0 failed、0 skipped。
- `node --check scripts/v1-extension-http.mjs`、`node --check tests/extensions/extension-http-daemon.mjs`、`git diff --check`：退出 0。
- `shasum -a 256 migrations/0034-extension-recovery.sql`：`9a6c2e429aa756435d2d8bc885277275c47a547851c1ae0ba60f2bda2c6ff81e`，冻结值未变。
- 失败批次也保留：00:09:02Z 的 Skill `permission_denied` 复现了本域漏传 packageId；00:11:26Z 的恶意非 UUID token 曾返回 500。Lead 修改共享 `currentSession` 后，新独立 API 实例中该 token 返回 401，最终证据已覆盖。其他先前 harness 清理/身份约束失败批次未覆盖写。

## 限制与移交

- open_risks: 本地签名包、macOS sandbox fixture 和专属 PostgreSQL 不等于生产部署。脚本使用 `buildServer` 的真实公共注册与独立 daemon 子进程；未启动生产 CLI/Compose。当前身份 schema 的单 active admin 约束使公开双主体隔离无法在该库验证。
- contract_changes_proposed: 无。`appAccess` 调用补齐内部 packageId，不改变公开 DTO。
- docs_to_update: Lead/Planner 将最终 HTTP 证据与 manifest 链接到 FR003 实现状态；不要将单测双主体证据升级为公开 HTTP 双主体证据。
- incomplete_items: 公开 HTTP 双有效主体同 ID 隔离；生产 CLI/Compose 和目标 OS/egress 验收。
- decisions_needed: 若公开双主体是 V1 必选验收，需要 Lead/Planner 指定符合当前身份模型的第二主体签发路径。
