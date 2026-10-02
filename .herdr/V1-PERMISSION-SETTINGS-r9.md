# V1-PERMISSION-SETTINGS r9 / Worker-C

- status: unresolved_external_500; dedicated database and current main API path return 200
- work_package: V1-PERMISSION-SETTINGS r9 / V1-FR-001
- workspace: `/Users/apple/Progame/DGOS`; no commit, push, delegation, or D 15200 access
- changed: `tests/integration/system-permission-rules.test.mjs` (two real PostgreSQL cases); this report. No production source edit.

## D observation and exact boundary

D observed `PATCH /system/settings` with body `{requestId:<UUID>,baseVersion:"10",domain:"appPermissions",patch:{rules:[{appId:"dgos.ai-workbench",subjectType:"user",subjectId:"c2fee94e-bd71-46b8-b1fa-79f75b736773",capability:"dgos.model.list",scope:{value:"*"},decision:"allow"}]}}` returning HTTP 500 / `internal_error`. Its HTTP requestId is `437e9a43-c3fb-48ac-aa65-58770cdcd202`. The body requestId was not supplied, only its UUID type. The server exception and whether the original request committed are unknown.

The main server has `createSystemPermissionRules({ permissionRepository: permissions.repository, systemRepository: system.repository, audit })` at `apps/api/src/server.mjs:231`. `apps/api/src/system-routes.mjs:39-47` checks the System receipt, extra `permission.manage`, body subject, then calls the transactional adapter. `src/system/permission-rules.mjs:31-52` locks the System row, validates the package declaration, updates Permission, System version/event, and audit in one transaction. `src/permissions/postgres-repository.mjs:14` reads the installed package release manifest. The r9 tests exercise those same paths with the actual `apps/ai-workbench-package/manifest.json`.

## Dedicated database evidence

`dgos_v1_governance` initially lacked `app_package_deployments`; the first new test failed at fixture INSERT with PostgreSQL `42P01`, before PATCH. Applied exact checked migrations 0028 and 0029 there, then applied the other 19 missing existing repository migrations through `discoverMigrations/buildMigrationSql` for current `buildServer` startup; no checksum mismatch existed. No other database was touched.

1. Real `PostgresPermissionRepository` + `PostgresSystemRepository`, installed official package, version 10, one `allow` rule: HTTP 200, version 11, authoritative rule persisted.
2. Main `buildServer` with real PostgreSQL runtime pool and session authorization, D's exact subjectId and HTTP requestId, `baseVersion:"10"`, official installed workbench and seven preexisting `allow` rules: HTTP 200, version 11, seven projected rules, `dgos.model.list` still `allow`, one permission and one System audit row. Repeating the same body requestId returns the identical projection without a second audit. The fresh body requestId differs from D's unknown body UUID.
3. `DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_governance node --test --test-concurrency=1 tests/integration/system-permission-rules.test.mjs tests/integration/system-http-projection.test.mjs tests/integration/system-cross-process.test.mjs` -> 14 passed, 0 failed, 0 skipped.
4. Post-test dedicated DB counts: `admin_principals=0`, `system_settings=0`, `app_package_releases=0`, `app_package_deployments=0`. `git diff --check -- tests/integration/system-permission-rules.test.mjs` -> exit 0.

## Remaining diagnosis for Lead/D

Current source and a matching installed-package fixture did not reproduce 500. This is **not** proof the D failure is fixed. Inspect the main API exception for HTTP requestId `437e9a43-c3fb-48ac-aa65-58770cdcd202` and record the PostgreSQL error code, table/constraint, and stack. Then read the D environment's System version and `_requestReceipts` entry keyed by the authenticated subject and original body requestId, plus the package deployment/release declaration and permission/audit/outbox rows. Use the actual body UUID to determine whether the original request committed; do not assume an HTTP 500 implies no side effects. Compare the running API source/build and applied migration checksums to this tree. If the exception is a domain defect, return the stack and precise state for a narrow follow-up. Worker-C did not access or modify D's 15200 group or its database.

Worker-C stops r9 writes at this report; the external 500 remains open pending its server exception evidence.
