# V1-GOV r11 / Worker-C

- status: domain_delivered; Lead main API route registered; D/public environment retest pending
- work_package: V1-GOV r11, V1-FR-014 AC02/03/05
- workspace: `/Users/apple/Progame/DGOS`; base HEAD `72ab1cb`
- files_changed: `src/audit/outbox.mjs`, new `apps/api/src/audit-routes.mjs`, new `tests/integration/audit-query.test.mjs`, this report. Lead independently changed `apps/api/src/server.mjs`; Worker-C did not edit it.
- tests_added: scoped audit query and self-audit, redaction and cursor pages, standalone PostgreSQL event/outbox atomicity with failure injection, caller transaction rollback, real `buildServer` audit query, and fresh authenticated public governance policy concurrency.

## Implementation facts

`registerAuditRoutes(app, { audit, requireScope })` owns only `GET /api/v1/audit/events`. Lead replaced the prior inline route with this module at `apps/api/src/server.mjs:209`, avoiding duplicate registration. The handler checks `audit.read`, rejects unknown/invalid query fields, restricts API Keys to their authenticated actor, appends one `audit.query` event with an empty summary, then returns the page. Failed audit insertion returns an error without disclosing the page. Session authorization remains via the host's `requireScope`.

`PostgresAuditRepository.record(event, client?)` now opens a transaction when no transaction client is supplied (including an explicit reference to its own pool); the event and outbox insert commit together. A caller-supplied PG client remains in the caller transaction. Failure injected at outbox insertion left zero event rows. Queries use bounded date/action/UUID/limit/cursor validation, actor restriction, PostgreSQL microsecond cursor precision, and the same public projection for PG and memory.

Public summaries use a finite field allowlist. It preserves safe correlation identifiers such as `taskId`, `attemptId`, `runId`, `accountId`, `actionId`, `modelId`, versions, state, `reasonCode`, errors and bounded counts; it drops `credential`, token, private path, nested objects, freeform reasons and unrecognized keys. Target IDs with path-like content become null in the public projection. Raw stored audit rows remain unchanged.

Two independent fresh administrator sessions sent different policy values with the same baseVersion through current `buildServer`: one HTTP 200 and one HTTP 409; policy version increased once, with exactly one `governance.policy.update` event and one outbox row. API Key attempt to write policy was denied by the freshness gate (`step_up_required`).

## Commands and results

- `pwd` -> `/Users/apple/Progame/DGOS`; `git rev-parse --short HEAD` -> `72ab1cb`.
- `DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_governance node --test tests/integration/audit-query.test.mjs` -> 5 passed, 0 failed, 0 skipped. Dedicated governance DB only.
- `env -u DGOS_DATABASE_URL node --test --test-concurrency=1 tests/integration/governance-wiring.test.mjs tests/security/v1-governance-e2e.test.mjs tests/integration/audit-query.test.mjs` -> 8 passed, 0 failed, 3 PG cases skipped by their dedicated-DB guard.
- `node --check src/audit/outbox.mjs`; `node --check apps/api/src/audit-routes.mjs`; `node --check tests/integration/audit-query.test.mjs`; `git diff --check -- src/audit/outbox.mjs` -> all exit 0.
- SHA-256: `src/audit/outbox.mjs` `42e01ce90d52cd84e86941cca8528602dafbbc5d81a9fe9b2a299e3aaed837be`; `apps/api/src/audit-routes.mjs` `e458c4672556ca4a4bbd35d6a72b7bb6b0f563802411ddaa6cbdfa92a97e492a`; `tests/integration/audit-query.test.mjs` `843dd5d6e0c88e962317510f50cc97f19306044f612b54346c2a302f79ae1a73`.
- Dedicated DB cleanup read: zero `fixture.audit`, `fixture.pool`, `audit.query` event rows; zero `admin_principals`; `governance_policy.policy_version=6` restored to its value before the r11 concurrency test.

## Limits and handoff

An attempted mixed run with `DGOS_DATABASE_URL` set for four test files exited 1 (7 passed, 10 failed): older memory tests unintentionally entered PG startup and I's new `network_route_targets` / `network_route_instances` schema is not yet in the dedicated governance DB. This was not counted as r11 acceptance. The isolated memory and dedicated PG commands above are the valid evidence. I owns System network/migration; G owns retention. No D 15200 service/database was used.

- contract_changes_proposed: none beyond the existing OpenAPI redacted query envelope.
- docs_to_update: Lead/Planner should attach r11 evidence to FR-014 AC02/03/05 and record actual public environment retest; OpenAPI implementation status is still marked planned.
- unfinished_items_in_worker_scope: []
- open_risks: D/public environment query and migration-integrated regression remain unverified; other domain writers' historical raw summaries stay in storage but are redacted on query.
- Lead_or_Planner_decisions_needed: []

Worker-C stops r11 writes here. No commit, push, or delegation.
