# V1-RETENTION-PACKAGES r9 delivery

- status: domain_implemented; Lead API composition pending. G stops writes after this report.
- work_package: V1-RETENTION-PACKAGES r9, Worker-G, FR014 AC04 / FR002 package lifecycle. No commit, push, delegation, D fixture/root/15200 write, or original `dgos` database write.
- files_changed: `migrations/0046-package-retention.sql`, `src/apps/package-retention.mjs`, `src/apps/package-service.mjs`, `src/apps/postgres-package-repository.mjs`, `src/apps/package-repository.mjs`, `src/audit/retention.mjs`, `apps/api/src/governance-service.mjs`, `tests/integration/postgres-package-retention.test.mjs`, this report.
- tests_added: five PostgreSQL cases for 30-day boundary, active/rollback references, physical directory deletion, user-data preservation, disk and audit fault recovery, process restart, lifecycle advisory lock, preview drift, bounded batches and outbox publication guard.

## Implementation facts

`0046-package-retention.sql` is frozen at SHA-256 `7321916de0ddff31f40d48b837acada75d8ec893691c7c65f22d0b707d6a9a83`. It creates durable stage candidates and cleanup intents. It was applied **only** to `dgos_v1_packages`; `dgos_schema_migrations` records the same full version and SHA. Existing migration files were not changed. The first shell invocation expanded SQL placeholders and rolled back; the corrected invocation committed. No other database was migrated by G.

Package submit registers a candidate before writing bytes, then finalizes it in the same transaction as catalog row plus audit/outbox. Startup `PostgresPackageRetention.ready()` recovers interrupted pending/staged candidates. Cleanup uses the shared app advisory lock also acquired by submit/install/uninstall, rechecks release/deployment/previous rollback/prepared operation and data-migration references, and only targets registered failed candidates plus expired failed install operation records. Signed catalog releases, user data, artifacts and bridge receipts are never deletion targets. Failure operation records without `request_id` or with unpublished audit remain protected.

`DiskPackageStore.removeStagedCandidate()` only handles a digest-validated release path and its candidate-specific temporary/tombstone paths. A prepared intent precedes disk mutation. After a crash or audit failure, a new cleaner instance resumes the same candidate. Audit/outbox failure propagates rather than becoming a disk error. Each outcome updates job counts; failures can be retried and replaced by a later success. `packageRetention.failedInstall` and `.stagedPackage` each expose `eligibleCount` and `protectedCount` in preview; these counts participate in `previewDigest`. Top-level `eligibleCount` remains the audit count per Planner's OpenAPI.

## Lead composition contract

The `server.mjs` path is Lead-owned and was not edited. In `buildServer`, after `packages = registerPackageRoutes(...)`, construct `new PostgresPackageRetention({ pool: runtimePool, store: packages.store, audit })`, attach with `governance.attachPackageRetention(packageRetention)`, and register `onReady` to await `packageRetention.ready()` after the existing `packages.ready()`. For in-memory mode, omit the package cleaner; no PG package rows exist. Use the existing persistent package root and the same pool; do not create a second package catalog. `PostgresRetentionRepository` receives the cleaner through `attachPackageRetention`, and `runJob()` invokes its bounded batch. API must not accept a caller supplied store or cleanup path.

## Commands and evidence

- `DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_packages node --test --test-concurrency=1 tests/integration/postgres-package-retention.test.mjs tests/integration/postgres-app-packages.test.mjs tests/integration/postgres-retention.test.mjs`: 10/10 pass.
- `node --test tests/integration/retention-api.test.mjs tests/unit/app-packages.test.mjs`: 14/14 pass, with no DB URL.
- `node --check` on changed runtime/test modules and `git diff --check` on changed tracked G modules: exit 0. `sha256sum` and PG migration query both returned the frozen 0046 SHA above.
- A parallel PG run on one shared database had one expected `retention_preview_conflict` from concurrent fixture insertion; serialized rerun passed. Tests require isolated databases or `--test-concurrency=1` because preview counts are global.

## Handoff and limits

- contract_changes_proposed: none. Planner has already added the approved `packageRetention` fields to OpenAPI.
- open_risks: Lead server composition and API HTTP verification are pending. Existing unregistered orphan directories from versions before candidate tracking are deliberately not scanned or deleted. The package cleaner is not a scheduler; an authorized retention job must be previewed, confirmed and run. No production Compose/15200 claim is made.
- docs_to_update: Lead/Planner should record FR014 AC04 and FR002 evidence after server composition and public API check; preserve the 0046 checksum.
- incomplete_items: Lead-owned `server.mjs` injection/`onReady` wiring and integrated API confirmation only.
- decisions_needed: none.
