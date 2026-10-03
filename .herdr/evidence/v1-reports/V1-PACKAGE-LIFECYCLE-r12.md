# V1-PACKAGE-LIFECYCLE-r12

- status: completed_with_environment_limit
- work_package: V1-PACKAGE-LIFECYCLE-r12
- revision: 12
- owner: worker-g
- feature_ids: V1-FR-002, V1-FR-009

## files_changed

- `apps/api/src/package-routes.mjs`
- `tests/integration/app-package-routes.test.mjs`
- `.herdr/V1-PACKAGE-LIFECYCLE-r12.md`
- `state/package-http-evidence/V1-package-http-2026-10-02T07-03-30-444Z-*` (generated release evidence)

## implementation_facts

- Catalog approve/reject/withdraw routes now require a session plus an explicit administrator signal: `isAdmin`, role `admin`/`catalog-admin`, or wildcard admin scope `*`.
- A normal session with `app.catalog.manage` but no administrator signal is rejected with `insufficient_scope` before review mutation.
- Existing signed package verification, catalog visibility, lifecycle install/update/uninstall, protected-preinstall rejection, health rollback, migration journal recovery, durable pointer recovery, data retention, artifact references, and bridge request idempotency remain covered by existing implementation/tests.

## tests_added

- `catalog review requires an explicit administrator role`

## commands_run

- `node --check apps/api/src/package-routes.mjs` -> pass
- `node --check src/apps/package-service.mjs` -> pass
- `node --test tests/unit/app-packages.test.mjs tests/integration/app-package-routes.test.mjs` -> 16 pass, 1 environment failure
- `node scripts/v1-package-http.mjs` -> failed at preflight because sandbox denied `127.0.0.1:5432` (`EPERM`); generated manifest records source no-drift and cleanup complete

## verification_evidence

- Unit/package lifecycle tests: signed package integrity, immutable release/version conflict, install/update/uninstall, protected preinstall, health rollback, migration and interrupted recovery, data retention, bridge receipt idempotency.
- New route test: non-admin session receives 403; `catalog-admin` session approves successfully.
- Browser integration subtest could not bind `127.0.0.1:15162` because the execution environment returns `EPERM`.
- PostgreSQL integration tests are skipped without a configured test database.
- HTTP evidence manifest: `.herdr/state/package-http-evidence/V1-package-http-2026-10-02T07-03-30-444Z-a0a2c16a-manifest.json`.

## contract_changes_proposed

[]

## open_risks

- Full public HTTP lifecycle evidence requires a runtime that permits local PostgreSQL connections on `127.0.0.1:5432`.
- Browser iframe evidence requires permission to listen on the fixture port.
- Approval role fields are supplied by the host authentication layer; this package route does not infer roles from caller input.

## docs_to_update

[]

## limitations

- No migrations, Web source/dist, or V1 implementation-state files were modified.
- No commit, push, cleanup, or unrelated worktree changes performed.
