# V1-PERMISSION-SETTINGS r10 / Worker-C

- status: domain_fix_delivered; D environment retest remains with Lead/D
- work_package: V1-PERMISSION-SETTINGS r10, V1-FR-001
- workspace: `/Users/apple/Progame/DGOS`
- files_changed: `src/system/permission-rules.mjs`, `tests/integration/system-permission-rules.test.mjs`, this report
- tests_added: memory and dedicated PostgreSQL history-receipt regression, multiple permission requests, exact replay, audit failure rollback
- contract_changes_proposed: none
- docs_to_update: Lead should attach D's public API/browser retest evidence to V1-FR-001 status

## Cause and fix

D captured a `TypeError` at `JSON.stringify` in `src/system/permission-rules.mjs:50` for HTTP requestId `1bada2a7-9608-45b1-8c74-d0559fc05327` and body requestId `85d8b225-ba14-4aca-b95b-d1cb301aec46`. `normalizeSystemSettings` retained `_requestReceipts` by reference. The permission adapter stored a snapshot containing that same object inside a new receipt, creating a cycle when history was nonempty. The public receipt also embedded internal history.

Added `publicSettings` in the permission adapter. It normalizes the snapshot and removes `_requestReceipts` before the result is placed into the persistent receipt. The containing Settings record still retains previous receipts, so exact idempotent replay works. Both PostgreSQL and in-memory paths use this projection. No System service/repository changes were made by Worker-C in r10.

## Evidence

- `pwd` -> `/Users/apple/Progame/DGOS`.
- Before the source fix, `DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_governance node --test --test-concurrency=1 --test-name-pattern='permission receipts' tests/integration/system-permission-rules.test.mjs` -> 0/2 passed. PostgreSQL returned 500 `Converting circular structure to JSON`; memory showed receipt result containing `_requestReceipts`.
- After the fix, the same targeted command -> 2/2 passed.
- `DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_governance node --test --test-concurrency=1 tests/integration/system-permission-rules.test.mjs tests/integration/system-http-projection.test.mjs tests/integration/system-cross-process.test.mjs` -> 16 passed, 0 failed, 0 skipped. PG and memory tests first write ordinary System settings, then two Permission requests; they check public receipt contents, exact replay, version/event/audit/outbox counts, and no partial state when audit fails.
- `git diff --check -- src/system/permission-rules.mjs tests/integration/system-permission-rules.test.mjs` -> exit 0.
- SHA-256: `src/system/permission-rules.mjs` `76dd0f956225232e15abb8fd5273c3f9c4510b87fdde2284c4b9f0a53666070e`; `tests/integration/system-permission-rules.test.mjs` `bc7de051a0806c38f6802d3b46d8940ce6ef9dc4dc8ff7c8777a9e15f7afd0cd`.
- Dedicated governance database after test cleanup: `system_settings=0`, `permission_decisions=0`, `system_setting_events=0`, `app_package_deployments=0`.

## Limits and handoff

- No access to D's 15200 service/database, so its browser PATCH after restart is not claimed as passed. Lead/D must restart the API and repeat the original flow.
- `src/system/service.mjs` and `src/system/repository.mjs` were already modified by another worker and were not edited in r10.
- unfinished_items_in_worker_scope: []
- Lead_or_Planner_decisions_needed: []
- open_risks: D public environment still needs its own retest; preexisting historical receipts written by other code are preserved without rewriting.

Worker-C stops r10 writes at this report. No commit, push, or delegation.
