# V1-DESKTOP r2 controlled integration

- status: integrated_source_only
- work_package: `V1-DESKTOP` r2
- date: 2026-10-02 (Asia/Shanghai)
- source: `/Users/apple/Progame/DGOS/.worktrees/v1-desktop`
- target: `/Users/apple/Progame/DGOS`
- commit/push: none

## Scope and method

The target `apps/desktop` and `packages/host-adapter/macos` paths were clean before the transfer. Applied an explicit `apply_patch` containing 12 r1 source/config/test files. `Cargo.lock` was included because `Cargo.toml` adds actual Rust dependencies. Root dependency files remained owned by Worker-D. No `target`, `dist`, `fixture-web`, secrets, `AGENTS.md`, or r1 `DELIVERY` file was transferred.

## SHA-256 match

Every target digest matched the source worktree digest after patch application:

| File | SHA-256 |
| --- | --- |
| `apps/desktop/README.md` | `8fc6be780ae6c406d323cee47f47965de06a2aa23a697d4d54934bc30cb80e24` |
| `apps/desktop/scripts/check.mjs` | `5767982da700c842f68c87fedd833a99aa9d32de0b8f43b7680cf666d7461a15` |
| `apps/desktop/scripts/e2e-macos.mjs` | `a9b47fe41d398d6fa7c3fcb461f63ade52dcb6118d9c9f0e3323bb4f44a1d8a8` |
| `apps/desktop/src-tauri/Cargo.lock` | `c2d83e7e1a8e38c1fb89a27d7eccd1414686b9990ac19e8fd40e3b2a649581bc` |
| `apps/desktop/src-tauri/Cargo.toml` | `e3d2ccd13c867b928f1501c659f349bd2d89c9d058bb2763a0c8ad94707d8b5b` |
| `apps/desktop/src-tauri/src/lib.rs` | `e8ea66e098f4c24fa819bbc55b944638b6092548f0ccdb5df1a3464d02b34e3e` |
| `apps/desktop/src-tauri/src/host.rs` | `1a708a5adf03d1d007bcf342e5512ed759fb38bd30c5a5b8cb6ccd310978d043` |
| `apps/desktop/src-tauri/src/proxy.rs` | `ab6f15f9f3edbefe60d5a884b97a8315063b75dc2fcce84efdae5d0f34f95fbb` |
| `apps/desktop/src-tauri/tauri.conf.json` | `82a1d48fcd0d2cf9ef6663c8b4794ea9f57836b6141717262d4ab8f840f293e6` |
| `packages/host-adapter/macos/index.js` | `2a568e603644431686994205c141f67aa32ca168d7c903799578c23a7dedbfd4` |
| `packages/host-adapter/macos/package.json` | `154a76bc9e1b7fa961c2e03f14b1844e23edf3a46bb61d36b7c6655205596bb4` |
| `packages/host-adapter/macos/test/adapter.test.mjs` | `aa2e66d02d73e12c2a99a8a4c0a74983b1770af9d07f600a0c5b74f328b79e7e` |

## Checks run in target

| Command | Exit |
| --- | ---: |
| `node --check apps/desktop/scripts/check.mjs` | 0 |
| `node --check apps/desktop/scripts/e2e-macos.mjs` | 0 |
| `node --check packages/host-adapter/macos/index.js` | 0 |
| `node --check packages/host-adapter/macos/test/adapter.test.mjs` | 0 |
| `node apps/desktop/scripts/check.mjs` | 0 |
| `node -e 'JSON.parse(...)'` for Tauri and adapter package JSON | 0 |
| `git diff --check -- apps/desktop packages/host-adapter/macos` | 0 |

No build, GUI fixture, signing, API integration or business E2E was rerun in r2. The r1 native PID/Webview request/workspace fixture result remains local evidence only; System Events window pixel inspection was unavailable. Lead will assign r3 for actual main-worktree Web `dist` and API integration.

## Stable handoff fields

- `files_changed`: the 12 files listed above, plus this integration report.
- `tests_added`: existing r1 macOS adapter test and GUI fixture script were transferred; none newly authored in r2.
- `commands_run`: listed in the checks table; target/source `git status`, source/target `shasum -a 256` and `apply_patch` also completed.
- `implementation_facts`: exact r1 desktop source/config/test transfer, target/source digests equal.
- `contract_changes_proposed`: none.
- `open_risks`: r3 live integration, real session/keychain recovery, API/Worker lifecycle, window pixel verification, unsigned release limits.
- `docs_to_update`: Lead may attach this r2 transfer record to V1 implementation status after r3 verification.
- `unfinished_items`: r3 integration and release gates remain with Lead.
- `lead_or_planner_decisions_needed`: none for this r2 transfer.
