# V1-PROVIDER r2 受控整合

H r1已停写。Lead显式授权H在主目录apply_patch转入其r1文件，覆盖worktree主目录只读规则，仅以下路径：

- apps/api/src/provider-service.mjs；apps/worker/src/provider-test-worker.mjs、provider-test-loop.mjs
- src/provider/repository.mjs；src/provider-config/service.mjs、task-admission.mjs、text-profile.mjs；src/provider-adapters/openai-compatible.mjs；src/security/provider-egress.mjs
- migrations/0031-provider-account-bindings.sql、0032-provider-connection-recovery.sql、0033-provider-admission.sql
- tests/integration/provider-api.test.mjs、provider-worker.test.mjs、provider-test-loop.test.mjs；tests/security/provider-egress-transport.test.mjs；tests/provider/provider-admission-profile.test.mjs、provider-config-disabled.test.mjs

先核对目标无他人修改；转入核SHA；不转AGENTS/DELIVERY/依赖，不改ai-task-api.test.mjs（B已整合，Lead做fixture细补丁），server/worker公共入口Lead独占。只语法/diff检查不跑DB，报告.herdr/V1-PROVIDER-r2.md并停写。Verify .herdr/v1-independent-review-r1.md的H审计问题在r3修，此步不静默扩写。
