# V1-REGRESSION-DIAGNOSTIC r10

status: failed
scope:
  - One diagnostic main-tree memory/PG/guard sweep while owners were still writing; not frozen candidate acceptance. Product source and tests were read-only.
checks:
  - command: `shasum -a 256 migrations/0045* migrations/0046* migrations/0047* migrations/0048* migrations/0049* migrations/0050* migrations/0051*`; exit_code: 0; all seven exact hashes matched `.herdr/delivery-board.yaml`.
  - command: `node --check scripts/v1-regression-sweep.mjs`; exit_code: 0.
  - command: `DGOS_VERIFY_ADMIN_URL=postgresql://dgos:***@127.0.0.1:5432/dgos_v1_integrated node scripts/v1-regression-sweep.mjs --diagnostic-r10`; exit_code: 1; 86 files executed, 202 TAP pass, 13 fail, 31 skip, 12 excluded. No retry.
  - command: `node --test tests/tooling/v1-acceptance-tooling.test.mjs tests/tooling/verify-release.test.mjs`; exit_code: 0; 17 pass, 0 fail, 0 skip. Tooling only, after the diagnostic.
  - command: `node scripts/v1-regression-sweep.mjs --plan`; exit_code: 0; current read-only inventory has 100 main-tree tests after concurrent additions. Not a test run.
  - command: `git diff --check -- scripts/v1-regression-sweep.mjs tests/tooling/v1-acceptance-tooling.test.mjs`; exit_code: 0.
evidence_level: local
verified:
  - Immutable diagnostic pair: `docs/05-测试与发布/端到端验收/报告/V1-regression-diagnostic-r10-2026-10-02T01-52-18-203Z-82727f18.md` SHA256 `c7e0a2c03813f5a7aeef2dfa028921fc07ee3ecc85a0aaf45ccf0252068df4e5`; paired `-manifest.json` SHA256 `221895bf69e50f1049ade4793ca5ddaec39e64ce500c547168944a872e19b552`; 86 per-file TAP logs in the matching run directory.
  - Migration list applied 47 discovered SQL files through 0051; 0043/0044 and every 0045–0051 checksum were explicitly checked. No later SQL applied. The random child `dgos_v1_verify_b7a7f94548334882ab51534b055ad1b2` was dropped exactly; setup error null. Original `dgos`, owner databases, Redis DB0 and D ports were untouched.
  - Phase split: memory 67 files / 163 pass / 13 fail / 26 skip; PG 15 files / 36 pass / 0 fail / 0 skip; guarded 4 files / 3 pass / 0 fail / 5 skip. TAP skip is never counted as pass.
  - Worker E: `tests/extensions/extension-service.test.mjs` (4 failures), `hardening-r3.test.mjs` (3), `mcp-transport.test.mjs` (1) and `runtime-loader-r3.test.mjs` (1) share `invalid_package_json`; TAP stack reaches `src/extensions/service.mjs:68` constructing a digest object with undefined optional fields and `src/extensions/validation.mjs:4` calling strict `canonicalJson`. `extension-routes.test.mjs` additionally expected 202 but got 422 at install. These are 10 failures across five files, not 10 unrelated business gaps. E's in-progress canonical fix owns the root and should preserve strict package signature canonicalization.
  - Worker A: `tests/e2e/assistant-settings-actions.spec.mjs:26` expected 200 but got 403 on plan after current permission enforcement; `tests/integration/app-package-fixture.test.mjs:15` expected seven fixture capabilities but observed nine after context read/events were added. A owns those narrow test/fixture alignments. The former is a Node in-memory workflow, not browser E2E proof.
  - Worker C: `tests/security/v1-ops-durable-secret.test.mjs:121` failed `credential_unavailable`; the fake pool supplies `query` but not `connect`, while `PostgresAuditRepository.record` now requires a transactional connection. C owns the fake transaction adaptation and must preserve audit-failure fail-closed assertions.
  - Guard/skip detail: extension PG guard 4 skips and Task atomic guard 1 skip; network runtime 1 pass and governance hardening 2 pass under the strict Verify child predicate. Memory skips include newly added extension management PG tests (4), package retention PG (5), Provider parameters PG (1), network public/provisioning (2) and mixed dedicated-DB subtests. These are uncovered in this diagnostic, not passes.
  - After the run, Verify updated only the sweep's inventory and focused tooling assertion: new Provider/retention/extension management `*-pg` files map to PG, network public/provisioning to TLS, and mixed proxy provisioning to PG. Current script SHA256 `ef25cebd9963ab368ed04698b7fc7f492679e98faff8d7a1e809cb867abebc66`; tooling test SHA256 `d033792ff873b6078e97bac6b2aea641ceffe3e8907854952a47856dbbac591b`. This post-run inventory change does not alter historical r10 results.
limitations:
  - `source_drift=true`: start dirty-source SHA256 `a19af5a7f324489f569fc2f8a4e32ee21851aa4799840d98e0955b169e012c03`, end `ade68d82bef734da139c7d8119c7e75bc18b000c9d7705a563bd3a26d7761e76`, same HEAD `72ab1cb98b064a6e27b9f60a9f8f00881a827a99`. No stable build/source candidate is established. Owners were editing concurrently; no drift-driven rerun was made.
  - Diagnostic had 12 excluded browser/placeholder/Redis/TLS/blocked files. The later inventory includes additional tests absent from this run. No D browser/desktop, Redis DB6 or TLS fixed-port group ran.
  - `candidate_complete=false` because of failures, skips, exclusions and source drift. The 202 pass count is a local diagnostic count, not V1 E2E or release progress.
return_to_lead:
  - Collect A's two narrow fixes, C's transactional audit fake fix and E's canonical/route fixes with targeted test exits; do not overwrite this failed pair.
  - After owners freeze source, run newly grouped PG assets with the strict Verify child predicate and separately schedule TLS/Redis/browser/native groups. Bind all seven group manifests to one exact source/build before candidate summary. Do not infer coverage from this r10 diagnostic's memory skips.
