# V1-UI-MANAGEMENT-FIXTURE r8

- status: ready_for_D_browser; fixture running, source writing stopped
- work_package: V1-UI-MANAGEMENT-FIXTURE r8 / Worker-H
- files_changed: `scripts/v1-ui-management-fixture.mjs`; this report. Private ignored state under `data/v1-ui-management-fixture/`.
- tests_added: none; live public HTTP smoke below.
- contract_changes_proposed: []
- docs_to_update: []
- incomplete_items: D browser translation and MCP flows; D owns browser evidence.
- decisions_needed: []

## Runtime

Run from `/Users/apple/Progame/DGOS`:

```sh
node scripts/v1-ui-management-fixture.mjs
```

Current process is already running (PID 91820). Web `http://127.0.0.1:15176`, API `http://127.0.0.1:15175`, local CA TLS fixture `127.0.0.1:15177`. Current Web `dist/index.html` SHA-256: `339a1b342e8ea3e944af53ac1197b827b0d9f375035ad2d1a26f3af03c6ba52c`. The serve script proxies real requests to the API. No browser request interception is involved.

Private state is `data/v1-ui-management-fixture/state.json` (mode 0600). It contains current random database, namespace, PIDs, identifiers and private credential file location. Private credentials are in `data/v1-ui-management-fixture/a70fc67366c15f14b9dc16c45fd57c57/credentials.json` (mode 0600). Read only for the test operator; never copy credentials to a report or screenshot. Browser login uses `adminCredential` from that file. `sessionId` is also provided for private scripted verification; the browser should use login. MCP install form uses `mcpCredential` from the same file.

Current child database: `dgos_v1_ui_management_a70fc67366c15f14b9dc16c45fd57c57` on parent `127.0.0.1:5432/dgos_v1_provider`; Redis DB 5 namespace `v1-ui-management:a70fc67366c15f14b9dc16c45fd57c57`. Dedicated worker PID 91834; Web PID 91838. API/TLS and parent supervisor PID 91820. D's 15200 group is untouched.

## D browser inputs

1. Sign in at Web URL using private `adminCredential`.
2. Skill management: create a custom Skill with a unique ID, name and system prompt; load its definition. Translate to `en-US`, select `name` (other selected fields also work), Provider config ID `fa4b74ab-e8ee-4ec8-8d28-01e3880fc5cd`, model ID `fixture-model`. Read task until succeeded, read Artifact, then apply. The Provider fixture emits JSON with exactly selected keys and ` translated` appended to each value.
3. MCP templates: choose `ui_management`, preview trusted source `system:ui_management_a70fc67366c15f14b9dc16c45fd57c57`, enter private `mcpCredential` in required `apiKey`, confirm install. Then enable, connect, discover tools and invoke `credential` with caller app ID `com.example.uimanagementa70fc67366c15f14b9dc16c45fd57c57`. The installed signed caller app has the `mcp.tool.invoke` permission scoped to `mcp:mcp_a70fc67366c15f14b9dc16c45fd57c57:credential`. MCP manifest/version `mcp_a70fc67366c15f14b9dc16c45fd57c57` / `1.0.0`.

## Commands and evidence

- `node --check scripts/v1-ui-management-fixture.mjs`: exit 0.
- `node scripts/v1-ui-management-fixture.mjs`: live, emitted `status: ready`; migrations through 0051 frozen checksum allowlist, public Provider connection and model policy setup completed.
- Public HTTP smoke via Web proxy (`15176/api/v1`): created Skill `ui_translation_93268a90b02b44cb8aed88dc97069551`; translation task `74f9d352-6c24-4658-8539-d5726d914670` succeeded; Artifact `99a45dc8-7de3-4224-97fd-b14e6c2ba6bb` was JSON `{"name":"Greeting translated"}`; apply persisted `localizedDisplay.en-US.name`.
- Public MCP template query returned `ui_management` / `needs-credentials`; public preview returned `trustState: verified`, MCP ID above. First install is intentionally unconsumed for D.
- 15176 Web proxy credential-write transport probe: `PUT /api/v1/mcp/<nonexistent>/config` with private fixture credential returned `404 extension_not_found`. This route checks `secureTransport` and credential shape before record lookup, so the credential path passed its transport gate; no MCP was installed or modified. Browser first install remains for D.
- Second launch attempt exited on exclusive `state.json` creation (`EEXIST`), and the state file SHA-256 stayed `5ac5dd9b0560a875424c618e190c9ac30d56a6581e3a55f3ebc1f9bfffb75941`. Script also prechecks 15175–15177 before creating a child database. Redis cleanup accepts iterator batches or individual keys and filters for its exact namespace before deletion.

