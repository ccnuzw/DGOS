# V1-EXTENSION-ISOLATION r10 — Worker-E

status: review (static verification complete; actual HTTP/PG execution pending Lead)
work_package: V1-EXTENSION-ISOLATION r10 / DGOS-V1-IMPLEMENT-20261002 / V1-platform / V1-FR-003
files_changed: [scripts/v1-extension-http.mjs, tests/extensions/extension-http-daemon.mjs, .herdr/V1-EXTENSION-ISOLATION-r10.md]
tests_added: []
commands_run:
  - `pwd`: `/Users/apple/Progame/DGOS` (exit 0); native exec and role read succeeded.
  - `node --check scripts/v1-extension-http.mjs`: exit 0.
  - `node --check tests/extensions/extension-http-daemon.mjs`: exit 0.
  - Local, read-only `selectedMigrations(await discoverMigrations())`: 47 selected, last `0051-proxy-provisioning`, ordered set SHA-256 `0cb6df60c0bbd5527bc6c8f1314be67fed7dbe6de7f1de30bb8681771af2744d` (exit 0).
  - `rg -c "record\\(" scripts/v1-extension-http.mjs`: 12; inspected all case names and final JSON output.
  - `shasum -a 256` on the two edited source files: script `cc6bbb2e4ade7337d822b5c94b7d5416ba4190c2cd2448b3cc4fe4e05ab6e350`; daemon `3fb392a868424408d61deef0d5d18180ff59cf3c90c2c128074c9c910d20575a`.
implementation_facts:
  - Parent URL is constrained to local `127.0.0.1:5432/dgos_v1_extensions_r3final` with the `dgos` role and no URL query/fragment. It is used only for child CREATE/DROP; the harness migrates and runs on a random `dgos_v1_ext_http_<32 hex>` child.
  - Reuses the existing 47-entry frozen migration selector, which checks seven recent checksums and the ordered full-set digest before CREATE DATABASE. Child database is dropped by exact generated name in finally; cleanup errors fail the report. Temporary config and package store share one unique directory, removed in finally.
  - Removed historical `com.example.ext%` package deletion, extension row deletion, and reused/manual Session provisioning. Fresh admin bootstrap supplies the current Session; mutation requests carry `x-dgos-csrf` and same-origin header for the current CSRF contract. Original 12 case records, business assertions, console case JSON, and report/manifest output remain.
  - Daemon accepts only the strict random HTTP child name or the original fixed dedicated `dgos_v1_extensions_r3final` database on local PostgreSQL. Daemon startup timeout and stop paths terminate their own process before database cleanup.
contract_changes_proposed: []
open_risks:
  - Actual local PostgreSQL, API, daemon, sandbox, and 12/12 business results were not run in this network-restricted Worker session; Verify currently blocks the old script until Lead runs the corrected asset.
  - If live execution reveals product behavior failure, return it to Lead; this work package does not authorize product or permission changes.
docs_to_update: [FR003 implementation/verification evidence after Lead's actual run, V1 implementation status only after verified results]
incomplete: [Lead to run actual isolated 12-case harness, inspect evidence/cleanup and commission Verify independent review]
decisions_needed_from_lead_or_planner: []
limitations: [Static checks prove source shape and migration selection only; no database, network, or runtime acceptance claim.]
