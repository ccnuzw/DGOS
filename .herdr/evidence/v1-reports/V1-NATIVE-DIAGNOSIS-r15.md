# V1-NATIVE-CLOSURE-r15 / Worker-F

- `status`: partial / environment-blocked
- `work_package`: `V1-NATIVE-CLOSURE-r15`
- `revision`: `15`
- `files_changed`: `apps/desktop/scripts/workbench-main-driver.js`, `.herdr/V1-NATIVE-DIAGNOSIS-r15.md`
- `tests_added`: []
- `contract_changes_proposed`: []
- `docs_to_update`: []

The existing foreground r13 evidence established the real bridge boundary: the main driver reached `workbench_frame_present`; iframe `present` and `load` succeeded; the frame driver injected and emitted `workbench.ready`; `frameReady=true`; native PID and WindowServer owner PID matched. `dgos.app.ready` remained absent, so the failure is in host hello to app-ready delivery rather than iframe creation or native window lifetime.

This revision fills the remaining evidence gap without changing production behavior. The main driver now records host hello send count, generated instance ID, first/last send time, synchronous send errors, and any received `dgos.app.ready` origin/instance/version. Hello is sent once immediately after iframe discovery and retried at the existing 250ms cadence until readiness. Sandbox, permissions, signed resource, wait thresholds, and production protocol are unchanged.

Actual execution in this Worker session was blocked before native startup:

```text
node apps/desktop/scripts/candidate-preflight.mjs
```

Exited `0`: 47 migrations through `0051-proxy-provisioning`, frozen signed package and embedded Web assets matched.

```text
node scripts/v1-desktop-real.mjs
```

Exited `1`: `connect EPERM 127.0.0.1:5432 - Local (0.0.0.0:0)`. No database, native process, Keychain item or GUI window was created. Manifest retained at `.herdr/V1-NATIVE-EXECUTION-r13-2026-10-02T07-02-03-367Z-02640319-manifest.json`, SHA-256 `37df94a1147d114b429a2c7f93a7560277cc8858eb9f32c42e31a93f789c3c0b`; `sourceDrift=false`, no setup cases, cleanup has no created resources.

The earlier real bridge diagnostic manifest remains the authoritative runtime evidence for the failure:

`.herdr/V1-NATIVE-EXECUTION-r13-2026-10-02T06-00-39-305Z-9288255d-manifest.json`

It contains the ordered stage history, loaded/injected iframe, `frameReady=true`, `bridgeReady=false`, no iframe errors, live owner-PID-matched window, screenshot and complete cleanup.

Hashes:

- `apps/desktop/scripts/workbench-main-driver.js`: `dd23942b5c30ee890ce591c9dc29b0a26996eaad47f5b015b2a7b268a92fa1dd`
- `apps/desktop/scripts/workbench-frame-driver.js`: `98f597f38c1a8d955b9153eb544337fdfea5f57bf0e58920242a90ec06fbe01e`
- frozen `apps/web/dist/index.html`: `550b23358dbf1324c1cdf67456242e4d7c64368468790a1940edb1201aeb835f`
- frozen `apps/web/dist/assets/index-NFqsGjYo.js`: `360c42b6cc5d9e96c4e3354e4fa846865dc51c97133a901f40487f719752ce1c`
- frozen `apps/web/dist/assets/index-BFWr4XFs.css`: `fa3cf098e7e1bf210a0960839de2472b8f6fe88dcdbad29210e3ad7e77627383`

Lead should run from a foreground environment with loopback access:

```sh
node apps/desktop/scripts/candidate-preflight.mjs
node scripts/v1-desktop-real.mjs
```

The resulting manifest must show `hostHello.sent`, `hostHello.instanceId`, `hostMessages`, `frameReady`, `bridgeReady`, iframe events, Task/SSE/Artifact/reload/context evidence, window identity, screenshot and cleanup. This Worker cannot claim native closure because its real run was denied before setup.

- `implementation_facts`: iframe and frame-driver evidence from prior foreground runs; host hello diagnostics added in r15.
- `open_risks`: no new privileged r15 GUI result; signed Workbench closure remains unproven.
- `lead_or_planner_decisions_needed`: []
- `stop_writing_confirmation`: Worker-F stopped all writes after the diagnostic edit and will not rerun or rebuild without a new Lead assignment.

## Lead wave rerun

Wave `V1-LEAD-WAVE-20261002-02` was attempted from `/Users/apple/Progame/DGOS`.

| Command | Exit | Result |
| --- | ---: | --- |
| `pgrep -af 'dgos-desktop\|v1-desktop-real'` | nonzero | macOS `sysmond service not found`; process inventory unavailable |
| `node apps/desktop/scripts/candidate-preflight.mjs` | 1 | blocked before native startup: `signed_resource_drift:workbench.js`; actual `ae36fdd54a42792688fb26dce6be6d6981a7aa0c10359854f433a813c50945457`, expected `7aad9fa1a33b51c081ed8e3e585942aebec17f18484ce08d944c752036619d2c` |
| `node scripts/v1-desktop-real.mjs` | not run | preflight gate failed; no native PID, window, database, Redis prefix or Keychain item created |

The package and signed envelope are outside this Worker package and were not modified. Assigned driver hashes remain `workbench-main-driver.js` `dd23942b5c30ee890ce591c9dc29b0a26996eaad47f5b015b2a7b268a92fa1dd` and `workbench-frame-driver.js` `98f597f38c1a8d955b9153eb544337fdfea5f57bf0e58920242a90ec06fbe01e`.

`stop_writing_confirmation`: no native runner was started; Worker-F stopped after the preflight gate and made no package, Web/dist, Rust, real-runner or migration changes.

## Lead wave 02 retry result

Preflight was rerun and passed before the registered native command:

- `node apps/desktop/scripts/candidate-preflight.mjs` -> exit `0`
- migration count `47`, final `0051-proxy-provisioning`
- package digest `sha256:8f643ee33ec7c663a09bd15f28cd1437c61434a9bba08190786fd2ff6f446afb`
- envelope SHA-256 `102fb6cac8aa112f7d762ea7f4e0defceb9af0ea543f02de367d7694494451be`
- trust roots SHA-256 `bad1036ed3b953108b9c7f785f1062ebe47d079bffe1ba5eca300057adfee1a0`
- dist entry assets `assets/index-NFqsGjYo.js` and `assets/index-BFWr4XFs.css`
- debug app SHA-256 `113c972cd323d7a717a8a68d57e0ae48140f8ccb041c8509584e9fd732aa4d0a`

The registered foreground command was then run:

- `node scripts/v1-desktop-real.mjs` -> exit `1`
- exact error: `connect EPERM 127.0.0.1:5432 - Local (0.0.0.0:0)`
- manifest: `.herdr/V1-NATIVE-EXECUTION-r13-2026-10-02T11-02-40-697Z-9681fc5c-manifest.json`
- manifest SHA-256: `37df94a1147d114b429a2c7f93a7560277cc8858eb9f32c42e31a93f789c3c0b`
- cases: `[]`; no native PID/window, database, Redis prefix or Keychain item; `sourceDrift=false`

The earlier preflight drift was not a driver issue. The current preflight binding is coherent; the remaining block is this session's loopback permission during the real runner. Package, Web/dist, Rust, real runner and migrations were not modified.

`stop_writing_confirmation`: Worker-F stopped after recording the passed preflight and loopback-blocked real-runner manifest; no further native execution or writes will occur without a new Lead instruction.
