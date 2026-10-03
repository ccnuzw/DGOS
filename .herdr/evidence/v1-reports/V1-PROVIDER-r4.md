# V1-PROVIDER r4 delivery

status: H_DOMAIN_READY; API_EMBEDDED_TASK_PROFILE_PATH_VERIFIED
work_package: V1-PROVIDER r4 (continuation r5), FR007/012/013, 2026-10-02
workspace: `/Users/apple/Progame/DGOS` main directory; H files only; no commit/push/delegation.

files_changed:
- `src/provider-config/text-profile-directory.mjs`, `text-profile.mjs`, `protocol-confirmations.mjs`, `task-admission.mjs`, `repository.mjs`, `service.mjs`: immutable SemVer history, independent registry state CAS, session-bound confirmation and stored success receipts, explicit config→protocol version binding, transaction-aware Profile admission, and read-only `createModelResolver`.
- `src/provider-adapters/openai-compatible.mjs`: bounded text interpreter chooses `chat.completions` or `responses` only from the active bound declaration and exact model match; disabled/missing Profile rejects before egress. No arbitrary path, script, model-name heuristic, or media operation.
- `apps/api/src/provider-protocol-routes.mjs`: operation-specific confirmation issuance field validation; publish/state mixtures rejected before ticket creation.
- `migrations/0040-provider-profile-bindings.sql` and `0043-provider-protocol-receipts.sql`: explicit binding fields and atomic immutable success receipt. 0039 was not changed.

tests_added:
- `tests/provider/profile-task-wiring.test.mjs`: public protocol publish, explicit config binding, Provider validation/ready/catalog/policy, public Task submit, embedded worker, terminal snapshot and Artifact against a controlled local Responses SSE fixture. Exactly one `/v1/responses` request and zero `/v1/chat/completions` requests.
- `tests/provider/provider-no-export.test.mjs`: authenticated Provider API has no import/export routes; account/config/list responses omit credential, SecretRef and credential reference. UI export absence remains D's separate assertion.
- `tests/provider/provider-admission-profile.test.mjs`: bound Responses operation reaches `/responses` with matching input, `resolveModel` matches the same operation, and disabled/historical Profile rejects before egress.
- `tests/provider/provider-protocol-routes.test.mjs`: mixed confirmation fields reject with zero ticket/audit side effect; identical publish/state replay returns saved result; changed payload conflicts.
- `tests/provider/provider-protocol-confirmations.test.mjs`, `provider-text-directory.test.mjs`: PG ticket/session binding, stored success replay, state revision, historical immutability, two-owner same ID concurrency. PG tests accept only `dgos_v1_provider` or `dgos_v1_verify_[0-9a-f]{32}` databases.

commands_run:
- Follow-up after Lead shared-entry injection: `node --test tests/provider/profile-task-wiring.test.mjs`: 1 pass, 0 fail/skip. `node --test tests/provider/profile-task-wiring.test.mjs tests/provider/provider-protocol-routes.test.mjs tests/provider/provider-admission-profile.test.mjs tests/provider/provider-no-export.test.mjs`: 6 pass, 0 fail/skip. `node --test --test-name-pattern=V1-E2E-13 tests/security/v1-governance-e2e.test.mjs`: 1 pass. `git diff --check -- tests/provider/profile-task-wiring.test.mjs`: pass. 0043 SHA remains `2cbc7d81813a50c85393ae857b260c796e8a7ea4db8f7c122541ab0abf5266fb`.
- `node --test tests/provider/provider-no-export.test.mjs tests/provider/provider-protocol-routes.test.mjs tests/provider/provider-admission-profile.test.mjs tests/provider/openai-compatible-fixture.test.mjs`: 10 pass, 0 fail/skip.
- `DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_provider node --test tests/provider/provider-audit-atomic.test.mjs tests/provider/provider-protocol-confirmations.test.mjs tests/provider/provider-text-directory.test.mjs`: 4 pass, 0 fail/skip.
- `node --test --test-name-pattern=V1-E2E-13 tests/security/v1-governance-e2e.test.mjs`: 1 pass, 0 fail/skip after Lead confirmation-store injection.
- Broad `node --test tests/provider/*.test.mjs tests/integration/provider-api.test.mjs tests/integration/provider-worker.test.mjs tests/security/provider-egress.test.mjs tests/security/provider-egress-transport.test.mjs`: 23 pass, 4 PG-only skip without database env, 0 fail.
- `git diff --check` on H paths passed. SHA256 0039=`07259111a3c3808c5e6070b0189bd0bf74dcd040623b137590b17bd452bd8b12`; 0040=`761b4b96d3a7c509198dbdd1cd1d958b92a28f6b8f4cee449ebf99b080050343`; 0043=`2cbc7d81813a50c85393ae857b260c796e8a7ea4db8f7c122541ab0abf5266fb`.
- Applied 0040 and 0043 transactionally only to `dgos_v1_provider` with checksum checks in `dgos_schema_migrations`. Both checksums are now frozen. No 0041 H migration exists; 0041 belongs to G and 0042 to C.

