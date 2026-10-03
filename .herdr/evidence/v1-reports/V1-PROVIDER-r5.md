# V1-PROVIDER r5 delivery

status: delivered_with_limits
work_package: V1-PROVIDER r5
date: 2026-10-02
workspace: /Users/apple/Progame/DGOS (main, explicit r5 authorization)

## Files changed

- `src/provider-config/text-profile.mjs`, `text-parameters.mjs`, `task-admission.mjs`, `service.mjs`, `repository.mjs`: exact Profile matching; per-key defaults, tightest text limits, finite parameter and Unicode scalar checks; paired config binding validation; audited/CAS catalog refresh.
- `src/provider-adapters/openai-compatible.mjs`: Responses/Chat snapshot parameter mapping, opt-in `streamResponse:true`, bounded incremental SSE, EOF/completion checks, terminal evidence-only token usage.
- `src/ai-task/service.mjs`, `repository.mjs`: canonical request digest and replay, immutable execution snapshot, transactional admission/Task/Attempt/reservation/audit, locked pre-dispatch recheck, snapshot-only execution, bounded ordered event batches.
- `migrations/0047-ai-task-parameters.sql`: `ai_tasks.execution_snapshot` and `execution_digest` pair. Frozen SHA-256 `22b6e9e886943f2b660de4d54989e0587c58cb67e373fbd45b7140849f6f15f6`. Applied only to `dgos_v1_provider`; migration table confirms same hash. Do not edit this SQL.
- New tests: `tests/provider/openai-compatible-stream.test.mjs`, `provider-parameters.test.mjs`, `provider-parameters-pg.test.mjs`.

## Commands and evidence

- `pwd` in original worktree: `/Users/apple/Progame/DGOS/.worktrees/v1-provider` (exit 0). Later r5 explicitly authorized main workspace.
- `node --test tests/provider/provider-parameters.test.mjs tests/provider/openai-compatible-stream.test.mjs tests/provider/openai-compatible-fixture.test.mjs tests/provider/provider-admission-profile.test.mjs tests/provider/provider-protocol-routes.test.mjs tests/provider/profile-task-wiring.test.mjs tests/integration/ai-task-api.test.mjs tests/integration/provider-api.test.mjs tests/security/provider-egress-stream.test.mjs`: 25 pass, 0 fail, exit 0. Real local TLS fixture yields first delta before upstream EOF; malformed/partial stream and cancellation reject; only completed usage produces trusted token counts and SHA evidence digest.
- `DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_provider node --test tests/provider/provider-parameters-pg.test.mjs tests/provider/provider-audit-atomic.test.mjs tests/provider/provider-text-directory.test.mjs tests/provider/provider-protocol-confirmations.test.mjs tests/integration/postgres-ai-task.test.mjs`: 6 pass, 0 fail, exit 0. Dedicated PG test verifies Responses/Chat bodies, persisted snapshot after worker restart, first `text.delta` before controlled upstream completion, request replay after binding change, no-side-effect invalid parameters, audit rollback, pre-dispatch version denial and released reservation.
- `git diff --check`: exit 0. `shasum -a 256 migrations/0047-ai-task-parameters.sql`: hash above. PG `dgos_schema_migrations` row equals hash.
- A combined test command with `DGOS_DATABASE_URL` on in-memory API tests failed before Provider assertions because unrelated package runtime requires `DGOS_PACKAGE_ROOT` whenever that env var is present. Tests were rerun in correctly separated in-memory and PG groups above; no shared DB was touched.
- Final focused verification after correcting built-in `descriptorDigest`: without `DGOS_DATABASE_URL`, `node --test tests/provider/provider-parameters.test.mjs tests/provider/openai-compatible-stream.test.mjs tests/provider/profile-task-wiring.test.mjs tests/integration/ai-task-api.test.mjs` passed 12/12 (exit 0). With only the dedicated provider URL, `node --test tests/provider/provider-parameters-pg.test.mjs` passed 1/1 (exit 0). `git diff --check` exited 0; 0047 hash stayed unchanged. The earlier broader memory 25/25 and PG 6/6 runs preceded this final digest adjustment.

## Integration notes for Lead

- Existing API and worker entries already inject `createTaskAdmission` with the same `profileDirectory`; bridge `options.parameters` strict allowlist is Lead-owned. Production must keep these injections. `AiTaskService.submit` stores `executionSnapshot` through `PostgresAiTaskRepository.createSubmission`; `AiTaskWorker` loads it from `getTask` and runs the snapshot-selected operation. A custom `providerRunner` should forward `executionSnapshot` to the Adapter if used.
- The built-in Profile snapshot hashes the actual admission-time `adapter.descriptor()` and compares that digest again before dispatch. It does not infer descriptor facts from a hard-coded parameter list.
- Direct repository fixtures that call `createTask` without a snapshot model historical records. For a new production Task, call `AiTaskService.submit` with admission; unsent snapshot-less Task fails closed. An attempt already marked `upstream_dispatch_started_at` follows `upstream_outcome_unknown` recovery before new-dispatch admission, with no resend.
- `tests/integration/network-public-r6.test.mjs` (I-owned) already creates Task through public POST and selects migrations `0047-`; it should not synthesize `execution_snapshot`. On failure inspect Task `error.errorKey` and saved snapshot binding versions. H did not edit I tests or proxy transport.

## Limits and follow-up ownership

- The dedicated PG worker test uses a controlled in-process egress; the public Task HTTP test uses in-memory storage. I owns the separate real CONNECT route test. No real paid Provider or unprovided credential was accessed.
- PG tests did not run the entire V1 suite or Compose lifecycle. Lead/Verify should include 0047 in their isolated migration allowlist and rerun integrated HTTP/worker tests. 0046 remains outside H scope.
- Public SSE event batches are limited to eight ordered records per cursor request. Very large terminal snapshot payloads remain a bridge receipt-size concern for Lead's shared API projection; H did not alter public Task DTO semantics in this package.
- Provider catalog classification/default policy UI semantics remain in D/Lead integration scope; this package preserves existing explicit policy state and does not add UI.

contract_changes_proposed: []
docs_to_update: [V1 implementation status, V1 evidence manifest]
open_risks: [integrated Compose and I CONNECT path pending independent rerun, very large terminal event projection]
uncompleted_items: [full V1 release gate outside Worker-H scope]
