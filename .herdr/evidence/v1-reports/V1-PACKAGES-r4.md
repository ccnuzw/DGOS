# V1-PACKAGES r4 delivery

`status`: partial_ready_for_lead_integration  
`work_package`: V1-PACKAGES/r4  
`files_changed`: `src/apps/manifest-validator.mjs`, `package-service.mjs`, `package-repository.mjs`, `postgres-package-repository.mjs`, new `browser-health-probe.mjs`; `apps/api/src/package-routes.mjs`; `apps/ai-workbench-package/{manifest.json,index.html,workbench.css,workbench.js,icon.svg}`; `scripts/build-bundled-app.mjs`; new `migrations/0037-app-data-migration.sql`; package unit/PG/browser tests. Lead-owned `src/apps/runtime-config.mjs`, Web UI, server and Compose were not edited.  
`contract_changes_proposed`: launch adds `instanceId`, `bridgeVersion=1`, `declaredCapabilities` and a short-lived `launchTicket` query in `entrypoint`; new authenticated `POST /api/v1/apps/:appId/bridge` accepts `{instanceId,requestId,capability,input}`. Planner must register this route and the declaration-only JSON migration format.  

## Implementation facts

- Built an installable first-party `dgos.ai-workbench` static package. `scripts/build-bundled-app.mjs <output-dir>` requires explicit `DGOS_BUNDLE_SIGNING_KEY_FILE` (Ed25519 private key) and `DGOS_BUNDLE_SIGNING_KEY_ID`; it signs manifest plus resource digests, verifies its output against the derived public key, and writes an envelope. It neither creates nor trusts a production root. Operator must provision the corresponding `official` root and feed the envelope to `PackageService.installBundled(...)`.
- Manifest validator and package asset now include the main schema's required `description`, `category`, `icon`, and `defaultWindow`, and reject unknown fields. Existing 0035 SQL is unchanged, SHA-256 `c73ff34b55493b548759560d8fb0cbe44fd15de081456069d282eabe91ba6750`.
- Launch creates a five-minute in-memory instance/ticket bound to subject, app, and package digest. Resource reads verify the deployment and signed bytes. The iframe uses opaque origin; the resource route sets sandbox CSP, no-store, nosniff and no-referrer. HTML ticket substitution lets its CSS/JS load without a management Cookie. `bridge()` checks instance, current deployment/digest, manifest allowlist, and required injected `bridgeAuthorize` on every call, then dispatches only a registered `bridgeHandlers[capability]`. Missing authorizer/handler fails closed.
- `browserHealthProbe` launches Chromium against the staged package in an iframe sandbox, loads static resources, sends a host hello and waits for the app's ready state. `health()` only reports runtime healthy when a probe is injected; without one it reports `runtime_unchecked`.
- 0037 creates an app data migration journal. A dataVersion change requires a signed package `dataMigration.entry` JSON with bounded `moves: [{from,to}]` of top-level snake_case keys. No package JS is executed. The service backs up private JSON app data, writes a prepared journal, atomically replaces data, and commits journal with deployment. Failure restores backup; startup recovery resolves a prepared journal against the authoritative installed dataVersion. Uninstall leaves app data intact.

## Lead/D wiring

`registerPackageRoutes` accepts `healthProbe`, `bridgeAuthorize`, and `bridgeHandlers`. Lead should inject `browserHealthProbe` only where Chromium is installed and usable, or an equivalent runtime handshake probe. The existing route registration and `packages.ready()` remain Lead-owned. For `dgos.aiTask.submit`, inject a handler that invokes the current Task service using the authenticated subject and requestId; `bridgeAuthorize` must consult the capability broker with subject, app, capability and package digest. The package script emits `dgos.app.ready` after a `dgos.host.hello` carrying `{instanceId,bridgeVersion:1}`. D's iframe host must bind `event.source === iframe.contentWindow`, current `instanceId`, requestId and approved capability before it forwards `dgos.app.invoke` through its authenticated Session to the bridge route; responses use `dgos.host.result`. Do not pass Session, Cookie or arbitrary control-plane fetch access into the iframe.

The AI Workbench package currently has a real prompt/task submit view and static entry; it is not the full D Web workbench UI. D may replace package UI assets using the same signed package and bridge protocol. Its `dgos.aiTask.submit` call is intentionally unavailable until Lead wires the broker and Task handler.

## Commands and evidence

