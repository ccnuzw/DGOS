# V1-DESKTOP r5 real local service report

- `status`: partial acceptance. Real local API/worker/Provider fixture and debug-driven packaged Webview bridge passed; manual GUI pixels and release signing remain open.
- `work_package`: V1-DESKTOP r5, `.herdr/v1-desktop-real-r5.md`.
- `working_directory`: `/Users/apple/Progame/DGOS`.
- `commit/push/delegation`: none.
- `paired_manifest`: `.herdr/V1-DESKTOP-r5-manifest.json` (final run; source and Web dist SHA-256 before/after, exact migration checksums, cases, cleanup, and limitations).

## Implementation and observed chain

`scripts/v1-desktop-real.mjs` creates a randomized `dgos_v1_desktop_*` database from the approved 5432 parent, applies 40 discovered migrations through `0044` (including frozen `0039` checksum `07259111a3c3808c5e6070b0189bd0bf74dcd040623b137590b17bd452bd8b12`), and starts independent public API, worker and local OpenAI-compatible Provider fixture on 15158/15157. It uses Redis DB7 with a randomized `v1-desktop:*` secret prefix. Public HTTP creates a test admin Session, probes and readies the Provider, enables its model, and sets a subject quota policy.

The debug `.app` uses a randomized `com.dgos.desktop.test.*` keychain service. The harness passes the real test Session to the dedicated helper on stdin; the helper writes/reads/deletes only its own service and `127.0.0.1:15158` account. No Session, credential or Provider request body is written into command arguments, environment variables, logs or the manifest. The debug page driver invokes the existing `fetch` to `desktop_api` bridge after DOM readiness: Session, Task submission, Task polling, events and Artifact. The last successful run produced one Provider completion call, a succeeded Task, four task events and an Artifact with expected fixture content. Public HTTP confirmed the Task state. Relaunch produced fresh native Session requests and retained the subject-keyed workspace. The driver is automated JS in the Webview, not manual user input or a visual assertion.

The release build ignores `DGOS_DESKTOP_TEST_KEYCHAIN_SERVICE`; the page driver and `desktop_test_result` command are gated by debug compilation. The experimental direct `.app` keychain write through stdin failed locally with macOS `-25244`; it was removed. The final passing path is the dedicated test helper using stdin. No Developer ID signature was created.

## Commands and result

| Command | Exit | Result |
| --- | ---: | --- |
| `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` | 0 | Native source type check. |
| `cargo tauri build --config '{"build":{"beforeBuildCommand":""},"bundle":{"targets":["app"]}}' --debug --bundles app -- --jobs 1` | 0 | Rebuilt local debug `.app` from D's shared `apps/web/dist`. Dist SHA-256 is in paired manifest; source drift false. |
| `node scripts/v1-desktop-real.mjs` | 0 | Final five cases passed. Earlier attempts failed at migration-count preflight, missing quota policy, process-exit harness check, and direct app keychain write; each was kept as an observed correction, not claimed as a pass. |
| `node apps/desktop/scripts/e2e-macos.mjs` | 0 | Existing isolated fixture regression: bridge, relaunch, revocation and subject workspace passed. |
| `node apps/desktop/scripts/check.mjs` | 0 | Desktop config valid. |
| `node --test packages/host-adapter/macos/test/*.test.mjs` | 0 | 2 tests passed. |
| `git diff --check -- apps/desktop packages/host-adapter/macos scripts/v1-desktop-real.mjs` | 0 | No whitespace errors. |

The final run removed its randomized database, temporary directory and test keychain item; Redis prefix had zero remaining keys. The only System Events read on the app's PID returned a window count of 0, so it does not establish visible window count or pixels. No screenshot was taken and system permissions were not changed. The native process and executing Webview JS are established by the completed bridge result, with this visual evidence limit retained.

## Stable handoff fields

- `files_changed`: `apps/desktop/src-tauri/src/host.rs`, `apps/desktop/src-tauri/src/lib.rs`, `apps/desktop/src-tauri/src/proxy.rs`, `scripts/v1-desktop-real.mjs`, this report and paired manifest. Earlier r3/r4 desktop changes remain uncommitted.
- `tests_added`: executable independent real local chain harness and debug-only Webview Task/events/Artifact driver.
- `commands_run`: table above.
- `implementation_facts`: real public API/worker and Provider fixture completed one Task through packaged Webview bridge; test Session recovered after relaunch in a subject workspace; test resources cleaned.
- `contract_changes_proposed`: none to public HTTP. `desktop_test_result` is debug-only test plumbing.
- `open_risks`: window pixels and manual UI interaction unverified; ad hoc local bundle is not Developer ID signed/notarized; Provider is a controlled fixture; no production secret/keychain acceptance.
- `docs_to_update`: Lead/Verify may attach this local integration evidence to FR001/005/010 while keeping release GUI/signing gates open.
- `unfinished_items`: manual GUI visual acceptance, signed release and production Provider/environment acceptance.
- `lead_or_planner_decisions_needed`: none for this local chain.

F stops writing after this report.
