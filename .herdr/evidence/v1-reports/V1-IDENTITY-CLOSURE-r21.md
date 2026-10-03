# V1-IDENTITY-CLOSURE-r21

- status: review
- work_package: `V1-IDENTITY-CLOSURE-r21`
- revision: 21
- feature_ids: `V1-FR-010`, `V1-FR-011`

## files_changed

- `apps/api/src/server.mjs` (high-risk API Key writes require `requireFreshSession`)
- `src/identity/repository.mjs` (in-memory session/audit rollback)
- `tests/integration/identity-api.test.mjs`
- `tests/integration/postgres-identity.test.mjs`
- `tests/security/identity-closure.test.mjs`
- `tests/provider/evidence/V1-IDENTITY-CLOSURE-r21.json`

Existing concurrent changes were present in `apps/api/src/identity-service.mjs` and related identity paths; this report does not attribute those unrelated hunks to r21.

## commands_run

1. `node --check apps/api/src/identity-service.mjs && node --check apps/api/src/identity-routes.mjs && node --check src/identity/repository.mjs && node --check tests/integration/identity-api.test.mjs && node --check tests/integration/postgres-identity.test.mjs && node --check tests/security/identity-closure.test.mjs` -> passed.
2. `node --test tests/integration/identity-api.test.mjs tests/integration/postgres-identity.test.mjs tests/security/identity-closure.test.mjs` -> 2 passed, 1 skipped.
3. Secret leakage scan over authorized identity paths -> no production logging/secret matches; fixture credentials and protocol header references only.

## implementation_facts

- Session and API Key high-risk mutations now require a current fresh server session, including create, rotate, and revoke.
- Owner and delegated scope validation is enforced in the identity service.
- In-memory audit failure restores the prior session state and removes a session created before audit failure.
- PostgreSQL repository already uses transaction-scoped audit writes for rotation/revoke; the PG test now checks rollback, owner denial, and visibility from a second repository instance.

## limitations

- Real PostgreSQL child-database execution was not possible in this environment: `connect EPERM 127.0.0.1:5432`; the test skipped without claiming PG pass.
- No migration, web source, implementation-state, or approval files were changed.
- Cross-instance revoke evidence remains pending a runnable PostgreSQL service.

## docs_to_update

- Lead/Planner should attach this report and `tests/provider/evidence/V1-IDENTITY-CLOSURE-r21.json` to FR-010/011 verification records.
- V1 implementation status remains Lead-owned and was intentionally not modified.

## stop_write_confirmation

Worker-A has stopped writing for V1-IDENTITY-CLOSURE-r21 after producing the above evidence.
