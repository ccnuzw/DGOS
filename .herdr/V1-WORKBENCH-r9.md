# V1-WORKBENCH r9 / Worker-A

- status: delivered; stopped writing after this receipt
- work_package: V1-WORKBENCH-r9
- workspace: `/Users/apple/Progame/DGOS`; baseline `72ab1cb`
- files_changed: `apps/ai-workbench-package/{manifest.json,index.html,workbench.css,workbench.js}`, `scripts/{build-bundled-app,v1-package-fixture}.mjs`, `tests/integration/app-package-browser.test.mjs`; new isolated fixture `.herdr/state/package-fixture-r9/{ai-workbench-envelope,trust-roots}.json`
- tests_added: opaque signed Chromium bridge test for dynamic text parameters, same-request retry, incremental events before terminal, task ID resume, artifact, context theme/locale, revoked context polling, source/instance rejection, and invalid parameter rejection
- contract_changes_proposed: []
- docs_to_update: Lead/Planner may bind this fixture-level evidence to FR005 AC01/02/08 and FR001 AC04/05/08 after independent integration review.

## Implementation facts

The manifest is `dgos.ai-workbench` version `1.0.1`, build `2`, stable channel, with the same nine capabilities in both `permissions` and `capabilityAllowlist`. Only `resolve.uiSchemas.parameters` supported names become editable fields; the UI displays effective defaults/limits and submits numeric `options.parameters`. The package uses shared signed design tokens, reads and polls context with a numeric-string cursor, and renders locale/theme without changing host scale. A submission timeout retains its requestId and payload for explicit retry. Known task IDs use ordered event cursors, terminal snapshots, cancel, artifact read, and manual resume. Context polling stops after a bridge error. Opaque iframe submission uses an explicit button handler because native form submission is blocked by the sandbox.

D owns the host task restoration surface; this package accepts a task ID but has no cross-relaunch persistence inside the opaque iframe. An ambiguous submission lost during full window/process relaunch cannot be reconciled by this APP without an externally retained task/request reference; it must not be blindly resubmitted.

## Signed fixture

- Package digest returned by `verifyPackage`: `sha256:0440088ded07140699950453704a5328b4a48e7046564216b6408d3d8a852eef`.
- Root keyId: `official-fixture-efc6a001-fbdd-4967-8791-3d43b9f8ac45` (`source: official`). Trust root file SHA-256: `51fa44c893658e2a0f2bf404bbac1a38ca08525169278dbfe22f56ed38bd8283`.
- Envelope file SHA-256: `d68a6e06e11a513cdd94511dee71ce18b931c97d6a19692ff6cf865726324f77`.
- Signed resource SHA-256: `index.html` `daea0243ec0ca19221f3a2b76db6202a7fb9e0fccc7a9095afd5dde414cdf152`; `tokens.css` `35a831e1972bdba622007abfb75ca7755034d69a7b0f5d2aa67ca895e21fb744`; `workbench.css` `fab45f94c3828c7382e3b140e15b267bc988de8cd7e8da3d0c48fa3a1c62f82b`; `workbench.js` `7aad9fa1a33b51c081ed8e3e585942aebec17f18484ce08d944c752036619d2c`; `icon.svg` `c737d6af765181888d1a0d1d7b6fef1f7d04bf64f8b2a33949842b830b7ecd36`.
- Every signed resource SHA-256 matches the current source path. Since the final `generate` command, only `scripts/build-bundled-app.mjs` and `tests/integration/app-package-browser.test.mjs` changed; no manifest, package resource, token resource, envelope or root was changed. The earlier `.herdr/state/package-fixture/` remains version `1.0.0` build `1`, envelope SHA-256 `8e465a80d846cd989e6867295456ced7c5579da3392700503e2852e93f616c96`.

## Commands run and evidence

- `pwd` -> `/Users/apple/Progame/DGOS`; `git rev-parse --short HEAD` -> `72ab1cb`.
- `node scripts/v1-package-fixture.mjs generate --output .herdr/state/package-fixture-r9` -> signed `1.0.1/build 2`, nine capabilities and package digest above. This was the last signing run; no further root generation was performed.
- `node --test tests/integration/app-package-browser.test.mjs` -> 1 passed, 0 failed, 0 skipped against the signed bytes loaded in an opaque Chromium iframe. The test uses a controlled bridge fixture, not a live API/Provider.
- `node --check apps/ai-workbench-package/workbench.js`; `node --check scripts/build-bundled-app.mjs`; `node --check scripts/v1-package-fixture.mjs`; `node --check tests/integration/app-package-browser.test.mjs`; `git diff --check` -> exit 0.
- Node SHA-256 comparison of all five envelope resources versus current source -> five MATCH; root keyId matches envelope.

## Open risks and handoff

- open_risks: `D` host and real API/worker E2E remain to be verified by Lead/D/Verify. No installation/update was performed on D15200. A known task ID can be restored manually; cross-relaunch ambiguous submit has no APP-only resolution.
- unfinished_items: [] within r9 package scope.
- lead_or_planner_decisions: [] for this package; Lead owns fixture installation timing and evidence promotion.
- limitations: Browser test is fixture-level; it proves signed bytes and controlled bridge UI behavior, not a real Provider call or desktop window state.
