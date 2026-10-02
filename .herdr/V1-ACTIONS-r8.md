# V1-ACTIONS r8 / Worker-A

- status: delivered; stop writing after this report
- work_package: V1-ACTIONS-r8
- workspace: `/Users/apple/Progame/DGOS`
- files_changed: `src/actions/routes.mjs`, `src/actions/service.mjs`, `src/actions/system-actions.mjs`, `src/actions/runtime.mjs`, `src/permissions/builtin-declarations.mjs`, `apps/api/src/system-routes.mjs`, `tests/integration/action-freshness.test.mjs`, `tests/integration/system-http-projection.test.mjs`, `tests/integration/system-permission-rules.test.mjs`, `.herdr/V1-ACTIONS-r8.md`
- tests_added: `tests/integration/action-freshness.test.mjs`; adjusted focused System route fixtures to use `requireFreshAdminSession` with a real session record/fresh deadline
- implementation_facts:
  - Action execute checks server-side plan subject and current risk classification before `requireFreshSession`. High/elevated and sensitive permission/privacy/network actions require a fresh administrator Session. The route fails closed without a verifier; body freshness fields do not authorize execution. Generic `system.settings.patch` receives high risk for sensitive domains.
  - Both generic and per-domain `appPermissions` actions use C's `createSystemPermissionRules` transaction adapter and require `system.settings.write` plus `permission.manage` during plan, execute and worker recheck. The per-domain input schema accepts a rules array. `dgos.system` declares `permission.manage` as a server-owned builtin capability; subject decisions still apply.
  - Action input and permission receipt hashes now use Action-owned stable JSON serialization with sorted object keys and finite numeric values, including floats. The direct System HTTP PATCH uses the same digest and requires fresh Session for network/privacy/appPermissions. Lead has wired `requireFreshSession` into both route registrars in `apps/api/src/server.mjs`.
  - HTTP tests cover stale/forged Session, API Key rejection, confirmation, subject binding, plan expiry, generic sensitive action, direct sensitive PATCH, authorized success, PG permission transaction/audit/replay, cross-path receipt replay, PG JSONB key reorder with float input, requestId replay, and worker permission revocation before handler.
- commands_run:
  - `pwd` -> `/Users/apple/Progame/DGOS`.
  - `DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_actions node --test tests/integration/action-freshness.test.mjs` -> final 2 pass, 0 fail, 0 skip. PG case creates, migrates and drops a random child database; parent is restricted to `dgos_v1_actions`.
  - `env -u DGOS_DATABASE_URL node --test tests/integration/system-http-projection.test.mjs tests/integration/system-permission-rules.test.mjs tests/integration/runtime-api.test.mjs tests/integration/action-recovery.test.mjs tests/unit/runtime.test.mjs` -> 26 pass, 0 fail, 9 skipped for absent dedicated PG URLs. Skips are not counted as pass.
  - `node --check` on changed Action/System route and new test modules -> exit 0; `git diff --check` on changed paths -> exit 0.
  - Exact-name cleanup of 5 failed-run `dgos_v1_action_fresh_<hex32>` child databases; read-only query afterward -> 0 remaining. No `dgos` database or D environment was used.
- source_sha256:
  - `src/actions/routes.mjs`: `24f46714dcec586d7c1bb50e71a53f08c2e9659f77c13dcf11b18782d1300832`
  - `src/actions/service.mjs`: `7ef4d2b572960ef6c5ce7453d47efa52d299f721ea0f8f569ee83db43bd2dd5c`
  - `src/actions/system-actions.mjs`: `a2e394ee710ccd5be1d825765b0fd5a565230585bfb24ddc6904a9fb929cd293`
  - `src/actions/runtime.mjs`: `3502cbb748a7db68e99a6c6065d04c92e37c952e4b5b8e8e71c3dde8eca2cb6d`
  - `src/permissions/builtin-declarations.mjs`: `33ed34f19ffdb618c1c2aa8c3bcd0b87fecd3d8d6315f38fb11275c9f5156c13`
  - `apps/api/src/system-routes.mjs`: `9b1b6b56494a3b848ed5a1178c684a37b24704b2161988797adbdbe0a1242290`
- contract_changes_proposed: []
- open_risks:
  - This package does not modify server/worker integration outside Lead's route callback wiring. Independent Verify should exercise the full process topology.
  - A PG test run with `closeDatabasePools: true` exposed existing Fastify onClose hook ordering: the pool can close before network release. The isolated test uses its child-database teardown instead; Lead owns any shared server fix.
- docs_to_update: FR009/FR010 implementation and evidence status after independent Verify
- incomplete_items: []
- lead_or_planner_decisions_needed: []

## V1-TEST-ISOLATION r14 guard addendum / Worker-A

- status: delivered; stop writing
- work_package: V1-TEST-ISOLATION-r14, Action freshness subset
- files_changed: `tests/integration/action-freshness.test.mjs`, this r8 addendum
- tests_added: a static PostgreSQL parent-name guard test covering the dedicated Actions database, exact lowercase 32-hex Verify database, original `dgos`, malformed Verify names and invalid URL
- commands_run: `pwd` -> `/Users/apple/Progame/DGOS`; `git rev-parse --short HEAD` -> `72ab1cb`; `node --check tests/integration/action-freshness.test.mjs` -> exit 0; `env -u DGOS_DATABASE_URL node --test tests/integration/action-freshness.test.mjs` -> 2 pass, 0 fail, 1 skip (PG absence); `DGOS_DATABASE_URL=postgresql://localhost/dgos node --test --test-name-pattern='PostgreSQL HTTP Action permission' tests/integration/action-freshness.test.mjs` -> expected guard error `action_freshness_requires_dedicated_actions_or_verify_database` before any PG pool or child database is created; `git diff --no-index --check /dev/null tests/integration/action-freshness.test.mjs` -> no whitespace findings (exit 1 because the compared files differ).
- implementation_facts: `allowedParent` now matches only `dgos_v1_actions` or `dgos_v1_verify_[0-9a-f]{32}`. The existing PG case creates, migrates and drops its own exact-name `dgos_v1_action_fresh_<hex32>` child; it does not migrate or clean the parent. The original `dgos` database remains rejected.
- contract_changes_proposed: []
- open_risks: Actual PostgreSQL execution on a Verify parent remains for the final frozen batch. The 1 skipped case above is not a pass.
- docs_to_update: []
- unfinished_items: [] within this static r14 assignment
- lead_or_planner_decisions_needed: []
