# V1 认证、安全、Provider connection 与治理 E2E 报告

## 范围

- `V1-E2E-11`: bootstrap/login/session read/renew/revoke、过期会话、登录限流、CSRF/Origin、高风险会话授权。
- `V1-E2E-12`: API key 创建、一次性明文、列表脱敏、scope 隔离、rotate overlap、revoke、expiry、日志/audit 脱敏。
- `V1-E2E-13`: Provider account、binding/connection test、SSRF/private network、credential failure/timeout/cancel worker lease 及无 AI/model refresh 副作用。
- `V1-E2E-14`: request/event correlation、audit redaction、outbox retry、retention preview/execute、checkpoint recovery、治理写操作 CSRF。

## 证据

专用测试为 `tests/security/v1-governance-e2e.test.mjs`，每个用例固定 `testId=V1-E2E-11..14`，请求携带 `requestId`，并断言 `eventId`、`keyId`、`jobId`、`version` 或 `errorKey`。敏感 credential/API key secret 不出现在 response list、audit summary 或 repository audit JSON 中。

真实 PostgreSQL 证据：

```text
DGOS_DATABASE_URL='postgresql://dgos:dgos@127.0.0.1:5432/dgos' pnpm run test:integration
34 passed, 0 skipped
```

覆盖 PostgreSQL identity/key digest/outbox、session renew audit transaction、provider account/connection lease、audit outbox claim/idempotency、retention batch/checkpoint、runtime restart persistence。

## 安全边界

- Origin 存在时必须匹配请求 Host；cookie 写操作还必须提供 `x-dgos-csrf`。
- session revoke 只允许撤销当前 session；越权 provider connection test 在创建队列前拒绝。
- ProviderEgress 仅允许 HTTPS，拒绝 loopback/private/link-local/metadata、重定向和混合 DNS 答案。
- API key rotate/revoke/create 在 PostgreSQL repository 中与 audit/outbox 同事务；rotate 只保留新 key active，旧 key 立即 revoked。
- audit outbox 支持 claim、失败重试、lease 回收和幂等 publish；retention 以 checkpoint 分批执行，可恢复。

## 运行结果

- `pnpm install`: passed
- `pnpm test`: 62 passed, 1 pre-existing environment skip（未设置 `DGOS_DATABASE_URL` 的 runtime restart 测试）
- `pnpm run test:security`: 13 passed
- PostgreSQL integration command above: 34 passed
- `pnpm run check`: passed
- `pnpm -r build`: passed
- `pnpm run migrate:check`: passed, 57 required checks
- `git diff --check`: passed

## 发现并修复

1. PostgreSQL API key repository 缺少事务化 rotate/create/revoke audit 写入；已补齐。
2. API key 内存 repository audit 未共享 API audit repository；已统一委托，避免内存/PG 行为分叉。
3. CSRF 只检查 cookie/header，未校验 Origin；已增加 same-host Origin 校验。
4. provider connection test 归属校验在队列创建后执行；已移到 service 创建前。
5. PostgreSQL identity integration 清理顺序触发 `ai_tasks -> provider_configs` 外键冲突；已先清理依赖表。

## 未完成事项

无本任务范围内未完成事项。专用 E2E 使用内存 Fastify repository；所有 PostgreSQL 持久化结论均来自独立 `DGOS_DATABASE_URL` 集成命令，不将内存结果冒充 PostgreSQL 证据。
