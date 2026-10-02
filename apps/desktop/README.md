# DGOS V1 Desktop Host

This directory contains the Tauri 2 macOS host for DGOS. It owns native windows, workspace geometry and routes, the packaged API bridge, and the desktop session binding in the macOS keychain. Authentication and business state remain in the shared API.

The window loads the same `apps/web` entry point used by the browser:

- Development: Tauri starts the Web server on `127.0.0.1:15151`. Set `DGOS_DESKTOP_DEV_SERVER=1` when testing the development origin; packaged builds do not accept it.
- Build: Tauri runs `pnpm --filter @dgos/web build`, then packages `../../web/dist`.
- API: packaged `/api/v1/*` requests are routed by the native host to `DGOS_DESKTOP_API_ORIGIN`, a bare loopback HTTP origin (`http://127.0.0.1:3000` by default). The host pins the upstream Origin, adds the CSRF header, disables redirects, and keeps `dgos_session` only in the current macOS user's keychain. Set `DGOS_DESKTOP_API_ORIGIN=http://127.0.0.1:15152` for an isolated local API.
- Workspace: up to 12 native windows restore their route, size, position and maximized state from the app config directory. `DGOS_DESKTOP_WORKSPACE_FILE` may point to an absolute file for isolated tests.

## Commands

From the repository root:

```bash
pnpm install
pnpm --filter @dgos/desktop check
pnpm --filter @dgos/desktop dev
pnpm --filter @dgos/desktop build:macos
```

`build:macos` requires the Tauri CLI (`cargo install tauri-cli --version '^2'`) and macOS build tools. The expected artifacts are under `apps/desktop/src-tauri/target/release/bundle/`. A local unsigned `.app` can be built with `cargo tauri build --debug --bundles app -- --jobs 1` after Web `dist` exists. Signing and notarization require a real Apple identity and separate release evidence.

## macOS acceptance

Start the API, worker, and provider fixture in separate terminals, then run `pnpm --filter @dgos/desktop dev`. In the Tauri window, record a screenshot and log for each step:

1. Window starts and shows the shared DGOS login page.
2. First-time setup calls `POST /api/v1/identity/admin/bootstrap`; close and reopen, then login with `POST /api/v1/identity/admin/login` and confirm the session/workspace remains available.
3. Provider configuration and model catalog load; enable a streaming text model.
4. Submit a text task, observe ordered SSE `text.delta` events, and confirm a terminal `succeeded` task.
5. Confirm the final text and Artifact link are rendered, then use Re-query / resume.
6. Read system settings/context and record a monotonically increasing `contextVersion` when the context changes.
7. Quit the app, relaunch it, verify session/workspace recovery, then quit normally.

Run `pnpm --filter @dgos/desktop e2e:macos` after building the debug `.app` and `cargo build --manifest-path apps/desktop/src-tauri/Cargo.toml --bin dgos-keychain-fixture`. The fixture uses only a randomized `com.dgos.desktop.test.*` keychain service and loopback port `15159`. It checks the native process, Session binding, relaunch, revoked Session lookup and subject-scoped workspace without touching any other keychain item. On an unsigned local build, macOS may withhold keychain access behind an unautomated approval prompt; a failed gate is not a GUI pass. For a Lead-supplied API on `15151` through `15159`, set `DGOS_DESKTOP_API_ORIGIN` and run `node apps/desktop/scripts/e2e-macos.mjs --external-api`. That mode prepares the native entry only; login, task and window pixels remain separate integration checks.

## Environment record

The current implementation was checked on macOS arm64 with Node `v22.23.0`, Cargo `1.96.1` and Tauri CLI `2.12.1`. `xcodebuild` still selects CommandLineTools rather than full Xcode. The local debug `.app` and GUI fixture run succeeded; no signed or notarized release has been produced.
