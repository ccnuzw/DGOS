# V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28

- Work package: V1-REGRESSION-DIAGNOSTIC r10
- Environment: local Node, isolated PostgreSQL
- Started: 2026-10-02T07:47:28.959Z
- Ended: 2026-10-02T07:47:54.676Z
- Source drift: true; start={"commit":null,"head_commit":"72ab1cb98b064a6e27b9f60a9f8f00881a827a99","working_tree_sha256":"3c5645e53a6a4f105b1835b615cf4dbe383acad2dec1e568460dcbd88d4ccbcc"}; end={"commit":null,"head_commit":"72ab1cb98b064a6e27b9f60a9f8f00881a827a99","working_tree_sha256":"1d9dcfb266cdc957aca578276e305305e89a31cd8d3795e059b73975cf186344"}
- Database: dgos_v1_verify_b202c68e42714d90b29ba5607edc4af2; cleanup: dropped dgos_v1_verify_b202c68e42714d90b29ba5607edc4af2; setup error: none
- Node TAP totals: {"files":90,"passed":269,"failed":1,"skipped":0}. File exit status is recorded separately; skipped tests are not passes.
- Candidate complete: false; excluded files: 14.
- Manifest: docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28-manifest.json

## Executed files

| Phase | File | Exit | Passed | Failed | Skipped | Timeout | Log |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| memory | tests/e2e/assistant-settings-actions.spec.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/001.tap.txt |
| memory | tests/extensions/daemon-r3.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/002.tap.txt |
| memory | tests/extensions/extension-routes.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/003.tap.txt |
| memory | tests/extensions/extension-service.test.mjs | 0 | 7 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/004.tap.txt |
| memory | tests/extensions/hardening-r3.test.mjs | 0 | 5 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/005.tap.txt |
| memory | tests/extensions/mcp-transport.test.mjs | 0 | 8 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/006.tap.txt |
| memory | tests/extensions/runtime-loader-r3.test.mjs | 0 | 2 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/007.tap.txt |
| memory | tests/integration/action-candidates-wiring.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/008.tap.txt |
| memory | tests/integration/ai-task-api.test.mjs | 0 | 5 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/009.tap.txt |
| memory | tests/integration/ai-task-worker.test.mjs | 0 | 4 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/010.tap.txt |
| memory | tests/integration/app-capabilities.test.mjs | 0 | 3 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/011.tap.txt |
| memory | tests/integration/app-package-fixture.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/012.tap.txt |
| memory | tests/integration/audit-outbox.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/013.tap.txt |
| memory | tests/integration/governance-wiring.test.mjs | 0 | 2 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/014.tap.txt |
| memory | tests/integration/identity-api.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/015.tap.txt |
| memory | tests/integration/migration-contract.test.mjs | 0 | 2 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/016.tap.txt |
| memory | tests/integration/permission-write-freshness.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/017.tap.txt |
| memory | tests/integration/provider-admission-wiring.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/018.tap.txt |
| memory | tests/integration/provider-api.test.mjs | 0 | 2 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/019.tap.txt |
| memory | tests/integration/provider-test-loop.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/020.tap.txt |
| memory | tests/integration/provider-worker.test.mjs | 0 | 6 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/021.tap.txt |
| memory | tests/integration/quota-api.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/022.tap.txt |
| memory | tests/integration/quota-reservation.spec.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/023.tap.txt |
| memory | tests/integration/retention-api.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/024.tap.txt |
| memory | tests/integration/usage-settlement.spec.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/025.tap.txt |
| memory | tests/provider/openai-compatible-fixture.test.mjs | 0 | 5 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/026.tap.txt |
| memory | tests/provider/openai-compatible-stream.test.mjs | 0 | 4 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/027.tap.txt |
| memory | tests/provider/profile-task-wiring.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/028.tap.txt |
| memory | tests/provider/provider-admission-profile.test.mjs | 0 | 4 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/029.tap.txt |
| memory | tests/provider/provider-config-disabled.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/030.tap.txt |
| memory | tests/provider/provider-no-export.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/031.tap.txt |
| memory | tests/provider/provider-parameters.test.mjs | 0 | 2 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/032.tap.txt |
| memory | tests/provider/provider-probe.test.mjs | 0 | 2 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/033.tap.txt |
| memory | tests/provider/provider-protocol-routes.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/034.tap.txt |
| memory | tests/security/encrypted-secret-handle.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/035.tap.txt |
| memory | tests/security/governance-hardening-r3.test.mjs | 0 | 3 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/036.tap.txt |
| memory | tests/security/identity-closure.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/037.tap.txt |
| memory | tests/security/key-delegation.test.mjs | 0 | 2 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/038.tap.txt |
| memory | tests/security/provider-egress.test.mjs | 0 | 4 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/039.tap.txt |
| memory | tests/security/rate-limiter.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/040.tap.txt |
| memory | tests/security/request-transport.test.mjs | 0 | 5 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/041.tap.txt |
| memory | tests/security/secret-service.test.mjs | 0 | 2 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/042.tap.txt |
| memory | tests/security/usage-scope.spec.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/043.tap.txt |
| memory | tests/security/v1-governance-e2e.test.mjs | 0 | 4 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/044.tap.txt |
| memory | tests/security/v1-ops-durable-secret.test.mjs | 0 | 12 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/045.tap.txt |
| memory | tests/tooling/release-environment.test.mjs | 0 | 2 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/046.tap.txt |
| memory | tests/tooling/v1-acceptance-tooling.test.mjs | 0 | 14 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/047.tap.txt |
| memory | tests/tooling/v1-ops-release.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/048.tap.txt |
| memory | tests/tooling/v1-performance.test.mjs | 0 | 2 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/049.tap.txt |
| memory | tests/tooling/verify-release.test.mjs | 0 | 12 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/050.tap.txt |
| memory | tests/unit-quota.test.mjs | 0 | 6 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/051.tap.txt |
| memory | tests/unit/app-packages.test.mjs | 0 | 13 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/052.tap.txt |
| memory | tests/unit/runtime.test.mjs | 0 | 8 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/053.tap.txt |
| pg | tests/extensions/management-credential-pg.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/054.tap.txt |
| pg | tests/extensions/management-custom-run-pg.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/055.tap.txt |
| pg | tests/extensions/management-definition-pg.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/056.tap.txt |
| pg | tests/extensions/management-online-pg.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/057.tap.txt |
| pg | tests/extensions/management-routes-pg.test.mjs | 0 | 2 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/058.tap.txt |
| pg | tests/extensions/management-translation-pg.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/059.tap.txt |
| pg | tests/integration/action-freshness.test.mjs | 0 | 3 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/060.tap.txt |
| pg | tests/integration/action-recovery.test.mjs | 0 | 12 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/061.tap.txt |
| pg | tests/integration/action-resolve-pg.test.mjs | 0 | 2 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/062.tap.txt |
| pg | tests/integration/audit-query.test.mjs | 0 | 5 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/063.tap.txt |
| pg | tests/integration/network-context-r7.test.mjs | 0 | 2 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/064.tap.txt |
| pg | tests/integration/permission-action-lifecycle.test.mjs | 0 | 5 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/065.tap.txt |
| pg | tests/integration/postgres-ai-task.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/066.tap.txt |
| pg | tests/integration/postgres-app-packages.test.mjs | 0 | 3 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/067.tap.txt |
| pg | tests/integration/postgres-audit-outbox.test.mjs | 0 | 2 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/068.tap.txt |
| pg | tests/integration/postgres-governance-policy.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/069.tap.txt |
| pg | tests/integration/postgres-identity.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/070.tap.txt |
| pg | tests/integration/postgres-migration.test.mjs | 0 | 2 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/071.tap.txt |
| pg | tests/integration/postgres-package-retention.test.mjs | 1 | 4 | 1 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/072.tap.txt |
| pg | tests/integration/postgres-provider-lease.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/073.tap.txt |
| pg | tests/integration/postgres-provider.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/074.tap.txt |
| pg | tests/integration/postgres-quota.test.mjs | 0 | 2 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/075.tap.txt |
| pg | tests/integration/postgres-retention.test.mjs | 0 | 2 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/076.tap.txt |
| pg | tests/integration/postgres-runtime.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/077.tap.txt |
| pg | tests/integration/proxy-provisioning-r7.test.mjs | 0 | 3 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/078.tap.txt |
| pg | tests/integration/runtime-api.test.mjs | 0 | 3 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/079.tap.txt |
| pg | tests/integration/system-cross-process.test.mjs | 0 | 4 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/080.tap.txt |
| pg | tests/integration/system-http-projection.test.mjs | 0 | 6 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/081.tap.txt |
| pg | tests/integration/system-permission-rules.test.mjs | 0 | 8 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/082.tap.txt |
| pg | tests/provider/provider-audit-atomic.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/083.tap.txt |
| pg | tests/provider/provider-parameters-pg.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/084.tap.txt |
| pg | tests/provider/provider-protocol-confirmations.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/085.tap.txt |
| pg | tests/provider/provider-text-directory.test.mjs | 0 | 2 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/086.tap.txt |
| guarded | tests/extensions/postgres-extension.test.mjs | 0 | 4 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/087.tap.txt |
| guarded | tests/integration/network-runtime-r6.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/088.tap.txt |
| guarded | tests/integration/postgres-ai-task-atomic.test.mjs | 0 | 1 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/089.tap.txt |
| guarded | tests/integration/postgres-governance-hardening-r3.test.mjs | 0 | 2 | 0 | 0 | false | docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/090.tap.txt |

