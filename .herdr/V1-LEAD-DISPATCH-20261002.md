# V1 Lead dispatch convergence / 2026-10-02

## Role and ownership

- Lead owns global scheduling, conflict handling, integration, candidate freeze, authoritative implementation state and release gate.
- Planner owns specification/context/task-pack/traceability reconciliation. Planner must resolve the declared-vs-observed requirement registry mismatch before candidate freeze.
- Verify owns independent coverage extraction, candidate tooling, evidence classification and final verification. Verify does not claim product behavior from worker reports.
- Workers own only their assigned implementation or verification paths and must stop writing after their report.

## Current dispatch state

| Lane | Package | Result/state | Lead action |
| --- | --- | --- | --- |
| Planner | `V1-SPEC-CLOSURE-r19` | pane exists at `wJ:pG`, but runtime prompt mapping is unavailable | Restore existing OpenCode Planner pane; do not start duplicate or use Lead pane |
| Verify | `V1-VERIFY-CANDIDATE-r16` | partial; tooling 26/26; no candidate groups | Accept report for review; resolve registry mismatch with Planner before freeze |
| Worker-A | `V1-IDENTITY-CLOSURE-r21` | review; PG blocked by local EPERM | Lead/Verify rerun in socket-capable isolated PG environment |
| Worker-B | `V1-PROVIDER-CLOSURE-r18` | partial; 23/35 pass, 7 socket failures, 5 PG skips | Do not promote; rerun full suite in socket/PG environment |
| Worker-C | `V1-GOV-QUOTA-CLOSURE-r12` | delivered; memory/security pass, PG blocked | Rerun PG retention/quota/audit closure in isolated DB |
| Worker-D | `V1-REMAINING-BROWSER-r10` | delivered_static; Chromium Mach-port blocked before page load | Move to authorized browser host; no product defect inferred |
| Worker-E | `V1-EXT-SANDBOX-CLOSURE-r11` | review; macOS sandbox and loopback blocked; Linux bwrap unavailable | Reproduce in authorized macOS/Linux runtime |
| Worker-F | `V1-NATIVE-CLOSURE-r15` | review; native run blocked before DB access / prior bridge timeout | Re-run only after socket-capable environment is available |
| Worker-G | `V1-PACKAGE-LIFECYCLE-r12` | completed with environment limit; unit pass, HTTP/PG blocked | Rerun public package HTTP in authorized environment |
| Worker-H | `V1-WORKBENCH-TASK-CLOSURE-r10` | delivered; 9 deterministic pass, upstream socket blocked | Rerun provider/browser/native path after environment recovery |
| Worker-I | `V1-OPS-SECURITY-CLOSURE-r11` | partial; config fail-closed, Docker/runtime/fixture blocked | Requires Docker-capable release environment and candidate image |

## Lead gating decision

No worker result is promoted to V1 complete. The common blocker is the current restricted environment: PostgreSQL loopback EPERM, Chromium Mach-port denial, Docker API denial, missing Linux bwrap host. These prevent the required real-resource evidence. Re-running the same commands in this shell would be duplicate noise, not progress.

The next executable gate is Planner reconciliation of the registry mismatch:

- observed functional AC headings: 42
- declared target AC count: 62
- observed matrix E2E rows: 13
- declared target E2E count: 12

Until Planner identifies the authoritative source for the 20 missing AC and the extra E2E row, Verify must keep coverage incomplete and Lead must not freeze candidate bindings.
