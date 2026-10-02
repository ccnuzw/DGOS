# V1-PACKAGES r3 independent review return

`status`: partial_ready_for_lead_integration  
`work_package`: V1-PACKAGES/r3  
`files_changed`: `src/apps/package-service.mjs`, `package-repository.mjs`, `postgres-package-repository.mjs`, `apps/api/src/package-routes.mjs`, `migrations/0035-package-recovery.sql`, `tests/unit/app-packages.test.mjs`, `tests/integration/postgres-app-packages.test.mjs`, this report.  
`tests_added`: PG audit failure and pointer interruption/restart assertions; resource/launch and bundled-root unit cases.  
`contract_changes_proposed`: none to frozen manifest/envelope; launch response adds `entrypoint` and `isolation`, health distinguishes `integrityHealthy` from `runtimeChecked`, requiring Planner/OpenAPI projection review.  
`docs_to_update`: OpenAPI launch/health/resource projection and FR002 verification after Lead integration.

## Implemented facts

- PostgreSQL repository now holds a session advisory lock across an app lifecycle call. SQL issued inside the lock uses the same client. Each durable transition uses an explicit DB transaction; package/review/deployment rows and `audit_events` plus `audit_outbox` are committed or rolled back together. A `prepared` operation and its audit event are committed before disk pointer mutation.
- `ready()` invokes `recoverAll()`, which enumerates deployment rows and prepared operations. It reconciles disk pointer against authoritative deployment under the app lock, settles prepared records, and retries the installed/uninstalled Action registration callback when `actions_synced=false`. `launch()` and `resource()` recover the requested app before access. Action callback failure leaves a committed deployment with a durable retry marker rather than reporting a false install rollback.
- `launch()` returns an authenticated resource entrypoint. The resource route checks the requesting subject's active deployment, package identity, safe relative path and full content digests on every read. HTML is served under sandbox CSP, with no same-origin privilege granted to its script. Browser container/SDK behavior remains a separate D/F verification.
- `health()` reports static integrity separately from runtime probe state. Without an injected `healthProbe`, `healthy=false` and `state=runtime_unchecked`. The actual runtime probe remains an integration dependency; an HTML marker is only an integrity sanity check.
- `installBundled({envelope,subjectId,actorId,requestId})` requires a verified operator-configured `official` trust root. The endpoint does not generate roots or accept an untrusted caller's source. The official AI Workbench asset and signed envelope must be supplied by Lead/D's release process.
- `dataVersion` changes still fail closed with `data_migration_required`; no arbitrary manifest migration script is run. A reversible data migration executor is not yet implemented. Legacy `app_versions/app_installs` are retained, not promoted to verified packages; old records must be revalidated or denied launch by Lead's route replacement.

## Lead composition interface

Register only `registerPackageRoutes(app, { pool, store, trustRoots, audit, requireScope, validateCsrf, onActionsChanged, healthProbe })` and remove the old `/api/v1/apps*` block. The function returns `PackageService`; attach `app.addHook('onReady', () => packageService.ready())` after the route registration. The returned service exposes `ready()`, `recoverAll()`, `getDeployment(subjectId,appId)`, `resource({subjectId,appId,path})`, `launch({subjectId,appId})`, and `installBundled(...)`. Production must supply a persistent private `DiskPackageStore` root and operator-managed trust roots. An in-memory test can inject a temporary store and an empty root Map. Do not expose package paths or root keys through HTTP. D/F should consume the launch entrypoint in a sandboxed container with a separate broker channel.

## Commands and evidence

- `node --test tests/unit/app-packages.test.mjs`: exit 0, 7/7.
- `DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_packages node --test tests/integration/postgres-app-packages.test.mjs`: exit 0, 2/2. The second test injects audit failure for submit/review/install/uninstall and interruption immediately after install/uninstall pointer mutation; a new service instance runs recovery. It inspects joined audit event/outbox rows for successful submit/review.
- Applied only `migrations/0035-package-recovery.sql` to `dgos_v1_packages` for this test: exit 0. SHA-256 `c73ff34b55493b548759560d8fb0cbe44fd15de081456069d282eabe91ba6750`. Existing 0028–0030 SHA-256 remained `08fae924...`, `dcdd38cb...`, `30e68b53...`.
- `node --check` for changed service/repository/route modules and `git diff --check` for this domain: exit 0.

## Open risks / incomplete

- No real process SIGKILL was run; deterministic fault injection covers the two pointer/DB windows. Filesystem and PostgreSQL are still separate durability domains. A power loss while writing a release or pointer may require operator repair; the release store does not fsync files/directories.
- Startup recovery requires Lead to attach `ready()` before serving; the current `server.mjs` still has the old app route block. The callback supplied by A must be idempotent and persistent; callback side effects are not transactionally coupled to package DB.
- Runtime health is not proven until D/F supplies and tests a real launch/SDK handshake probe. CSP resource loading and sandbox behavior need browser/desktop integration testing; current tests verify service authorization and bytes only.
- Data migrations and legacy record revalidation remain unresolved. The signed first-party AI Workbench package, release root provisioning and real entry asset have not been supplied or installed.
- New public launch/health projection and resource route need Planner/Lead contract sync. This package does not claim full FR002 or V1 E2E acceptance.

`commands_run`: listed above.  
`implementation_facts`: listed above.  
`open_risks`: listed above.  
`uncompleted`: real runtime probe, data migrator, legacy revalidation, signed AI Workbench asset, browser/desktop sandbox test.  
`needs_lead_planner_decision`: no new business choice; Lead must wire the single route and Planner must project the launch/health/resource fields.
