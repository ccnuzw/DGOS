# V1-OPS r3

I r2已停写，Lead授权主目录原I精确路径继续，禁止旧worktree覆盖。修实际Secret问题并定向测试：

- 当前AES AAD不含revoked/keyId/digest等完整控制元数据，revoke只改未认证revoked布尔，篡改false可复活；认证全部访问控制状态，撤销/轮换重认证且版本单调，不破坏旧合法已加密文件（若需要新format显式迁移）。补flip revoked/TTL/purpose/subject/version负例。
- verifyCiphertext遇到并发正常.lock或.tmp即拒绝会导致API/worker启动争用，区分正在进行操作与损坏/遗留锁；保持可验证持久状态与安全恢复，不静默删正在使用的lock。
- auditAccess必须可供生产包装层真实注入，普通Secret操作携带requestId/用途/主体，审计失败读拒绝。给Lead exact wiring和一致匿名摘要，禁止暴露SecretRef秘密。
- 整合后生产wrapper readiness要反映真实DB/secret依赖；Dockerfile需兼容D新增pnpm依赖/构建，可静态+镜像构建验证，勿生产部署。

范围原durable-secret/runtime-config/scripts/v1-ops/deployment/production compose及本领域测试，server/worker由Lead持有。隔离tmp和15181–15189，报告 `.herdr/V1-OPS-r3.md` 后停写。不提交推送。
