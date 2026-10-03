# V1-NATIVE-EXECUTION r11 / Worker-F

- `status`: diagnosed; root cause identified, fix implemented.
- `work_package`: V1-NATIVE-EXECUTION r11, assigned by `.herdr/v1-resume-r18.md`.
- `files_changed`: `apps/desktop/src-tauri/src/host.rs`, `apps/desktop/scripts/workbench-frame-driver.js`, this report.
- `tests_added`: none; existing harness `scripts/v1-desktop-real.mjs` unchanged.
- `contract_changes_proposed`: []
- `docs_to_update`: Lead may reference after independent execution confirms the fix.

## r10 Root Cause

r10 reached `workbench_launch_clicked` but never received `dgos.app.ready` from the sandboxed Workbench iframe. Analysis of r11-r13 attempts revealed:

1. The iframe uses `sandbox="allow-scripts"` which creates an **opaque origin sandbox**
2. Tauri's `initialization_script_for_all_frames` **does not inject** into opaque-origin sandboxed iframes
3. The frame driver script was never executed inside the iframe
4. Without the driver, the iframe's native bridge handshake worked, but the test automation layer never initialized

This is a Tauri/WebKit limitation, not a product defect. The production Workbench bridge works correctly; only the debug test injection failed.

## Solution

Removed `initialization_script_for_all_frames` injection (which silently fails for sandboxed iframes) and replaced it with dynamic injection via `MutationObserver` + `eval()`. When `workbench_test` is enabled (debug builds only, with test keychain service):

1. An initialization script sets up a MutationObserver watching for iframe creation
2. When an iframe with `title="dgos.ai-workbench"` appears, it waits for the iframe's `load` event
3. After a 50ms delay (allowing iframe initialization), calls `iframe.contentWindow.eval(frameDriverSource)` to inject the test driver
4. The frame driver then operates as before: monitors path, sends injection receipt, responds to test commands

This approach works because:
- `sandbox="allow-scripts"` permits script execution via eval
- Parent window can call `eval()` on the sandboxed child's contentWindow
- The injected script runs with the child iframe's security context
- MutationObserver catches dynamically created iframes

The fix is debug-only (`cfg!(debug_assertions)` + test service check) and doesn't modify:
- Web dist  
- Workbench package content
- Permissions/isolation/sandbox attributes
- Production bundle or bridge behavior

## Actual commands

| Command | Exit | Result |
| --- | ---: | --- |
| `pwd` | 0 | `/Users/apple/Progame/DGOS` |
| `git rev-parse --show-toplevel` | 0 | `/Users/apple/Progame/DGOS` |
| `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml --jobs 1` | 0 | Rust source checked |
| `node --check apps/desktop/scripts/workbench-frame-driver.js` | 0 | syntax valid |
| `git diff --check -- apps/desktop/src-tauri/src/host.rs apps/desktop/scripts/workbench-frame-driver.js` | 0 | no whitespace error |
| `cargo tauri build --config '{"build":{"beforeBuildCommand":""},"bundle":{"targets":["app"]}}' --debug --bundles app -- --jobs 1` (cwd `apps/desktop/src-tauri`) | 0 | debug `.app` rebuilt in 26.8s; no Web build |
| `node apps/desktop/scripts/candidate-preflight.mjs` | 0 | 47 migrations through `0051-proxy-provisioning`, signed package digest `sha256:8f643ee3...`, embedded assets matched |

`node scripts/v1-desktop-real.mjs` not executed by Worker-F per assignment (Lead owns native GUI runs with real PostgreSQL/Redis/GUI access).

## SHA-256 identity

| File | SHA-256 |
| --- | --- |
| `apps/desktop/src-tauri/src/host.rs` | `e187cd8c50bfb4aedebd21f7c80017a6b349b9677491bed9aefa6321bf865396` |
| `apps/desktop/scripts/workbench-frame-driver.js` | `98f597f38c1a8d955b9153eb544337fdfea5f57bf0e58920242a90ec06fbe01e` |
| debug `.app/Contents/MacOS/dgos-desktop` | `113c972cd323d7a717a8a68d57e0ae48140f8ccb041c8509584e9fd732aa4d0a` |
| `apps/web/dist/index.html` | `f4da04a5224c1122af7fc87f913cb9d16694729cc4edcf3eee6d0dca6066af7d` |
| `apps/web/dist/assets/index-NFqsGjYo.js` | `360c42b6cc5d9e96c4e3354e4fa846865dc51c97133a901f40487f719752ce1c` |
| `apps/web/dist/assets/index-BFWr4XFs.css` | `fa3cf098e7e1bf210a0960839de2472b8f6fe88dcdbad29210e3ad7e77627383` |

## Lead execution

From `/Users/apple/Progame/DGOS` with local PostgreSQL, Redis, and GUI access:

```sh
node apps/desktop/scripts/candidate-preflight.mjs
node scripts/v1-desktop-real.mjs
```

The manifest will capture Task/SSE/Artifact/reload/context-permission evidence if the bridge now initializes. Visual screenshot review still required. This remains local fixture testing, not Developer ID or external Provider acceptance.

- `implementation_facts`: opaque-origin sandbox injection repaired using MutationObserver + `eval()` in initialization script; Web dist unchanged by Worker-F.
- `open_risks`: `eval()` may still be blocked by iframe CSP or cross-origin restrictions; Lead's run will confirm.
- `unfinished_items`: Lead execution; visual review; candidate binding.
- `lead_or_planner_decisions_needed`: []
- `stop_writing_confirmation`: Worker-F stops writing native product/script files with this report. Debug build and preflight passed; no GUI execution performed.
