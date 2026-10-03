# V1-DESKTOP-CANDIDATE r9 preparation / Worker-F

- `status`: preparation delivered; native candidate acceptance **not run**. Stop writing pending D final dist and Lead's exclusive native window.
- `work_package`: V1-DESKTOP-CANDIDATE r9, `.herdr/v1-convergence-r16.md` F. Workspace `/Users/apple/Progame/DGOS`; no commit, push, delegation, Web/dist write or full native run.
- `files_changed`: `scripts/v1-desktop-real.mjs`, `apps/desktop/scripts/candidate-preflight.mjs`, `apps/desktop/scripts/workbench-main-driver.js`, `apps/desktop/scripts/workbench-frame-driver.js`, `apps/desktop/src-tauri/src/host.rs`, this report.
- `tests_added`: candidate preflight assertions for exactly 47 migrations through 0051 and seven frozen 0045-0051 checksums; frozen signed 1.0.1/build2 envelope/root/resource digest; native binary embedded dist asset names. Candidate runtime asserts signed install/permissions, actual sandboxed APP GUI model selection/parameters, submit, bridge delta, Artifact, full page reload/resume of the same task, PG execution snapshot, and WindowServer screenshot.
- `contract_changes_proposed`: []
- `docs_to_update`: Lead/Planner may link this preparation receipt; no AC/E2E promoted until a successful final native manifest, image review and independent verification.

## Preparation facts

`candidate-preflight.mjs` selects exactly 47 discovered migrations through `0051-proxy-provisioning`. Frozen 0049/0050/0051 checksums are `ba0bc80a0ccc74e05a5244b50e52e6a26df39ad854995ba038020b7d5d954f1b`, `8802fe3a02b0bf7364aeac96215da09454d0c53b48c06d2cb76c6f3d6b455d85`, `778fddef654d67bc3ecfc01e11fd91f826f91d68a5b6c5c72568b5e35cca1939`. The frozen signed fixture is only read: envelope SHA-256 `d68a6e06e11a513cdd94511dee71ce18b931c97d6a19692ff6cf865726324f77`, root SHA-256 `51fa44c893658e2a0f2bf404bbac1a38ca08525169278dbfe22f56ed38bd8283`, package digest `sha256:0440088ded07140699950453704a5328b4a48e7046564216b6408d3d8a852eef`. A final run must pass this preflight before creating its isolated database.

The candidate harness installs that exact package through public `/apps` into its randomized PG database, grants its nine declared capabilities through public `/permissions`, and configures a controlled OpenAI-compatible Provider. A real text profile with `uiSchemas.parameters` is validated, confirmed and published through the existing public Provider protocol routes, then bound to the Provider config. No model-resolution HTTP shortcut, built-in APP substitute or signed-resource rewrite was introduced. Direct HTTP reads are used after the GUI flow to verify resulting Task state and PG execution snapshot, not as evidence that the signed APP submitted it.

Debug-only, dedicated `com.dgos.desktop.test.*` injection drives the actual signed iframe DOM in the Tauri Webview. The main-frame driver clicks the catalog launch control, observes APP bridge messages and UI-selected parameters, reloads the page after the first completed task, relaunches the installed APP, and resumes the same task ID. The child-frame driver is limited to the workbench resource path and acts on model, prompt, submit, resume and Artifact controls. This is automated DOM input, not human input. The harness requires a WindowServer window and app-only screenshot with manual visual review pending; a DOM marker alone cannot pass. Release builds cannot enable the test driver.

## Checks and current gate

Commands executed in the main tree:

- `node --check scripts/v1-desktop-real.mjs`; `node --check apps/desktop/scripts/{candidate-preflight.mjs,workbench-main-driver.js,workbench-frame-driver.js}`: all exit 0.
- `node apps/desktop/scripts/check.mjs`: exit 0, desktop config complete.
- `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml --jobs 1`: exit 0; debug source type checked, no `.app` rebundle.
- `git diff --check -- scripts/v1-desktop-real.mjs apps/desktop/src-tauri/src/host.rs apps/desktop/scripts/candidate-preflight.mjs apps/desktop/scripts/workbench-main-driver.js apps/desktop/scripts/workbench-frame-driver.js`: exit 0.
- `node` discovery of migrations through 0051: count 47, final 0051, 0049/0050/0051 hashes matched board.
- `node apps/desktop/scripts/candidate-preflight.mjs`: exit 1 as intended on `native_bundle_dist_mismatch`. Dist changed while D works: the latest observed JS asset was `index-BB7FEpSV.js` SHA-256 `ead08e844df329ccdf3727ca27d21e2d3472dfdebae9018d14d6533f324c0347`; `index.html` SHA-256 `c9b005431e97ba488c402194582fa3025fa986b004905effec6b7a0955edad72`; CSS `index-BFWr4XFs.css` SHA-256 `fa3cf098e7e1bf210a0960839de2472b8f6fe88dcdbad29210e3ad7e77627383`. Existing debug `.app` executable SHA-256 `3100f469e6a83d6bb3f89b0242bb1dadfcc4ef69d8fbfcb271911a031b95a7a9` still embeds `index-NGmdgJAM.js`. These are preparation observations, not final identity.

Final window sequence after D stop and Lead handoff: from `/Users/apple/Progame/DGOS`, record final dist hashes; `node apps/desktop/scripts/candidate-preflight.mjs` should still reject the old binary; package that frozen dist with `cd apps/desktop/src-tauri && cargo tauri build --config '{"build":{"beforeBuildCommand":""},"bundle":{"targets":["app"]}}' --debug --bundles app -- --jobs 1` (explicitly no Web rebuild); return to main tree, run `node apps/desktop/scripts/candidate-preflight.mjs` and then `node scripts/v1-desktop-real.mjs`. The final command writes an append-only run-ID manifest and app-only PNG in `.herdr/`; review the PNG and bind the observed source/app/dist hashes. The harness uses PG parent `127.0.0.1:5432/dgos_v1_integrated` to create/drop `dgos_v1_desktop_<random>`, Redis `127.0.0.1:6379/7` with unique `v1-desktop:<random>:secret:*` prefix, Provider fixture `127.0.0.1:15157`, API `127.0.0.1:15158`, dedicated test keychain service and temporary package/workspace directory. Its `finally` terminates native child, removes the keychain item, stops worker/API/fixture, clears Redis prefix, drops isolated DB and deletes temp directory; manifest records cleanup failures. It does not touch D15200 or publish a release.

- `implementation_facts`: code and tooling preparation above; no candidate runtime pass claimed.
- `open_risks`: final dist identity and rebuilt `.app` wait for D/Lead; sandbox iframe driver behavior, actual bridge/Provider response, visual screenshot and cleanup still require the scheduled native run. Developer ID identity/signing and notarization remain external and unproved.
- `unfinished_items`: final same-build native execution, screenshot review, manifest verification and Lead acceptance mapping.
- `lead_or_planner_decisions_needed`: Lead schedules exclusive final dist/build/native window after D stop receipt; no product-contract decision requested.
