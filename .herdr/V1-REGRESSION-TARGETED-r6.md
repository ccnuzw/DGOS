# V1-REGRESSION-SWEEP r6：定向复核

status: passed
scope:
  - 仅复跑 r5 失败的 `tests/unit/runtime.test.mjs` 和 `tests/integration/usage-settlement.spec.mjs`；主产品与领域测试只读。
checks:
  - `rg -n 'DGOS_DATABASE_URL|DATABASE_URL|postgres|redis|buildServer|new SystemService|new QuotaService|test\(' tests/unit/runtime.test.mjs tests/integration/usage-settlement.spec.mjs`：退出码 0；两文件使用内存仓库，未见 DB/Redis 连接。
  - `env | rg '^(DGOS_DATABASE_URL|DATABASE_URL|DGOS_EXTENSION_TEST_DATABASE_URL|DGOS_REDIS_URL|REDIS_URL)=' || true`：无匹配输出；本次 shell 未带相关连接 URL。
  - `env -u DGOS_DATABASE_URL node --test tests/unit/runtime.test.mjs tests/integration/usage-settlement.spec.mjs`：退出码 0；TAP `tests 9 / pass 9 / fail 0 / skipped 0 / cancelled 0 / todo 0`。其中 usage settlement 1/1、runtime 8/8。
  - `shasum -a 256 tests/unit/runtime.test.mjs tests/integration/usage-settlement.spec.mjs src/system/service.mjs src/quota/service.mjs`：测试前后退出码 0，四份摘要一致。
evidence_level: local
verified:
  - 2026-10-02T00:40:22Z（UTC），主工作区 `/Users/apple/Progame/DGOS`，HEAD `72ab1cb98b064a6e27b9f60a9f8f00881a827a99`；工作树有未提交改动，HEAD 不是被测源码身份。
  - SHA256 `tests/unit/runtime.test.mjs`: `42933b7f1a4f29dcaebac369658402b2f71dd026d5166b76d36d28b7f909a415`。
  - SHA256 `tests/integration/usage-settlement.spec.mjs`: `4bc1565b7b73bae82b67d861cebb2f4d72157e5a85b7dd62f9c96d0db2d263df`。
  - SHA256 `src/system/service.mjs`: `7f45e34addbd30af8a6aad9decdbc0b6274bb1efff44567aa244a1d9ee4f9276`。
  - SHA256 `src/quota/service.mjs`: `4920922239f6fe21fef672b2d08592b385c99cb0a9c8f6da040a0f4f597ee768`。
limitations:
  - 本次仅为两个原失败文件的内存定向复核；未运行全扫、PG、浏览器、D 15200 服务或发布门禁。四文件摘要不覆盖全部传递依赖，不能声明全源码冻结。
  - r5 两轮失败/漂移报告与日志原样保留；r6 通过不改写其历史结论。
return_to_lead:
  - 两个定向失败已在当前快照独立复跑通过。待 A/G/C 与浏览器缺口收敛及候选源码冻结后，再派独立全版回归和证据核查。
