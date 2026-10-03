# V1-DESKTOP r4 continuation report

- status: fixture passed; real API and window pixel acceptance remain open
- work_package: `V1-DESKTOP` r4, assigned by `.herdr/v1-continuation-r5.md`
- worktree: `/Users/apple/Progame/DGOS`
- commit/push/delegation: none

## Diagnosis and changes

The previous zero-request observation did not recur on r4. A fresh run before edits reached the fixture API, then failed because `ApiProxy::probe_session()` sent no `X-DGOS-CSRF` header. The ad hoc unsigned app and its randomized test keychain item were usable in this local run. Signing cannot be cited as the cause of that failure.

`apps/desktop/src-tauri/src/proxy.rs` now sends the fixed `desktop` CSRF value in native Session probes. `apps/desktop/src-tauri/src/host.rs` adds a debug-only, test-service-only page probe after DOM readiness. It uses the packaged page's `fetch` override and the Tauri `desktop_api` command. `apps/desktop/scripts/e2e-macos.mjs` checks the probe's `x-request-id`, cookie, Origin and CSRF at the fixture API, separately from the native probe. The probe is absent without a `com.dgos.desktop.test.*` service.

## Commands and evidence

| Command | Exit | Evidence |
| --- | ---: | --- |
| `node apps/desktop/scripts/e2e-macos.mjs` before edits | 1 | Session request arrived with fixture cookie; assertion found missing CSRF header. |
| `cargo tauri build --config '{"build":{"beforeBuildCommand":""},"bundle":{"targets":["app"]}}' --debug --bundles app -- --jobs 1` | 0 | Rebuilt shared `apps/web/dist` into local `DGOS.app`; ad hoc unsigned build only. |
| `node apps/desktop/scripts/e2e-macos.mjs` after edits, twice | 0 | Final output: `fixture`, `nativeProcess`, `webviewBridge`, `keychainRelaunch`, `revokedSessionChecked`, `subjectWorkspace` all true; Origin `http://127.0.0.1:15159`; `windowPixelsChecked` false. |
| `node apps/desktop/scripts/check.mjs` | 0 | Desktop configuration valid. |
| `node --test packages/host-adapter/macos/test/*.test.mjs` | 0 | 2/2 adapter tests passed. |
| `git diff --check -- apps/desktop packages/host-adapter/macos` | 0 | No whitespace errors. |

Final SHA-256: `proxy.rs` c91013cbf3c38c95eb981d1ca83305060283d9dc8beb9803811481fb690d6472; `host.rs` 933dad27f1accce449d14890bcafa88b3e0ffbac5a2ceb282d8c53aed8e42c04; `e2e-macos.mjs` 6850704c10a9530a91bcf6c0a55c287bc5479e0276e4a0574e33981b0; shared `apps/web/dist/index.html` 8ad677aa9cbdf5b5641337eb6ff69ab91acda790ddfa4b1c4adc79ae6111ac4f. The Web dist was read/build input, not edited by F.

## Stable handoff fields

- `files_changed`: `apps/desktop/src-tauri/src/proxy.rs`, `apps/desktop/src-tauri/src/host.rs`, `apps/desktop/scripts/e2e-macos.mjs`, this report. Earlier r3 files remain uncommitted.
- `tests_added`: debug fixture page probe and harness assertion for the Webview fetch-to-command path.
- `commands_run`: listed above.
- `implementation_facts`: local ad hoc app retrieved its randomized test keychain item, sent native and Webview Session requests with cookie/Origin/CSRF, persisted a subject-scoped workspace, retried Session after relaunch, and checked revocation against the fixture.
- `contract_changes_proposed`: none.
- `open_risks`: no Lead-supplied real API acceptance or business GUI flow; no window pixel proof because Accessibility/screenshot permission remains unavailable; no Developer ID signature or notarization evidence. Fixture test does not establish production keychain policy.
- `docs_to_update`: Lead/Verify should attach this r4 fixture pass separately from r3's failed attempt and keep real E2E acceptance open.
- `unfinished_items`: real API login/Task flow, window pixel acceptance, release signing/notarization.
- `lead_or_planner_decisions_needed`: Lead to assign the real API port/environment when available; none needed for the fixture fix.

F stops writing after this report.
