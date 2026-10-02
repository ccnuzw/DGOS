# V1-ACTIONS r5 handoff

- status: A-domain r5 implemented and focused tests passed; Lead-owned candidate projection remains for integration.
- work_package: `V1-ACTIONS-r5` / `DGOS-V1-IMPLEMENT-20261002`.
- worker: Worker-A, Codex; cwd: `/Users/apple/Progame/DGOS`.
- files_changed: `src/actions/package-actions.mjs`, `src/actions/public-declaration.mjs`, `src/actions/service.mjs`, `src/permissions/repository.mjs`, `tests/unit/runtime.test.mjs`, `tests/integration/permission-action-lifecycle.test.mjs`, this report. Prior r4 changes in the dirty shared tree were preserved.
- tests_added: strict ActionDeclaration enum and capability checks, public projection, owner spoofing at plan/execute, installed manifest permission fixture.

## Implementation facts

- Package ActionDeclaration accepts exactly frozen `risk=read/write/external/destructive`, `sideEffects=none/local-write/external-call/model-call/secret-use/destructive`, `confirmation=none/required/elevated`, `idempotency=safe/required/unsupported`. It requires namespaced actionId, exact SemVer, localized label, object schemas, nonempty unique `requiredCapabilities` wholly in both manifest arrays, boolean cancellable, and a server registered handler ID. Side effects require confirmation. Internal riskLevel remains an adapter field; original public enums persist in the definition. PG bigint actionVersion is normalized to number across rehydrate/sync.
- `publicActionDeclaration(action)` in `src/actions/public-declaration.mjs` is the shared factory for public Action list/candidates. `ActionService.list()` returns the frozen public fields and enum values. Lead should import this factory in Lead-owned `src/actions/candidate-routes.mjs`, where current risk derivation still maps an external action to `write` or `destructive`; use `publicActionDeclaration(action).risk` instead. Candidate permission filtering should check every required capability, matching `ActionService.checkActionPermissions`.
- `ActionService.plan/execute/processOne` always use the registry action's ownerAppId and check every declared capability; caller `body.appId` cannot replace owner or bypass a denied second capability. Plan/execute do not enqueue after denial.
- `InMemoryPermissionRepository({ appRepository })` reads active installed app and catalog release manifest, then intersects permissions with capabilityAllowlist. Shared `runtime.test.mjs` now creates a valid manifest, submits and installs the app before permission/action checks. This fixture no longer treats request `declared` as trusted.

## Commands and evidence

- `pwd`: `/Users/apple/Progame/DGOS`.
- Read `.herdr/v1-continuation-r5.md` A section, `.herdr/P0-DOC-r2.md`, V1 manifest ActionDeclaration JSON schema, main OpenAPI ActionDeclaration, existing source and tests.
- `DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_actions node --test --test-concurrency=1 tests/integration/permission-action-lifecycle.test.mjs tests/integration/action-recovery.test.mjs tests/integration/system-cross-process.test.mjs`: exit 0; 20 passed, 0 failed, 0 skipped. Dedicated local actions PostgreSQL only.
- `node --test --test-concurrency=1 tests/unit/runtime.test.mjs`: exit 0; 8 passed, 0 failed, 0 skipped.
- `node --check` on changed JS/test modules and `git diff --check`: exit 0.
- `shasum -a 256 migrations/0038-permission-action-lifecycle.sql`: `5542368a6fa955ac58440a3a223ef662fb1a54a62a883ae2fd8ffa2daf9608bd`. SQL0038 unchanged and frozen.

## Handoff and limits

- contract_changes_proposed: none; projection follows the frozen P0-DOC-r2 and machine schema.
- open_risks: Lead-owned candidate route still infers risk from internal fields and checks only the first capability; Lead should consume the new factory and all-capability check. `src/actions/runtime.mjs` and `src/actions/candidate-routes.mjs` were not edited. Shared API/worker integration and full V1 gates require Lead/Verify evidence.
- docs_to_update: Planner/Lead should attach integrated results to FR-009 only after Lead candidate and API wiring are verified.
- unfinished_A_items: []
- Lead_or_Planner_decisions: []

No original `dgos` DB use, commit, push, or delegation. Worker-A stops writing after this report.