implementation_facts:
- `createModelResolver({configRepository,accountRepository,registry,profileDirectory})` returns the exact `ModelResolution` public projection for `{ownerId,providerConfigId,modelId,intent:'text.chat'}`: `providerConfigId,modelId,intent,descriptorVersion,profile,workflow,defaults,limits,uiSchemas,assets` and paired `protocolId/protocolVersion` only for explicit binding. It shares `createTaskAdmission` checks with Task submit, so bridge `dgos.model.resolve` and Task selection use the same declaration interpreter.
- Provider config binding is explicit `capabilityProtocolId` + `capabilityProtocolVersion`; publishing a new declaration does not migrate any config. Inactive or missing bound declaration, model not in Profile, policy disable, account/config disable, stale catalog all fail new admission. Existing taskId recovery remains separate.
- Successful protocol publish/state replay checks `{subjectId,sessionId,confirmationId,operation,resourceId,version,digest,requestId}` against the stored receipt before checking consumed/expired ticket. Identical replay returns original JSON without state/audit mutation; changed binding/payload conflicts. PG mutation, receipt, audit/outbox and ticket consumption commit together. Per-request then per-profile advisory locks prevent same-request races and global profile-ID PK collisions.
- Confirmation issuance still enforces CSRF, `provider.protocol.write`, fresh admin session and session auth through Lead's `requireScope`/`requireFreshSession`; API keys cannot issue. Publish and state fields are disjoint as Planner's OpenAPI oneOf requires.

contract_changes_proposed:
- Lead shared API/worker entries now inject `profileDirectory` into config service, admission/resolver and execution adapter. H rechecked the code paths after the update; the embedded public Task fixture confirms the adapter's internal active-profile lookup selects the Responses operation. `admitted.textProfile` is not forwarded by Task submit/dispatch, but the execution adapter independently resolves the bound immutable version and rejects inactive declarations before egress. No change to B-owned Task code is required for this proven embedded path.
- Planner OpenAPI should add optional paired config binding fields to the single `ProviderConfig`/create/update projections if desired for external user selection; current backend fields are H implementation pending contract review. No second public Profile DTO was added.

open_risks:
- The bound Profile→Task→Artifact flow is now demonstrated through the public API with an embedded in-memory worker and local HTTP fixture. The separate PostgreSQL worker process and Compose path were not exercised by this follow-up; those remain Lead/Verify integration evidence, not a known code failure.
- Existing `provider_text_profiles` 0036 primary key is global `(profile_id,version)`; H now serializes allocation per profile ID and uses global internal version numbers. Historical owner/version rows remain immutable; dedicated PG concurrent two-owner test passed.
- UI absence of export and complete browser workflow are outside H's API no-export evidence. No real user credentials or paid provider call occurred.

docs_to_update:
- Lead: integrated Task/worker/profile-directory wiring and full Profile→Task→Artifact result after shared entry changes.
- Planner: optional explicit config binding fields, AC evidence mapping, and H's exact `ModelResolution` projection. Do not promote FR007 to complete from fixture-only evidence.

unfinished: D-owned UI export absence and separate PostgreSQL-worker/Compose integration evidence. H-domain implementation and tests are stopped after this report.
