# V1-PACKAGES input r11 delivery

- status: completed; Worker-G stops writing after this report.
- work_package: `.herdr/v1-package-input-r11.md`, V1-FR-002 package input and lock boundary.
- files_changed: `apps/api/src/package-routes.mjs`, `src/apps/package-service.mjs`, `scripts/v1-package-http.mjs`, this report.
- tests_added: the isolated public HTTP script now exercises forbidden body fields and concurrent same-app updates with a real PostgreSQL application lock.

## Implementation facts

Package POST routes validate top-level JSON keys against the frozen OpenAPI request shapes before calling the service. Submit accepts only the signed envelope fields; review/install/update/test-install use release-mutation fields; launch/uninstall use mutation fields; bridge accepts its four declared fields. Unknown fields, including `locked`, `actorId`, `subjectId`, `developerTest`, and source/catalog overrides, return 422 `invalid_request` before package staging or lifecycle writes. The route constructs service inputs explicitly from authenticated actor/subject and route appId. Legitimate `/test-install` still sets `developerTest` inside the route.

`PackageService` no longer recognizes a caller-provided `locked` flag. Its lock-held recursion uses an instance-private Symbol supplied only as an internal second argument for submit, install, uninstall, and recovery. A JSON value cannot reproduce that token. PostgreSQL application and subject locks, optimistic deployment versioning, recovery, and health rollback remain in place.

## Commands and evidence

- `node --check apps/api/src/package-routes.mjs && node --check src/apps/package-service.mjs && node --check scripts/v1-package-http.mjs`: exit 0.
- `node --test tests/unit/app-packages.test.mjs tests/integration/app-package-routes.test.mjs`: 16/16 pass.
- `DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_packages node --test --test-concurrency=1 tests/integration/postgres-app-packages.test.mjs`: 3/3 pass.
- `node scripts/v1-package-http.mjs`: exit 0, 12 stages pass, random DB `dgos_v1_package_http_667e1fe662e44a87b5261f54be7c2b25`, 47 frozen migrations through 0051, port 15161, temporary signing root. Submit overrides did not create a release/stage/audit; install/test-install/update overrides did not create an operation or deployment. Two legal concurrent updates acquired the application lock serially (maximum one active lock), returned one deployment revision, and one distinct successful request; the later unhealthy update rolled back to that revision. The pre-existing Task/Artifact retention and context bridge stages also passed.
- Automatic paired evidence: `.herdr/state/package-http-evidence/V1-package-http-2026-10-02T02-00-26-746Z-667e1fe6.md`, its `-manifest.json`, and `.log.json`. Manifest exit code is 0; before/after dirty source SHA-256 is `0aac82c22930007e07ddb563c18c7f40617060fbfadd1ebc07643dfdc4138590` both times. It binds report SHA-256 `3f42605517b8a270e1b15c2f98797219295866cc6cab6d00d3de68e616e1c829` and log SHA-256 `01d7acb5c010bdea187b5e548bebb5930c39b1d6ee94814e9d20cbe5dee428e9`.
- `git diff --check -- apps/api/src/package-routes.mjs src/apps/package-service.mjs scripts/v1-package-http.mjs`: exit 0. `pg` client query found zero `dgos_v1_package_http_%` databases; manifest reports API, worker route, pool, database, temporary package root and upstream fixture cleanup completed.

Earlier r11 script iterations failed an overly strict operation-row count assertion: recovery marks a prepared row active alongside the completion row. The final assertion checks distinct request IDs and deployment revision, so those failed iterations are not counted as passing evidence. One iteration also recorded concurrent main-tree source drift; the final run has `source_drift=false`.

## Handoff

- contract_changes_proposed: none; public request shapes and `invalid_request` are already in the frozen OpenAPI/error contract.
- open_risks: the concurrency fixture runs two requests against one API process and a real PG advisory lock. Cross-process lock behavior is covered by the repository mechanism but is not separately stressed by this r11 run.
- docs_to_update: Lead/Planner may attach the paired HTTP evidence to V1-FR-002 security and concurrency acceptance.
- incomplete_items: none in this narrow r11 work package.
- decisions_needed: none.
- commits_or_pushes: none. No A package bytes, D 15200 environment, or other owner domain was changed.
