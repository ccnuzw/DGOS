# V1-PACKAGES HTTP r10 delivery

- status: public_http_domain_verified_with_task_artifact_retention; G stops writing after this report.
- work_package: V1-PACKAGES HTTP r10, Worker-G. FR002 AC01-03 / E2E02 and FR014 AC04 package retention. No commit, push, delegation, D 15200 write, or A workbench/fixture/build write.
- files_changed: `scripts/v1-package-http.mjs`, `src/apps/package-service.mjs`, this report.
- tests_added: isolated public HTTP script with disposable Ed25519 roots and manifests, signed context bridge read/events, and real Provider/Task/Artifact through main PG API; no repository fixture, old envelope, or signed workbench byte changed.

## Implementation facts

The script creates a random `dgos_v1_package_http_<hex32>` database from the dedicated `dgos_v1_packages` admin database, starts the main `buildServer` on 15161 with a private temporary package root, and drops the database without `FORCE` after closing API and pools. The completed r10 run used migrations through 0048 plus frozen 0050; 0049 was still a draft at that run. Its final check found no `dgos_v1_package_http_%` database left. Following the main API's extension management and proxy ready wiring, the script's **next-run** allowlist now includes migrations through 0051 and checks the complete frozen versions and SHA-256 values before applying 0049 (`ba0bc80a0ccc74e05a5244b50e52e6a26df39ad854995ba038020b7d5d954f1b`), 0050 (`8802fe3a02b0bf7364aeac96215da09454d0c53b48c06d2cb76c6f3d6b455d85`), and 0051 (`778fddef654d67bc3ecfc01e11fd91f826f91d68a5b6c5c72568b5e35cca1939`). This later allowlist edit was statically checked only; the prior 45-migration HTTP result is not presented as a 0051 run.

Public HTTP verified five distinct catalog outcomes: official removable, official protected preinstall, admin-approved, developer pending review, and developer rejected. Pending/rejected are absent from ordinary catalog and ordinary install returns `app_not_available`; pending developer test install succeeds. The protected preinstall returns `app_uninstall_forbidden` without changing deployment. The script also checks signed package resource bytes through a launch ticket, health via real Chromium probe, immutable version and channel lookup, successful update, failed browser health rollback to the prior digest, preserved data, restarted API repair of a removed pointer, and uninstall with retained history/data.

For retention, the script injects a submit audit failure through the public submit route, leaving a durable failed stage candidate and real signed resource directory. It ages only that candidate and a failed install operation by 31 days in the disposable database. An old confirmed preview rejects a newly inserted fixture with `retention_preview_conflict`; a fresh preview reports both package categories and its confirmed sweep physically removes the staged directory and failed operation. The retention job completed with `deletedCount=2` in the final run. Direct SQL was limited to age/fault fixtures and readback; business submit, install, review, launch, update, uninstall, preview and sweep used HTTP.

`PackageService` now records denied ordinary installs, protected uninstall denials, and health/commit rollback in audit/outbox atomically with their operation records. The public script verifies each audit/outbox event and unchanged deployment after denial. No migration changed; frozen 0046 remains SHA-256 `7321916de0ddff31f40d48b837acada75d8ec893691c7c65f22d0b707d6a9a83`.

## Task and Artifact retention addendum

The same random database now starts a local, controlled OpenAI-compatible upstream fixture and a PG Provider probe/Task worker sharing the API's temporary secret service and network route. The script uses public HTTP to create the Provider account, run its connection test, make it ready, create and validate a config, refresh and enable its model, set subject quota, submit a real Task, then GET the completed Task and its Artifact. It compares the identical public Artifact projection and the stored owner ID, Task ID, and content at five checkpoints: installed, successful package update, failed health update rollback, API restart/pointer recovery, and package uninstall. An unauthenticated GET returns 401 `session_invalid` at each checkpoint. This proves the Artifact content and ownership remain unchanged throughout the package lifecycle in this local integration environment. The fixture's Artifact text and credentials remain out of reports and logs.

## Context bridge follow-up

