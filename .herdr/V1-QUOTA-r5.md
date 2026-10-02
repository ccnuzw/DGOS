# V1-QUOTA-REVIEW r5 / Worker-C

- status: delivered_with_integration_blocker
- work_package: V1-QUOTA-REVIEW r5, V1-FR-015
- workspace: `/Users/apple/Progame/DGOS` shared tree; no commit or push
- files_changed: `src/quota/service.mjs`, `src/quota/repository.mjs`, `tests/unit-quota.test.mjs`, `tests/integration/postgres-quota.test.mjs`, this report
- tests_added: numeric/clock/ownership/rollback/lock/uncertain hold unit assertions; PostgreSQL lock/recheck/ownership/audit rollback assertions

## Implementation facts

- `reserveQuota` no longer reads an undefined `reservation`. A numeric or Date clock is accepted. Reservation and policy update use the same `scopeType:scopeId:metric` lock; reserve reloads effective policy after locking in its transaction. PostgreSQL policy lookup uses `clock_timestamp()` so a transaction waiting on a lock sees the newly effective version.
- Amount, hard/soft limits, integer window seconds, and effective/expiry timestamps are checked. Quota numeric values are bounded to 4,000,000,000 with at most six decimal places to keep two-value JS arithmetic within safe integer micro-units and fit PostgreSQL `numeric(20,6)`. Invalid values return `invalid_request` before mutation.
- `settleUsage(input, authContext)` requires `{ actorId, subjectId, admin }` and checks `subjectId` against the stored reservation. A non-admin actor must own that subject. `queryUsage(input, authContext)` requires the same binding to the requested subject. `admin` is trusted only when the caller constructs it from authenticated scopes; input body flags are ignored.
- `createQuotaAdapter` derives worker settlement/release context from `input.subjectId`, which Lead now supplies from `task.ownerId`. Public API must pass the separate authenticated `authContext` directly. Missing audit adapter fails closed; PostgreSQL mutations and audit event/outbox share one transaction. In-memory transaction snapshots roll back failures. Idempotent settlement does not emit another audit event.
- `needs_review` continues holding reservation capacity after expiry. If a usage event already exists for that reservation, only usage is counted. Settled usage is counted once.

## Commands run and results

- `pwd` -> `/Users/apple/Progame/DGOS`.
- `node --test tests/unit-quota.test.mjs` -> 6 passed, 0 failed.
- `DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_governance node --test tests/integration/postgres-quota.test.mjs` -> 2 passed, 0 failed. Runs were sequential and used only the dedicated governance database.
- Dedicated DB schema check found quota/audit tables; first PostgreSQL run failed because that DB lacked `ai_task_attempts.upstream_dispatch_started_at`. Applied existing `migrations/0019-ai-task-dispatch-fence.sql` with its checksum to `dgos_v1_governance` only; subsequent runs passed.
- `node --test tests/unit-quota.test.mjs tests/integration/quota-api.test.mjs` -> 5 passed, 1 failed at `buildServer`: `provider_confirmation_store_required`. `apps/api/src/server.mjs:127` passes `verifyConfirmation`, while `apps/api/src/provider-protocol-routes.mjs:10` requires `confirmations.issue/consume`. Lead owns server; API assertions were not reached. A later unit-only run passed 6/6.
- `git diff --check -- src/quota tests/unit-quota.test.mjs tests/integration/postgres-quota.test.mjs` -> exit 0.

## Contract changes proposed / Lead connection

- Public settle: `quota.settleUsage(input, { actorId: auth.subjectId, subjectId: persistedReservation.subjectId, admin: auth.scopes.includes('*') || auth.scopes.includes('quota.admin') })`. Read the reservation from storage, never body. Current Lead-owned `server.mjs` reflects this shape.
- Public query: `quota.queryUsage({ ...query, subjectId: authorizedTargetSubject }, { actorId: auth.subjectId, subjectId: authorizedTargetSubject, admin: auth.scopes.includes('*') || auth.scopes.includes('usage.admin') })`. Current Lead-owned `server.mjs` reflects this shape.
- Worker adapter: `finalizeQuota` must supply `subjectId: task.ownerId` to settle/release input. Current Lead-owned Task service reflects this shape. Adapter uses that trusted Task value for a non-admin context.

## Open risks and limits

- API quota contract test is blocked by unrelated Provider confirmation wiring in Lead-owned server; no API pass is claimed.
- Service scope checks for public settle/query rely on the authenticated `authContext` argument being built at the entry point. `reserveQuota` still relies on API authorization for non-subject scopes; its subject scope requires `scopeId === subjectId`.
- The existing PostgreSQL test uses a local PostgreSQL instance, not production or an end-to-end Provider path. No integrated database, other service, Redis DB, or port 15200 group was touched.
- In-memory audit is a test repository with an internal event list; durable audit/outbox proof is from the PostgreSQL repository.

- docs_to_update: FR-015 implementation/verification and current V1 evidence should link this report after Lead resolves API construction and reruns the contract test.
- unfinished_items: API contract verification pending Lead-owned Provider confirmation wiring.
- Lead_or_Planner_decisions_needed: none for the quota domain.
