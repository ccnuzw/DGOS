# V1-TEST-ISOLATION r14 — Worker-C

- status: delivered; static verification only, Verify PostgreSQL batch pending
- work_package: V1-TEST-ISOLATION r14 / Worker-C governance tests
- workspace: `/Users/apple/Progame/DGOS`, baseline `72ab1cb`
- files_changed: `tests/integration/audit-query.test.mjs`, `tests/integration/system-http-projection.test.mjs`, `tests/integration/system-permission-rules.test.mjs`, `tests/integration/postgres-governance-hardening-r3.test.mjs`, `tests/integration/postgres-governance-policy.test.mjs`, this report
- tests_added: none; only existing PostgreSQL test guards and policy fixture cleanup were adjusted

## Commands run

- `pwd` → `/Users/apple/Progame/DGOS`.
- `git status --short` for the five assigned files → all five were already untracked shared-workspace files; their existing test bodies were preserved outside the listed changes.
- `rg -n 'dgos_v1_|allowed|databaseName|DGOS_DATABASE_URL|DELETE FROM|TRUNCATE|DROP|CREATE DATABASE|cleanup|skip'` on the five files → found original governance guards, fixture-scoped cleanup, and one unsafe default-`dgos` fallback in `postgres-governance-policy.test.mjs`.
- `for test_file in tests/integration/{audit-query,system-http-projection,system-permission-rules,postgres-governance-hardening-r3,postgres-governance-policy}.test.mjs; do node --check "$test_file" || exit 1; done` → exit 0, five syntax checks. (Actual shell used the five expanded file paths.)
- `rg -n` reinspection of guards and cleanup plus `git diff --check --` on the five paths → exit 0. Because these files are untracked, `git diff --check` did not prove their full content clean; `node --check` did parse each file.

## Implementation facts

- Each of the five PostgreSQL guard sites now accepts the prior exact `dgos_v1_governance` database name or only `^dgos_v1_verify_[0-9a-f]{32}$`. Absent/malformed `DGOS_DATABASE_URL`, default `dgos`, and nonmatching Verify names remain skipped. No migration is run by these tests.
- The policy test no longer constructs a pool against default `postgres://dgos:dgos@127.0.0.1:5432/dgos` when the environment is absent. It cleans its successful singleton policy update by exact prior version and removes the audit/outbox rows for its own requestId, then closes its pool. Existing fixture cleanup in the other four files is keyed by test-generated IDs.
- The retention hardening test invokes the production retention sweep, which can inspect eligible rows in whatever dedicated database Verify provides. It must run in Verify's fresh random child and in the planned sequential order; this r14 static check does not claim otherwise.

## Contract changes proposed and limits

- contract_changes_proposed: Verify may run these five guarded suites only when `DGOS_DATABASE_URL` points at its own migrated `dgos_v1_verify_<32 lowercase hex>` child. The original governance allowlist remains. A's Actions parent/subdatabase guard is outside this package.
- open_risks: no PostgreSQL run was performed here; whether the final Verify batch passes remains unknown. `system-permission-rules` includes a historic fixed system scope fixture and should run only in a fresh isolated Verify child, not against another worker's active governance database. Retention tests perform actual sweeps within the selected child.
- docs_to_update: Verify should record actual PG case results and child cleanup in its paired final evidence; Lead should not treat this guard edit as test execution.
- unfinished_items: Verify migration, sequential PG execution, and final cleanup evidence.
- lead_or_planner_decisions_needed: none for C's guard edits.

No product source, service, database, migration, commit, push or delegation changed. Stopped writing after this handoff.

## r14 follow-up: System cross-process guard

- Lead explicitly authorized the omitted `tests/integration/system-cross-process.test.mjs` guard. Its original `dgos_v1_governance` allowlist now also accepts only `^dgos_v1_verify_[0-9a-f]{32}$`; malformed/absent URL and unrelated names still skip. No test body or cleanup changed.
- A static `rg -n 'dgos_v1_governance|dgos_v1_verify_' tests/integration tests/security` review found no other governance-only mixed predicate after this edit. Actions/Provider/network predicates remain their domain owners' responsibility. This is a text scan, not execution evidence.
- `node --check tests/integration/system-cross-process.test.mjs` passed (exit 0). No PostgreSQL test, migration, or service/database operation was run in this follow-up. Verify retains final child-database execution and cleanup evidence.
