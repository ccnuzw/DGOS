# V1-OPS r3 hardening handoff

- status: implemented_local_verified; integrated image build currently blocked by Web TypeScript errors
- work_package: `V1-OPS` / `r3`
- cwd: `/Users/apple/Progame/DGOS`
- date: 2026-10-02

## files_changed

- `src/security/durable-secret-service.mjs`: format 2 AES-GCM AAD authenticates format, SecretRef, purpose, subject, version, expiry, revoked, keyId and digest; revoke re-encrypts and increments version. Legacy format 1 is unavailable in ordinary operations. `verifyCiphertext` waits for a live per-record lock, validates committed records, and rejects leftover lock/temp files. Secret operations call an access audit hook with only digests and scope metadata.
- `src/security/runtime-config.mjs`: PostgreSQL audit adapter, production package root/trust root validation and startup resource checks. Missing/empty operator roots fail closed.
- `scripts/v1-ops-api.mjs`: PostgreSQL backed Secret access audit, Redis backed login backoff and rate limiter under the same namespace, and readiness checks for Secret ciphertext, PostgreSQL and Redis.
- `scripts/v1-ops-worker.mjs`: injects the same durable Secret and PostgreSQL audit adapter.
- `scripts/v1-ops-backup.mjs`, `scripts/v1-ops-restore.mjs`, `scripts/v1-ops-migrate-legacy.mjs`: backup/restore accept only format 2; explicit reviewed offline migration for format 1.
- `deployment/Dockerfile`, `deployment/Dockerfile.dockerignore`, `deployment/README.md`, `docker-compose.production.yml`: D Web build/dist gate, two-stage production dependency image, reduced context, HTTPS Web proxy health, persistent package volume and read-only operator trust roots mount.
- `tests/security/v1-ops-durable-secret.test.mjs`: control metadata tamper, legacy migration, lock/temp contention, PostgreSQL audit shape/failure and package root fail-closed coverage.

No common server/worker, root package/lockfile, D Web source, other packages, commits or pushes were changed.

## tests_added

- Four focused scenarios added to the existing V1-OPS security suite; 12 total tests pass.

## commands_run

| Command | Exit | Evidence |
| --- | ---: | --- |
| `node --test tests/security/v1-ops-durable-secret.test.mjs` | 0 | 12/12 pass: revoked flip, TTL/purpose/subject/version/keyId/digest tamper, legacy reject/migrate, live lock/orphan lock/temp, audit failure, restart/backup/restore/rotation |
| `node --check` on changed Secret/ops `.mjs` modules | 0 | syntax passed |
| `docker compose -f docker-compose.production.yml config --quiet` with isolated placeholder paths and required env | 0 | production Compose parses; no deployment started |
| `docker build -f deployment/Dockerfile -t dgos-v1-ops-r3-check .` | 0 on initial integrated Web state | D `tsc` and Vite build completed, dist emitted, production dependency layer built |
| Same Docker build with latest concurrent Web source, `--target build` | 1 | `apps/web/src/main.tsx` TypeScript errors: undefined `labels` at multiple lines and unsupported `onStepUp` prop at line 1603; file owned by D/Lead and not changed here |
| Docker build context diagnostic after `deployment/Dockerfile.dockerignore` | 1 due to Web compile above | context transfer reduced from ~2.38 GB to 47.84 MB |
| `git diff --check` | 0 | no whitespace errors in tracked changes |

## implementation_facts

- `put/resolve/revoke/inspect` remain compatible; `put`, `resolve`, `revoke`, `inspect` accept additive `requestId`. `read()` accepts its bound requestId and checks the durable record on each invocation. Audit callback failure returns `credential_unavailable` before plaintext is returned.
- `createProductionSecretAuditAccess(pool)` writes `secret.<operation>.requested` events via `PostgresAuditRepository`. It stores SHA-256 digests of SecretRef and subject in `summary`, no raw reference or subject; target ID is null because the database column is UUID. Non-UUID caller IDs map deterministically to a UUID for the audit schema.
- `scripts/v1-ops-api.mjs` injects `createRateLimiter({ redis, namespace })` and `createLoginBackoff({ redis, namespace })` into `buildServer`, using the same Redis client. Default namespace is `dgos`; override is `DGOS_REDIS_NAMESPACE`.
- `DGOS_PACKAGE_ROOT` and `DGOS_PACKAGE_TRUST_ROOTS_FILE` are required in production. Compose initializes package volume ownership to UID 1000; API and Worker mount it along with a read-only operator roots file. `createProductionSecretService` validates nonempty roots before startup; the shared `packageRuntimeConfig` performs its own root validation in Lead's API entry.
- Existing format 1 records remain physically readable for an explicit operator-reviewed migration, but ordinary resolve/inspect/put/revoke/startup validation reject them. `scripts/v1-ops-migrate-legacy.mjs` requires stopped processes, a reviewed file-digest list and explicit confirmation; it increments version and reauthenticates control metadata as format 2. Operator must compare old control state with independent audit/history before approving digests.

## contract_changes_proposed

- No HTTP contract change. Internal Secret format advances to 2 and the optional access audit callback now receives `{ operation, secretRefDigest, purpose, subjectDigest, version, requestId }`.
- Lead should propagate requestId from Identity, Provider, AI Task, Provider test and extension call sites when touching those common/domain entrypoints. Current unchanged call sites often omit it; the service generates a UUID per access when absent.

## open_risks

- Latest full image build is blocked by D Web TypeScript errors in `apps/web/src/main.tsx`; rerun Docker build after D/Lead resolves them. The earlier successful image predates those concurrent Web edits and is not final release evidence.
- Audit currently records attempts before Secret writes and before returning reads. It does not provide an atomic transaction across ciphertext files and PostgreSQL. Audited attempt plus failed file write must be interpreted as attempted, not completed.
- Offline legacy review cannot independently infer whether a format 1 `revoked` flag was previously altered. Keep legacy files unavailable unless an operator verifies control state from independent records or rotates the underlying credential.
- Root key files, operator package trust roots, public TLS, production PostgreSQL, KMS, RPO/RTO, end-to-end restoration and real deployment remain unverified. No external KMS or production release claim is made.

## docs_to_update

- Lead/Planner release and recovery docs after choosing root key source, package trust roots, backup coordination and integrated image/deployment evidence.

## unfinished_items

- D/Lead repair Web TypeScript errors and rerun integrated image build; Lead binds common server/worker loops and requestId propagation. r3 I writes stop here.

## lead_planner_decisions_needed

- No new business decision; operator review criteria for legacy format 1 and production key/trust root ownership remain release operations inputs.