Evidence grade: controlled local HTTPS Provider and stdio MCP fixture with real API, PostgreSQL, Redis, separate OS worker and daemon. No external production Provider. D subsequently reported real UI navigation 1/1 passed against this fixture after the Action worker handoff; other D browser results belong to D's evidence.

## Cleanup

When D and Lead are finished:

```sh
node scripts/v1-ui-management-fixture.mjs --stop
```

This validates the supervisor PID, sends SIGTERM, stops Web and worker, closes API/TLS, deletes only matching Redis prefix keys, drops only the random child database, and removes private state/cert/credentials. The active foreground process may also be stopped with SIGINT and performs the same cleanup. Do not stop during D's browser run.

## Limits

- The local certificate expires one day after generation. Restart the fixture if the browser run extends beyond that.
- This process must remain alive for the browser run; source/dist changes require restarting after D's agreed window.
- Current supervisor PID 91820 predates the final startup/cleanup hardening edit, while attached worker PID 8092 loaded the Action worker supplement and current worker-side source. Web PID 91838 remains unchanged. The API's in-memory modules were not reloaded; this fixture does not claim Lead fresh gate or A17 API behavior. The latest startup and cleanup logic applies on the next full launch.
- `--stop` validates the scoped database/namespace, handles attached worker PID 8092, and recovers stale private state after verified supervisor exit. Do not run it during D consumption.
- MCP credential install/config/connect/invoke were prepared for D's real browser flow; this report does not substitute for D's browser evidence.

## Action worker handoff, r8 narrow supplement

Lead confirmed D had no 15176 business operation in flight. `ps -p 91834 -o pid=,command=` identified this fixture's original `--worker` child, then `kill -TERM 91834` completed with exit. `node scripts/v1-ui-management-fixture.mjs --worker-attach` now runs as PID 8092 against the same database, Redis namespace, certificate and extension config. The child starts and stops `runtime.actionRuntime.worker` in addition to the existing Provider, AI Task and Extension daemon loops. API 91820 and Web 91838 were not restarted. Private state now has `attachedWorkerPid: 8092`; credential file and random database remain the same. D may resume.

Before handoff, three queued `system.navigate.system.settings` Runs were recorded: `0c4e35e2-5b26-48ec-a34b-858c8d2f356c`, `ad8f6c86-9039-49c7-b069-90a6e68d25ed`, `df37cb09-977e-409d-b922-5197eb35024f`. Their absolute `timeout_at` values were 03:30:54, 03:31:19, 03:31:52 UTC respectively. The new worker claimed each after expiry and preserved them as `failed/action_timeout`, with one handler claim each. No deadline or original Run was rewritten.

One new public Web-proxy `plan` and `execute` request for `system.navigate.system.settings` produced Run `36541992-6b54-4442-aab9-c51a1f327ea8`, terminal `succeeded`, result `navigation.target=system.settings`. The MCP install remained `enabled/connected` in the unchanged database. `node --check scripts/v1-ui-management-fixture.mjs` passed. API still contains its original loaded modules; Lead's fresh gate and A17 API code require a later coordinated full candidate rebuild, as directed by Lead.

D separately confirmed UI navigation 1/1 passed after worker attach. The current resource group stays live for D. For the later final candidate, after D has captured current evidence and Lead schedules the window, run `node scripts/v1-ui-management-fixture.mjs --stop` for scoped cleanup and then `node scripts/v1-ui-management-fixture.mjs` for a new random child database and processes loading latest source. That rebuild will not carry D's present child-database assets; preserve their evidence before cleanup. No API reload mechanism is added in this supplement.
