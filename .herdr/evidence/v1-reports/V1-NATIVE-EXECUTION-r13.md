# V1-NATIVE-EXECUTION r13 / Worker-F

- `status`: partial. Diagnostic repair, debug build and preflight passed; Lead owns the next native GUI run.
- `work_package`: V1-NATIVE-EXECUTION r13, continuation of `.herdr/v1-resume-r18.md` native boundary, shared workspace `/Users/apple/Progame/DGOS`.
- `files_changed`: `apps/desktop/src-tauri/src/host.rs`, `apps/desktop/scripts/workbench-main-driver.js`, `apps/desktop/scripts/window-server.swift`, `scripts/v1-desktop-real.mjs`, this report. Web/dist, signed Workbench resources, permissions and isolation policy were not changed.
- `tests_added`: no standalone test; existing native harness now retains append-only stage history and window identity on both success and failure.
- `contract_changes_proposed`: []
- `docs_to_update`: Lead/Planner may link this report after examining the next native manifest; no AC/E2E or release status is promoted.

## r12 evidence and r13 diagnosis

Lead's r12 run manifest `.herdr/V1-NATIVE-EXECUTION-r12-2026-10-02T04-50-44-301Z-9509aad6-manifest.json` (SHA-256 `2fef16cc68e5e3e9c931967dd7188e4d34cf8645fb30a1f38db00626006561c3`) records four setup cases passed, a real `failed` Webview result with `signed_workbench_bridge_timeout`, no source drift, and complete Keychain/Redis/database cleanup. WindowServer found an owner-PID-matched layer-0 window ID `2926`, 1728x994, and System Events found one window for the child PID. Its app-only screenshot (SHA-256 `e0f3d1c52a152c0a8d9adcce816f85cc237ef95c221b266411514431a04fff3c`) visibly shows Settings, not Workbench. The manifest did not retain stage history, `nativeStderr`, child PID, page-load URL, or `frameReady`/`bridgeReady`; the last result was overwritten by later receipts. The screenshot therefore does not prove whether catalog navigation was displaced by restore, another driver path, or a later route change.

r13 preserves every debug `desktop_test_result` in a temporary JSONL history while retaining the existing last-result file. The native harness imports that history into its append-only manifest before deleting its temporary directory. It also records child PID, all WindowServer windows for that PID, explicit owner PID and window ID on screenshots, full page-load URL in native stderr, final Webview result and stderr on normal `failed` completion. The driver reports route, frame source, `frameReady`, `bridgeReady`, child injection paths and frame load count on timeout. This is a bounded diagnostic change: no new driver entry, no extra wait, no change to the signed iframe or its bridge.

## Actual commands

| Command | Exit | Result |
| --- | ---: | --- |
| `node --check apps/desktop/scripts/workbench-main-driver.js` | 0 | valid syntax |
| `node --check scripts/v1-desktop-real.mjs` | 0 | valid syntax |
| `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml --jobs 1` | 0 | debug Rust source checked |
| `git diff --check -- apps/desktop/src-tauri/src/host.rs apps/desktop/scripts/workbench-main-driver.js apps/desktop/scripts/window-server.swift scripts/v1-desktop-real.mjs` | 0 | no whitespace error |
| `cargo tauri build --config '{"build":{"beforeBuildCommand":""},"bundle":{"targets":["app"]}}' --debug --bundles app -- --jobs 1` from `apps/desktop/src-tauri` | 0 | debug `.app` rebuilt; Web build disabled |
| `node apps/desktop/scripts/candidate-preflight.mjs` | 0 | 47 migrations through `0051-proxy-provisioning`, frozen signed package and embedded dist names matched |

`node scripts/v1-desktop-real.mjs` was not run for r13. The next Task/SSE/Artifact/reload/context-permission result and screenshot remain unknown.

## SHA-256 identity

| File | SHA-256 |
| --- | --- |
| `apps/desktop/src-tauri/src/host.rs` | `e9529ae85dbb23dd850e81ac9b0f582ff6b83e6c025792adf461d4acaa7ab618` |
| `apps/desktop/scripts/workbench-main-driver.js` | `42cf007340777722fb54001b4e3c38eecc96c646e6188dc60e468826454da1e6` |
| `apps/desktop/scripts/window-server.swift` | `8cbb6538d41a5992eb7f1898afa52b18c8bb6b681914964afdb75262e58c0c7e` |
| `scripts/v1-desktop-real.mjs` | `aca1d29aa97b0b793f0b4bd44e4a95fe2dd0c7d1227232e2f9843227d1b5f7c3` |
| debug `.app/Contents/MacOS/dgos-desktop` | `68c75c07c0eee7d0d596b5b930513df5d0353419c0d3a91c4c4953793225fb27` |
| `apps/web/dist/index.html` | `550b23358dbf1324c1cdf67456242e4d7c64368468790a1940edb1201aeb835f` |
| `apps/web/dist/assets/index-NFqsGjYo.js` | `360c42b6cc5d9e96c4e3354e4fa846865dc51c97133a901f40487f719752ce1c` |
| `apps/web/dist/assets/index-BFWr4XFs.css` | `fa3cf098e7e1bf210a0960839de2472b8f6fe88dcdbad29210e3ad7e77627383` |

## Lead execution and interpretation

From `/Users/apple/Progame/DGOS`:

```sh
node apps/desktop/scripts/candidate-preflight.mjs
node scripts/v1-desktop-real.mjs
```

Retain the generated `.herdr/V1-NATIVE-EXECUTION-r13-*-manifest.json` and window PNG. Inspect `stageHistory` in order, `webviewLastState.frameReady`, `.bridgeReady`, `.frameDiagnostics`, `nativeStderr` page-load URL, `nativePid`, `windowServer.allOwnWindows` and screenshot window ID. The helper's owner PID is now recorded per window, allowing direct comparison with the spawned PID. A local fixture pass is still not final candidate or release acceptance.

- `implementation_facts`: failure evidence above and r13 diagnostic fields implemented; build/preflight passed.
- `open_risks`: r12 screenshot route mismatch remains unexplained until ordered stages and page URL are observed; signed child injection and bridge behavior remain unproved.
- `unfinished_items`: Lead r13 native run; Task/SSE/Artifact/reload/context-permission evidence; screenshot review; independent candidate verification.
- `lead_or_planner_decisions_needed`: []
- `stop_writing_confirmation`: Worker-F stopped native product/script writes after r13 build and preflight; no GUI run, rebuild or further native edit will occur without a new Lead handoff.
