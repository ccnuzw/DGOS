# V1-MACOS-SANDBOX r8 root follow-up / Worker-F

status: minimal Node startup policy found; product unchanged
work_package: V1-MACOS-SANDBOX r8 bounded follow-up
files_changed: `.herdr/V1-MACOS-SANDBOX-r8-root.md` only
tests_added: none (three controlled one-shot canaries)

## Immediate result for E

Starting from E's existing narrow macOS policy in `apps/extension-runner/src/mcp-transport.mjs`, append **only**:

```scheme
(allow file-read-data (literal "/"))
```

The Node startup canary then prints `node-ok` and exits 0. This grants data read on the root directory entry only; it is not `(subpath "/")` and does not grant recursive private file reads. The restricted MCP fixture and an outside-file rejection canary still need E's verification before calling the product path complete.

## Exact bounded results

Each command used `/usr/bin/perl -e 'alarm 5; exec @ARGV' /usr/bin/sandbox-exec -p "<existing narrow policy><addition>" /Users/apple/.hermes/node/bin/node -e 'process.stdout.write("node-ok\\n")'`. The existing policy included `(deny file-write*)` and `(deny network*)`. No canary read any file content.

| Addition | Result |
| --- | --- |
| `(allow file-read-data (literal "/"))` | `node-ok`, exit 0 |
| `(allow file-read-metadata (literal "/"))` | exit 134, no JS output |
| `(allow file-read-data (literal "/") (literal "/System"))` | `node-ok`, exit 0 |

The third result shows that `/System` literal is unnecessary for this startup canary. The first result explains why r7's top-level subpath additions failed and r8's global data plus per-top-level deny tests succeeded: the missing read is at the root directory itself. This is a host-specific controlled observation, not yet an MCP integration result.

implementation_facts: no E source edits; no desktop r6 rerun; no private data read
contract_changes_proposed: minimal macOS sandbox policy addition above, subject to E's fixture and outside-file rejection test
open_risks: MCP fixture and outside-private deny behavior under this exact policy unverified in this follow-up
docs_to_update: none
unfinished: E product verification
lead_or_planner_decisions: none
