# V1-DESKTOP r6 native visible workbench

- `status`: passed for local debug native window and real local API/worker/Provider fixture chain; release signing and manual user interaction remain open.
- `work_package`: V1-DESKTOP r6 (`.herdr/v1-desktop-visible-r6.md`). Main workspace, F desktop/native boundaries. No commit, push or delegation.
- `final_paired_manifest`: `.herdr/V1-DESKTOP-r6-2026-10-02T01-36-42-004Z-660e7f7b-manifest.json`.
- `final_app_only_image`: `.herdr/V1-DESKTOP-r6-2026-10-02T01-36-42-004Z-660e7f7b-window.png` (SHA-256 `6dad77f3856b40fa54400008baa757ce35d1b03b93083307e8031d731c9b6a53`).
- `independent_window_fixture`: `.herdr/V1-DESKTOP-r6-visible.json`, `.herdr/V1-DESKTOP-r6-window.png`.

## Implementation facts

The host now blocks geometry event persistence until the subject workspace has been read and restored, creates a first-launch summary after Session verification, restores the main window's route and physical pixel geometry, and prioritizes the confirmed route snapshot during later geometry saves. This fixed observed close/reopen failures where `/settings` became `/protocols`, `/skills`, `/assistant` or `/desktop`. The debug-only window driver waits for native focus/maximize/restore states before asserting them; it clicks the actual Settings navigation link, checks the visible Settings control, checks the native URL, then closes the app through its own Tauri window command. No assertion was removed to hide an asynchronous state transition.

CoreGraphics WindowServer lookup by this run's DGOS PID found a layer-0, alpha-1, 1280×840 window; System Events had previously reported 0 windows and is not a reliable count in this environment. The app-only `screencapture -l` screenshot was taken after the Webview Settings control existed and two animation frames had elapsed. I viewed the final image: it shows the DGOS Settings workbench and Device sessions area, with no blank page, credentials or other project windows. Pixel/DOM evidence is from bounded debug automation, not a manual click test.

The independent 15159 fixture twice passed visible/focus/maximize/restore, actual navigation, native close, and subject-keyed reopen. At 2× display scaling its snapshot and restored native dimensions both read 2560×1680 physical pixels. The separate real local chain used 15157/15158, a randomized database on 5432 and Redis DB7 prefix; it applied only migrations through 0048 plus frozen 0050, excluding 0049. The manifest records exact checksums (0045 `c2bc2a47...`, 0050 `8802fe3a...`), app executable SHA-256 `3100f469e6a83d6bb3f89b0242bb1dadfcc4ef69d8fbfcb271911a031b95a7a9`, and each shared Web dist file hash. It passed public HTTP Session/Provider setup, Webview bridge Task submission and polling, four events, Artifact read, window actions and native Session/route/geometry recovery. The Provider fixture received one completion call. No source, app binary or dist drift occurred during the final run.

## Commands and limitations

| Command | Exit | Result |
| --- | ---: | --- |
| `cargo tauri build --config '{"build":{"beforeBuildCommand":""},"bundle":{"targets":["app"]}}' --debug --bundles app -- --jobs 1` | 0 | Local macOS `.app` built from shared dist. |
| `node apps/desktop/scripts/visible-macos.mjs` | 0 | Native WindowServer and app-only image; 3/3 window cases passed (two final passes before dist update). |
| `node scripts/v1-desktop-real.mjs` | 0 | Final runId manifest: 7/7 cases passed; manual image inspection passed. |
| `node apps/desktop/scripts/e2e-macos.mjs` | 0 | Session/keychain fixture relaunch and new `DELETE /api/v1/identity/admin/session` logout/revocation regression passed. |
| `node apps/desktop/scripts/check.mjs` | 0 | Desktop config valid. |
| `node --test packages/host-adapter/macos/test/*.test.mjs` | 0 | 2/2 adapter tests. |
| `node --check scripts/v1-desktop-real.mjs` and `node --check apps/desktop/scripts/visible-macos.mjs` | 0 | Harness syntax. |
| `git diff --check -- apps/desktop packages/host-adapter/macos scripts/v1-desktop-real.mjs` | 0 | No whitespace errors. |
| `security find-identity -v -p codesigning` | 0 | `0 valid identities found`. |
| `codesign -dv --verbose=2 .../DGOS.app` | 0 | `Signature=adhoc`, no TeamIdentifier, resources unsealed. |

Earlier `.herdr/V1-DESKTOP-r6-manifest.json` remains a failed historical attempt: its business cases passed but the shared Web dist changed during the run, and an earlier image was blank. Other failed batches exposed route persistence and native action timing races; they were fixed and retested. Do not use the older overwritten manifest as final acceptance evidence. Final runId evidence is append-only. Screenshots contain only the DGOS window. Final run cleaned its randomized database, temporary directory and dedicated keychain item; Redis prefix had zero keys remaining. `0 valid identities` is an external signing dependency: no Developer ID signature or notarization evidence exists.

## Stable handoff fields

- `files_changed`: desktop host/lib/proxy and GUI scripts, `scripts/v1-desktop-real.mjs`, this report and paired evidence; prior r3–r5 files remain uncommitted.
- `tests_added`: independent WindowServer/screenshot/restore harness and real chain render marker, native state and runId evidence.
- `commands_run`: table above.
- `implementation_facts`: real native window visible and captured, Settings control navigated, focus/maximize/restore and close/reopen verified, physical dimensions and route recovered, real local Task/events/Artifact completed through Webview bridge.
- `contract_changes_proposed`: none to public HTTP; test commands remain debug-only.
- `open_risks`: manual input acceptance and Developer ID signed/notarized release not evidenced; Provider remains a controlled fixture; final standalone visible fixture screenshot reflects its intentionally limited Settings data.
- `docs_to_update`: Lead/Verify may link final runId manifest and image to FR001/005 local acceptance while keeping signing/manual/release gates open.
- `unfinished_items`: Developer ID signing/notarization and human-operated GUI acceptance.
- `lead_or_planner_decisions_needed`: release signing identity/environment must be supplied externally.

F stops writing after this report.
