# V1-NATIVE-EXECUTION r10 / Lead takeover

- Status: blocked; this is local debug evidence only, not candidate or release acceptance.
- Work package: `V1-NATIVE-EXECUTION r10`, originally Worker-F. The resumed F session was attached to an old read-only worktree without native command tools. It made no new artifact and stopped. Lead took the explicitly transferred native driver paths for bounded diagnosis.
- Frozen Web dist used throughout: `apps/web/dist/index.html` `550b23358dbf1324c1cdf67456242e4d7c64368468790a1940edb1201aeb835f`; `assets/index-NFqsGjYo.js` `360c42b6cc5d9e96c4e3354e4fa846865dc51c97133a901f40487f719752ce1c`; `assets/index-BFWr4XFs.css` `fa3cf098e7e1bf210a0960839de2472b8f6fe88dcdbad29210e3ad7e77627383`.

## Actual Results

1. `cargo tauri build --config '{"build":{"beforeBuildCommand":""},"bundle":{"targets":["app"]}}' --debug --bundles app -- --jobs 1` from the repository root: exit 0. No Web build ran. Latest native executable SHA-256: `c7ce115d2f4deb3fd3ed90696bf296f3606ed60422ecd1939413c87893e52b42`.
2. `node apps/desktop/scripts/candidate-preflight.mjs`: exit 0. It found exactly 47 migrations ending at `0051-proxy-provisioning`, the expected signed Workbench package digest, and the same embedded Web assets.
3. `node scripts/v1-desktop-real.mjs`: exit 1. The final attempt is `.herdr/V1-DESKTOP-CANDIDATE-r9-2026-10-02T04-00-48-603Z-5f60cd12-manifest.json`.
4. The native harness completed isolated database migration, API/worker/Provider fixture startup, signed Workbench installation, capability grants, and public session/Provider configuration. It then timed out at the signed Workbench GUI transition. The WindowServer observed a visible 1280x840 native window.
5. The prior detailed attempt `.herdr/V1-DESKTOP-CANDIDATE-r9-2026-10-02T03-55-10-054Z-7196a7ff-manifest.json` reached `workbench_launch_clicked` but never reached bridge readiness. Readiness and pure frame-message probes did not produce a child-frame receipt. This establishes the current blocker as Tauri sandboxed child-frame debug injection, not migration, signing package, Web dist, API, worker, or cleanup failure.

## Cleanup And Limits

- Each failed native run deleted its test Keychain item and temporary directory, removed the unique Redis-7 prefix, and dropped only its own randomized `dgos_v1_desktop_*` database. No DGOS desktop/API/worker/Provider fixture process remains.
- Diagnostic probe changes were reverted to the F handoff driver implementation. Existing F debug driver/harness files remain uncommitted candidate tooling and are not a formal macOS proof.
- The signed Workbench GUI sequence, delta, Artifact, reload, screenshot, and cross-host E2E-10 proof are not accepted. The final candidate binding must not be created until a working native evidence path is available.
- Developer ID signing, notarization, target deployment, external Provider behavior, and release approvals remain unproven.
