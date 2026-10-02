# V1-PROVIDER-PROBE-FIX r17 / Worker-A

status: completed
work_package: V1-PROVIDER-PROBE-FIX r17
workspace: `/Users/apple/Progame/DGOS`
baseline: `tests/provider/evidence/V1-PROVIDER-FAILURES-r8-2026-10-02T03-16-29-684Z-3abfcf64.json` (real independent run: 429 misclassified, malformed 200 succeeded, running cancel 15009ms)
starting_head: `72ab1cb98b064a6e27b9f60a9f8f00881a827a99` (dirty candidate; not a commit-bound source identity)
files_changed:
  - `apps/api/src/provider-service.mjs` (only `createOpenAiCompatibleAdapter` probe helper)
  - `apps/worker/src/provider-test-worker.mjs`
  - `tests/integration/provider-worker.test.mjs`
  - `tests/provider/provider-probe.test.mjs`
  - `.herdr/V1-PROVIDER-PROBE-FIX-r17.md`
tests_added:
  - Probe classification, models envelope validation, bounded request, signal propagation and response redaction in `tests/provider/provider-probe.test.mjs`.
  - Worker cancellation, late-success rejection, claimed-cancel terminal audit and unresponsive-probe deadline in `tests/integration/provider-worker.test.mjs`.
commands_run:
  - command: `env -u DGOS_DATABASE_URL node --test tests/provider/provider-probe.test.mjs tests/integration/provider-worker.test.mjs tests/integration/provider-test-loop.test.mjs`
    result: 9 passed, 0 failed, 0 skipped
  - command: `env -u DGOS_DATABASE_URL node --test tests/integration/provider-api.test.mjs tests/integration/provider-worker.test.mjs tests/provider/provider-probe.test.mjs`
    result: 10 passed, 0 failed, 0 skipped
  - command: `node --check apps/api/src/provider-service.mjs; node --check apps/worker/src/provider-test-worker.mjs; node --check tests/provider/provider-probe.test.mjs; node --check tests/integration/provider-worker.test.mjs; git diff --check -- apps/api/src/provider-service.mjs apps/worker/src/provider-test-worker.mjs tests/integration/provider-worker.test.mjs`
    result: all exit 0
implementation_facts:
  - OpenAI-compatible `/models` probe forwards AbortSignal and a bounded timeout to actual `ProviderEgress.request`, caps the response at 64 KiB, classifies 401/403 as authentication_failed, 429 as rate_limited, other non-2xx as upstream_unavailable, and malformed/incompatible successful JSON as protocol_mismatch. It returns no upstream body or credential.
  - Worker enforces a total run deadline even if an adapter ignores abort; checks abort after awaited preflight steps to prevent a subsequent egress request; observes cancellation/lease loss during probing; and rejects a late success after cancellation or timeout. A claimed cancel request and normal terminal states use the same `finishConnectionTestWithAudit` path, preserving repository transaction and exactly-once terminal audit on successful state transition.
  - No changes to public error keys, permission/auth controls, ProviderEgress/TLS policy, schema, account CRUD, shared server or worker entrypoints, I harness, or D/H service resources.
source_sha256:
  apps/api/src/provider-service.mjs: `6be98c6fcfbdea7e60885c63d01746d4a7c33bbf9b103bbe9c76f672c833aeae`
  apps/worker/src/provider-test-worker.mjs: `54282d45567350a3ac3578946623764ea9a711968d59b93d956127c4103d1864`
  tests/integration/provider-worker.test.mjs: `3c1e03d6e593ca296d27e03f2022e292a540f2942ba9e81f8543b73039c2e77e`
  tests/provider/provider-probe.test.mjs: `66a814c3b42a4c7d18847104ce5974623a80cfe6f6a8ce2e471eaa6648e3f79c`
contract_changes_proposed: []
open_risks:
  - The focused tests use in-memory repository and controlled egress doubles; they do not replace I's real PostgreSQL/Redis/TLS multi-process matrix. I must load new worker processes and rerun that matrix against this source identity.
  - A non-cooperative adapter may continue its already-started asynchronous work after the worker has marked a terminal result. The production probe now receives AbortSignal through ProviderEgress, and the worker does not issue further requests or accept late success; I's live cancellation case verifies actual transport teardown.
docs_to_update:
  - Lead/Planner may attach I's rerun evidence to FR013 AC02/04 after independent verification; no authoritative docs changed in this work package.
incomplete_items: []
lead_or_planner_decisions_needed: []

Stop-writing receipt: Worker-A is done with r17 product paths. Lead should ask I to reload its isolated API/worker processes and rerun the existing independent failure matrix; Worker-A did not restart D15200 or H15175-77.
