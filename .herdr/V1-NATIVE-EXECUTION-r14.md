# V1-NATIVE-EXECUTION r14 / Worker-F

- `status`: blocked; diagnostic driver update and three Lead foreground replays completed, but the signed Workbench flow remains incomplete.
- `work_package`: V1-NATIVE-EXECUTION r14, same native paths and restrictions.
- `files_changed`: `apps/desktop/scripts/workbench-main-driver.js`, `apps/desktop/scripts/workbench-frame-driver.js`, this report. Web/dist and signed package contents were not changed.
- `tests_added`: no standalone test; iframe lifecycle and postMessage diagnostics are emitted through existing stage history.
- `contract_changes_proposed`: []
- `docs_to_update`: Lead/Planner may link after reviewing the next native manifest; no acceptance promotion.

## Evidence and diagnosis

The first Lead replay `.herdr/V1-NATIVE-EXECUTION-r13-2026-10-02T05-57-04-253Z-5f3c2a30-manifest.json` reached a connected, loaded iframe with one injected path, but no host hello handshake; it failed at `signed_workbench_bridge_timeout`. The second replay `.herdr/V1-NATIVE-EXECUTION-r13-2026-10-02T06-00-39-305Z-9288255d-manifest.json` showed a visible WindowServer window and the same loaded/injected iframe, confirming that the native process and child resource remained alive while `dgos.app.ready` was absent. A third replay after hello retry `.herdr/V1-NATIVE-EXECUTION-r13-2026-10-02T06-03-44-247Z-543a6fc7-manifest.json` regressed to `webview_result_timeout` before any result file state was written. The latest replay `.herdr/V1-NATIVE-EXECUTION-r13-2026-10-02T06-06-52-349Z-38bed7f3-manifest.json` has the same early timeout. These are real failures, not acceptance evidence.

r14 adds non-invasive diagnostics in the existing drivers. After the iframe is found it records `present`, `load`, and `error` events with `readyState`, `contentWindow` availability, `src`, and DOM connection state. It also records injected paths and bridge readiness. A test-only host hello handshake was attempted in the drivers, but the real foreground runs did not produce a complete Workbench result and the change is not acceptance evidence. No permissions, sandbox flags, navigation policy, signed resource, or production bridge contract was changed.

## Commands run

| Command | Exit | Result |
| --- | ---: | --- |
| `node --check apps/desktop/scripts/workbench-main-driver.js` | 0 | valid syntax |
| `git diff --check -- apps/desktop/scripts/workbench-main-driver.js` | 0 | clean |
| `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml --jobs 1` | 0 | Rust source checked |
| `cargo tauri build --config '{"build":{"beforeBuildCommand":""},"bundle":{"targets":["app"]}}' --debug --bundles app -- --jobs 1` from `apps/desktop/src-tauri` | 0 | debug `.app` rebuilt without Web build |
| `node apps/desktop/scripts/candidate-preflight.mjs` | 0 | 47 migrations through `0051-proxy-provisioning`; frozen signed package and dist assets matched |

`node scripts/v1-desktop-real.mjs` was not run. Lead should run it in the foreground environment and retain the generated r14 manifest and window PNG.

Lead foreground runs actually executed:

| Manifest | Result | Observed terminal failure |
| --- | --- | --- |
| `.herdr/V1-NATIVE-EXECUTION-r13-2026-10-02T05-57-04-253Z-5f3c2a30-manifest.json` | failed | `signed_workbench_bridge_timeout`; iframe load/injection observed, no `dgos.app.ready` |
| `.herdr/V1-NATIVE-EXECUTION-r13-2026-10-02T06-00-39-305Z-9288255d-manifest.json` | failed | `signed_workbench_bridge_timeout`; visible WindowServer window and loaded iframe |
| `.herdr/V1-NATIVE-EXECUTION-r13-2026-10-02T06-03-44-247Z-543a6fc7-manifest.json` | failed | `webview_result_timeout`; no webview result state |
| `.herdr/V1-NATIVE-EXECUTION-r13-2026-10-02T06-06-52-349Z-38bed7f3-manifest.json` | failed | `webview_result_timeout`; no webview result state |

All four runs completed cleanup: temporary database removed, Redis secret prefix empty, and keychain test item deleted where created.

## SHA-256

| File | SHA-256 |
| --- | --- |
| `apps/desktop/scripts/workbench-main-driver.js` | `262930957f0427451dbd5870add336343fd77a0d12996080613cdfa7c7a244dd` |
| debug `.app/Contents/MacOS/dgos-desktop` | `2833edc11e3a67a03940684c40ee6e348319770b265930dde65202f63bc58757` |
| `apps/web/dist/index.html` | `550b23358dbf1324c1cdf67456242e4d7c64368468790a1940edb1201aeb835f` |
| `apps/web/dist/assets/index-NFqsGjYo.js` | `360c42b6cc5d9e96c4e3354e4fa846865dc51c97133a901f40487f719752ce1c` |
| `apps/web/dist/assets/index-BFWr4XFs.css` | `fa3cf098e7e1bf210a0960839de2472b8f6fe88dcdbad29210e3ad7e77627383` |
| prior r13 manifest | `8224af08c8774651c58022aec4e8e5ba754170afa9eb2b4ce21d6670da5c5213` |

Lead execution:

```sh
node apps/desktop/scripts/candidate-preflight.mjs
node scripts/v1-desktop-real.mjs
```

Inspect `stageHistory` for `frameDiagnostics.events`, `loads`, `errors`, `readyState`, `contentWindow`, and any `workbench_command_sent` record. These fields distinguish a resource that never loads from a loaded child whose document-start script is not injected.

- `implementation_facts`: native process/window and iframe resource visibility were proven in the first two replays; complete signed Workbench bridge/task flow remains unproven.
- `open_risks`: host/frame handshake timing and native WebView driver lifecycle still block E2E-01/E2E-10; do not promote FR-001 or FR-005 based on these runs.
- `unfinished_items`: native run, screenshot review, Task/SSE/Artifact/reload/context-permission evidence.
- `stop_writing_confirmation`: Worker-F stopped native product/script writes after r14 build and preflight; no automatic native run will occur.
