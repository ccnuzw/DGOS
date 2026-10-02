# V1-EXT-SANDBOX-CLOSURE r11 — Worker-E

status: review
work_package: V1-EXT-SANDBOX-CLOSURE-r11 revision 11
files_changed: [.herdr/V1-EXT-SANDBOX-CLOSURE-r11.md]
tests_added: []
commands_run:
  - `pwd`, role/AGENTS/work-package reads: exit 0, cwd `/Users/apple/Progame/DGOS`.
  - `node --test tests/extensions/mcp-transport.test.mjs`: 5 passed, 3 failed, 0 skipped. Cases 1-3, 7-8 passed. macOS sandbox case failed with `connection_not_ready` because sandbox-exec child exited during initialize. Two HTTP fixture cases failed with `listen EPERM: operation not permitted 127.0.0.1` due the restricted execution environment.
  - `node --test tests/extensions/mcp-transport.test.mjs --test-name-pattern='macOS sandbox profile'`: same macOS `connection_not_ready` failure after a temporary policy probe; probe was reverted.
  - `node --check apps/extension-runner/src/mcp-transport.mjs`: exit 0 after reverting the probe.
  - Static inspection: public management harness retains 8 `record()` cases; Linux profile uses `linux-bwrap`, fixture checks write/read/network denial, credential environment is server-owned, persisted Run and secret repository paths are present.
implementation_facts:
  - No source product changes remain from this r11 investigation. The existing runner has strict platform sandbox selection, approved cwd/read roots, Linux namespace/network isolation, macOS deny-default policy, server-owned credential injection, and persistent Run/credential repository flows.
  - Existing `scripts/v1-extension-management-http.mjs` contains 8 public management records including persisted task/run, quota/artifact, credential connect/invoke, permission and immutable online fixture checks.
contract_changes_proposed: []
open_risks:
  - macOS sandbox canary is not green in this restricted Worker environment; sandbox-exec exits before MCP initialize and exposes only `connection_not_ready`. The failure needs Lead/Verify reproduction in an authorized macOS runtime before any policy change.
  - HTTP fixture canaries cannot bind loopback here (`EPERM`); this is environment evidence, not an application pass.
  - No Linux host with `/usr/bin/bwrap` was available, so Linux normal/negative canary execution was not claimed.
  - Public management 8/8 and persisted credential/permission evidence are existing assets; not rerun by this Worker due network/socket restrictions.
docs_to_update: [Lead/Verify should attach actual Linux and macOS evidence to FR-003 closure; no V1 status update by Worker]
incomplete: [Lead/Verify runtime replay and classification of macOS sandbox-exec failure]
decisions_needed_from_lead_or_planner: [Whether macOS policy may be adjusted after an authorized reproduction]
limitations: [No network, no database, no service restart, no commit; static inspection and restricted test output only]
