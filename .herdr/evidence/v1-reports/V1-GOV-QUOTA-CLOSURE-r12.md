# V1-GOV-QUOTA-CLOSURE r12 / Worker-C

- status: delivered
- work_package: V1-GOV-QUOTA-CLOSURE-r12
- revision: 12
- feature_ids: V1-FR-014, V1-FR-015
- workspace: `/Users/apple/Progame/DGOS`
- files_changed:
  - `src/audit/retention.mjs`
  - `.herdr/V1-GOV-QUOTA-CLOSURE-r12.md`
- tests_added: []

## Implementation facts

- Retention execution now validates the stored policy version, actor binding, preview confirmation, and a fresh preview digest for every planned PostgreSQL job, even when package retention is not attached.
- Retention remains fail-closed when the progress audit cannot be recorded: the enclosing transaction rolls back deletion and checkpoint progress.
- Existing r11/r6 implementation covers atomic audit/outbox writes, published-outbox protection, reference protection for revoked sessions, quota admission/settlement/reconciliation and subject scope isolation.

## Commands and results

- `node --test tests/integration/audit-outbox.test.mjs tests/integration/retention-api.test.mjs tests/integration/quota-api.test.mjs tests/unit-quota.test.mjs tests/security/governance-hardening-r3.test.mjs tests/security/v1-governance-e2e.test.mjs` -> 16 passed, 0 failed, 0 skipped.
- `node --test tests/integration/retention-api.test.mjs tests/security/v1-governance-e2e.test.mjs tests/integration/postgres-retention.test.mjs` -> 5 passed, 0 failed, 2 skipped; PostgreSQL unavailable in this sandbox (`connect EPERM 127.0.0.1:5432`).
- `node --check src/audit/retention.mjs` -> exit 0.
- `git diff --check -- src/audit/retention.mjs` -> exit 0.

## contract_changes_proposed

[]

## docs_to_update

[]

## unfinished_items_in_worker_scope

[]

## open_risks

- Dedicated PostgreSQL retention/quota evidence could not run in this environment because local TCP access to PostgreSQL is denied. No production or integrated-database claim is made.
- No migration, Web source, V1 implementation-state, approval, commit, push, or delegation was performed.

## Lead_or_Planner_decisions_needed

[]