The same script signs a disposable official package declaring both `dgos.system.context.read` and `dgos.system.context.events` in `permissions` and `capabilityAllowlist`, installs it through HTTP, grants both capabilities through public `/permissions`, and launches an instance. Real `/apps/{appId}/bridge` calls show `read` bound to that appId/instanceId, exclude `manualProxyRef`, global `appPermissions` and another app's ID, and replay the identical receipt for the same requestId. In the disposable DB, `contextVersion` is set to 10 solely as a numeric-boundary fixture: events cursor `9` returns one version-10 snapshot with `reset=false`; cursor `10` returns `items=[]`; cursor `11` returns `reset=true`. Identity fields in inputs return 422.

After public permission revocation of `read`, events returns 403. Reallowing read, then publicly updating to a newly signed version declaring events alone, preserves the prior stored `allow` decision but both events and read return 403 due to the installed manifest declaration. This is main API/PG/HTTP evidence, separate from the existing unit test. No A-owned workbench bytes or fixtures changed.

## Commands and evidence

- `node --check scripts/v1-package-http.mjs && node scripts/v1-package-http.mjs`: exit 0, eleven named phases passed. Final addendum run used random DB `dgos_v1_package_http_73271d8487984204bf05a59e8bb15065`, port 15161, 45 frozen migrations; API, worker route, pool, database, package root and upstream fixture cleanup all completed. Script SHA-256 `e7c780debbf6e907656d3f3248fae37c1e4fc67b4a1b5c6be09aa72881c88d85`.
- Automatic paired evidence: `.herdr/state/package-http-evidence/V1-package-http-2026-10-02T01-40-47-288Z-73271d84.md`, matching `-manifest.json` and `.log.json`. The manifest records command, exact exit code, source identity before and after (`working_tree_sha256=99d4bef386638aaf899c33c3d55ee3fc32f8ff510b7477f6b1cfa795dd9e761a` both), asset hashes, sanitization and cleanup. It binds the report SHA-256 `a633ca61fb53ae98fa507cf5795019d16b18b4d1dbeb2cd0c7c73d2327d1c5ee` and log SHA-256 `05b53175e5ce888f68628806e182c6e5c9a23bee73fcbea2be4971182608dcf0`.
- `DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_packages node --test --test-concurrency=1 tests/integration/postgres-package-retention.test.mjs tests/integration/postgres-app-packages.test.mjs tests/integration/postgres-retention.test.mjs`: 10/10 pass.
- `node --test tests/unit/app-packages.test.mjs tests/integration/app-package-routes.test.mjs`: 16/16 pass. `node --check` on script/service and `git diff --check` on service: exit 0.
- Earlier script iterations exposed and corrected a wrong 404 expectation, a protected failure operation pending reconciliation, and forced DB cleanup before all pools closed. Only the final exit-0 run is counted as passed.
- During this addendum, initial runs exposed missing fixture egress mapping, quota policy and a 401 error-key mismatch; each failed run has its own paired evidence and completed cleanup. One all-business-pass run exited 1 due to concurrent main-tree source drift; the final stable run above exited 0 with no drift. `pg` client query found zero `dgos_v1_package_http_%` databases after cleanup; local `psql` binary was unavailable.
- After that run, `shasum -a 256 migrations/0049-*.sql migrations/0050-*.sql migrations/0051-*.sql` matched all three Lead-frozen checksums. The next-run allowlist update received `node --check` and static migration-plan verification only; no new DB was created and the existing paired evidence remains bound to the earlier script source.

## Limits and handoff

- contract_changes_proposed: none; Planner's `packageRetention` OpenAPI projection was used unchanged.
- open_risks: the local Provider uses a controlled fixture transport, so this is not production Provider/TLS evidence. The actual browser health probe is the existing package-specific probe, not a generic runtime health contract for arbitrary apps.
- docs_to_update: Lead/Planner may attach the paired evidence to FR002 AC01-03/E2E02 and FR014 AC04; the Task/Artifact retention gap is closed by the addendum run.
- incomplete_items: none within this r10 narrow addendum.
- decisions_needed: none.
