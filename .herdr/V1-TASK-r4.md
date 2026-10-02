# V1-TASK r4 Compose core handoff

status: partial; stopped writing and returned the 15200 Compose group to Lead
work_package: V1-TASK r4 / DGOS-V1-IMPLEMENT-20261002
worker: Worker-B (Codex)
workspace: /Users/apple/Progame/DGOS
baseline_HEAD: 72ab1cb98b064a6e27b9f60a9f8f00881a827a99

## Files changed

- Added `scripts/v1-core-compose.mjs`, a bounded, repeatable public HTTP probe with dedicated DB checks and append-only paired evidence.
- Appended V1-core report/manifest pairs under `docs/05-测试与发布/端到端验收/报告/`; failed attempts were retained.
- This report. No product, existing test, or shared server/worker entry file was edited by Worker-B in r4.

## Observed results

- `V1-core-2026-10-01T18-00-07-428Z`: 11/11 passed against the independent Compose stack before the later shared-source restart. Evidence: `docs/05-测试与发布/端到端验收/报告/V1-core-2026-10-01T18-00-07-428Z.md` and matching `-manifest.json`. Manifest records `commit: null`, separate `head_commit`, dirty-tree identity, key asset SHA, `source_drift: false`, PostgreSQL migration checksums, and real Task/Quota/audit/outbox counts. The pass covers login, probe→explicit ready, config validation/catalog/model policy, quota preflight, Task replay/SSE/Artifact, cancellation, three attempts with two Workers running, SIGKILL after dispatch with one upstream call and `needs_review`, hard quota denial without a new Task, and Action/settings conflict/deny.
- `V1-core-2026-10-01T18-01-32-524Z`: exit 1, `api_ready_timeout`, `source_drift: true`, zero business cases. After a targeted API/Worker restart to load newer shared source, API exited with `provider_confirmation_store_required` from `apps/api/src/provider-protocol-routes.mjs:10`. Current `apps/api/src/server.mjs:127` passes `verifyConfirmation`; the route requires `confirmations.issue/consume`. Migration 0039 is not present in the independent DB. The prior 11/11 does not establish acceptance of this newer source.
- Earlier failed append-only batches: `17:50:28` API start failed on missing `app_data_migrations`; `17:55:17` Artifact expectation mismatched fixture; `17:55:43` and `17:56:46` script missed existing quota policy version; `17:57:19` Action permission write hit missing `permission_change_receipts`. `17:59:12` passed 11/11 before final audit/outbox assertions were added. Each batch has its own report/manifest; these are not suppressed.

## Dedicated migration operations

Against only `postgresql://dgos:dgos@127.0.0.1:15200/dgos_v1_integrated`, used `discoverMigrations()` to filter a single frozen version and `buildMigrationSql([item])`, checked SHA before and stored checksum after:

- 0036-provider-operations: `24f5649da8b92b2d3ee9c63e9bbf9a7a5ed897180da761a6211c5c0ed8996aad`.
- 0037-app-data-migration: `554603eff3422d32e6249880a8f62268ef410f33ff1773dc40aab0cb4f12bb0c`.
- 0034-extension-recovery: `9a6c2e429aa756435d2d8bc885277275c47a547851c1ae0ba60f2bda2c6ff81e`.
- 0038-permission-action-lifecycle: `5542368a6fa955ac58440a3a223ef662fb1a54a62a883ae2fd8ffa2daf9608bd`.

All four single-version operations exited 0 and were verified in `dgos_schema_migrations`. 0039 was not applied. No original `dgos` database or other Compose project was touched.

## Commands and limitations

- `pwd`: `/Users/apple/Progame/DGOS`; `git rev-parse --short HEAD`: `72ab1cb`.
- `docker compose -p dgos-v1-integration -f docker-compose.integration.yml restart api worker`: exit 0; the last restart exposed the API startup failure above.
- `DGOS_CORE_CREDENTIAL=<redacted> node scripts/v1-core-compose.mjs`: latest passing batch 11/11, exit 0; subsequent shared-source batch exit 1 at API ready.
- `node --check scripts/v1-core-compose.mjs` and `git diff --check -- scripts/v1-core-compose.mjs`: exit 0.
- Compose uses `fixture.test` mapped to a local fixture. It does not prove real external Provider/TLS, production behavior, a frozen build, every V1 AC, or that each of the two Workers individually claimed an attempt. The DB and services retain the batch rows for inspection; no destructive cleanup was run.

The latest API process is down. Lead/H must wire `PostgresProviderProtocolConfirmations`/`InMemoryProviderProtocolConfirmations` as the route's `confirmations` dependency and supply explicit authorization for frozen 0039 in this Compose DB. After that, rerun `node scripts/v1-core-compose.mjs` with the explicit fixture credential. Current script preflight requires migrations 0033–0039 and checks relevant tables, so it will stop before business writes if 0039 is missing.

files_changed: [`scripts/v1-core-compose.mjs`, append-only `V1-core-*` paired reports, `.herdr/V1-TASK-r4.md`]
tests_added: [`scripts/v1-core-compose.mjs` executable HTTP acceptance]
commands_run: [single-version checksum-verified migrations 0034/0036/0037/0038 passed, Compose restarts executed, core HTTP 11/11 passed on earlier source, latest API readiness failed, syntax/diff checks passed]
implementation_facts: [prior batch had one submit and one terminal audit/outbox per checked Task, one usage for success, no usage and `needs_review` for unknown upstream, no Task on hard quota denial]
contract_changes_proposed: []
open_risks: [current API startup blocked by confirmation dependency, 0039 not applied, shared source remains dynamic and uncommitted, real external Provider/TLS unverified]
docs_to_update: [Lead/Planner implementation status only after fresh integrated acceptance on repaired source]
unfinished_items: [fresh 11-case run after Lead/H repair and 0039 authorization]
lead_or_planner_decisions: [Lead owns server confirmation wiring and dedicated 0039 migration authorization]
