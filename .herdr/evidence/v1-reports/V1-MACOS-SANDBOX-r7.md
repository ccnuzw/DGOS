# V1-MACOS-SANDBOX r7 / Worker-F

status: diagnosis_complete; no product edit
work_package: V1-MACOS-SANDBOX diagnosis r7
files_changed: `.herdr/V1-MACOS-SANDBOX-r7.md` only
tests_added: none (temporary canaries only)

## Finding

On this host, E's narrow `sandbox-exec` policy aborts Node before JavaScript with exit 134. The task-specific `node-2026-10-02-101948.ips` (PID 64476) reports `SIGABRT`, termination namespace `<0x23>` code `2`, and a faulting dyld stack at `dyld4::CacheFinder::CacheFinder` → `ignition_halt` → `__abort_with_payload`. It does not include a denied path or dyld diagnostic message. The cause is a file **data** read denied during dyld startup, but the required path is not established.

The binary is `/Users/apple/.hermes/node/bin/node` (`realpath /Users/apple/.local/bin/node`). Starting from E's current policy in `apps/extension-runner/src/mcp-transport.mjs` (Node executable, `/dev/null`, `/dev/urandom`, `/System/Library`, `/usr/lib`, `/usr/local/lib` and approved roots), these single-operation additions gave:

| Additional permission | `node -e 'process.stdout.write("node-ok\\n")'` |
| --- | --- |
| `file-read-metadata` | exit 134 |
| `file-read-xattr` | exit 134 |
| `file-map-executable` | exit 134 |
| `file-read-metadata` + `file-read-xattr` | exit 134 |
| `file-read-data` | exit 0, `node-ok` |
| `file-read*` | exit 0, `node-ok` |

All probes retained `(deny file-write*)` and `(deny network*)`. Adding only `file-read-data` for each of `/System/Volumes/Preboot/Cryptexes/OS/System/Library/dyld`, `/System/Volumes/Preboot/Cryptexes/OS/System/Library`, `/System/Volumes/Preboot/Cryptexes/OS/usr/lib`, `/System/Volumes/Preboot/Cryptexes/OS`, `/System`, `/usr`, `/private`, `/var`, `/Library`, `/Users/apple/.hermes/node`, `/dev`, `/tmp`, or `/etc` still exited 134. These tests rule out each path *in isolation*, not combinations. No task-specific `sandboxd` denial was returned by `log show` predicates for `Sandbox: node` or `node`/`dyld` in the last few minutes.

An outside-file control used a new `/tmp/dgos-sandbox-r7.*` empty file. With global `(allow file-read-data)` and an explicit `(deny file-read-data (literal "<fixture>/outside.txt"))`, Node started, `fs.readFileSync` of that controlled file returned `EPERM`, and the canary exited 0. This confirms that a specific deny can override the broad allowance for that file. It does **not** make global `file-read-data` safe for deployment: a finite denylist cannot protect unknown private data or the DGOS Secret root.

## Recommendation to E

Do not promote global `file-read-data` or a denylist workaround to the product policy. Keep the current fail-closed restricted profile until the exact startup dependency is identified. A narrow allowlist change needs a task-specific sandbox denial with operation/path or a controlled minimal policy that both starts Node and denies a controlled outside file, followed by the normal MCP fixture. Current host diagnostics do not supply that path, so an exact minimal working policy is **not established** in r7. This is a precise blocker for the macOS restricted Node fixture; Linux results are outside this report.

## Commands and limits

- `realpath /Users/apple/.local/bin/node` → `/Users/apple/.hermes/node/bin/node`.
- `rg -n 'pid|exception|termination|faultingThread|CacheFinder|ignition_halt|__abort_with_payload|dyld|sandbox|procPath|path' ~/Library/Logs/DiagnosticReports/node-2026-10-02-101948.ips` → task PID 64476 and dyld abort stack; unrelated paths/content were not copied.
- `/usr/bin/sandbox-exec -p "<base policy><one additional operation/path>" /Users/apple/.hermes/node/bin/node -e 'process.stdout.write("node-ok\\n")'` → results above.
- `/usr/bin/sandbox-exec -p "<base policy>(allow file-read-data)(deny file-read-data (literal \"<tmp fixture>/outside.txt\"))" /Users/apple/.hermes/node/bin/node -e '<fs.readFileSync controlled fixture>'` → `blocked:EPERM`, exit 0.
- `log show --last 3m/5m --style compact --predicate '<task node sandbox predicate>'` → no matching lines. This is absence of visible diagnostic output, not proof that the OS recorded no denial.

implementation_facts: no source edits; desktop r6 was not rerun
contract_changes_proposed: none
open_risks: exact dyld startup read path unknown; macOS restricted MCP fixture remains unverified
docs_to_update: none
unfinished: determine exact dependency from appropriate task-only sandbox diagnostics, then verify a narrow policy and MCP fixture
lead_or_planner_decisions: none
