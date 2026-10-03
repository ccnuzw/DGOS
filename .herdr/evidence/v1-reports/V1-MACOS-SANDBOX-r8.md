# V1-MACOS-SANDBOX r8 / Worker-F

status: bounded_diagnosis_complete; no product edit
work_package: V1-MACOS-SANDBOX diagnosis r8
files_changed: `.herdr/V1-MACOS-SANDBOX-r8.md` only
tests_added: none (15 bounded one-shot canaries)

## Evidence for E

The base policy and Node binary are those recorded in r7 (`/Users/apple/.hermes/node/bin/node`). Each variant ran `/usr/bin/perl -e 'alarm 5; exec @ARGV' /usr/bin/sandbox-exec -p "<base><variant>" <node> -e 'process.stdout.write("node-ok\\n")'`. Every policy retained `(deny file-write*)` and `(deny network*)`. No private file contents were read or printed by these canaries.

| Variant on base policy | Result |
| --- | --- |
| `(allow file-read-data (require-not (regex #"^/")))` | exit 134, no JS output |
| `(allow file-read-data)(deny file-read-data (subpath "/"))` | exit 134, no JS output |
| `(allow file-read-data)(deny file-read-data (regex #"^/"))` | exit 134, no JS output |

With global `(allow file-read-data)`, adding one top-level deny per run gave:

| Denied data subtree | Result |
| --- | --- |
| `/System` | exit 1; Node/OpenSSL reports `Operation not permitted` opening `/System/Library/OpenSSL//openssl.cnf` |
| `/usr`, `/private`, `/Library`, `/Users`, `/dev`, `/bin`, `/opt`, `/Applications`, `/Volumes`, `/var`, `/tmp` | each exit 0, `node-ok` |

The 3 nonpath/root variants plus 12 top-level variants are the complete r8 set: **15 variants total**, each with a 5-second alarm. The `/System` denial demonstrates a required absolute-path data read; the OpenSSL error is a later observable failure and does not identify the dyld read that causes exit 134 under the narrow policy. In r7, allowing only `/System` data on top of the base policy still exited 134. This combination is consistent with multiple startup reads or Sandbox path-filter semantics; it does not establish a minimal working allowlist. Individual successful denials do not prove those path families are unnecessary in every combination.

Recommendation: E should not ship global `file-read-data`, nor infer that `/System` alone is sufficient. A minimal product policy remains unproven on this host. The next useful evidence would be a task-specific denial showing the exact dyld operation/path or a controlled cumulative allowlist test with the outside-private canary; this r8 run intentionally stops at the requested 15 variants.

implementation_facts: no product changes; no desktop r6 rerun; no private data accessed
contract_changes_proposed: none
open_risks: macOS restricted Node/MCP fixture still blocked; exact dyld dependency unknown
docs_to_update: none
unfinished: minimal allowlist and MCP fixture verification
lead_or_planner_decisions: none
