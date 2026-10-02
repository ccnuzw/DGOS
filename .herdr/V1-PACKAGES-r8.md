# V1-PACKAGES r8 delivery

- status: ready_for_Lead_restart_and_D_retest; G patch and targeted tests complete; D's live retest remains open.
- work_package: V1-PACKAGES r8, Worker-G. No commit, push, delegation, API restart, D environment write, package byte change or root regeneration.
- files_changed: `src/apps/package-service.mjs`, `tests/unit/app-packages.test.mjs`, `tests/integration/app-package-routes.test.mjs`, this report.
- tests_added: exact `dgos.aiTask.get` snapshot with optional `text/error: undefined`, finite float receipt, `dgos.model.resolve` optional/float projection, invalid business JSON rejection and prepared receipt replay guard.

## Root cause and fix

`AiTaskService.get()` returns a safe snapshot whose optional `text` and `error` can be `undefined`. The bridge handler completed, but `DiskPackageStore.writeReceipt()` used `canonicalJson`, the signed package serializer. That serializer only permits safe integers and rejects `undefined`. A route regression with `text/error: undefined` plus `temperature: 0.7` reproduced HTTP 422 before the fix. The public error mapper renders `invalid_package_json` as "Package declaration is invalid".

`bridgeJson` is now a separate bounded business JSON serializer for bridge input digests and durable receipts. It deterministically sorts keys, permits finite floats, omits optional object properties with `undefined`, and rejects array holes/undefined, NaN, Infinity, cycles, functions, non-plain objects, excess depth/entries and more than 1 MiB serialized bytes. Handler results are projected through this serializer before receipt storage and return, so replay matches the HTTP JSON response. For `dgos.model.resolve`, required public result fields must remain present after projection; missing required fields are rejected rather than silently omitted. The signed manifest/resource `canonicalJson` is unchanged and still rejects floats.

An invalid handler result after the prepared receipt is written leaves the receipt prepared. Retrying the same instance/requestId returns `upstream_outcome_unknown` and does not rerun the handler. This preserves the unknown-outcome rule for write operations.

## Commands and evidence

- Before patch: `node --test tests/integration/app-package-routes.test.mjs` reproduced 422 instead of expected 200 for a successful handler result with float and optional undefined.
- After patch: `node --test tests/unit/app-packages.test.mjs tests/integration/app-package-routes.test.mjs`: 16/16 pass, including real Fastify route and opaque Chromium static resource test.
- `DGOS_BUNDLE_ENVELOPE=/Users/apple/Progame/DGOS/.herdr/state/package-fixture/ai-workbench-envelope.json node --test tests/integration/app-package-browser.test.mjs`: 1/1 pass. The first combined invocation omitted this required env var and that fixture test could not start; rerun with existing envelope passed.
- `node --check src/apps/package-service.mjs`: exit 0. `git diff --check` on G files: exit 0.
- SHA-256: package service `661b2de4262380faf1de1f4016be12bf93d4e30d977f5c6c49de4a3191a13c99`; unit test `8a1eba0e3632ec730f72992d55d7a7f3c45cbf0de067493d6bf9e17ac886e148`; route test `af270abe5415e9596e296531aad8006c94ef1ede3f6304e7c881dae9fdad0a12`.
- Official manifest SHA-256 remains `b7e3654960ed2c27746342a9c098c8ae41baded707f60d3d581e56d0df15ce52`; existing signed envelope remains `8e465a80d846cd989e6867295456ced7c5579da3392700503e2852e93f616c96`.

## Handoff and limits

Lead may restart the API with this source. D reported model.list/resolve/submit/events 200 and `dgos.aiTask.get` 422 for an already submitted Task. After restart, D should create a new launch instance and query the **original taskId** via get/events. Do not submit the Task again. The old instance's prepared receipt remains an unknown outcome and is deliberately not replayed.

This report proves targeted service, route and fixture behavior; it does not claim the integrated API/browser/worker retry has passed. Business result checks beyond model.resolve required fields remain the registered Lead handler/domain's responsibility; no unrelated app capability or schema was changed.

- contract_changes_proposed: []
- open_risks: D live retest; operator reconciliation of old prepared receipts for write calls if encountered.
- docs_to_update: Lead/Planner acceptance evidence after D's real browser Task/get/events/artifact result.
- incomplete_items: integrated D retest only.
- decisions_needed: []
