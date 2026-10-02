# V1-PROVIDER r3 delivery

status: H_DOMAIN_COMPLETE_LEAD_INTEGRATION_PENDING
work_package: V1-PROVIDER r3; main-directory H paths only; 2026-10-02

files_changed:
- `src/provider/repository.mjs`, `apps/api/src/provider-service.mjs`: account state/delete transactional audit, durable Secret revoke intent and reconciliation, controlled `ready` requiring successful `connectionTestId` for the current account version.
- `src/provider-config/repository.mjs`, `src/provider-config/service.mjs`, `src/provider-config/task-admission.mjs`: transactional config/policy audit and account→config lock order; transaction-aware new Task admission; public `adapterVersion` projection from stored `protocolVersion`.
- `src/provider-config/text-profile.mjs`, `src/provider-config/text-profile-directory.mjs`, `src/provider-config/protocol-confirmations.mjs`, `apps/api/src/provider-protocol-routes.mjs`: V1 text-only declaration validation, persisted directory, session-bound five-minute single-use confirmation tickets, protocol routes and audit-atomic publication/state changes.
- `migrations/0036-provider-operations.sql`, `migrations/0039-provider-protocol-confirmations.sql`: provider operation storage and separate immutable declaration/state revision plus confirmation tickets. Frozen 0036 SHA256: `24f5649da8b92b2d3ee9c63e9bbf9a7a5ed897180da761a6211c5c0ed8996aad`. New 0039 SHA256: `07259111a3c3808c5e6070b0189bd0bf74dcd040623b137590b17bd452bd8b12`.
- Only the Provider block of `tests/security/v1-governance-e2e.test.mjs` was adapted earlier; no Task/Quota or shared server/worker files were edited by H.

tests_added:
- `tests/provider/provider-audit-atomic.test.mjs`, `provider-text-directory.test.mjs`, `provider-protocol-routes.test.mjs`, `provider-protocol-confirmations.test.mjs`; existing Provider admission/disabled tests exercised.

commands_run:
- `node --test tests/provider/provider-protocol-routes.test.mjs`: 1 pass.
- `DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_provider node --test tests/provider/provider-protocol-confirmations.test.mjs tests/provider/provider-text-directory.test.mjs tests/provider/provider-audit-atomic.test.mjs`: 3 pass.
- `node --test tests/provider/provider-config-disabled.test.mjs tests/provider/provider-admission-profile.test.mjs`: 3 pass.
- `node --test --test-name-pattern=V1-E2E-13 tests/security/v1-governance-e2e.test.mjs`: fails at server construction with `provider_confirmation_store_required`, before test assertions, because Lead's server still supplies obsolete `verifyConfirmation` rather than `confirmations`.
- `DGOS_DATABASE_URL=... node scripts/apply-migrations.mjs`: stopped on existing 0034-extension-recovery checksum mismatch. 0039 was then applied and recorded transactionally using the project `pg` client against **only** `dgos_v1_provider`; PG tests passed. No shared DB/Redis was touched.
- `node --check` for Provider route/service/confirmation modules, `git diff --check` for H paths, and SHA256 checks for 0036/0039 passed.

implementation_facts:
- `createTaskAdmission({configRepository,accountRepository,registry})` accepts B's `admission({ownerId,providerConfigId,modelId,intent,transactionClient:client})`; account/config/catalog/policy reads share that client. It gates new submit/dispatch; an already sent upstream attempt recovers and converges by original `taskId` without a new-admission cancellation.
- Account `ready` is explicit `setState({accountId,baseVersion,state:'ready',connectionTestId})` after a succeeded test on the same account version. UI should pass the returned test ID; no fixture or production auto-ready bypass.
- Publication confirmation flow: validate `POST /api/v1/provider/capability-protocols`; issue `POST /api/v1/provider/capability-protocols/confirmations` with `{requestId,operation:'provider.protocol.publish',protocolId,version,declaration,validationDigest}`; publish with the same requestId and returned confirmationId. For state, issue the same endpoint with `{requestId,operation:'provider.protocol.state',protocolId,version,baseVersion,state}`, then send that requestId and ticket to the state endpoint. Ticket binds subject, session, operation, id, declaration version, canonical payload digest and request ID; its consumption commits with declaration/state and audit/outbox. Reuse, expiry, wrong session and changed payload fail closed.
- `registryVersion` now reports independent `state_version`; SQL declaration `version` remains immutable. Protocol directory `status` is present; public ProviderConfig `adapterVersion` maps the stored adapter protocol version.

contract_changes_proposed:
- Planner should add the confirmation issuance POST operation and request/response schema to the sole V1 OpenAPI. The existing publish/state `confirmationId` remains unchanged. The issuance route requires CSRF, `provider.protocol.write`, a fresh admin session and a real session ID; it does not accept API-key authentication.
- Lead must replace `verifyConfirmation: protocolOptions.verifyConfirmation` at `apps/api/src/server.mjs:127` with `confirmations: protocolOptions.confirmations ?? (runtimePool ? new PostgresProviderProtocolConfirmations(runtimePool) : new InMemoryProviderProtocolConfirmations())`, importing both classes from `src/provider-config/protocol-confirmations.mjs`. Keep fail-closed registration. The current server startup failure above is the evidence for this required wire.
- Lead should wire `ProviderService.reconcileSecretRevocations()` into worker startup and recurring loop, and preserve the existing new Task admission injection in API/worker paths.

open_risks:
- Lead-owned server wiring is pending, so E2E13 is currently blocked before assertions; rerun it after the confirmation store is wired. No assertion was weakened.
- The full migration runner cannot pass the existing 0034 checksum discrepancy in the dedicated DB. 0039 was applied directly there; Lead must reconcile migration history before using the full runner. Never rewrite 0036 or 0039 after this checksum freeze; any later schema change needs a new number.
- Confirmation issuance has no UI yet. Lead/Planner should expose an explicit review/confirm action that calls the issuance route from the fresh session before publish/state.

docs_to_update:
- Planner: `docs/04-技术架构/当前版本/V1-openapi.yaml` confirmation issuance operation/schema and protocol state revision semantics.
- Lead: integration status/evidence after server and worker wiring, dedicated Compose migration and E2E13 rerun.

limitations: Only fixture and dedicated PostgreSQL evidence. No real upstream credential or network provider was invoked in this r3 continuation; no commit/push/delegation.
