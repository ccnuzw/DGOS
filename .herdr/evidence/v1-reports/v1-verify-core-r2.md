# V1-VERIFY-CORE r2

status: READY for this local core test slice; not a V1 release acceptance.
scope: DGOS-V1-IMPLEMENT-20261002; main workspace `tests/integration/ai-task-api.test.mjs` and new `tests/integration/provider-admission-wiring.test.mjs` only. Observed 2026-10-02 01:36 CST, HEAD `72ab1cb` with uncommitted, concurrently changing product sources.
checks:
- `node --test tests/integration/ai-task-api.test.mjs`: exit 0, 5 passed, 0 failed after fixture adaptation.
- `node --test tests/integration/provider-admission-wiring.test.mjs`: exit 0, 1 passed, 0 failed.
- `node --test tests/integration/ai-task-api.test.mjs tests/integration/provider-admission-wiring.test.mjs`: exit 0, 6 passed, 0 failed, 0 skipped, 391 ms.
- `git diff --check -- tests/integration/ai-task-api.test.mjs`: exit 0.
evidence_level: Local in-memory API tests, no DB, bound port, paid upstream, or production evidence. The first pre-adaptation run was interrupted after five fixture failures at `credential_pending -> ready` (422); it is not counted as a passed command. A passing connection test is required by H r3.
verified:
- Existing public Task test retains explicit config validate and model refresh separation, idempotent submit, SSE resume, artifact access, and independent second-principal API Key returning 404 for another owner's artifact.
- Account activation now uses public connection-test submission, a local `ProviderTestWorker.runOnce()` with controlled `probe`, then public `setState ready` with the account's original version. No repository state bypass. The fixture egress only validates the fixed local test endpoint string; no network call occurs.
- Quota rejection asserts zero Task, Attempt, and reservation calls. Success/failure/cancel/timeout checks retain quota settlement and release counts.
- New public admission test rejects draft config, not-ready account, stale catalog, and disabled config with no new Task/Attempt/reservation; explicit validation does not refresh models. A previously accepted taskId remains readable after account disablement and config disablement.
limitations:
- No PostgreSQL transaction, worker crash/recovery, real network egress, UI, full E2E matrix, or release gate was exercised.
- Product code was not modified. B/H were editing during this run; this evidence binds only the observed working tree and is not a committed source manifest.
- No separate product defect was reproduced by these two final targeted tests. Earlier `onReady` and missing connection-test fixture failures are resolved in the observed snapshot/fixture respectively; neither is counted as a new business gap here.
return_to_lead: Accept the two test assets as local core evidence. Re-run against the later merged source identity, then perform the separately assigned DB and full V1 integration acceptance. Stop Verify writes for this package.

## r2 contract alignment follow-up (2026-10-02)

- Before: the two fixtures created a public connection test and completed a successful local `ProviderTestWorker` probe, then submitted `state: ready` with `baseVersion` but without the new `connectionTestId` field. That earlier 6/6 pass predates the H contract freeze; it is not evidence for the new required field.
- Current contract: `ProviderService.setState` forwards `connectionTestId`, and both repositories require the referenced test to be `succeeded` for the same account and account version when activating from `credential_pending` (`apps/api/src/provider-service.mjs:18`; `src/provider/repository.mjs:24,53`).
- Change: each fixture now asserts that the local worker's successful `testId` equals its public connection-test receipt, then passes that exact ID in the public `ready` request. All prior quota, ownership, admission, idempotency, SSE, and existing-task assertions remain.
- Command: `node --test tests/integration/ai-task-api.test.mjs tests/integration/provider-admission-wiring.test.mjs` exited 0; 6 passed, 0 failed, 0 skipped; duration 452 ms. This is a later local in-memory snapshot than the evidence above, still without DB or release coverage.
