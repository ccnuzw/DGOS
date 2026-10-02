# V1-BROWSER-BRANCHES r9 / Worker-D

status: delivered_static; browser execution pending Lead
work_package: `.herdr/v1-browser-branches-r9.md`; V1-platform / V1-assistant; FR001/003/009
workspace: `/Users/apple/Progame/DGOS`

## Stable `case_passed` names for Verify

The following fixed names are reserved for one JSON line `{"case_passed":"<name>"}` after the stated real browser assertions. A test that fails or never enters the branch emits no corresponding line. These are branch receipts, not an AC or E2E completion claim.

| Name | Branch |
| --- | --- |
| `ui.skill.translation_apply` | Real translation Task, Artifact, apply and readback |
| `ui.skill.translation_stale_rejected` | Old version apply returns 409 and preserves translated value |
| `ui.mcp.first_install` | Initial absence, template preview, credential first install |
| `ui.mcp.connect_invoke` | Enabled/connected discovery and confirmed Run reaches succeeded |
| `ui.assistant.ask_request` | Fresh scoped ask plan, permission request remains ask; execute unavailable |
| `ui.assistant.allow_replan_navigation` | Explicit versioned System allow, new plan, durable Run and Settings navigation |
| `ui.system.appearance_context` | Real GUI appearance change and public Settings/context readback |
| `ui.system.locale_context` | Real GUI locale change and public Settings/context readback |
| `ui.system.grid_context` | Real GUI grid change and public Settings/context readback |
| `ui.system.cas_conflict` | Stale Settings version rejected without state change |
| `ui.system.restore` | Original domains restored with fresh versions and context readback |

No r9 browser case has run or emitted one of these lines yet.

## Changes and exact scope

- `apps/web/e2e/real-management-fixture.spec.mjs`: the first-install title now fails if the target MCP is already present; a separately named installed-MCP title covers connect/discovery/confirmed invocation. The assistant title writes an explicit scoped `ask` through versioned public System settings, asserts the first plan is `ask`, request stays `ask`, then UI `allow`, replan, durable Run and Settings navigation. It restores `ask` in `finally`. The fixed JSON lines are emitted only after their branch assertions.
- `apps/web/e2e/real-context.spec.mjs`: one no-`page.route` signed-in test changes appearance, locale and grid through the GUI, checks public Settings/context readback and increasing `contextVersion`, rejects a stale Settings CAS write with 409 and unchanged grid, then restores the three original domains using fresh versions. This is control-plane Web evidence only; it does not prove a signed APP received context or a macOS host applied appearance.
- `.herdr/V1-BROWSER-BRANCHES-r9.md`: this branch list and handoff. No Web product source, dist, fixture server, service, runner, schema or authority document was changed.

## Static verification and execution handoff

From repository root, `node --check apps/web/e2e/real-management-fixture.spec.mjs` and `node --check apps/web/e2e/real-context.spec.mjs` exited 0. `REAL_MANAGEMENT_FIXTURE=1 pnpm --filter @dgos/web exec playwright test -c playwright.config.mjs e2e/real-management-fixture.spec.mjs e2e/real-context.spec.mjs --list` exited 0 and listed exactly 5 tests in 2 files. `git diff --no-index --check /dev/null` on each of the two untracked test files exited 0. These are static checks, not browser passes.

File SHA-256: management fixture test `3abcb6980d77bc5f80bd4693fac1a14d712f3297c7d13ce4f1962747835ea13b`; real context test `4c94b81750f24cb89bc7746ab2eec3cb57fedfe8d21b87a6150fbb54d9308609`. Frozen dist remains HTML `550b23358dbf1324c1cdf67456242e4d7c64368468790a1940edb1201aeb835f`, JS `360c42b6cc5d9e96c4e3354e4fa846865dc51c97133a901f40487f719752ce1c`, CSS `fa3cf098e7e1bf210a0960839de2472b8f6fe88dcdbad29210e3ad7e77627383`.

Lead-run command after H Web/API/worker readiness and private state validation:

```sh
REAL_MANAGEMENT_FIXTURE=1 WEB_EXTERNAL=1 WEB_BASE_URL=http://127.0.0.1:15176 pnpm --filter @dgos/web exec playwright test -c playwright.config.mjs e2e/real-management-fixture.spec.mjs e2e/real-context.spec.mjs --workers=1
```

The first-install title requires a fresh target MCP absent from H's child database. The existing r7 H fixture has that target installed, so a full rerun there will fail the precondition by design. H/Lead must own a fresh scoped fixture lifecycle; from repo root the documented commands are `node scripts/v1-ui-management-fixture.mjs --stop` then `node scripts/v1-ui-management-fixture.mjs`, after preserving old evidence and coordinating all consumers. Neither command was run by D. To run only the reusable installed subset on current H state, use `REAL_MANAGEMENT_FIXTURE=1 WEB_EXTERNAL=1 WEB_BASE_URL=http://127.0.0.1:15176 pnpm --filter @dgos/web exec playwright test -c playwright.config.mjs e2e/real-management-fixture.spec.mjs -g 'real installed MCP connects' --workers=1`; it cannot emit `ui.mcp.first_install`.

Limits: browser behavior, fresh-session step-up requirements, API response shape and restoration were not exercised in r9. The real context test mutates reversible shared H settings via public API; run it without concurrent H settings writers. The assistant test also writes one permission rule and restores `ask`; if its initial rule was `allow` or `deny`, that original decision is not preserved. Use a fresh scoped fixture for the complete branch run. Any browser defect or cleanup failure belongs in a new result, not as an inferred pass here.

Worker receipt: `files_changed` are the two tests and this report; `tests_added` is the real context test plus explicit split/branch assertions in the existing fixture test; `contract_changes_proposed`: []; `open_risks`: unrun browser and fresh fixture prerequisite; `docs_to_update`: none until Lead's real evidence; `unfinished_items`: Lead browser execution and resulting evidence; `lead_or_planner_decisions_needed`: Lead schedules fixture lifecycle and candidate window. D stops writing now. No commit, push, server action or Web/dist build.
