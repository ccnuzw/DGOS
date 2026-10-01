# DGOS V1 Desktop Host

This directory contains the minimal Tauri 2 host for the DGOS macOS desktop surface. The Rust process only creates the native window. It does not duplicate authentication, provider, task, SSE, artifact, or settings logic.

The window loads the same `apps/web` entry point used by the browser:

- Development: Tauri runs `pnpm --filter @dgos/web start`, then loads `http://127.0.0.1:4173`.
- Build: Tauri runs `pnpm --filter @dgos/web build`, then packages `../../web` as the frontend asset directory.
- API: the Web entry point continues to call the shared HTTP/SSE API at the configured origin. Start the API with `pnpm --filter @dgos/api dev` (default `http://127.0.0.1:3000`).

## Commands

From the repository root:

```bash
pnpm install
pnpm --filter @dgos/desktop check
pnpm --filter @dgos/desktop dev
pnpm --filter @dgos/desktop build:macos
```

`build:macos` requires the Tauri CLI (`cargo install tauri-cli --version '^2'`) and Xcode's macOS SDK. The expected artifacts are under `apps/desktop/src-tauri/target/release/bundle/`, including `macos/DGOS.app` and `dmg/DGOS_0.1.0_aarch64.dmg` on Apple Silicon.

## macOS acceptance

Start the API, worker, and provider fixture in separate terminals, then run `pnpm --filter @dgos/desktop dev`. In the Tauri window, record a screenshot and log for each step:

1. Window starts and shows the shared DGOS login page.
2. First-time setup calls `POST /api/v1/identity/admin/bootstrap`; close and reopen, then login with `POST /api/v1/identity/admin/login` and confirm the session/workspace remains available.
3. Provider configuration and model catalog load; enable a streaming text model.
4. Submit a text task, observe ordered SSE `text.delta` events, and confirm a terminal `succeeded` task.
5. Confirm the final text and Artifact link are rendered, then use Re-query / resume.
6. Read system settings/context and record a monotonically increasing `contextVersion` when the context changes.
7. Quit the app, relaunch it, verify session/workspace recovery, then quit normally.

Run `pnpm --filter @dgos/desktop e2e:macos` for the explicit automation gate. It exits with code 2 when a real GUI run is not available; that is a skip, never a pass.

## Environment record

The implementation environment for this change was macOS 27.0.1 (Darwin arm64), Node `v22.23.0`, pnpm `9.0.0`, Rust/Cargo `1.96.1`. The Tauri CLI was not installed and Xcode was unavailable (`xcodebuild` selected CommandLineTools), so native build and GUI E2E are blocked here. After installing prerequisites, run the commands above and store screenshots/logs under `apps/desktop/evidence/<timestamp>/`.