- `node --test tests/unit/app-packages.test.mjs`: exit 0, 9/9, including data migration commit/rollback and bridge subject/capability isolation.
- `DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_packages node --test tests/integration/postgres-app-packages.test.mjs`: exit 0, 3/3, including interrupted migration journal recovery. Only this dedicated DB was changed.
- Applied `migrations/0037-app-data-migration.sql` to `dgos_v1_packages`: exit 0. Frozen SHA-256 `554603eff3422d32e6249880a8f62268ef410f33ff1773dc40aab0cb4f12bb0c`; Lead/B confirmed integrated restart needs this migration, not E's 0034. A missing 0037 now fails `ready()` with `app_data_migration_schema_required` instead of an opaque PG missing-table error. No 0028–0030 or 0035 SQL was changed.
- Used a temporary fixture Ed25519 key outside the repo to run `scripts/build-bundled-app.mjs`, verify the envelope digest, install it via `installBundled`, launch it, read `workbench.js`, and run `browserHealthProbe`: exit 0, reported `{state:"active",healthy:true,runtimeChecked:true}`. This is fixture evidence, not production signing evidence.
- `DGOS_BUNDLE_ENVELOPE=<temporary fixture> node --test tests/integration/app-package-browser.test.mjs`: exit 0, 1/1. Headless Chromium observed HTML, CSS and JS requests and `dgos.app.ready` from a sandboxed iframe on local port 15161.
- `node --check` for changed modules and `git diff --check` for domain files: exit 0.

## Conflict and limits

- **Planner field decision needed:** main manifest example uses `dataMigration.entry="migrations/1.js"` and does not define script/schema content. This implementation accepts only a signed JSON declaration with the top-level `moves` shape above. The main schema/OpenAPI needs that exact format or an explicit alternative; do not treat the current private format as frozen public protocol.
- Resource launch tickets are in API process memory. A different API instance or restart invalidates them; D should relaunch. Browser test uses a local fixture server, not the complete authenticated API and desktop container. Cross-origin/iframe host event validation remains D/Lead integration evidence.
- `bridgeAuthorize` and `bridgeHandlers` are required injection points and are not yet wired by Lead. The app cannot submit a real Task until they are supplied. Ticket possession grants read access to that installed package's verified static assets for five minutes; it does not grant bridge execution.
- `browserHealthProbe` is an actual Chromium handshake for this package shape, but production Chromium availability, deployment sandbox and SDK broker round trip are not yet verified. The probe currently recognizes the bundled asset names; third-party app entry validation needs a generalized runner.
- Migration operates only DGOS private JSON app data at `DiskPackageStore.dataFor`, with top-level moves. It does not migrate project/Artifact/other external stores. Backup files are retained for recovery; cleanup/retention policy is not implemented. Power-loss fsync durability and real SIGKILL recovery were not proven.
- No production operator key, signed release artifact, or full V1 E2E was supplied. Main server/Compose/Web and runtime-config are Lead/D owned and left untouched.

`tests_added`: migration/bridge unit cases, PG interrupted migration, Chromium signed fixture loading.  
`commands_run`: listed above.  
`implementation_facts`: listed above.  
`open_risks`: listed above.  
`docs_to_update`: manifest migration declaration, bridge/launch/health OpenAPI, FR002 implementation status after integration evidence.  
`uncompleted`: production signed release and install, Lead broker/Task bridge, D iframe host, generalized runtime probe, migration contract decision, backup retention, complete V1 E2E.  
`needs_lead_planner_decision`: Planner to freeze migration declaration format and bridge projection; Lead to wire authorized Task handler and provision operator signing root.

## r4 follow-up: subject installation projection

D found that public `/api/v1/apps` records have no subject deployment version, so update/uninstall cannot obtain `baseVersion`. The single recommended contract is `GET /api/v1/apps/installations`, requiring `app.lifecycle` and taking the subject only from authentication. No `subjectId` query or request body is accepted. Response is `{ items: AppInstallRecord[] }`; each item contains `appId`, active `version`, integer `build`, `releaseChannel`, `state`, `dataRetained`, `digest`, nullable `previousDigest`, and integer `versionNumber`. No subject ID, package ID or filesystem path is returned. Records remain visible with `state=uninstalled` so D can distinguish that from a never-installed app. Planner should add this path and response projection to V1 OpenAPI; D should merge it with catalog items by `appId` and use `versionNumber` as `baseVersion` for update/uninstall. The route is registered before `/:appId`.

Implementation touched only `src/apps/package-{service,repository}.mjs`, `src/apps/postgres-package-repository.mjs`, `apps/api/src/package-routes.mjs` and `tests/unit/app-packages.test.mjs`. A two-subject unit case verifies isolation and baseVersion; `node --test tests/unit/app-packages.test.mjs` exits 0 (10/10), and dedicated-db `tests/integration/postgres-app-packages.test.mjs` exits 0 (3/3). Full UI and HTTP integration remain Lead/D/Verify evidence.
