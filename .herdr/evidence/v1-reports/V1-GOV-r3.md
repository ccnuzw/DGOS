# V1-GOV r3 领域可靠性交付

- status: partial
- work_package: V1-GOV-r3 / DGOS-V1-IMPLEMENT-20261002
- cwd: `/Users/apple/Progame/DGOS`
- files_changed: `src/identity/repository.mjs`, `apps/api/src/identity-service.mjs`, `src/security/rate-limiter.mjs`, `src/audit/retention.mjs`, `apps/api/src/governance-service.mjs`, 本报告
- tests_added: `tests/security/governance-hardening-r3.test.mjs`, `tests/integration/postgres-governance-hardening-r3.test.mjs`
- contract_changes_proposed: []

## 实现事实

- 登录的 session 与审计现在经 `PostgresIdentityRepository.createSessionWithAudit` 同事务提交；审计失败回滚 session。内存仓储先写审计再发布 session。bootstrap 失败会撤销本次随机 SecretRef；内存 bootstrap 失败恢复本次 principal/session 状态。保留了 Lead 的 `InMemoryIdentityRepository.findPrincipalByHint` 同时接受 `principalId` 和 `credentialRef` 的修复。
- 新增 `createLoginBackoff({ redis, namespace, prefix, clock, windowMs, baseDelayMs, maxDelayMs })`，Redis 版由 Lua 原子维护主体和来源两组递增退避，键内只存 SHA-256 指纹。接口为 `check({ subject, source })`、`failure({ subject, source })`、`success({ subject })`；`check` 返回 `{ allowed, retryAfterMs }`。旧 `createRateLimiter` 未变。
- Retention 计划可在未确认时创建，但 `runJob` 拒绝无确认的破坏性执行。策略版本必须仍匹配；确认摘要由 `previewRetention()` 生成并与作业绑定。已撤销会话只有过 30 天且无审计事件引用时才清理；审计事件仍按 180 天及未发布 outbox 保护清理。Task/Artifact 未纳入自动删除。

## Lead 接线

- 登录入口可注入 `const backoff = createLoginBackoff({ redis, namespace: 'v1-gov' })`，请求前调用 `check({ subject: request.body?.principalHint, source: request.ip })`，失败认证后调用 `failure`，成功后调用 `success({ subject })`。`failure` 的 `retryAfterMs` 用于 429/Retry-After。Redis 使用 DB3 和本包前缀测试；生产应使用受控 Redis 配置与共享实例。当前 `server.mjs` 仍使用旧 `loginLimiter`，本次未改 Lead 独占入口。
- 现有 `governance.startRetention({ previewDigest, requestId, actorId })` 会把服务器预览摘要绑定为确认；未传摘要则仅创建不可执行计划。`governance.runRetention(jobId, requestId, actorId, confirmation)` 可接受与作业摘要相同的明确确认。Lead 当前 run 路由不传 body；使用已确认计划即可执行。应从 GET retention preview 返回的 `previewDigest` 提交，不直接构造摘要。
- 对外错误 `retention_preview_conflict`、`version_conflict`、`permission_denied` 需由公共入口维持安全映射。没有改公共机器 schema、`server.mjs` 或 `worker.mjs`。

## 命令与真实结果

- `node --test tests/security/governance-hardening-r3.test.mjs`: exit 0，3/3。
- `node --test tests/security/governance-hardening-r3.test.mjs tests/security/rate-limiter.test.mjs tests/security/key-delegation.test.mjs`: exit 0，6/6。
- `DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_governance node --test --test-concurrency=1 tests/integration/postgres-governance-hardening-r3.test.mjs`: exit 0，2/2；证明登录审计失败回滚、未确认清理拒绝、确认后清理及被审计引用会话保留。
- 专属库 `dgos_schema_migrations` 与当前 0022–0024 checksum 比对：3/3 匹配；未重新迁移或操作 integrated/original `dgos` 库。
- Redis DB3 两个 `RedisLoginBackoff` 实例共享同一临时 `v1-gov:r3-*` prefix：跨实例阻断与成功后来源阻断通过；测试只删除该临时前缀键，未 flush。
- `git diff --check -- <5 domain paths>`: exit 0。
- `node --test tests/integration/governance-wiring.test.mjs`: exit 1，0/2；当前公共 `buildServer` 初始化返回动作注册列表错误，未进入治理断言。其在 r3 开工前由 Lead 记录为 4/4；本次未改公共入口或动作域，需要 Lead 复核整合状态。
- 既有专属库回归 `postgres-identity`, `postgres-retention`, `postgres-governance-policy` 顺序运行：exit 1，2/4；identity/policy 通过，两个旧 retention 用例因直接 `runJob` 未提供确认摘要返回 `retention_preview_conflict`。r3 范围仅允许新增专项测试，未修改旧测试文件。
- 既有 API/E2E 联合运行：exit 1，3/9；错误同样在公共 `buildServer` 初始化的动作注册阶段，未据此宣称治理行为失败或通过。

## 限制与后续

- 当前登录路由尚未接新共享退避类；主体/来源真实 HTTP 429 行为未经集成验证。Origin/CSRF 细化仍在公共入口边界。
- Retention 只安全执行审计和已撤销会话两类；没有自动清理尚无安全引用契约的缓存/失败安装记录。旧测试需按预览确认契约更新。生产保留策略验证未做。
- 公共 `governance-wiring` 失败需 Lead 按自身入口和动作注册改动定位。所有本包数据库测试仅在专属库；Redis 仅 DB3；无生产证据。

open_risks: [公共入口与动作注册阻断集成测试, 登录退避待接线, 旧 retention 测试待更新, 其他保留分类和生产验证未完成]
docs_to_update: [FR-010/014 实现与验证、V1 实现状态、治理 E2E 矩阵]
needs_lead_or_planner_decision: []
