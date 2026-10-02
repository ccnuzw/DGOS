# V1-PERMISSION-SETTINGS r8 / Worker-C

- status: delivered_domain; public API/UI acceptance remains for Lead/D
- work_package: V1-PERMISSION-SETTINGS r8, V1-FR-001
- workspace: `/Users/apple/Progame/DGOS`, shared main tree; no commit/push/delegation
- files_changed: `src/system/permission-rules.mjs`, `src/permissions/repository.mjs`, `src/permissions/postgres-repository.mjs`, `src/system/repository.mjs`, `apps/api/src/system-routes.mjs`, `tests/integration/system-permission-rules.test.mjs`, this report
- tests_added: authoritative list, authenticated subject binding, declaration rejection, extra `permission.manage`, replay, deny precedence, batch audit/outbox, mid-batch failure rollback and concurrent System CAS

## Factory and scope contract

`createSystemPermissionRules({ permissionRepository: permissions.repository, systemRepository: system.repository, audit })` returns `{ list, patch }`. Lead's `apps/api/src/server.mjs` now passes this result as `permissionRules` to `registerSystemRoutes`; both PostgreSQL repositories must share the same pool. `GET /system/settings` reads `appPermissions` from `permission_decisions` by the authenticated subject. `PATCH` to `appPermissions` requires both `system.settings.write` and `permission.manage`; the route calls `writeAuth` for each and never trusts a body admin flag.

Existing Permission storage treats scope as an opaque string, with `'*'` as the default. The unique public `PermissionRule.scope` projection is `{ value: '<stored scope string>' }`; input accepts exactly this one-field object and stores its value unchanged. It is not a new scope matcher. Planner should record this mapping in the public Settings/Permission contract. Batch PATCH changes exactly the listed rules; it does not delete omitted rules. Revocation remains a `deny` decision.

Only rules for the authenticated subject and `subjectType:'user'` can be written here. Each requested capability must be declared by an active, approved/official installed package or a trusted built-in declaration. An existing `deny` cannot be changed to `allow` by this batch path. Duplicate rule keys, undeclared capabilities and cross-subject input fail without effects.

## Atomicity and idempotency

PostgreSQL `patch` locks the `system_settings` row, checks `baseVersion` and the requestId/fingerprint receipt, validates every rule, then writes all `permission_decisions`, increments System settings/context versions once, inserts one context event, and writes permission plus System audit/outbox in the same transaction. A failed second audit insert rolls back the first rule, both audits/outbox, the System version and event. Replaying the same requestId returns the original snapshot and rule array even after a later independent permission change; changed fingerprint returns 409. No new SQL or 0045 migration was needed. The in-memory repository has a corresponding guarded path and rollback for its test audit store.

## Commands and evidence

- `pwd` -> `/Users/apple/Progame/DGOS`.
- `DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_governance node --test tests/integration/system-permission-rules.test.mjs tests/integration/system-http-projection.test.mjs tests/integration/system-cross-process.test.mjs` -> 12 passed, 0 failed, 0 skipped. Only the dedicated governance DB was used. The r8 PG case asserted two permission changes + one System change yield three audit/outbox events, one System version/context increment, and no partial state after a second-audit failure.
- `git diff --check -- src/permissions/repository.mjs src/permissions/postgres-repository.mjs src/system/permission-rules.mjs src/system/repository.mjs apps/api/src/system-routes.mjs tests/integration/system-permission-rules.test.mjs` -> exit 0.
- SHA-256: `src/system/permission-rules.mjs` bcfe73ff0e5f50519b589ae999f76a56ff9bc94cbe22e7bf8015a5562ebd1a0c; `src/permissions/repository.mjs` 1442e8444cfc12d60260f0f605306e20993b71fcf795ac03bcd388ca68257e93; `src/permissions/postgres-repository.mjs` a2a7aa4be9ce2ad6ddc1541886ef4af3d87c16d5a18dc489ff2529f87314e411; `apps/api/src/system-routes.mjs` 68a02abde6b026210c7fac1ebe7aa8df533eb8dc3d46bcd48b078f077d1e7542; `tests/integration/system-permission-rules.test.mjs` 893e24afba51684d266562713b9050609dddaa9174d6bc5d3369138c438b3a59.

## Limits and follow-through

- Lead has wired the factory in main `server.mjs`; this report does not claim an external API/container run after restart. D owns actual Settings UI integration. Lead/Verify should run the public API and UI flows after the shared API restart.
- The dedicated governance DB lacks the older `permission_change_receipts` table. One test probe through the unrelated single-rule `decide` failed for that schema reason; the test was corrected to write the later rule through the repository's existing transaction API. r8 batch itself stores replay receipts in System JSON and requires no 0045 migration. No other DB was touched.
- `SystemSettingsSnapshot.appPermissions` is now sourced from the Permission repository when the factory is present. The prior r7 fail-closed omission remains only when no adapter is supplied.
- docs_to_update: Planner should record the single `{value}` scope mapping and rule-batch PATCH semantics; Lead should attach public API/UI evidence to FR-001 implementation state.
- unfinished_items_in_worker_scope: []
- Lead_or_Planner_decisions_needed: none for code; Planner contract mapping and Lead/D acceptance are follow-through.

Worker-C stops r8 domain writes after this handoff.
