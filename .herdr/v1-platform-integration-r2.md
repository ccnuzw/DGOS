# V1-EXT / V1-PACKAGES / V1-OPS r2 受控整合

E/G/I 的 r1 已交付并停写。Lead 显式授权原执行者在主目录整合各自以下不重叠路径；本修订覆盖原 worktree 主目录只读规则。原 worktree 作为冻结来源。

先逐路径核对主目录基线/未提交变化，不覆盖意外修改；以 apply_patch 转入并验证文件 SHA 一致。不复制 AGENTS、DELIVERY、依赖、target/dist等生成目录。不提交推送，不运行数据库测试。只做模块语法与差异检查；领域实跑与公共入口由Lead绑定整合候选后执行。完成写 `.herdr/V1-EXT-r2.md` / `V1-PACKAGES-r2.md` / `V1-OPS-r2.md` 后停写。

## E / V1-EXT

来源 `.worktrees/v1-extensions`。授权全部新 `src/extensions/*.mjs`、`apps/extension-runner/src/*.mjs`、`apps/api/src/extension-routes.mjs`、`migrations/0025-extension-registry.sql`、`0026-extension-runs.sql`、`0027-extension-run-events.sql`、`tests/extensions/*.mjs`。引用/凭据/确认/应用依赖hooks及MCP跨进程协调仍待后续，不填虚假实现。

## G / V1-PACKAGES

来源 `.worktrees/v1-packages`。授权 `src/apps/manifest-validator.mjs`、`package-service.mjs`、`package-repository.mjs`、`postgres-package-repository.mjs`、`apps/api/src/package-routes.mjs`、新0028–0030三SQL、`tests/unit/app-packages.test.mjs`、`tests/integration/postgres-app-packages.test.mjs`。**tests/unit/runtime.test.mjs 不转**，与A冲突，精确manifest fixture差异报Lead处理。旧校验器替换会影响尚未升级fixture，明确不代表完整回归通过。

## I / V1-OPS

来源 `.worktrees/v1-ops`。授权新 `src/security/durable-secret-service.mjs`、`runtime-config.mjs`、`scripts/v1-ops-*.mjs`、`deployment/` 内本包源码配置（不含生成密钥、备份、制品）、`docker-compose.production.yml`、`tests/security/v1-ops-durable-secret.test.mjs`。先检查待转文件有无凭据/本地路径，保持r1不包含秘密。公共server/worker/根依赖由Lead掌握。
