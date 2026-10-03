# V1-NATIVE-EXECUTION r12 / Worker-F

- `status`: partial; r12 debug build and preflight passed, native GUI run delegated to Lead as requested.
- `work_package`: V1-NATIVE-EXECUTION r12, continuation of `.herdr/v1-resume-r18.md` native boundary. Workspace `/Users/apple/Progame/DGOS`.
- `files_changed`: `apps/desktop/src-tauri/src/host.rs`, `apps/desktop/scripts/workbench-main-driver.js`, `scripts/v1-desktop-real.mjs`, this report. No Web/dist, signed package, permissions, isolation policy or release signing content changed.
- `tests_added`: no standalone test; debug harness now retains app-window screenshot on timeout and labels r12 manifests.
- `contract_changes_proposed`: []
- `docs_to_update`: Lead/Planner may link r12 only after evaluating the new native manifest; no AC/E2E promotion from build/preflight.

## r11 failure evidence and r12 change

Lead's retained r11 manifest is `.herdr/V1-NATIVE-EXECUTION-r11-2026-10-02T04-42-58-755Z-fbe9d6bf-manifest.json`, SHA-256 `1c04a39375e1647da472094ce3cd9d717a2213d17f741e13c53e69f4185735ed`. It records four setup cases passed, `webview_result_timeout`, `webviewLastState: null`, native stderr containing only `workbench_test=true`, a 1280x840 visible WindowServer window, `sourceDrift: false`, Keychain deletion, zero Redis prefix keys and database removal. Thus the latest failure occurs before any main-driver receipt; r11's child-frame timing hypothesis was not reached or proven in that run.

r12 adds a second, debug-test-only main-driver entry through Tauri's `on_page_load(Finished)` callback. The existing document-start initialization remains. The JS driver guards repeat injection, starts immediately when DOM is already ready, and emits a failure receipt for corrupt session state. The native callback writes a page-finished marker and any `eval` submission error to stderr. The callback is gated by the existing `workbench_test` flag, which itself requires a debug build, `com.dgos.desktop.test.*` Keychain service and `DGOS_DESKTOP_TEST_WORKBENCH=1`. This is a diagnostic retry, not a demonstrated root-cause fix. It does not relax iframe sandbox, opaque origin or bridge validation.

The harness now waits up to 120 seconds for Task/reload completion and attempts a WindowServer app-only screenshot on GUI timeout, preserving the failed GUI state in an append-only r12 manifest. It does not modify the signed resource or Web dist.

## Actual commands

| Command | Exit | Evidence |
| --- | ---: | --- |
| `node --check apps/desktop/scripts/workbench-main-driver.js` | 0 | JS syntax valid |
| `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml --jobs 1` | 0 | Rust debug source type checked |
| `node --check scripts/v1-desktop-real.mjs` | 0 | harness syntax valid |
| `git diff --check -- apps/desktop/src-tauri/src/host.rs apps/desktop/scripts/workbench-main-driver.js scripts/v1-desktop-real.mjs` | 0 | no whitespace error |
| `cargo tauri build --config '{"build":{"beforeBuildCommand":""},"bundle":{"targets":["app"]}}' --debug --bundles app -- --jobs 1` from `apps/desktop/src-tauri` | 0 | debug `.app` built; Web build disabled |
| `node apps/desktop/scripts/candidate-preflight.mjs` from repo root | 0 | 47 migrations through `0051-proxy-provisioning`; frozen signed package and embedded Web assets matched |

`node scripts/v1-desktop-real.mjs` was **not run for r12**. The prior sandbox denied loopback PostgreSQL with `EPERM`; Lead explicitly owns the next GUI execution. No r12 Task/SSE/Artifact/reload/context-permission or screenshot result is claimed.

## SHA-256 identity

| File | SHA-256 |
| --- | --- |
| `apps/desktop/src-tauri/src/host.rs` | `9ac49b0e5bbd07c4389d3e50ba3ff7b76e90a8736c27eecae62b330fb6583f5d` |
| `apps/desktop/scripts/workbench-main-driver.js` | `4d651013063da856f4b1e42bea7307fdb8431119b76cb4fa8e70da6b9590d597` |
| `apps/desktop/scripts/workbench-frame-driver.js` | `cf65234d9538477c6bac05b8a71dcf025e95a54b0b739b7d41b2c35426a18fb4` |
| `scripts/v1-desktop-real.mjs` | `f9e2c02d990a2b99c6cbf128d8bccce096248f2463f8f3d8efca0884f6b1a8b7` |
| debug `.app/Contents/MacOS/dgos-desktop` | `018ab62828677a93daf66b2b9c830d7825ea22b5b3e79cc6e7c5a27cb69396b3` |
| `apps/web/dist/index.html` | `550b23358dbf1324c1cdf67456242e4d7c64368468790a1940edb1201aeb835f` |
| `apps/web/dist/assets/index-NFqsGjYo.js` | `360c42b6cc5d9e96c4e3354e4fa846865dc51c97133a901f40487f719752ce1c` |
| `apps/web/dist/assets/index-BFWr4XFs.css` | `fa3cf098e7e1bf210a0960839de2472b8f6fe88dcdbad29210e3ad7e77627383` |

## Lead execution and interpretation

From `/Users/apple/Progame/DGOS`:

```sh
node apps/desktop/scripts/candidate-preflight.mjs
node scripts/v1-desktop-real.mjs
```

Retain the generated `.herdr/V1-NATIVE-EXECUTION-r12-*-manifest.json` and any `*-window.png`, including on failure. If `webviewLastState` remains null, compare `nativeStderr` for `debug page finished` and `main driver eval failed`. A page-finished marker without JS receipt points to injection execution or IPC; absence of the marker points to page-load or callback delivery. If the driver reaches frame stages, use the recorded frame/bridge diagnostics and screenshot. A successful local fixture run is still not final candidate or release acceptance.

- `implementation_facts`: debug-only page-load retry and bounded timeout screenshot capture implemented; build/preflight passed.
- `open_risks`: r12 actual GUI behavior remains unknown; local Provider fixture and debug automation do not prove external Provider, Developer ID signing, notarization or cross-host acceptance.
- `unfinished_items`: Lead native run; signed Workbench Task/SSE/Artifact/reload/context-permission evidence; screenshot review; independent candidate verification.
- `lead_or_planner_decisions_needed`: []
- `stop_writing_confirmation`: Worker-F stopped native product/script writes after r12 build and preflight; no GUI run, rebuild or further native edit will occur without a new Lead handoff.
