# V1-EXT-PUBLIC r7 delivery

status: delivered
work_package: V1-EXT-PUBLIC r7 / Worker-H
date: 2026-10-02
workspace: /Users/apple/Progame/DGOS (main, explicit r7 path authorization)

## Scope and evidence

- Added only `scripts/v1-extension-management-http.mjs` and this report; the script writes append-only report/log/manifest files under `tests/extensions/evidence/`. No E product source or tests changed.
- Final paired evidence: `tests/extensions/evidence/V1-EXT-PUBLIC-r7-2026-10-02T02-12-38-366Z-6a4bea24.json`, `.log`, and `-manifest.json`. Report and log SHA-256 match the manifest; source hashes before and after the run match. Parent PID 60263 and worker PID 60280 are distinct.
- The script created a random `dgos_v1_ext_public_<hex32>` child of the dedicated Provider PostgreSQL database, applied 47 local migrations through frozen 0051 with board SHA checks for 0045-0051, used Redis DB5 under a unique `v1-ext-public:<hex>` secret prefix, and owned ports 15173-15174 during its run. The final inventory found zero child databases. No shared Redis flush occurred.

## Final result

`node scripts/v1-extension-management-http.mjs` exited 0: 8 passed, 0 failed. Public HTTP bootstrapped the admin and Provider, published the text Profile, validated an account/config, and set a subject quota. A separate OS worker processed connection tests, AI Tasks, and extension daemon ticks.

1. Public custom Skill create, local display rename, enable, signed APP installation with exact Skill/MCP dependencies, and explicit permission decisions retained stable Skill/package IDs.
2. Confirmed custom Run produced a real Task, one Provider HTTPS request, an Artifact, a `settled` reservation, and one usage event. Same request replay kept the Run ID.
3. Translation submitted a real Task, produced a JSON Artifact, settled quota with one usage event, and applied only the selected field. Reapplying at the old source version returned `version_conflict`.
4. Template credentials were rejected on an untrusted transport with no MCP install row. The accepted native local transport wrote the credential through the shared Redis Secret service. The independent daemon connected, discovered two declared tools, and invoked the credential tool successfully.
5. Trusted signed HTTPS online preview installed its staged 1.0.0 bytes after the remote fixture changed to 2.0.0. A later untrusted preview was rejected without creating another Skill install row.

## Diagnostics and limits

- An initial harness variable shadowing error stopped before migration. A later MCP fixture mismatch produced `extension.connect.fail` with `reasonCode=tool_catalog_invalid`: fixture `tools/list` returned `echo` and `credential`, but the harness manifest initially declared only `credential`. The manifest now declares both, and the final run passes. This was a harness fixture issue, not an E product defect. The one child database left by the initial harness error was checked for zero sessions, dropped by exact name, and a final inventory confirmed no remainder.
- `node --check scripts/v1-extension-management-http.mjs`: exit 0. `git diff --check`: exit 0. Final evidence SHA/source/PID/child-database check: exit 0. The local `psql` command was unavailable, so child-database inventory used the existing Node `pg` client against the dedicated parent.
- This is real local PostgreSQL, Redis DB5, public HTTP, separate OS worker, and controlled TLS fixtures on macOS. It does not validate a paid Provider, external online source, Linux sandbox, or final release candidate. E's later Linux sandbox view fix was outside this code and evidence; its macOS impact requires a fresh run after that change.

files_changed: [scripts/v1-extension-management-http.mjs, .herdr/V1-EXT-PUBLIC-r7.md, tests/extensions/evidence/V1-EXT-PUBLIC-r7-2026-10-02T02-12-38-366Z-6a4bea24.json, tests/extensions/evidence/V1-EXT-PUBLIC-r7-2026-10-02T02-12-38-366Z-6a4bea24.log, tests/extensions/evidence/V1-EXT-PUBLIC-r7-2026-10-02T02-12-38-366Z-6a4bea24-manifest.json]
tests_added: [scripts/v1-extension-management-http.mjs]
commands_run: [node --check scripts/v1-extension-management-http.mjs, node scripts/v1-extension-management-http.mjs, git diff --check, Node pg dedicated child-database inventory, evidence SHA-256 comparison]
implementation_facts: [public custom Skill Run to real Task/Quota/Artifact, public translation Task and source CAS apply, trusted template credential connect/discovery/invoke, signed online preview staged-byte install, distinct OS worker PID, isolated cleanup]
contract_changes_proposed: []
open_risks: [Linux sandbox r7 change not included in this macOS evidence, external production endpoints and final release candidate remain separate]
docs_to_update: [V1 evidence index and implementation status by Lead/Planner]
uncompleted_items: []