## Failed assertions

- tests/integration/postgres-package-retention.test.mjs: package retention protects references, removes expired failed records, and resumes disk failure (docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T07-47-28-958Z-b5e6fa28/072.tap.txt)

## Excluded or guarded files

- tests/e2e/app-catalog-lifecycle.spec.mjs: Unauthenticated GET smoke does not prove E2E-02 lifecycle
- tests/e2e/assistant.spec.mjs: Unconditional skip; requires a real business-asserting replacement
- tests/e2e/permission-boundary.spec.mjs: Unconditional skip; requires a real business-asserting replacement
- tests/e2e/release-rollback.spec.mjs: Unconditional skip; requires a real business-asserting replacement
- tests/e2e/system-settings.spec.mjs: Unconditional skip; requires a real business-asserting replacement
- tests/integration/app-package-browser.test.mjs: Worker-C/D: signed DGOS_BUNDLE_ENVELOPE and fixed port 15161
- tests/integration/app-package-routes.test.mjs: Worker-C/D: Playwright browser and fixed port 15162
- tests/integration/network-provisioning-public-r7.test.mjs: Worker-I: local TLS/CONNECT and nested dgos_v1_network child; run only with explicit port isolation
- tests/integration/network-public-r6.test.mjs: Worker-I: local TLS/CONNECT and nested dgos_v1_network child; run only with explicit port isolation
- tests/integration/network-settings.test.mjs: Local TLS/CONNECT fixture; fixed port or OpenSSL dependency requires port check
- tests/integration/real-v1-workflow.test.mjs: Worker-H: public Provider subprocess harness; needs exclusive 15171-15172, Redis DB5, and DGOS_VERIFY_ADMIN_URL set to the current random Verify child URL
- tests/integration/redis-security.test.mjs: Use verified Redis DB 6; never DB0 or FLUSHDB
- tests/security/provider-egress-stream.test.mjs: Local TLS/CONNECT fixture; fixed port or OpenSSL dependency requires port check
- tests/security/provider-egress-transport.test.mjs: Local TLS/CONNECT fixture; fixed port or OpenSSL dependency requires port check

## Limitations

- One diagnostic batch while product owners may write; source drift is recorded and not retried.
- Browser, desktop, Redis and TLS groups excluded by task ownership or shared resources.
- Dedicated database-name guards retain actual skip counts; extension guard runs without its dedicated database URL.
- Memory phase has no PG or Redis URL; PG URL is injected only for PG and guarded files.
- This local run does not establish full V1 or release-gate acceptance.
