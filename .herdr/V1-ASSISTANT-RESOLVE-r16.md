# V1-ASSISTANT-RESOLVE r16 / Worker-A

status: completed
work_package: V1-ASSISTANT-RESOLVE r16
workspace: `/Users/apple/Progame/DGOS`
baseline_commit: `72ab1cb98b064a6e27b9f60a9f8f00881a827a99` (starting repository HEAD only; current dirty candidate has no commit binding)
files_changed:
  - `src/actions/candidate-routes.mjs`
  - `src/actions/system-actions.mjs`
  - `tests/integration/action-resolve-pg.test.mjs`
  - `.herdr/V1-ASSISTANT-RESOLVE-r16.md`
tests_added:
  - `tests/integration/action-resolve-pg.test.mjs`: real PostgreSQL HTTP resolver, permission-check audit, deny filtering, audit-write failure and zero Action plan/run side effects; explicit parent-name guard for Actions and strict Verify child URL
commands_run:
  - command: `DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_actions node --test tests/integration/action-resolve-pg.test.mjs` before the fix
    result: failed as expected; `POST /api/v1/actions/resolve` returned 500 `internal_error` where the test requires 200
  - command: `DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_actions node --test tests/integration/action-resolve-pg.test.mjs` after the fix
    result: final 2 passed, 0 failed, 0 skipped; isolated child database created, migrated, and dropped by test
  - command: `node --input-type=module -e '...create strict dgos_v1_verify_<hex32> child, spawn node --test tests/integration/action-resolve-pg.test.mjs with child URL, drop exact child...'`
    result: final 2 passed, 0 failed, 0 skipped against `dgos_v1_verify_f8873711f4444712ae36d72bfa470d21`; exact-name temporary Verify database cleanup completed without FORCE
  - command: `env -u DGOS_DATABASE_URL node --test tests/integration/action-resolve-pg.test.mjs`
    result: guard 1 passed; PG case 1 skipped because no database URL was supplied
  - command: `DGOS_DATABASE_URL=postgresql://localhost/dgos node --test --test-name-pattern='resolve uses the authenticated request context' tests/integration/action-resolve-pg.test.mjs`
    result: expected guard failure `action_resolve_requires_dedicated_actions_or_verify_database` before pool creation
  - command: `env -u DGOS_DATABASE_URL node --test tests/integration/action-candidates-wiring.test.mjs tests/integration/action-recovery.test.mjs`
    result: 10 passed, 0 failed, 3 skipped because those existing PG cases require their dedicated database
  - command: `shasum -a 256 migrations/0045-*.sql migrations/0046-*.sql migrations/0047-*.sql migrations/0048-*.sql migrations/0049-*.sql migrations/0050-*.sql migrations/0051-*.sql`
    result: all seven hashes match the read-only `frozenOpsMigrations` allowlist and the delivery-board frozen allocations
  - command: `node --input-type=module -e '...SELECT datname FROM pg_database WHERE datname LIKE dgos_v1_action_resolve_%...'`
    result: 0 residual Action resolver child databases
  - command: `node --check src/actions/candidate-routes.mjs; node --check src/actions/system-actions.mjs; node --check tests/integration/action-resolve-pg.test.mjs; git diff --check -- src/actions/candidate-routes.mjs src/actions/system-actions.mjs`
    result: all exit 0
implementation_facts:
  - The resolver's first visibility pass called `PermissionBroker.check` without a requestId. The broker persisted `permission.check` through `PostgresAuditRepository`, and `audit_events.request_id NOT NULL` caused the observed PG23502/HTTP 500. The route now passes the authenticated HTTP request context's `request.requestId` into the resolver; both visibility and provider-candidate permission checks forward it. The existing final Action permission recheck already used this requestId.
  - The PG regression accepts only `dgos_v1_actions` or exact lowercase `dgos_v1_verify_[0-9a-f]{32}` as its input parent URL; it rejects `dgos`, integrated, malformed/uppercase/extended Verify names and its own generated child names. Before database creation it uses B's read-only `frozenOpsMigrations` selector, checks exactly 47 selected migrations ending at `0051-proxy-provisioning`, and verifies frozen 0045-0051 SHA-256. Future SQL discovered after 0051 cannot be applied. It creates a random `dgos_v1_action_resolve_<hex32>` database, runs the frozen migrations there, then closes API and query pools before plain exact-name `DROP DATABASE` without FORCE. The input parent is never migrated or cleaned. Allowed navigation returns one non-executable candidate with same-request and same-actor persisted `permission.check` audit; explicit deny returns no candidates and still audits. A database trigger rejects permission audit insertion and the request returns 500 with no Action plans, runs, or audit rows for that request.
  - No server, broker, audit, permission policy, public contract, migration, or D15200 resource was changed.
source_sha256:
  src/actions/candidate-routes.mjs: `ed25b80a92ec8be60eeb97e3300aaca85032cb4cba1662d790bba5c48f2cd6aa`
  src/actions/system-actions.mjs: `8068f2cf453afb2f803c56a92470f8fb7481ab5ea42b2963f1cbe59b6168f4cb`
  tests/integration/action-resolve-pg.test.mjs: `cffe87b6eddc21f04bb2d7af28b67c70b0bc8d7c40c1c18afb74ee5cf4dcfd91`
contract_changes_proposed: []
open_risks:
  - D's running 15200 process needs a controlled API restart/reload by D/Lead after these Action files are loaded, followed by a real browser retest against the same final dist. Worker-A did not restart it.
  - The test proves server-injected HTTP with a real isolated PostgreSQL audit store; D owns the full browser and service topology retest.
  - The current shared-tree candidate is uncommitted and has no commit-bound source identity. File hashes above bind this Worker-A result; Lead/Verify must freeze the complete source and artifact identity for final acceptance.
docs_to_update:
  - Lead/Planner may attach this receipt to FR009/FR014 implementation evidence; no authoritative docs were edited under this work package.
incomplete_items: []
lead_or_planner_decisions_needed: []

Stop-writing receipt: Worker-A made no shared server/broker/audit diff and has stopped edits after this report.
