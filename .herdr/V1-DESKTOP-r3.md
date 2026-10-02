# V1-DESKTOP r3 hardening report

- status: partial; native build passed, Session/keychain GUI fixture blocked in the current unsigned environment
- work_package: `V1-DESKTOP` r3
- date: 2026-10-02 (Asia/Shanghai)
- worktree: `/Users/apple/Progame/DGOS` (Lead-authorized main-directory desktop paths)
- commit/push: none

## Changes

- `apps/desktop/src-tauri/src/host.rs`, `src/lib.rs`: pre-document route restoration and one `popstate` listener per document; allowlisted DGOS routes; subject-keyed workspace filenames; server-authenticated subject required to read/write or restore workspace. APP window requests require an `app-*` label and a successful API launch authorization before creation. The native window is created before background Session recovery so keychain access cannot hold up the window constructor.
- `apps/desktop/src-tauri/src/proxy.rs`: exact Tauri resource origin checks; native `desktop_api` command for same-origin `/api/v1/*` fetches (Tauri's asset callback cannot handle absent `/api` assets); loopback upstream, Origin/CSRF pinning, cookie in macOS keychain, response allowlist/size bound; Session probe and APP launch authorization.
- `apps/desktop/src-tauri/Cargo.toml`, `Cargo.lock`: `sha2` for opaque subject workspace keys and `default-run` for the fixture helper binary.
- `apps/desktop/src-tauri/src/bin/dgos-keychain-fixture.rs`, `scripts/e2e-macos.mjs`, `README.md`: randomized test-only keychain service/account fixture and `--external-api` harness on assigned loopback ports. No production keychain item is read or deleted by the helper. `packages/host-adapter/macos/index.js` exposes subject workspace restoration.

## Commands and evidence

| Command | Exit | Result |
| --- | ---: | --- |
| `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` | 0 | Final Rust source type check passed. |
| `cargo tauri build --config '{"build":{"beforeBuildCommand":""},"bundle":{"targets":["app"]}}' --debug --bundles app -- --jobs 1` | 0 | Built main-directory shared Web `dist` into `apps/desktop/src-tauri/target/debug/bundle/macos/DGOS.app` (25.20 MiB). |
| `cargo build --manifest-path apps/desktop/src-tauri/Cargo.toml --bin dgos-keychain-fixture --jobs 1` | 0 | Test-only helper binary built. |
| `node apps/desktop/scripts/check.mjs` | 0 | Desktop configuration validated. |
| `node --test packages/host-adapter/macos/test/*.test.mjs` | 0 | 2 tests passed. |
| `node --check apps/desktop/scripts/e2e-macos.mjs` | 0 | Harness syntax passed. |
| `git diff --check -- apps/desktop packages/host-adapter/macos` | 0 | No whitespace errors. |
| `node apps/desktop/scripts/e2e-macos.mjs` | 1 | Test-only keychain helper could read its own item, but unsigned `.app` did not complete keychain Session read; fixture API saw zero requests. Native process/window was created and visible by Tauri API. No Session recovery or GUI business pass claimed. |
| `codesign -dv --verbose=2 apps/desktop/src-tauri/target/debug/bundle/macos/DGOS.app` | 0 | `Signature=adhoc`; `TeamIdentifier=not set`; resources not sealed. |

Experimental use of the data-protection keychain returned macOS `-34018` (required entitlement absent) and was reverted. A separate System Events window-count/pixel assertion remains unavailable without Accessibility permission. The r1 PID/Webview API fixture evidence does not prove the new r3 Session flow.

## External API mode

When Lead assigns a dedicated API port in `15151`–`15159`, set `DGOS_DESKTOP_API_ORIGIN=http://127.0.0.1:<port>` and run `node apps/desktop/scripts/e2e-macos.mjs --external-api`. The harness launches only its own app binary, isolates workspace state, checks native process visibility and exits. It does not manufacture credentials, login, Task, SSE, keychain or screenshot evidence. Real API login/task interaction and macOS keychain authorization require the integrated environment and a signed app or explicit user-approved keychain access.

## Stable handoff fields

- `files_changed`: desktop Rust host/proxy/config/lock, desktop README and E2E script, test-only keychain helper, macOS Host Adapter export, this report.
- `tests_added`: dedicated keychain fixture helper and executable relaunch/revocation harness; current run failed as reported.
- `implementation_facts`: route listener and timing corrected in source; workspace writes are subject-scoped and server-verified; arbitrary window labels are rejected; shared `dist` unsigned app builds.
- `contract_changes_proposed`: native `desktop_api` and `restore_subject_workspace` command surfaces require Lead/D UI adapter integration review; no public HTTP schema was changed.
- `open_risks`: unsigned macOS keychain approval blocks automated Session/reopen evidence; actual packaged Webview page and API business flow need target-environment proof; app label/route mapping with D's Shell; window pixel permission; production sidecar lifecycle and signing/notarization.
- `docs_to_update`: Lead/Planner should attach this partial report to implementation and E2E evidence without upgrading FR001/005/010 to complete.
- `unfinished_items`: signed or user-approved keychain Session test, live API login/task E2E, screenshot/window count evidence, sidecar integration.
- `lead_or_planner_decisions_needed`: Lead to supply dedicated real API port and macOS signing/keychain acceptance environment; D/Lead to align installed app IDs with native `app-*` window labels and route calls.
